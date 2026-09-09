/**
 * Canonical lifecycle, abort, malformed-UTF-8, and buffer/token/multiline
 * resource-limit fixtures for the incremental and stream surfaces
 * (`decision-govern-cross-language-conformance`). Every fixture is already
 * in canonical form (there is no UTF-16 oracle shape to convert from): an
 * ordered, replayable operation sequence and its terminal outcome. No
 * fixture or outcome carries a matched value — a synthetic input value may
 * appear in `chunk`/`bytesHex` (never a secret, never copied into `outcome`),
 * and a failing outcome records only a stable code, the terminal state, the
 * already-redacted cumulative `text`, and a finding count.
 *
 * These mirror scenarios already exercised directly against
 * `createIncrementalSanitizer` (`test/integration/incremental-semantics.test.ts`)
 * and `createStreamSanitizerRuntime` (`src/adapters/shared.ts`, driven by
 * `test/adapters/node-stream.test.ts` and `test/adapters/web-stream.test.ts`).
 * `test/conformance/canonical-incremental-oracle.test.ts` replays every
 * fixture here against those same TypeScript implementations and fails if
 * the observed outcome drifts from what is recorded here.
 */

import type { CanonicalLifecycleFixture } from "../schema.js";

const LIMITS = Object.freeze({
  maxInputCodeUnits: 32_768,
  maxBufferedCodeUnits: 16_512,
  maxTokenCodeUnits: 8_192,
  maxMultilineCodeUnits: 16_384,
});

const encoder = new TextEncoder();

function hex(text: string): string {
  return Array.from(encoder.encode(text), (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const incrementalLifecycleFixtures: readonly CanonicalLifecycleFixture[] = [
  {
    id: "lifecycle-abort-rejects-append",
    surface: "incremental",
    operations: [
      { op: "append", chunk: "api_key=SYNTHETIC_REVOKED_LIFECYCLE_ABORT" },
      { op: "abort" },
      { op: "append", chunk: "ignored" },
    ],
    outcome: { ok: false, code: "INVALID_STATE", state: "aborted", text: "", findingCount: 0 },
    note: "An open, unresolved value is discarded on abort and every later append is rejected.",
  },
  {
    id: "lifecycle-finalize-is-single-use",
    surface: "incremental",
    operations: [{ op: "finalize" }, { op: "finalize" }],
    outcome: { ok: false, code: "INVALID_STATE", state: "finalized", text: "", findingCount: 0 },
    note: "Finalization is terminal; a second finalize is rejected rather than re-emitted.",
  },
  {
    id: "lifecycle-abort-precedes-finalize",
    surface: "incremental",
    operations: [
      { op: "append", chunk: "api_key=SYNTHETIC_REVOKED_LIFECYCLE_ABORT_FINALIZE" },
      { op: "abort" },
      { op: "finalize" },
    ],
    outcome: { ok: false, code: "INVALID_STATE", state: "aborted", text: "", findingCount: 0 },
    note: "Finalize after abort stays rejected; abort remains the terminal state.",
  },
  {
    id: "lifecycle-abort-is-idempotent",
    surface: "incremental",
    operations: [
      { op: "append", chunk: "x" },
      { op: "abort" },
      { op: "abort" },
    ],
    outcome: { ok: false, code: "INVALID_STATE", state: "aborted", text: "", findingCount: 0 },
    note: "A second abort is rejected rather than silently repeated.",
  },
  {
    id: "lifecycle-input-limit-exceeded",
    surface: "incremental",
    limits: { ...LIMITS, maxInputCodeUnits: 16_384 },
    operations: [{ op: "append", chunk: "x".repeat(16_385) }],
    outcome: {
      ok: false,
      code: "INPUT_LIMIT_EXCEEDED",
      state: "failed",
      text: "",
      findingCount: 0,
    },
    note: "One append exceeding the total input cap fails safely with no output.",
  },
  {
    id: "lifecycle-token-limit-exceeded",
    surface: "incremental",
    limits: { ...LIMITS, maxTokenCodeUnits: 32 },
    operations: [{ op: "append", chunk: "x".repeat(33) }],
    outcome: {
      ok: false,
      code: "TOKEN_LIMIT_EXCEEDED",
      state: "failed",
      text: "",
      findingCount: 0,
    },
    note: "An open single-line construct one code unit past the token cap fails safely.",
  },
  {
    id: "lifecycle-multiline-limit-exceeded",
    surface: "incremental",
    limits: { ...LIMITS, maxMultilineCodeUnits: 128 },
    operations: [
      { op: "append", chunk: `-----BEGIN PRIVATE KEY-----\n${"A".repeat(101)}` },
    ],
    outcome: {
      ok: false,
      code: "MULTILINE_LIMIT_EXCEEDED",
      state: "failed",
      text: "",
      findingCount: 0,
    },
    note: "An open PEM block one code unit past the multiline cap fails safely.",
  },
  {
    id: "lifecycle-token-construct-accepted-at-exact-limit",
    surface: "incremental",
    limits: {
      maxInputCodeUnits: 512,
      maxBufferedCodeUnits: 192,
      maxTokenCodeUnits: 32,
      maxMultilineCodeUnits: 64,
    },
    operations: [
      { op: "append", chunk: "x".repeat(32) },
      { op: "finalize" },
    ],
    outcome: {
      ok: true,
      state: "finalized",
      text: "x".repeat(32),
      findingCount: 0,
    },
    note: "An open construct exactly at the token cap is accepted, not rejected.",
  },
  {
    id: "lifecycle-stream-malformed-utf8-continuation-byte",
    surface: "stream",
    limits: LIMITS,
    operations: [{ op: "appendBytesHex", bytesHex: "c328" }],
    outcome: {
      ok: false,
      code: "INVALID_UTF8",
      state: "aborted",
      text: "",
      findingCount: 0,
    },
    note: "A bare invalid continuation byte fails decode and aborts the underlying session.",
  },
  {
    id: "lifecycle-stream-malformed-utf8-after-buffered-plaintext",
    surface: "stream",
    limits: LIMITS,
    operations: [
      {
        op: "appendBytesHex",
        bytesHex: hex(
          "api_key=SYNTHETIC_REVOKED_STREAM_FINALIZED\n" +
            "api_key=SYNTHETIC_REVOKED_STREAM_UNRESOLVED",
        ),
      },
      { op: "appendBytesHex", bytesHex: "c328" },
    ],
    outcome: {
      ok: false,
      code: "INVALID_UTF8",
      state: "aborted",
      text: "api_key=<SECRET_1>\n",
      findingCount: 1,
    },
    note: "Malformed UTF-8 after a resolved, buffered line keeps only the finalized output.",
  },
] as const;
