# Release-readiness audit

The final audit of the Rust-core migration and its remediation, required by
issue #36 under Feature #11 and Epic #60. This document judges whether the
nine bounded remediation Tasks (`RB-1`–`RB-9`, issues #71–#79) that
[the release-gap disposition](./release-gap-disposition.md) created actually
hold at the current tip of `main` — not whether their tracking issues are
closed.

- **Assessed revision:** `02c2b9eb91fc2ff661f8f636f3800c2bf44ad4be` (`main`,
  merge of PR #93, *cutover docs, Python redirect*), the tip at the time this
  audit was performed.
- **Assessed on:** 2026-09-10.
- **Scope:** issue #36's five acceptance criteria — review the release
  candidate's public APIs, native range semantics, callback boundaries,
  sanitized errors, resource limits, package artifacts, platform evidence,
  and conformance coverage; confirm no duplicate TypeScript or pure-Python
  detector implementation remains; confirm every Epic and Feature completion
  criterion has direct evidence; record unresolved residual risks and
  intentional exclusions; and stop at release-ready status.
- **Authority:** this document records evidence and a verdict. It does not
  remediate anything, change any issue's state, select a version, create a
  tag, publish a package, deploy, or archive another repository. A release
  still requires the explicit approval `AGENTS.md` mandates.

## Verdict

**NOT YET READY FOR RELEASE APPROVAL.**

Every Task but one holds at the assessed revision, and the repository's own
gate is green. One release blocker that clause (a) and (c) of issue #66's
test require — `RB-8`'s repository-settings half — is **not actually applied**
despite its tracking issue (#78) being closed. That is a genuine, currently
open gap, not a residual risk: it is precisely the kind of closed-issue
overclaim this migration's retrospective (Feature #61) was created to catch,
recurring one layer up. Section
["RB-8 is not actually satisfied"](#rb-8-is-not-actually-satisfied) below is
the finding; everything else in this audit resolves.

## Method

This audit did not re-run the four retrospective inputs (the ledger and three
reviews) or re-derive their 55 findings — that evidence is
[the release-gap disposition](./release-gap-disposition.md)'s job, and it is
unchanged since 2026-09-09. Instead, for each of the nine remediation Tasks,
this audit independently re-checked its acceptance criteria against the
source tree and, where the criterion is a live repository property rather
than a source-controlled one, against a fresh read-only API read — not
against the Task's own exit-evidence claim or its issue's closed state.

Commands actually run, all read-only or local-build:

```bash
npm run ci                                    # 0 errors, 99/99 JS tests, all Python unit-test suites green
npm run release:check                         # npm run ci && npm pack --dry-run ./packages/javascript — green, produced omiologic-secret-scan-0.1.0-beta.1.tgz
cargo test --workspace --locked               # 391 passed, 17 suites
cargo clippy --workspace --all-targets --locked  # no issues found
cargo test -p secret-scan --test canonical_corpus       # 170 evaluated fixtures asserted
cargo test -p secret-scan-cli --test cli redact_matches_the_canonical_corpus_redacted_text  # 34 canonical-tier fixtures
npm run rust:check                            # lockstep set: 0 errors
gh api repos/omiologic/secret-scan/environments/release
gh api repos/omiologic/secret-scan/branches/main/protection
gh api repos/omiologic/secret-scan/rulesets
gh api repos/omiologic/secret-scan/rules/branches/main
```

No plaintext secret value, matched value, fixture input, or credential-shaped
string appears in this document. Detector ids, finding types, file paths,
line numbers, workflow identifiers, and repository-settings API field names
are safe metadata.

## Remediation Task verification

Each Task's acceptance criteria, from
[the disposition](./release-gap-disposition.md#release-blocker-remediation-tasks),
checked against the assessed revision.

### RB-1 (#71) — Assert the canonical corpus on the Rust core and on the CLI — **holds**

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Rust integration test asserts every evaluated fixture against `scan` | PASS | `crates/secret-scan-core/tests/canonical_corpus.rs:30-62` iterates `synchronous-corpus.json`'s fixtures with `support != "not-yet-evaluated"` and asserts detector id, finding type, confidence, and UTF-8 byte range |
| 2 | Fails on an empty fixture set | PASS | `canonical_corpus.rs:66-80` asserts the iterated set is non-empty |
| 3 | CLI integration test asserts redact-mode output against corpus-expected text | PASS | `crates/secret-scan-cli/tests/cli.rs:619-704`, `redact_matches_the_canonical_corpus_redacted_text`, runs the built binary over 34 canonical-tier fixtures |
| 4 | No embedded fixture input or matched value | PASS | Both read `conformance/fixtures/` via `include_str!`/`support::synchronous_corpus()` |
| 5 | Both run in `ci.yml`'s `rust-native` job on all three hosts | PASS | `.github/workflows/ci.yml:101-129`, matrix `[ubuntu-latest, macos-latest, windows-latest]` |

Re-run directly: `cargo test -p secret-scan --test canonical_corpus` passed
against 170 evaluated fixtures; `cargo test -p secret-scan-cli --test cli
redact_matches_the_canonical_corpus_redacted_text` passed against 34
canonical-tier fixtures. `#3.3` (Rust core, CLI half) and `#10.5` are now
demonstrated on the canonical surface, not merely true in fact.

### RB-2 (#72) — Remove the TypeScript detector core and repoint the published npm artifact — **holds**

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Old TS core absent, history preserved | PASS | `src/detectors/`, `src/scan.ts`, `src/incremental.ts`, `src/policy.ts`, `src/redact.ts`, `src/registry.ts`, `src/entropy.ts` absent from the tree; deleted by `937d245` (`feat: #72 remove typescript core`), reachable in `git log` |
| 2 | No behavioral fixtures outside `conformance/` | PASS | `test/detectors/`, `test/false-positives/`, `test/integration/` absent |
| 3 | Exactly one manifest declares `@omiologic/secret-scan` | PASS | Only `packages/javascript/package.json:2`; root `package.json`'s name is `secret-scan-workspace` |
| 4 | `packages/javascript/LICENSE` tracked and packed | PASS | Tracked in `git ls-files`; `test/package-contents.test.ts:44` asserts it's in the packed file list |
| 5 | The contents test packs the real directory | PASS | `test/package-contents.test.ts:20-33` runs a real `npm pack --dry-run` against `PACKAGE_ROOT`, nothing pre-populated |
| 6 | Publish resolves to a native/wasm-backed artifact | PASS | `packages/javascript/package.json` declares `dependencies.@omiologic/secret-scan-wasm` and six platform `optionalDependencies` |
| 7 | `readme-examples.test.ts` extracts examples from the README | PASS | Parses fenced code blocks out of `README.md` at read time rather than restating them |

Also confirmed directly: `bindings/python/python/secret_scan/__init__.py` only
re-exports the PyO3 `_native` extension — no pure-Python detector fallback
anywhere in the tree, and no second TypeScript or JavaScript detector
implementation exists outside `crates/`. `#3.2`, `#3.4`, and `#4.1` now hold.

### RB-3 (#73) — Make the browser WebAssembly runtime satisfy the adapter contract — **holds**

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `initialize()` resolves; incremental rejects with a fixed, documented code | PASS | `packages/javascript/src/runtime/browser.ts:230-233,236-240` |
| 2 | Both callback paths receive numeric `start`/`end` | PASS | `toNativeDetectedFinding` and `toNativeFormatterMetadata` (`browser.ts:124-136,139-152`) normalize `finding.range` to flat numbers |
| 3 | `Object.isFrozen` holds on the policy path too | PASS | `Object.freeze` at `browser.ts:128`; pinned by `browser-wasm-contract.test.ts:114,158,187` |
| 4 | A third, wasm-shaped test double exists | PASS | `packages/javascript/test/wasm-shaped-binding.ts` — nested `range`, opaque handle, a generated `default()` init distinct from `initialize()` |
| 5 | The fix is pinned by a test, not incidental | PASS | `browser-wasm-contract.test.ts:156-157,185-186` assert the numeric/frozen shape directly; reverting the normalization fails them |

`js:test` (99/99) includes this suite. `#25.1` now holds.

### RB-4 (#74) — Qualify the Node addon, browser artifact, and CLI binaries from one revision — **holds**

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | One workflow builds all three families from one revision | PASS | `.github/workflows/artifact-qualification.yml` — `node-addon` (6-entry matrix), `browser`, `cli` (6-target matrix) jobs, one trigger commit |
| 2 | Smoke-tested per architecture; unavailable runners marked | PASS | `matrix.smoke: host \| alpine` gates smoke steps and names the mode |
| 3 | `bindings/node/smoke-test.mjs` runs against the real built addon | PASS | Runs in the same job as the `napi build` step, no double |
| 4 | Real headless-browser job, or a documented deferral | PASS | `browser` job installs a real engine matrix and runs `qualify-browser-artifact.mjs` |
| 5 | Bidirectional matrix-pinning check with unit tests | PASS | `scripts/check-artifact-matrix.py`'s `compare()` (direction-symmetric), exercised by `scripts/tests/test_check_artifact_matrix.py` (28 tests, green in `npm run ci`) |
| 6 | Node CI matrix bound to `engines.node` | PASS | `check_node_support` in `check-artifact-matrix.py` delegates to `check-rust-workspace.py`, the single source of truth |
| 7 | JS public API runs against the real addon and real browser artifact, including a canonical-corpus fixture per surface | PASS (structural) | `package-consumer` job (`needs: [node-addon, browser]`) installs the packed tarball with real platform/wasm dependencies and awaits `initialize()` on both; not independently re-dispatched here to avoid triggering CI runners from this audit |

`#3.3` (Node/browser half), `#3.5`, `#8.3`, `#24.1`, `#24.5` now hold.

### RB-5 (#75) — Bring every version-bearing manifest into lockstep — **holds**

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Every version-bearing manifest is in the lockstep set or was removed with the removal recorded | PASS | `scripts/check-rust-workspace.py:63`: `LOCKSTEP_MANIFESTS = ("bindings/node/package.json", "packages/javascript/package.json")`; root `package.json` deliberately excluded, recorded in `docs/rust-workspace.md:182-203` as RB-2's cutover effect |
| 2 | A drift test per manifest member | PASS | `scripts/tests/test_check_rust_workspace.py:202-284` |
| 3 | `docs/rust-workspace.md` states the publish version and the root manifest's fate | PASS | `docs/rust-workspace.md:182-203` |

Re-run directly: `npm run rust:check` → 0 errors; all of root `package.json`,
`bindings/node/package.json`, `packages/javascript/package.json`, and
`Cargo.toml` read `0.1.0-beta.1`.

### RB-6 (#76) — Record a release manifest and make reconcile consume it — **holds**

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Every `Release` run, including a failure, emits a durable 5-field record | PASS | `record-manifest` job, `.github/workflows/release.yml:388-391`, `needs: [publish, publish-crates, publish-pypi]` with `if: always()`; fields assembled by `scripts/release-manifest.py` |
| 2 | Reconcile reads the published commit from the record, not `GITHUB_SHA` | PASS | `.github/workflows/reconcile-release.yml` downloads the `release-manifest-<version>` artifact and reads `source_revision` from it, or accepts `source_commit` as input |
| 3 | Reconcile verifies ancestry, not tip equality | PASS | `scripts/reconcile-guard.py` checks the target is an ancestor of `main`, not equal to its tip |
| 4 | A deterministic test covers ancestor / non-ancestor / missing-record fixtures | PASS | `scripts/tests/test_reconcile_guard.py` — `test_ancestor_commit_is_verified`, `test_non_ancestor_commit_is_rejected`, `test_missing_record_is_rejected`, plus the exact-tip and `source_commit`-override cases |
| 5 | Reconcile's repair-window documentation matches the guard | PASS | `AGENTS.md`'s "Release authority" paragraph states the exact window `reconcile-release.yml`'s header restates |

`#11.2` (manifest half) now holds.

### RB-7 (#77) — Gate publication on the full qualification set from one commit — **holds**

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Publication unreachable without all required jobs succeeding for the release commit | PASS | `.github/workflows/release.yml`: `publish` (`:67-70`), `publish-crates` (`:214`), and `publish-pypi` (`:312`) each declare `needs: [ci, python-wheels, artifact-qualification]`; those three are called as reusable workflows (`uses: ./.github/workflows/{ci,python-wheels,artifact-qualification}.yml`, `:42-58`) sharing `github.sha` with the caller, so there is no stale-ref risk |
| 2 | A required job's failure leaves the publish job unrun | PASS (by construction) | Standard Actions `needs:` semantics over a reusable-workflow call; not independently dispatched to avoid triggering a real workflow run from this audit |
| 3 | `docs/python-packaging.md`'s `workflow_call`-reuse claim is true | PASS | `docs/python-packaging.md:241-242` claims it; `release.yml:50` (`python-wheels` job) now actually calls it |

Also confirmed directly: `scripts/check-release-gate.py`'s `REQUIRED_GATES`
(`ci`, `python-wheels`, `artifact-qualification`) and `PUBLISH_JOBS`
(`publish`, `publish-crates`, `publish-pypi`) enforce this as a deterministic,
currently-passing check (`npm run ci` → "Release gate check complete: 0
error(s)"), not just a point-in-time reading of the YAML. `#11.1` ("from one
revision") and `#11.3` now hold on the automation side. `R/F-18` closes as a
side effect, as the disposition predicted.

### RB-8 (#78) — Enforce release approval in automation and protect the release refs — **does not hold (2 of 3 criteria)**

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `release` environment has non-empty `protection_rules`, required reviewers, deployment-branch policy limited to `main` | **FAIL** | Live read, 2026-09-10: `gh api repos/omiologic/secret-scan/environments/release` → `"protection_rules":[],"deployment_branch_policy":null,"can_admins_bypass":true` |
| 2 | `main` has branch protection with required reviews and required status checks | **FAIL** | Live read: `gh api repos/omiologic/secret-scan/branches/main/protection` → `404 "Branch not protected"`. Checked the ruleset alternative too: `gh api repos/omiologic/secret-scan/rulesets` → `[]`, `gh api repos/omiologic/secret-scan/rules/branches/main` → `[]`. No protection of either kind exists. |
| 3 | `Reconcile Release` declares an environment matching `Release`'s | PASS | `.github/workflows/reconcile-release.yml:35-36`, `environment: name: release` |

#### RB-8 is not actually satisfied

Issue #78 is `CLOSED` (2026-09-10T04:16:37Z) with **zero comments** — no
record of who applied criteria (1) and (2), when, or whether they were
applied at all, despite the Task's own text requiring exactly that record
("The Task records who performs them and when"). The merged pull request that
closed it (#89, *add release environment check script and tests*) delivered
only criterion (3) — a workflow-level `environment:` declaration and a
matching `check-release-environment.py` script — which are ordinary
pull-request work. Criteria (1) and (2) are repository-settings changes that
"no pull request can deliver," in the Task's own words; they needed an
account with admin on `omiologic/secret-scan` to apply them directly, and the
live reads above show that never happened, or happened and was later
reverted. There is no way to distinguish those two from outside the
repository's audit log, and it does not change the conclusion either way.

This is the same failure mode Feature #61's retrospective found in Epic #3: a
tracking issue closed on the strength of the code change adjacent to it,
while a load-bearing acceptance criterion — here, a live repository property
no diff can prove — was never actually established. The consequence is
concrete: **today, any actor with `workflow_dispatch` access to this
repository can trigger `Release` or `Reconcile Release` from any branch, and
either workflow can complete — tagging, and publishing to npm, crates.io, and
PyPI — with no required reviewer and no branch protection in the way.** Both
workflows hold `contents: write`; `Release`'s publish jobs are otherwise fully
gated (`RB-7`), but nothing stops them from running unreviewed. This is
exactly blocker clause (a) ("a workflow holding `contents: write` and
creating tags runs under no environment and no protection at all") and (c)
(`#11.3` and `AGENTS.md`'s release authority require explicit approval that
nothing in automation enforces) as `RB-8`'s own specification states them —
unchanged from the day `R/F-04` found them, because the fix never reached the
one place it had to: the repository's settings, not its source tree.

**This finding does not block this audit from being recorded, and this audit
does not remediate it.** Applying branch protection or environment
protection rules is itself a repository-administration action with real
security consequences that requires the explicit authorization `AGENTS.md`
reserves for the user, exactly as `RB-8`'s own text anticipated. The
recommendation is to reopen #78 (or file a follow-up Task under Feature #11)
scoped to criteria (1) and (2) only, performed by an account with admin
access, with the three API reads recorded verbatim on the issue as its exit
evidence — the same evidence this audit just took independently.

### RB-9 (#79) — Decide what the first release ships, and give each shipped artifact a publication path — **holds**

Branch A (ship the full four-artifact set) was taken, recorded in
`docs/decisions/2026-09-10-ship-first-release-artifact-set.md`.

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| A | `publish` lifted for publishable crates; binding crates stay unpublishable | PASS | `Cargo.toml:28` root `publish = false`; `crates/secret-scan-core/Cargo.toml:25` and `crates/secret-scan-cli/Cargo.toml:15` override to `publish = true`; `bindings/node`, `bindings/wasm`, `bindings/python` all keep `publish = false` |
| A | CLI has a build job; wheels have a PyPI step; `packages/javascript` declares real platform dependencies | PASS | `release.yml` gains `publish-crates` (`:212`) and `publish-pypi` (`:310`), each with its own `environment: release` and the same `main`-only guard as `publish`; `packages/javascript/package.json:55-64` declares `dependencies.@omiologic/secret-scan-wasm` and six platform `optionalDependencies`; `runtime/node.ts`'s `loadAddon` resolves by `process.platform`/`process.arch` and falls back to `INITIALIZATION_FAILED` |
| 1 | A package-consumer test installs the packed tarball into a clean directory and awaits `initialize()` on both runtimes | PASS | `scripts/qualify-package-consumer.mjs`, wired as the `package-consumer` job in `artifact-qualification.yml` (`:381`) |
| 2 | No promised artifact lacks a publication path or a recorded deferral | PASS | `ARCHITECTURE.md`'s artifact table (crate, CLI, npm, PyPI) matches four live publish paths; nothing in `README.md`'s channel list is now unaccounted for |

`#3.5` and `#8.3` now hold. This decision does not select a version, tag, or
publish anything — `RB-9`'s own note on authority, and `L/G-10`, are
unaffected.

## No duplicate detector implementation remains

Confirmed directly, independent of RB-2's own claim:

- No TypeScript detector implementation exists anywhere in the tree —
  `src/detectors/`, `src/scan.ts`, `src/incremental.ts`, `src/policy.ts`,
  `src/redact.ts`, `src/registry.ts`, and `src/entropy.ts` are all absent, and
  a repository-wide search for a second detector, policy, or redaction
  implementation outside `crates/secret-scan-core` found none.
- No pure-Python detector fallback exists —
  `bindings/python/python/secret_scan/__init__.py` re-exports the compiled
  `_native` extension only, and `scripts/qualify-python-wheel.py` installs
  every wheel with `--only-binary` and no Rust toolchain on `PATH`, so a
  source fallback cannot silently substitute a pure-Python implementation.
- `L/G-12` (the pure-Python-fallback intentional exclusion) and `#3.2`/`#3.4`
  (the TypeScript-removal criteria) both resolve to the same evidence.

## Release-readiness criteria — re-verified, not re-asserted

[The disposition](./release-gap-disposition.md#release-readiness-criteria--every-one-resolves)
already resolved all twenty completion criteria of Epic #3, Feature #11, Epic
#60, and Feature #61 to evidence, a blocker, a deferred item, or an
intentional exclusion, contingent on the nine Tasks' exit evidence holding.
With eight of nine Tasks independently confirmed above, every criterion that
depended only on them now resolves to **evidence** rather than a pending
blocker:

| Criterion | Was | Now |
|---|---|---|
| `#3.2` Rust is the only built-in implementation | blocker `RB-2` | **evidence** — see above |
| `#3.3` all five surfaces pass the same contract | blocker `RB-1`, `RB-4` | **evidence** — canonical corpus asserted on the Rust core, CLI, Node addon, and browser artifact |
| `#3.4` TypeScript core removed after parity | blocker `RB-2` (after `RB-1`) | **evidence** — sequencing confirmed: `RB-1`'s corpus test predates `937d245`'s removal in Git history |
| `#3.5` every required package and binary passes release qualification | blocker `RB-4`, `RB-9` | **evidence** |
| `#11.1` cross-platform matrices pass from one source revision | blocker `RB-4`, `RB-7` | **evidence** |
| `#11.2` lockstep versions and the release manifest | blocker `RB-5`, `RB-6` | **evidence** |
| `#11.3` release and reconcile are safe under partial publication | blocker `RB-6`, `RB-7`, `RB-8` | **partially evidence, partially still a blocker** — `RB-6` and `RB-7` hold; `RB-8`'s repository-settings half does not (above) |
| `#11.4` TypeScript removed only after parity evidence | blocker `RB-1` then `RB-2` | **evidence** |
| `#11.5` public API, security, architecture, package contents, and changelog reconciled | blocker `RB-2`, `RB-9` | **evidence** for the parts those Tasks own — see the "Reconciliation" section below for this audit's own check |
| `#60.4` every release blocker remediated and verified | blockers `RB-1`–`RB-9` | **not yet fully evidence** — 25 of 26 blocking findings are remediated and verified; the 26th (`R/F-04`'s repository-settings half, owned by `RB-8`) is not |
| `#60.5` Feature #11 completes and the final audit reports `READY FOR RELEASE APPROVAL` | blockers `RB-1`–`RB-9`, then #36 | **not yet** — this audit is #36, and its verdict is accurately reported above as not yet ready, for the one reason stated |

All other criteria in [the disposition's table](./release-gap-disposition.md#release-readiness-criteria--every-one-resolves)
are unaffected by this audit's findings and remain resolved as recorded
there: `#3.1`, the two Epic #3 intentional exclusions, `#60.1`–`#60.3`, and
all five of Feature #61's own criteria.

## Reconciliation check (`#11.5`)

- **Public API:** unchanged since the three independent reviews; `#26.1`
  (frozen findings, numeric offsets) and the equivalent Python and CLI
  contracts hold, now demonstrated end-to-end by `RB-1` and `RB-3`'s tests
  rather than only by unit-level assertion.
- **Security:** the core's side-effect freedom (`crates/secret-scan-core`
  performs no runtime network access, filesystem access, environment lookup,
  telemetry, or secret storage) is unchanged and re-confirmed by
  `check_core_manifest` in `scripts/check-rust-workspace.py`, which still
  passes. The one open security-relevant gap is `RB-8`'s, above — an
  automation-and-repository-settings gap, not a core-boundary violation.
- **Architecture:** `ARCHITECTURE.md`'s binding/package table and its
  "Versioning, qualification, and release" section match the live workflow
  graph verified above, including the one deliberately recorded asymmetry
  (neither JavaScript artifact streams; the CLI ships no musl variant while
  the N-API addon does).
- **Package contents:** `packages/javascript`'s packed tarball carries its
  `LICENSE`, a real dependency on the wasm package, and six platform
  `optionalDependencies` — confirmed live via `npm run release:check`, which
  produced `omiologic-secret-scan-0.1.0-beta.1.tgz`.
- **Changelog:** `CHANGELOG.md`'s `## Unreleased` section accurately
  reflects everything this audit verified — RB-1 through RB-9 each have a
  dated entry naming their issue number, and the two recorded "Notes" (the
  musl-addon/npm-package asymmetry, and neither JavaScript artifact
  streaming) match what `RB-4` and `RB-9`'s own qualifiers assert. Nothing in
  the changelog claims `RB-8`'s repository settings are applied — it is
  silent on repository administration, correctly, since that is not a
  package change.

## Residual risks and intentional exclusions

### Deferred (non-blocking), unchanged since 2026-09-09

[The deferred quality backlog](./deferred-quality-backlog.md), tracked by
issue #80, holds 25 findings — 7 medium and 18 low severity — none of which
violates a public contract or security boundary, leaves a promised platform
unqualified, leaves lockstep safety incomplete, or leaves a mandatory
original criterion unmet. This audit did not re-verify each of the 25
individually; their class, severity, evidence, and exit condition are
unchanged and still accurately recorded there, and three of them
(`L/G-07`, `C/F-05`, `R/F-18`) are confirmed above to have closed as side
effects of `RB-1` and `RB-7`, as the backlog predicted. None of the 25 blocks
this Epic's closeout.

Two residual notes recorded in `CHANGELOG.md`'s `## Unreleased` → `### Notes`
section are the operationally relevant ones for anyone consuming this
release candidate immediately: the eight-target N-API addon matrix outruns
the six platform npm packages `packages/javascript` declares (musl artifacts
are qualified but unpublished, an intentional and recorded deferral within
`RB-9`'s scope, not a new gap), and neither JavaScript artifact offers
streaming while the Python binding does (`INCREMENTAL_UNAVAILABLE` is a
fixed, tested, documented rejection, not a silent gap).

### Intentional exclusions, unchanged

Four exclusions remain correctly excluded and are not re-litigated by this
audit: the Go binding, version/tag/release/publication/archival (this audit's
own out-of-scope boundary, restated below), custom detector callbacks in the
first stable API, and a pure-Python detector fallback (independently
re-confirmed above). See
[the disposition's table](./release-gap-disposition.md#intentional-exclusions--documented-and-not-converted-into-work)
for their recorded rationale and exit conditions, both unchanged.

### New residual risk this audit adds

- **`RB-8`'s repository-settings gap** (above) is the one new item this audit
  contributes. It is not added to the deferred backlog, because it fails the
  blocker test on clauses (a) and (c) exactly as `R/F-04` originally did — it
  is a release blocker, not a deferred quality finding, and this audit's
  verdict reflects that.

## What this audit does not do

Consistent with issue #36's own scope and `AGENTS.md`'s release authority:

- It does not select a version, create a tag, or open a release.
- It does not publish to npm, crates.io, PyPI, or any binary distribution
  channel.
- It does not deploy or archive another repository.
- It does not apply branch protection or environment protection rules —
  the one gap it found is a repository-administration action reserved for a
  human with the necessary access and the explicit authorization `AGENTS.md`
  requires for any release-adjacent operation.
- It does not reopen or comment on any closed issue. The recommendation to
  reopen #78 (or file a scoped follow-up) is recorded here for a human to
  act on.

## Appendix — how to re-derive this audit

```bash
# The repository's own gate.
npm run ci
npm run release:check
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked

# The two corpus assertions RB-1 added.
cargo test -p secret-scan --test canonical_corpus
cargo test -p secret-scan-cli --test cli redact_matches_the_canonical_corpus_redacted_text

# The lockstep set RB-5 defined.
npm run rust:check

# The one live gap: run these and compare against the FAIL rows above.
gh api repos/omiologic/secret-scan/environments/release
gh api repos/omiologic/secret-scan/branches/main/protection
gh api repos/omiologic/secret-scan/rulesets
gh api repos/omiologic/secret-scan/rules/branches/main

# No duplicate detector implementation.
git log --oneline --follow -- src/detectors        # deleted, history preserved
sed -n '1,40p' bindings/python/python/secret_scan/__init__.py   # native re-export only

# The issue graph this audit judged.
gh api graphql -f query='query{repository(owner:"omiologic",name:"secret-scan"){
  issue(number:11){subIssues(first:50){nodes{number state title}}}}}'
```
