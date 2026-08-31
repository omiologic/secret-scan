---
work_item_id: "secret-scan-00017"
title: "Requalify advertised credential coverage"
depends_on: []
target_paths:
  - "src/detectors/github.ts"
  - "src/detectors/gitlab.ts"
  - "src/detectors/connection-string.ts"
  - "src/detectors/generic-token.ts"
  - "src/incremental.ts"
  - "test/conformance"
  - "test/detectors"
  - "test/false-positives"
  - "README.md"
  - "ARCHITECTURE.md"
  - "_notes/features/known-format-detection/README.md"
  - "_notes/features/contextual-detection/README.md"
created_at: "2026-08-30T20:41:21Z"
updated_at: "2026-08-30T21:32:32Z"
---

# Requalify advertised credential coverage

## Outcome

Every advertised provider, connection-string, and contextual credential family is backed by current primary-source qualification, conservative detection, and explicit exclusions.

## Context

SS-AUD-004 confirmed bypasses for current GitHub installation tokens, documented GitLab prefixes, MongoDB seed lists, AWS secret/session variable names, and password-only Redis URIs while the README advertises broader family coverage. Provider formats evolve, so implementation and claims must be reconciled deliberately rather than broadened from memory.

## Scope

### In scope

- Recheck the cited GitHub, GitLab, MongoDB, AWS, and Redis forms against current authoritative documentation at implementation time.
- Add conservative support where stable public structure permits precise offline detection, or narrow the advertised claim where it does not.
- Decide and prominently document AWS secret/session assignment and password-only Redis URI treatment.
- Update incremental retention hints and the conformance corpus for every accepted detector shape.

### Out of scope

- Credential liveness checks, runtime network validation, undocumented reverse engineering, permissive entropy-only guesses, or unrelated provider expansion.

## Implementation checklist

- [x] Record exact primary sources, supported shapes, update cadence, precision/recall tradeoffs, and rejected variants in the feature notes.
- [x] Add the qualified GitHub and GitLab forms with strict prefix, length, character, and boundary behavior or explicitly narrow claims.
- [x] Support standard MongoDB seed lists and make a documented decision for Redis username-optional/password-only authority syntax.
- [x] Make a documented decision for standard AWS secret-access-key and session-token contextual names and their default policy consequences.
- [x] Add synthetic conformance, truncation, malformed, overlap, false-positive, regex-safety, and incremental partition fixtures.

## Acceptance criteria

- [x] README coverage claims name only forms the implementation and permanent tests actually support.
- [x] Current qualified GitHub installation-token and standard MongoDB seed-list fixtures are detected before those family claims remain in beta documentation.
- [x] GitLab, AWS contextual, and Redis choices are explicit, source-backed, tested, and state their false-positive and false-negative tradeoffs.
- [x] Exact supported forms and update cadence are documented without any active or plausible credential values.
- [x] Detector order, policy separation, runtime neutrality, and browser/Node compatibility remain intact.

## Verification

- [x] Run provider, connection-string, contextual, conformance, false-positive, overlap, incremental, regex-adversarial, typecheck, build, and complete CI checks.
- [x] Review each implemented pattern and public claim against its recorded primary source and synthetic fixture construction.

## Completion record

- Result: Completed. GitHub installation-token coverage now follows the provider's rollout-safe opaque/stateless expression; the current GitLab prefix catalog is locked by tests; standard MongoDB seed lists and Redis password-only authorities are supported; and AWS secret-access-key and session-token names are explicit contextual signals with policy-independent confidence behavior.
- Evidence: Primary-source qualification and tradeoffs are recorded in the known-format and contextual feature notes. Synthetic detector, conformance, malformed, boundary, false-positive, regex-safety, overlap, and incremental partition coverage passes. `npm run ci` passed on Node.js 22.16.0 with 17 test files and 344 tests; `git diff --check` and plan validation also passed. The root exports and public types are unchanged, and no version or release changelog was selected or created.
- Follow-ups: `secret-scan-00019` owns the version-neutral Unreleased changelog and broader beta public-contract review. `secret-scan-00021` remains dependent on 00018 and 00019 before the final beta requalification.
