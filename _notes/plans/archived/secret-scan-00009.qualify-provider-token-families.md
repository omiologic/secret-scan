---
work_item_id: "secret-scan-00009"
title: "Qualify and add provider token families"
depends_on:
  - "secret-scan-00007"
target_paths:
  - "ARCHITECTURE.md"
  - "README.md"
  - "src/detectors"
  - "src/index.ts"
  - "src/policy.ts"
  - "test/conformance"
  - "test/detectors"
  - "test/false-positives"
  - "_notes/features/known-format-detection/README.md"
created_at: "2026-08-30T18:41:34Z"
updated_at: "2026-08-30T19:16:18Z"
---

# Qualify and add provider token families

## Outcome

The known-format catalog gains evidence-backed provider token families whose stable public structure supports precise offline detection, while rejected candidates remain documented as unsupported rather than becoming broad heuristics.

## Context

Provider formats evolve, and the current strict catalog intentionally misses unknown prefixes. Adding remembered or weakly documented patterns would increase both false positives and maintenance risk. Candidate formats must be qualified from authoritative public documentation and tested only with unmistakably synthetic constructions.

## Scope

### In scope

- Identify candidate provider families from authoritative public format documentation.
- Record a bounded go/no-go rationale for each evaluated family.
- Implement independent detectors only for formats with stable structure, useful precision, and offline matching value.
- Add conformance, negative, overlap, boundary, and regex-safety coverage for every accepted family.

### Out of scope

- Runtime network validation, credential liveness checks, undocumented reverse engineering, entropy-only provider guesses, or provider-specific policy enforcement.

## Implementation checklist

- [x] Define qualification criteria covering documentation authority, structural uniqueness, expected false positives, expected false negatives, and maintenance risk.
- [x] Select and cite exact provider format sources without copying real credential examples into the repository.
- [x] Implement qualified detectors with explicit confidence and specificity.
- [x] Add common-identifier, malformed-prefix, truncation, overlap, and adversarial regex cases.
- [x] Update exports, coverage notes, and known-format feature documentation.

## Acceptance criteria

- [x] Every added family has an authoritative format source and a recorded precision/recall tradeoff.
- [x] Unqualified candidates are not implemented as permissive patterns.
- [x] Added detectors produce deterministic, correctly bounded, non-overlapping safe findings.
- [x] Common identifiers and near-matches remain unchanged.
- [x] No test, documentation, error, snapshot, or diagnostic contains a real or plausible active credential.

## Verification

- [x] Run provider, conformance, false-positive, overlap, regex-adversarial, typecheck, build, and complete CI checks.
- [x] Review sources, synthetic fixture construction, public exports, and policy behavior for every accepted family.

## Completion record

- Result: Completed. Added high-confidence GitLab, Shopify, and modern Vault provider detectors; rejected Twilio API Key SIDs and legacy Vault prefixes; and resolved Anthropic/OpenAI namespace precedence.
- Evidence: Authoritative format sources and bounded tradeoffs are recorded in the known-format feature note. `npm run ci` passed provider, conformance, false-positive, overlap, regex, policy, typecheck, and production-build checks: all 207 tests across 14 files passed. Both governance validators completed with 0 errors and 0 warnings.
- Follow-ups: `secret-scan-00010` is now ready because both of its dependencies are complete.
