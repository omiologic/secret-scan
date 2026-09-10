/**
 * The second in-page half of `scripts/qualify-browser-artifact.mjs`: the
 * published JavaScript package's own public API, running in a real browser
 * on the real WebAssembly artifact.
 *
 * `scripts/browser-harness.mjs` exercises the artifact through its own
 * exports; this exercises everything above it — the `imports` map selecting
 * the browser runtime, that runtime's normalization of opaque handles and
 * nested ranges, the initialization gate, and the frozen public finding —
 * which is the one layer no other check reaches.
 *
 * This module is bundled (the package resolves `#native` and the artifact
 * specifier through its own manifests, so it cannot be loaded from source in
 * a page) and the bundle is served beside the `.wasm` it fetches. Every
 * fixture comes from the canonical corpus and every input in it is synthetic
 * or explicitly revoked; nothing reported here carries an input, a matched
 * value, or a placeholder.
 */

import {
  RANGE_UNIT,
  SecretScanError,
  VERSION,
  createIncrementalSanitizer,
  initialize,
  redact,
  scan,
  scanAndRedact,
} from "@omiologic/secret-scan";

const results = [];
let failures = 0;

function check(name, run) {
  try {
    run();
    results.push({ name, ok: true });
  } catch (error) {
    failures += 1;
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Independent of the binding under test, as in the artifact harness. */
function byteOffsetToCodeUnitOffset(text, byteOffset) {
  return decoder.decode(encoder.encode(text).slice(0, byteOffset)).length;
}

function expectedTuples(text, expected) {
  return expected.map((item) => [
    item.detector,
    item.type,
    item.confidence,
    byteOffsetToCodeUnitOffset(text, item.start),
    byteOffsetToCodeUnitOffset(text, item.end),
  ]);
}

function actualTuples(findings) {
  return findings.map((finding) => [
    finding.detector,
    finding.type,
    finding.confidence,
    finding.start,
    finding.end,
  ]);
}

export async function qualify(fixtures) {
  // The gate first: nothing below is reachable until one `initialize()` has
  // resolved, and it must resolve against a real artifact, not a double.
  check("operations before initialize fail with NOT_INITIALIZED", () => {
    let thrown;
    try {
      scan("AKIASYNTHETICEXAMPLE0");
    } catch (error) {
      thrown = error;
    }
    assert(thrown !== undefined, "scan resolved before initialize()");
    assert(thrown instanceof SecretScanError, "a foreign error escaped the package");
    assertEqual(thrown.code, "NOT_INITIALIZED", "pre-initialize code");
  });

  await initialize();
  await initialize();

  check("the package reports its documented identity", () => {
    assertEqual(RANGE_UNIT, "utf16-code-units", "RANGE_UNIT");
    assertEqual(VERSION, fixtures.version, "VERSION");
  });

  const synchronous = fixtures.synchronous;
  check("the package matches the canonical synchronous corpus", () => {
    const mismatched = [];
    for (const fixture of synchronous) {
      const actual = actualTuples(scan(fixture.input));
      const expected = expectedTuples(fixture.input, fixture.expected);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatched.push({ id: fixture.id, expected, actual });
      }
    }
    assert(
      mismatched.length === 0,
      `${mismatched.length} fixture(s) disagreed: ${JSON.stringify(mismatched.slice(0, 5))}`,
    );
  });

  check("every published finding is frozen and carries no extra key", () => {
    const fixture = synchronous.find((entry) => entry.expected.length > 0);
    const [finding] = scan(fixture.input);
    assert(Object.isFrozen(finding), "the package returned a mutable finding");
    assertEqual(
      Object.keys(finding).sort(),
      ["action", "confidence", "detector", "end", "id", "start", "type"],
      "published finding keys",
    );
  });

  check("scanAndRedact equals scan then redact and removes every match", () => {
    for (const fixture of synchronous) {
      if (fixture.expected.length === 0) continue;
      const { text, findings } = scanAndRedact(fixture.input);
      assertEqual(
        text,
        redact(fixture.input, scan(fixture.input)),
        `fixture ${fixture.id} scanAndRedact disagreed with scan + redact`,
      );

      // Reconstruct the exact expected output from the fixture's own
      // findings, rather than searching the output for leftover matched
      // text: some fixtures (e.g. `contextual-positive-remaining-declared-
      // names`) legitimately repeat the same synthetic value across several
      // findings that resolve to different actions, so a `warn`/`allow`
      // finding can leave a byte-identical copy of a `redact`/`block`
      // finding's value elsewhere in the output. A blanket "does the output
      // still contain this value" search cannot tell that apart from an
      // actual redaction failure; an exact positional reconstruction can.
      let placeholderIndex = 0;
      let cursor = 0;
      const pieces = [];
      for (const finding of findings) {
        if (finding.action !== "redact" && finding.action !== "block") continue;
        placeholderIndex += 1;
        pieces.push(fixture.input.slice(cursor, finding.start));
        pieces.push(`<SECRET_${placeholderIndex}>`);
        cursor = finding.end;
      }
      pieces.push(fixture.input.slice(cursor));
      assertEqual(
        text,
        pieces.join(""),
        `fixture ${fixture.id} did not produce the exact expected redacted output`,
      );
    }
  });

  check("a policy callback sees a frozen finding with numeric offsets", () => {
    const fixture = synchronous.find((entry) => entry.expected.length > 0);
    const seen = [];
    const findings = scan(fixture.input, {
      policy: {
        evaluate(finding) {
          seen.push(finding);
          return "warn";
        },
      },
    });
    for (const finding of findings) {
      assertEqual(finding.action, "warn", "the custom policy's action");
    }
    assert(seen.length > 0, "the policy was never called");
    for (const finding of seen) {
      assert(Object.isFrozen(finding), "a policy callback saw a mutable finding");
      assert(typeof finding.start === "number", "start is not a number");
      assert(typeof finding.end === "number", "end is not a number");
    }
  });

  // Incremental sanitization is deliberately unavailable on this runtime:
  // `bindings/wasm` builds no streaming session, so the adapter rejects with
  // a fixed code rather than failing initialization
  // (`decision-define-runtime-bindings`).
  check("createIncrementalSanitizer rejects with INCREMENTAL_UNAVAILABLE", () => {
    let thrown;
    try {
      createIncrementalSanitizer({
        limits: {
          maxInputCodeUnits: 1_000_000,
          maxBufferedCodeUnits: 16_512,
          maxTokenCodeUnits: 8_192,
          maxMultilineCodeUnits: 16_384,
        },
      });
    } catch (error) {
      thrown = error;
    }
    assert(thrown !== undefined, "the browser runtime opened a session");
    assert(thrown instanceof SecretScanError, "a foreign error escaped the package");
    assertEqual(thrown.code, "INCREMENTAL_UNAVAILABLE", "incremental code");
  });

  return { ok: failures === 0, failures, checks: results };
}
