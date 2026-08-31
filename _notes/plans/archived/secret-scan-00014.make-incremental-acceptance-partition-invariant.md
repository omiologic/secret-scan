---
work_item_id: "secret-scan-00014"
title: "Make incremental acceptance partition-invariant"
depends_on: []
target_paths:
  - "src/incremental.ts"
  - "test/integration/incremental-semantics.test.ts"
  - "test/conformance/incremental-partitions.ts"
  - "test/conformance/conformance.test.ts"
  - "ARCHITECTURE.md"
  - "README.md"
  - "_notes/features/runtime-support/README.md"
created_at: "2026-08-30T20:41:21Z"
updated_at: "2026-08-30T20:59:57Z"
---

# Make incremental acceptance partition-invariant

## Outcome

One logical input and one valid limit configuration have the same success or failure result, sanitized text, and findings regardless of transport chunk partitioning.

## Context

Pre-beta finding SS-AUD-003 showed that one `append()` can count already-finalized lines against `maxBufferedCodeUnits`, while the same input split across calls succeeds. This violates the documented meaning of retained plaintext and the incremental equivalence boundary.

## Scope

### In scope

- Account unresolved retained plaintext independently from safe output finalized during an append call.
- Preserve explicit input, token, multiline, and retained-buffer limits with fixed input-free failures.
- Add exhaustive relevant partitions and targeted large-chunk/many-short-line cases at exact limit boundaries.
- Align architecture, API guidance, and runtime-support notes with the implemented accounting model.

### Out of scope

- Silent or environment-derived defaults, custom synchronous detector support, independent chunk scanning, or a new output-size limit without a separately specified public contract.

## Implementation checklist

- [x] Model retained, finalized, emitted, and total input units separately and document which limit applies to each.
- [x] Correct append/finalize accounting while preserving surrogate-pair, offset, placeholder-numbering, lifecycle, and cleanup guarantees.
- [x] Replace the test that codifies partition-dependent failure with partition-invariant acceptance and failure assertions.
- [x] Add one-large-chunk versus many-small-chunk cases containing many closed lines, open tokens, PEM blocks, CR/LF/CRLF, and Unicode boundaries.
- [x] Verify all failures discard retained plaintext and do not attach input or causes to errors.

## Acceptance criteria

- [x] All tested partitions of an accepted logical input produce exactly the whole-input result and identical finalized findings.
- [x] All tested partitions of a limit-exceeding logical input fail with the same safe error code before unsafe buffered text is emitted.
- [x] `maxBufferedCodeUnits` measures plaintext retained but not yet emit-safe, not cumulative safe output processed within one call.
- [x] Existing whole-string APIs and stream-adapter contracts remain compatible.

## Verification

- [x] Run incremental semantics, complete partition conformance, adapter, typecheck, build, and complete CI checks.
- [x] Compare the audit's 400-code-unit reproduction as one chunk and as 20 chunks under identical limits.

## Completion record

- Result: Incremental acceptance now counts only unresolved retained plaintext against the buffer limit, and construct-limit failures use partition-stable error codes.
- Evidence: Exhaustive two-way UTF-16 partitions, one-code-unit and fixed-size partitions, exact-limit token and PEM cases, mixed CR/LF/CRLF and Unicode input, and the 400-code-unit audit reproduction all pass. Focused incremental, conformance, Node adapter, and Web adapter tests passed (118 tests). `npm run ci` passed on Node v22.16.0 with typecheck, build, and 277 tests.
- Follow-ups: `secret-scan-00018` is dependency-ready for expanded adapter lifecycle and backpressure evidence. Public API/changelog alignment remains in `secret-scan-00019`; no release operation is authorized or performed.
