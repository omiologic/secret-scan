---
work_item_id: "secret-scan-00006"
title: "Prove package readiness across browser and Node runtimes"
depends_on:
  - "secret-scan-00005"
target_paths:
  - "package.json"
  - "README.md"
  - "ARCHITECTURE.md"
  - "SECURITY.md"
  - "LICENSE"
  - ".github/workflows"
  - "test"
created_at: "2026-08-30T17:25:37Z"
updated_at: "2026-08-30T18:28:25Z"
---

# Prove package readiness across browser and Node runtimes

## Outcome

The implemented public API is documented and validated by repeatable browser, Node.js, security, performance, packaging, and CI evidence suitable for a separate release-approval review.

## Context

The initial milestone is only publishable after the same core is proven in browser and server contexts, negative behavior is exercised, regex safety is reviewed, and package metadata and security guidance are complete. This work item prepares evidence; it does not choose a version or authorize publication.

## Scope

### In scope

- Add Node.js and browser build/import tests and continuous integration.
- Add representative 1 KB, 100 KB, and 1 MB performance checks with non-secret synthetic content.
- Review regex behavior, public API declarations, exports, documentation, security reporting guidance, license, and package contents.
- Produce a concise readiness record identifying any unresolved release blockers.

### Out of scope

- Choosing or changing a version, updating a release changelog for an approved version, tagging, publishing, deploying, or creating a release.

## Implementation checklist

- [x] Add reproducible CI checks for typechecking, tests, builds, and browser/Node imports.
- [x] Add representative performance checks and practical non-regression thresholds.
- [x] Complete README usage, API, policy, client/server-boundary, and synthetic-example documentation.
- [x] Add security reporting guidance and verify package licensing and published-file intent.
- [x] Audit declarations, errors, logs, snapshots, fixtures, and package contents for plaintext-secret exposure.
- [x] Record release-readiness evidence and unresolved blockers without performing release operations.

## Acceptance criteria

- [x] The same package entry point imports and runs in supported browser and Node.js checks.
- [x] All deterministic, positive, negative, overlap, redaction, policy, adversarial-regex, and packaging tests pass in CI.
- [x] Representative input sizes have recorded repeatable performance evidence and no pathological regex behavior.
- [x] README, architecture, security guidance, license, package exports, and public declarations agree with implemented behavior.
- [x] No fixture, snapshot, diagnostic, error, or packaged artifact exposes a real credential or detected plaintext value.
- [x] The completion record clearly states that release still requires explicit user approval after API and changelog review.

## Verification

- [x] Run the complete CI command set locally and capture commands and results in the completion record.
- [x] Inspect the package archive contents without publishing it.
- [x] Review the public API and changelog state with the user before any separate release request.

## Completion record

- Result: Completed the pre-release readiness surface: implementation-accurate public API and boundary documentation, MIT licensing, private security reporting guidance, Node 20/22 GitHub Actions CI, executable Node and browser-targeted package-entry checks, representative performance gates, and temporary dry-run package-content inspection. The package remains deliberately versionless and unreleased.
- Evidence: On Node 22.16.0 and npm 11.4.1, `npm ci` completed with zero audit vulnerabilities and `npm run ci` passed typechecking, build, and 107 tests across 13 files. Representative scans completed in 2 ms for 1 KB (100 ms gate), 1 ms for 100 KB (500 ms gate), and 5 ms for 1 MB (3,000 ms gate). Temporary `0.0.0-inspection` dry-run packaging passed in 242 ms and included `dist`, README, architecture, security policy, license, and package metadata while excluding source, tests, planning/agent files, and CI metadata. Workflow YAML parsed successfully; public declarations and built exports were inspected; credential-pattern review found only explicitly synthetic, revoked, truncated, placeholder, or adversarial values; no plaintext-bearing public `value` field or error `cause` was present. Plan validation reports zero errors and warnings.
- Follow-ups: Release remains blocked pending explicit user approval, selection of a version, creation and review of the governance-required changelog entry, public API review, and a passing remote GitHub Actions run after an authorized Git operation. Direct `npm pack --dry-run` correctly remains unavailable without a version; the inspection-only sentinel never modified repository state. No branch, commit, tag, release, publication, or deployment was performed.
