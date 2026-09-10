# Detection-assurance closeout audit

The closeout audit issue #118 asks for, under Feature #100
(tracking-key `dacd-f5-t3`) and Epic
[#95](https://github.com/omiologic/secret-scan/issues/95): a plaintext-free
record of what the expanded canonical corpus proves and what remains
intentionally unsupported or unresolved, so Epic #95 can close without
selecting a version, tagging, publishing, releasing, deploying, or archiving.

- **Assessed revision:** `e8bf910` (`main`, merge of PR #135, *qualify range
  conversion corpus*), the tip at the time this audit was performed.
- **Assessed on:** 2026-09-10.
- **Scope:** issue #118's four acceptance criteria — report coverage by
  capability and risk dimension rather than fixture totals alone; give every
  unresolved item a classification, owner issue, safe resolution, and exact
  exit evidence, or an explicit intentional exclusion; confirm public
  detection-coverage documentation matches the machine-readable inventory
  and does not claim complete DLP coverage; and confirm Epic #95 can close
  without any release operation.
- **Authority:** this document records evidence and a verdict. It does not
  remediate anything, change any issue's state, select a version, create a
  tag, publish a package, deploy, or archive another repository.

## Verdict

**ASSURANCE TARGET MET.** Epic #95 may close.

The machine-readable coverage model (`docs/coverage/`) accounts for every
built-in detector, emitted finding type, default-policy mapping, and accepted
credential scheme; the canonical corpus's 353 fixtures are asserted on the
Rust core and reconciled against that model with zero drift; and every
row/scheme the baseline can name resolves to `supported` or a bounded,
documented exemption — **zero rows are `unresolved`**. The model does report
5 genuine, non-blocking evidence-*breadth* gaps (`pending` dimension cells);
this audit gives each one a classification, an owner issue (#136, filed by
this audit with explicit authorization), a safe resolution, and exact exit
evidence in
[the residual evidence backlog](./detection-assurance-residual-evidence-backlog.md).
None of the five violates a public contract, a security boundary, or leaves a
declared row without positive depth evidence — each is missing only
representative-context or overlap *breadth* for a row whose core behavior is
already asserted and passing.

Public documentation (`README.md`'s "Detection coverage" section) already
matches the machine-readable inventory and already disclaims complete DLP
coverage; no edit was needed there. One administrative step remains outside
this audit's authority: issue #96 (Feature, tracking-key `dacd-f1`) has all
four of its own sub-issues closed but was never itself closed, and issues
#100 and #95 cannot close until #118 does. See
["Issue relationships and dependencies"](#issue-relationships-and-dependencies)
below.

## Method

This audit did not re-derive the coverage model or the corpus from first
principles — that is `docs/coverage/`'s own job, and its generators, schema
validation, and CI gate (`npm run coverage:check`) are unchanged and
independently re-run below. Instead, this audit: (1) re-ran the complete
validation and qualification checks against the assessed revision; (2)
queried the generated coverage documents directly (not their prose summaries)
for every row/scheme/dimension state; (3) walked the Epic #95 issue tree via
the GitHub API rather than trusting title text; and (4) read the public
`README.md` against `docs/coverage/detector-inventory.json`'s declared set.

Commands actually run, all read-only or local-build:

```bash
npm run ci                                    # 0 errors
cargo test --workspace --locked               # 422 passed, 20 suites
cargo clippy --workspace --all-targets --locked  # no issues found
cargo test -p secret-scan --test canonical_corpus       # 353 evaluated fixtures asserted
cargo test -p secret-scan --test detector_inventory      # baseline reconciled against DetectorRegistry/DefaultPolicy
gh issue view 95 --json subIssues
gh issue view 96 --json subIssues
gh issue view 100 --json subIssues
```

No plaintext secret value, matched value, fixture input, or credential-shaped
string appears in this document. Detector ids, finding types, dimension
names, file paths, line numbers, and fixture counts are safe metadata.

## Coverage by capability and risk dimension

Fixture-total framing alone (353 fixtures, 256 `supported`-tier, 97
`intentionally-unsupported`) is not the assurance claim; the claim is the
join of that corpus against the declared baseline
(`docs/coverage/detector-inventory.json`) and the risk-based evidence model
(`docs/coverage/evidence-requirements.md`), reconciled by
[`docs/coverage/coverage-report.md`](../coverage/coverage-report.md):

**By capability** — 21 built-in detectors emitting 23 declared finding types
(`generic-token` emits both `contextual_secret` and `authorization_credential`),
partitioned into three behavior classes: 16 `provider` types, 4 `structural`
types, 2 `contextual` types, plus the cross-cutting `incremental` and
`binding-edge` classes covering session lifecycle and the 9 declared binding
consumers. `docs/coverage/inventory-report.json`'s reconciliation reports
zero detectors declared but absent from the corpus and zero corpus detectors
missing from the declaration
(`corpusDetectorsMissingFromDeclaration: []`,
`declaredDetectorsMissingFromCorpus: []`).

**By risk dimension** — every declared row is evaluated against the nine
evidence dimensions the requirement matrix names (positive, near-miss
negative, boundary, malformed, overlap, host-context, range, incremental,
adversarial), risk-scoped by behavior class
(`evidence-requirements.md` §3-§4) rather than required uniformly. Current
state, from `coverage-report.md`'s own generated table:

| Dimension | Supported | Not applicable | Pending |
|---|---|---|---|
| positive | 23 | 0 | 0 |
| near-miss-negative | 23 | 0 | 0 |
| boundary | 23 | 0 | 0 |
| malformed | 33 | 0 | 0 |
| overlap | 20 | 0 | 3 |
| host-context | 18 | 0 | 5 |
| range | 33 | 0 | 0 |
| incremental | 3 | 7 | 0 |
| adversarial | 33 | 0 | 0 |

Zero rows or schemes are `unresolved` (`inventory-report.json`'s
`rowStates`: 23 `supported`, 0 `not-applicable`, 0
`intentionally-unsupported`, 0 `unresolved`). The 8 `pending` cells above (5
`host-context`, 3 `overlap`) are the only cells not resolved to `supported`
or a bounded `not-applicable`/exemption code — see the next section.

## Unresolved items — classification, ownership, and exit evidence

Every declared row resolves under one of exactly three states, and this
audit accounts for each:

1. **`supported`** — direct positive corpus evidence exists for the
   dimension. The overwhelming majority of cells (`coverage-report.md`'s
   table above).
2. **A bounded, documented exemption** (`not-applicable` /
   `owned-elsewhere` / `single-detector-family` / `no-concept`) —
   `evidence-requirements.md` §5's fixed, small rationale-code set,
   machine-validated by `conformance/schema.ts`'s
   `validateCanonicalCoverageDeclarations`, which rejects an exemption whose
   code does not apply or whose reference does not resolve. Example:
   `private_key`'s scheme dimension is `not-applicable` under `no-concept`
   (`schemes: null` — private keys have no accepted-URI-scheme concept).
   These are **explicit intentional exclusions**, already the machine's own
   record, re-verified by the passing `coverage:check` gate above; this
   audit does not re-litigate them individually.
3. **`pending`** — genuinely required, currently unmet, carrying an owning
   `backlogId`. Exactly 8 cells (5 unique `backlogId`s) are in this state,
   and **none was previously attached to a GitHub issue** — the gap this
   audit's acceptance criteria exist to close. This audit:
   - classified each (`evidence-gap`, per `deferred-quality-backlog.md`'s
     existing vocabulary);
   - filed [issue #136](https://github.com/omiologic/secret-scan/issues/136)
     as the owner, with the user's explicit authorization (filing a new
     GitHub issue is a visible, shared-state action outside this skill's
     default authority);
   - recorded a safe resolution and exact exit evidence for each in
     [`docs/audits/detection-assurance-residual-evidence-backlog.md`](./detection-assurance-residual-evidence-backlog.md),
     mirroring the `deferred-quality-backlog.md` / issue #80 convention this
     repository already established for the Rust-core migration; and
   - confirmed none of the 5 violates the security boundary
     (`AGENTS.md`), leaves a promised platform or artifact unqualified, or
     leaves a declared row without its own core depth evidence — each is
     missing only breadth (representative-context or overlap) evidence for
     a row that already passes its required depth dimensions.

Summary table (full detail, including exact exit conditions, in the backlog
document):

| Backlog ID | Rows | Dimension | Class | Owner |
|---|---|---|---|---|
| `structural-host-context-breadth` | `private_key`, `jwt`, `bearer_token`, `connection_string_password` | host-context (class-level) | evidence-gap | #136 |
| `bearer-token-overlap` | `bearer_token` | overlap | evidence-gap | #136 |
| `contextual-secret-overlap` | `contextual_secret` | overlap | evidence-gap | #136 |
| `authorization-credential-overlap` | `authorization_credential` | overlap | evidence-gap | #136 |
| `authorization-credential-host-context-breadth` | `authorization_credential` | host-context (type-level) | evidence-gap | #136 |

No confirmed detector defect was discovered during this audit, so no new
synthetic permanent regression fixture was required (Epic #95's own
completion criterion for that case does not apply here).

## Public documentation reconciliation

`README.md`'s ["Detection coverage"](../../README.md#detection-coverage)
section (lines 214-240) was checked line-by-line against
`docs/coverage/detector-inventory.json`'s 23 declared finding types:

- Every declared detector family is named: PEM private keys, AWS access-key
  IDs, GitHub/GitLab tokens, JWTs and bearer/Basic/Token authorization
  credentials, OpenAI/Anthropic/Shopify/Vault credentials, the ten qualified
  vendor token families (Stripe, Slack, PyPI, Hugging Face, Docker Hub,
  Cloudflare, DigitalOcean, Linear, Supabase, Vercel), the two contextual
  `generic-token` types, and the connection-string schemes.
- It already states plainly, unprompted by this audit: *"the core never
  performs runtime provider lookups, and `secret-scan` is not a complete DLP
  system"* (`README.md:235-236`) — the exact disclaimer issue #118's
  acceptance criteria require. It also names the precision/recall tradeoff
  (strict prefixes and minimum lengths can miss truncated, short, new, or
  unsupported formats) rather than overstating recall.
- No edit to `README.md` was needed to satisfy this criterion. Nothing in
  `ARCHITECTURE.md`, `docs/coverage/`, or `conformance/README.md` claims
  complete or exhaustive coverage either — the only two hits for
  DLP-adjacent claims anywhere in tracked documentation are this one
  disclaiming sentence.

## Issue relationships and dependencies

Walked via `gh issue view <N> --json subIssues` against the live API, not
issue titles:

- **Epic #95** — 5 sub-issues: #96 (open), #97 (closed), #98 (closed), #99
  (closed), #100 (open).
- **Feature #96** (`dacd-f1`) — 4 sub-issues, **all closed** (#101, #102,
  #103, #104). #96 itself carries no additional acceptance criteria beyond
  its sub-issues' outcomes (its own body's "Verification" section — run the
  corpus validators, the Rust native corpus consumers, and CI, inspect the
  generated summary — is satisfied by the passing `coverage:check` gate
  confirmed above) and has no comments recording why it stayed open. This
  audit does not close it: closing an issue is a visible action outside a
  closeout audit's authority, mirroring
  [the release-readiness audit](./release-readiness-audit.md)'s treatment of
  issue #78 ("It does not reopen or comment on any closed issue"; the
  symmetric case here is a closed-in-substance issue left open). The
  recommendation is for a human to close #96, noting its 4 sub-issues'
  closure as the record.
- **Feature #100** (`dacd-f5`) — 3 sub-issues: #116 (closed), #117 (closed),
  #118 (open — this issue; resolved by the branch this audit ships on).
- No orphaned, contradictory, or missing sub-issue links were found anywhere
  in the tree. Once #118 closes, #100's own sub-issues are all closed;
  #95's are then all closed once #96 is also closed. Neither of those two
  closes is performed by this audit, consistent with the authority
  boundary above.

## Epic #95 completion criteria — resolved

| Criterion | Status | Evidence |
|---|---|---|
| A machine-readable coverage model accounts for every built-in detector, emitted finding type, default-policy mapping, and accepted credential scheme | **met** | `docs/coverage/detector-inventory.json` (21 detectors, 23 types), reconciled against `DetectorRegistry`/`DefaultPolicy` by `detector_inventory.rs`, currently passing |
| Risk-based canonical evidence covers supported positive behavior, near-miss negatives, boundaries, overlap, representative host contexts, native range conversion, incremental behavior, and adversarial limits, with explicit justified `not-applicable` or intentional exclusions where a dimension does not apply | **met, with 5 tracked residual gaps** | `docs/coverage/evidence-requirements.md`, `host-context-classes.md`, `coverage-declarations.json`; the 5 `pending` cells are owned by #136 (above), not silently excluded |
| Confirmed detector defects discovered during this work become synthetic permanent regression fixtures without storing active or plaintext credentials | **not applicable this audit** | no defect was discovered during this closeout; prior Tasks under #95 (e.g. #108, #111, #112) already added regression fixtures for defects they found |
| The expanded canonical corpus passes on the Rust core and every applicable JavaScript, Python, Rust, and CLI surface from one source revision | **met** | `cargo test --workspace --locked` (422 passed) and `canonical_corpus.rs` (353 fixtures) confirmed directly above; the cross-language artifact-qualification matrix (Node addon, browser WebAssembly, Python wheels, CLI binaries) was independently confirmed holding by [the release-readiness audit](./release-readiness-audit.md)'s `RB-1`/`RB-4` sections and is unchanged by any commit since |
| CI produces a reviewable coverage report and fails when detector capabilities or required evidence drift | **met** | `docs/coverage/coverage-report.md`, generated and drift-checked by `npm run coverage:check`, part of `npm run ci`; re-confirmed passing above |
| A closeout audit records remaining gaps with explicit ownership and reports whether the assurance target is met | **this document** | verdict above: assurance target met |

## What this audit does not do

Consistent with issue #118's own scope and `AGENTS.md`'s release authority:

- It does not select a version, create a tag, or open a release.
- It does not publish to npm, crates.io, PyPI, or any binary distribution
  channel, deploy, or archive another repository.
- It does not close #96, #100, or #95, or comment on any of them.
- It does not add a Go binding, a stable C ABI, a duplicate detector
  implementation, or a new public extension surface.
- It does not move deferred-quality-backlog (#80) findings into or out of
  this Epic's tree.
- It filed exactly one new GitHub issue (#136), with the user's explicit,
  recorded authorization, to satisfy issue #118's "owner issue" acceptance
  criterion for the 5 residual evidence gaps; it took no other GitHub
  write action.

## Plaintext safety

No entry in this document reproduces a matched value, a fixture input, or a
credential-shaped string. Detector ids, finding types, dimension names, file
paths, line numbers, issue numbers, and fixture/test counts are safe
metadata.

## Appendix — how to re-derive this audit

```bash
# The repository's own gate.
npm run ci
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked

# The canonical corpus and baseline reconciliation.
cargo test -p secret-scan --test canonical_corpus
cargo test -p secret-scan --test detector_inventory

# The generated coverage documents this audit read directly (regenerate and
# diff against the committed copies to confirm no drift).
python3 -B scripts/generate-coverage-inventory.py --out /dev/stdout | diff - docs/coverage/inventory-report.json
python3 -B scripts/generate-coverage-declarations.py --out /dev/stdout | diff - docs/coverage/coverage-declarations.json
python3 -B scripts/generate-coverage-report.py --out /dev/stdout | diff - docs/coverage/coverage-report.md

# The issue graph this audit judged.
gh issue view 95 --json subIssues
gh issue view 96 --json subIssues
gh issue view 100 --json subIssues
```
