# Release-gap disposition

One disposition for every finding the Rust-core migration retrospective
produced — the closed-issue acceptance evidence ledger and the three
independent reviews — required by issue #66 under Feature #61 and Epic #60.

- **Assessed revision:** `fdfd05a` (`main`, merge of PR #70, *CI, release
  automation, documentation, and supply-chain controls review*), the first
  revision at which all four retrospective inputs exist together.
- **Assessed on:** 2026-09-09.
- **Inputs:** 55 findings — 12 ledger gaps and 43 review findings — plus the
  150 criterion classifications the ledger recorded.
- **Authority:** this document classifies and routes findings. It does not
  change behavior, change closed-issue state, select a version, or authorize
  any release operation. Every remediation Task it specifies is work for
  Feature #11 to perform and for the final audit (#36) to judge.

## What this document decides, and what it does not

The four retrospective inputs each stop at the same line: they record evidence
and an exact exit condition per finding, and each one states that disposition
belongs to #66. None of them decides what blocks a release. This document makes
that decision once, against the test issue #66 states, and routes each finding
to exactly one of four destinations:

| Destination | Meaning |
|---|---|
| **blocker** | Cited by exactly one remediation Task under Feature #11. |
| **deferred** | Recorded in [the deferred quality backlog](./deferred-quality-backlog.md); does not block Epic #60. |
| **intentional exclusion** | Deliberately out of scope; no work is created from it. |

It does not re-verify the inputs. Every claim below is either quoted from one of
the four documents or a span read at the assessed revision, and each Task's
acceptance criteria are written so that a reader can check the Task without
re-reading the review that produced it. Where this disposition disagrees with an
input's own severity reading, the disagreement is stated and reasoned in place.

No plaintext secret value, matched value, fixture input, or credential-shaped
string appears here. Detector ids, finding types, error codes, offsets, secret
*names* (`NPM_TOKEN`), file paths, and workflow identifiers are safe metadata
and are used freely.

## Source namespaces

The four inputs each number their findings from `F-01`, so this document
prefixes every id with its source. A Task's `Sources:` line uses these ids and
no others.

| Prefix | Document | Ids |
|---|---|---|
| `L/G-nn` | [Closed-issue acceptance evidence ledger](./closed-issue-acceptance-evidence-ledger.md) | `L/G-01` – `L/G-12` |
| `C/F-nn` | [Canonical core, conformance, and CLI boundary review](./core-conformance-cli-boundary-review.md) | `C/F-01` – `C/F-08` |
| `B/F-nn` | [JavaScript and Python bindings and package contracts review](./javascript-python-bindings-package-contracts-review.md) | `B/F-01` – `B/F-12` |
| `R/F-nn` | [CI, release automation, documentation, and supply-chain controls review](./ci-release-automation-supply-chain-review.md) | `R/F-01` – `R/F-23` |

Criterion ids are the ledger's: `#3.4` is the fourth completion criterion of
issue #3, `#8.C4` the fourth of issue #8's out-of-scope clauses as the ledger
numbered them.

## The blocker test

Issue #66 states it, and this document applies it verbatim. A finding is a
release blocker **only** when it:

| Test | Clause |
|---|---|
| **(a)** | violates a public contract or security boundary; |
| **(b)** | leaves a promised platform or artifact unqualified; |
| **(c)** | leaves lockstep release safety incomplete; or |
| **(d)** | leaves a mandatory original criterion `partially-met` or `unverified`. |

Three readings settle almost every case, and are applied consistently:

1. **(a) is present tense.** A *violated* contract blocks; an *unguarded* one
   does not. `B/F-02` blocks because the published types declare
   `start`/`end` as `number` and the browser runtime hands a callback
   `undefined` — a stated declaration contradicted at runtime. `C/F-04` does
   not, because the review verified that the built-in type names and
   `ALWAYS_REDACT_TYPES` agree at this revision; what is missing is the guard
   that keeps them agreeing. `B/F-08` does not, for the same reason: the
   TypeScript and Rust formatters diverge only for a non-ASCII type name, and
   every built-in type name is ASCII today. Missing guards over currently
   correct behavior are real findings and are deferred, not ignored.
2. **(b) is satisfied either way.** A promise can be met by qualifying the
   platform or by narrowing the promise. `R/F-23` (`engines.node >= 20` against
   a `[20, 22]` matrix) and `R/F-10` (a documented browser surface no engine
   ever runs) are blockers because the tree currently *claims* support it
   cannot show; each Task below accepts a narrowed claim as a valid exit.
3. **(d) reads "mandatory" as "not excluded".** Every acceptance criterion in a
   closed issue's body is mandatory unless that issue placed it out of scope.
   The ledger recorded 7 `partially-met` and 3 `unverified` criteria; all ten
   are cited by a Task below. The 5 `intentional-exclusion` criteria are not.

**Severity is not the test.** Two findings the reviews rated `medium` are
blockers here (`R/F-07`, `R/F-08`, both under (c)), and one the reviews left
unrated as blocking is a blocker under (a) (`B/F-04`). Two findings a review
rated blocking are *also* blockers here for a different clause than the review
argued. Where severity and the test disagree, the test wins; the reviews'
severities are preserved in the tables so the disagreement is visible.

## Disposition of all 55 findings

26 blockers across 9 Tasks, 25 deferred, 4 intentional exclusions.

