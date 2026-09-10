# CI, release automation, documentation, and supply-chain controls review

An independent review of the release candidate's pre-release qualification and
operational controls — the five workflows under `.github/workflows/`, the
release and reconcile automation, the documented support matrices, and the
supply-chain posture of both — required by issue #65 under Feature #61 and
Epic #60.

- **Assessed revision:** `389b55f682beb9541b866c34f2c556f639326f2a`
  (merge of PR #69, *JavaScript and Python bindings and package contracts
  review*).
- **Assessed on:** 2026-09-09.
- **Scope:** the four areas issue #65 names. The canonical core, the shared
  conformance contract, and the CLI's own behavior belong to #63; the runtime
  adapters and their package *contracts* belong to #64. This review covers
  whether automation builds, qualifies, publishes, and documents those
  artifacts — not whether their in-process behavior is correct.
- **Authority:** this review records evidence. It does not change behavior,
  authorize implementation changes, or authorize any release operation.
  Disposition of these findings belongs to #66.

## Method and cost policy

Every claim below is either a span in the tree at the assessed revision, the
output of a check that already exists in the repository, a read-only GitHub API
response recorded verbatim, or a minimal reversible probe run for this review
and recorded. Nothing is inferred from a document alone.

Issue #65's verification clause requires reading workflow inputs and declared
matrices *before* proposing or dispatching any job that could run longer than
five minutes. This review dispatched **no** workflow. Every workflow claim is
read from the committed YAML, from the repository's own cross-checking scripts,
or from a read-only API call. No tag, publication, deployment, or external
repository mutation was performed, and nothing outside this worktree was
written.

What was run on the review host:

