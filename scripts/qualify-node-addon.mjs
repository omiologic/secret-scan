/**
 * Qualifies a built N-API addon on the architecture it targets
 * (`decision-define-runtime-bindings`).
 *
 * Four passes, in order:
 *
 * 1. **Inspect** — the addon directory must hold the generated loader, its
 *    type declarations, and exactly one compiled `.node` file, and that file
 *    must carry the platform name the requested target maps to. Everything
 *    found is printed, so a release run records the artifact's contents
 *    rather than only its name.
 * 2. **Smoke** — `bindings/node/smoke-test.mjs`, the addon's own consumer
 *    test, run against the real artifact rather than a double.
 * 3. **Conform** — every canonical synchronous fixture
 *    (`decision-govern-cross-language-conformance`) through the addon's
 *    `scan`, with each expectation's UTF-8 byte offsets converted to UTF-16
 *    code units by an independent reference conversion.
 * 4. **Integrate** — the published JavaScript package's public API driven
 *    against the same addon, resolved the way an installed consumer resolves
 *    it, so the package's own binding glue is covered end to end.
 *
 * Every corpus input is synthetic or explicitly revoked, and no diagnostic
 * printed here carries an input, a matched value, or a placeholder. Usage:
 *
 *     node scripts/qualify-node-addon.mjs --target aarch64-apple-darwin
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CANONICAL_FIXTURE_ID,
  assertMatchesFixture,
  loadCanonicalFixture,
  packageVersion,
} from "./qualify-runtime-fixture.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ADDON_DIR = join(REPO_ROOT, "bindings", "node");
const JS_PACKAGE_DIR = join(REPO_ROOT, "packages", "javascript");
const FIXTURES_DIR = join(REPO_ROOT, "conformance", "fixtures");

/**
 * The `<platform>-<arch>[-<abi>]` name `@napi-rs/cli` gives the compiled
 * file for each declared target. `scripts/check-artifact-matrix.py`
 * requires every target in the declared matrix to appear here.
 */
const TARGET_PLATFORM_NAMES = {
  "x86_64-unknown-linux-gnu": "linux-x64-gnu",
  "aarch64-unknown-linux-gnu": "linux-arm64-gnu",
  "x86_64-unknown-linux-musl": "linux-x64-musl",
  "aarch64-unknown-linux-musl": "linux-arm64-musl",
  "x86_64-apple-darwin": "darwin-x64",
  "aarch64-apple-darwin": "darwin-arm64",
  "x86_64-pc-windows-msvc": "win32-x64-msvc",
  "aarch64-pc-windows-msvc": "win32-arm64-msvc",
};

/**
 * Limits generous enough that no canonical fixture reaches one. They only
 * have to be structurally valid: the Node runtime rejects the call before
 * any of them is consulted.
 */
const GENEROUS_LIMITS = Object.freeze({
  maxInputCodeUnits: 1_000_000,
  maxBufferedCodeUnits: 16_512,
  maxTokenCodeUnits: 8_192,
  maxMultilineCodeUnits: 16_384,
});

const failures = [];

function report(name, run) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`not ok - ${name}`);
    console.error(`    ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function reportAsync(name, run) {
  try {
    await run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`not ok - ${name}`);
    console.error(`    ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`${message}: expected ${right}, got ${left}`);
}

/**
 * The exact text `redact()`'s default formatter produces from `input` and
 * `findings`: `<SECRET_N>` (`N` one-based among `redact`/`block` findings,
 * `crates/secret-scan-core/src/redact.rs`) in place of each such finding's
 * span, everything else — including a `warn`/`allow` finding's own span —
 * passed through unchanged. An independent reconstruction from the
 * fixture's own findings, not a search over the output: a fixture can
 * reuse one literal secret value across findings with different actions or
 * lengths (`slack-positive-all-prefixes` has one finding's matched text as
 * a literal substring of another's), which makes "does this value still
 * appear anywhere" and "how many times does it appear" both unsound.
 */
function expectedRedaction(input, findings) {
  const redacted = findings
    .filter((finding) => finding.action === "redact" || finding.action === "block")
    .sort((a, b) => a.start - b.start);
  const pieces = [];
  let cursor = 0;
  redacted.forEach((finding, index) => {
    pieces.push(input.slice(cursor, finding.start));
    pieces.push(`<SECRET_${index + 1}>`);
    cursor = finding.end;
  });
  pieces.push(input.slice(cursor));
  return pieces.join("");
}

