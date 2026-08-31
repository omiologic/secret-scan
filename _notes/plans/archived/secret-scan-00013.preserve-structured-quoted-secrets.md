---
work_item_id: "secret-scan-00013"
title: "Preserve complete structured quoted secrets"
depends_on: []
target_paths:
  - "src/detectors/generic-token.ts"
  - "test/detectors/contextual.test.ts"
  - "test/detectors/regex-safety.test.ts"
  - "test/integration/policy-redaction.test.ts"
  - "test/conformance"
  - "ARCHITECTURE.md"
  - "_notes/features/contextual-detection/README.md"
created_at: "2026-08-30T20:41:21Z"
updated_at: "2026-08-30T20:53:45Z"
---

# Preserve complete structured quoted secrets

## Outcome

Supported quoted credential assignments are either detected across their complete encoded value or rejected safely, so redaction cannot leave a credential suffix behind or corrupt otherwise valid structured text.

## Context

Pre-beta finding SS-AUD-001 showed that the contextual detector stops at an escaped quote, partially redacts the value, preserves the remainder, and returns invalid JSON. The repair must remain deterministic, runtime-neutral, side-effect free, and must not expose matched plaintext in findings or failures.

## Scope

### In scope

- Define the supported quoting and escape grammar for contextual assignments, including deterministic behavior for ambiguous or malformed quoted input.
- Replace partial regex matching with escape-aware bounded lexing or an equivalent complete-span strategy.
- Preserve the existing separation between detection, policy evaluation, and redaction.
- Add synthetic positive, negative, boundary, overlap, and syntax-preservation coverage.

### Out of scope

- General-purpose JSON parsing, format reserialization, JavaScript evaluation, decoding arbitrary nested encodings, or changing policy actions for contextual findings.

## Implementation checklist

- [x] Specify how quotes, odd and even backslash runs, escaped quotes, escaped slashes, Unicode escapes, line endings, and unterminated values close or reject a candidate.
- [x] Implement complete-span detection without returning input-derived diagnostics.
- [x] Add regressions for JSON-style and assignment-style quoted values, including nearby non-secret strings and placeholder text.
- [x] Prove that redaction replaces the complete detected range and preserves valid structured output when the input is valid.
- [x] Record the false-positive and false-negative tradeoff in the contextual-detection feature note and architecture where it affects the contract.

## Acceptance criteria

- [x] Every supported escaped quoted credential fixture produces one complete, correctly bounded finding and no credential suffix remains after redaction.
- [x] Valid JSON fixtures remain valid after redaction, including odd/even backslash and escaped-quote cases.
- [x] Ambiguous or malformed quoted input follows one documented fail-safe behavior and never yields a misleading partial finding.
- [x] Existing unquoted contextual behavior, overlap precedence, immutable findings, and safe-error guarantees remain deterministic.
- [x] Fixtures use only unmistakably synthetic or revoked values.

## Verification

- [x] Run contextual detector, redaction, conformance, false-positive, regex-adversarial, typecheck, build, and complete CI checks.
- [x] Inspect findings, thrown errors, and test diagnostics to confirm that no matched plaintext is exposed.

## Completion record

- Result: Complete. Contextual quoted values now use bounded escape-aware lexing, and malformed quote structure is rejected without a partial finding.
- Evidence: `npm run ci` passed with 17 test files and 272 tests; focused contextual, redaction, conformance, false-positive, and regex-safety runs passed with 159 tests; `git diff --check` passed; findings and safe-error assertions expose metadata only.
- Follow-ups: `secret-scan-00019` and `secret-scan-00021` remain in backlog until their other declared dependencies complete.
