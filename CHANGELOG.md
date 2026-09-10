# Changelog

This file records user-visible package changes. An `Unreleased` entry does not
select or authorize a release.

## Unreleased

### Added

- A cross-platform qualification matrix (#33). The new `Qualification Matrix`
  workflow builds and proves every supported artifact from one commit and
  publishes nothing: it calls `CI` and `Python wheels` for the Rust workspace
  and the eight-target abi3 wheel matrix, and adds the N-API addon and the CLI
  binary for eight targets each — Linux glibc and musl on x64 and arm64, macOS
  on x64 and arm64, Windows on x64 and arm64 — plus the browser WebAssembly
  artifact. Every native artifact is smoke-tested on the architecture it
  targets, musl artifacts inside a musl container; the addon is qualified on
  Node.js 20, 22, and 24; and the browser artifact is initialized and scanned
  in Chromium, Firefox, and WebKit. Each qualifier runs the canonical
  conformance corpus through the artifact under test — the addon and the
  browser module against UTF-16 offsets converted by an independent reference
  conversion, the CLI against the corpus's own UTF-8 byte offsets, which also
  gives the CLI its first corpus-backed check. `scripts/qualify-node-addon.mjs`,
  `scripts/qualify-browser-artifact.mjs` with `scripts/browser-harness.mjs`,
  `scripts/build-browser-artifact.mjs`, and `scripts/qualify-cli-binary.mjs`
  are runnable outside CI, exposed as `npm run addon:qualify`,
  `browser:qualify`, `wasm:build`, and `cli:qualify`.

- A single declaration of the supported surface, in
  `[workspace.metadata.secret-scan]`: `node-addon-targets`,
  `cli-release-targets`, `browser-engines`, and `node-support-majors` alongside
  the existing `python-wheel-targets`. `scripts/check-qualification-matrix.py`
  (`npm run matrix:check`, now part of `npm run ci`) fails when
  `bindings/node/package.json`, either workflow matrix, any qualifier script,
  or any manifest declaring `engines.node` disagrees with it — in both
  directions, so a platform cannot be added or dropped in one file alone. The
  same check enforces that every workflow and every job declares its own
  least-privilege `permissions` and that every third-party action is pinned to
  a commit SHA. 25 unit tests cover each failure.

- `scripts/record-artifact-inventory.py` closes a qualification run by
  requiring the whole declared matrix and recording `artifact-inventory.json`
  against the source commit: the product version, `"published": false`, the
  SHA-256 of every canonical fixture file, the declared matrices, every
  artifact file's size and SHA-256, and the file-by-file contents of the npm
  package and the public Rust crate. 12 unit tests cover it.

- `docs/qualification.md` documents the declaration, the workflow, the runner
  map, what each qualifier proves, the inventory, and how to run the whole
  thing locally.

- `docs/audits/release-gap-disposition.md` records one disposition for every
  finding the Rust-core migration retrospective produced (#66): all 55 findings
  from the closed-issue acceptance evidence ledger and the three independent
  reviews, classified against issue #66's blocker test into 26 release blockers,
  25 deferred quality findings, and 4 intentional exclusions. It specifies nine
  bounded remediation Tasks under Feature #11 (#71-#79), each recording its
  source finding ids, inputs, outputs, deterministic acceptance criteria,
  dependencies, and exact exit evidence; resolves all twenty release-readiness criteria of #3,
  #11, #60, and #61 to evidence, a blocker, a deferred item, or an intentional
  exclusion; and rules that `_notes/` is deliberately untracked so no tracked
  file may cite a path inside it. It classifies and specifies work only, changes
  no closed issue's state, and authorizes no release operation.

- `docs/audits/deferred-quality-backlog.md` records the 25 non-blocking findings
  with their class, severity, evidence, and exact exit condition, tracked by #80
  and deliberately outside Epic #60's tree so none of them blocks the closeout. Three of them
  close as side effects of blocker work, and each says which.

- `docs/audits/ci-release-automation-supply-chain-review.md` records an
  independent review of the release candidate's pre-release qualification and
  operational controls (#65): the five workflows, the release and reconcile
  automation, the documented Rust, Node native, browser, Python wheel, CLI, and
  package-artifact matrices, and the supply-chain posture behind them. It
  records what was verified — SHA-pinned actions, empty default workflow
  permissions, non-persisted checkout credentials, `--ignore-scripts`
  installation, the enforced MSRV and wheel-matrix cross-checks, and the
  fully qualified eight-target wheel matrix — and twenty-three evidence-backed
  findings, five of them blocking, each with its affected control, severity, and
  an exact exit condition. It dispatched no workflow and records evidence only;
  it authorizes no release operation.

- `docs/audits/javascript-python-bindings-package-contracts-review.md` records
  an independent review of the release candidate across the JavaScript runtime
  adapters, the Python binding, and the npm and PyPI package contracts (#64):
  what was verified for each acceptance criterion with the spans and
  reproductions that establish it, and twelve evidence-backed findings — three
  of them blocking, all in the browser half of the JavaScript package — each
  with its affected public contract, severity, and an exact exit condition. It
  records evidence only and authorizes no release operation.

- `docs/audits/core-conformance-cli-boundary-review.md` records an independent
  review of the release candidate across the canonical Rust core, the shared
  conformance contract, and the CLI host boundary (#63): what was verified in
  each area with the spans and reproductions that establish it, and eight
  evidence-backed findings, each with its affected spans, severity, and an
  exact exit condition. It records evidence only and authorizes no release
  operation.

- `docs/audits/closed-issue-acceptance-evidence-ledger.md` records criterion-level
  acceptance evidence for the closed Rust-core migration issues (#3-#10 and
  #12-#32): every original criterion, its class, the current files and
  deterministic tests that establish it, and the recorded CI run that executes
  them, with the remaining gaps classified and attributed to their open work
  items. It records evidence only and authorizes no release operation.

- CPython packaging for the Python binding: the `omiologic-secret-scan`
  distribution (imported as `secret_scan`), built by maturin as a `cp310-abi3`
  wheel that serves every CPython from 3.10 upward with no pure-Python
  fallback, with PEP 561 typing markers, PEP 639 license metadata, no runtime
  dependency, and a source distribution that vendors the core crate. The
  supported wheel matrix is manylinux and musllinux, macOS, and Windows in both
  x64 and arm64.
- `npm run python:check` (`scripts/check-python-package.py`, now part of
  `npm run ci`) enforces the packaging contract declared in
  `[workspace.metadata.secret-scan]`: the distribution and import names, the
  abi3 floor and the `requires-python` floor agreeing with each other, the
  absence of any Python implementation beside the extension, the typing
  markers, and the wheel matrix the workflow actually builds.
  `--recheck-pypi-name` rechecks the registry names before a publication.
- `scripts/qualify-python-wheel.py` inspects wheel and source-distribution
  contents and metadata, installs each wheel with no index, no dependency, and
  no source fallback, smoke-tests it outside the repository, runs the shared
  conformance suite against the installed artifact, and checks both documented
  source-distribution branches. `.github/workflows/python-wheels.yml` builds
  every target and qualifies each wheel on the architecture it targets, on
  CPython 3.10 (3.11 on Windows on Arm) and 3.14 — the newest interpreter the
  distribution claims a classifier for. Qualification understands what a
  repaired Linux wheel actually carries: a compressed platform tag set whose
  elements must all name the same target, and an
  `omiologic_secret_scan.libs/` directory of vendored shared objects.
- `docs/python-packaging.md` documents the distribution identity, the abi3
  contract, the wheel matrix, qualification, and source-distribution behavior.

- Rust workspace scaffold with the `secret-scan` core crate, the `secret-scan`
  CLI, Node, WebAssembly, and Python binding crates, and a `packages/javascript`
  ownership boundary; the TypeScript implementation is unchanged.
- Explicit workspace format, lint, test, dependency, unsafe-code, and MSRV
  (Rust 1.88) policies enforced by `npm run rust:check`, `cargo deny`, and new
  Rust CI jobs covering native hosts, the MSRV toolchain, and the wasm32 target.
- Rust core pipeline contracts: immutable candidate, finding, confidence,
  specificity, action, policy, formatter, and UTF-8 byte-range types; Shannon
  entropy; an ordered detector registry; candidate validation on character
  boundaries; the documented overlap precedence; and sanitized errors with fixed
  public codes and messages. Built-in detectors, the default policy, and
  redaction are not ported yet.
- Stabilized public Rust API for the `secret-scan` core crate: `scan_and_redact`
  and a shared `ScanResult` (which `IncrementalResult` now names) alongside the
  existing scan, redact, incremental, policy, formatter, finding, and sanitized
  error APIs, all documented with runnable examples. Public ranges are UTF-8
  byte offsets into the original input, including the findings returned with
  redacted text.
- The built-in detector registry and the incremental retention tuning are now
  private: the built-in set is reached only through
  `DetectorRegistry::with_built_in`, and `INCREMENTAL_LOOKAROUND_BYTES` is
  replaced by `IncrementalLimits::minimum_buffered_bytes`. The Python binding
  mirrors that: its `INCREMENTAL_LOOKAROUND_BYTES` module constant is replaced
  by the `IncrementalLimits.minimum_buffered_bytes(max_token_bytes,
  max_multiline_bytes)` static method, so no binding exposes tuning the core
  keeps private.
- `npm run rust:check` gained public-API, source-boundary, core-manifest-shape,
  and package-content checks, so the core keeps no runtime I/O, no Cargo
  features, and no binding-specific dependency, and the published package
  carries only the library and its README. CI additionally builds the docs with
  warnings denied and verifies that the published core package builds on its
  own. The crates.io names `secret-scan` and `secret_scan` were rechecked on
  2026-09-09 before the manifests were finalized.
- Bounded incremental sanitization in the Python binding:
  `IncrementalSanitizer` with mandatory `IncrementalLimits`, an explicit
  `accepting`/`finalized`/`aborted`/`failed` lifecycle, immutable per-call
  results, incremental `policy` and `formatter` callbacks that receive only safe
  metadata, and a `with` block that aborts a session left unfinalized. Findings
  carry absolute Unicode code point offsets into the whole-session input and
  keep stable ids across calls; `abort` and every failure discard retained
  plaintext and raise a fixed, input-free exception.
- Unified `@omiologic/secret-scan` npm package in `packages/javascript`: one
  typed API whose conditional `exports` select the Node N-API addon or the
  browser WebAssembly build, a shared `await initialize()` contract that gates
  every synchronous operation, frozen findings with explicit UTF-16 code-unit
  offsets, one sanitized `SecretScanError`, and a lockstep version check. It is
  not published yet; the repository-root TypeScript implementation remains the
  released package and the behavioral oracle.
- Node and Web stream adapters on that package, published as the
  `@omiologic/secret-scan/node-stream` and `@omiologic/secret-scan/web-stream`
  subpaths. Each drives one incremental session per stream through a single
  fatal, stateful UTF-8 decoder, emits only text whose detection window is
  closed, exposes frozen findings with absolute whole-stream offsets, and
  discards retained plaintext on Node destruction, Web cancellation, writable
  abort, and explicit abort. Backpressure and errors travel through the host's
  own stream contract, and two new `SecretScanError` codes, `INVALID_CHUNK` and
  `INVALID_UTF8`, report malformed adapter input. The root export and the Web
  subpath resolve no Node-only module.
- `check` and `redact` modes on the `secret-scan` CLI. Check reads standard
  input when no path is given and otherwise every path given, exiting `0` when
  clean, `1` on any finding, and `2` on a usage, decoding, or processing
  failure; a failure outranks a finding. Reports carry safe file identity and
  finding metadata only, as one line per finding or, with `--json`, one
  machine-consumable object with `version`, `rangeUnit`, `findingCount`,
  `sources`, and `failures`, whose `id` is unique across the whole report.
  `--redact` sanitizes standard input or exactly one path to standard output,
  never modifies its input in place, and reports `0` or `2` only, because a
  finding is its purpose rather than its failure. Standard input is streamed
  through the incremental core under explicit declared limits and a path is
  read whole under the same total-input bound; the construct limits are sized
  for the long lines a pipeline carries, so an ordinary minified bundle,
  lockfile entry, or base64 blob behaves the same streamed or scanned by path.
  Input that is not valid UTF-8 fails closed with an input-free diagnostic, and
  a partial read, a limit failure, an abort, or a closed downstream pipe leaves
  no retained plaintext.

### Changed

- The N-API addon and the CLI now declare `x86_64-unknown-linux-musl` and
  `aarch64-unknown-linux-musl` as supported targets, matching the wheel matrix,
  and `bindings/node/package-lock.json` is tracked so the addon build toolchain
  installs reproducibly with `npm ci`.

- `CI` runs the JavaScript checks on Node.js 24 as well as 20 and 22, so every
  major `engines.node >=20` claims is exercised, and is callable as a reusable
  workflow so one qualification run carries its evidence.

### Fixed

- Every job in `Package Release Rehearsal` now declares its own permissions
  rather than inheriting the workflow default.

### Known gaps

- No built artifact carries `createIncrementalSanitizer`, which
  `packages/javascript/src/native.ts` makes part of the internal binding
  contract, so `initialize()` from `@omiologic/secret-scan` does not yet
  succeed on a real addon or a real browser artifact. Browser and Node support
  is therefore qualified at the artifact boundary. `scripts/qualify-node-addon.mjs`
  asserts that this is the single outstanding contract member, so the check
  fails when the bindings gain the incremental surface. Issues #73 and #74 own
  closing it.

## 0.1.0-beta.1 - 2026-08-31

### Added

- Runtime-neutral whole-input detection, policy, and redaction APIs for modern
  browsers and Node.js.
- Bounded incremental sanitization plus isolated Node and Web stream adapters.
- Deterministic built-in coverage for the credential families and contextual
  structures documented in the README.
- Extension contracts for custom detectors, policies, and placeholder
  formatters.

### Changed

- Limited the root public API to supported consumer contracts; incremental
  lookaround tuning remains an internal implementation detail.
- Defined custom placeholder safety for every non-empty replaced range,
  including caller-supplied findings shorter than four UTF-16 code units.
- Reconciled coverage exclusions, extension trust assumptions, server resource
  guidance, adapter behavior, and package contents across public documentation.

### Security

- Placeholder output is rejected when it contains any replaced matched text
  that can fit within the 256-code-unit placeholder limit.