| Check | Result |
|---|---|
| `npm run ci` | pass — 778 root tests (22 files), 76 `packages/javascript` tests (9 files) |
| `cargo test --workspace --locked` | pass — 388 tests across 16 suites |
| `npm run rust:check` | `Rust workspace check complete: 0 error(s)`; `Derived MSRV 1.88.0 from libloading 0.9.0, napi 3.12.2, napi-build 2.4.1, napi-derive 3.6.3, napi-derive-backend 6.1.2, napi-sys 3.3.0` |
| `python3 -B scripts/check-python-package.py` | `Python package check complete: 0 error(s)` |
| `npm pack --dry-run` (repository root) | recorded in [F-01](#f-01--new-risk--the-release-workflow-publishes-the-typescript-oracle-under-the-product-name) |
| `npm audit --package-lock-only` | `found 0 vulnerabilities` |
| `npm view @omiologic/secret-scan@0.1.0-beta.1 version --json` | `E404` for the whole scope; recorded in [Criterion 3](#criterion-3--lockstep-manifest-partial-publication-and-reconcile) |
| One reversible version-drift probe on `packages/javascript/package.json`, reverted | recorded in [F-09](#f-09--new-risk--packagesjavascriptpackagejson-is-outside-version-lockstep) |
| One tracked-markdown relative-link check, written for this review | recorded in [F-19](#f-19--stale-claim--four-shipped-links-point-into-a-gitignored-directory-and-no-feature-note-covers-this-area) |
| Read-only `gh api` reads of repository, environment, and branch-protection state | recorded in [F-04](#f-04--new-risk--no-automated-gate-enforces-release-approval-and-reconcile-has-none-at-all) and [F-15](#f-15--new-risk--repository-controls-do-not-require-what-the-workflows-practice) |

Review host: macOS 26.5.2 (arm64), Node v22.16.0, npm 11.4.1, Python 3.14.7,
rustc 1.98.1, cargo 1.98.1.

`cargo-deny` and `maturin` are **not installed** on the review host. Every
claim about `cargo deny check` or about a wheel therefore rests on
`deny.toml`, on `[workspace.metadata.secret-scan]`, on the workflow YAML, or on
`scripts/check-python-package.py` — never on an unrun tool. One claim about
`PyO3/maturin-action` is read from that action's own `action.yml` at the exact
SHA the workflow pins, quoted below.

No reproduction embeds a matched value, a fixture input, or a credential-shaped
string. Secret *names* (`NPM_TOKEN`, `NODE_AUTH_TOKEN`) are configuration
identifiers, not values, and no secret value was read, printed, or inferred.

## Classification vocabulary

This review reuses the vocabulary of
[the closed-issue acceptance evidence ledger](./closed-issue-acceptance-evidence-ledger.md),
[the core, conformance, and CLI boundary review](./core-conformance-cli-boundary-review.md),
and
[the bindings and package contracts review](./javascript-python-bindings-package-contracts-review.md)
so #66 can consolidate all four without translation.

| Class | Meaning |
|---|---|
| `evidence-gap` | The behavior appears correct but no deterministic, recorded check binds it at the asserted scope. |
| `new-risk` | A risk no closed issue's criteria anticipated, surfaced while reviewing. |
| `stale-claim` | A statement the tree itself now contradicts. |

Severity is this review's reading of release impact. Epic #60 and issue #66
decide what blocks.

## Summary

Twenty-three findings. The supply-chain hygiene *inside* the workflows is the
strongest part of this area and is largely sound: all twenty-nine `uses:` lines are 40-character
commit SHAs, the workflow-level default is `permissions: {}`, every job narrows
to `contents: read` except the two that must create a ref, every checkout sets
`persist-credentials: false`, dependency installation is
`npm ci --ignore-scripts`, the npm dependency graph has zero runtime
dependencies and zero advisories, and `cargo-deny` enforces sources, licenses,
advisories, and bans with `yanked = "deny"` and `unknown-registry = "deny"`.
The Python half of the matrix is genuinely qualified: eight targets built,
each wheel smoke-tested on the architecture it targets against two
interpreters, installed with `--no-index --no-deps --only-binary :all:`, and
the matrix itself pinned to the manifest by a script that runs on every pull
request.

The blockers are not about hygiene. They are about what the release automation
actually qualifies and actually ships. `ARCHITECTURE.md`,
`decision-release-bindings-in-lockstep`, and `README.md` all describe one
product of four artifacts — Rust crate, npm package, Python package, CLI —
qualified together from one commit and published under one version and one tag.
The automation implements one publication: an npm tarball containing 106 files
of TypeScript compiled from `src/`, with no N-API, no WebAssembly, and no Rust
in it. Its qualification gate, `release:check`, runs the JavaScript checks and
`npm pack --dry-run`, and runs none of `rust:check`, `cargo test`,
`cargo clippy`, `cargo deny`, the wasm32 suite, or the wheel matrix. And the
"explicit approval" every governing document requires is enforced by nothing
in automation: the `release` environment has no protection rules, `main` is not
branch-protected, and the reconcile workflow — which holds `contents: write`
and creates tags — declares no environment at all.

| ID | Class | Severity | Area | One line |
|---|---|---|---|---|
| [F-01](#f-01--new-risk--the-release-workflow-publishes-the-typescript-oracle-under-the-product-name) | `new-risk` | **blocking** | release automation | `Release` publishes `dist/` compiled from `src/` — the temporary TypeScript oracle — as `@omiologic/secret-scan`. |
| [F-02](#f-02--new-risk--releasecheck-qualifies-only-the-javascript-half-of-the-product) | `new-risk` | **blocking** | release automation | `release:check` omits `rust:check`, `cargo test/clippy/doc/package`, `cargo deny`, the wasm32 suite, and the entire wheel matrix. |
| [F-03](#f-03--new-risk--three-of-the-four-promised-artifacts-have-no-publication-path) | `new-risk` | **blocking** | release automation | Crate, wheel, and CLI have no publish job, and `publish = false` makes the crate structurally unpublishable. |
| [F-04](#f-04--new-risk--no-automated-gate-enforces-release-approval-and-reconcile-has-none-at-all) | `new-risk` | **blocking** | operational controls | `release` environment: `protection_rules: []`; `main` unprotected; `Reconcile Release` declares no environment but holds `contents: write`. |
| [F-05](#f-05--evidence-gap--the-node-native-matrix-has-no-ci-evidence) | `evidence-gap` | **blocking** | platform matrix | Six N-API targets declared; no workflow runs `napi build` or the binding's smoke test, and nothing pins the list to anything. |
| [F-06](#f-06--new-risk--no-npm-provenance-and-a-long-lived-token-instead-of-trusted-publishing) | `new-risk` | medium | supply chain | No `id-token: write`, no `--provenance`, no `publishConfig.provenance`; a stored `NPM_TOKEN` instead. |
| [F-07](#f-07--stale-claim--the-release-manifest-the-adr-requires-does-not-exist) | `stale-claim` | medium | release automation | The ADR and `ARCHITECTURE.md` require a recorded manifest; no workflow writes one. |
| [F-08](#f-08--new-risk--reconcile-can-only-ever-reconcile-mains-tip) | `new-risk` | medium | release automation | It compares the publication against `GITHUB_SHA` of `main` and forces `refs/heads/main`, so one later commit on `main` retires the repair path. |
| [F-09](#f-09--new-risk--packagesjavascriptpackagejson-is-outside-version-lockstep) | `new-risk` | medium | lockstep | Probe: set it to `9.9.9-probe.0` and both lockstep scripts still report `0 error(s)`. |
| [F-10](#f-10--stale-claim--the-browser-surface-is-documented-as-supported-and-never-executed-in-a-browser) | `stale-claim` | medium | platform matrix | `WASM_BINDGEN_TEST_ONLY_NODE: "1"`; no browser engine runs in any workflow, which is why #64's blocking browser defects reached `main`. |
| [F-11](#f-11--new-risk--the-wheel-builds-own-tools-are-unpinned-while-every-action-is-sha-pinned) | `new-risk` | medium | supply chain | `maturin-version` unset, `container` action-chosen, `sccache: "true"` — three floating inputs inside a SHA-pinned action. |
| [F-12](#f-12--stale-claim--the-shipped-readmes-quick-start-cannot-run-against-the-package-it-ships-in) | `stale-claim` | medium | documentation | The tarball carries a README whose first example imports `initialize`, which the package does not export. |
| [F-13](#f-13--evidence-gap--cargo-denys-graph-omits-both-musl-wheel-targets) | `evidence-gap` | low | supply chain | `deny.toml` declares seven targets; the wheel matrix declares eight, and the two musl triples are not among the seven. |
| [F-14](#f-14--evidence-gap--nothing-binds-the-wasm-bindgen-cli-version-to-the-crate-version) | `evidence-gap` | low | CI | The MSRV has an exact workflow cross-check; the `wasm-bindgen` pair that a comment calls mandatory has none. |
| [F-15](#f-15--new-risk--repository-controls-do-not-require-what-the-workflows-practice) | `new-risk` | low | operational controls | `allowed_actions: "all"`, `sha_pinning_required: false`, `main` unprotected, forking enabled on a public repository. |
| [F-16](#f-16--new-risk--no-job-timeout-in-ci-and--d-warnings-applies-to-a-third-party-cargo-install) | `new-risk` | low | CI | `ci.yml` sets no `timeout-minutes`, and workflow-level `RUSTFLAGS` applies to `cargo install wasm-bindgen-cli`. |
| [F-17](#f-17--evidence-gap--advisory-review-is-manual-and-unscheduled) | `evidence-gap` | low | supply chain | `SECURITY.md` prescribes a monthly review with no `schedule:` trigger and no `dependabot.yml` behind it. |
| [F-18](#f-18--stale-claim--the-wheel-workflows-workflow_call-is-documented-as-reused-and-nothing-calls-it) | `stale-claim` | low | release automation | `docs/python-packaging.md` says release qualification reuses it; no workflow does. |
| [F-19](#f-19--stale-claim--four-shipped-links-point-into-a-gitignored-directory-and-no-feature-note-covers-this-area) | `stale-claim` | low | documentation | Four links in `test/conformance/README.md` resolve into `/_notes/`, which `.gitignore` excludes, in a public repository. |
| [F-20](#f-20--new-risk--npm-run-release-has-no-build-guarantee-of-its-own) | `new-risk` | low | release automation | No `prepack`/`prepublishOnly`; the publish step depends on an earlier script having built `dist/` in the same checkout. |
| [F-21](#f-21--new-risk--artifact-retention-is-unspecified) | `new-risk` | low | supply chain | Both `upload-artifact` calls omit `retention-days`, so qualification artifacts inherit whatever the repository default is. |
| [F-22](#f-22--stale-claim--securitymds-supply-chain-section-describes-only-the-ci-half) | `stale-claim` | low | documentation | It never mentions the publish path's `contents: write`, the `release` environment, provenance, retention, or `cargo deny`. |
| [F-23](#f-23--evidence-gap--enginesnode--20-claims-more-node-majors-than-ci-tests) | `evidence-gap` | low | platform matrix | Both manifests claim every major from 20 upward; the matrix is `[20, 22]`. |

## What was reviewed and found sound

Recorded so #66 can tell a verified control from an unexamined one. Each item
below was checked against a span or a command output, not against a document.

### Criterion 1 — documented support versus the actual matrices

Six surfaces, compared claim by claim. "Documented" is the union of
`README.md:59-65`, `ARCHITECTURE.md:186-216`, `deny.toml:8-16`,
`bindings/node/package.json` `napi.targets`, and
`[workspace.metadata.secret-scan] python-wheel-targets` in `Cargo.toml:173-182`.

| Surface | Documented | Exercised in CI | Verdict |
|---|---|---|---|
| Rust crate | MSRV 1.88, edition 2024, `publish`-able core with a pinned public API and package contents | `rust-msrv` job checks the workspace on 1.88 (`ci.yml:133-154`); `rust-policy` runs fmt, clippy, `npm run rust:check`, `cargo doc -D warnings`, `cargo package -p secret-scan`, `cargo deny check` (`ci.yml:49-91`); `rust-native` runs `cargo test --workspace --locked` on three hosts | sound for the library, except publication ([F-03](#f-03--new-risk--three-of-the-four-promised-artifacts-have-no-publication-path)) |
| Node native (N-API) | six targets: `{x86_64,aarch64}` × `{linux-gnu, apple-darwin, pc-windows-msvc}` | nothing builds it; `cargo test` covers three of the six host triples | [F-05](#f-05--evidence-gap--the-node-native-matrix-has-no-ci-evidence) |
| Browser (WebAssembly) | "modern browsers", `wasm32-unknown-unknown` | `cargo check` for wasm32 plus `wasm-bindgen-test` under Node with `WASM_BINDGEN_TEST_ONLY_NODE: "1"` (`ci.yml:186-190`) | [F-10](#f-10--stale-claim--the-browser-surface-is-documented-as-supported-and-never-executed-in-a-browser) |
| Python wheel | eight targets, one `cp310-abi3` wheel each, CPython 3.10+ (3.11 floor on Windows-on-Arm), plus an sdist | `python-wheels.yml` builds all eight and the sdist, smoke-tests each on its own architecture against the floor and a current interpreter, runs the shared conformance corpus against the *installed* artifact, and `qualify-matrix` requires one wheel per declared target | **sound** — the strongest matrix in the repository |
| CLI | binary `secret-scan`, "for CI, pre-commit hooks, and safe redaction pipelines" | `--version` smoke on three hosts (`ci.yml:123-131`) | no platform list and no artifact: [F-03](#f-03--new-risk--three-of-the-four-promised-artifacts-have-no-publication-path) |
| Package artifacts | "one product … Rust crate, npm package, Python package, and CLI … one SemVer version and one `v{version}` Git tag" | one npm publication, of the oracle | [F-01](#f-01--new-risk--the-release-workflow-publishes-the-typescript-oracle-under-the-product-name), [F-03](#f-03--new-risk--three-of-the-four-promised-artifacts-have-no-publication-path) |

Two cross-checks in this area are genuinely enforced and deserve to be named,
because they are the model the unenforced matrices should follow:

- **MSRV.** `scripts/check-rust-workspace.py:50-51,210-228` derives the highest
  `rust-version` among resolved non-member packages, requires the declared
  workspace MSRV to be at least that, requires every member to inherit it, and
  then requires `ci.yml` to contain *exactly one* `MSRV:` line equal to it. The
  derivation on this host: `Derived MSRV 1.88.0 from libloading 0.9.0, napi
  3.12.2, napi-build 2.4.1, napi-derive 3.6.3, napi-derive-backend 6.1.2,
  napi-sys 3.3.0` — and `Cargo.toml:23` and `ci.yml:14` both say `1.88`.
- **The wheel matrix.** `scripts/check-python-package.py:270-290` extracts every
  `target:` key from `python-wheels.yml` and requires the set to equal
  `python-wheel-targets` exactly, and requires every declared triple to map to a
  platform tag the script recognizes. `npm run python:check` is inside
  `npm run ci`, so it runs on every pull request. A wheel target cannot be
  dropped from the workflow without a reviewed manifest change.

### Criterion 2 — pinning, permissions, credentials, install scripts, provenance, retention

| Control | State at the assessed revision | Verdict |
|---|---|---|
| Action pinning | All twenty-nine `uses:` lines across the five workflows resolve to nine distinct actions, and every one is a 40-character commit SHA with a version comment: `actions/checkout@d23441a…`, `actions/setup-node@24997072…`, `actions/setup-python@5fda3b95…`, `actions/upload-artifact@043fb46d…`, `actions/download-artifact@3e5f45b2…`, `dtolnay/rust-toolchain@6c977a6c…`, `Swatinem/rust-cache@6323deb1…`, `EmbarkStudios/cargo-deny-action@3c634983…`, `PyO3/maturin-action@e83996d1…` | **sound** in the workflows; not required by the repository ([F-15](#f-15--new-risk--repository-controls-do-not-require-what-the-workflows-practice)); one comment is the moving label `# v1` rather than a release, noted below |
| Workflow permissions | `permissions: {}` at the top of `ci.yml`, `release.yml`, `reconcile-release.yml`, `python-wheels.yml`; `contents: read` on `package-release-rehearsal.yml`. Every job narrows explicitly. Only `release.yml:18-19` and `reconcile-release.yml:20-21` take `contents: write`, and both need it to create a ref | **sound** |
| Checkout credentials | `persist-credentials: false` on all eleven checkout steps, including both write-permissioned jobs — so the tag is created through `gh api` with `github.token` scoped to that step, never through a credential left in `.git/config` | **sound** |
| Install-script policy | `npm ci --ignore-scripts` in `ci.yml:44` and `release.yml:43`. Three lockfile entries declare install scripts (`esbuild` 0.25.12, `fsevents` 2.3.3, `vitest/node_modules/esbuild` 0.28.2); all three are development-only and the suite passes without executing them. The npm graph has **zero** runtime dependencies and `npm audit --package-lock-only` reports `found 0 vulnerabilities` | **sound** in CI; `README.md:317` tells a contributor plain `npm ci`, which is the less-hardened form ([F-22](#f-22--stale-claim--securitymds-supply-chain-section-describes-only-the-ci-half)) |
| Rust dependency policy | `deny.toml` sets `yanked = "deny"`, `unknown-registry = "deny"`, `unknown-git = "deny"`, a five-entry license allowlist, `wildcards = "deny"`, and `advisories.version = 2`. Independently, `[workspace.metadata.secret-scan] allowed-dependencies = []` means the core's normal and build graphs must be **empty**, and `forbidden-dependencies` guards the whole workspace against network, filesystem, environment, telemetry, secret-storage, and UI crates | **sound**, except the target set ([F-13](#f-13--evidence-gap--cargo-denys-graph-omits-both-musl-wheel-targets)) |
| Fork exposure | The repository is public with forking enabled, and both PR-triggered workflows use `pull_request` (not `pull_request_target`) with `contents: read` and no secret reference. `NPM_TOKEN` is an **environment** secret on `release`, not a repository secret, so no PR-triggered job can reach it | **sound** |
| Package provenance | absent everywhere | [F-06](#f-06--new-risk--no-npm-provenance-and-a-long-lived-token-instead-of-trusted-publishing) |
| Artifact retention | both `upload-artifact` calls omit `retention-days` | [F-21](#f-21--new-risk--artifact-retention-is-unspecified) |

One pinning nuance, recorded rather than raised as a finding:
`dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # v1` pins a
real commit, which is what matters, but its comment is the moving `v1` tag, so
a reviewer cannot tell from the diff which release was adopted. The other eight distinct actions'
comments name concrete versions. `SECURITY.md:76-78` already states the correct
rule — the comment is a label, the SHA is the reference — so this is a
consistency note for the next pin refresh, not a control failure.

### Criterion 3 — lockstep, manifest, partial publication, and reconcile

Sound parts first, because the guard logic in `release.yml:45-90` is careful and
most of it was verified:

- **Private-package guard.** `release.yml:51-56` refuses to publish when
  `package.json` has `private === true`.
- **Prerelease-tag derivation.** `release.yml:58-66` maps any version containing
  `-` to the `beta` dist-tag and *refuses* any prerelease spelling other than
  `-beta.`, so `0.1.0-beta.1` publishes under `beta` and could not accidentally
  take `latest`.
- **Tag pre-existence guard.** `release.yml:69-72` refuses when `refs/tags/v$version`
  already exists, against a `fetch-depth: 0` checkout — so the guard sees every tag.
- **Unpublished-version guard, and it fails closed.** `release.yml:74-85` requires
  `npm view` to fail *with a recognizable 404* before publishing; anything else
  — a network error, an auth error, a registry outage — falls into
  "Could not prove that … is unpublished" and exits 1. This review verified
  the string the guard matches is the string npm actually emits, because the
  guard is worthless if it is not:

  ```console
  $ npm view "@omiologic/secret-scan@0.1.0-beta.1" version --json
  {
    "error": {
      "code": "E404",
      "summary": "Not Found - GET https://registry.npmjs.org/@omiologic%2fsecret-scan - Not found",
      ...
    }
  }
  ```

  `npm view` pretty-prints with a space after the key, and the guard's pattern
  is `*'"code": "E404"'*` — it matches. (npm 11.4.1 on the review host. The
  pattern is whitespace-sensitive and would silently become a permanent
  fail-closed if npm ever compacted this output; that is the safe direction, so
  it is recorded here rather than raised.) The response also establishes that
  the whole `@omiologic` scope is currently unpublished, consistent with
  `README.md:28-30` and `SECURITY.md:5-7`.
- **Re-run safety.** Because both the tag guard and the registry guard precede
  publication, re-running `Release` after a *successful* publish fails at
  validation rather than attempting a second publish.
- **Publish ordering.** Identity validation → `release:check` → publish →
  registry verification → tag. The tag is created only after the registry
  confirms the version, which is exactly the ordering
  `decision-release-bindings-in-lockstep` asks for, and `AGENTS.md` restates.
- **Mutual exclusion.** `release.yml:8-10` and `reconcile-release.yml:13-15`
  share `concurrency.group: npm-release` with `cancel-in-progress: false`, so a
  publish and a reconcile cannot interleave.
- **Python version lockstep is structural.** `bindings/python/pyproject.toml`
  declares `dynamic = ["version"]` and
  `scripts/check-python-package.py:131-136` *requires* it to stay dynamic and
  to pin no version of its own, so maturin reads the Cargo workspace version
  and the distribution cannot drift. This is the one artifact whose lockstep
  needs no comparison because it has no second source.
- **Rust lockstep is checked.** `scripts/check-rust-workspace.py:170-185`
  requires every workspace member's version to equal
  `[workspace.package] version`, and requires `package.json` and
  `bindings/node/package.json` to match it too.

The gaps are the manifest ([F-07](#f-07--stale-claim--the-release-manifest-the-adr-requires-does-not-exist)),
the reconcile window and its authorization
([F-04](#f-04--new-risk--no-automated-gate-enforces-release-approval-and-reconcile-has-none-at-all),
[F-08](#f-08--new-risk--reconcile-can-only-ever-reconcile-mains-tip)), the one
manifest left out of the lockstep list
([F-09](#f-09--new-risk--packagesjavascriptpackagejson-is-outside-version-lockstep)),
and the fact that "partial publication" across several registries cannot arise
yet because only one registry is wired
([F-03](#f-03--new-risk--three-of-the-four-promised-artifacts-have-no-publication-path)).

### Criterion 4 — documentation reconciliation

Checked: `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `CHANGELOG.md`,
`CONVENTIONS.md`, `conventions/*.md`, `docs/rust-workspace.md`,
`docs/python-packaging.md`, `docs/decisions/*`, both `package.json` manifests,
`bindings/node/package.json`, `bindings/python/pyproject.toml`,
`crates/*/Cargo.toml`, and both `README.md` files under `packages/javascript`
and `crates/secret-scan-cli`.

Sound and worth recording:

- **Release-authority wording is consistent everywhere it appears.**
  `README.md:28-30,366-369`, `ARCHITECTURE.md:382-384`, `SECURITY.md:5-7`,
  `CHANGELOG.md:3-4`, all four ADRs' consequences sections,
  `docs/python-packaging.md:244-245`, and `AGENTS.md`'s "Release authority"
  section all say the same thing in the same direction: no document, version
  value, readiness check, or decision record authorizes a version, tag,
  publication, deployment, or archive. The three existing audit documents each
  repeat "It records evidence only; it does not authorize any release
  operation." This review found **no** document that overstates authority.
- **`CHANGELOG.md` is version-neutral.** One `Unreleased` section, no version
  heading, no date — matching its own preamble and `README.md:369`.
- **`docs/decisions/` is the single ADR location,** with `scope: workspace`,
  indexed by `DECISIONS.md`, validated by `npm run decisions:validate` inside
  `npm run ci`, and there is no competing `_notes/decisions`, exactly as
  `AGENTS.md:9-11` requires.
- **Package metadata agrees across manifests** on name, license, repository,
  homepage, bugs, keywords, `type: module`, `sideEffects: false`,
  `engines.node`, and the three-subpath `exports` map. The Rust side inherits
  `license`, `repository`, `homepage`, `authors`, `version`, `edition`, and
  `rust-version` from `[workspace.package]`, so they cannot drift per crate.
- **`docs/python-packaging.md` and `docs/rust-workspace.md` are accurate**
  against the manifests and scripts they describe, including the
  `0.1.0-beta.1` → `0.1.0b1` PyPI normalization and the registry-name fallback
  (`python-distribution = "omiologic-secret-scan"` because the product name is
  taken on PyPI) that `decision-release-bindings-in-lockstep` explicitly allows.
- **The migration status section is honest.** `README.md:15-33` states plainly
  that `src/` is still the oracle and root npm package and that
  `packages/javascript` is the replacement. The documentation does not pretend
  the cutover has happened. What is missing is any statement that the *release
  automation* still points at the oracle
  ([F-01](#f-01--new-risk--the-release-workflow-publishes-the-typescript-oracle-under-the-product-name)).

The documentation findings are
[F-12](#f-12--stale-claim--the-shipped-readmes-quick-start-cannot-run-against-the-package-it-ships-in),
[F-18](#f-18--stale-claim--the-wheel-workflows-workflow_call-is-documented-as-reused-and-nothing-calls-it),
[F-19](#f-19--stale-claim--four-shipped-links-point-into-a-gitignored-directory-and-no-feature-note-covers-this-area),
and
[F-22](#f-22--stale-claim--securitymds-supply-chain-section-describes-only-the-ci-half).

## Findings

### F-01 · `new-risk` · The Release workflow publishes the TypeScript oracle under the product name

**Severity: blocking.** Area: release automation.

`package.json:22-29` ships `dist`, and `tsconfig.json` compiles
`rootDir: "src"` into `outDir: "dist"`. `src/` is the temporary TypeScript
oracle — `README.md:22-26` says so explicitly, and `README.md:353` lists
`src/ and test/          temporary TypeScript oracle` in the repository layout.
`release.yml:95-98` publishes that tarball as `@omiologic/secret-scan`.

What the tarball contains, at the assessed revision:

```console
$ npm pack --dry-run
...
npm notice 19.3kB ARCHITECTURE.md
npm notice 10.0kB CHANGELOG.md
npm notice 1.1kB LICENSE
npm notice 15.0kB README.md
npm notice 4.8kB SECURITY.md
npm notice 2.8kB package.json
npm notice name: @omiologic/secret-scan
npm notice version: 0.1.0-beta.1
npm notice total files: 106
```

```console
$ grep -rl 'napi\|wasm\|#native' dist/
(no output)
```

There is no N-API addon, no WebAssembly module, and no Rust in the artifact.
Every detector in it is a TypeScript reimplementation. Three consequences
compound:

1. **It publishes the thing the architecture excludes.**
   `ARCHITECTURE.md:391` lists under *Deliberate exclusions*: "a
   pure-Python, TypeScript, or Go detector fallback". Publishing `dist/` under
   the product name makes the excluded implementation the product.
2. **It is the wrong package for the name.** `packages/javascript/package.json:2`
   also declares `name: "@omiologic/secret-scan"`, and
   `packages/javascript/README.md:14` tells a consumer `npm install
   @omiologic/secret-scan`. Two packages claim one name; the one the release
   workflow can reach is the one that is supposed to be deleted. #64's F-11
   recorded the shared *version*; the collision is wider than that — name,
   documented API, and publication target.
3. **Its public surface is larger and different.** `dist/index.d.ts` exports
   `createDetectorRegistry`, `builtInDetectors`, and 22 individual detector
   objects. `packages/javascript` exports `initialize` and no detector
   registry. A consumer who adopted the published surface would be broken by
   the cutover on every one of those names.

**Exit condition.** Either `Release` is repointed at the artifact the
architecture describes — which requires
[F-03](#f-03--new-risk--three-of-the-four-promised-artifacts-have-no-publication-path)
and #64's F-01/F-03 first — or `Release` is made unable to publish the oracle
(for example by a guard step that fails when the packed tarball contains no
native or WebAssembly entry point), and `README.md`'s migration section states
in one sentence that no release automation currently targets a shippable
artifact.

### F-02 · `new-risk` · `release:check` qualifies only the JavaScript half of the product

**Severity: blocking.** Area: release automation.

`release.yml:92-93` is the only qualification gate between identity validation
and publication:

```yaml
      - name: Qualify release
        run: npm run release:check
```

And `package.json:52,56`:

```json
    "ci": "npm run decisions:validate && npm run python:check && npm run typecheck && npm test && npm run js:typecheck && npm run js:test",
    "release:check": "npm run ci && npm pack --dry-run",
```

Expanding it, the release gate runs: ADR validation, the Python *packaging
contract* check, two TypeScript typechecks, the root vitest suite, and the
`packages/javascript` vitest suite. It does **not** run:

| Required by | Not run by `release:check` |
|---|---|
| `ci.yml:70-91` (`rust-policy`) | `cargo fmt --check`, `cargo clippy -D warnings`, `npm run rust:check`, `cargo doc -D warnings`, `cargo package -p secret-scan`, `cargo deny check` |
| `ci.yml:120-131` (`rust-native`) | `cargo test --workspace --locked`, the CLI version smoke |
| `ci.yml:153-154` (`rust-msrv`) | `cargo check` on the MSRV toolchain |
| `ci.yml:177-190` (`rust-wasm`) | the wasm32 check and the `wasm-bindgen-test` suite |
| `python-wheels.yml` | every wheel build, every wheel smoke test, the sdist, and `qualify-matrix` |

Note what this means concretely: `npm run rust:check` is the script that
enforces version lockstep, the core's pinned public API, the core's package
contents, the dependency boundary, and the MSRV agreement — and the release
gate does not call it. Neither does it call `cargo deny`, so the advisory,
license, and source checks are absent from the publication path.

The gate is also strictly narrower than the pull-request gate: `ci.yml` runs
five jobs, `release:check` covers part of one. A publication therefore carries
*less* verification than the merge that produced it.

Three governing documents require the opposite.
`docs/decisions/2026-09-09-release-bindings-in-lockstep.md:13-15`: "A release
candidate builds and qualifies every required artifact from the same commit
before registry publication begins." `ARCHITECTURE.md:374-376`: "A release
candidate must pass the shared conformance contract plus all surface-specific
build, test, type, package-content, platform, and smoke checks without
publishing." `README.md:356-358`: "Release qualification must build and test the
Rust crate, npm package, Python package, and CLI from the same commit without
publishing."

**Exit condition.** `Release` gains a dependency on the full qualification set
from the same commit — at minimum the four `ci.yml` Rust jobs and a
`workflow_call` into `python-wheels.yml` (which
[F-18](#f-18--stale-claim--the-wheel-workflows-workflow_call-is-documented-as-reused-and-nothing-calls-it)
shows already exposes that entry point) — with publication reachable only when
all of them succeed; or `release:check` is redefined to invoke them and the
workflow is shown failing when any one fails.

### F-03 · `new-risk` · Three of the four promised artifacts have no publication path

**Severity: blocking.** Area: release automation.

`decision-release-bindings-in-lockstep` and `ARCHITECTURE.md:370-372` name four
artifacts of one product: "The Rust crate, npm package, Python package, and CLI
are one product with one SemVer version and one `v{version}` Git tag."
`README.md:356-358` repeats it.

The automation publishes one of them, and for the crate the manifest forbids
publication outright:

```toml
# Cargo.toml:28, inherited by every member via `publish.workspace = true`
publish = false
```

`crates/secret-scan-core/Cargo.toml:23` and
`crates/secret-scan-cli/Cargo.toml:12` both say `publish.workspace = true`, so
both inherit `false`; `bindings/python/Cargo.toml:12` sets `publish = false`
directly. `ci.yml:84-85` runs `cargo package -p secret-scan --locked`, which
proves the crate *builds* as a package — but `cargo publish` would refuse it.

| Artifact | Publication path | Registry |
|---|---|---|
| npm package | `release.yml` | npmjs.org — and it publishes the oracle ([F-01](#f-01--new-risk--the-release-workflow-publishes-the-typescript-oracle-under-the-product-name)) |
| Rust crate | none; `publish = false` | — |
| Python package | none — `python-wheels.yml` builds and qualifies, then uploads artifacts and stops | — |
| CLI | none; no platform list, no binary build, no archive job | — |

`package-release-rehearsal.yml` is explicitly a no-publication rehearsal
("Synthetic package release …; npm publication and Git tagging are disabled"),
so it does not close this.

This also explains why the ADR's partial-publication requirement cannot be
exercised today: partial publication across registries presupposes more than
one registry. The reconcile workflow handles exactly one failure mode —
"published to npm, tag missing" — which is a subset of what the ADR describes.

**Exit condition.** Either each promised artifact gains a publication path
gated on the same qualification (the crate needs `publish` lifted for the two
publishable crates; the CLI needs a declared platform list and a build job; the
wheels need a PyPI step), or `ARCHITECTURE.md`, `README.md`, and the ADR are
amended to state which artifacts the first release actually ships and to record
the rest as deferred — and `README.md:28-30`'s list of channels ("npm, PyPI,
crates.io, or binary distribution channels") is narrowed to match.

### F-04 · `new-risk` · No automated gate enforces release approval, and reconcile has none at all

**Severity: blocking.** Area: operational controls.

`AGENTS.md`'s "Release authority" section, `README.md:366-369`, and
`ARCHITECTURE.md:382-384` all require explicit approval before a publication,
a tag, or a reconcile. In automation, nothing enforces it. Read-only API
state at the assessed revision:

```console
$ gh api repos/omiologic/secret-scan/environments/release \
    --jq '{name, protection_rules, deployment_branch_policy}'
{"deployment_branch_policy":null,"name":"release","protection_rules":[]}

$ gh api repos/omiologic/secret-scan/branches/main/protection
{"message":"Branch not protected", ... "status":"404"}

$ gh api repos/omiologic/secret-scan/environments/release/secrets --jq '.secrets[].name'
NPM_TOKEN
```

So:

- **The `release` environment gates nothing.** `protection_rules: []` means no
  required reviewers and no wait timer; `deployment_branch_policy: null` means
  no branch restriction. `environment: name: release` in `release.yml:16-17`
  does do one useful thing — it scopes `NPM_TOKEN` so no other workflow can
  read it, which is why it appears under "found sound" in Criterion 2 — but it
  is not an approval gate, and it is the only thing in the tree that looks like
  one.
- **"Must run from main" is not a review gate.** `release.yml:22-26` checks
  `github.ref != 'refs/heads/main'`. With `main` unprotected, any actor with
  write access can push directly to `main` and dispatch, so the check
  establishes the ref, not review.
- **Reconcile has strictly weaker authorization than publish.**
  `reconcile-release.yml` declares **no `environment:` at all**, yet takes
  `contents: write` (`:20-21`) and creates an annotated tag and a ref
  (`:65-69`). `AGENTS.md` says "Use `Reconcile Release` only with explicit
  authorization to repair a matching published version"; the workflow's only
  automated precondition is `github.ref == refs/heads/main` plus a version
  string that matches `package.json`. Its ref guard is also silent —
  `run: exit 1` with no message (`:23-25`), unlike `release.yml:22-26` — so a
  refusal is hard to read in the log.

Reconcile does fail closed on the substance: it refuses unless npm reports both
the version and a `gitHead` equal to `GITHUB_SHA` (`:46-51`), and refuses when
an existing tag disagrees or is lightweight (`:54-60`). That verification is
sound. The gap is that nothing requires a human to authorize reaching it.

One minor related item, recorded here rather than as its own finding:
`reconcile-release.yml:39-40` calls `node -p` without any `setup-node` step,
so it depends on whatever Node the `ubuntu-latest` image ships, while
`release.yml:34-37` pins Node 22 for the same computation.

**Exit condition.** The `release` environment carries required reviewers (and,
ideally, a `main`-only deployment branch policy); `main` is branch-protected
so "from main" implies review; and `Reconcile Release` declares an environment
with at least the same protection as `Release`, since it mutates refs. Evidence
is the three API reads above returning non-empty protection.

### F-05 · `evidence-gap` · The Node native matrix has no CI evidence

**Severity: blocking.** Area: platform matrix.

`bindings/node/package.json` declares six N-API targets:

```json
  "napi": {
    "binaryName": "secret-scan",
    "targets": [
      "x86_64-unknown-linux-gnu", "aarch64-unknown-linux-gnu",
      "x86_64-apple-darwin",      "aarch64-apple-darwin",
      "x86_64-pc-windows-msvc",   "aarch64-pc-windows-msvc"
    ]
  },
```

No workflow builds any of them:

```console
$ grep -rn 'napi\|smoke-test\|packages/javascript' .github/workflows/
.github/workflows/python-wheels.yml:7:  # Every wheel is smoke-tested on the architecture it was built for, ...
.github/workflows/python-wheels.yml:157: #   interpreter this target can be smoke-tested on. ...
```

Neither `napi build` (`bindings/node/package.json` `scripts.build`) nor
`bindings/node/smoke-test.mjs` (`scripts.smoke`) is invoked by any workflow.
What CI does cover is `cargo test --workspace --locked` on three runners —
`ubuntu-latest`, `macos-latest`, `windows-latest` — which exercise the binding
crate's Rust on `x86_64-unknown-linux-gnu`, `aarch64-apple-darwin`, and
`x86_64-pc-windows-msvc`. The other three declared targets
(`aarch64-unknown-linux-gnu`, `x86_64-apple-darwin`,
`aarch64-pc-windows-msvc`) are never compiled for, let alone loaded into Node.
`python-wheels.yml` does run on `ubuntu-24.04-arm`, `macos-15-intel`, and
`windows-11-arm`, which proves runners for all three exist — they are simply
not used for the Node binding.

And `npm run js:test`, which does run in `ci.yml`, cannot substitute: #64's
F-06 established that both of its test doubles
(`packages/javascript/test/fake-binding.ts`,
`packages/javascript/test/sanitizing-binding.ts`) implement the binding shape
in TypeScript. No test in the repository loads a real `.node` addon.

The contrast with Python is the point. `scripts/check-python-package.py`
*requires* `python-wheel-targets` and the workflow matrix to be equal, and the
workflow builds and smoke-tests every one. For the Node targets there is
neither a build nor a cross-check: the six-entry list can be edited, reordered,
or emptied and `npm run ci` still reports success.

**Exit condition.** A workflow builds the addon for each declared target and
runs `bindings/node/smoke-test.mjs` against the built artifact on each
architecture that has a runner (documenting any target that has none as
cross-compiled-only), and a check in the style of
`check-python-package.py:270-290` pins `napi.targets` to that matrix so a
target cannot silently leave either list.

### F-06 · `new-risk` · No npm provenance, and a long-lived token instead of trusted publishing

**Severity: medium.** Area: supply chain.

`release.yml` publishes with a stored credential and produces no attestation:

```yaml
# release.yml:18-19 — the only permissions the publish job takes
    permissions:
      contents: write
# release.yml:95-98
      - name: Release package
        run: npm run release -- --tag "${{ steps.release.outputs.npm_tag }}"
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

`package.json:57` is `"release": "npm publish --access public"`. There is no
`id-token: write` permission, no `--provenance` flag, and no
`publishConfig.provenance` in either manifest:

```console
$ grep -rn 'provenance\|id-token\|attest' .github/workflows/ package.json packages/javascript/package.json
(no output)
```

Two things follow. The published tarball carries no provenance attestation, so
a consumer cannot verify from npm which repository, workflow, and commit built
it — for a security library whose own `SECURITY.md` has a supply-chain section,
that is the attestation most worth having. And authentication uses a long-lived
`NPM_TOKEN` rather than npm's OIDC trusted publishing, so the failure mode is a
stealable credential instead of a short-lived, workflow-scoped exchange. The
token is at least correctly scoped to the `release` environment, so no other
workflow can read it (Criterion 2).

This is distinct from [F-04](#f-04--new-risk--no-automated-gate-enforces-release-approval-and-reconcile-has-none-at-all):
F-04 is about who may start a publication, this is about what the publication
proves afterwards.

**Exit condition.** The publish job adds `id-token: write` and publishes with
`--provenance` (or `publishConfig.provenance: true`) under npm trusted
publishing, and the first qualified publication is shown to carry a verifiable
provenance statement. If trusted publishing is deliberately deferred, the
deferral is recorded with its reason alongside the release process
documentation.

### F-07 · `stale-claim` · The release manifest the ADR requires does not exist

**Severity: medium.** Area: release automation.

`docs/decisions/2026-09-09-release-bindings-in-lockstep.md:17-19`:

> The release process records a manifest containing the source commit,
> conformance revision, product version, required artifacts, and the observed
> publication state of each registry.

`ARCHITECTURE.md:376-377` restates it: "The release process records the source
commit, conformance revision, version, required artifacts, and observed
registry state." The ADR's *Rationale* explains why it matters: "A release
manifest makes partial registry success visible and repairable instead of
pretending that one tag makes multiple publications atomic."

No workflow writes one. `release.yml` computes four values into
`$GITHUB_OUTPUT` (`:87-90`) — package name, version, npm tag, tag name — which
live only for the duration of the job; it writes no file, uploads no artifact,
and appends nothing to `$GITHUB_STEP_SUMMARY`. Of the five required fields,
*version* is computed, *observed registry state* is checked but not recorded,
and *source commit*, *conformance revision*, and *required artifacts* are never
assembled at all. After a run, the only durable record is the npm packument and
the Git tag.

This is the recording mechanism that the repair path in
[F-08](#f-08--new-risk--reconcile-can-only-ever-reconcile-mains-tip) needs and
does not have: reconcile has to re-derive what was published from the registry,
because nothing wrote down what a release was supposed to consist of.

**Exit condition.** The release workflow emits a manifest artifact (or an
equivalent durable record) carrying all five fields for every run, including
failed runs, and reconcile consumes it instead of re-deriving state from the
registry.

### F-08 · `new-risk` · Reconcile can only ever reconcile `main`'s tip

**Severity: medium.** Area: release automation.

`reconcile-release.yml` forces the ref to `main` and then compares the
publication against that ref's commit:

```yaml
# :23-25
      - name: Require main
        if: github.ref != 'refs/heads/main'
        run: exit 1
# :46-51
          published_version=$(npm view "$package_name@$package_version" version 2>/dev/null || true)
          published_sha=$(npm view "$package_name@$package_version" gitHead 2>/dev/null || true)
          if [[ "$published_version" != "$package_version" || "$published_sha" != "$GITHUB_SHA" ]]; then
            echo "npm publication does not match the selected main commit." >&2
            exit 1
          fi
```

`GITHUB_SHA` here is `main`'s tip. The repair window is therefore open only
while `main` still points at the published commit. One merge — including the
merge of a fix for whatever broke the release — closes it permanently:
`published_sha` is the old commit, `GITHUB_SHA` is the new tip, the comparison
fails, and the workflow exits 1. Because `release.yml:69-72` also refuses any
version whose tag already exists and `:74-85` refuses any version already
published, a release that dies between publish and tag leaves that version
with **no** automated path to a tag once `main` moves.

This is the scenario the control exists for: `release.yml` publishes at `:95`,
verifies at `:100-111`, and tags at `:113-132`, so a failure in the verify or
tag step is exactly "published, untagged". The design assumes reconcile runs
before `main` advances, and nothing enforces or documents that ordering.

A second, independent dependency: the comparison rests on npm having recorded
`gitHead` in the packument. The checkout uses `fetch-depth: 0` and leaves
`.git` in place, so npm should record it, but this review could not verify it
without publishing — and if `gitHead` is ever absent, `npm view` prints nothing,
`published_sha` is empty, the comparison fails, and reconcile is unusable.
That direction is fail-closed, which is correct; it is recorded as an
unverified dependency rather than a defect.

**Exit condition.** Reconcile accepts the published commit as an input (or
reads it from the manifest in
[F-07](#f-07--stale-claim--the-release-manifest-the-adr-requires-does-not-exist)),
verifies that commit is an ancestor of `main` rather than equal to its tip, and
tags that commit; and its documentation states the repair window explicitly.
A deterministic test of the guard logic against recorded fixtures would also
close the `gitHead` dependency without publishing.

### F-09 · `new-risk` · `packages/javascript/package.json` is outside version lockstep

**Severity: medium.** Area: lockstep.

`scripts/check-rust-workspace.py:54` declares the lockstep set:

```python
LOCKSTEP_MANIFESTS = ("package.json", "bindings/node/package.json")
```

`packages/javascript/package.json` is not in it — which is the manifest of the
package that is meant to *become* the product. Probe (reversible; the file was
restored immediately and `git status` is clean at the assessed revision):

```console
$ # set packages/javascript/package.json version to 9.9.9-probe.0
$ grep -n '"version"' packages/javascript/package.json
54:  "version": "9.9.9-probe.0"

$ python3 -B scripts/check-rust-workspace.py | tail -1
Rust workspace check complete: 0 error(s)

$ python3 -B scripts/check-python-package.py | tail -1
Python package check complete: 0 error(s)

$ # restored
$ grep -n '"version"' packages/javascript/package.json
54:  "version": "0.1.0-beta.1"
```

Both lockstep-enforcing scripts pass while the replacement JavaScript package
claims a completely different major version. The two values happen to agree
today (`0.1.0-beta.1` in both), so this is a latent gap, not a live drift — but
it is the one artifact whose version nothing checks, and
`decision-release-bindings-in-lockstep` requires one version across the
product. #64's F-11 raised the opposite problem (the two manifests *share* a
version while both claim one name); together they say the same thing: this
manifest pair needs a deliberate rule, and right now it has none.

**Exit condition.** `LOCKSTEP_MANIFESTS` includes
`packages/javascript/package.json`, with a unit test in
`scripts/tests/test_check_rust_workspace.py` that fails on drift — or the
cutover removes one of the two manifests and the decision is recorded.

### F-10 · `stale-claim` · The browser surface is documented as supported and never executed in a browser

**Severity: medium.** Area: platform matrix.

`README.md:62` lists "JavaScript in browsers | `wasm-bindgen` WebAssembly";
`README.md:77-79` says the package "presents one typed API across Node.js and
modern browsers"; `ARCHITECTURE.md:195` lists "Browser JavaScript … Loads the
WebAssembly module". The only test of that surface runs outside a browser, by
explicit configuration:

```yaml
# ci.yml:186-190
      - name: Test the browser binding for wasm32 (via Node, no browser needed)
        env:
          CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUNNER: wasm-bindgen-test-runner
          WASM_BINDGEN_TEST_ONLY_NODE: "1"
        run: cargo test -p secret-scan-wasm --target wasm32-unknown-unknown --locked
```

No workflow starts a browser engine — there is no headless-browser step and no
`playwright`/`karma`-style runner anywhere in `.github/workflows/`. The step's
own name is candid about it ("no browser needed"), and for the binding *crate*
that is a reasonable, cheap choice. The stale claim is at the package level:
nothing in CI exercises the path a browser consumer takes, which is
`packages/javascript` resolving its `#native` import to
`dist/runtime/browser.js` and loading the WebAssembly module.

This is also the mechanism behind #64's blocking findings. F-01 there —
`browser.ts` requiring a `createIncrementalSanitizer` export that
`bindings/wasm` does not provide, so every browser `await initialize()`
rejects — and F-02 — callback findings with `undefined` offsets under
WebAssembly — are precisely the defects a browser-path job would have caught.
They reached `main` because no such job exists. That makes this finding the CI
half of an already-confirmed product defect, rather than a hypothetical.

**Exit condition.** Either a CI job loads `packages/javascript`'s browser entry
point in a real (headless) browser engine and runs at least the initialization
and whole-input conformance paths against it, or `README.md` and
`ARCHITECTURE.md` state that browser support is unqualified until such a job
exists.

### F-11 · `new-risk` · The wheel build's own tools are unpinned while every action is SHA-pinned

**Severity: medium.** Area: supply chain.

Every one of the twenty-nine `uses:` lines in the repository is a 40-character SHA (Criterion 2), and
`SECURITY.md:76-78` makes that the stated policy. Inside the wheel build, three
of the components that actually compile and link the artifact are not pinned at
all:

```yaml
# python-wheels.yml:168-174
      - name: Build the wheel
        uses: PyO3/maturin-action@e83996d129638aa358a18fbd1dfb82f0b0fb5d3b # v1.51.0
        with:
          target: ${{ matrix.target }}
          manylinux: ${{ matrix.manylinux }}
          args: --release --out dist -m bindings/python/Cargo.toml
          sccache: "true"
```

Read from that action's own `action.yml` at the exact SHA the workflow pins:

```console
$ gh api "repos/PyO3/maturin-action/contents/action.yml?ref=e83996d129638aa358a18fbd1dfb82f0b0fb5d3b" \
    --jq .content | base64 -d | grep -A3 'maturin-version\|  container\|  sccache'
  maturin-version:
    description: Version of maturin to install like "v0.12.0".
    required: false
  container:
    description: Docker container image name. Default depends on "target" and "manylinux" options.
    required: false
  sccache:
    description: Enable sccache for faster builds.
    required: false
    default: 'false'
```

- **`maturin-version` is unset and has no default**, so the action resolves a
  maturin release at run time. The build tool that produces the wheel is the
  one input most worth pinning, and it floats.
- **`container` is unset**, so the action selects a manylinux / musllinux image
  from `target` and `manylinux: auto | musllinux_1_2`. The compiler and sysroot
  that link the shipped `.so` come from an image chosen by floating tag.
- **`sccache: "true"`** adds a compiler-cache binary the action fetches itself.

The same workflow shows that the repository knows how to do this: `ci.yml:184`
pins `cargo install wasm-bindgen-cli --version 0.2.128 --locked`. Two wheel
jobs also shell out to `docker run --rm … "python:${version}-alpine"`
(`python-wheels.yml:211`), a floating image tag — lower risk, since that
container only *tests* the wheel, but it is the same pattern.

The practical exposure is bounded by what the wheel contains: the core crate
has an empty dependency allowlist, and every wheel is smoke-tested and run
against the shared conformance corpus on its own architecture before
`qualify-matrix` accepts it. So a bad toolchain is likely to be *caught*. It is
not *prevented*, and the build is not reproducible.

**Exit condition.** `maturin-version` is pinned, `container` is pinned to a
digest (or the floating default is accepted in writing with its reason), and
either `sccache` is pinned or disabled for release builds — with the pinned
values added to `SECURITY.md`'s monthly pin-review list.

### F-12 · `stale-claim` · The shipped README's quick start cannot run against the package it ships in

**Severity: medium.** Area: documentation.

`package.json:22-29` ships `README.md` inside the tarball, and
`npm pack --dry-run` confirms `15.0kB README.md` in the 106-file artifact. That
README's first code block (`README.md:81-91`) is:

```ts
import { initialize, scanAndRedact } from "@omiologic/secret-scan";

await initialize();
```

The package published under that name exports no `initialize`:

```console
$ grep -rn 'initialize' src/
(no output)
```

So the first example in the shipped documentation fails at import. The same
README goes on to document a Python API (`README.md:180-197`) and a CLI
(`README.md:277-282`), neither of which is in the tarball or published
anywhere — defensible for a monorepo README, but it is the file npm shows on
the package page.

The guard that exists cannot catch this. `test/readme-examples.test.ts` is
named for the README but imports the source tree and silently drops the line
under test:

```ts
import { scanAndRedact, typedPlaceholderFormatter } from "../src/index.js";
```

It asserts the quick-start output (which is correct) while omitting
`await initialize()` entirely, and it asserts a second, typed-placeholder
example — `"api_key=<CONTEXTUAL_SECRET_1>"` — that the current README does not
contain:

```console
$ grep -n 'CONTEXTUAL_SECRET' README.md
(no output)
```

So the test both misses a broken example and pins an example that was removed.
`packages/javascript/test/readme-examples.test.ts` takes the stronger approach
for its own README (extracting blocks and typechecking them in a temporary
project); the root test does not.

**Exit condition.** The shipped README's examples are executable against the
package that ships them — either by the cutover in
[F-01](#f-01--new-risk--the-release-workflow-publishes-the-typescript-oracle-under-the-product-name),
or by the root README stating which surface each example targets — and
`test/readme-examples.test.ts` extracts its examples from `README.md` rather
than restating them, so a drift in either direction fails.

### F-13 · `evidence-gap` · `cargo-deny`'s graph omits both musl wheel targets

**Severity: low.** Area: supply chain.

`deny.toml:8-16` declares seven targets. `Cargo.toml:173-182` declares eight
wheel targets. The two sets do not agree:

| Declared in `python-wheel-targets` | In `deny.toml` `[graph] targets`? |
|---|---|
| `x86_64-unknown-linux-gnu` | yes |
| `aarch64-unknown-linux-gnu` | yes |
| `x86_64-apple-darwin`, `aarch64-apple-darwin` | yes |
| `x86_64-pc-windows-msvc`, `aarch64-pc-windows-msvc` | yes |
| **`x86_64-unknown-linux-musl`** | **no** |
| **`aarch64-unknown-linux-musl`** | **no** |

`deny.toml` adds `wasm32-unknown-unknown` (correct — the browser binding needs
it) but never the musl triples. `cargo deny check` therefore evaluates
advisories, licenses, bans, and sources for a graph that excludes two of the
eight platforms the repository commits to shipping wheels for, and
`python-wheels.yml` builds and qualifies `musllinux_1_2` wheels for both.

The practical risk is small: the core's allowlist is empty, so its graph is
empty, and the difference between a musl and a glibc resolution would have to
arise in the binding crates' target-specific dependencies. But the check's
scope is narrower than the shipping commitment, and nothing flags the
divergence — unlike the wheel matrix itself, which
`scripts/check-python-package.py` pins to the workflow.

**Exit condition.** `deny.toml`'s target list covers every triple in
`python-wheel-targets` plus `wasm32-unknown-unknown`, and
`scripts/check-rust-workspace.py` (or `check-python-package.py`) fails when a
declared wheel target is absent from the `cargo-deny` graph.

### F-14 · `evidence-gap` · Nothing binds the `wasm-bindgen-cli` version to the crate version

**Severity: low.** Area: CI.

`ci.yml:180-184` states the constraint and then relies on a comment to hold it:

```yaml
      - name: Install wasm-bindgen-cli
        # Must match the `wasm-bindgen` version in Cargo.toml exactly: the
        # test runner refuses to run a Wasm binary built against a different
        # `wasm-bindgen` version than its own.
        run: cargo install wasm-bindgen-cli --version 0.2.128 --locked
```

`Cargo.toml:39` is `wasm-bindgen = "0.2.128"`. Two literals, in two files,
that the comment says must be identical — and no check reads both:

```console
$ grep -rn 'wasm-bindgen' scripts/*.py
(no output)
```

The repository already has exactly this cross-check for the MSRV:
`scripts/check-rust-workspace.py:50-51,222-228` reads `ci.yml`, requires
exactly one `MSRV:` line, and requires it to equal the declared
`rust-version`. The `wasm-bindgen` pair has the same shape and no enforcement,
so a `Cargo.toml` bump that forgets `ci.yml` produces a confusing
runner-refuses-binary failure instead of a named one. Note also that
`wasm-bindgen` is a caret requirement (`"0.2.128"`), so `cargo update` can move
the resolved crate to `0.2.129` while the workflow still installs the `0.2.128`
CLI.

**Exit condition.** `check-rust-workspace.py` reads the
`cargo install wasm-bindgen-cli --version <v>` literal from `ci.yml` and fails
when it differs from the resolved `wasm-bindgen` version, with a unit test
covering the mismatch.

### F-15 · `new-risk` · Repository controls do not require what the workflows practice

**Severity: low.** Area: operational controls.

The workflows are disciplined; the repository does not require that discipline
of the next workflow. Read-only state:

```console
$ gh api repos/omiologic/secret-scan/actions/permissions
{"enabled":true,"allowed_actions":"all","sha_pinning_required":false}

$ gh api repos/omiologic/secret-scan --jq '{visibility,allow_forking,default_branch}'
{"allow_forking":true,"default_branch":"main","visibility":"public"}

$ gh api repos/omiologic/secret-scan/branches/main/protection
{"message":"Branch not protected", ... "status":"404"}
```

- **`sha_pinning_required: false`.** All twenty-nine `uses:` lines are SHA-pinned by
  convention and `SECURITY.md:76-78` states the rule, but GitHub would accept a
  floating tag in a new workflow without complaint. The control is documented,
  not enforced.
- **`allowed_actions: "all"`.** Any action from any publisher may run. For a
  repository whose `SECURITY.md` has a supply-chain section, an allowlist (or
  "verified creators plus these") is the matching setting.
- **`main` unprotected.** Already counted in
  [F-04](#f-04--new-risk--no-automated-gate-enforces-release-approval-and-reconcile-has-none-at-all)
  as the reason "from main" is not review; it is also what lets an unreviewed
  `.github/workflows/` change reach the branch that `Release` and
  `Reconcile Release` both trust.
- **Public with forking enabled** is fine here and is recorded as sound in
  Criterion 2: both PR-triggered workflows use `pull_request` rather than
  `pull_request_target`, take only `contents: read`, and reference no secret,
  and `NPM_TOKEN` is environment-scoped. This line exists so #66 can see the
  exposure was checked, not flagged.

**Exit condition.** `sha_pinning_required: true`, `allowed_actions` narrowed to
an allowlist covering the nine actions in use, and `main` protected with
required reviews and required status checks — verified by the same three API
reads.

### F-16 · `new-risk` · No job timeout in CI, and `-D warnings` applies to a third-party `cargo install`

**Severity: low.** Area: CI.

Two separate brittleness items in the same file.

**No timeouts.** `ci.yml` sets `timeout-minutes` on none of its five jobs, so
each inherits the 6-hour default. `python-wheels.yml` sets 30 minutes on its
`sdist` and `wheels` jobs and `package-release-rehearsal.yml` sets 5, so the
convention exists and `ci.yml` is the outlier. The job most able to hang is
`rust-wasm`, which compiles `wasm-bindgen-cli` from source. Issue #65's own
verification clause is about not dispatching jobs that may exceed five
minutes — a bound on the jobs themselves belongs to the same concern.

**Deny-warnings reaches a third-party build.** `ci.yml:16` sets
`RUSTFLAGS: -D warnings` at workflow level, so it applies to every `cargo`
invocation in every job — including `ci.yml:184`:

```yaml
        run: cargo install wasm-bindgen-cli --version 0.2.128 --locked
```

`wasm-bindgen-cli` and its dependency tree are then compiled with warnings
denied. A new lint in a future stable rustc that fires anywhere in that tree
breaks `rust-wasm` for a reason unrelated to this repository's code, on a
toolchain line (`toolchain: stable`) that moves on its own. `-D warnings` is
the right policy for workspace code; applying it to a vendored tool build is
accidental.

**Exit condition.** Every `ci.yml` job declares a `timeout-minutes` consistent
with its measured duration, and the `cargo install` step either clears
`RUSTFLAGS` for itself (`env: RUSTFLAGS: ""`) or the flag moves from the
workflow level onto the steps that build workspace code.

### F-17 · `evidence-gap` · Advisory review is manual and unscheduled

**Severity: low.** Area: supply chain.

`SECURITY.md:89-90` prescribes a recurring review:

> At least monthly, and promptly after an upstream action or dependency
> security notice, review the pinned action releases and lockfile.

Nothing automates or reminds. There is no `schedule:` trigger in any workflow
and no dependency-update configuration at all:

```console
$ ls .github/
workflows/

$ grep -rn 'schedule:' .github/workflows/
(no output)
```

So `cargo deny check` (advisories included) and the implicit `npm` integrity
check run only on `pull_request` and on `push` to `main`. A new advisory filed
against an unchanged dependency is invisible until the next pull request
touches the repository — which, for a repository between releases, can be a
long time. And with no `dependabot.yml`, the nine pinned action SHAs and the
lockfile receive no automated update proposals, so the monthly review is
entirely manual with no artifact recording that it happened.

Today's posture is clean (`npm audit --package-lock-only` → `found 0
vulnerabilities`, zero runtime dependencies), which is why this is low: the
gap is in detection latency, not in a known exposure.

**Exit condition.** A scheduled workflow runs `cargo deny check advisories` and
`npm audit --package-lock-only` on a cadence at least as frequent as
`SECURITY.md` claims, and a `.github/dependabot.yml` covers `github-actions`,
`npm`, and `cargo` — or `SECURITY.md`'s cadence is rewritten to describe a
process that actually exists.

### F-18 · `stale-claim` · The wheel workflow's `workflow_call` is documented as reused, and nothing calls it

**Severity: low.** Area: release automation.

`docs/python-packaging.md:241-242`:

> It also exposes `workflow_call`, so release qualification can reuse it
> without restating the matrix.

`python-wheels.yml:33` does expose it. No workflow calls it:

```console
$ grep -rn 'workflow_call\|uses: ./.github/workflows' .github/workflows/
.github/workflows/python-wheels.yml:33:  workflow_call:
```

The entry point is real and unused, and the consumer the sentence describes —
release qualification — is precisely what
[F-02](#f-02--new-risk--releasecheck-qualifies-only-the-javascript-half-of-the-product)
shows is missing. The claim reads as a description of current behavior and
describes an intention. That it exists is convenient: closing F-02 for the
Python half is one `uses:` line, not a new matrix.

**Exit condition.** `release.yml` (or whatever orchestrates qualification)
calls `python-wheels.yml` via `workflow_call` and requires it to succeed before
publication, or the sentence is reworded to say the entry point exists for a
future caller.

### F-19 · `stale-claim` · Four shipped links point into a gitignored directory, and no feature note covers this area

**Severity: low.** Area: documentation.

`.gitignore:1` is `/_notes/`, the directory is absent from the worktree, and
`git ls-files '_notes*'` returns nothing — so `_notes/` is local-only by design.
Four links in tracked documentation resolve into it. A relative-link check over
all 33 tracked markdown files, written for this review:

```console
$ python3 -B linkcheck.py
test/conformance/README.md: ../../_notes/plans/archived/secret-scan-00009.qualify-provider-token-families.md -> _notes/plans/archived/secret-scan-00009.qualify-provider-token-families.md
test/conformance/README.md: ../../_notes/plans/archived/secret-scan-00017.requalify-credential-coverage.md -> _notes/plans/archived/secret-scan-00017.requalify-credential-coverage.md
test/conformance/README.md: ../../_notes/plans/archived/secret-scan-00023.qualify-additional-provider-families.md -> _notes/plans/archived/secret-scan-00023.qualify-additional-provider-families.md
test/conformance/README.md: ../../_notes/plans/archived/secret-scan-00024.qualify-stable-release-corpus.md -> _notes/plans/archived/secret-scan-00024.qualify-stable-release-corpus.md
4 broken relative link(s) in 33 tracked markdown files
```

The repository is public, so these are four dead links for every reader, and
they cite the planning records that justify the conformance corpus — the part a
reader is most likely to follow. Every other relative link in the repository
resolves, including all the cross-references among the three existing audit
documents.

Relatedly, issue #65's fourth criterion names "feature notes".
`CONVENTIONS.md:3-5` and `conventions/feature-documentation.md:10` locate them
at `_notes/features/<feature>/README.md` — inside the same gitignored tree — so
there is no tracked feature note for CI, release automation, or supply chain to
reconcile against, and no tracked feature note for anything else either. Since
`_notes/` is deliberately local, this is a convention whose artifacts cannot be
reviewed in-tree; recorded so #66 can decide whether that is intended. It is
also why the three audit documents live under `docs/audits/` while Feature #61
asks for `_notes/audits/` — the tracked location is the usable one.

**Exit condition.** The four citations are replaced with tracked references
(the corresponding issues, or notes moved into `docs/`), and the link check
above — or an equivalent — runs in `npm run ci` so a link into an ignored path
fails. Separately, #66 records whether feature notes are expected to be tracked.

### F-20 · `new-risk` · `npm run release` has no build guarantee of its own

**Severity: low.** Area: release automation.

`package.json:56-57`:

```json
    "release:check": "npm run ci && npm pack --dry-run",
    "release": "npm publish --access public",
```

`package.json:22-29` ships `dist`, and there is no `prepack`, `prepare`, or
`prepublishOnly` script. So `npm run release` publishes whatever `dist/`
happens to contain — or, if `dist/` is absent, a tarball of just the five
documentation files and `package.json`, with npm reporting success.

In `release.yml` the ordering is correct: `release:check` (`:92-93`) runs
`npm run ci`, which runs `npm test`, which runs `npm run build`, so `dist/` is
freshly compiled from the checked-out commit before `:95-98` publishes. The
risk is that the guarantee lives in the *ordering of two separate workflow
steps* rather than in the publish command, so it is one reordering, one
refactor, or one local `npm run release` away from publishing a stale or empty
`dist/`. A release gate that depends on step order and not on the script is
exactly the kind of control worth making intrinsic.

**Exit condition.** `release` builds what it publishes — a `prepack` or
`prepublishOnly` that runs `npm run build` — so the artifact cannot be stale or
empty regardless of what ran before it.

### F-21 · `new-risk` · Artifact retention is unspecified

**Severity: low.** Area: supply chain.

Both upload steps omit `retention-days`:

```yaml
# python-wheels.yml:89-94
      - name: Upload the source distribution
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: python-sdist
          path: dist/*.tar.gz
          if-no-files-found: error
# python-wheels.yml:218-223 — same, per wheel target
```

So the nine qualification artifacts (eight wheels plus an sdist) inherit
whatever the repository or organization default is — changeable outside the
repository, invisible in the diff, and up to 90 days on GitHub's default. Two
directions matter for release qualification, and neither is stated: an artifact
that expires *too soon* removes the evidence a release decision rested on,
while `python-wheels.yml` also runs on every matching pull request, so
unqualified build output accumulates under the same unstated policy.

`if-no-files-found: error` on both steps is good and is why an empty upload
cannot pass silently. The gap is only the lifetime.

**Exit condition.** Both upload steps declare an explicit `retention-days`
chosen for release-evidence retention (with pull-request runs allowed a shorter
one), and the choice is recorded with the release process so it is reviewable.

### F-22 · `stale-claim` · `SECURITY.md`'s supply-chain section describes only the CI half

**Severity: low.** Area: documentation.

`SECURITY.md:72-103` is titled "CI supply-chain review" and is accurate about
`ci.yml`: workflow-level permissions are empty, the test job takes only
`contents: read`, checkout does not persist its credential, actions are
SHA-pinned with the comments as labels, and installation is
`npm ci --ignore-scripts`. Every one of those statements was verified
(Criterion 2).

What it omits is the half where the risk is concentrated. The section never
mentions:

- `release.yml` or `reconcile-release.yml` at all, or that both take
  `contents: write` and create Git refs;
- the `release` environment, or that `NPM_TOKEN` is scoped to it — a genuine
  strength that goes unrecorded;
- provenance and publishing authority ([F-06](#f-06--new-risk--no-npm-provenance-and-a-long-lived-token-instead-of-trusted-publishing)),
  although the section's closing paragraph tells a reviewer to inspect for
  "publishing authority";
- artifact retention ([F-21](#f-21--new-risk--artifact-retention-is-unspecified));
- the **Rust** supply chain. `deny.toml` and `cargo deny check` are the
  repository's strongest dependency controls and appear nowhere; the prescribed
  validation is `npm ci --ignore-scripts`, `npm audit --package-lock-only`, and
  `npm run ci` — all JavaScript, and `npm run ci` notably excludes
  `npm run rust:check`.

One smaller inconsistency in the same area: the section states "Dependency
installation uses `npm ci --ignore-scripts`", while `README.md:317` instructs a
contributor to run plain `npm ci`, which does execute the three install scripts
the lockfile declares. The hardened form should be the documented one in both
places.

**Exit condition.** The section covers the publication path (write permissions,
environment, token scope, provenance, retention) and the Cargo supply chain
(`deny.toml`, `cargo deny check`, `npm run rust:check`) alongside the npm one,
and `README.md`'s development instructions use `npm ci --ignore-scripts`.

### F-23 · `evidence-gap` · `engines.node >= 20` claims more Node majors than CI tests

**Severity: low.** Area: platform matrix.

`package.json:67-69` and `packages/javascript/package.json:51-53` both declare:

```json
  "engines": {
    "node": ">=20"
  }
```

`ci.yml:26-29` tests two:

```yaml
        node-version:
          - 20
          - 22
```

`>=20` is an open-ended claim: it commits to Node 24 and every later major,
none of which runs in CI. `release.yml:37` also publishes from Node 22 only.
The adjacent surfaces are bounded by comparison — the Python binding declares
`requires-python = ">=3.10"` and the wheel matrix actually runs the floor
(3.10, or 3.11 on Windows-on-Arm) *and* a current interpreter (3.14) on every
target, which is the shape this claim is missing. Adding the current LTS to the
matrix would make the floor-and-ceiling coverage symmetric across the two
runtimes.

**Exit condition.** The Node matrix covers the declared floor and the current
LTS (and any later major the engines range claims), or `engines.node` is
narrowed to the range CI exercises.

## Appendix — reproducing this review

Every command below is read-only with respect to the repository and performs no
release operation. Two items construct a temporary file in a scratch directory;
one mutates a tracked file and restores it, and is marked.

```bash
# Gates (what this review ran)
npm run ci
cargo test --workspace --locked
npm run rust:check
python3 -B scripts/check-python-package.py
npm audit --package-lock-only
npm pack --dry-run

# F-01: what the Release workflow would actually publish
npm pack --dry-run 2>&1 | tail -10
grep -rl 'napi\|wasm\|#native' dist/ || echo "no native or WebAssembly entry point in dist/"
grep -c . <<<"$(npm pack --dry-run 2>&1 | grep 'npm notice.*dist/')"

# F-02: what release:check expands to, versus what ci.yml runs
node -p "const s=require('./package.json').scripts; [s['release:check'], s.ci].join('\n')"
grep -n 'run: ' .github/workflows/ci.yml

# F-03: publication paths and the publish flag
grep -rn 'npm publish\|maturin upload\|cargo publish\|twine' .github/workflows/ package.json
grep -n 'publish' Cargo.toml crates/*/Cargo.toml bindings/*/Cargo.toml

# F-04, F-15: operational controls (read-only API)
gh api repos/omiologic/secret-scan/environments/release \
  --jq '{name, protection_rules, deployment_branch_policy}'
gh api repos/omiologic/secret-scan/environments/release/secrets --jq '.secrets[].name'
gh api repos/omiologic/secret-scan/branches/main/protection
gh api repos/omiologic/secret-scan/actions/permissions
gh api repos/omiologic/secret-scan --jq '{visibility,allow_forking,default_branch}'

# F-05, F-10: what CI never builds or starts
grep -rn 'napi\|smoke-test\|packages/javascript\|playwright\|browser' .github/workflows/
node -p "require('./bindings/node/package.json').napi.targets.join('\n')"

# F-06: provenance and OIDC
grep -rn 'provenance\|id-token\|attest' .github/workflows/ package.json packages/javascript/package.json \
  || echo "none configured"

# F-07: what the release workflow records durably
grep -n 'GITHUB_OUTPUT\|GITHUB_STEP_SUMMARY\|upload-artifact' .github/workflows/release.yml

# F-09: the lockstep set, and the drift probe (MUTATES, then restores)
grep -n 'LOCKSTEP_MANIFESTS' scripts/check-rust-workspace.py
cp packages/javascript/package.json /tmp/pj.bak
sed -i '' 's/"version": "0.1.0-beta.1"/"version": "9.9.9-probe.0"/' packages/javascript/package.json
python3 -B scripts/check-rust-workspace.py | tail -1
python3 -B scripts/check-python-package.py | tail -1
cp /tmp/pj.bak packages/javascript/package.json && rm /tmp/pj.bak
git diff --stat packages/javascript/package.json   # must be empty

# F-11: the wheel build's unpinned inputs, read from the action it pins
gh api "repos/PyO3/maturin-action/contents/action.yml?ref=e83996d129638aa358a18fbd1dfb82f0b0fb5d3b" \
  --jq .content | base64 -d | grep -A3 'maturin-version\|  container\|  sccache'

# F-12: the README example versus the published surface
grep -n 'initialize' README.md | head -3
grep -rn 'initialize' src/ || echo "src/ exports no initialize"
grep -n 'CONTEXTUAL_SECRET' README.md || echo "README has no typed-placeholder example"

# F-13: cargo-deny targets versus the wheel matrix
sed -n '8,16p' deny.toml
sed -n '173,182p' Cargo.toml

# F-14: the cross-check that exists, and the one that does not
grep -n 'CI_MSRV\|CI_WORKFLOW' scripts/check-rust-workspace.py
grep -rn 'wasm-bindgen' scripts/*.py || echo "no script reads the wasm-bindgen pair"

# F-16: timeouts and RUSTFLAGS reach
grep -rn 'timeout-minutes' .github/workflows/
grep -n 'RUSTFLAGS\|cargo install' .github/workflows/ci.yml

# F-17: scheduled checks and dependency updates
grep -rn 'schedule:' .github/workflows/ || echo "no scheduled workflow"
ls .github/

# F-18: the unused workflow_call
grep -rn 'workflow_call\|uses: \./\.github/workflows' .github/workflows/

# F-19: relative links in tracked markdown (writes only to a scratch path)
cat > /tmp/linkcheck.py <<'PY'
import re, subprocess, os
files = subprocess.run(["git","ls-files","*.md"],capture_output=True,text=True).stdout.split()
pat = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
bad = []
for f in files:
    base = os.path.dirname(f)
    for m in pat.finditer(open(f, encoding="utf-8").read()):
        t = m.group(1)
        if t.startswith(("http://", "https://", "#", "mailto:")):
            continue
        p = t.split("#")[0]
        if not p:
            continue
        target = os.path.normpath(os.path.join(base, p))
        if not os.path.exists(target):
            bad.append((f, t, target))
for f, t, target in bad:
    print(f"{f}: {t} -> {target}")
print(f"{len(bad)} broken relative link(s) in {len(files)} tracked markdown files")
PY
python3 -B /tmp/linkcheck.py

# F-20, F-21, F-23: publish guarantees, retention, engines
node -p "JSON.stringify(require('./package.json').scripts,null,1)"
grep -rn 'retention-days' .github/workflows/ || echo "no retention-days anywhere"
grep -n 'if-no-files-found' .github/workflows/python-wheels.yml
node -p "require('./package.json').engines.node"
sed -n '24,29p' .github/workflows/ci.yml
```

No command above publishes, tags, deploys, or mutates an external repository.
The one mutating step is local, reverted in the same block, and verified by
`git diff --stat`.
