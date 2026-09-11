# Independent release-readiness audit — #145

[Audit archive](README.md) · [Task #145](https://github.com/redact-secret/redact-secret/issues/145)

**NOT YET READY FOR RELEASE APPROVAL**

Audited on 2026-09-11 against source revision
`eb9edea0945b2a74077e4c45a1dad17ddbe0a590`, the merge of #176.
The conformance Git tree is `f4023bf298c65c62ea0eab41ca74227782f741cb`.
All four required remote workflows passed at that revision. Nevertheless,
independent review and offline execution found release/recovery failures and
unmet operational prerequisites. Passing tests and closed issues do not erase
those findings.

This later evidence-only commit records that source revision; it does not claim
its own new revision has remote qualification. No version was selected and no
workflow was dispatched. Publication, reconciliation, release branches, tags,
deployment, repository changes, and issue-state changes remain outside this audit.

## One complete evidence set

| Workflow | Exact run | Result |
| --- | --- | --- |
| CI | [34621137517](https://github.com/redact-secret/redact-secret/actions/runs/34621137517) | All 9 jobs passed |
| Python wheels | [34621137531](https://github.com/redact-secret/redact-secret/actions/runs/34621137531) | All 11 jobs passed |
| Artifact qualification | [34621137765](https://github.com/redact-secret/redact-secret/actions/runs/34621137765) | All 40 jobs passed, including its called CI/Python workflows, packed consumers, and inventory |
| SAST | [34621137605](https://github.com/redact-secret/redact-secret/actions/runs/34621137605) | Pinned OpenGrep baseline passed |

These are existing automatic `push` runs for the audited commit. No earlier
rehearsal or pull-request run substitutes for any member of this set.
[Verification summary](evidence/145/verification-summary.json) preserves individual
job IDs, results, URLs, source identities, and local command results.

Downloaded all qualification artifacts and independently checked every one of
the **43 file sizes and SHA-256 hashes** against the
[run inventory](evidence/145/artifact-inventory.json). All five canonical fixture
digests and all six matrix declarations match this checkout. The inventory says
`published: false`. [Artifact metadata](evidence/145/remote-artifact-metadata.json)
records GitHub artifact IDs, digests, and expiration times; durable evidence here
preserves inventories, not executable binaries after GitHub retention expires.

Local checks passed:

- `npm run release:check`: repository CI gates, 104 JavaScript tests,
  34 conformance-schema tests, live registry preflight, and npm package dry-run.
- All 343 release/policy script tests; `npm run rust:check` (44 policy tests).
- `cargo test --workspace --locked`: 450 tests including doctests, zero failures
  or ignored tests; this includes the 18 public-API integration tests.
- Rust formatting, workspace Clippy with warnings denied, rustdoc with warnings
  denied, standalone core packaging, MSRV 1.88, and wasm32 compilation.
- Content inspection of all eight qualified Python wheels and the sdist;
  installing the downloaded macOS arm64 wheel without an index or source fallback
  and running its 588 Python tests on CPython 3.14 passed.
- All seven npm dependency packages assembled from this run's downloaded
  artifacts and passed the real publisher script's `--dry-run`, in temporary
  directories. [Plan](evidence/145/dependency-cutover-plan.json) and
  [results](evidence/145/dependency-dry-runs.json) preserve the intended order.
- Both npm lockfile advisory audits reported zero known vulnerabilities.
  Cargo advisory/license checks passed in this revision's CI policy job;
  `cargo-deny` is not installed locally, so no local Cargo advisory run is claimed.
- The pinned local OpenGrep scan passed and reproduced the CI findings/errors.

## Identity, package, and public-contract review

| Area | Audited evidence and assessment |
| --- | --- |
| Accepted naming matrix | The naming ADR's current-application section, manifests, public imports, binary names, metadata, and canonical repository agree on Redact Secret. npm exposes `@redact-secret/core`, `@redact-secret/wasm`, and six `@redact-secret/node-<platform>` packages. Rust publishes `redact-secret` and `redact-secret-cli`; the binary is `redact-secret`; Rust/Python import `redact_secret`; PyPI uses `redact-secret`. |
| Legacy identifiers | The exhaustive repository legacy-identifier gate passed. Historical allowlist entries, internal crate-directory paths, and `SecretScanError`/`SecretScanErrorCode` remain intentional naming-ADR exclusions. This is absence of unintended identifiers under the accepted policy, not absence of every historical spelling. |
| Registry names | Fresh public reads report all eight npm names and both crate names absent. The core's underscore crate alias also reports absent. PyPI hyphen, underscore, and dot spellings all report absent and normalize to one project. No public project at check time proves neither name reservation nor the publisher's authorization. See [live reads](evidence/145/live-controls-and-registries.json). |
| npm contents and order | Facade dry-run and qualified inventory agree on 29 files. Six native dependencies contain the target addon and package metadata; Wasm has its four declared payload files. Seven successful dry-runs use this exact run's bytes. `release.yml` requires both native and Wasm publish/verify jobs before the facade becomes eligible. Missing artifacts fail qualification; a conflicting dependency checksum fails the publisher script. Reconcile bypasses that verification in B2 below. |
| Rust and Python contents | The standalone core package builds with 31 files; integration tests requiring the external corpus are intentionally excluded. Python inspection verifies eight abi3 wheels and one source archive, including distribution metadata, typing, extension and vendored-library rules. The cross-platform jobs qualify their matching targets. No SAST rules, repository tests, or conformance fixtures ship in these library packages. |
| Public API | Reviewed JavaScript exports and initialization, Python imports/stubs, Rust's enforced export table and public-API tests, and CLI contracts against READMEs, architecture, and changelog. Findings expose metadata rather than matched values; offsets refer to original input (Rust UTF-8 bytes, JS UTF-16 units, Python code points). Detection remains separate from host enforcement of `block`. Policy/formatter callbacks receive safe metadata. Native Rust detector extension does not imply binding custom-detector callbacks. |
| Support | Node 20/22/24, six non-musl npm/CLI targets; eight addon qualification targets including two musl-only qualification builds; eight CPython 3.10+ abi3 wheel targets; Chromium/Firefox/WebKit; Rust MSRV 1.88. JavaScript incremental factories deliberately reject with `INCREMENTAL_UNAVAILABLE`; Rust, Python, and CLI stdin support bounded incremental use. Host resource limits and server-side authoritative scanning remain required. All six declared matrices match the qualified inventory. |
| Version and changelog | Ten JSON product-version manifests and five Cargo members agree on development `0.1.0-beta.1`; Python metadata uses `0.1.0b1`. Lockstep policy passes, including the private root. The changelog has one truthful `Unreleased` entry covering the Rust-core product, artifacts, behavior, support limits, and security gates. Explicit candidate-version approval and the corresponding versioned entry are still missing (B6). |

Public-registry consumer installation remains an **intentional prepublication
exclusion**, owned by #141: none of these packages exists yet. Packed consumer
tests passed on the candidate; they do not prove a registry install. Exit evidence
after separately approved publication is success of all six
`verify-registry-install` platform lanes and the browser lane against the exact
published version. This exclusion does not waive publisher prerequisites.

## OpenGrep: baseline pass, with an ownership gap

Engine `1.30.0`; vendored rules digest
`18894c09bcde68fd088ec8252e64b637d67cd975ad6fff2834374cc7345db6da`.
The provenance-verified local invocation used no `--binary` override.
[Local report](evidence/145/opengrep-local.json) and
[CI report](evidence/145/opengrep-ci.json) are identical except for `generated_at`:
**29 findings, 16 acknowledged scan errors, zero unresolved baseline items**.
All 29 current findings have `false_positive` dispositions; none is classified
as blocking or hardening. GitHub's live main-branch alert view has 29 dismissed
alerts; dismissal state is not independent evidence of safety.

The [per-ID disposition ledger](evidence/145/sast-dispositions.json) binds every
current finding/error to exact rule/type, path, lines, rationale, baseline digest,
and owning work item #156. The reviewed categories concern constant regexes,
placeholder text rather than HTML sinks, trusted tooling subprocesses, fixed
registry hosts, and discarded argv[0]. Parser limitations concern TypeScript
`unique symbol` and GitHub-expression syntax in shell subparsing. Those 16 errors
are intentional tool-coverage exclusions, not proof that the affected syntax was
fully scanned. Existing build, test, and workflow review evidence supplements them.

No suppression, rule, or baseline was relaxed. However, the baseline has no named
accountable owners, and #155/#156 have no assignees. A work-item routing reference
alone does not demonstrate accepted human ownership. B7 therefore prevents the
audit from claiming the suppression-ownership acceptance criterion is complete.

## Blocking residual findings and exact exits

The owner column identifies the existing remediation work item and responsible
role, not an assignment accepted on somebody's behalf. No issue was opened,
reopened, commented on, or closed by this audit.

| ID | Finding and evidence | Owner | Exact exit evidence |
| --- | --- | --- | --- |
| B1 | **Recovery cannot handle an unpublished facade.** `reconcile-release.yml:178-183` exits before other registry repairs if the facade is absent. A core-success/CLI-failure state with no facade is therefore unrecoverable through this workflow, even with a valid source manifest. Offline probe R1 reproduces the failure. | #142, release automation maintainer | Run the actual workflow orchestration against offline registry fixtures for each partial-success class, including missing facade with existing crates or dependencies. Every missing matching artifact gets a safe ordered recovery path; conflicting or unverifiable artifacts block. |
| B2 | **Existing npm/PyPI artifacts are not verified, and partial PyPI uploads are skipped.** Reconcile lines 243-246 return on npm version existence, bypassing the publisher's checksum check. Lines 386-391 treat any PyPI version response 200 as complete, without comparing the expected wheel/sdist filenames or digests. Probes R2/R3 reproduce both early returns. `skip-existing` cannot repair files when the publish step is never reached. | #142, release automation maintainer | Offline integration cases prove matching immutable artifacts are verified, conflicts block, and a PyPI version with only one uploaded file receives exactly the missing qualified files. Exercise the workflow shell, not only `plan_independent` unit tests. |
| B3 | **Failed runs do not reliably inventory the whole product.** `release.yml:692-727` derives `artifact_set` solely from received job outputs. If qualification fails and all publishers are skipped, the manifest builder rejects empty artifact/state fields; if only one job reports, the manifest silently lists only that subset. Probes R4/R5 reproduce both. `if: always()` alone does not guarantee a complete durable manifest. | #142, release-manifest maintainer | Declare the entire artifact set independently of job outcomes, record missing observations as `unknown`, and retain a complete source/corpus/version manifest for failed-before-publication, partial, and successful runs. Tests must execute the assembly path and assert all eight npm identities, both crates, and PyPI are present. |
| B4 | **Required review and full qualification protection are incomplete.** Live `main` has `required_approving_review_count: 0`, a named review bypass, and no rulesets. Its 11 strict required contexts include CI, `Wheel matrix`, and OpenGrep, but no complete addon/browser/CLI/package-consumer/inventory qualification gate. The environment itself passes: reviewer `milocosmopolitan`, no administrator bypass, branch-only `main`. | #143, repository administrator | Authorized settings reads show an enforced approving review without an unintended bypass and the complete qualification gate, or an explicitly accepted governance change to those criteria. Verify protection against the real job names; merely having a review-settings object is insufficient. |
| B5 | **Publisher and first-publication bootstrap prerequisites are unproven.** Safe secret metadata exposes only environment `NPM_TOKEN`; repository and inherited organization secret lists are empty, so the workflow's `CARGO_REGISTRY_TOKEN` is absent from all three observed scopes. Token scope/expiry, npm organization 2FA enforcement and team access, the eight-package bootstrap-to-OIDC/revocation record, and PyPI Pending Trusted Publisher are unverified. Public 404s establish none of these. | #143, npm/crates.io/PyPI account administrators | Safe authenticated records establish org-level 2FA, least-privilege team/bootstrap access, explicit bootstrap approval and expiration, all eight npm per-package OIDC conversions and revocation follow-up, usable Cargo publisher access for both names, and PyPI pending configuration for `redact-secret/redact-secret`, `release.yml`, environment `release`. Recovery additionally needs authorization for the `reconcile-release.yml` OIDC identity. Record names/scopes/timestamps only; pending PyPI configuration does not reserve the name. |
| B6 | **Candidate identity approval is outstanding.** #144 is closed, but its committed review explicitly records approval pending; manifests retain the development value and `CHANGELOG.md:6` remains `Unreleased`. Neither the issue closure nor the manifest value selects an approved candidate. | #144, release owner and explicit user approval | Record explicit candidate-version approval, apply that value consistently to manifests/lockfiles and one truthful changelog entry, review public contracts, then qualify and audit the resulting revision. Release approval remains a separate subsequent action. |
| B7 | **Suppression ownership is not recorded.** Exact current IDs/rationales are preserved, but all lack human owners; owning tasks #155/#156 are closed and unassigned. Zero unresolved scanner findings does not satisfy #145's separate ownership criterion. | #156, security review owner | Named accountable owners accept every suppression and parser-coverage exclusion, with exact location/rationale and evidence that adjacent real findings still fail. Recheck the unchanged-or-corrected baseline and actual scan on the final candidate. |

[Recovery probe results](evidence/145/recovery-probes.json) and the
[offline replay](evidence/145/reproduce-recovery-gaps.txt) preserve minimal inputs.
From the audited checkout, run
`python3 -B docs/audits/evidence/145/reproduce-recovery-gaps.txt`.
It verifies the workflow snapshot hash, stubs npm/curl, executes only bounded
fragments, and calls the manifest builder with synthetic metadata. It makes no
network requests or publication/Git mutations. Assertions deliberately reproduce
the audited failures; they are not production regression tests asserting desired
behavior. The existing 343 passing script tests do not cover these workflow
composition failures.

## Owned deferrals and intentional exclusions

| Classification | Owner and evidence | Exact exit / continuing boundary |
| --- | --- | --- |
| Owned deferred quality queue | #80 and the [25-entry quality ledger](deferred-quality-backlog.md#backlog) retain each historical ID, classification, source evidence, and exit condition. A closed tracking issue is not a fresh assertion that every entry was implemented. | Resolve remaining entries individually against the ledger's per-ID exit criteria, or record an accepted deferral. Historical rows already marked remedied are not reopened here. New release-contract failures B1-B7 take precedence over older broad deferrals, especially bootstrap/OIDC obligations. |
| Owned deferred detection breadth | #136 and the [residual evidence ledger](detection-assurance-residual-evidence-backlog.md#backlog). The [current declaration extraction](evidence/145/pending-coverage.json) has **9 pending cells across 5 backlog IDs**, including `otpauth_secret` in structural host-context breadth. #136's closure comment expressly closes tracking, not the underlying gaps. | Structural breadth: complete the five representative host contexts for a structural type. Each of bearer/contextual/authorization overlap: add its dedicated resolved-overlap fixture. Authorization host breadth: its own five representative contexts. Regenerate declarations/report and pass coverage checks. These are bounded evidence deferrals, not known detector regressions. |
| Intentional support exclusions | Accepted architecture and first-artifact ADR; #79/#140 own the support contract. | No shipped musl npm/CLI package, no working JS incremental session, no Go/C ABI, pure-language fallback, or binding custom-detector callback. Adding any requires a separately reviewed contract, implementation, and full qualification; the present tests assert the declared boundary. |
| Intentional SAST coverage exclusions | #155/#156; `sast/README.md`, scanner exclusions, and the per-ID ledger. | Generated output, dependencies, vendored rules, and canonical synthetic fixtures remain excluded for their recorded reasons. Parser errors require named ownership (B7) and re-review on tool/rule changes; they cannot be presented as full coverage. |
| Intentional post-approval operations | #141 and repository release authority. | Real registry consumer installs follow separately approved publication. Version selection, publication, tags/releases, deployment, transfer, archival, credential creation/revocation, and workflow dispatch were not performed to manufacture missing evidence. |

## Native issue graph and closure decision

The [live native graph](evidence/145/issue-graph.json), read through GitHub's
sub-issue API rather than inferred from body links, has Epic #60 open, Features
#61 and #11 closed, Feature #138 open, and Features #150/#154 closed. #138 has
#139-#144 closed and #145 open. #150 owns #151/#152/#153/#157; #154 owns #155/#156.
Their child closures do not establish acceptance against this audited tree.

#139/#140 have current qualification/support evidence. #141 has a current
no-publication dependency rehearsal; its registry installs remain post-approval.
#142 fails the reproduced recovery/manifest criteria. #143 passes environment
protection but not all branch/publisher requirements. #144 reconciles the public
contract but still lacks approved candidate identity. #150's naming evidence
passes; #154's scanner gate passes while suppression ownership remains incomplete.

**Feature #138 and Epic #60 must remain open. The existing closures of Features
#150 and #154 do not satisfy #145's explicit final-audit closure gate.** Their
closure eligibility must be reconciled with this verdict by the issue owner;
this audit does not change their states. Only a later audit stating
`READY FOR RELEASE APPROVAL`, backed by exact exit evidence for all blockers and
one complete evidence set on the resulting source revision, permits those four
items to close. Even that verdict does not authorize publication.
