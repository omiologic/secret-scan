---
work_item_id: "secret-scan-00003"
title: "Detect high-confidence credential formats"
depends_on:
  - "secret-scan-00002"
target_paths:
  - "src/detectors/private-key.ts"
  - "src/detectors/aws.ts"
  - "src/detectors/github.ts"
  - "src/detectors/jwt.ts"
  - "src/detectors/bearer-token.ts"
  - "src/detectors/openai.ts"
  - "src/detectors/anthropic.ts"
  - "test/detectors"
  - "test/false-positives"
created_at: "2026-08-30T17:25:37Z"
updated_at: "2026-08-30T18:05:28Z"
---

# Detect high-confidence credential formats

## Outcome

The scanner recognizes the initial high-confidence private-key, cloud credential, provider-token, JWT, and bearer-token families with deterministic positive, negative, and regex-safety coverage.

## Context

Known formats provide the strongest detection signal but broad patterns can redact identifiers that merely resemble credentials. Each detector must document the false-positive cost of accepting loose variants and the false-negative cost of requiring strict structure or context.

## Scope

### In scope

- Implement the initial private-key, AWS access-key, GitHub token, JWT, bearer-token, OpenAI-token, and Anthropic-token strategies.
- Use synthetic fixtures only and keep findings, failures, and snapshots free of matched values.
- Add nearby negative cases and adversarial inputs for every regex detector.
- Record detector-specific false-positive and false-negative tradeoffs in tests or source documentation.

### Out of scope

- Secret validation through provider APIs, credential liveness checks, entropy-only detection, connection strings, and policy actions.

## Implementation checklist

- [x] Implement each detector as an independent runtime-neutral unit.
- [x] Assign explicit confidence and specificity signals consumed by overlap resolution.
- [x] Add synthetic positive fixtures without active or plausible real credentials.
- [x] Add negative fixtures for hashes, UUIDs, commit IDs, model names, CSS hashes, numeric IDs, and malformed lookalikes.
- [x] Add long and adversarial inputs that exercise regex runtime safety.

## Acceptance criteria

- [x] Every named detector family has deterministic positive and negative coverage.
- [x] A bearer-wrapped JWT resolves to one most-specific final finding.
- [x] Common non-secret identifiers remain unchanged by scanning.
- [x] Detector diagnostics and errors disclose classifications and ranges only, never matched substrings.
- [x] Tests explicitly capture the chosen precision/recall boundary for ambiguous provider formats.

## Verification

- [x] Run the detector, false-positive, integration, and regex-adversarial test suites.
- [x] Inspect fixtures and snapshots for prohibited plaintext-bearing result fields or credential-like real data.

## Completion record

- Result: Completed seven independent runtime-neutral detectors for private-key blocks, AWS access-key IDs, GitHub tokens, JWTs, bearer tokens, OpenAI API keys, and Anthropic API keys, with explicit confidence, specificity, and documented precision/recall boundaries.
- Evidence: `npm run typecheck` and `npm test` pass; the build and all 46 tests cover synthetic positives, malformed and common-identifier negatives, bearer/JWT overlap resolution, safe public metadata, boundary cases, adversarial near-matches, and a one-megabyte ordinary input. Fixture inspection found only unmistakably synthetic or shortened examples. Plan validation reports zero errors and warnings.
- Follow-ups: `secret-scan-00004` remains ready; `secret-scan-00005` remains backlogged until both `secret-scan-00003` and `secret-scan-00004` are successfully archived.
