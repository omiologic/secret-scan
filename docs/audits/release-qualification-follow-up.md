# Release qualification follow-up

[Documentation home](../README.md) · [Initial review](pre-release-code-and-docs-review.md)

- Issue: [#174](https://github.com/redact-secret/redact-secret/issues/174).
- Date: 2026-09-11.
- Candidate: `9f02fc401525381a6b02b5dd514a68df9a4f9531`.
- Branch: `fix/pre-release-review-docs`.
- [Candidate rehearsal run](https://github.com/redact-secret/redact-secret/actions/runs/34615840860).
- [Initial run](https://github.com/redact-secret/redact-secret/actions/runs/34615391290)
  assessed `470844b9210ffad6f1646fab13940de670afdcdd`.

## Final verification result

**The candidate passed all 41 jobs in Package Release Rehearsal.** The run
completed successfully at `9f02fc401525381a6b02b5dd514a68df9a4f9531`.

| Verification | Result |
| --- | --- |
| Node wrapper checks | Node 20, 22, and 24 passed |
| Native addon | All 8 targets passed on Node 20/22/24; 6 targets have npm publication packages |
| CLI | All 6 release targets passed |
| Browser artifacts and wrapper | Chromium, Firefox, and WebKit passed |
| Python | All 8 abi3 wheel targets, floor/current interpreter checks, source distribution, and complete matrix passed |
| Rust | Linux/macOS/Windows workspace tests, MSRV 1.88, wasm32, format/lint, rustdoc, standalone core packaging, and Cargo dependency/advisory checks passed |
| Consumer install | Qualified packed wrapper/native/Wasm packages installed and initialized outside the checkout |
| npm dependency rehearsal | All 7 runtime dependency packages assembled, packed, and content-checked without publication |
| Download integrity | All 43 artifact-file sizes and SHA-256 hashes matched the recorded inventory |
| Input identity | All 5 conformance-file SHA-256 hashes and all 6 matrix declarations matched this checkout |

The run's inventory reports `published: false`. Both the inventory and the
cutover plan name the candidate revision above. Downloaded files were verified
locally after the workflow succeeded; qualification evidence was not borrowed
from a different commit or from the earlier failed run.

Durable evidence copies:

- [Artifact inventory](evidence/174/artifact-inventory.json): per-file hashes,
  corpus identity, declared matrices, and package contents.
- [Dependency cutover plan](evidence/174/dependency-cutover-plan.json): seven
  runtime dependencies and their qualified source artifacts.
- [Verification summary](evidence/174/verification-summary.json): all 41 job
  results, source revision, local scans, live registry/governance checks, and
  evidence-file digests.

This establishes pre-publication artifact readiness for the assessed revision.
It does **not** complete public-registry installation or authenticated publisher
verification; those remaining boundaries are stated below. These evidence
Markdown/JSON additions were prepared after the tested commit and do not change
its executable sources.

## Initial failure and correction

The initial run found one Windows test assertion that normalized a raw source
path against newly escaped text output. Detection metadata and offsets agreed;
Windows backslashes in the displayed path caused the comparison to fail.
`an_ordinary_long_line_behaves_the_same_streamed_or_by_path` now compares parsed
JSON finding arrays and asserts one finding in each report. The redacted-output
comparison remains. CLI tests (74) and Clippy passed locally before committing
and pushing this correction as `9f02fc4` (`wip: #174`).

## Local security and live operational checks

Both workspace and addon-build-tooling lockfile npm audits reported zero known
vulnerabilities. These are point-in-time registry advisory results, not a promise
about future advisories.

The pinned, provenance-verified OpenGrep scan ran on candidate `9f02fc4`:
version `1.30.0`, rules digest
`18894c09bcde68fd088ec8252e64b637d67cd975ad6fff2834374cc7345db6da`.
It reported 29 findings, 16 acknowledged scan errors, and zero unresolved
baseline items, exiting 0. This is a pass against the reviewed baseline, not a
claim of zero findings or complete parsing coverage. No baseline was relaxed.

Live GitHub reads confirmed:

- `release` exists, has a required reviewer, forbids admin bypass, and permits
  only the `main` branch through its custom deployment-branch policy.
- `main` enforces 11 required checks with strict updating and admin enforcement;
  force pushes and deletion are disabled.
- The pull-request review configuration has **zero required approving reviews**
  and a named user review-bypass allowance. The existence of that configuration
  must not be described as enforcement of an independent approving review.

## Public registry installation remains unavailable before publication

Live public metadata reads returned no published project for all eight npm
packages (`@redact-secret/core`, `@redact-secret/wasm`, and six platform addons),
`redact-secret` and `redact-secret-cli` on crates.io, and `redact-secret` on PyPI.
Both normalized PyPI aliases agree. No unavailable/private lookup was counted
as a successful consumer install.

Consequently, a public-registry install of this candidate cannot yet be tested.
The rehearsal exercises qualified package tarballs and clean consumer installs,
then packs and checks the seven npm runtime dependency packages with
`--dry-run`. Those checks do not prove registry publication or publisher rights.
After explicit release approval and publication, the release workflow's real
registry-install gates must verify the published version.

Public package absence does not prove npm/crates.io publishing credentials are
usable. PyPI pending Trusted Publisher configuration is not exposed by the
public metadata endpoint; authenticated publisher configuration remains
unverified. No credentials were read or printed to establish these facts.

No version was selected, no package or tag was published, and no deployment or
repository-protection setting was changed. The local branch was pushed only so
GitHub runners could test the candidate. Historical audit verdicts remain tied
to their own revisions.
