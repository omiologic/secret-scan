---
work_item_id: "secret-scan-00021"
title: "Requalify the remediated package for beta"
depends_on:
  - "secret-scan-00013"
  - "secret-scan-00014"
  - "secret-scan-00015"
  - "secret-scan-00016"
  - "secret-scan-00017"
  - "secret-scan-00018"
  - "secret-scan-00019"
target_paths:
  - "_notes/audits"
  - "src"
  - "test"
  - "package.json"
  - "package-lock.json"
  - "README.md"
  - "ARCHITECTURE.md"
  - "SECURITY.md"
  - "CHANGELOG.md"
created_at: "2026-08-30T20:41:21Z"
updated_at: "2026-08-31T03:27:03Z"
---

# Requalify the remediated package for beta

## Outcome

A fresh, reproducible audit determines whether every mandatory pre-beta gate is closed and leaves reviewable evidence without selecting a version or performing a release operation.

## Context

The 2026-08-30 audit found five beta-blocking areas and several missing evidence paths. Readiness cannot be inferred from closing implementation items separately; the remediated package must be checked as one stable snapshot across supported runtimes, package surfaces, adversarial cases, governance, public API, and changelog.

## Scope

### In scope

- Re-run the audit's exact remediation checks on a stable snapshot after all mandatory dependencies complete.
- Verify clean installation and full CI on Node 20 and 22 plus browser bundle and subpath isolation.
- Re-run adversarial structured-string, dense-finding, repeated-PEM, partition-invariance, provider, and adapter lifecycle cases.
- Inspect package contents, declarations, imports, dependency integrity, public API, documentation, and the Unreleased changelog.
- Publish a new dated repository-local readiness audit with remaining blockers stated explicitly.

### Out of scope

- Choosing or approving a version, creating a tag or release, publishing a package, deploying, changing release channels, or treating readiness evidence as release authority.

## Implementation checklist

- [x] Capture and verify stable snapshot evidence before and after the audit without modifying implementation during evaluation.
- [x] Run clean `npm ci` and `npm run ci` on Node 20 and 22.
- [x] Run every required regression and scaling check from the prior audit, including measured time and memory evidence where relevant.
- [x] Build an inspection-only `0.0.0-inspection` tarball in a temporary copy and test root, Node, Web, declaration-consumer, and browser graphs.
- [x] Run lockfile audit plus governance and plan validators.
- [x] Review the final public API and Unreleased changelog, then record a clear ready/not-ready verdict and any residual follow-up.

## Acceptance criteria

- [x] SS-AUD-001 through SS-AUD-008 have successful durable remediation evidence or an explicit non-blocking disposition consistent with the original release gates.
- [x] Node 20 and 22 complete clean-install CI, and root/Web bundles remain free of Node-only dependencies.
- [x] Dense-finding and repeated-PEM scaling, partition invariance, provider coverage, structured redaction, and adapter terminal cases meet their work-item criteria.
- [x] Package contents, declarations, documentation, public exports, and Unreleased changelog are internally coherent and reviewable.
- [x] The resulting audit contains no plaintext secrets and makes no version, release, publication, or deployment claim.

## Verification

- [x] Run `npm ci`, `npm run ci`, inspection pack/import/type/bundle checks, `npm audit --package-lock-only`, and both governance validators with recorded environments and outcomes.
- [x] Confirm all temporary artifacts and diagnostic logs are removed and the audited snapshot hash is unchanged.

## Completion record

- Result: Complete. The remediated working-tree snapshot is technically ready for beta approval; every mandatory pre-beta gate is closed without selecting a version or performing a release operation.
- Evidence: The [2026-08-30 beta readiness requalification](../../audits/2026-08-30-beta-readiness-requalification.md) records the stable snapshot hash, clean Node 20/22 CI, 357-test runtime results, focused 298-test remediation run, scaling and memory measurements, inspection tarball consumers and browser graphs, dependency audit, documentation review, and zero-error governance validation.
- Follow-ups: Refresh time-sensitive vulnerability and provider checks for the eventual release snapshot. Release approval, version selection, tagging, publication, and deployment remain explicitly outside this work item.
