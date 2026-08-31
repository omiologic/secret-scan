---
work_item_id: "secret-scan-00016"
title: "Handle PEM delimiters linearly and fail safely"
depends_on: []
target_paths:
  - "src/detectors/private-key.ts"
  - "src/incremental.ts"
  - "src/scan.ts"
  - "test/detectors/known-formats.test.ts"
  - "test/detectors/regex-safety.test.ts"
  - "test/conformance"
  - "test/integration/candidate-pipeline.test.ts"
  - "test/integration/incremental-semantics.test.ts"
  - "test/performance/scan-performance.test.ts"
  - "ARCHITECTURE.md"
  - "_notes/features/known-format-detection/README.md"
created_at: "2026-08-30T20:41:21Z"
updated_at: "2026-08-30T21:22:56Z"
---

# Handle PEM delimiters linearly and fail safely

## Outcome

PEM-style private-key detection processes delimiter-heavy input with bounded scaling and applies one explicit, conservative rule to malformed or nested blocks.

## Context

SS-AUD-002 found repeated footer searches that take roughly six seconds for a one-MiB unmatched-header input. SS-AUD-005 showed that nested headers can cause the narrower inner block to win while the outer header and body remain in sanitized output. The repair must keep detection separate from policy enforcement.

## Scope

### In scope

- Parse supported PEM delimiters in one pass or with equivalent bounded complexity.
- Define deterministic behavior for unmatched, mismatched, repeated, and nested begin/end markers.
- Prefer a fail-safe complete span or an explicitly documented unsupported/rejection path without leaking partial key material.
- Add positive, negative, malformed, overlap, incremental-retention, and scaling coverage.

### Out of scope

- Cryptographic key validation, decryption, filesystem loading, generic certificate parsing, or embedding server policy decisions in the detector.

## Implementation checklist

- [x] Specify supported labels, delimiter pairing, nesting, malformed-input handling, and the false-positive/false-negative tradeoff.
- [x] Replace per-header suffix searches with a bounded parser while preserving absolute UTF-16 offsets and specificity.
- [x] Reconcile malformed-block candidates with overlap precedence so partial inner redaction cannot expose outer material.
- [x] Add repeated-unmatched-header, nested, mismatched-footer, adjacent-block, large-complete-block, and delimiter near-match tests.
- [x] Align synchronous and incremental PEM closing/retention semantics in architecture and feature documentation.

## Acceptance criteria

- [x] Supported complete blocks produce deterministic full-span findings and default `block` actions.
- [x] Malformed and nested fixtures follow the documented fail-safe rule and never sanitize only an inner span while leaving credential material around it.
- [x] Repeated delimiter inputs no longer exhibit quadratic growth within the checked one-MiB scaling envelope.
- [x] Common prose and certificate-like near-matches remain unchanged unless explicitly documented.

## Verification

- [x] Run private-key, overlap, incremental, regex-adversarial, performance, conformance, typecheck, build, and complete CI checks.
- [x] Re-run the audit's repeated-unmatched-PEM and malformed nested-PEM reproductions with scaling and no-leak evidence.

## Completion record

- Result: Completed. Supported PEM delimiters now use one strict last-in-first-out parser; malformed nested, repeated, out-of-order, and mismatched structures produce one conservative outermost candidate, while lone truncated headers and documented near-matches remain excluded. Incremental retention shares the delimiter transitions and consumes only new text plus fixed lookbehind.
- Evidence: `npm run ci` passed on Node 22.16.0 with 17 files and 303 tests, including private-key, overlap, incremental partition, regex-adversarial, performance, browser, package, and conformance coverage. The 256 KiB/512 KiB/1 MiB repeated-header reproduction measured 3.9/3.6/6.9 ms, compared with roughly six seconds in the audit; each produced one full-span blocked finding. The one-MiB incremental reproduction emitted no text before finalization and completed in 333.7 ms. The malformed nested reproduction produced one full-span blocked finding with no surviving inner material. Governance and plan validators reported zero errors and warnings before archival.
- Follow-ups: No PEM-specific implementation follow-up remains. `secret-scan-00021` retains the fresh whole-package beta requalification after its remaining dependencies complete.
