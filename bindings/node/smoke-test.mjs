// Node package smoke test for the compiled N-API addon
// (`decision-define-runtime-bindings`). Run with `npm run smoke` after
// `npm run build` / `npm run build:debug`. Not part of `cargo test`: this
// exercises the addon the way an actual Node consumer of one of its
// published per-platform packages (`npm/<platform>/package.json`) does,
// through `require`/`import`, not Rust unit tests.

import assert from "node:assert/strict";
import {
  initialize,
  redact,
  scan,
  scanAndRedact,
  version,
} from "./index.js";

const SYNTHETIC_TOKEN =
  "Authorization: Bearer sk-syntheticRevokedExampleToken00000000000000000000";
const ASTRAL_PREFIXED = `\u{1F511} ${SYNTHETIC_TOKEN}`;

function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

// Repeated initialization: idempotent, callable any number of times.
check("repeated initialization is idempotent", () => {
  initialize();
  initialize();
  initialize();
});

// Canonical synchronous conformance smoke case, with an astral character
// ahead of the match to exercise the UTF-16 offset conversion at its most
// divergent case.
check("scan finds a synthetic bearer token with UTF-16 offsets", () => {
  const findings = scan(ASTRAL_PREFIXED);
  assert.equal(findings.length, 1);
  const [finding] = findings;
  assert.equal(finding.action, "redact");
  // "\u{1F511} " is a surrogate pair (2 UTF-16 code units) plus a space.
  assert.equal(finding.start, ASTRAL_PREFIXED.indexOf("Bearer") + "Bearer ".length);
  assert.equal(ASTRAL_PREFIXED.slice(finding.start, finding.end).length > 0, true);
});

// Unicode offset test: JavaScript's own `.slice()` over `start`/`end` must
// select the same finding boundaries `scan` reports.
check("reported ranges are valid JavaScript UTF-16 slice boundaries", () => {
  const findings = scan(ASTRAL_PREFIXED);
  const [finding] = findings;
  const matched = ASTRAL_PREFIXED.slice(finding.start, finding.end);
  assert.equal(matched.startsWith("sk-syntheticRevokedExampleToken"), true);
});

check("scanAndRedact matches scan + redact", () => {
  const { findings, redacted } = scanAndRedact(SYNTHETIC_TOKEN);
  assert.equal(findings.length, 1);
  assert.equal(redacted, redact(SYNTHETIC_TOKEN, findings));
  assert.equal(redacted.includes("sk-syntheticRevokedExampleToken"), false);
});

// Policy callback failure: a thrown policy callback surfaces as a fixed,
// input-free POLICY_FAILURE error, not the thrown JS error itself.
check("a throwing policy callback surfaces POLICY_FAILURE", () => {
  assert.throws(
    () => scan(SYNTHETIC_TOKEN, () => {
      throw new Error("boom");
    }),
    (error) => {
      assert.equal(error.code, "POLICY_FAILURE");
      assert.equal(error.message, "The secret policy failed.");
      assert.equal(error.message.includes(SYNTHETIC_TOKEN), false);
      return true;
    },
  );
});

check("a policy callback returning an unknown action is rejected", () => {
  assert.throws(
    () => scan(SYNTHETIC_TOKEN, () => "delete"),
    (error) => {
      assert.equal(error.code, "INVALID_POLICY_ACTION");
      return true;
    },
  );
});

check("a custom policy callback controls the action", () => {
  const findings = scan(SYNTHETIC_TOKEN, () => "warn");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].action, "warn");
});

check("a custom placeholder formatter controls redaction output", () => {
  const findings = scan(SYNTHETIC_TOKEN);
  const redacted = redact(SYNTHETIC_TOKEN, findings, (_finding, context) =>
    `[[REMOVED_${context.placeholderIndex}]]`,
  );
  assert.equal(redacted.includes("[[REMOVED_1]]"), true);
});

check("a throwing formatter surfaces PLACEHOLDER_FAILURE", () => {
  const findings = scan(SYNTHETIC_TOKEN);
  assert.throws(
    () =>
      redact(SYNTHETIC_TOKEN, findings, () => {
        throw new Error("boom");
      }),
    (error) => {
      assert.equal(error.code, "PLACEHOLDER_FAILURE");
      return true;
    },
  );
});

check("malformed findings passed to redact are rejected as input-free errors", () => {
  assert.throws(
    () =>
      redact(SYNTHETIC_TOKEN, [
        {
          id: "finding-1",
          type: "synthetic",
          detector: "synthetic",
          confidence: "high",
          action: "delete",
          start: 0,
          end: 5,
        },
      ]),
    (error) => {
      assert.equal(error.code, "INVALID_FINDINGS");
      assert.equal(error.message.includes(SYNTHETIC_TOKEN), false);
      return true;
    },
  );
});

check("version reports the shared product version", () => {
  assert.equal(typeof version(), "string");
  assert.ok(version().length > 0);
});

if (process.exitCode) {
  console.error("\nsmoke test FAILED");
} else {
  console.log("\nsmoke test passed");
}
