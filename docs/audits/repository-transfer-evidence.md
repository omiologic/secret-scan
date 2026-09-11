# Repository transfer evidence

Evidence for issue #157, recorded on 2026-09-11. This record contains only
repository identifiers, counts, setting names, timestamps, and workflow
results. It contains no credential value or token material and authorizes no
release or publication.

## Authority and evidence limits

The repository transfer and non-destructive placeholder rename had already
occurred when this closeout began. The repository administrator explicitly
requested the post-transfer rewrite, issue-type repair, evidence capture,
protection changes, and workflow reruns on 2026-09-11. That request authorizes
only those bounded completion actions.

No complete machine-readable inventory was committed before the transfer.
Accordingly, the pre-transfer column below is reconstructed from issue #157,
issue #151, the dated release-readiness audits, and GitHub objects whose node
identity survived the transfer. Any field without reliable pre-transfer
evidence is marked `not recorded`; it is not presented as proven preservation.

## Pre/post comparison

| Surface | Reconstructed pre-transfer evidence | Post-transfer evidence |
| --- | --- | --- |
| Canonical repository | Existing source repository at `omiologic/secret-scan`; target path occupied by an empty placeholder | `redact-secret/redact-secret`, node `R_kgDOUI8gzw`, public, default branch `main` |
| Placeholder | Empty public repository at the intended target | Preserved non-destructively as `redact-secret/redact-secret-placeholder`, node `R_kgDOUV0_Aw` |
| Git history | Existing source history | 191 commits; `main` at `679dbda1851f66e0b4233dcbe9c51cc37d6326c3` at closeout start |
| Issues and pull requests | Existing issue/PR graph; #157 recorded native relationships | 97 issues and 69 pull requests; #157 retains its parent and blocked-by/blocking relationships |
| Issue types | Target organization initially lacked `Epic` | `Task`, `Bug`, `Feature`, and `Epic` enabled; #60 assigned `Epic` during closeout |
| Milestones | Existing migration milestones | 2 milestones: `Rust Core Migration` and `Detection Assurance & Corpus Depth` |
| Wiki | Existing wiki repository | Former and canonical wiki Git endpoints resolve to head `1a8ae162c1061135906e22aba2bf09eaaf130a91` |
| Releases | Not recorded | 0 releases |
| Stars / watchers | Not recorded | 0 stars / 0 watchers |
| Actions secret metadata | Dated audit recorded the `NPM_TOKEN` name; no value was read | Repository secrets: 0; `release` environment secret names: `NPM_TOKEN` |
| Environments | `release` existed without protection | `release` has one required reviewer, administrator bypass disabled, and a custom deployment policy limited to `main` |
| Deploy keys | Not recorded | 0 |
| Webhooks | Not recorded | 0 |
| Branch protection | `main` unprotected; no rulesets | Classic `main` protection requires one approval, conversation resolution, strict up-to-date checks, and the named CI/qualification/OpenGrep checks; force pushes and deletion disabled; administrators enforced |
| Rulesets | 0 | 0; classic branch protection is used instead |
| Redirects | `omiologic/secret-scan` and its wiki location | Former web location returns `301`; former Git repository and wiki endpoints resolve to the canonical heads |
| Maintained clone | Origin used the former location before cutover | This worktree's `origin` is `git@github.com:redact-secret/redact-secret.git`; repository-owned wiki guidance uses `redact-secret.wiki` |

## Required checks on `main`

The branch protection rule requires these GitHub Actions check names:

- `Node 20`, `Node 22`, and `Node 24`
- `Rust format, lint, and dependency policy`
- `Rust native host (ubuntu-latest)`, `Rust native host (macos-latest)`, and
  `Rust native host (windows-latest)`
- `Rust MSRV` and `Rust wasm32 target`
- `Wheel matrix`, which depends on the complete Python source and wheel matrix
- `Artifact inventory`, which depends on the full Rust, Python, Node addon,
  browser, CLI, and packed-consumer qualification graph
- `OpenGrep (pinned baseline)`

## Publisher-coordinate disposition

All repository-owned package project URLs and workflow repository references
use `redact-secret/redact-secret`. npm and PyPI account-side publisher settings
cannot be read through the public registry APIs. They remain an explicit
release blocker until an authenticated registry administrator records:

- npm organization 2FA and least-privilege first-publication bootstrap state,
  followed by per-package OIDC conversion; and
- the PyPI pending trusted publisher for repository
  `redact-secret/redact-secret`, workflow `release.yml`, environment `release`,
  and normalized project name `redact-secret`.

The repository's `release` environment exposes only the secret name
`NPM_TOKEN`; its value, scope, and expiration were not read. No registry
credential was created, changed, or revoked during this transfer closeout.

## Workflow evidence

The administrator authorized attempt 2 of each preserved `main` run after the
transfer. All four ran in `redact-secret/redact-secret` against
`679dbda1851f66e0b4233dcbe9c51cc37d6326c3` and completed successfully:

| Workflow | Run | Attempt | Completed (UTC) | Conclusion |
| --- | --- | ---: | --- | --- |
| CI | [34560376840](https://github.com/redact-secret/redact-secret/actions/runs/34560376840) | 2 | 2026-09-11T12:10:21Z | success |
| Python wheels | [34560376891](https://github.com/redact-secret/redact-secret/actions/runs/34560376891) | 2 | 2026-09-11T12:12:19Z | success |
| Artifact qualification | [34560377022](https://github.com/redact-secret/redact-secret/actions/runs/34560377022) | 2 | 2026-09-11T12:14:18Z | success |
| SAST / OpenGrep | [34560376913](https://github.com/redact-secret/redact-secret/actions/runs/34560376913) | 2 | 2026-09-11T12:08:07Z | success |
