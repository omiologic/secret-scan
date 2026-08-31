---
work_item_id: "secret-scan-00020"
title: "Harden CI supply-chain controls"
depends_on: []
target_paths:
  - ".github/workflows/ci.yml"
  - "package-lock.json"
  - "SECURITY.md"
created_at: "2026-08-30T20:41:21Z"
updated_at: "2026-08-31T03:17:09Z"
---

# Harden CI supply-chain controls

## Outcome

CI uses reviewed immutable action revisions and least-privilege permissions while preserving the Node compatibility and package-integrity checks.

## Context

SS-AUD-009 found no runtime dependencies or known lockfile advisories, but the workflow uses mutable action major tags. This is useful defense in depth and intentionally remains independent of the mandatory beta remediation chain.

## Scope

### In scope

- Pin third-party and GitHub-authored actions to reviewed full commit SHAs with readable version comments.
- Declare the minimum workflow and job permissions required by the current checks.
- Verify lockfile integrity, install-script exposure, Node 20/22 coverage, and a safe periodic refresh practice.

### Out of scope

- Dependency upgrades unrelated to a verified security need, publishing credentials, release workflows, automated deployment, or granting broader repository permissions.

## Implementation checklist

- [x] Inventory every action reference and required permission in the CI workflow.
- [x] Resolve each selected action release to a reviewed immutable commit and retain the human-readable upstream version in a comment.
- [x] Set least-privilege permissions explicitly and preserve clean-install behavior.
- [x] Document how pinned revisions and lockfile integrity are reviewed and refreshed.
- [x] Confirm no secret value or publishing authority is introduced into CI configuration or logs.

## Acceptance criteria

- [x] Every external action reference uses a full immutable commit SHA.
- [x] Workflow permissions are explicit and no broader than the checks require.
- [x] Node 20/22, clean install, typecheck, build, tests, and package checks continue to pass.
- [x] Lockfile integrity and install-script exposure are reviewed with no active credential or secret-bearing diagnostics.

## Verification

- [x] Validate workflow syntax, inspect resolved action provenance, run lockfile audit, and run the complete CI command locally where supported.
- [x] Review CI logs and configuration for permission expansion or plaintext-secret exposure.

## Completion record

- Result: Completed. CI now uses reviewed immutable action revisions, denies workflow permissions by default, grants only job-level repository read access, drops checkout credentials, and disables dependency lifecycle scripts during clean install.
- Evidence: Official release tags resolved to signed commits for `actions/checkout` v6.1.0 and `actions/setup-node` v6.5.0; workflow YAML and both 40-character action references validated; the lockfile v3 graph had 147 packages with complete resolution and integrity metadata; its three declared install-script packages were reviewed and remained unexecuted; `npm audit --package-lock-only` reported zero vulnerabilities; `npm run ci` passed on Node 20.20.2 and 22.23.2 with 17 test files and 357 tests, including typecheck, build, runtime/package-import, browser-build, and package-content checks; repository scanning reported zero secret findings in the workflow and security guidance.
- Follow-ups: Follow the monthly and security-notice-driven refresh procedure documented in `SECURITY.md`; no completion blocker remains.
