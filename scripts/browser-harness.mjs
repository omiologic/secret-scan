/**
 * The in-page half of `scripts/qualify-browser-artifact.mjs`: the checks the
 * browser WebAssembly artifact must pass in every supported engine
 * (`decision-define-runtime-bindings`).
 *
 * This module is served next to the artifact it imports, so the generated
 * `default()` init resolves `secret_scan_wasm_bg.wasm` from the same
 * directory and the whole surface is exercised exactly as a browser consumer
 * loads it: a real `fetch` of a real `.wasm` response, instantiated by the
 * engine under test.
 *
 * Every fixture comes from the canonical corpus
 * (`decision-govern-cross-language-conformance`), served alongside as
 * `fixtures.json`, and every input in it is synthetic or explicitly revoked.
 * Nothing this module reports carries an input, a matched value, or a
 * placeholder: a failure names the fixture and the metadata tuples only.
 */

import init, {
  initialize,
  redact,
  scan,
  scanAndRedact,
  version,
} from "./secret_scan_wasm.js";

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

/**
 * Converts a canonical UTF-8 byte offset to a UTF-16 code-unit offset
 * without using the artifact under test, so a conformance assertion cannot
 * validate the binding against its own conversion.
 */
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
    finding.range.start,
    finding.range.end,
  ]);
}

/**
 * The `[start, end)` UTF-16 ranges `scan` reports for `text`. Ranges only:
 * a comparison never materializes a matched value.
 */
function reportedRanges(text) {
  return scan(text).map((finding) => [finding.range.start, finding.range.end]);
}

function errorCode(thrown) {
  return thrown !== null && typeof thrown === "object" && "code" in thrown
    ? thrown.code
    : undefined;
}

export async function qualify(fixtures) {
  // Before `default()`: the module's own exports are not callable at all, so
  // the first observable contract is the one after instantiation.
  await init();

  // The lifecycle gate, checked before `initialize()` succeeds: a
  // synchronous operation must fail deterministically rather than scan.
  check("operations before initialize fail with NOT_INITIALIZED", () => {
    let thrown;
    try {
      scan("AKIASYNTHETICEXAMPLE0");
    } catch (error) {
      thrown = error;
    }
    assert(thrown !== undefined, "scan resolved before initialize()");
    assertEqual(errorCode(thrown), "NOT_INITIALIZED", "pre-initialize code");
  });

  check("initialize is idempotent", () => {
    initialize();
    initialize();
    initialize();
  });

  check("version reports the shared product version", () => {
    assertEqual(version(), fixtures.version, "artifact version");
  });

  const synchronous = fixtures.synchronous;
  check("the canonical synchronous corpus is not vacuous", () => {
    assert(synchronous.length >= 100, `only ${synchronous.length} fixtures`);
    assert(
      synchronous.some((fixture) => fixture.expected.length > 0),
      "no positive fixture",
    );
    assert(
      synchronous.some((fixture) => fixture.expected.length === 0),
      "no negative fixture",
    );
  });

  check("scan matches the canonical synchronous corpus", () => {
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

  // The corpus already carries an astral (supplementary-plane) character
  // ahead of a real detector's finding, so the check above is itself the
  // end-to-end "astral before a finding" evidence the conformance decision
  // requires. This asserts that evidence is actually present rather than
  // silently removed from the corpus.
  check("the corpus exercises an astral character before a finding", () => {
    const astral = fixtures.synchronous.filter(
      (fixture) =>
        fixture.expected.length > 0 &&
        [...fixture.input].some((character) => character.codePointAt(0) > 0xffff),
    );
    assert(astral.length > 0, "no positive fixture contains an astral character");
  });

  // The "after" case, over every positive fixture that can carry a suffix:
  // a finding whose expected span already reaches the end of the input is
  // an unterminated fail-safe match, so extending the input legitimately
  // extends it. The "within" case is not observable through any built-in
  // detector — none matches a span containing an astral character — and is
  // asserted at the unit level by `bindings/wasm/src/range.rs`.
  check("an astral character around a finding does not perturb its span", () => {
    // "\u{1F511} " is 3 UTF-16 code units and 5 UTF-8 bytes, so a binding
    // that leaked byte offsets would shift every span by 5 instead of 3.
    const PREFIX = "\u{1F511} ";
    const SHIFT = PREFIX.length;
    const perturbed = [];
    for (const fixture of fixtures.synchronous) {
      if (fixture.expected.length === 0) continue;
      const baseline = reportedRanges(fixture.input);
      const shifted = reportedRanges(PREFIX + fixture.input).map(
        ([start, end]) => [start - SHIFT, end - SHIFT],
      );
      if (JSON.stringify(shifted) !== JSON.stringify(baseline)) {
        perturbed.push(`${fixture.id} (prefix)`);
      }
      const inputBytes = encoder.encode(fixture.input).length;
      if (fixture.expected.some((item) => item.end === inputBytes)) continue;
      const suffixed = reportedRanges(`${fixture.input} \u{1F511}`);
      if (JSON.stringify(suffixed) !== JSON.stringify(baseline)) {
        perturbed.push(`${fixture.id} (suffix)`);
      }
    }
    assert(
      perturbed.length === 0,
      `${perturbed.length} fixture(s) shifted: ${perturbed.slice(0, 5).join(", ")}`,
    );
  });

  check("scanAndRedact equals scan then redact and removes every match", () => {
    for (const fixture of synchronous) {
      if (fixture.expected.length === 0) continue;
      const separate = redact(fixture.input, scan(fixture.input));
      const combined = scanAndRedact(fixture.input);
      assertEqual(
        combined.text,
        separate,
        `fixture ${fixture.id} scanAndRedact disagreed with scan + redact`,
      );
      for (const finding of combined.findings) {
        if (finding.action !== "redact" && finding.action !== "block") continue;
        const matched = fixture.input.slice(
          finding.range.start,
          finding.range.end,
        );
        assert(
          !combined.text.includes(matched),
          `fixture ${fixture.id} left a redacted span in the output`,
        );
      }
    }
  });

  check("a throwing policy callback surfaces POLICY_FAILURE", () => {
    const fixture = synchronous.find((entry) => entry.expected.length > 0);
    assert(fixture !== undefined, "no positive fixture to drive the policy");
    let thrown;
    try {
      scan(fixture.input, () => {
        throw new Error("boom");
      });
    } catch (error) {
      thrown = error;
    }
    assert(thrown !== undefined, "the throwing policy did not surface");
    assertEqual(errorCode(thrown), "POLICY_FAILURE", "policy failure code");
    assert(
      !String(thrown.message).includes(fixture.input),
      "the error carried the scanned input",
    );
  });

  check("a custom policy callback controls the action", () => {
    const fixture = synchronous.find((entry) => entry.expected.length > 0);
    const findings = scan(fixture.input, () => "warn");
    assert(findings.length > 0, "no finding to apply the policy to");
    for (const finding of findings) {
      assertEqual(finding.action, "warn", `fixture ${fixture.id} action`);
    }
  });

  check("a custom placeholder formatter controls redaction output", () => {
    const fixture = synchronous.find((entry) => entry.expected.length > 0);
    const output = redact(
      fixture.input,
      scan(fixture.input),
      (_finding, context) => `[[REMOVED_${context.placeholderIndex}]]`,
    );
    assert(
      output.includes("[[REMOVED_1]]"),
      `fixture ${fixture.id} ignored the formatter`,
    );
  });

  return { ok: failures === 0, failures, checks: results };
}
