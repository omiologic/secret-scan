---
work_item_id: "secret-scan-00002"
title: "Build deterministic candidate-processing pipeline"
depends_on:
  - "secret-scan-00001"
target_paths:
  - "ARCHITECTURE.md"
  - "src/registry.ts"
  - "src/scan.ts"
  - "src/types.ts"
  - "src/index.ts"
  - "src/detectors"
  - "test/integration"
created_at: "2026-08-30T17:25:37Z"
updated_at: "2026-08-30T17:41:13Z"
---

# Build deterministic candidate-processing pipeline

## Outcome

Registered detectors produce a stable, non-overlapping set of safe findings with offsets anchored to the original input.

## Context

All detector families need one deterministic orchestration and conflict-resolution path. Specific matches must outrank broader contextual or heuristic matches, while internal match substrings must never escape in findings, diagnostics, or errors.

## Scope

### In scope

- Implement detector registration and deterministic execution order.
- Normalize candidate confidence and resolve duplicate or overlapping ranges by explicit precedence and stable tie-breakers.
- Convert internal candidates into safe public findings with deterministic identifiers.
- Test empty input, duplicate candidates, nested spans, partial overlaps, adjacent spans, and detector failures.

### Out of scope

- Credential-pattern detectors, contextual or entropy heuristics, policy evaluation, and text redaction.

## Implementation checklist

- [x] Implement an ordered detector registry with custom-detector support.
- [x] Define and implement explicit candidate comparison and overlap-resolution rules.
- [x] Build the scan orchestration path without logging or returning matched substrings.
- [x] Add deterministic integration fixtures using unmistakably synthetic values.
- [x] Add adversarial overlap and error-safety tests.

## Acceptance criteria

- [x] Identical input and options always produce identically ordered findings and identifiers.
- [x] Final findings never overlap and retain original-input offsets.
- [x] Specific candidates win over broader candidates according to documented stable precedence.
- [x] Public results and thrown errors contain no matched plaintext or input fragments.
- [x] Custom detectors run through the same normalization and safety rules as built-in detectors.

## Verification

- [x] Run unit and integration tests for registry ordering, overlap resolution, offsets, and error safety.
- [x] Repeat representative scans and compare serialized result equality.

## Completion record

- Result: Completed the deterministic detector registry and candidate-processing pipeline with stable conflict resolution, safe identifiers, original-input offsets, and sanitized failures.
- Evidence: `npm run typecheck`, `npm test`, and `npm run build` pass with 14 tests; repeated scans serialize identically; overlap, adjacency, registry ordering, malformed-candidate, and detector-error cases are covered; plan validation reports zero errors and warnings.
- Follow-ups: `secret-scan-00003` and `secret-scan-00004` can implement high-confidence and contextual detector families against the shared pipeline.
