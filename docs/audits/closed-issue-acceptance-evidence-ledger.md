# Closed-issue acceptance evidence ledger

Criterion-level acceptance evidence for the closed Rust-core migration issues
**#3–#10** (Epic and Features) and **#12–#32** (Tasks), required by issue #62
under Feature #61 and Epic #60.

- **Assessed revision:** `769cfcc1dd7e8c7a3009a013331d1d32be1e3525` (`main`,
  `chore: retrospect`).
- **Assessed on:** 2026-09-09.
- **Scope:** 29 closed issues, 150 recorded criteria, 12 recorded gaps.
- **Authority:** this ledger records evidence. It does not change closed-issue
  state, authorize implementation changes, or authorize any release operation.

## Why this ledger exists

A closed issue and a merged pull request prove that *someone decided* the work
was done. They do not prove that each acceptance criterion the issue actually
stated is satisfied by the tree as it stands now. Ten of these issues
(#4–#10, #12, #13, #15, #17) were closed by hand with no `closes` linkage at
all, so for those the merged-PR signal is absent as well. This ledger
therefore restates every original criterion verbatim and binds each one to
current-tree evidence, or records the absence of that evidence as a gap.

## Method and cost policy

Evidence is drawn only from artifacts that already exist:

1. The issue bodies as originally written (GitHub API), quoted verbatim below.
2. The merged pull requests #37–#59 and their merge commits.
3. The current source tree at the assessed revision.
4. **Recorded** GitHub Actions results — no workflow was dispatched, re-run, or
   otherwise executed to populate this ledger, as issue #62 requires. The two
   long-running qualification workflows (`Python wheels`, `Package Release
   Rehearsal`) are cited from their existing runs only.

The only commands run against the tree were read-only inspections, the
repository's own `npm run ci` gate (to verify that adding this document keeps
the tree green), and one `secret-scan` check-mode pass over this document and
the two files it touches, which reports no finding.

No entry in this ledger reproduces a matched value, a fixture input, or any
credential-shaped string. Detector and fixture identities are safe metadata and
are used freely.

## Classification vocabulary

Every criterion carries exactly one class:

| Class | Meaning |
|---|---|
| `met` | Current-tree implementation plus deterministic verification establish the criterion. |
| `partially-met` | Part of the criterion is established; a named part is not. |
| `unverified` | No current-tree evidence establishes the criterion. This covers both *work not performed* and *work apparently performed but not bound to evidence*; the attached gap says which. |
| `intentional-exclusion` | The criterion was deliberately satisfied by excluding something, or the issue itself placed it out of scope. |

Every criterion that is not `met` carries a gap id. Every gap carries exactly
one class:

| Class | Meaning |
|---|---|
| `planned-unmet` | The work was not performed and an existing open work item owns it. |
| `regression` | The criterion was satisfied at closure and the current tree no longer satisfies it. |
| `evidence-gap` | The behavior appears correct but no deterministic, recorded check binds it at the asserted scope. |
| `new-risk` | A risk that no closed issue's criteria anticipated, surfaced while reconciling. |
| `intentional-exclusion` | Deliberately out of scope, recorded so it is not mistaken for an omission. |

## Evidence anchors

Two recorded runs cover the assessed revision itself, and both are cited as
`CI@head` and `PW@head` throughout:

