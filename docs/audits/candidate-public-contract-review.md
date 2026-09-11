# Candidate public contract and identity review

[Documentation home](../README.md) · [Audit archive](README.md)

- Issue: [#144](https://github.com/redact-secret/redact-secret/issues/144).
- Reviewed on: 2026-09-11, macOS arm64.
- Reviewed implementation revision: `c34f4a8` (full revision in the
  [verification summary](evidence/144/verification-summary.json)).
- Status: the version-independent reconciliation and local review are complete;
  candidate version approval remains pending. This is not release sign-off.

## Candidate version and changelog

All ten JSON version-bearing manifests and all five Cargo members agree on the
existing development value `0.1.0-beta.1`. Python's dynamic distribution version
is its PEP 440 equivalent `0.1.0b1`; this is one product version, not a second
release. Both npm lockfiles' root records also agree. The private root manifest
is now in the enforced lockstep set; a regression rejects its version drift.
Native platform manifests are discovered, and the Wasm manifest is checked too.

Issue #144 explicitly says the current value does not establish approval and
that this task does not select a version. No explicit candidate-version approval
was supplied with the issue request. Consequently, the consolidated changelog
has one **Unreleased** entry and no dated, historical-looking entry for the
unpublished identifier. Assigning an approved version to that entry, updating
manifests/lockfiles if necessary, and rechecking the resulting revision remain
required before #144 can be closed. No version was selected in this review.

The entry describes the Rust-core product, artifacts, support limits, public
behavior, and security gates. It removes the retired TypeScript custom-detector
and working-JavaScript-streaming claims. It is no longer allowlisted for legacy
product identifiers; a regression proves an old npm identity in the changelog
fails the #153 gate.

## Public API review

| Surface | Reviewed contract and evidence |
| --- | --- |
| Rust | The core README, crate-root export table, `core-public-api` manifest declaration, and all 18 `public_api` integration tests agree. Native `Detector` traits and `DetectorRegistry` remain public; they are not binding callbacks. Ranges are UTF-8 bytes into original input. |
| JavaScript | `packages/javascript/src/index.ts`, package `exports`, README, type contracts, and package-content tests agree. The root API, two stream subpaths, and metadata `./package.json` subpath are exposed; internal modules are not. Current native/Wasm session factories report `INCREMENTAL_UNAVAILABLE`. Ranges are UTF-16 code units. |
| Python | The binding README, `__init__.py`, `_native.pyi`, dynamic version metadata, and built abi3 wheel describe the same typed module `redact_secret`. Policy and formatter callbacks receive safe metadata; incremental sessions are supported. Ranges are Unicode code points, while limits count UTF-8 bytes. |
| CLI | The CLI README and manifest agree on `redact-secret`, safe reports, check exit codes 0/1/2, redact exit codes 0/2, and bounded incremental stdin. Source-label escaping is documented. The host boundary does not change detector behavior. |

The shared core stays deterministic and side-effect free. No detector,
overlap-resolution, policy, or redaction implementation changed in this work.
Findings do not contain matched plaintext, `block` requires host enforcement,
and whole-input operations require host resource limits.

## Identity, support, and package-content review

The root and package READMEs, architecture, qualification page, manifests, and
current-application notes on both accepted ADRs now agree on Redact Secret and
its four product surfaces. Historical ADR bodies remain explicitly dated
rationale. The naming ADR's former transfer-pending statements are not current
instructions: the canonical repository and manifest URLs already use
`redact-secret/redact-secret`.

Node 20/22/24 and CLI publication cover six non-musl targets. The eight-target
addon qualification set includes two musl builds without npm publication
packages. Python's CPython 3.10+ abi3 matrix includes eight targets; browser
qualification covers Chromium, Firefox, and WebKit. Rust MSRV is 1.88.

Local package inspection, with inventories in the verification summary:

- npm facade dry-run: 29 files, comprising built JS/declarations, README,
  license, and package metadata; no repository sources, tests, or SAST rules.
  The existing content tests also enforce the export and internal-module boundary.
- Rust core: `cargo package --locked --allow-dirty` built and verified the
  standalone 31-file crate. Expected warnings identify deliberately excluded
  integration tests, which require the repository conformance corpus.
- Rust CLI: `cargo package --list --locked` inspected the 13-file package,
  including its integration test source. This was content enumeration, not a
  standalone registry-dependent CLI package build.
- Python: built a macOS arm64 abi3 wheel (9 files) and sdist (42 entries).
  The wheel contains the extension, import module, stub, `py.typed`, license,
  metadata, and SBOM. The sdist contains the binding and core sources needed
  to build it. Neither includes tests, conformance fixtures, or SAST rules.
- Native/Wasm npm dependency file contracts remain the six scoped addons and
  four Wasm payload files declared by their manifests. The prior
  [rehearsal inventory](evidence/174/artifact-inventory.json) and
  [dependency pack plan](evidence/174/dependency-cutover-plan.json) record all
  seven qualified packages. This review did not rebuild their cross-platform
  binary payloads or claim new target qualification.

The [#174 rehearsal](release-qualification-follow-up.md) remains evidence for
`9f02fc401525381a6b02b5dd514a68df9a4f9531`, not the current commit. A Git diff
confirmed executable product sources, product manifests, and qualification
workflows are unchanged since that revision; this task changes documentation
and two repository policy checks with their regressions. An approved release
revision still needs its own complete qualification evidence.

## Verification and OpenGrep

Executed successfully on the reviewed implementation:

- `npm run release:check`, including decision validation, the legacy-name gate,
  package/matrix/release/SAST machinery checks, 104 JavaScript tests,
  34 conformance-schema tests, live read-only registry preflight, and npm dry-run.
- `npm run rust:check`: 44 policy tests, zero workspace-policy errors.
- `cargo test -p redact-secret --test public_api --locked`: 18 passed.
- `cargo clippy --workspace --all-targets --locked -- -D warnings`: passed.
- Rust package verification and Python wheel/sdist builds described above.
- Local Markdown file and heading links in the changed documents, and
  `git diff --check`: passed after this evidence document was added.

The provenance-verified OpenGrep scan ran at the exact implementation revision
with `--out` and `--sarif-out`. The
[normalized report](evidence/144/opengrep.json) records engine `1.30.0`, rules
digest `18894c09bcde68fd088ec8252e64b637d67cd975ad6fff2834374cc7345db6da`,
29 findings, 16 acknowledged scan errors, and zero unresolved baseline items.
No baseline or rule was relaxed. This is a reviewed-baseline pass, not zero
findings or full parser coverage. The #156 workflow separately enforces the
scan outcome even when SARIF upload is unavailable; `sast:test` checks that
machinery but does not replace this scan.

The final evidence-only commit records the implementation revision above;
its own new Markdown links and legacy-name checks were validated separately.
No CI run on this branch was requested or dispatched.

## Remaining authority and external evidence

Live public metadata reported no published package under any of the eight npm,
two crates.io, or one normalized PyPI product identities. That establishes
public package absence at check time, not publisher rights, trusted-publisher
configuration, or a successful registry consumer install.

Explicit candidate-version approval remains required. After applying it, the
changelog and manifests must name that value and the resulting candidate must
be reverified. Release approval after review is a separate step. This work
created only a local workbench branch and local WIP commits; it did not create
a release branch or tag, push, publish, dispatch a workflow, deploy, or change
repository settings.
