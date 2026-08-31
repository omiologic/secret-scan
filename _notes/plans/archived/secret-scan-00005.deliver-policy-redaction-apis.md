---
work_item_id: "secret-scan-00005"
title: "Deliver safe policy and redaction APIs"
depends_on:
  - "secret-scan-00003"
  - "secret-scan-00004"
target_paths:
  - "src/policy.ts"
  - "src/redact.ts"
  - "src/scan.ts"
  - "src/index.ts"
  - "test/integration"
created_at: "2026-08-30T17:25:37Z"
updated_at: "2026-08-30T18:20:27Z"
---

# Deliver safe policy and redaction APIs

## Outcome

Consumers can scan, redact, or scan-and-redact text through stable APIs that keep detection separate from enforcement and reconstruct sanitized output in one deterministic pass.

## Context

The architecture requires policy to remain independent from detection so browser UX and authoritative server enforcement can choose different actions. Redaction must preserve useful surrounding structure while ensuring detected plaintext does not survive in sanitized output or metadata.

## Scope

### In scope

- Implement default and custom policy evaluation for allow, warn, redact, and block actions.
- Implement semantic placeholders and optional typed placeholder formatting.
- Implement `scan`, `redact`, and `scanAndRedact` over finalized non-overlapping findings.
- Verify redaction invariants, offset semantics, repeated values, adjacent findings, and sanitized-output rescanning.

### Out of scope

- UI components, request middleware, secret storage, reversible masking, streaming, and framework-specific adapters.

## Implementation checklist

- [x] Implement default policy mappings without coupling them to detector matching.
- [x] Implement one-pass redaction from original-input ranges.
- [x] Add deterministic placeholder numbering and a safe custom formatter contract.
- [x] Wire the three public APIs through one shared processing path.
- [x] Add integration and invariant tests for all supported actions.

## Acceptance criteria

- [x] Detection results are stable regardless of the policy used to evaluate them.
- [x] Redacted output contains none of the substrings covered by redact or block findings.
- [x] Placeholder numbering is deterministic and preserves non-secret text exactly.
- [x] Findings continue to reference original-input offsets after redaction.
- [x] Scanning sanitized output does not rediscover an original detected secret.
- [x] Browser and server consumers can supply different policies without runtime-specific dependencies.

## Verification

- [x] Run policy, redaction, public-API, invariant, and browser/Node integration tests.
- [x] Inspect public exports, errors, and test snapshots for plaintext-bearing fields.

## Completion record

- Result: Completed default and custom policy evaluation plus public `scan`, `redact`, and `scanAndRedact` APIs. Redaction performs one ordered reconstruction pass, replaces both redact and block actions, preserves warn and allow spans, supports default, typed, and safe custom placeholders, and keeps policy and formatter inputs free of matched plaintext.
- Evidence: `npm run typecheck` and `npm test` pass; the build and all 101 tests cover all four actions, policy independence, repeated and adjacent findings, stable numbering, original offsets, sanitized rescanning, custom detectors, browser/Node-compatible exports, immutable metadata, malformed findings, and sanitized detector, policy, formatter, option-getter, and finding-getter failures. Public export inspection found no plaintext-bearing result field or error cause. Plan validation reports zero errors and warnings.
- Follow-ups: `secret-scan-00006` is now ready to perform package-readiness, documentation, CI, security, performance, and release-approval review work. No version, tag, publication, deployment, or release action was performed.