| Anchor | Workflow | Run | Head | Result |
|---|---|---|---|---|
| `CI@head` | CI | [34420100926](https://github.com/omiologic/secret-scan/actions/runs/34420100926) | `769cfcc1` | success |
| `PW@head` | Python wheels | [34420100924](https://github.com/omiologic/secret-scan/actions/runs/34420100924) | `769cfcc1` | success |

What each recorded workflow actually verifies is set out in
[Appendix A](#appendix-a--what-each-recorded-workflow-verifies). This matters:
several criteria are satisfied only by a job that does not run in `CI`.

### Closure provenance

| Issue | Closed by | Merge commit | Merge-commit CI run |
|---|---|---|---|
| #3 | PR [#54](https://github.com/omiologic/secret-scan/pull/54) | `67854fec` | [34405728915](https://github.com/omiologic/secret-scan/actions/runs/34405728915) |
| #4 | closed by hand, no PR linkage | — | — |
| #5 | closed by hand, no PR linkage | — | — |
| #6 | closed by hand, no PR linkage | — | — |
| #7 | closed by hand, no PR linkage | — | — |
| #8 | closed by hand, no PR linkage | — | — |
| #9 | closed by hand, no PR linkage | — | — |
| #10 | closed by hand, no PR linkage | — | — |
| #12 | PR [#37](https://github.com/omiologic/secret-scan/pull/37) | `931b9498` | [34382339237](https://github.com/omiologic/secret-scan/actions/runs/34382339237) |
| #13 | by hand; implemented by PR [#39](https://github.com/omiologic/secret-scan/pull/39) (`workbench/13-…`) | `06fe3df6` | [34384289752](https://github.com/omiologic/secret-scan/actions/runs/34384289752) |
| #14 | PR [#41](https://github.com/omiologic/secret-scan/pull/41) | `82820003` | [34388528959](https://github.com/omiologic/secret-scan/actions/runs/34388528959) |
| #15 | by hand; implemented by PR [#38](https://github.com/omiologic/secret-scan/pull/38) (`workbench/15-…`) | `482fd71a` | [34382540879](https://github.com/omiologic/secret-scan/actions/runs/34382540879) |
| #16 | PR [#40](https://github.com/omiologic/secret-scan/pull/40) | `4ae8972a` | [34384905602](https://github.com/omiologic/secret-scan/actions/runs/34384905602) |
| #17 | by hand; implemented by PR [#42](https://github.com/omiologic/secret-scan/pull/42) (`workbench/17-…`) | `64e7a95c` | [34392371589](https://github.com/omiologic/secret-scan/actions/runs/34392371589) |
| #18 | PR [#43](https://github.com/omiologic/secret-scan/pull/43) | `b579d401` | [34393180134](https://github.com/omiologic/secret-scan/actions/runs/34393180134) |
| #19 | PR [#44](https://github.com/omiologic/secret-scan/pull/44) | `ee65d476` | [34394329346](https://github.com/omiologic/secret-scan/actions/runs/34394329346) |
| #20 | PR [#45](https://github.com/omiologic/secret-scan/pull/45) | `937e8af8` | [34392590554](https://github.com/omiologic/secret-scan/actions/runs/34392590554) |
| #21 | PR [#47](https://github.com/omiologic/secret-scan/pull/47) | `ab0b524c` | [34397839883](https://github.com/omiologic/secret-scan/actions/runs/34397839883) |
| #22 | PR [#51](https://github.com/omiologic/secret-scan/pull/51) | `6e2be42c` | [34402658961](https://github.com/omiologic/secret-scan/actions/runs/34402658961) |
| #23 | PR [#53](https://github.com/omiologic/secret-scan/pull/53) | `e663bf72` | [34404742729](https://github.com/omiologic/secret-scan/actions/runs/34404742729) |
| #24 | PR [#46](https://github.com/omiologic/secret-scan/pull/46) | `962c6569` | [34397860385](https://github.com/omiologic/secret-scan/actions/runs/34397860385) |
| #25 | PR [#48](https://github.com/omiologic/secret-scan/pull/48) | `26956d83` | [34398082954](https://github.com/omiologic/secret-scan/actions/runs/34398082954) |
| #26 | PR [#52](https://github.com/omiologic/secret-scan/pull/52) | `fbe94316` | [34402859173](https://github.com/omiologic/secret-scan/actions/runs/34402859173) |
| #27 | PR [#55](https://github.com/omiologic/secret-scan/pull/55) | `2b8b0f1a` | [34408560157](https://github.com/omiologic/secret-scan/actions/runs/34408560157) |
| #28 | PR [#49](https://github.com/omiologic/secret-scan/pull/49) | `d3540d01` | [34398592676](https://github.com/omiologic/secret-scan/actions/runs/34398592676) |
| #29 | PR [#57](https://github.com/omiologic/secret-scan/pull/57) | `16adcd2e` | [34408647647](https://github.com/omiologic/secret-scan/actions/runs/34408647647) |
| #30 | PR [#59](https://github.com/omiologic/secret-scan/pull/59) | `135dbc56` | [34416994445](https://github.com/omiologic/secret-scan/actions/runs/34416994445) + Python wheels [34416994431](https://github.com/omiologic/secret-scan/actions/runs/34416994431) |
| #31 | PR [#56](https://github.com/omiologic/secret-scan/pull/56) | `1e1ac7cf` | [34411758887](https://github.com/omiologic/secret-scan/actions/runs/34411758887) |
| #32 | PR [#58](https://github.com/omiologic/secret-scan/pull/58) | `c671b95b` | [34415795079](https://github.com/omiologic/secret-scan/actions/runs/34415795079) |

Every merge-commit run above concluded `success`. Merge-commit runs are historical
provenance only; the binding evidence for each criterion is the assessed-revision
run (`CI@head`, `PW@head`).

## Summary

150 criteria across 29 closed issues:

| Class | Count |
|---|---|
| `met` | 135 |
| `partially-met` | 7 |
| `unverified` | 3 |
| `intentional-exclusion` | 5 |

Every criterion that is not `met` is concentrated in six issues. Of the 108
Task-level criteria (#12–#32), 102 are `met` and 3 are deliberate exclusions;
the remaining 3 all belong to #24 and #25, the two binding tasks whose artifacts
no check builds. The 42 Epic and Feature criteria (#3–#10) carry the rest: 33
`met`, 5 `partially-met`, 2 `unverified`, 2 intentional exclusions. That
distribution is the finding — the work each Task promised was done, and what is
outstanding is system-level: removing the TypeScript core, qualifying every
artifact, and proving one contract across all five surfaces.

| Issue | Criteria | met | partially-met | unverified | intentional-exclusion | Gaps |
|---|---|---|---|---|---|---|
| #3 | 5 | 1 | 2 | 2 | — | G-01, G-03, G-04, G-05, G-06, G-08 |
| #4 | 4 | 3 | 1 | — | — | G-02 |
| #5 | 4 | 4 | — | — | — | — |
| #6 | 4 | 4 | — | — | — | G-04 |
| #7 | 4 | 4 | — | — | — | — |
| #8 | 8 | 6 | 1 | — | 1 | G-03, G-05, G-11 |
| #9 | 8 | 7 | — | — | 1 | G-07, G-12 |
| #10 | 5 | 4 | 1 | — | — | G-04, G-06 |
| #12 | 5 | 5 | — | — | — | — |
| #13 | 5 | 5 | — | — | — | — |
| #14 | 5 | 5 | — | — | — | — |
| #15 | 5 | 5 | — | — | — | — |
| #16 | 5 | 5 | — | — | — | — |
| #17 | 5 | 5 | — | — | — | G-04 |
| #18 | 4 | 4 | — | — | — | G-04 |
| #19 | 5 | 5 | — | — | — | G-04 |
| #20 | 5 | 5 | — | — | — | — |
| #21 | 5 | 5 | — | — | — | — |
| #22 | 5 | 5 | — | — | — | — |
| #23 | 5 | 4 | — | — | 1 | G-11 |
| #24 | 5 | 2 | 1 | 1 | 1 | G-03, G-05, G-11 |
| #25 | 5 | 4 | 1 | — | — | G-05 |
| #26 | 5 | 5 | — | — | — | G-11 |
| #27 | 5 | 5 | — | — | — | G-05 |
| #28 | 5 | 4 | — | — | 1 | G-11, G-12 |
| #29 | 5 | 5 | — | — | — | — |
| #30 | 5 | 5 | — | — | — | G-12 |
| #31 | 5 | 5 | — | — | — | G-10 |
| #32 | 9 | 9 | — | — | — | — |

No `regression` gap was recorded: this reconciliation found no criterion that
evidence shows was satisfied at closure and that the current tree no longer
satisfies. The unmet criteria are work that was never performed (**G-01**,
**G-03**) or evidence that was never bound (**G-04**, **G-05**, **G-06**), not
behavior that decayed.

Gaps this ledger reads as release-blocking: **G-01** (the TypeScript core is
still in the tree), **G-03** (nothing qualifies the Node addon, the browser
artifact, the CLI binaries, or the `packages/javascript` tarball), **G-05** (no
check ever loads a built binding artifact), and **G-08** (the release workflow
would publish the legacy TypeScript package). All four already have open owners
under Feature #11 — issues #33, #34, #35, #36 — so this ledger adds no new work
items; Epic #60 decides disposition.

Two observations that the per-issue rows do not carry on their own:

1. **Ten of the 29 issues were closed with no pull-request linkage** (#4–#10,
   #12, #13, #15, #17). Three of those (#13, #15, #17) have an obvious
   implementing PR by branch name; the seven Features (#4–#10) were closed on the
   strength of their sub-issues. That is a defensible practice, but it means the
   merged-PR signal is unavailable for a third of the closed set, which is
   exactly why criterion-level evidence was worth reconstructing.
2. **The Rust core's own parity evidence is indirect.** The single check that
   compares the Rust core against the canonical corpus expectations is a Python
   test (**G-04**). It passes, so parity is a fact, not a hope — but the
   canonical surface cannot currently demonstrate its own contract.

## Gap register

Twelve gaps, each with the criteria it affects, the evidence establishing it, the
existing open work item that owns it, and an exact exit condition. Severity is
this ledger's reading of release impact; Feature #11 and Epic #60 decide what
blocks.

### G-01 · `planned-unmet` · The TypeScript detector core is still in the tree

- **Criteria:** #3.2, #3.4.
- **Evidence:** `src/detectors/` (13 detector modules plus `src/detectors/index.ts`), `src/scan.ts`, `src/incremental.ts`,
  `src/policy.ts`, `src/redact.ts`, `src/registry.ts`, `src/entropy.ts` are all
  present and are what the repository-root `package.json` `build` script compiles.
- **Owner:** open issue #35 (*Cut over documentation and remove the TypeScript
  detector core*).
- **Exit condition:** `src/detectors/`, `src/scan.ts`, `src/incremental.ts`,
  `src/policy.ts`, `src/redact.ts`, `src/registry.ts`, and `src/entropy.ts` are
  deleted, and `CI` is green without them.
- **Severity:** release-blocking for #3; #3's own criterion sequences it after
  parity, and parity evidence now exists (see G-04 for its locality).

### G-02 · `planned-unmet` · Behavioral fixtures still live outside the canonical corpus

- **Criteria:** #4.1.
- **Evidence:** `test/detectors/known-formats.test.ts`,
  `test/detectors/contextual.test.ts`, `test/detectors/entropy.test.ts`,
  `test/detectors/additional-providers.test.ts`,
  `test/false-positives/known-formats.test.ts`,
  `test/false-positives/contextual.test.ts`, and
  `test/integration/*.test.ts` carry hand-authored inline inputs and expectations
  alongside `conformance/fixtures/`.
- **Owner:** open issue #35 (these suites test the implementation G-01 removes).
- **Exit condition:** after the TypeScript core is removed, no behavioral
  expectation outside `conformance/fixtures/` asserts detector, policy, or
  redaction output. Focused unit tests over an internal helper are not
  behavioral fixtures and are out of this gap's scope.
- **Severity:** non-blocking; the canonical corpus is already authoritative for
  cross-language parity.

### G-03 · `planned-unmet` · No cross-platform qualification matrix outside Python

- **Criteria:** #3.3, #3.5, #8.3, #24.1.
- **Evidence:** `.github/workflows/` contains no job that builds the N-API addon
  (`bindings/node`) or the browser artifact (`bindings/wasm`) for any release
  target. `.github/workflows/ci.yml` builds the CLI only as `cargo run --quiet -p secret-scan-cli
  -- --version` on three hosts (`.github/workflows/ci.yml:123-131`). `.github/workflows/python-wheels.yml` is the only
  workflow with a real artifact matrix. `Package Release Rehearsal` last ran on
  2026-09-01 against `545c3002`, which predates every binding.
- **Owner:** open issues #33 (*Build the cross-platform qualification matrix*) and
  #36 (*Complete the release-readiness audit*).
- **Exit condition:** one workflow builds the Node addon, the browser artifact,
  and the CLI binary for every declared release target from a single revision,
  and each artifact executes a smoke test on its own platform.
- **Severity:** release-blocking for #3.5 and #11.

### G-04 · `evidence-gap` · The canonical corpus expectations are asserted only through the Python binding

- **Criteria:** #3.3, #10.5 (and the parity claim underlying #6.1, #17.5, #18.4,
  #19.5).
- **Evidence:** `bindings/python/tests/test_conformance.py:48` is the only check
  in the repository that runs every non-`not-yet-evaluated` fixture of
  `conformance/fixtures/synchronous-corpus.json` (171 fixtures) through the Rust
  core and compares detector, type, confidence, and span against the corpus
  `expected` values. On the Rust side,
  `crates/secret-scan-core/tests/public_api.rs:134,163` iterate the same corpus
  but assert only self-consistency (char-aligned ranges; `scan_and_redact` equals
  `scan` then `redact`), and
  `crates/secret-scan-core/tests/detectors_conformance.rs` hand-codes three
  representative overlap cases instead of reading expectations from the corpus.
- **Owner:** open issue #63 (*Review the canonical core, conformance, and CLI
  boundaries*).
- **Exit condition:** a Rust integration test iterates every fixture with
  `support != "not-yet-evaluated"` in `conformance/fixtures/synchronous-corpus.json`, asserts the
  corpus `expected` detector/type/confidence/byte-range tuples against `scan`,
  fails if the fixture set is empty, and runs in the `CI` workflow.
- **Severity:** non-blocking — the parity fact is established by `PW@head`. The
  gap is that the canonical Rust surface cannot prove its own parity, and a
  regression there would be caught only by a Python job.

### G-05 · `evidence-gap` · No check ever loads a built Node addon or browser artifact

- **Criteria:** #8.3, #24.1, #24.5, #25.1, and the end-to-end reading of #27.
- **Evidence:** `packages/javascript/test/fake-binding.ts:1-9` states the reason
  in the tree: "The N-API addon and the WebAssembly artifact are built and
  published in lockstep with this package and are not present in a source
  checkout, so the lifecycle and normalization contracts are exercised against
  this recorded double instead." Both stream-adapter suites open sessions on
  `packages/javascript/test/sanitizing-binding.ts`
  (`packages/javascript/test/adapters/support.ts:1-30`), and
  `packages/javascript/test/package-import.node.test.ts:124` asserts the *absence*
  of the platform artifact ("reports a fixed error when the platform artifact is
  absent"). The bindings' own Rust-side unit tests do run — 12 in
  `bindings/node/src/` under `cargo test --workspace` on three hosts, and 26
  `wasm_bindgen_test`s in `bindings/wasm/src/` under the `Rust wasm32 target` job.
- **Owner:** open issue #33; behavioral review under #64.
- **Exit condition:** a check builds the N-API addon and the browser artifact and
  runs the JavaScript package's public API against the real binding, including
  at least one canonical-corpus fixture per surface.
- **Severity:** release-blocking for #8.3 — the published package's binding glue
  is the one layer no executed check covers end to end.

### G-06 · `evidence-gap` · The CLI never executes the canonical corpus

- **Criteria:** #10.5.
- **Evidence:** `crates/secret-scan-cli/tests/cli.rs` (33 tests) uses its own
  synthetic inputs and does not read `conformance/fixtures/`. Its parity
  arguments are internal — `check_and_redact_agree_on_the_same_input`
  (`crates/secret-scan-cli/tests/cli.rs:498`) and `redacted_output_matches_between_the_streamed_and_whole_file_paths`
  (`crates/secret-scan-cli/tests/cli.rs:478`).
- **Owner:** open issue #63.
- **Exit condition:** the CLI's `--redact` output over a set of canonical
  fixtures equals the corpus-expected redacted text, executed in `CI`.
- **Severity:** non-blocking; the CLI delegates detection to the core it links
  (`crates/secret-scan-cli/src/modes.rs`), and the core is corpus-verified.

### G-07 · `new-risk` · The full-corpus parity suite is path-filtered on pull requests

- **Criteria:** none directly; it weakens the evidence behind #6.1, #9.1, #17.5,
  #18.4, #19.5, #28.1, #29.1.
- **Evidence:** `bindings/python/tests` runs only through
  `scripts/qualify-python-wheel.py:401-424`, which the `Python wheels` workflow
  invokes. That workflow's `pull_request` trigger is filtered to
  `bindings/python/**`, `crates/secret-scan-core/**`, `conformance/**`,
  `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, two scripts, and its own file
  (`.github/workflows/python-wheels.yml:17-28`).
- **Owner:** open issue #65 (*Review CI, release automation, documentation, and
  supply-chain controls*).
- **Exit condition:** either the corpus parity suite runs unconditionally on every
  pull request, or the filter is documented as covering every input that can
  change corpus outcomes. The current filter does cover the core and the corpus,
  so present exposure is limited to changes that alter behavior from outside
  those paths.
- **Severity:** non-blocking, low.

### G-08 · `new-risk` · The release workflow publishes the legacy TypeScript package

- **Criteria:** none; no closed issue's criteria anticipated it.
- **Evidence:** `.github/workflows/release.yml:92-96` runs `npm run release:check`
  then `npm run release`, both resolved against the repository-root
  `package.json`, whose `build` is `tsc` over `src/` and whose `files` publish
  `dist` (`package.json` `scripts`, `files`). Nothing in `.github/workflows/release.yml` references
  `packages/javascript`. A publication from `main` today would ship the
  TypeScript detector core under the name `@omiologic/secret-scan`, which both
  the root and `packages/javascript/package.json` claim.
- **Owner:** open issues #34 (*Implement lockstep version and release-manifest
  checks*) and #35.
- **Exit condition:** the release workflow packs and publishes
  `packages/javascript` with its platform artifacts, or the root package is
  removed as a publishable target.
- **Severity:** release-blocking, and mitigated only by policy — `AGENTS.md`
  requires explicit approval before any release, and none has been given.

### G-09 · `intentional-exclusion` · The Go binding is not implemented

- **Criteria:** #3, "Out of scope: Implementing the deferred Go binding."
- **Evidence:** no Go source in the tree;
  `docs/decisions/2026-09-09-adopt-rust-core-monorepo.md:24-25,49` defers it and
  `ARCHITECTURE.md:390-391` records a Go binding, a stable C ABI, and a pure-Go
  detector fallback as non-goals.
- **Exit condition:** none. Recorded so its absence is not read as an omission.

### G-10 · `intentional-exclusion` · No version selection, tag, release, publication, or repository archival

- **Criteria:** #3 out-of-scope list; #11's "no publication is performed".
- **Evidence:** the repository has no tags at all; `Release` and
  `Reconcile Release` have no recorded runs (the whole Actions history is `CI`,
  `Python wheels`, and `Package Release Rehearsal`);
  `Cargo.toml` sets `publish = false` workspace-wide.
- **Exit condition:** none within this migration. A release requires the
  separate approval that `AGENTS.md` mandates.

### G-11 · `intentional-exclusion` · Custom detector callbacks are absent from the first stable API

- **Criteria:** #8 ("Custom detector callbacks are not part of the first stable
  API"), #23.5, #24.4, #26.5, #28.4.
- **Evidence:** verified as excluded rather than merely absent —
  `bindings/python/tests/test_import.py:41`
  (`test_no_custom_detector_callback_surface`),
  `packages/javascript/test/exact-exports.test.ts:44,66`,
  `crates/secret-scan-core/tests/incremental_partitions.rs:359`
  (`a_custom_synchronous_detector_remains_outside_the_incremental_api`), and
  `crates/secret-scan-core/src/detectors/mod.rs` keeping `detectors` a private
  module (`docs/rust-workspace.md:107`).
- **Exit condition:** none. A later API addition is a new decision.

### G-12 · `intentional-exclusion` · No pure-Python detector fallback

- **Criteria:** #9 ("No pure-Python detector fallback"), #28.4, #30.2.
- **Evidence:** `bindings/python/python/secret_scan/__init__.py` re-exports the
  native module only; `scripts/qualify-python-wheel.py` installs each wheel with
  `--only-binary` and no Rust toolchain on `PATH`
  (`docs/python-packaging.md:162`).
- **Exit condition:** none.

## Ledger — Epic and Features (#3–#10)

Criteria are numbered in the order the issue states them. `#8.C1` style numbers
are the issue's own **Public contract** clauses, recorded because they are part
of the contract the issue closed on. Issue text is quoted verbatim in italics.

### #3 — Migrate secret-scan to a Rust-core monorepo

Closed by PR #54. Its five *Completion criteria* are the migration's top-level
contract; three are aggregates over the Features below.

**#3.1** — *The canonical cross-language conformance contract is executable from one repository location.*
`met` — `conformance/` holds `conformance/schema.json`, `conformance/schema.ts`, `conformance/convert.ts`, `README.md`,
and five fixture files. Each consumer reads that one location:
`crates/secret-scan-core/tests/support/mod.rs:27,32` (`include_str!` of the
corpora), `bindings/python/tests/conftest.py:25`,
`test/conformance/canonical-oracle.test.ts:33`. Executed in `CI@head`
(TypeScript, Rust) and `PW@head` (Python).

**#3.2** — *Rust is the only built-in detector, policy, redaction, and incremental implementation.*
`partially-met` — Rust is the only implementation any *binding* uses
(`bindings/node`, `bindings/wasm`, `bindings/python`, `crates/secret-scan-cli` all
link `secret-scan`). The TypeScript implementation is still present and still
compiled by the repository-root package. Gap **G-01**; publication consequence
**G-08**.

**#3.3** — *Node N-API, browser WebAssembly, Python PyO3, public Rust crate, and CLI surfaces pass the same behavioral contract.*
`partially-met` — Python passes the full canonical corpus (`PW@head`); the Rust
crate passes the incremental corpus at every partition and the adversarial tier
with declared caps (`crates/secret-scan-core/tests/incremental_partitions.rs`, `crates/secret-scan-core/tests/adversarial_bounds.rs`, `CI@head`);
the CLI passes its own end-to-end suite. No surface-level canonical-corpus run
exists for the Node addon, the browser artifact, or the CLI. Gaps **G-04**,
**G-05**, **G-06**.

**#3.4** — *The TypeScript detector core is removed after parity is proven.*
`unverified` — not performed. Gap **G-01** (`planned-unmet`, issue #35).

**#3.5** — *Every required package and binary passes release qualification without publishing.*
`unverified` — qualification exists for the Python artifacts (8-target wheel matrix
plus sdist, `PW@head`), the Rust core package (`cargo package -p secret-scan
--locked`, `.github/workflows/ci.yml:84-85`), and the root npm tarball (`npm pack --dry-run` via
`npm run release:check`). Nothing qualifies the Node addon, the browser artifact,
the CLI binaries, or the `packages/javascript` tarball. Gap **G-03**
(`planned-unmet`, issues #33 and #36).

Out-of-scope clauses recorded as **G-09** (Go binding) and **G-10** (version, tag,
release, publication, archival).

### #4 — Establish the canonical cross-language conformance contract

Closed by hand. Its *Included behavior* list is covered by the fixture set:
canonical UTF-8 byte ranges (`conformance/schema.json`), detector/exclusion/
overlap/policy/redaction/incremental/Unicode/adversarial/safe-error evidence
(the five fixture files), synthetic inputs and plaintext-free expectations
(`conformance/README.md`), and deterministic mutation provenance with generated
coverage (`test/conformance/coverage.ts`, `test/conformance/COVERAGE.md`).

**#4.1** — *The top-level conformance corpus is the only source of behavioral fixtures.*
`partially-met` — the corpus is the single cross-language source and the only one
any binding reads. The TypeScript test tree still carries its own behavioral
fixtures. Gap **G-02**.

**#4.2** — *The current TypeScript implementation passes the migrated corpus before Rust parity work relies on it.*
`met` — `test/conformance/canonical-oracle.test.ts:112` ("produces exactly the
migrated expected findings and redacted output") and `:87` (no drift against a
fresh conversion). Landed in PR #39 (merge `06fe3df6`), before the first detector
port (PR #42, `64e7a95c`). Runs in `CI@head` via `npm test`.

**#4.3** — *Missing applicable coverage dimensions fail CI.*
`met` — `test/conformance/conformance.test.ts:44` ("requires positive, negative,
boundary, and adversarial cases per detector") and `:93` ("has no silent
stable-release coverage gaps"), over the dimension list in
`test/conformance/coverage.ts`. Runs in `CI@head`.

**#4.4** — *No fixture, failure, or expected public result exposes a real credential.*
`met` — the schema has no field that can carry a matched value
(`conformance/schema.ts:89-90`) and rejects one that tries
(`conformance/schema.ts:352`, `plaintext-bearing-expectation`); asserted by
`test/conformance/canonical-schema.test.ts:173` and `:195` ("keeps every
diagnostic path free of fixture input across all failure codes"). Inputs are
declared synthetic or revoked in `conformance/README.md`.

### #5 — Establish the Rust workspace and core pipeline

Closed by hand.

**#5.1** — *The Rust core uses `std` but performs no runtime network, filesystem, environment, telemetry, or secret-storage effects.*
`met` — the core's allowed-dependency allowlist is empty
(`Cargo.toml` `[workspace.metadata.secret-scan]`), enforced by
`scripts/check-rust-workspace.py` over normal and build graphs
(`npm run rust:check`, `.github/workflows/ci.yml:76-77`), with `cargo deny check --locked` on
sources, licenses, advisories, and bans (`.github/workflows/ci.yml:87-91`). Documented in
`docs/rust-workspace.md`.

**#5.2** — *Candidate resolution reproduces the documented specificity, confidence, span, registration, and emission precedence.*
`met` — `crates/secret-scan-core/src/pipeline.rs`; the full ladder is asserted in
`crates/secret-scan-core/tests/pipeline.rs:353,384,414,446,484,515,543,571`
(specificity over confidence and span, the private-key→provider→structural→
contextual→entropy ladder, omitted specificity ranking as entropy, narrower span,
registration order, emission order within one detector).

**#5.3** — *Public errors contain fixed codes and messages without input fragments.*
`met` — `crates/secret-scan-core/src/error.rs`; asserted by
`crates/secret-scan-core/tests/pipeline.rs:853,866,885` ("invalid candidate errors never echo input or
candidate fields") and pinned cross-language in
`conformance/fixtures/error-codes.json` with
`test/conformance/canonical-incremental-oracle.test.ts:283,310,323`.

**#5.4** — *Rust package naming and MSRV are documented from verified toolchain and registry evidence.*
`met` — `docs/rust-workspace.md:194-206` records the crates.io recheck for
`secret-scan`, `secret-scan-cli`, and the `omiologic-secret-scan` fallback, with a
documented recheck procedure at `:236`. MSRV `1.88` is pinned in
`Cargo.toml` (`rust-version`), derived from binding dependencies
(`docs/rust-workspace.md#msrv`), re-derived by
`scripts/check-rust-workspace.py`, and exercised by the `Rust MSRV` job
(`.github/workflows/ci.yml:133-154`) in `CI@head`.

### #6 — Reach synchronous Rust behavior parity

Closed by hand.

**#6.1** — *Known-format, structural, contextual, entropy, and malformed private-key behavior matches the canonical corpus.*
`met` — established by `bindings/python/tests/test_conformance.py:48` over all 171
corpus fixtures through the Rust core in `PW@head`, and supported by 105 focused
detector unit tests across `crates/secret-scan-core/src/detectors/` (16 of them in
`crates/secret-scan-core/src/detectors/private_key.rs`, covering malformed outer spans and lone headers). Evidence
locality is gap **G-04**.

**#6.2** — *Overlap resolution, actions, finding order and IDs, redacted output, and placeholder safety match the contract.*
`met` — `crates/secret-scan-core/tests/pipeline.rs:645,668,697`,
`crates/secret-scan-core/tests/detectors_conformance.rs` (named corpus overlap fixtures),
`crates/secret-scan-core/tests/policy_redaction.rs:47,90,124,153`, and 11 unit tests in
`crates/secret-scan-core/src/redact.rs`. Runs in `CI@head`.

**#6.3** — *Detector implementations remain bounded and deterministic.*
`met` — `crates/secret-scan-core/tests/adversarial_bounds.rs:95,138,148`
(declared input, finding-count, and runtime caps; determinism) over the corpus
adversarial tier, plus bounded scanning helpers in
`crates/secret-scan-core/src/detectors/pattern.rs` (6 tests). Runs in `CI@head`.

**#6.4** — *Findings and diagnostics never expose matched plaintext.*
`met` — `crates/secret-scan-core/tests/pipeline.rs:910` ("public findings carry metadata only"), `:885`,
`crates/secret-scan-core/tests/policy_redaction.rs:90` ("leaves no matched value in output or error"), and
`crates/secret-scan-core/tests/incremental.rs:817,854`.

### #7 — Reach bounded incremental Rust parity

Closed by hand.

**#7.1** — *Append, finalize, abort, session state, mandatory limits, absolute findings, and placeholder numbering match the contract.*
`met` — `crates/secret-scan-core/tests/incremental.rs:54-176` (states, single-use
finalize, abort precedence, mandatory positive limits and their documented
relationship), `:433,452,466` (absolute UTF-8 byte ranges), `:347,612` (placeholder
numbering across append and finalize). Cross-checked against
`conformance/fixtures/incremental-lifecycle-corpus.json` through
`bindings/python/tests/test_incremental.py:154` in `PW@head`.

**#7.2** — *Accepted input is partition-invariant across UTF-8 byte and host-native string boundaries.*
`met` — `crates/secret-scan-core/tests/incremental_partitions.rs:156,174,199`
(every host-native `char` boundary, every UTF-8 byte boundary, and a partition
inside a multi-byte code point) against the whole-input reference for every
fixture in `conformance/fixtures/incremental-corpus.json`, with `:135` guarding that the corpus is
loaded in full. Python code-point equivalent:
`bindings/python/tests/test_incremental_partitions.py:97,116`.

**#7.3** — *Abort and every failure discard retained plaintext and expose only fixed errors.*
`met` — `crates/secret-scan-core/tests/incremental.rs:110,796,817,854,873,931` and
`crates/secret-scan-core/tests/incremental_partitions.rs:292` ("no partition ever emits a detected
value").

**#7.4** — *Adversarial resource expectations remain bounded.*
`met` — `crates/secret-scan-core/tests/adversarial_bounds.rs:72,95,148,166,201,246`, including a
fragmented adversarial partition held to the same runtime cap and an
over-limit input failing with no output.

### #8 — Deliver the unified JavaScript package

Closed by hand.

**#8.C1** — *Every runtime calls `await initialize()` once, then uses synchronous scan, redaction, and incremental operations.*
`met` — `packages/javascript/src/runtime.ts`;
`packages/javascript/test/initialization-contract.test.ts:16,44,63` (refusal before initialize, loads
at most once however many callers await, a failed attempt is not cached) and
`packages/javascript/test/package-import.node.test.ts:84` (one initialization state shared across the
root and both adapters).

**#8.C2** — *JavaScript findings use UTF-16 code-unit ranges.*
`met` — `packages/javascript/src/types.ts`;
`packages/javascript/test/exact-exports.test.ts:50` ("states its range unit and its lockstep product
version") and `bindings/node/src/offsets.rs` (4 tests) /
`bindings/wasm/src/range.rs` (4 wasm tests) for the conversion itself.

**#8.C3** — *Policy and placeholder formatter callbacks receive safe metadata.*
`met` — `bindings/wasm/src/callbacks.rs` (8 wasm tests),
`bindings/node/src/lib.rs` (7 tests), and
`packages/javascript/test/initialization-contract.test.ts:149`.

**#8.C4** — *Custom detector callbacks are not part of the first stable API.*
`intentional-exclusion` — **G-11**, verified excluded by
`packages/javascript/test/exact-exports.test.ts:44,66`.

**#8.1** — *Node and browser select the correct artifact without leaking runtime-only imports.*
`met` — `packages/javascript/package.json` `imports["#native"]` plus
`packages/javascript/src/runtime/node.ts` and `packages/javascript/src/runtime/browser.ts`; asserted by
`packages/javascript/test/bundler.test.ts:40,55,66,85` and `packages/javascript/test/package-import.node.test.ts:39`,
`packages/javascript/test/package-import.browser.test.ts:65`, `packages/javascript/test/package-contents.test.ts:125`.

**#8.2** — *Root, Node stream, and Web stream package surfaces preserve their documented lifecycle and error behavior.*
`met` — `packages/javascript/test/exact-exports.test.ts:58`, `packages/javascript/test/package-import.node.test.ts:58`, and
the two adapter suites (13 Node-stream and 14 Web-stream tests covering
lifecycle, backpressure, destroy, cancel, abort, and fixed errors).

**#8.3** — *Browser bundles and supported Node imports pass package smoke tests.*
`partially-met` — resolution, bundling, and module-graph smoke tests pass
(`packages/javascript/test/package-import.browser.test.ts:33,65`, `packages/javascript/test/package-import.node.test.ts`,
`packages/javascript/test/bundler.test.ts:99`), all with the platform artifacts absent by design —
`packages/javascript/test/package-import.node.test.ts:124` asserts the fixed error for that case. No
check loads a built artifact. Gaps **G-05**, **G-03**.

**#8.4** — *Malformed UTF-8, cancellation, and abort never release retained plaintext.*
`met` — `packages/javascript/test/adapters/node-stream.test.ts:118,133,164,205,219,233` and
`packages/javascript/test/adapters/web-stream.test.ts:133,151,176,197,266,298`, over the core
guarantees proven in `crates/secret-scan-core/tests/incremental.rs`.

### #9 — Deliver the Python package

Closed by hand.

**#9.C1** — *CPython 3.10+ abi3 extension.*
`met` — `bindings/python/Cargo.toml` (`pyo3` `abi3-py310`),
`bindings/python/pyproject.toml`; `PW@head` builds every wheel as abi3 and smoke-
tests each on both the floor and the current interpreter
(`.github/workflows/python-wheels.yml:176-215`).

**#9.C2** — *Python code-point finding ranges.*
`met` — `bindings/python/tests/test_conformance.py:74` and `:48`, which converts
canonical byte offsets with an independent reference conversion, not the binding
under test.

**#9.C3** — *Immutable findings, sanitized exceptions, policy and formatter callbacks, and bounded incremental sessions.*
`met` — `bindings/python/tests/test_api.py:14,19`,
`bindings/python/tests/test_callback_failure.py:26-153`, `bindings/python/tests/test_incremental.py:55,287,296`, and the
exception hierarchy check in `bindings/python/tests/test_import.py:23`.

**#9.C4** — *No pure-Python detector fallback.*
`intentional-exclusion` — **G-12**.

**#9.1** — *Synchronous and incremental APIs pass canonical conformance after native range conversion.*
`met` — `bindings/python/tests/test_conformance.py:48,54` (with an explicit non-vacuity guard) and
`bindings/python/tests/test_incremental_partitions.py:83,97,116,128,147`, executed in `PW@head`.
Filter exposure is gap **G-07**.

**#9.2** — *Type information and package metadata are complete.*
`met` — `bindings/python/python/secret_scan/_native.pyi`;
`bindings/python/tests/test_typing.py:17,39,47` (every public native name has a stub declaration; PEP
561 marker) and `scripts/check-python-package.py` in both `npm run ci`
(`CI@head`) and the `Packaging policy` job (`PW@head`).

**#9.3** — *Supported Linux, macOS, and Windows wheels import and execute smoke tests.*
`met` — eight targets (`.github/workflows/python-wheels.yml:107-155`): manylinux and musllinux
x64/arm64, macOS x64/arm64, Windows x64/arm64. Every target is smoke-tested on
its own architecture (`smoke: host`, or `smoke: alpine` in a musl container), and
the smoke step installs the wheel and runs the whole `bindings/python/tests`
suite (`scripts/qualify-python-wheel.py:401-424`). The `Wheel matrix` job
re-requires the complete matrix (`.github/workflows/python-wheels.yml:253-254`). `PW@head`.

**#9.4** — *The sdist documents that a Rust toolchain is required when no wheel applies.*
`met` — `bindings/python/README.md:98-107` and `docs/python-packaging.md:190-212`;
`scripts/qualify-python-wheel.py:472-512` qualifies the sdist both without a Rust
toolchain on `PATH` (expecting a clear failure) and with one.

### #10 — Deliver the Rust crate and CLI

Closed by hand.

**#10.1** — *The public crate documents UTF-8 byte ranges, safe errors, policy and formatter traits, and incremental limits.*
`met` — `crates/secret-scan-core/src/lib.rs` module docs plus
`missing_docs = "warn"` under `RUSTFLAGS: -D warnings`, and
`cargo doc --workspace --no-deps --locked` with `RUSTDOCFLAGS: -D warnings`
(`.github/workflows/ci.yml:79-82`). The surface is pinned twice: `crates/secret-scan-core/tests/public_api.rs` from the
consumer side and `scripts/check-rust-workspace.py` from the manifest side.

**#10.2** — *CLI check mode emits safe metadata and fails when findings exist.*
`met` — `crates/secret-scan-cli/tests/cli.rs:189,197,242,264,286,303,316,333`
(clean exits 0, a finding exits 1, the JSON report is one object carrying no
matched text, and a check report never reproduces a private-key block).

**#10.3** — *CLI redact mode emits only sanitized text and never edits input in place.*
`met` — `crates/secret-scan-cli/tests/cli.rs:403,414,438,459,471,478` ("redact sanitizes exactly one file and
leaves it untouched").

**#10.4** — *Malformed input and processing failures do not expose plaintext.*
`met` — `crates/secret-scan-cli/tests/cli.rs:213,352,365,382,389,631` (missing file without an OS message,
malformed stdin and file fail closed with input-free diagnostics, a character
split across reads is not mistaken for malformed input, a closed downstream pipe
fails instead of hanging).

**#10.5** — *Crate and CLI execute the same canonical conformance contract.*
`partially-met` — the crate reads the canonical corpora directly
(`crates/secret-scan-core/tests/support/mod.rs:27,32`) and executes the incremental and adversarial tiers
in full; it does not assert the synchronous tier's `expected` values (**G-04**),
and the CLI does not read the corpus at all (**G-06**). Both surfaces link the
same `secret-scan` core, so the contract is shared by construction rather than by
assertion.

## Ledger — Tasks (#12–#32)

### #12 — Define the canonical fixture schema and UTF-8 range model

PR #37, merge `931b9498`.

**#12.1** — *Fixtures have stable IDs, support state, qualification tier, contexts, deterministic mutation provenance, synthetic input, and safe expectations.*
`met` — `conformance/schema.json` and `conformance/schema.ts` declare every one of
those fields; `test/conformance/canonical-schema.test.ts:39,43,56` asserts a
well-formed fixture, that `conformance/schema.json` stays structurally in sync with
`conformance/schema.ts`, and that a duplicate id is rejected with an input-free diagnostic.

**#12.2** — *Canonical expected ranges use UTF-8 byte offsets.*
`met` — declared in the corpus (`offsetUnit: "utf8-byte"`, re-asserted at
`bindings/python/tests/test_conformance.py:37` and
`test/conformance/canonical-oracle.test.ts:82`) and enforced by
`test/conformance/canonical-schema.test.ts:50,68` (byte length computed distinctly from UTF-16 code
units; a range using the true byte length accepted).

**#12.3** — *The schema rejects invalid, overlapping, out-of-bounds, or plaintext-bearing public expectations with input-free diagnostics.*
`met` — `conformance/schema.ts:263-373`; asserted by
`test/conformance/canonical-schema.test.ts:89,114,140,173,195` (out-of-bounds end, an offset
splitting a multi-byte character, overlap, a plaintext-bearing expectation, and
every failure code kept free of fixture input).

**#12.4** — *The existing TypeScript exporter is adapted as migration tooling rather than retained as the canonical source.*
`met` — `conformance/convert.ts` plus `scripts/migrate-conformance-corpus.ts` and
`scripts/migrate-incremental-corpus.ts`, wired as `npm run corpus:migrate` and
`corpus:migrate:incremental`; `test/conformance/conversion.test.ts:135-160`
converts the whole legacy corpus, passes canonical validation, round-trips every
byte offset back to UTF-16, and asserts no matched value survives conversion.

**#12.5** — *Unicode conversion fixtures cover astral characters before, within, and after findings.*
`met` — `conformance/fixtures/unicode-conversion-corpus.json` (3 fixtures);
`test/conformance/conversion.test.ts:81,118` (the three positions; the
astral-within span widened by exactly the extra bytes) and
`crates/secret-scan-core/src/types.rs:762` (corpus byte offsets are char-aligned).

### #13 — Migrate synchronous fixtures and prove the TypeScript oracle

PR #39 (issue closed by hand), merge `06fe3df6`.

**#13.1** — *Every currently supported detector family retains positive, near-miss, false-positive, context, overlap, mutation, and regression evidence where applicable.*
`met` — 171 fixtures in `conformance/fixtures/synchronous-corpus.json`;
`test/conformance/conformance.test.ts:30,44` asserts coverage of every built-in
detector and classification state and requires positive, negative, boundary, and
adversarial cases per detector, with mutation identity and order pinned at `:112`.

**#13.2** — *Expected results contain detector, type, confidence, specificity, action where relevant, and canonical ranges without matched plaintext.*
`met` — the schema's expectation shape (`conformance/schema.ts:89-90,253`) has no
field for a matched value; `test/conformance/canonical-schema.test.ts:173` proves the rejection
path.

**#13.3** — *TypeScript produces exactly the migrated expected findings and redacted output.*
`met` — `test/conformance/canonical-oracle.test.ts:112`, in `CI@head`.

**#13.4** — *Pending and intentionally unsupported cases retain their reviewed status.*
`met` — `test/conformance/canonical-oracle.test.ts:104` ("retains pending fixtures as reviewed but
unasserted"); consumers filter on the recorded `support` state rather than
dropping fixtures silently (`bindings/python/tests/test_conformance.py:39` with the
non-vacuity guard at `:54`).

**#13.5** — *Failures identify only fixture IDs and safe metadata.*
`met` — `test/conformance/conformance.test.ts:123` ("keeps validator and assertion
failures input-free"); the Rust and Python consumers likewise report `fixture.id`
only (`crates/secret-scan-core/tests/incremental_partitions.rs:66`,
`bindings/python/tests/test_conformance.py:46`).

### #14 — Migrate incremental, Unicode, adversarial, and safe-error evidence

PR #41, merge `82820003`.

**#14.1** — *Whole-input references and every UTF-16 and UTF-8 partition case are retained.*
`met` — `conformance/fixtures/incremental-corpus.json` (16 fixtures) carries the
whole-input reference; partitions are generated deterministically rather than
stored (`test/conformance/incremental-partitions.ts`,
`crates/secret-scan-core/tests/support/mod.rs:365-402`), which is what
`test/conformance/canonical-incremental-oracle.test.ts:176` checks for drift.

**#14.2** — *Lifecycle, abort, malformed UTF-8, buffer/token/multiline limits, resource caps, and safe-error codes are represented without plaintext diagnostics.*
`met` — `conformance/fixtures/incremental-lifecycle-corpus.json` (10 fixtures) and
`conformance/fixtures/error-codes.json`; asserted by
`test/conformance/canonical-incremental-oracle.test.ts:254,279,283,310,323` (every incremental
sanitizer code and every stream adapter code with its exact current message; no
registry lookup or message carries a matched value).

**#14.3** — *Unicode range conversion is asserted for JavaScript, Python, and Rust units.*
`met` — JavaScript: `test/conformance/conversion.test.ts:21,40,59,64,72`; Python:
`bindings/python/tests/test_conformance.py:74` and
`bindings/python/tests/test_incremental_unicode.py`; Rust: `crates/secret-scan-core/tests/pipeline.rs:332`
and `crates/secret-scan-core/src/types.rs:762,791`.

**#14.4** — *Generated coverage fails when an applicable incremental or adversarial dimension is absent.*
`met` — `test/conformance/coverage.ts` with
`test/conformance/conformance.test.ts:44,93`; generated matrix committed at
`test/conformance/COVERAGE.md`.

**#14.5** — *The TypeScript implementation passes the migrated corpus before Rust uses it as an oracle.*
`met` — same evidence as #4.2, and the merge order confirms the sequence: `82820003`
(#14) precedes `64e7a95c` (the first detector port).

### #15 — Scaffold the Rust workspace and enforce core boundaries

PR #38 (issue closed by hand), merge `482fd71a`.

**#15.1** — *Add `crates/secret-scan-core`, `crates/secret-scan-cli`, `bindings/node`, `bindings/wasm`, `bindings/python`, and `packages/javascript` ownership boundaries.*
`met` — all six exist; the five Rust members are declared in `Cargo.toml:12-18` and
the ownership table is `docs/rust-workspace.md:14`.

**#15.2** — *The core crate uses `std` but has no runtime network, filesystem, environment, telemetry, secret-storage, or UI dependencies.*
`met` — same enforcement as #5.1 (empty allowlist, `scripts/check-rust-workspace.py`,
`cargo deny`), in the `Rust format, lint, and dependency policy` job of `CI@head`.

**#15.3** — *Workspace format, lint, test, dependency, and unsafe-code policy is explicit.*
`met` — `Cargo.toml:42-56` (`unsafe_code = "deny"`, `missing_docs`,
`unwrap_used`/`expect_used`/`panic`/`todo`/`unimplemented` denied),
`clippy.toml`, `rustfmt.toml`, `deny.toml`; enforced by `cargo fmt --all --check`
and `cargo clippy --workspace --all-targets --locked -- -D warnings`
(`.github/workflows/ci.yml:70-74`).

**#15.4** — *The preferred crate name `secret-scan` is rechecked on crates.io; any registry-specific fallback is documented without changing the product name.*
`met` — `docs/rust-workspace.md:194-206` (the recheck, `secret_scan` normalization,
`secret-scan-cli`, and the available `omiologic-secret-scan` fallback) and `:236`
(the recheck procedure). The Python side exercised exactly this clause: the PyPI
distribution is `omiologic-secret-scan` while the product name stays `secret-scan`
(`docs/python-packaging.md:19,39`, `bindings/python/pyproject.toml:19-20`).

**#15.5** — *A supported MSRV is derived from selected binding dependencies, pinned in manifests, and exercised in CI.*
`met` — `Cargo.toml:23` (`rust-version = "1.88"`) and `:31-40` (the binding
requirements it is derived from), `.github/workflows/ci.yml:14` (`MSRV: "1.88"` with the comment
requiring the script to keep both in agreement), the `Rust MSRV` job
(`.github/workflows/ci.yml:133-154`), and the `Rust wasm32 target` job (`.github/workflows/ci.yml:156-190`) for the
wasm smoke check the issue's verification line asks for.

### #16 — Implement core types, sanitized errors, registry, and overlap resolution

PR #40, merge `4ae8972a`.

**#16.1** — *Define candidate, finding, confidence, specificity, action, policy, formatter, and UTF-8 range types with non-overlap and immutability guarantees.*
`met` — `crates/secret-scan-core/src/types.rs`; unit tests at `:682,704,729,740,791,801,817,850`
(identifier grammar, enum round-trip, precedence orderings, empty/reversed range
rejection, char alignment, default specificity, constructor validation, closures as
`Policy`/`PlaceholderFormatter`). Non-overlap of resolved findings is asserted in
`crates/secret-scan-core/tests/pipeline.rs:645`.

**#16.2** — *Implement entropy, detector registration order, candidate validation, and the documented overlap priority.*
`met` — `crates/secret-scan-core/src/entropy.rs` (4 tests, including order-insensitivity and a known
value), `crates/secret-scan-core/src/registry.rs:168,189,201,209` (registration order preserved, malformed
and duplicate ids rejected, built-ins first), `crates/secret-scan-core/src/pipeline.rs` with the ladder
tests listed under #5.2.

**#16.3** — *Reject invalid input and candidates with fixed public error codes and messages.*
`met` — `crates/secret-scan-core/src/error.rs:226` (`codes_and_messages_are_fixed`), `:287`
(`opaque_failures_carry_nothing`), and `crates/secret-scan-core/tests/pipeline.rs:138,170,209,256,288`.

**#16.4** — *Public results and errors never contain input fragments or matched values.*
`met` — `crates/secret-scan-core/tests/pipeline.rs:885,910`, `crates/secret-scan-core/src/registry.rs:224`
(`debug_output_shows_only_ids`).

**#16.5** — *Finding order and IDs are deterministic for identical input and configuration.*
`met` — `crates/secret-scan-core/tests/pipeline.rs:668,697,726` (ordered by offset and numbered from one;
identical input and configuration reproducible; a large finding set resolved and
numbered deterministically).

### #17 — Port known-format provider detectors

PR #42 (issue closed by hand), merge `64e7a95c`.

**#17.1** — *Cover AWS, GitHub, GitLab, OpenAI, Anthropic, Shopify, Vault, Stripe, Slack, PyPI, Hugging Face, Docker, Cloudflare, DigitalOcean, Linear, Supabase, and Vercel families.*
`met` — all seventeen are registered in
`crates/secret-scan-core/src/detectors/mod.rs:37-61`: `aws`, `github`, `gitlab`,
`openai`, `anthropic`, `shopify`, `vault` as their own modules and `STRIPE`,
`SLACK`, `PYPI`, `HUGGING_FACE`, `DOCKER`, `CLOUDFLARE`, `DIGITALOCEAN`, `LINEAR`,
`SUPABASE`, `VERCEL` in `crates/secret-scan-core/src/detectors/additional_providers.rs:63-173`. Registration order is
pinned by `crates/secret-scan-core/src/detectors/mod.rs:72,83` and by the corpus.

**#17.2** — *Preserve exact prefixes, alphabets, lengths, left/right boundaries, confidence, specificity, signals, and documented exclusions.*
`met` — per-detector unit tests (aws 6, github 7, gitlab 4, openai 7, anthropic 3,
shopify 4, vault 5, additional providers 5) plus the shared boundary helper
`crates/secret-scan-core/src/detectors/pattern.rs` (6 tests), against the corpus expectations run in
`PW@head`.

**#17.3** — *Replace the OpenAI negative lookahead with an explicit bounded boundary check compatible with the Rust regex engine.*
`met` — `crates/secret-scan-core/src/detectors/openai.rs:53-97`: a documented two-branch scan
(`proj-`/`svcacct-` first, then the bare form) with `pattern::boundary_ok` in place
of lookahead. Asserted by `crates/secret-scan-core/src/detectors/openai.rs:106,118,124,130,135,141,147`, including
exclusion of the `sk-ant-` namespace and of the versioned Anthropic token, and
non-exclusion of a bare key merely starting with `ant` without the dash.

**#17.4** — *Do not validate credential liveness or add network behavior.*
`met` — structurally impossible under the core's empty dependency allowlist
(#5.1); no network API is reachable from the core.

**#17.5** — *All provider conformance and adversarial cases pass.*
`met` — corpus expectations in `PW@head`; adversarial caps in
`crates/secret-scan-core/tests/adversarial_bounds.rs` in `CI@head`. Locality of
the corpus assertion is gap **G-04**.

### #18 — Port structural and bounded parser detectors

PR #43, merge `b579d401`.

**#18.1** — *Private-key parsing preserves supported labels, encoded-body evidence, LIFO delimiter handling, conservative malformed outer spans, and lone-header exclusions.*
`met` — `crates/secret-scan-core/src/detectors/private_key.rs` with 16 unit tests,
the largest detector suite in the crate, plus the corpus private-key fixtures.

**#18.2** — *Connection parsing preserves supported schemes, MongoDB seed and SRV rules, Redis password-only userinfo, IPv4/IPv6/port validation, encoded password ranges, placeholders, and authority limits.*
`met` — `crates/secret-scan-core/src/detectors/connection_string.rs` with 14 unit tests, plus the corpus
connection-string fixtures.

**#18.3** — *Both parsers remain deterministic, input-bounded, and free of plaintext diagnostics.*
`met` — `crates/secret-scan-core/tests/adversarial_bounds.rs:95,138` for bounds and determinism;
`crates/secret-scan-core/tests/pipeline.rs:885,910` and `crates/secret-scan-cli/tests/cli.rs:333` (a check report never reproduces a
private-key block) for diagnostics.

**#18.4** — *All malformed, overlap, regression, and adversarial fixtures pass.*
`met` — corpus expectations in `PW@head`; overlap cases named explicitly in
`crates/secret-scan-core/tests/detectors_conformance.rs`; adversarial tier in `CI@head`. Gap **G-04** for
locality.

### #19 — Port contextual, bearer, JWT, and entropy detection

PR #44, merge `ee65d476`.

**#19.1** — *Preserve quoted assignment escape parity, physical-line and 4096-unit bounds, contextual names, placeholder exclusions, and entropy thresholds.*
`met` — `crates/secret-scan-core/src/detectors/generic_token.rs` (11 unit tests) and `crates/secret-scan-core/src/entropy.rs`
(4 tests); the bound is exercised end to end by
`crates/secret-scan-cli/tests/cli.rs:512,525` against the declared token limit.

**#19.2** — *Preserve Basic, Token, and Bearer authorization grammar and boundaries.*
`met` — `crates/secret-scan-core/src/detectors/bearer_token.rs` (8 unit tests) plus the corpus bearer
fixtures.

**#19.3** — *Preserve the qualified three-segment JWT grammar and its intentional exclusions.*
`met` — `crates/secret-scan-core/src/detectors/jwt.rs` (6 unit tests); the JWT-over-Bearer precedence is
pinned by `crates/secret-scan-core/tests/detectors_conformance.rs:19` against corpus fixtures
`jwt-overlap-bearer` / `bearer-overlap-jwt`.

**#19.4** — *Entropy calculation and confidence decisions match the canonical corpus.*
`met` — `crates/secret-scan-core/src/entropy.rs:48,57,66,74` (empty and uniform inputs, scalar values not
bytes, permutation-insensitive determinism, a known value) with the corpus
entropy fixtures in `PW@head`.

**#19.5** — *Host-context, near-miss, false-positive, overlap, mutation, and adversarial cases pass.*
`met` — corpus expectations in `PW@head`, coverage dimensions enforced by
`test/conformance/conformance.test.ts:44`, adversarial tier in `CI@head`. Gap **G-04**.

### #20 — Implement policy, redaction, and placeholder safety

PR #45, merge `937e8af8`.

**#20.1** — *Default block, redact, warn, and allow actions match current documented behavior.*
`met` — `crates/secret-scan-core/src/policy.rs:109,118,129,152` (blocks private
keys, always redacts known types at any confidence, redacts high confidence and
warns otherwise, independent of policy context) and
`crates/secret-scan-core/tests/policy_redaction.rs:47`.

**#20.2** — *Policy receives immutable safe finding metadata and deterministic index/count context.*
`met` — `crates/secret-scan-core/tests/pipeline.rs:812,841` (policy evaluated with index and count; never
called when there are no findings), `crates/secret-scan-core/src/policy.rs:152`, and
`crates/secret-scan-core/tests/pipeline.rs:910`.

**#20.3** — *Redaction validates ranges, ordering, overlap, actions, identifiers, and formatter output.*
`met` — `crates/secret-scan-core/src/redact.rs:348,360,296,313` (overlapping findings, out-of-range
findings, empty and oversized placeholders, a placeholder containing an eligible
matched value) and `crates/secret-scan-core/tests/policy_redaction.rs:124,177`.

**#20.4** — *Formatter output is non-empty, bounded, and cannot reproduce any replaceable matched range that can fit in a placeholder.*
`met` — `crates/secret-scan-core/src/redact.rs:296,313,334` and `crates/secret-scan-core/tests/policy_redaction.rs:153`
(`redact_rejects_a_placeholder_that_reproduces_a_short_caller_supplied_finding`);
mirrored per binding in `bindings/python/tests/test_placeholder_safety.py:31,45,58`.

**#20.5** — *Redaction reconstructs output in one ordered pass and never exposes matched values through errors.*
`met` — `crates/secret-scan-core/src/redact.rs:233` (`reconstructs_repeated_and_adjacent_values_in_one_deterministic_pass`),
`:249,263,276,286,372`, and `crates/secret-scan-core/tests/policy_redaction.rs:90`.

### #21 — Implement incremental session state, retention, and limits

PR #47, merge `ab0b524c`.

**#21.1** — *Support accepting, finalized, aborted, and failed states with exactly one valid finalization.*
`met` — `crates/secret-scan-core/tests/incremental.rs:54,60,71,93,102,110`.

**#21.2** — *Require positive input, buffered, token, and multiline limits with the documented relationship and lookaround reserve.*
`met` — `crates/secret-scan-core/tests/incremental.rs:140,157,166,176`; the reserve is re-asserted from the
Python surface at `bindings/python/tests/test_incremental.py:101`
(`test_buffer_limit_must_cover_the_documented_lookaround_window`).

**#21.3** — *Retain unresolved single-line and PEM constructs without rescanning finalized input.*
`met` — `crates/secret-scan-core/tests/incremental.rs:245,259,273,290,310` (a bearer header split across a
physical line stays open; a contextual name without its operator stays open; an
unrelated open line does not block flushing a prior closed line; a PEM block
stays retained until its delimiter stack resolves, and resolves to one finding
even split one byte at a time).

**#21.4** — *Emit only text whose detection and policy result is final.*
`met` — `crates/secret-scan-core/tests/incremental.rs:214,227,338` and
`crates/secret-scan-core/tests/incremental_partitions.rs:292` ("no partition ever emits a detected
value").

**#21.5** — *Keep whole-input acceptance independent of transport chunk partitioning.*
`met` — `crates/secret-scan-core/tests/incremental.rs:381,401` and the full partition proof in
`crates/secret-scan-core/tests/incremental_partitions.rs:149,156,174`.

### #22 — Preserve incremental policy, findings, and failure cleanup

PR #51, merge `6e2be42c`.

**#22.1** — *Findings use deterministic global IDs and absolute UTF-8 byte ranges.*
`met` — `crates/secret-scan-core/tests/incremental.rs:433,452,466` (synchronous IDs, ordering and absolute
ranges reproduced; ranges are offsets into the whole session input and count bytes,
not characters).

**#22.2** — *Placeholder numbering continues across append and finalize results.*
`met` — `crates/secret-scan-core/tests/incremental.rs:347,612,630,656,694`; Python equivalent at
`bindings/python/tests/test_incremental_partitions.py:147`.

**#22.3** — *Incremental policy receives only safe metadata and the finalized finding index.*
`met` — `crates/secret-scan-core/tests/incremental.rs:513,543,561,581,591`
(`the_incremental_policy_context_carries_nothing_but_the_finalized_index`) and
`crates/secret-scan-core/tests/incremental_partitions.rs:472`
(`the_incremental_policy_context_exposes_no_total_finding_count`).

**#22.4** — *Abort and detector, policy, formatter, state, decode, or limit failures discard all retained plaintext.*
`met` — `crates/secret-scan-core/tests/incremental.rs:110,719,769,796,931`; Python equivalent at
`bindings/python/tests/test_incremental.py:520,530,550,559`.

**#22.5** — *Fixed input-free error codes distinguish the documented failure classes.*
`met` — `crates/secret-scan-core/tests/incremental.rs:854`
(`every_incremental_failure_class_has_its_own_fixed_input_free_code`), `:873`,
`:902`, and the cross-language registry
`conformance/fixtures/error-codes.json` checked at
`test/conformance/canonical-incremental-oracle.test.ts:283`.

### #23 — Prove partition invariance and bounded adversarial behavior

PR #53, merge `e663bf72`.

**#23.1** — *Enumerate every UTF-8 byte boundary and applicable host-native string boundary for representative cases.*
`met` — `crates/secret-scan-core/tests/incremental_partitions.rs:156,174,199` with generators in
`crates/secret-scan-core/tests/support/mod.rs:365-402`, and `:135` guarding the corpus is loaded in full.

**#23.2** — *Concatenated text, findings, actions, order, IDs, absolute ranges, and placeholder numbering equal the whole-input reference.*
`met` — `crates/secret-scan-core/tests/incremental_partitions.rs:66` (`assert_matches_reference`, the single
comparison every partition case funnels through) and `:149`.

**#23.3** — *Acceptance does not change when finalized safe output accumulates in a single append call.*
`met` — `crates/secret-scan-core/tests/incremental_partitions.rs:233`
(`acceptance_is_unchanged_when_finalized_safe_output_accumulates_in_one_append`).

**#23.4** — *Adversarial fixtures remain within declared input, finding-count, and runtime caps.*
`met` — `crates/secret-scan-core/tests/adversarial_bounds.rs:72,95,148,166,201` including a fragmented
partition held to the same runtime cap, with `runtime_budget_ms` at `:45`
documenting the tolerance applied to the declared cap.

**#23.5** — *Unsupported custom synchronous detectors and whole-input count-dependent policies fail or remain outside the incremental API as documented.*
`intentional-exclusion` — `crates/secret-scan-core/tests/incremental_partitions.rs:359,417,493`
(`a_custom_synchronous_detector_remains_outside_the_incremental_api`,
`a_whole_input_count_dependent_policy_has_no_incremental_equivalent`, and the
default policy shown count-independent so it partitions safely). Recorded as
**G-11**.

### #24 — Implement the Node N-API binding

PR #46, merge `962c6569`.

**#24.1** — *Support Node.js 20 and later on the release matrix targets.*
`unverified` — `packages/javascript/package.json` declares `engines.node >= 20` and
`CI@head` runs the JavaScript suites on Node 20 and 22 (`.github/workflows/ci.yml:26-29`), but the
addon itself is never built for any target, so "on the release matrix targets" has
no evidence. Gaps **G-05**, **G-03**.

**#24.2** — *Convert Rust UTF-8 byte ranges to JavaScript UTF-16 code-unit ranges without changing spans.*
`met` — `bindings/node/src/offsets.rs` (4 unit tests) and
`bindings/node/src/lib.rs:372`, whose case documents that it mirrors a
`conformance/fixtures/synchronous-corpus.json` boundary. Run by
`cargo test --workspace --locked` on ubuntu, macOS, and Windows in `CI@head`.

**#24.3** — *Map immutable findings, options, policy callbacks, formatter callbacks, and fixed errors to the JavaScript contract.*
`met` — `bindings/node/src/lib.rs` (7 tests) and `bindings/node/src/error.rs`
(1 test), with the JavaScript side of the same contract asserted against the
recorded double in `packages/javascript/test/initialization-contract.test.ts:115,138,190,279,294`.

**#24.4** — *Do not expose custom detector callbacks in the first stable API.*
`intentional-exclusion` — **G-11**;
`packages/javascript/test/exact-exports.test.ts:44,66`.

**#24.5** — *Initialization is idempotent and compatible with the common JavaScript wrapper.*
`partially-met` — the wrapper half is proven
(`packages/javascript/test/initialization-contract.test.ts:44,63,182`,
`packages/javascript/test/package-import.node.test.ts:84`); the addon half is not, because no check
loads it. Gap **G-05**.

### #25 — Implement the browser WebAssembly binding

PR #48, merge `26956d83`.

**#25.1** — *`initialize()` loads the WebAssembly module explicitly, is idempotent, and reports fixed input-free initialization failures.*
`partially-met` — `bindings/wasm/src/lifecycle.rs` (3 wasm tests) and
`bindings/wasm/src/error.rs` (3) cover the binding's own lifecycle and fixed
errors under the `Rust wasm32 target` job; the wrapper's loader contract is covered
at `packages/javascript/test/initialization-contract.test.ts:44,63,81,91,104`
("never surfaces a loader's own failure message"; rejects an artifact built from a
different product version). No check loads a real built artifact. Gap **G-05**.

**#25.2** — *Calls before successful initialization fail deterministically without retaining input.*
`met` — `packages/javascript/test/initialization-contract.test.ts:16,34` ("does not inspect its input
before initialize succeeds"), `packages/javascript/test/package-import.node.test.ts:104`,
`packages/javascript/test/package-import.browser.test.ts:88`, and
`bindings/wasm/src/lifecycle.rs`.

**#25.3** — *UTF-8 byte ranges convert exactly to JavaScript UTF-16 code-unit ranges.*
`met` — `bindings/wasm/src/range.rs` (4 wasm tests) and
`bindings/wasm/src/finding.rs` (2), executed against `wasm32-unknown-unknown` in
`CI@head` (`.github/workflows/ci.yml:186-190`).

**#25.4** — *Policy and formatter callbacks receive only safe metadata.*
`met` — `bindings/wasm/src/callbacks.rs` (8 wasm tests) and
`bindings/wasm/src/metadata.rs`.

**#25.5** — *The browser dependency graph contains no Node-only modules.*
`met` — `packages/javascript/test/package-contents.test.ts:125` ("keeps the Web
adapter free of Node-only modules"), `packages/javascript/test/bundler.test.ts:40,66`, and
`packages/javascript/test/package-import.browser.test.ts:65` (bundles the Web adapter without
resolving a Node-only module).

### #26 — Build the common npm wrapper and initialization contract

PR #52, merge `fbe94316`.

**#26.1** — *All runtimes require one successful `await initialize()` before synchronous operations.*
`met` — `packages/javascript/src/runtime.ts`;
`packages/javascript/test/initialization-contract.test.ts:16,44,63,238`,
`packages/javascript/test/package-import.node.test.ts:84,104`,
`packages/javascript/test/package-import.browser.test.ts:88`.

**#26.2** — *Export `scan`, `redact`, `scanAndRedact`, incremental creation, supported policy/formatter helpers, safe errors, and documented types only.*
`met` — `packages/javascript/test/exact-exports.test.ts:44,58` pins the exact export sets for the root
and both adapter subpaths, and `:66` keeps every documented internal module
unreachable.

**#26.3** — *Conditional exports never route browser builds through Node native or `node:` dependencies.*
`met` — `packages/javascript/package.json` `imports["#native"]` +
`exports`; `packages/javascript/test/bundler.test.ts:40,55,66,85,99` (the platform artifacts stay out
of the module graph until `initialize`) and
`packages/javascript/test/package-contents.test.ts:107,120,148`.

**#26.4** — *Declarations preserve immutable findings and explicit UTF-16 offset semantics.*
`met` — `packages/javascript/test/type-contracts.ts` type-checked by
`npm run js:typecheck`; `packages/javascript/test/exact-exports.test.ts:50`,
`packages/javascript/test/initialization-contract.test.ts:115,138,190`
(frozen findings, frozen findings list, frozen results), and
`packages/javascript/test/package-contents.test.ts:141` (implementation details kept out of the
published declarations).

**#26.5** — *Unsupported internal paths and custom detector APIs are not published.*
`met` — `packages/javascript/test/package-contents.test.ts:57,75,107` and
`packages/javascript/test/exact-exports.test.ts:66`; **G-11** for the detector API. The issue's
verification line also asks for README example tests, which exist at
`packages/javascript/test/readme-examples.test.ts:49,70,85,109` (every public capability documented,
both adapter subpaths documented, examples importing only real exports, and every
example type-checked against the published declarations).

### #27 — Restore Node and Web stream adapters on the Rust core

PR #55, merge `2b8b0f1a`. Every criterion below is verified against
`packages/javascript/test/sanitizing-binding.ts`, a deterministic double that
implements the internal binding contract; the adapters are glue over one session,
so the double exercises the glue faithfully but not the Rust session behind it
(**G-05**).

**#27.1** — *Accept UTF-8 byte chunks with one fatal stateful decoder so multibyte characters may cross chunks.*
`met` — `packages/javascript/test/adapters/node-stream.test.ts:33,48,233` and
`packages/javascript/test/adapters/web-stream.test.ts:50,65` (identical sanitization at every UTF-8 byte
boundary; one decoder carried across a character-splitting chunk; a stream ending
mid-character rejected).

**#27.2** — *Emit only finalized sanitized output and expose immutable absolute findings after normal finalization.*
`met` — `packages/javascript/test/adapters/node-stream.test.ts:59,72` and `packages/javascript/test/adapters/web-stream.test.ts:77,87` (frozen findings
on flush; absolute offsets into the whole stream, not into a chunk).

**#27.3** — *Node destroy, Web cancellation, writable abort, and explicit abort discard retained plaintext.*
`met` — `packages/javascript/test/adapters/node-stream.test.ts:118,133,164` and
`packages/javascript/test/adapters/web-stream.test.ts:133,151,176,197,220`.

**#27.4** — *Backpressure and errors propagate through host-native stream contracts.*
`met` — `packages/javascript/test/adapters/node-stream.test.ts:89,184` (stalls the producer at backpressure and
resumes on drain) and `packages/javascript/test/adapters/web-stream.test.ts:104,241` (stalls writes at readable
backpressure and resumes after a pull).

**#27.5** — *Root and Web imports never resolve Node-only modules.*
`met` — same evidence as #25.5, plus `packages/javascript/test/adapters/web-stream.test.ts:318` and
`packages/javascript/src/adapters/web-stream.ts` importing only shared code.

### #28 — Implement the PyO3 synchronous API

PR #49, merge `d3540d01`.

**#28.1** — *Provide immutable finding/result types, sanitized exceptions, scan, redact, scan-and-redact, documented policy helpers, and formatter helpers.*
`met` — `bindings/python/src/lib.rs` (3 tests) and
`bindings/python/python/secret_scan/__init__.py`;
`bindings/python/tests/test_api.py:14,19,27`, `bindings/python/tests/test_import.py:11,17,23`,
`bindings/python/tests/test_callback_failure.py:89,153` (delegation to the default policy and the
default formatters). Executed in `PW@head`.

**#28.2** — *Python policy and formatter callbacks receive only safe metadata and callback failures become fixed exceptions.*
`met` — `bindings/python/tests/test_callback_failure.py:26,42,54,66,102,118,132`.

**#28.3** — *Convert canonical UTF-8 byte ranges to Python Unicode code-point indices exactly.*
`met` — `bindings/python/tests/test_conformance.py:48,74`, converting with an independent
reference conversion rather than the binding under test
(`tests/conftest.py:byte_offset_to_char_offset_reference`).

**#28.4** — *Do not include a pure-Python detector or custom detector callback surface.*
`intentional-exclusion` — **G-11**, **G-12**;
`bindings/python/tests/test_import.py:41`.

**#28.5** — *Repeated input produces deterministic findings and redacted output.*
`met` — `bindings/python/tests/test_api.py:48` and
`bindings/python/tests/test_placeholder_safety.py:14,71`.

### #29 — Expose incremental sanitization to Python

PR #57, merge `16adcd2e`.

**#29.1** — *Provide append, finalize, abort, state, mandatory limits, immutable results, and documented lifecycle failures.*
`met` — `bindings/python/src/incremental.rs` (4 tests);
`bindings/python/tests/test_incremental.py:55,64,75,95,154,198,205,222,254,262,268,274,287`
(limits mandatory and keyword-only, read-only, the lifecycle matched against
`conformance/fixtures/incremental-lifecycle-corpus.json`, and the context manager aborting a session
left accepting).

**#29.2** — *Findings use absolute Python code-point indices and stable IDs across calls.*
`met` — `bindings/python/tests/test_incremental.py:320` and
`bindings/python/tests/test_incremental_partitions.py:128`.

**#29.3** — *Policy and formatter callbacks preserve the incremental safe-metadata contract.*
`met` — `bindings/python/tests/test_incremental.py:334,364,382,396`.

**#29.4** — *Abort and all failures discard retained plaintext.*
`met` — `bindings/python/tests/test_incremental.py:445,489,520,530,550,559`
(`test_a_repr_never_carries_retained_text`).

**#29.5** — *Partitioning Python strings does not change accepted results within declared limits.*
`met` — `bindings/python/tests/test_incremental_partitions.py:74,83,97,116` (with a non-vacuity
guard), the code-point analogue of the Rust byte-boundary proof.

### #30 — Package and qualify CPython abi3 wheels

PR #59, merge `135dbc56`.

**#30.1** — *Package distribution name is `secret-scan` and import name is `secret_scan`, subject to final registry availability verification.*
`met` — the criterion's own registry clause was exercised: the PyPI name
`secret-scan` belongs to another project, so the distribution is
`omiologic-secret-scan` (`bindings/python/pyproject.toml:19-20`,
`docs/python-packaging.md:19,39`) while the import name stays `secret_scan` and the
product name is unchanged. `scripts/check-python-package.py --recheck-pypi-name`
re-verifies on demand; the packaging contract is enforced in `npm run ci`
(`CI@head`) and the `Packaging policy` job (`PW@head`).

**#30.2** — *Target CPython 3.10+ through abi3 without a pure-Python runtime fallback.*
`met` — `bindings/python/Cargo.toml:26` (`pyo3` with `abi3-py310`),
`bindings/python/pyproject.toml:23` (`requires-python = ">=3.10"`); every wheel is smoke-tested on
both the abi3 floor and a current interpreter
(`.github/workflows/python-wheels.yml:176-215`). **G-12** for the absent fallback.

**#30.3** — *Build manylinux and musllinux x64/arm64, macOS x64/arm64, and Windows x64/arm64 wheels where the selected toolchain supports them.*
`met` — all eight targets build in `PW@head` (`.github/workflows/python-wheels.yml:107-155`), and the
`Wheel matrix` job re-requires the complete set from the downloaded artifacts
(`:253-254`). `scripts/check-python-package.py` keeps the workflow matrix and the
declared manifest in agreement (`.github/workflows/python-wheels.yml:14-15`).

**#30.4** — *Wheels install without a local Rust toolchain and pass import plus conformance smoke tests.*
`met` — each wheel is installed with `--only-binary` and no Rust toolchain, then the
whole `bindings/python/tests` suite runs against the installed wheel
(`scripts/qualify-python-wheel.py:401-424`), natively per architecture:
`smoke: host` for glibc/macOS/Windows, `smoke: alpine` in a `python:<v>-alpine`
container for musl (`.github/workflows/python-wheels.yml:194-215`). This is also the run that
establishes #6.1 and #9.1.

**#30.5** — *The sdist fails clearly or builds with a documented Rust toolchain when no wheel applies.*
`met` — `scripts/qualify-python-wheel.py:472-512` qualifies both paths
(installation with `cargo` removed from `PATH`, then `--build-sdist` with it
present); the `Source distribution` job runs it in `PW@head`; documented at
`bindings/python/README.md:98-107` and `docs/python-packaging.md:190-212`.

### #31 — Stabilize the public Rust crate

PR #56, merge `1e1ac7cf`.

**#31.1** — *Provide idiomatic scan, redact, scan-and-redact, incremental, policy, formatter, finding, result, and sanitized error APIs.*
`met` — `crates/secret-scan-core/tests/public_api.rs` reaches every item through a
`secret_scan::` path, so a rename or removal fails compilation; the manifest side
is pinned by `scripts/check-rust-workspace.py` (`npm run rust:check`, `CI@head`).

**#31.2** — *Public ranges are UTF-8 byte offsets into the original input.*
`met` — `crates/secret-scan-core/tests/public_api.rs:105-131`
(`public_ranges_are_utf8_byte_offsets_into_the_original_input`, asserting at
`:126` that the range indexes the original input and never the sanitized text) and `:134` over every supported corpus fixture.

**#31.3** — *Built-in detector registry internals and retention tuning remain private.*
`met` — `crates/secret-scan-core/src/detectors/mod.rs` is `pub(crate)`; the module-privacy assertions in
`crates/secret-scan-core/tests/public_api.rs` fail to compile if an internal is re-exposed
(`crates/secret-scan-core/tests/public_api.rs:1-9`), and `docs/rust-workspace.md:107` records the intent.

**#31.4** — *The crate performs no runtime I/O and has no binding-specific dependency.*
`met` — same enforcement as #5.1, plus `cargo package -p secret-scan --locked`
proving the published core builds on its own (`.github/workflows/ci.yml:84-85`) in `CI@head`.

**#31.5** — *The public package name is reverified before manifests are finalized.*
`met` — `docs/rust-workspace.md:194-206,236`; manifests still carry
`publish = false` (`Cargo.toml:28`), so no name is finalized for publication yet
(**G-10**).

### #32 — Implement check and redact CLI modes

PR #58, merge `c671b95b`. Verified by `crates/secret-scan-cli/tests/cli.rs`
(33 tests over the real built binary) plus 40 unit tests across
`crates/secret-scan-cli/src/`, on ubuntu, macOS, and Windows in `CI@head`.

**#32.C1** — *Default check mode reads stdin when no path is supplied and otherwise accepts multiple file paths.*
`met` — `crates/secret-scan-cli/tests/cli.rs:136,145,157,176` (including a path that looks like an option being
reachable after `--`).

**#32.C2** — *Check returns exit 0 when clean, exit 1 when any finding exists, and exit 2 for usage, decoding, or processing failure.*
`met` — `crates/secret-scan-cli/tests/cli.rs:189,197,203,213,224` (`a_failure_outranks_a_finding`).

**#32.C3** — *Check output contains only safe file identity and finding metadata, never matched plaintext.*
`met` — `crates/secret-scan-cli/tests/cli.rs:242,264,286,303,316,333`.

**#32.C4** — *`--redact` accepts stdin or exactly one file and writes sanitized text to stdout.*
`met` — `crates/secret-scan-cli/tests/cli.rs:403,414,459,471`.

**#32.C5** — *Redact never modifies input in place.*
`met` — `crates/secret-scan-cli/tests/cli.rs:414` (`redact_sanitizes_exactly_one_file_and_leaves_it_untouched`).

**#32.C6** — *Malformed UTF-8 fails closed with an input-free diagnostic.*
`met` — `crates/secret-scan-cli/tests/cli.rs:352,365,382,389`.

**#32.1** — *Streaming and whole-file paths use the canonical core and explicit limits.*
`met` — `crates/secret-scan-cli/src/modes.rs` and `crates/secret-scan-cli/src/limits.rs` (2 unit tests);
`crates/secret-scan-cli/tests/cli.rs:478,498,512,525,541` (redacted output identical between the streamed and
whole-file paths; check and redact agree; an open construct past the token limit
fails the run; an ordinary long line behaves the same either way).

**#32.2** — *Broken pipes, partial reads, aborts, and failures do not release retained plaintext.*
`met` — `crates/secret-scan-cli/tests/cli.rs:631` (a closed downstream pipe fails the run instead of hanging),
`:389` (a character split across reads is not mistaken for malformed input),
`:333`, and `crates/secret-scan-cli/src/failure.rs` / `crates/secret-scan-cli/src/input.rs` (8 unit tests).

**#32.3** — *Help and machine-consumable safe reporting are documented and tested.*
`met` — `crates/secret-scan-cli/tests/cli.rs:573,582,595` (help documents the modes, the exit codes, and the
reporting shape; `--version` reports the product version alone; both reject extra
arguments) and `crates/secret-scan-cli/src/report.rs` (7 unit tests) with `crates/secret-scan-cli/tests/cli.rs:242,264,316`.

## Appendix A — what each recorded workflow verifies

Several criteria above are satisfied only by a job that is not part of `CI`. This
appendix is what makes those citations checkable.

### `CI` (`.github/workflows/ci.yml`) — every pull request and every push to `main`

| Job | What it runs | Criteria it carries |
|---|---|---|
| `Node 20` / `Node 22` | `npm ci --ignore-scripts` then `npm run ci` = `decisions:validate` + `python:check` + `typecheck` + `test` (TypeScript oracle, conformance corpus validation, coverage enforcement) + `js:typecheck` + `js:test` (the JavaScript package against its in-tree doubles) | #4.2, #4.3, #4.4, #8.*, #9.2, #12.*, #13.*, #14.*, #26.*, #27.*, #30.1 |
| `Rust format, lint, and dependency policy` | `cargo fmt --all --check`; `cargo clippy --workspace --all-targets --locked -- -D warnings`; `npm run rust:check` (API surface, boundaries, versions, MSRV, package contents); `cargo doc --workspace --no-deps --locked` with `RUSTDOCFLAGS: -D warnings`; `cargo package -p secret-scan --locked`; `cargo deny check --locked` | #5.1, #5.3, #5.4, #10.1, #15.2, #15.3, #15.5, #17.4, #31.1, #31.4 |
| `Rust native host (ubuntu / macos / windows)` | `cargo test --workspace --locked` — the core's 6 integration suites, the CLI's 33 end-to-end tests, and the bindings' Rust-side unit tests — then a CLI `--version` smoke check against the product version | #5.2, #6.*, #7.*, #10.2–#10.4, #16.*, #17–#23, #24.2, #24.3, #31.*, #32.* |
| `Rust MSRV` | `cargo check --workspace --all-targets --locked` on Rust 1.88 | #15.5 |
| `Rust wasm32 target` | `cargo check -p secret-scan -p secret-scan-wasm --target wasm32-unknown-unknown`; then `cargo test -p secret-scan-wasm --target wasm32-unknown-unknown` under `wasm-bindgen-test-runner` (26 `wasm_bindgen_test`s) | #25.1–#25.4 |

`CI` does **not** build the N-API addon, build the browser artifact, run
`bindings/python/tests`, or assert the canonical synchronous corpus's `expected`
values against the Rust core.

### `Python wheels` (`.github/workflows/python-wheels.yml`) — path-filtered pull requests, every push to `main`, and manual dispatch

| Job | What it runs | Criteria it carries |
|---|---|---|
| `Packaging policy` | `scripts/check-python-package.py` — identity, abi3 contract, and matrix/manifest agreement | #9.2, #30.1, #30.3 |
| `Source distribution` | builds the sdist, qualifies it with and without a Rust toolchain on `PATH` | #9.4, #30.5 |
| `Wheel <target>` × 8 | maturin build per target, then install with `--only-binary` and no Rust toolchain and run the whole `bindings/python/tests` suite on the abi3 floor and a current interpreter, natively per architecture | #6.1, #9.1, #9.3, #9.C1–#9.C3, #17.5, #18.4, #19.5, #28.*, #29.*, #30.2, #30.4 |
| `Wheel matrix` | re-requires the complete 8-target matrix from the downloaded artifacts | #30.3 |

The `Wheel <target>` job is the only place the full canonical synchronous corpus
is asserted against the Rust core (**G-04**), and its `pull_request` trigger is
path-filtered (**G-07**).

### `Package Release Rehearsal` (`.github/workflows/package-release-rehearsal.yml`)

Two recorded runs, both `success`, both on 2026-09-01 against `545c3002` — before
the Rust workspace existed. It carries no criterion in this ledger.

### `Release` and `Reconcile Release`

No recorded runs. Recorded as **G-10**; `Release`'s current contents are **G-08**.

## Appendix B — how to re-derive this ledger

Nothing here requires a workflow run.

```bash
# Original criteria, verbatim, for the closed set.
gh api graphql -f owner=omiologic -f name=secret-scan -f query='
query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
  issues(first:40, orderBy:{field:CREATED_AT,direction:ASC}){
    nodes{number title state closedAt body}}}}'

# Closure provenance: which PR closed which issue, and its merge commit.
gh api graphql -f owner=omiologic -f name=secret-scan -f query='
query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
  pullRequests(first:40, orderBy:{field:CREATED_AT,direction:ASC}){
    nodes{number mergedAt headRefName mergeCommit{oid}
      closingIssuesReferences(first:5){nodes{number}}}}}}'

# Recorded Actions results only — never a dispatch.
gh run list --limit 200 --json databaseId,workflowName,headSha,event,conclusion

# The repository's own gate, which is what this document was verified against.
npm run ci
```