function parseArguments(argv) {
  const options = { target: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") {
      index += 1;
      const value = argv[index];
      if (value === undefined || !(value in TARGET_PLATFORM_NAMES)) {
        console.error(
          `--target must be one of ${Object.keys(TARGET_PLATFORM_NAMES).join(", ")}`,
        );
        process.exit(1);
      }
      options.target = value;
    } else {
      console.error(`unknown argument: ${argument}`);
      process.exit(1);
    }
  }
  return options;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Converts a canonical UTF-8 byte offset to a UTF-16 code-unit offset
 * without using the addon under test, so a conformance assertion cannot
 * validate the binding against its own conversion.
 */
function byteOffsetToCodeUnitOffset(text, byteOffset) {
  return decoder.decode(encoder.encode(text).slice(0, byteOffset)).length;
}

function loadSynchronousCorpus() {
  const corpus = JSON.parse(
    readFileSync(join(FIXTURES_DIR, "synchronous-corpus.json"), "utf8"),
  );
  assert(
    corpus.offsetUnit === "utf8-byte",
    `synchronous-corpus.json: offsetUnit is ${corpus.offsetUnit}`,
  );
  // "not-yet-evaluated" fixtures carry no expectation and document a future
  // gap, not a current behavioral contract.
  return corpus.fixtures.filter(
    (fixture) => fixture.support !== "not-yet-evaluated",
  );
}

function inspectAddon(target) {
  const entries = readdirSync(ADDON_DIR).filter(
    (name) => name !== "node_modules" && name !== "src",
  );
  console.log(`# ${ADDON_DIR}`);
  for (const name of entries.sort()) {
    const { size } = statSync(join(ADDON_DIR, name));
    console.log(`#   ${String(size).padStart(9)}  ${name}`);
  }

  const compiled = entries.filter((name) => name.endsWith(".node"));
  assert(
    compiled.length === 1,
    `expected exactly one compiled addon, found ${compiled.length}: ${compiled.join(", ")}`,
  );
  for (const required of ["index.js", "index.d.ts", "package.json"]) {
    assert(entries.includes(required), `${required}: missing from the addon`);
  }
  if (target !== undefined) {
    const expected = `redact-secret.${TARGET_PLATFORM_NAMES[target]}.node`;
    assertEqual(compiled[0], expected, "compiled addon name");
  }
  return compiled[0];
}

function runSmokeTest() {
  execFileSync(process.execPath, ["smoke-test.mjs"], {
    cwd: ADDON_DIR,
    stdio: "inherit",
  });
}

function conformAddon(fixtures) {
  const addon = createRequire(join(ADDON_DIR, "index.js"))("./index.js");
  addon.initialize();
  const mismatched = [];
  for (const fixture of fixtures) {
    const actual = addon
      .scan(fixture.input)
      .map((finding) => [
        finding.detector,
        finding.type,
        finding.confidence,
        finding.start,
        finding.end,
      ]);
    const expected = fixture.expected.map((item) => [
      item.detector,
      item.type,
      item.confidence,
      byteOffsetToCodeUnitOffset(fixture.input, item.start),
      byteOffsetToCodeUnitOffset(fixture.input, item.end),
    ]);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatched.push({ id: fixture.id, expected, actual });
    }
  }
  assert(
    mismatched.length === 0,
    `${mismatched.length} fixture(s) disagreed: ${JSON.stringify(mismatched.slice(0, 5))}`,
  );
}

/**
 * Resolves the addon under the specifier the package actually requires, by
 * linking it into the package's own `node_modules`.
 *
 * `packages/javascript` declares one per-platform addon package per
 * supported host (issue #79) and `runtime/node.js` picks between them; the
 * name is asked of that module rather than restated here, so this links
 * exactly what a consumer install would resolve. Nothing publishes those
 * packages during a qualification run, so the local build stands in for the
 * one npm would have fetched.
 */
async function linkAddon() {
  const { resolveAddonSpecifier } = await import(
    pathToFileURL(join(JS_PACKAGE_DIR, "dist", "runtime", "node.js")).href
  );
  const specifier = resolveAddonSpecifier();
  assert(
    specifier !== undefined,
    `no platform package is mapped for ${process.platform}/${process.arch}`,
  );
  const scope = join(JS_PACKAGE_DIR, "node_modules", "@redact-secret");
  const link = join(scope, specifier.split("/")[1]);
  mkdirSync(scope, { recursive: true });
  rmSync(link, { recursive: true, force: true });
  symlinkSync(ADDON_DIR, link, "junction");
  return link;
}

