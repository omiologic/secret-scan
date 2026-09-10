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
 * 4. **Integrate** — the published JavaScript package resolving the same
 *    addon under its own specifier, the way an installed consumer resolves
 *    it. That layer is not yet passable end to end: see
 *    {@link integrateWithPackage}, which pins the outstanding gap so it
 *    cannot close silently.
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

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ADDON_DIR = join(REPO_ROOT, "bindings", "node");
const JS_PACKAGE_DIR = join(REPO_ROOT, "packages", "javascript");
const FIXTURES_DIR = join(REPO_ROOT, "conformance", "fixtures");

/** The specifier the JavaScript package's Node runtime requires. */
const ADDON_PACKAGE = "@omiologic/secret-scan-node";

/**
 * The `<platform>-<arch>[-<abi>]` name `@napi-rs/cli` gives the compiled
 * file for each declared target. `scripts/check-qualification-matrix.py`
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
    const expected = `secret-scan.${TARGET_PLATFORM_NAMES[target]}.node`;
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
 * Resolves the addon under the specifier the package requires, by linking it
 * into the package's own `node_modules`. That is where an installed consumer
 * would find it, so `runtime/node.js` takes exactly the path it takes in
 * production instead of a test-only shortcut.
 */
function linkAddon() {
  const scope = join(JS_PACKAGE_DIR, "node_modules", "@omiologic");
  const link = join(scope, "secret-scan-node");
  mkdirSync(scope, { recursive: true });
  rmSync(link, { recursive: true, force: true });
  symlinkSync(ADDON_DIR, link, "junction");
  return link;
}

/**
 * The internal binding contract `packages/javascript/src/native.ts` declares
 * and `runtime/node.js` requires every member of before it will initialize.
 */
const BINDING_CONTRACT = [
  "version",
  "initialize",
  "scan",
  "redact",
  "scanAndRedact",
  "createIncrementalSanitizer",
];

/**
 * Drives the published package against the real addon, resolved under the
 * specifier an installed consumer resolves.
 *
 * This is where the one layer no other check reaches — the package's own
 * binding glue — meets the artifact, and today it records a gap rather than
 * a pass: no built artifact carries `createIncrementalSanitizer`, so
 * `runtime/node.js` refuses the addon and `initialize()` rejects with
 * `INITIALIZATION_FAILED`. The assertion below pins that exact state, so it
 * fails the moment the bindings gain the incremental surface (issues #73 and
 * #74) and must then be replaced by the positive public-API pass.
 */
async function integrateWithPackage() {
  const entry = join(JS_PACKAGE_DIR, "dist", "index.js");
  assert(
    existsSync(entry),
    `${entry}: missing; build the package with \`npm run js:build\``,
  );

  const link = linkAddon();
  try {
    const addon = createRequire(join(JS_PACKAGE_DIR, "dist", "runtime", "node.js"))(
      ADDON_PACKAGE,
    );
    const missing = BINDING_CONTRACT.filter(
      (name) => typeof addon[name] !== "function",
    );
    assertEqual(
      addon.version(),
      JSON.parse(readFileSync(join(JS_PACKAGE_DIR, "package.json"), "utf8")).version,
      "the resolved addon reports the package's version",
    );
    assertEqual(
      missing,
      ["createIncrementalSanitizer"],
      "the addon's outstanding gap against the binding contract",
    );

    const api = await import(pathToFileURL(entry).href);
    let rejected;
    try {
      await api.initialize();
    } catch (error) {
      rejected = error;
    }
    assert(
      rejected !== undefined,
      "initialize() resolved; the incremental surface has landed and this " +
        "check must be replaced by the positive public-API pass (#73, #74)",
    );
    assertEqual(rejected.code, "INITIALIZATION_FAILED", "initialize() code");
    console.log(
      "#   known gap: no built artifact carries createIncrementalSanitizer, " +
        "so the package cannot initialize on it (issues #73, #74)",
    );
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
    "the JavaScript package resolves the real addon under its own specifier",
    integrateWithPackage,
  );

  if (failures.length > 0) {
    console.error(`\naddon qualification FAILED: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("\naddon qualification passed");
}

await main();
