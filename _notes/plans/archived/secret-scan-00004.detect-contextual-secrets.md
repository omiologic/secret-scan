---
work_item_id: "secret-scan-00004"
title: "Detect contextual secrets with bounded heuristics"
depends_on:
  - "secret-scan-00002"
target_paths:
  - "src/detectors/generic-token.ts"
  - "src/detectors/connection-string.ts"
  - "src/entropy.ts"
  - "test/detectors"
  - "test/false-positives"
created_at: "2026-08-30T17:25:37Z"
updated_at: "2026-08-30T18:12:30Z"
---

# Detect contextual secrets with bounded heuristics

## Outcome

The scanner identifies credential-bearing assignments and connection strings by combining structural context with bounded entropy evidence, without aggressively classifying random-looking text on entropy alone.

## Context

Unknown secret formats require broader signals than provider-specific detectors. This increases false-positive risk, so contextual names and credential-bearing syntax must carry the classification while entropy only adjusts confidence. The generic word `token` alone is insufficient evidence.

## Scope

### In scope

- Implement deterministic entropy measurement as a supporting signal.
- Detect high-signal assignments, authorization structures, and credential-bearing connection strings.
- Treat ambiguous contextual matches conservatively and exercise them against representative false-positive fixtures.
- Document false-positive and false-negative boundaries for key names, delimiters, minimum lengths, and entropy thresholds.

### Out of scope

- Entropy-only aggressive redaction, arbitrary PII detection, parsing every URI scheme, and external credential verification.

## Implementation checklist

- [x] Add a deterministic, runtime-neutral entropy helper.
- [x] Implement contextual key/value and connection-string candidate detection.
- [x] Prevent `token` alone, hashes, UUIDs, source-map fragments, and generated identifiers from becoming high-confidence findings.
- [x] Add threshold-boundary, malformed-input, Unicode-context, and long-input tests.
- [x] Add overlap cases with provider-specific detectors.

## Acceptance criteria

- [x] Entropy without structural or contextual evidence does not trigger aggressive detection.
- [x] High-signal credential assignments and credential-bearing connection strings yield correctly bounded findings.
- [x] Ambiguous matches receive conservative confidence suitable for policy warning rather than automatic redaction.
- [x] Offsets remain correct for multiline and Unicode-containing inputs.
- [x] The chosen heuristic thresholds and their precision/recall tradeoffs are explicit and covered by boundary tests.

## Verification

- [x] Run entropy, contextual-detector, false-positive, Unicode-offset, overlap, and adversarial-input tests.
- [x] Inspect outputs and failures to confirm no detected substrings are disclosed.

## Completion record

- Result: Completed deterministic Shannon entropy measurement plus runtime-neutral contextual assignment, Basic/Token authorization, and credential-bearing connection-string detection. Entropy only upgrades contextual evidence; it never creates a standalone finding, plain `token` remains ignored, and ambiguous names remain medium confidence.
- Evidence: `npm run typecheck` and `npm test` pass; the build and all 86 tests cover threshold boundaries, name normalization, supported URL schemes, placeholders, entropy-only text, common identifiers, malformed quoting, Unicode and multiline offsets, provider overlap, safe metadata, and 100 KB adversarial values. Fixture inspection found only synthetic, revoked, shortened, or placeholder values. Plan validation reports zero errors and warnings.
- Follow-ups: `secret-scan-00005` is now ready because both detector prerequisites are successfully archived; `secret-scan-00006` remains backlogged behind `secret-scan-00005`.