/**
 * Drives the published package's public API against the real addon,
 * resolved under the specifier an installed consumer resolves.
 *
 * This is the one layer no other check reaches: the package's own binding
 * glue, on a real artifact. `bindings/node` builds a real incremental
 * session (`decision-define-runtime-bindings`), so `initialize()` succeeds
 * and both the synchronous surface and `createIncrementalSanitizer` are
 * exercised here; `qualify-browser-artifact.mjs` exercises the same session
 * on the browser's WebAssembly artifact.
 *
 * The single-fixture assertion goes through `qualify-runtime-fixture.mjs`,
 * so this script embeds no fixture input of its own beyond a fixed synthetic
 * marker for the incremental session; the whole-corpus pass above already
 * covers the addon's own `scan`.
 */
async function integrateWithPackage() {
  const entry = join(JS_PACKAGE_DIR, "dist", "index.js");
  assert(
    existsSync(entry),
    `${entry}: missing; build the package with \`npm run js:build\``,
  );

  const fixture = await loadCanonicalFixture(CANONICAL_FIXTURE_ID);
  const expectedVersion = await packageVersion();

  const link = await linkAddon();
  try {
    const api = await import(pathToFileURL(entry).href);

    // Idempotent, and it must succeed: a rejection here means the addon no
    // longer satisfies the binding contract the package declares.
    await api.initialize();
    await api.initialize();
    assertEqual(api.VERSION, expectedVersion, "the package's reported version");
    assertEqual(api.RANGE_UNIT, "utf16-code-units", "RANGE_UNIT");

    const findings = api.scan(fixture.input);
    assertEqual(findings.length, 1, `fixture ${fixture.id} finding count`);
    assertMatchesFixture(findings[0], fixture);
    assert(Object.isFrozen(findings[0]), "the package returned a mutable finding");

    const { text, findings: combined } = api.scanAndRedact(fixture.input);
    assertEqual(
      text,
      api.redact(fixture.input, api.scan(fixture.input)),
      `fixture ${fixture.id} scanAndRedact disagreed with scan + redact`,
    );
    assertEqual(
      text,
      expectedRedaction(fixture.input, combined),
      `fixture ${fixture.id} left a redacted span in the output`,
    );

    // `bindings/node` builds a real session on the real addon: a value
    // split across chunks, including one that only closes on the next
    // chunk, must sanitize the same way the whole-input API does and never
    // leave the marker in its output.
    const MARKER = "SYNTHETIC_REVOKED_NODE_QUALIFICATION_MARKER";
    const session = api.createIncrementalSanitizer({ limits: GENEROUS_LIMITS });
    assertEqual(session.state, "accepting", "a fresh session's state");
    let sanitized = "";
    for (const chunk of [
      `api_key=${MARKER.slice(0, 10)}`,
      `${MARKER.slice(10)}\n`,
      "tail",
    ]) {
      sanitized += session.append(chunk).text;
    }
    sanitized += session.finalize().text;
    assertEqual(session.state, "finalized", "a finalized session's state");
    assert(!sanitized.includes(MARKER), "the session left the marker in its output");
    assert(sanitized.endsWith("tail"), "the session dropped trailing plaintext");

    // A session outside `accepting` rejects every further operation with a
    // fixed, input-free code rather than silently accepting it.
    let thrown;
    try {
      session.append("ignored");
    } catch (error) {
      thrown = error;
    }
    assert(thrown !== undefined, "a finalized session accepted another append");
    assert(
      thrown instanceof api.SecretScanError,
      "a foreign error escaped the package",
    );
    assertEqual(thrown.code, "INVALID_STATE", "post-finalize append code");
  } finally {
    rmSync(link, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const fixtures = loadSynchronousCorpus();
  assert(fixtures.length >= 100, `only ${fixtures.length} corpus fixtures`);

  console.log(`# node ${process.version} on ${process.platform}-${process.arch}`);
  report("the addon directory holds exactly one compiled artifact", () =>
    inspectAddon(options.target),
  );
  report("the addon passes its own consumer smoke test", runSmokeTest);
  report("the addon matches the canonical synchronous corpus", () =>
    conformAddon(fixtures),
  );
  await reportAsync(
    "the JavaScript package's public API runs on the real addon",
    integrateWithPackage,
  );

  if (failures.length > 0) {
    console.error(`\naddon qualification FAILED: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("\naddon qualification passed");
}

await main();