| ID | Class | Review severity | Disposition | Owner |
|---|---|---|---|---|
| `L/G-01` | `planned-unmet` | blocking | blocker (a), (d) | **RB-2** |
| `L/G-02` | `planned-unmet` | non-blocking | blocker (d) | **RB-2** |
| `L/G-03` | `planned-unmet` | blocking | blocker (b), (d) | **RB-4** |
| `L/G-04` | `evidence-gap` | non-blocking | blocker (d) | **RB-1** |
| `L/G-05` | `evidence-gap` | blocking | blocker (b), (d) | **RB-4** |
| `L/G-06` | `evidence-gap` | non-blocking | blocker (d) | **RB-1** |
| `L/G-07` | `new-risk` | low | deferred | backlog |
| `L/G-08` | `new-risk` | blocking | blocker (a), (c) | **RB-2** |
| `L/G-09` | `intentional-exclusion` | — | intentional exclusion | none |
| `L/G-10` | `intentional-exclusion` | — | intentional exclusion | none |
| `L/G-11` | `intentional-exclusion` | — | intentional exclusion | none |
| `L/G-12` | `intentional-exclusion` | — | intentional exclusion | none |
| `C/F-01` | `new-risk` | low, non-blocking | deferred | backlog |
| `C/F-02` | `new-risk` | low, non-blocking | deferred | backlog |
| `C/F-03` | `evidence-gap` | medium | deferred | backlog |
| `C/F-04` | `evidence-gap` | medium | deferred | backlog |
| `C/F-05` | `evidence-gap` | low | deferred | backlog |
| `C/F-06` | `stale-claim` | medium | deferred | backlog |
| `C/F-07` | `evidence-gap` | low | blocker (d) | **RB-1** |
| `C/F-08` | `new-risk` | low, cosmetic | deferred | backlog |
| `B/F-01` | `new-risk` | blocking | blocker (a) | **RB-3** |
| `B/F-02` | `new-risk` | blocking | blocker (a) | **RB-3** |
| `B/F-03` | `new-risk` | blocking | blocker (b) | **RB-9** |
| `B/F-04` | `evidence-gap` | medium | blocker (a) | **RB-2** |
| `B/F-05` | `new-risk` | medium | deferred | backlog |
| `B/F-06` | `evidence-gap` | medium | blocker (a) | **RB-3** |
| `B/F-07` | `new-risk` | medium | blocker (a) | **RB-3** |
| `B/F-08` | `new-risk` | medium | deferred | backlog |
| `B/F-09` | `stale-claim` | low | deferred | backlog |
| `B/F-10` | `evidence-gap` | low | deferred | backlog |
| `B/F-11` | `new-risk` | low | blocker (c) | **RB-5** |
| `B/F-12` | `evidence-gap` | low | deferred | backlog |
| `R/F-01` | `new-risk` | blocking | blocker (a), (c) | **RB-2** |
| `R/F-02` | `new-risk` | blocking | blocker (b), (c) | **RB-7** |
| `R/F-03` | `new-risk` | blocking | blocker (b) | **RB-9** |
| `R/F-04` | `new-risk` | blocking | blocker (a), (c) | **RB-8** |
| `R/F-05` | `evidence-gap` | blocking | blocker (b), (d) | **RB-4** |
| `R/F-06` | `new-risk` | medium | deferred | backlog |
| `R/F-07` | `stale-claim` | medium | blocker (c) | **RB-6** |
| `R/F-08` | `new-risk` | medium | blocker (c) | **RB-6** |
| `R/F-09` | `new-risk` | medium | blocker (c) | **RB-5** |
| `R/F-10` | `stale-claim` | medium | blocker (b) | **RB-4** |
| `R/F-11` | `new-risk` | medium | deferred | backlog |
| `R/F-12` | `stale-claim` | medium | blocker (a) | **RB-2** |
| `R/F-13` | `evidence-gap` | low | deferred | backlog |
| `R/F-14` | `evidence-gap` | low | deferred | backlog |
| `R/F-15` | `new-risk` | low | split: `main` protection → blocker (c); rest deferred | **RB-8** + backlog |
| `R/F-16` | `new-risk` | low | deferred | backlog |
| `R/F-17` | `evidence-gap` | low | deferred | backlog |
| `R/F-18` | `stale-claim` | low | deferred (closed as a side effect of **RB-7**) | backlog |
| `R/F-19` | `stale-claim` | low | deferred, plus a ruling below | backlog |
| `R/F-20` | `new-risk` | low | deferred | backlog |
| `R/F-21` | `new-risk` | low | deferred | backlog |
| `R/F-22` | `stale-claim` | low | deferred | backlog |
| `R/F-23` | `evidence-gap` | low | blocker (b) | **RB-4** |

### Where this disposition departs from an input's severity

| ID | Input severity | Disposition | Why |
|---|---|---|---|
| `L/G-02` | non-blocking | blocker | `#4.1` is a mandatory `partially-met` criterion, so (d) applies. The work is the same removal as `L/G-01`, so it costs nothing extra to close it properly. |
| `L/G-04`, `L/G-06`, `C/F-07` | non-blocking / low | blocker | `#3.3` and `#10.5` are mandatory `partially-met` criteria, so (d) applies. The reviews are right that parity is a *fact*; the blocker is that the canonical Rust surface and the CLI cannot demonstrate it. |
| `B/F-04` | medium | blocker | `packages/javascript/package.json` declares `license: "MIT"` and lists `"LICENSE"` in `files`; the file does not exist, so the shipped tarball would contradict its own manifest — (a). The check that should catch it copies the file in before packing, so it can never fail. |
| `R/F-07`, `R/F-08` | medium | blocker | `decision-release-bindings-in-lockstep` and `#11.2` require a recorded manifest, and `#11.3` requires reconcile to be safe under partial publication. Both are (c). |
| `R/F-23` | low | blocker | Both manifests claim every Node major from 20 upward and CI runs `[20, 22]`, so a promised platform is unqualified — (b). The exit may narrow `engines.node` instead of widening the matrix. |
| `C/F-01`, `C/F-02` | low, non-blocking | deferred, confirmed | Both were checked against (a) explicitly. `C/F-01` cannot forge the exit code a hook or CI job branches on and involves no matched plaintext; `C/F-02` fails closed and wrote 0 bytes. Neither violates the enforcement or plaintext boundary. |
| `C/F-03`, `C/F-04`, `B/F-08` | medium | deferred | Each is a missing guard over behavior the reviews verified correct at this revision, not a violated contract. Deferred with its severity intact. |
| `B/F-05` | medium | deferred | The review records that the divergence "is unobservable while a caller obeys the documented rule", and `packages/javascript/src/index.ts:56` states that rule. The contract is underspecified across runtimes, not violated. |

## Release-blocker remediation Tasks

