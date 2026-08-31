---
work_item_id: "secret-scan-00007"
title: "Establish a detector conformance corpus"
depends_on:
  - "secret-scan-00006"
target_paths:
  - "test/conformance"
  - "test/detectors"
  - "test/false-positives"
  - "_notes/features/known-format-detection/README.md"
  - "_notes/features/contextual-detection/README.md"
created_at: "2026-08-30T18:41:34Z"
updated_at: "2026-08-30T18:51:12Z"
---

# Establish a detector conformance corpus

## Outcome

A reusable, synthetic conformance corpus makes detector coverage, exclusions, confidence, specificity, overlap behavior, and regex-safety expectations explicit before additional formats or incremental scanning are added.

## Context

The current detectors have strong tests, but coverage knowledge is distributed across detector-specific suites and feature notes. The next detector and streaming work needs one reviewable corpus that can prove the same safety boundary across implementations without storing real or plausible active credentials.

## Scope

### In scope

- Define a data-driven fixture format for positive, negative, overlap, boundary, and adversarial cases.
- Migrate or reference representative existing cases without weakening current tests.
- Record expected detector, type, confidence, specificity, and range behavior without storing matched values in expected public results.
- Document supported and intentionally unsupported credential families and syntax variants.

### Out of scope

- Adding new detector families, changing policy defaults, changing public API contracts, or introducing streaming behavior.

## Implementation checklist

- [x] Define a runtime-neutral conformance fixture schema and validator.
- [x] Populate the corpus using unmistakably synthetic, revoked, truncated, or placeholder examples only.
- [x] Add reusable assertions for deterministic findings, non-overlap, safe errors, false positives, and bounded regex behavior.
- [x] Map current detector coverage and exclusions to feature documentation.
- [x] Verify no fixture or assertion serializes detected plaintext into results, snapshots, logs, or failures.

## Acceptance criteria

- [x] Every built-in detector is represented by positive, negative, boundary, overlap, and adversarial cases where applicable.
- [x] The corpus distinguishes supported, intentionally unsupported, and not-yet-evaluated formats.
- [x] Failures report fixture identity and safe metadata without printing source input or matched substrings.
- [x] Existing detector and false-positive behavior remains unchanged.
- [x] Future detector implementations can reuse the corpus without Node-only or browser-only dependencies.

## Verification

- [x] Run conformance, detector, false-positive, typecheck, build, and complete CI checks.
- [x] Inspect fixtures, snapshots, and failure formatting for prohibited credential material or plaintext exposure.

## Completion record

- Result: Completed a reusable, runtime-neutral synthetic conformance corpus for all built-in detectors, including validated support states, safe assertions, coverage documentation, and explicit current overlap behavior.
- Evidence: `npm run ci` passed 14 test files and 156 tests; `validate_plans.py .` completed with 0 errors and 0 warnings; fixture and diagnostic review found no plaintext serialization or non-synthetic credential material.
- Follow-ups: `secret-scan-00008` covers encoded connection credentials, and `secret-scan-00009` covers provider-family qualification and the documented `sk-` family precedence ambiguity.
