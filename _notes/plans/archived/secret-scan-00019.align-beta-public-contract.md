---
work_item_id: "secret-scan-00019"
title: "Align the beta public contract and documentation"
depends_on:
  - "secret-scan-00013"
  - "secret-scan-00014"
  - "secret-scan-00015"
  - "secret-scan-00016"
  - "secret-scan-00017"
target_paths:
  - "package.json"
  - "src/index.ts"
  - "src/redact.ts"
  - "src/types.ts"
  - "test/integration/policy-redaction.test.ts"
  - "test/package-import.node.test.ts"
  - "test/type-contracts.ts"
  - "test/readme-examples.test.ts"
  - "test/package-contents.test.ts"
  - "README.md"
  - "ARCHITECTURE.md"
  - "SECURITY.md"
  - "CHANGELOG.md"
  - "_notes/features"
created_at: "2026-08-30T20:41:21Z"
updated_at: "2026-08-31T03:12:02Z"
---

# Align the beta public contract and documentation

## Outcome

The prospective beta exposes only deliberate supported APIs, and all public and feature documentation states the remediated behavior, extension trust boundary, exclusions, and resource expectations consistently.

## Context

SS-AUD-007 found a mismatch between the formatter no-reproduction claim and its short-value behavior. SS-AUD-008 found stale adapter documentation and an unexplained implementation lookaround constant exported from the root. The beta gates also require explicit provider exclusions, extension trust assumptions, authoritative-server resource guidance, a public API review, and a changelog ready for review without selecting a release version.

## Scope

### In scope

- Decide whether the lookaround constant is removed from the root or deliberately documented, typed, tested, and supported.
- Reconcile short custom findings with one explicit minimum-range or no-reproduction contract and deterministic tests.
- Document trust assumptions for custom detectors, policies, caller-supplied findings, and placeholder formatters.
- Reconcile README, architecture, security guidance, feature notes, emitted declarations, package contents, and a version-neutral Unreleased changelog draft.
- State intentional detector exclusions and authoritative-server input, finding-count, and resource boundaries.

### Out of scope

- Selecting a version, approving a release, tagging, publishing, deployment, new product features, or expanding the public API merely to preserve an accidental export.

## Implementation checklist

- [x] Inventory source exports, emitted declarations, subpath exports, package contents, examples, and documented contracts.
- [x] Remove or formalize the lookaround constant and add type/package regressions for the selected public surface.
- [x] Resolve short-value placeholder reproduction with safe behavior and documentation that match for caller-supplied findings.
- [x] Update the stale detector-pipeline adapter note and reconcile all feature-note states and links.
- [x] Document exact supported/excluded formats, contextual `warn` behavior, custom-extension trust, and recommended server-side resource limits.
- [x] Prepare a reviewable `Unreleased` changelog without a version identifier or release claim.

## Acceptance criteria

- [x] No implementation-only constant or other accidental symbol appears in the root public declarations.
- [x] Formatter behavior and documentation agree for every supported finding length, and any trusted-caller boundary is explicit.
- [x] README, architecture, security guidance, and feature notes contain no contradictions about adapters, coverage, limits, policy, or extension safety.
- [x] Intentional exclusions include differently encoded JWTs, truncated or malformed PEM, legacy Vault forms, unsupported URI forms, and `warn` findings that remain unchanged.
- [x] Public API and Unreleased changelog are ready for human review, with no version or release authority inferred.

## Verification

- [x] Run type-contract, README example, package-content, root/Node/Web import, declaration-consumer, browser-bundle, typecheck, build, and complete CI checks.
- [x] Inspect emitted `.d.ts` files, export maps, package tarball contents, relative documentation links, and changelog wording.

## Completion record

- Result: Completed. The root contract now excludes the incremental lookaround tuning constant; placeholder validation prevents formatter reproduction for every non-empty replaceable range; and public, security, architecture, feature, package, and Unreleased changelog documentation now share one explicit coverage, extension-trust, adapter, policy, and resource-boundary contract.
- Evidence: `npm run ci` passed typechecking, build, and all 357 tests across 17 files. Focused contract checks passed for type/declaration consumers, README examples, exact root and subpath runtime exports, Node/Web imports, browser bundles, short caller-supplied findings, and inspection-only package contents including `CHANGELOG.md`. Emitted declarations and export maps were inspected; relative targets across all 11 public and feature documents resolved; Git diff checks and both governance validators completed with 0 errors and 0 warnings.
- Follow-ups: `secret-scan-00021` is now dependency-ready for the independent beta requalification. No version, release, tag, publication, or deployment was selected or authorized.