Nine Tasks, each bounded to one change with one owner. Every Task records the
source finding ids it closes, the blocker clause that makes it a blocker, its
inputs, its outputs, deterministic acceptance criteria, its dependencies, and
the exact evidence that lets the final audit (#36) mark it exited. Together they
cite all 26 blocking findings, and no finding is cited by two Tasks.

None of these Tasks authorizes a release operation. `RB-6`, `RB-7`, and `RB-8`
touch the release and reconcile paths; none of them may create a tag, publish a
package, or dispatch `Release` or `Reconcile Release` to satisfy its own exit
evidence.

| Task | Issue | Title |
|---|---|---|
| `RB-1` | [#71](https://github.com/omiologic/secret-scan/issues/71) | Assert the canonical corpus on the Rust core and on the CLI |
| `RB-2` | [#72](https://github.com/omiologic/secret-scan/issues/72) | Remove the TypeScript detector core and repoint the published npm artifact |
| `RB-3` | [#73](https://github.com/omiologic/secret-scan/issues/73) | Make the browser WebAssembly runtime satisfy the adapter contract |
| `RB-4` | [#74](https://github.com/omiologic/secret-scan/issues/74) | Qualify the Node addon, browser artifact, and CLI binaries from one revision |
| `RB-5` | [#75](https://github.com/omiologic/secret-scan/issues/75) | Bring every version-bearing manifest into lockstep |
| `RB-6` | [#76](https://github.com/omiologic/secret-scan/issues/76) | Record a release manifest and make reconcile consume it |
| `RB-7` | [#77](https://github.com/omiologic/secret-scan/issues/77) | Gate publication on the full qualification set from one commit |
| `RB-8` | [#78](https://github.com/omiologic/secret-scan/issues/78) | Enforce release approval in automation and protect the release refs |
| `RB-9` | [#79](https://github.com/omiologic/secret-scan/issues/79) | Decide what the first release ships, and give each shipped artifact a publication path |

All nine are sub-issues of Feature #11. The deferred remainder is held by
[#80](https://github.com/omiologic/secret-scan/issues/80), which has no parent by
design.

### RB-1 · Assert the canonical corpus on the Rust core and on the CLI

- **Issue:** #71.
- **Sources:** `L/G-04`, `L/G-06`, `C/F-07`.
- **Blocker clause:** (d) — `#3.3` and `#10.5` are mandatory and
  `partially-met`.
- **Related existing Task:** none. The ledger attributed `L/G-04` and `L/G-06`
  to #63, which is a review, not remediation.
- **Inputs.** `conformance/fixtures/synchronous-corpus.json` (the 171 fixtures
  with `support != "not-yet-evaluated"`);
  `bindings/python/tests/test_conformance.py:48`, the only existing assertion of
  the corpus `expected` values and therefore the reference for this one;
  `crates/secret-scan-core/tests/support/mod.rs:27,32`, which already
  `include_str!`s the corpora; `crates/secret-scan-core/tests/public_api.rs:134,163`,
  which iterates the same corpus but asserts only self-consistency;
  `crates/secret-scan-core/tests/detectors_conformance.rs`, which hand-codes
  three overlap cases; `crates/secret-scan-cli/tests/cli.rs`, which reads no
  fixture; `.github/workflows/ci.yml`'s `rust-native` job.
- **Outputs.** One Rust integration test under
  `crates/secret-scan-core/tests/`, one CLI integration test under
  `crates/secret-scan-cli/tests/`, both executed by `cargo test --workspace
  --locked` in `ci.yml`'s `rust-native` job.
- **Acceptance criteria.**
  1. A Rust integration test iterates every fixture with
     `support != "not-yet-evaluated"` in `synchronous-corpus.json` and asserts,
     per fixture, the corpus `expected` detector id, finding type, confidence,
     and UTF-8 byte range against `scan`.
  2. That test fails when the iterated fixture set is empty.
  3. A CLI integration test runs the built `secret-scan` binary in redact mode
     over a set of canonical fixtures and asserts its output equals the
     corpus-expected redacted text.
  4. Neither test embeds a fixture input or a matched value in its own source;
     both read from `conformance/fixtures/`.
  5. Both run in `ci.yml`'s `rust-native` job on all three hosts — not only in
     `Python wheels`.
- **Dependencies.** None. **Blocks `RB-2`**: `#3.4` requires the TypeScript core
  to be removed *after* parity is proven, and this Task is what proves it on the
  canonical surface.
- **Exit evidence.** One `CI` run at the Task's merge commit whose `rust-native`
  job log shows both tests passing and the asserted fixture count, with that
  count recorded on the Task.

### RB-2 · Remove the TypeScript detector core and repoint the published npm artifact

- **Issue:** #72.
- **Sources:** `L/G-01`, `L/G-02`, `L/G-08`, `R/F-01`, `R/F-12`, `B/F-04`.
- **Blocker clauses:** (a) two manifests claim `@omiologic/secret-scan` and the
  reachable one publishes an implementation `ARCHITECTURE.md:391` excludes, with
  a README documenting an `initialize` export that package does not have and a
  manifest naming a `LICENSE` file that does not exist; (c) a publication from
  `main` today ships the wrong artifact under the product name; (d) `#3.2` and
  `#4.1` are `partially-met` and `#3.4` is `unverified`.
- **Related existing Task:** #35 (*Cut over documentation and remove the
  TypeScript detector core*). This Task is the bounded, finding-linked form of
  that work; #35 stays open as its parent context and is not superseded.
- **Inputs.** `src/detectors/` (13 detector modules plus `index.ts`),
  `src/scan.ts`, `src/incremental.ts`, `src/policy.ts`, `src/redact.ts`,
  `src/registry.ts`, `src/entropy.ts`; the behavioral suites in
  `test/detectors/`, `test/false-positives/`, and `test/integration/`;
  `package.json` `scripts.build` and `files`, `tsconfig.json`
  (`rootDir: "src"` → `outDir: "dist"`); `.github/workflows/release.yml:92-98`;
  `README.md:22-26,353`; `packages/javascript/package.json` (same `name`,
  `license: "MIT"`, `"LICENSE"` in `files`, no `LICENSE` file);
  `packages/javascript/test/package-contents.test.ts:27-54` (copies `LICENSE`
  in at `:41`, asserts it at `:64`); the repository-root `LICENSE`.
- **Outputs.** The TypeScript detector core and its behavioral fixture suites
  deleted; exactly one manifest declaring the product name; a tracked
  `packages/javascript/LICENSE`; a package-contents test that packs the real
  directory; a `Release` workflow that cannot publish the oracle.
- **Acceptance criteria.**
  1. `src/detectors/`, `src/scan.ts`, `src/incremental.ts`, `src/policy.ts`,
     `src/redact.ts`, `src/registry.ts`, and `src/entropy.ts` are absent and
     `npm run ci` passes without them.
  2. No behavioral expectation over detector, policy, or redaction output
     exists outside `conformance/fixtures/`. Focused unit tests over an
     internal helper are not behavioral fixtures and are out of scope, exactly
     as `L/G-02`'s exit condition carves out.
  3. Exactly one tracked manifest declares `name: "@omiologic/secret-scan"`.
  4. `packages/javascript/LICENSE` exists as a tracked file and
     `npm pack --dry-run` inside `packages/javascript` lists it.
  5. `packages/javascript/test/package-contents.test.ts` packs
     `packages/javascript` itself, pre-populates nothing, and fails if
     `LICENSE` is removed from the tree.
  6. Either the `Release` publish step resolves to an artifact carrying a
     native or WebAssembly entry point, or a guard step fails the workflow when
     the packed tarball carries neither *and* `README.md`'s migration section
     states in one sentence that no release automation currently targets a
     shippable artifact. Which branch applies is `RB-9`'s decision.
  7. Every example in the README that ships inside the published tarball runs
     against the package that ships it, and `test/readme-examples.test.ts`
     extracts its examples from that README rather than restating them, so
     drift in either direction fails.
- **Dependencies.** `RB-1` (parity proven on the canonical surface, per `#3.4`),
  `RB-3` (the browser runtime must initialize before `packages/javascript` can
  be the published artifact), `RB-9` (which artifact the release ships).
- **Exit evidence.** Green `CI` at the merge commit; the list of deleted paths;
  `npm pack --dry-run` output for every remaining publishable manifest,
  recorded on the Task and showing the `LICENSE` entry and a native or
  WebAssembly entry point (or the guard step's failure on a tarball with
  neither).

### RB-3 · Make the browser WebAssembly runtime satisfy the adapter contract

- **Issue:** #73.
- **Sources:** `B/F-01`, `B/F-02`, `B/F-06`, `B/F-07`.
- **Blocker clause:** (a) — every browser `await initialize()` rejects against
  the real artifact, and a callback's `finding.start`/`finding.end` are
  `undefined` where `packages/javascript/src/types.ts` declares them `number`.
  Also (d): `#25.1` is `partially-met`.
- **Related existing Task:** none. The defects were found by review #64 after
  #25 closed; no open Task owns them.
- **Inputs.** `packages/javascript/src/runtime/browser.ts` — the
  `createIncrementalSanitizer` export it requires and `toWasmFinding` at
  `:91-95`; `bindings/wasm/src/lib.rs`, `metadata.rs`, `finding.rs`,
  `lifecycle.rs`, `error.rs`; `packages/javascript/src/types.ts`
  (`SecretFinding`); `packages/javascript/src/runtime.ts`
  `toFormatterCallback` (freezes) and `toPolicyCallback` (does not);
  `packages/javascript/test/fake-binding.ts` and
  `packages/javascript/test/sanitizing-binding.ts`, both of which implement the
  flat Node shape; `packages/javascript/src/errors.ts`.
- **Outputs.** A browser runtime that initializes; one normalizing, freezing
  conversion shared by both callback paths; a third test double that produces
  the WebAssembly binding's shape.
- **Acceptance criteria.**
  1. `await initialize()` on the browser entry point resolves against the built
     artifact. If incremental sanitization is deliberately unavailable on the
     browser, `createIncrementalSanitizer` and `./web-stream` instead reject
     with a fixed code declared in `packages/javascript/src/errors.ts` and
     documented, and `initialize()` still resolves.
  2. On both runtimes, a `policy` callback and a `formatter` callback each
     receive a finding whose `start` and `end` are numbers, matching
     `packages/javascript/src/types.ts`.
  3. `Object.isFrozen` holds for the finding a `policy` callback receives, as
     it already does on the formatter path.
  4. A third test double reproducing exactly what
     `bindings/wasm/src/{lib,metadata,finding}.rs` produce — nested `range`,
     opaque handles, the generated `default` init — is injected through
     `createSecretScanRuntime` the way the existing doubles are, and runs the
     same lifecycle, callback, and stream assertions the Node double runs.
  5. Reverting the browser normalization makes at least one test fail, so the
     contract is pinned rather than merely fixed.
- **Dependencies.** None. **Blocks `RB-4`** (a browser job cannot pass until the
  runtime initializes) and **`RB-2`**.
- **Exit evidence.** `npm run js:test` output at the merge commit showing the
  WebAssembly-shaped double's suite; the `Rust wasm32 target` job green; and one
  recorded `initialize()` against a locally built artifact, with the build
  command recorded. `RB-4` supplies the CI engine; this Task supplies the
  contract.

### RB-4 · Qualify the Node addon, browser artifact, and CLI binaries from one revision

- **Issue:** #74.
- **Sources:** `L/G-03`, `L/G-05`, `R/F-05`, `R/F-10`, `R/F-23`.
- **Blocker clauses:** (b) six N-API targets, a documented browser surface, CLI
  binaries, and `engines.node >= 20` are all promised and none is qualified;
  (d) `#3.3`, `#8.3`, `#24.5`, `#25.1` are `partially-met` and `#3.5`, `#24.1`
  are `unverified`.
- **Related existing Task:** #33 (*Build the cross-platform qualification
  matrix*). This Task is its bounded, finding-linked form; the unit is the one
  `L/G-03`'s own exit condition already defined.
- **Inputs.** `bindings/node/package.json` `napi.targets` — six triples:
  `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`,
  `x86_64-apple-darwin`, `aarch64-apple-darwin`, `x86_64-pc-windows-msvc`,
  `aarch64-pc-windows-msvc`; `bindings/node/smoke-test.mjs`;
  `Cargo.toml:173-182` `python-wheel-targets` (eight triples, the shape a
  qualified matrix already has); `.github/workflows/ci.yml:20-29` (Node matrix
  `[20, 22]`), `:123-131` (the CLI built only as
  `cargo run --quiet -p secret-scan-cli -- --version` on three hosts),
  `:186-190` (`WASM_BINDGEN_TEST_ONLY_NODE: "1"`);
  `scripts/check-python-package.py:270-290`, the existing model for pinning a
  declared matrix to the workflow that builds it; `package.json:67-69` and
  `packages/javascript/package.json:51-53`, both `engines.node: ">=20"`.
- **Outputs.** One workflow that builds all three artifact families for every
  declared target from a single revision and smoke-tests each on its own
  platform; a declared CLI release-target list; a matrix-pinning check with unit
  tests; a browser job in a real engine; a reconciled Node support claim.
- **Acceptance criteria.**
  1. One workflow builds, from a single revision, the N-API addon for every
     triple in `napi.targets`, the browser artifact, and the CLI binary for
     every declared CLI release target.
  2. Each built artifact executes a smoke test on the architecture it targets.
     A target with no available runner is built and recorded as
     cross-compiled-only, visibly, in the job name or the step summary.
  3. `bindings/node/smoke-test.mjs` runs against the built addon, not a double.
  4. Either a job loads `packages/javascript`'s browser entry point in a
     headless browser engine and runs at least initialization plus one
     whole-input canonical-corpus fixture, or `README.md` and `ARCHITECTURE.md`
     state that browser support is unqualified until such a job exists.
  5. A check in the style of `scripts/check-python-package.py:270-290` fails
     when a target is in `napi.targets` and not in the workflow matrix, or the
     reverse, with a unit test in `scripts/tests/` covering both directions.
  6. The Node matrix covers every major `engines.node` claims, or `engines.node`
     is narrowed in every manifest that declares it to the range CI exercises;
     either way a check binds the declaration to the matrix so they cannot
     drift.
  7. The JavaScript package's public API runs against the real Node addon and
     the real browser artifact, including at least one canonical-corpus fixture
     per surface.
- **Dependencies.** `RB-3`. **Blocks `RB-7`** (the jobs must exist before
  publication can require them) and **`RB-9`**.
- **Exit evidence.** One recorded run of the new workflow at the Task's merge
  commit listing every target with its smoke-test result; the `napi.targets`
  list and the workflow matrix recorded side by side; the reconciled
  `engines.node` value and the Node matrix it matches.

### RB-5 · Bring every version-bearing manifest into lockstep

- **Issue:** #75.
- **Sources:** `R/F-09`, `B/F-11`.
- **Blocker clause:** (c) — a reversible probe recorded in `R/F-09` set
  `packages/javascript/package.json` to `9.9.9-probe.0` and both lockstep
  scripts still reported `0 error(s)`, so the lockstep guarantee `#11.2`
  requires does not cover the manifest the product will publish under.
- **Related existing Task:** #34 (*Implement lockstep version and
  release-manifest checks*).
- **Inputs.** `scripts/check-rust-workspace.py:54`
  (`LOCKSTEP_MANIFESTS = ("package.json", "bindings/node/package.json")`) and
  `:178-186`, the comparison it drives; `packages/javascript/package.json:54`
  and `package.json:70`, both `0.1.0-beta.1`, absent from and present in that
  tuple respectively; the workspace version in `Cargo.toml`;
  `scripts/tests/test_check_rust_workspace.py`; `docs/rust-workspace.md`.
- **Outputs.** A lockstep set covering every version-bearing manifest, a
  per-manifest drift test, and a recorded statement of the cutover's effect on
  the root manifest's version.
- **Acceptance criteria.**
  1. Every tracked manifest carrying a product version is in
     `LOCKSTEP_MANIFESTS`, or is removed by the cutover with that removal
     recorded.
  2. `npm run rust:check` reports at least one error when any single manifest in
     that set is set to a different version, and
     `scripts/tests/test_check_rust_workspace.py` asserts that for each member
     of the set individually.
  3. `docs/rust-workspace.md` states which version `packages/javascript` first
     publishes under and what happens to the root manifest at cutover.
- **Dependencies.** None. Coordinates with `RB-2`, which may remove one of the
  manifests; whichever lands second reconciles the set.
- **Exit evidence.** The new unit-test names, and `npm run rust:check` output
  for one deliberately drifted manifest recorded on the Task and then reverted;
  green `npm run ci` at the merge commit.

### RB-6 · Record a release manifest and make reconcile consume it

- **Issue:** #76.
- **Sources:** `R/F-07`, `R/F-08`.
- **Blocker clause:** (c) — `decision-release-bindings-in-lockstep`,
  `ARCHITECTURE.md`, and `#11.2` all require a recorded manifest that no
  workflow writes, and `#11.3` requires reconcile to be safe under partial
  publication while reconcile can only ever repair `main`'s exact tip.
- **Related existing Task:** #34.
- **Inputs.** `docs/decisions/2026-09-09-release-bindings-in-lockstep.md` and
  `ARCHITECTURE.md`, which together name the five fields the manifest must
  carry; `.github/workflows/release.yml`, which records none of them durably;
  `.github/workflows/reconcile-release.yml:23-25,46-51`, which compares the
  publication against `GITHUB_SHA` of `main` and forces `refs/heads/main`.
- **Outputs.** A durable manifest record emitted by every `Release` run, and a
  reconcile path that reads the published commit from it.
- **Acceptance criteria.**
  1. Every `Release` run, including one that fails, emits a durable record
     carrying all five fields the ADR names: source revision, conformance
     corpus identity, artifact set, version, and registry state.
  2. `Reconcile Release` reads the published commit from that record, or accepts
     it as a workflow input, instead of re-deriving it from `GITHUB_SHA`.
  3. Reconcile verifies the target commit is an ancestor of `main` rather than
     equal to its tip, and tags that commit.
  4. A deterministic test exercises the guard logic against recorded fixtures —
     an ancestor commit, a non-ancestor commit, and a missing record — creating
     no tag and publishing nothing.
  5. Reconcile's documentation states the repair window it supports.
- **Dependencies.** None. `RB-7` and `RB-8` change the same two workflows;
  sequence the three so each change is separately reviewable.
- **Exit evidence.** The guard test's names and output; the manifest record
  produced by the emitting step exercised outside a publication — in the guard
  test's harness or on a non-release trigger — with all five fields present and
  no registry write. **This Task creates no tag, publishes nothing, and
  dispatches neither `Release` nor `Reconcile Release`.**

### RB-7 · Gate publication on the full qualification set from one commit

- **Issue:** #77.
- **Sources:** `R/F-02`. Closes `R/F-18` as a side effect.
- **Blocker clauses:** (b) publication is reachable without any Rust, wasm32,
  or wheel evidence, so no artifact but the npm tarball is qualified at the
  moment of release; (c) `#11.1` requires every matrix to pass *from one
  commit* and `#11.3` requires the release path to be safe.
- **Related existing Task:** #36 (*Complete the release-readiness audit*) judges
  the result; no open Task performs this.
- **Inputs.** `package.json` `scripts.release:check`
  (`npm run ci && npm pack --dry-run`) and `scripts.ci`, which between them omit
  `rust:check`, `cargo test`, `cargo clippy`, `cargo doc`, `cargo package`,
  `cargo deny`, the wasm32 suite, and the whole wheel matrix;
  `.github/workflows/release.yml:92-98`; the four Rust jobs and the wasm32 job
  in `.github/workflows/ci.yml`; the `workflow_call` entry point of
  `.github/workflows/python-wheels.yml` that nothing calls, and its
  `pull_request` filter at `:17-28`; `docs/python-packaging.md`'s claim that
  release qualification reuses it.
- **Outputs.** A release path whose publish job is unreachable unless the whole
  qualification set has succeeded for the release commit.
- **Acceptance criteria.**
  1. Publication is reachable only when all of these have succeeded for the
     release commit: the four `ci.yml` Rust jobs, the wasm32 job, the
     Node/browser/CLI qualification workflow `RB-4` adds, and
     `python-wheels.yml` through its `workflow_call` entry point.
  2. Failing or removing any one of them leaves the publish job unrun, shown
     once for at least one of them without publishing anything.
  3. `docs/python-packaging.md`'s sentence about reusing the wheel workflow's
     `workflow_call` is either true or reworded.
- **Dependencies.** `RB-4` (the jobs must exist to be required), `RB-6` (shares
  `release.yml`).
- **Exit evidence.** The `needs:` graph of `release.yml` recorded on the Task,
  plus one recorded run on a non-publishing trigger in which a required job
  fails and the publish job is skipped. **No publication.**

### RB-8 · Enforce release approval in automation and protect the release refs

- **Issue:** #78.
- **Sources:** `R/F-04`; the `main`-branch-protection half of `R/F-15`.
- **Blocker clauses:** (c) `#11.3` and `AGENTS.md`'s release authority both
  require explicit approval that nothing in automation enforces; (a) a workflow
  holding `contents: write` and creating tags runs under no environment and no
  protection at all.
- **Related existing Task:** #34 / #36 in spirit; none performs it.
- **Inputs.** The three read-only API reads recorded verbatim in `R/F-04`: the
  `release` environment with `protection_rules: []`, `main` with no protection,
  and `Reconcile Release` declaring no environment while holding
  `contents: write`.
- **Outputs.** Enforced approval on both release-capable workflows, and
  protected release refs.
- **Acceptance criteria.**
  1. `GET /repos/omiologic/secret-scan/environments/release` returns non-empty
     `protection_rules` including required reviewers, with a deployment-branch
     policy limited to `main`.
  2. `GET /repos/omiologic/secret-scan/branches/main/protection` returns
     protection with required reviews and required status checks naming the
     qualification jobs `RB-7` makes mandatory.
  3. `Reconcile Release` declares an environment with at least the same
     protection as `Release`.
- **Dependencies.** None for (1) and (3). (2)'s required-check names depend on
  `RB-4` and `RB-7`.
- **Note on who can do this.** (1) and (2) are repository-settings changes, not
  code, and no pull request can deliver them; they need an account with admin on
  `omiologic/secret-scan`. The Task records who performs them and when. (3) is a
  workflow change and is ordinary pull-request work.
- **Exit evidence.** The same three API reads, recorded verbatim, now returning
  non-empty protection.

### RB-9 · Decide what the first release ships, and give each shipped artifact a publication path

- **Issue:** #79.
- **Sources:** `R/F-03`, `B/F-03`.
- **Blocker clause:** (b) — three of the four artifacts the architecture
  promises have no publication path at all, `Cargo.toml:28`'s `publish = false`
  makes the crate structurally unpublishable, and `packages/javascript` declares
  no dependency on either native artifact, so no external consumer can install
  what the package needs. Also (d): `#3.5` is `unverified` and `#8.3` is
  `partially-met`.
- **Related existing Task:** #33 and #36.
- **Inputs.** `Cargo.toml:28` `publish = false`, inherited by every member via
  `publish.workspace = true`; `.github/workflows/release.yml`, which has one
  publish step and it is npm; `README.md:28-30`, which lists npm, PyPI,
  crates.io, and binary distribution channels; `ARCHITECTURE.md`'s
  four-artifact product; `docs/decisions/2026-09-09-release-bindings-in-lockstep.md`;
  `packages/javascript/package.json`, which declares no dependencies; the
  publishability of `bindings/node` and `bindings/wasm`.
- **Outputs.** One accepted decision naming the first release's artifact set,
  and for each artifact in it a publication path gated on `RB-7`'s
  qualification.
- **Acceptance criteria.** Exactly one of the two branches below, recorded as an
  accepted decision under `docs/decisions/` with `npm run decisions:validate`
  passing:
  - **A — ship the promised set.** `publish` is lifted for the publishable
    crates; the CLI has a declared platform list and a build job; the wheels
    have a PyPI step; and `packages/javascript` declares its platform artifacts
    the N-API way — `optionalDependencies` per platform triple with a runtime
    fallback, and the WebAssembly glue as an ordinary dependency.
  - **B — narrow the promise.** `ARCHITECTURE.md`, `README.md`, and
    `decision-release-bindings-in-lockstep` are amended to name the artifacts
    the first release actually ships and record the rest as deferred, and
    `README.md:28-30`'s channel list is narrowed to match.

  Under either branch:
  1. A package-consumer test installs the packed `packages/javascript` tarball
     into a clean directory with no repository checkout on its resolution path
     and awaits `initialize()` successfully on the Node runtime and on the
     browser runtime.
  2. No artifact the tree still promises lacks either a publication path or a
     recorded deferral.
- **Dependencies.** `RB-4` — an artifact cannot be given a publication path
  before it is built and qualified. **Blocks `RB-2`**, whose publish target this
  Task decides.
- **Note on authority.** Branch B amends an accepted ADR; branch A changes what
  the project publishes. Both are governed decisions. This disposition
  authorizes neither, and neither authorizes a release: a release still requires
  the explicit approval `AGENTS.md` mandates.
- **Exit evidence.** The accepted decision record; the consumer test's output
  from a clean directory on both runtimes; and a per-artifact table showing, for
  each artifact the tree promises, either its publication path or its recorded
  deferral.

### Dependency order

```
RB-1 ─┐
      ├─→ RB-2 ←─ RB-9 ←─ RB-4 ←─ RB-3
RB-3 ─┘                     │
                            └─→ RB-7 ←─ RB-6
RB-5   (independent)
RB-8   (independent; (2) needs RB-4 and RB-7 job names)
```

Three Tasks have no prerequisite and can start at once: `RB-1`, `RB-3`, `RB-5`.
`RB-6` and `RB-8` are independent of the artifact work but share files with
`RB-7`, so they are sequenced against it rather than blocked by it. `RB-2` is
last by construction — `#3.4` requires it.

## Release-readiness criteria — every one resolves

Issue #66's verification clause requires that every release-readiness criterion
resolve to evidence, a blocker, a deferred item, or an intentional exclusion.
The release-readiness criteria are the four governing issues' own: Epic #3's
completion criteria (the migration contract), Feature #11's acceptance criteria
(the cutover), Epic #60's completion criteria (the closeout), and Feature #61's
acceptance criteria (this retrospective). All twenty resolve.

### Epic #3 — the migration contract

| Criterion | Ledger class | Resolves to |
|---|---|---|
| #3.1 canonical contract executable from one location | `met` | **evidence** — `conformance/`, read by all three consumers, executed in `CI@head` and `PW@head`. |
| #3.2 Rust is the only built-in implementation | `partially-met` | **blocker** `RB-2`. |
| #3.3 all five surfaces pass the same contract | `partially-met` | **blockers** `RB-1` (Rust core, CLI), `RB-4` (Node addon, browser artifact). |
| #3.4 TypeScript core removed after parity | `unverified` | **blocker** `RB-2`, sequenced after `RB-1`. |
| #3.5 every required package and binary passes release qualification | `unverified` | **blockers** `RB-4` (build and smoke), `RB-9` (the artifact set). |
| out of scope — Go binding | `intentional-exclusion` | **intentional exclusion** `L/G-09`. |
| out of scope — version, tag, release, publication, archival | `intentional-exclusion` | **intentional exclusion** `L/G-10`. |

### Feature #11 — the cutover

| Criterion | Resolves to |
|---|---|
| #11.1 cross-platform Rust, Node, browser, Python, and CLI matrices pass from one source revision | **evidence** for Rust (`CI@head`, three hosts) and Python (`PW@head`, eight targets); **blockers** `RB-4` (Node, browser, CLI) and `RB-7` (*from one revision*). |
| #11.2 lockstep versions and the release manifest identify source, conformance, artifacts, and registry state | **blockers** `RB-5` (versions) and `RB-6` (manifest). |
| #11.3 release and reconcile are safe under partial publication, but no publication is performed | **blockers** `RB-6`, `RB-7`, `RB-8`; the "no publication" half is **evidence** — `L/G-10` records that the repository has no tags and that neither release workflow has any recorded run. |
| #11.4 TypeScript detector code is removed only after complete parity evidence exists | **blockers** `RB-1` then `RB-2`, in that order. |
| #11.5 public API, security, architecture, package contents, and changelog are reconciled and audited | **blockers** `RB-2` (package contents, shipped README), `RB-9` (architecture and the ADR); **deferred** `C/F-06`, `R/F-19`, `R/F-22` (documentation reconciliation); the audit itself remains #36's, and #36 judges the exit evidence of all nine Tasks. |

### Epic #60 — the closeout

| Criterion | Resolves to |
|---|---|
| #60.1 criterion-level evidence for every closed migration issue | **evidence** — the ledger: 150 criteria across 29 closed issues, each bound to a span and a recorded run. |
| #60.2 independent reviews of core, bindings, packages, CI, release automation, documentation, security | **evidence** — the three reviews (#63, #64, #65). |
| #60.3 planned-but-unmet, regressions, evidence gaps, new risks, and exclusions distinguished explicitly | **evidence** — the ledger's five-class gap vocabulary and the reviews' three-class vocabulary, consolidated here without translation. No `regression` was found: the ledger records that no criterion satisfied at closure is unsatisfied now. |
| #60.4 every release blocker remediated and verified; non-blocking findings deferred without blocking closure | **blockers** `RB-1`–`RB-9` (remediation is Feature #11's work); the deferral half is satisfied here — 25 findings are routed to [the backlog](./deferred-quality-backlog.md) and issue #80, which has no parent in the #60 tree. |
| #60.5 Feature #11 completes from one source revision and the final audit reports `READY FOR RELEASE APPROVAL` | **blockers** `RB-1`–`RB-9`, then #36. Unchanged by this document; a release still requires the separate approval `AGENTS.md` mandates. |

### Feature #61 — this retrospective

| Criterion | Resolves to |
|---|---|
| #61.1 closed issues #3–#10 and #12–#32 assessed criterion by criterion | **evidence** — the ledger (#62, closed). |
| #61.2 reviews cover core/conformance/CLI, JavaScript/Python bindings and packages, CI/release/documentation controls | **evidence** — #63, #64, #65. |
| #61.3 each finding records provenance, severity, evidence, disposition, and an exact exit condition | **evidence, jointly** — the four inputs record provenance, severity, evidence, and exit condition per finding; this document supplies the missing fifth field, disposition, for all 55. |
| #61.4 release blockers become Tasks under Feature #11; non-blocking findings explicitly deferred | **satisfied here** — nine Tasks under #11 (#71–#79) citing 26 findings, 25 findings deferred to #80, outside the Epic tree. |
| #61.5 a plaintext-free retrospective audit is committed under `_notes/audits/` | **evidence, with a recorded location deviation** — see the ruling below. |

## Two rulings this disposition owes

### Feature notes and retrospective audits are not tracked under `_notes/`

`R/F-19` asks #66 to record whether feature notes are expected to be tracked,
and #61.5 asks for a retrospective audit under `_notes/audits/`. One ruling
settles both.

`.gitignore` excludes `/_notes/` outright, and the directory does not exist in a
fresh checkout. `CONVENTIONS.md` describes feature notes as "a small, temporary
staging page for future GitHub Wiki content". The ruling:

- **`_notes/` is deliberately untracked local staging.** Feature notes are not
  expected to be tracked, and nothing tracked may cite a path inside it.
- **Anything a tracked, public file must cite belongs under `docs/`.** All five
  retrospective documents — the ledger, the three reviews, and this
  disposition — are therefore committed under `docs/audits/`, not
  `_notes/audits/`. #61.5 is satisfied by that location; the deviation is
  recorded here rather than left implicit.
- **Consequence for `R/F-19`.** The four citations in
  `test/conformance/README.md:66-70` point into `../../_notes/plans/archived/`,
  which no clone can resolve, in a public repository. They must be replaced with
  tracked references — the corresponding issues, or notes moved into `docs/` —
  and a link check must run in `npm run ci` so a link into an ignored path
  fails. That remediation is a documentation defect, not a release blocker under
  any of the four clauses, so it is deferred with its exit condition intact.

### Non-blocking does not mean unowned

The 25 deferred findings keep their class, severity, evidence, and exact exit
condition in [the deferred quality backlog](./deferred-quality-backlog.md). That
document, and issue #80 that holds it, have no parent in the #60 tree by
design, so Epic #60 can close with items open there. Three of them are closed as side effects of blocker work and
say so there — `L/G-07` and `C/F-05` by `RB-1`, `R/F-18` by `RB-7` — which is a
reason to sequence, not a reason to promote them.

## Intentional exclusions — documented, and not converted into work

Four exclusions, restated so their absence is not read as an omission. No Task
above cites any of them, and none appears in the backlog.

| ID | Excluded | Recorded where | Exit condition |
|---|---|---|---|
| `L/G-09` | The Go binding | `docs/decisions/2026-09-09-adopt-rust-core-monorepo.md:24-25,49` defers it; `ARCHITECTURE.md:390-391` records a Go binding, a stable C ABI, and a pure-Go detector fallback as non-goals. | **None.** A Go binding would be a new decision. |
| `L/G-10` | Version selection, tag, release, publication, repository archival | Epic #3's out-of-scope list; Feature #11's "no publication is performed"; Epic #60's out-of-scope list. The repository has no tags and neither release workflow has a recorded run; `Cargo.toml:28` sets `publish = false` workspace-wide. | **None within this migration.** A release requires the explicit approval `AGENTS.md` mandates. |
| `L/G-11` | Custom detector callbacks in the first stable API | Verified as excluded, not merely absent: `bindings/python/tests/test_import.py:41`, `packages/javascript/test/exact-exports.test.ts:44,66`, `crates/secret-scan-core/tests/incremental_partitions.rs:359`, and `detectors` kept a private module. | **None.** A later API addition is a new decision. |
| `L/G-12` | A pure-Python detector fallback | `bindings/python/python/secret_scan/__init__.py` re-exports the native module only; `scripts/qualify-python-wheel.py` installs each wheel with `--only-binary` and no Rust toolchain on `PATH`. | **None.** |

The five criteria these exclusions satisfy — `#8.C4`, `#9.C4`, `#23.5`, `#24.4`,
`#28.4` — are excluded from clause (d) for exactly this reason, and no Task
cites them.

`RB-9` deserves one clarification against `L/G-10`: deciding *which artifacts
the first release ships* is not the same as selecting a version, creating a tag,
or publishing. `RB-9` decides the artifact set and builds the paths; it performs
no release operation, and `L/G-10` remains an exclusion.

## The historical correction to issue #3

Issue #3 is closed and **stays closed**. It receives exactly one comment, added
so a reader arriving at the migration Epic finds the retrospective and the
closeout without having to discover them. Nothing in the comment changes #3's
state, its body, its criteria, or its sub-issue links. The text posted is:

> **Historical correction — the migration's acceptance evidence and closeout live elsewhere**
>
> This Epic closed on the strength of its sub-issues. A later retrospective reconstructed criterion-level evidence for every closed migration issue and found that four of this Epic's five completion criteria are not fully established by the current tree: #3.2 and #3.3 are partially met, #3.4 and #3.5 are unverified.
>
> This issue is **not** reopened. The outstanding work is owned as follows:
>
> - **Retrospective (Feature #61):** the closed-issue acceptance evidence ledger (#62) and three independent reviews (#63, #64, #65), all recorded under `docs/audits/`.
> - **Disposition (#66):** `docs/audits/release-gap-disposition.md` classifies all 55 findings and routes 26 of them to nine bounded remediation Tasks under Feature #11.
> - **Closeout (Epic #60):** owns completion, with Feature #11 performing the cutover and #36 delivering the final release-readiness audit.
>
> Intentional exclusions recorded at closure remain excluded: the Go binding, custom detector callbacks, a pure-Python detector fallback, and version selection, tagging, release, publication, and repository archival.
>
> No release is authorized by any of the above.

## Verification

Issue #66's verification clause, checked:

- **Every open blocker has one owner Task.** 26 blocking findings; 9 Tasks;
  every blocking finding cited by exactly one Task. The disposition table above
  is the cross-check: each blocker row names exactly one `RB-n`, and the union of
  the nine `Sources:` lines is those 26 ids with no repeats and no omissions.
  Two ids appear on a `Sources:` line without being that Task's blocker, and
  both say so in place: `R/F-15` is split — its `main`-branch-protection half is
  `RB-8`'s blocker and its remainder is deferred — and `R/F-18` is deferred but
  closes as a side effect of `RB-7`.
- **Every release-readiness criterion resolves.** All 20 criteria of #3, #11,
  #60, and #61 are resolved above to evidence, a blocker, a deferred item, or an
  intentional exclusion. The 150 closed-issue criteria the ledger classified
  resolve through their gaps: all 10 non-`met`, non-excluded criteria are cited
  by a Task, and the 5 excluded ones are listed above.
- **Non-blocking findings do not block the Epic.** The 25 deferred findings live
  in `deferred-quality-backlog.md` and in issue #80, which has no parent in the
  #60 tree.
- **Intentional exclusions were not converted into work.** No Task and no
  backlog entry cites `L/G-09`, `L/G-10`, `L/G-11`, or `L/G-12`.
- **Closed issues were not reopened.** #3 received one comment and remains
  `CLOSED` / `COMPLETED`. No other closed issue was touched.

## Authority

This document classifies findings and specifies work. It does not:

- change behavior, or authorize any of the nine Tasks to be performed;
- change the state, body, criteria, or links of any closed issue;
- select a version, create a tag or a release, publish a package, deploy, or
  archive anything;
- amend an accepted decision record — `RB-9` requires that as its own governed
  step.

A release requires the explicit approval `AGENTS.md` mandates, after tests pass
and the public API and changelog have been reviewed. Nothing here is that
approval.

## Appendix — how to re-derive this disposition

Nothing below dispatches a workflow, mutates a ref, or writes outside a
worktree.

```bash
# The four inputs, and the finding counts this disposition consolidates.
grep -c '^### G-' docs/audits/closed-issue-acceptance-evidence-ledger.md   # 12
grep -c '^### F-' docs/audits/core-conformance-cli-boundary-review.md      # 8
grep -c '^### F-' docs/audits/javascript-python-bindings-package-contracts-review.md  # 12
grep -c '^### F-' docs/audits/ci-release-automation-supply-chain-review.md # 23

# The ten mandatory criteria that are not `met`, and the five that are excluded.
grep -B2 -E '^`(partially-met|unverified)`' \
  docs/audits/closed-issue-acceptance-evidence-ledger.md | grep -E '^\S+[-:]\*\*#'
grep -B2 '^`intentional-exclusion`' \
  docs/audits/closed-issue-acceptance-evidence-ledger.md | grep -E '^\S+[-:]\*\*#'

# Every Task's sources, and the check that no finding is cited twice.
grep -A1 '^### RB-' docs/audits/release-gap-disposition.md | grep 'Sources:'

# The spans each Task's acceptance criteria are written against.
sed -n '54p;178,186p' scripts/check-rust-workspace.py    # RB-5: the lockstep set
sed -n '173,182p' Cargo.toml                             # RB-4: the qualified matrix's shape
sed -n '28p' Cargo.toml                                  # RB-9: publish = false
sed -n '14,21p' bindings/node/package.json               # RB-4: napi.targets
sed -n '20,29p;123,131p;186,190p' .github/workflows/ci.yml
sed -n '67,70p' package.json; sed -n '51,54p' packages/javascript/package.json
ls packages/javascript/LICENSE                           # RB-2: absent
sed -n '66,70p' test/conformance/README.md               # the feature-notes ruling

# The repository's own gate, which this document was verified against.
npm run ci
```

The issue graph the nine Tasks join is readable without mutation:

```bash
gh issue view 11 --json title,body
gh api graphql -f query='query{repository(owner:"omiologic",name:"secret-scan"){
  issue(number:11){subIssues(first:50){nodes{number state title}}}}}'

# The nine Tasks and the backlog, as created.
for n in 71 72 73 74 75 76 77 78 79 80; do
  gh issue view "$n" --json number,title,state,parent \
    -q '"#\(.number) [\(.state)] parent=\(.parent.number // "none") \(.title)"'
done
```
