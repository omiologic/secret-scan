# Rust workspace

This page records the ownership boundaries and the explicit policies of the
Rust and binding workspace introduced by
`decision-adopt-rust-core-monorepo` and `decision-define-runtime-bindings`.
The repository-root TypeScript implementation that formerly served as the
behavioral oracle has been removed (`RB-2`, issue #72); the canonical
behavioral contract is now the fixture corpus under `conformance/fixtures/`
(`decision-govern-cross-language-conformance`).

## Layout and ownership

| Path | Cargo package | Role | May depend on | Publishes as |
| --- | --- | --- | --- | --- |
| `crates/secret-scan-core` | `secret-scan` (lib `secret_scan`) | Canonical detection, overlap resolution, policy, redaction, incremental sanitization. UTF-8 byte offsets. | `std` and the allowlist in `[workspace.metadata.secret-scan]` (currently empty) | crates.io `secret-scan` |
| `crates/secret-scan-cli` | `secret-scan-cli` (bin `secret-scan`) | Host adapter for process arguments, standard streams, exit codes, and files. | core, host crates | CLI artifact of the same version |
| `bindings/node` | `secret-scan-node` (cdylib) | N-API addon; UTF-16 code unit ranges. | core, `napi`, `napi-derive`, `napi-build` | Consumed by `packages/javascript`; never on its own |
| `bindings/wasm` | `secret-scan-wasm` (cdylib) | `wasm-bindgen` browser build; UTF-16 code unit ranges. | core, `wasm-bindgen` | Consumed by `packages/javascript`; never on its own |
| `bindings/python` | `secret-scan-python` (cdylib, module `secret_scan._native`) | PyO3 extension built by maturin; Unicode code point ranges. | core, `pyo3` | PyPI `omiologic-secret-scan` (imported as `secret_scan`) |
| `packages/javascript` | none | The `@omiologic/secret-scan` npm package: one typed API whose `exports` map selects the Node addon or the wasm build, with the shared `await initialize()` contract. | Node and wasm bindings | npm `@omiologic/secret-scan` |

Bindings and the CLI translate host APIs to the core. They never reimplement
detector behavior, and they convert ranges without changing the selected span.

`bindings/python` is the Python binding `decision-release-bindings-in-lockstep`
requires before the separately created `secret-scan-python` GitHub repository
(empty today) is archived with a redirect. The redirect text is prepared, not
yet applied, in
[`docs/python-repository-redirect.md`](./python-repository-redirect.md).

### One manifest named `@omiologic/secret-scan`

`packages/javascript` is the only tracked manifest that declares the package
name `@omiologic/secret-scan`; it is what `npm publish` publishes. The
repository root `package.json` is private tooling for this monorepo and
declares no package name of its own. This was not always true: until
`RB-2` (issue #72) cut the published artifact over, the repository-root
TypeScript implementation (`src/`, `test/`) was a second manifest under the
same name and the released package.

`packages/javascript` owns the public JavaScript API, the runtime loaders, and
the initialization contract. It may depend on the Node and WebAssembly
bindings, and it must not reimplement detector behavior. Build it with
`npm run js:build`, type-check it with `npm run js:typecheck`, and test it with
`npm run js:test`; `npm run ci` runs all three.

It depends on those bindings the N-API way
(`decision-ship-first-release-artifact-set`): an `optionalDependencies` entry
per `bindings/node/package.json`'s `napi.targets`
(`@omiologic/secret-scan-<platform>`, `os`/`cpu`/`libc`-scoped so npm skips
the ones that do not match a given install), resolved at runtime by
`process.platform`/`process.arch` in `src/runtime/node.ts`, plus an ordinary
`dependencies` entry on `@omiologic/secret-scan-wasm`. Neither the platform
packages nor the wasm package is published yet.

Publishing them is not a separate one-time action gated apart from
`packages/javascript` itself (issue #141): `.github/workflows/release.yml`'s
`publish-native-dependencies` and `publish-wasm-dependency` jobs pack,
content-check, publish, and verify every dependency package from the exact
artifact `artifact-qualification` already qualified for that commit, and the
wrapper's own `publish` job declares both in `needs:`
(`scripts/check-release-gate.py` enforces the edge), so it cannot become
eligible ahead of them. `scripts/publish-dependency-package.mjs` is
idempotent by registry state rather than by a cutover-vs-routine switch: the
first dispatch, with nothing published yet, publishes all seven packages;
every routine dispatch after it finds them already published, verifies the
registry's content still matches this revision's, and skips republishing
(npm versions are immutable). One dispatch of `Release`, gated on the
release approval `AGENTS.md` mandates, is both the first cutover and every
release after it -- there is no separate "publish only the wrapper" path.

## Policies

### Format

`rustfmt.toml` uses only stable options so `cargo fmt --all --check` gives
the same answer on the MSRV and on current stable. CI fails on any diff.

### Lint

`[workspace.lints]` in the root `Cargo.toml` is inherited by every member
through `[lints] workspace = true`. Clippy pedantic is a warning, and
`unwrap_used`, `expect_used`, `panic`, `dbg_macro`, `todo`, `unimplemented`,
and `undocumented_unsafe_blocks` are errors. `clippy.toml` relaxes `unwrap`
and `expect` in tests. CI runs `cargo clippy --workspace --all-targets` with
`-D warnings` and builds with `RUSTFLAGS=-D warnings`, so `missing_docs` and
other warning-level lints also fail the build there.

### Test

`cargo test --workspace --locked` runs on Linux, macOS, and Windows. Tests
must be deterministic and must not embed real credentials; the same fixture
rules as the TypeScript suite apply. Cross-language behavior is exercised by
the conformance corpus once it exists, not by per-binding copies.

### Dependency

Two layers apply:

- `deny.toml` (`cargo deny check`) allows only crates.io as a source,
  restricts licenses to the listed permissive set, denies yanked crates and
  known advisories, and denies wildcard requirements.
- `[workspace.metadata.secret-scan]` in the root `Cargo.toml` declares the
  core boundary. `npm run rust:check` walks the core's transitive normal and
  build dependency graph from `cargo metadata` and fails when a package is
  missing from `allowed-dependencies` or present in
  `forbidden-dependencies`. The forbidden list names crates that provide
  runtime network, filesystem, environment, telemetry, secret-storage, or UI
  behavior and cannot be allowlisted. Dev-dependencies are outside the
  boundary because they never ship.

To add a core dependency, add it and each of its transitive dependencies to
`allowed-dependencies` in the same change, and state in the pull request why
the dependency keeps the core deterministic and side-effect free.

### Public API

The core crate is the published library, so its surface is pinned in three
places that must agree:

- `crates/secret-scan-core/src/lib.rs` declares it. Every module below the
  crate root is private; the crate root re-exports the names that are public,
  and its documentation opens with a "Public surface" table that names them
  all.
- `[workspace.metadata.secret-scan] core-public-api` in the root `Cargo.toml`
  lists those names. `npm run rust:check` fails when the crate root exports a
  name the list does not carry, when the list names an export that is gone,
  and when the documented table and the list disagree in either direction —
  so a change to the published surface is always a reviewed manifest change,
  and the documentation cannot quietly fall behind it.
- `crates/secret-scan-core/tests/public_api.rs` uses every one of them
  through a `secret_scan::` path, the way a dependent crate does, and pins
  the range contract, the `scan_and_redact` ≡ `scan` + `redact` equivalence
  over the canonical corpus, and the sanitized-error shape.

Two things are deliberately outside the surface and must stay there:

- **The built-in detector registry.** `detectors` is a private module.
  Callers reach the built-in set only through
  `DetectorRegistry::with_built_in`, so which detectors exist and how they
  are constructed can change without breaking a dependent. What is public is
  the observable consequence of their order: it is the fourth overlap tie
  breaker, fixed by the conformance corpus.
- **Retention tuning.** The lookaround reserve the incremental session needs
  is a private constant that tracks the built-in detector set. Callers derive
  the requirement with `IncrementalLimits::minimum_buffered_bytes` instead of
  reproducing the arithmetic.

Ranges in every public value are UTF-8 byte offsets into the *original*
input, including the findings returned alongside redacted text by
`scan_and_redact` and by an incremental session — redaction changes lengths,
so a range read against the sanitized text would select the wrong span.

### No runtime I/O

Two checks in `npm run rust:check` back the claim that the core is
side-effect free, on top of the dependency boundary above:

- **Source boundary.** No file under `crates/secret-scan-core/src` may name
  `std::fs`, `std::net`, `std::env`, `std::process`, `std::io`,
  `std::thread`, `std::time`, `std::os`, `option_env!`, `include_str!`,
  `include_bytes!`, `println!`, or `eprintln!`, or reach for a crate listed
  in `binding-dependencies`. The `env!` macro is allowed: the compiler
  resolves it, and it reads nothing at runtime.
- **Manifest shape.** The core declares no Cargo features, no optional
  dependency, no target-specific dependency, and nothing from
  `binding-dependencies`. There is one shape of this crate, and it is the one
  the test suite exercises. `binding-dependencies` is separate from
  `forbidden-dependencies` because the bindings depend on those crates
  legitimately; only the core may not.

### Package contents

`crates/secret-scan-core/Cargo.toml` declares `include`, so the published
package is the library, its README, and the manifest metadata cargo
generates — nothing else. `npm run rust:check` runs `cargo package --list`
for the core and fails when a file matches no `core-package-globs` entry or
when a `core-package-required` file is missing.

The integration tests stay out of the package on purpose: they `include_str!`
the canonical fixtures under `conformance/fixtures/`, which live above the
package root and cannot travel with it. `cargo package` therefore verifies
the published crate by building the library alone, and reports the excluded
test targets as warnings.

### Unsafe code

`[workspace.lints.rust] unsafe_code = "deny"` applies to every member, and
`crates/secret-scan-core/src/lib.rs` and `crates/secret-scan-cli/src/main.rs`
carry `#![forbid(unsafe_code)]`; `npm run rust:check` fails if either is
removed. A binding may add an item-scoped `#[allow(unsafe_code)]` only at a
real FFI boundary, with a `// SAFETY:` comment that
`clippy::undocumented_unsafe_blocks` requires, and the review must record why
the binding macros were insufficient.

### Version lockstep

Every workspace member's Cargo version and every JSON manifest that carries
the product's own version number share one value. `LOCKSTEP_MANIFESTS` in
`scripts/check-rust-workspace.py` names the JSON manifests: `bindings/node/package.json`
and `packages/javascript/package.json`. `npm run rust:check` fails when either
of them, or any workspace Cargo member, drifts from `[workspace.package] version`
in the root `Cargo.toml`; `scripts/tests/test_check_rust_workspace.py` drifts
each `LOCKSTEP_MANIFESTS` entry individually and asserts the check reports it.
`bindings/python/pyproject.toml` declares `version = "dynamic"` and takes its
version from `bindings/python/Cargo.toml` at build time, so it needs no entry
of its own — it is covered by the Cargo member check. The repository root
`package.json` is private tooling, declares no package name, and is not
version-locked to the product: `RB-2` (issue #72) removed it from
`LOCKSTEP_MANIFESTS` when it cut the published npm artifact over to
`packages/javascript`, the only manifest that still declares
`@omiologic/secret-scan`.

`packages/javascript` first publishes under whatever version is current in
this lockstep set; publishing it, and its platform and wasm dependencies, for
the first time is a one-time cutover action gated on the release approval
`AGENTS.md` mandates, not a routine release.

### MSRV

The supported minimum Rust version is the highest `rust-version` required by
the binding dependencies selected in the root `Cargo.toml`:

| Dependency | Version | `rust-version` |
| --- | --- | --- |
| `napi` (with `napi-sys`, `libloading`) | 3.12.2 | 1.88 |
| `napi-derive`, `napi-build` | 3.6.3, 2.4.1 | 1.88 |
| `pyo3` | 0.29.2 | 1.83 |
| `wasm-bindgen` | 0.2.128 | 1.77 |

Derived and pinned MSRV: **1.88** (Rust 2024 edition), recorded on
2026-09-09. It is pinned once in `[workspace.package] rust-version` and
inherited by every member, mirrored by the `MSRV` value in
`.github/workflows/ci.yml`, and exercised by the `Rust MSRV` job with
`cargo check --workspace --all-targets --locked` on that toolchain.
`npm run rust:check` fails when a member drifts, when the workflow value
differs, or when any resolved dependency requires a newer compiler than the
pin.

To raise the MSRV, update `rust-version`, the workflow `MSRV` value, and this
table together, and note the change in the changelog.

## Registry names

The product name is `secret-scan` for every artifact. Registry names may
differ (`decision-release-bindings-in-lockstep`).

- crates.io: the preferred crate name `secret-scan` was rechecked on
  2026-09-09, before the crate manifests were finalized, and is available; so
  is `secret_scan`, which crates.io treats as the same name. `secret-scan-cli`
  and the fallback `omiologic-secret-scan` are also available. If
  `secret-scan` is taken before the first publication, the registry fallback is
  `omiologic-secret-scan` for the core and `omiologic-secret-scan-cli` for the
  CLI; the product name, binary name, and library path `secret_scan` do not
  change. Recheck before publication with
  `python3 scripts/check-rust-workspace.py --recheck-crate-name`.
- npm: `@omiologic/secret-scan` is the existing package name.
- PyPI: `secret-scan` belongs to an unrelated project, verified 2026-09-09 and
  rechecked when the packaging contract was written, so the distribution takes
  the fallback `omiologic-secret-scan`, which is available. The import name
  stays `secret_scan`. The name is declared in
  `[workspace.metadata.secret-scan] python-distribution` and enforced by
  `npm run python:check`. Recheck before publication with
  `python3 scripts/check-python-package.py --recheck-pypi-name`; see
  [docs/python-packaging.md](./python-packaging.md).

## Verification

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps --locked
cargo package -p secret-scan --locked
cargo run --quiet --locked -p secret-scan-cli -- --version
cargo check -p secret-scan -p secret-scan-wasm --target wasm32-unknown-unknown --locked
cargo +1.88 check --workspace --all-targets --locked
cargo deny check
npm run rust:check
```

Toolchain setup: `rustup toolchain install 1.88 --profile minimal`,
`rustup target add wasm32-unknown-unknown`, and `cargo install cargo-deny`.
The CI jobs `rust-policy`, `rust-native`, `rust-msrv`, and `rust-wasm` run
the same commands. `cargo test --workspace` includes the doctests on the core
crate's public API; `cargo doc` fails on a broken intra-doc link because the
crate root denies `rustdoc::broken_intra_doc_links` and
`rustdoc::private_intra_doc_links`, and `missing_docs` is denied there too.

To recheck the registry names before a publication:

```bash
python3 scripts/check-rust-workspace.py --recheck-crate-name
python3 scripts/check-python-package.py --recheck-pypi-name
```

## Python packaging

The CPython distribution's identity, its abi3 contract, its wheel matrix, and
how each artifact is qualified are declared in the same
`[workspace.metadata.secret-scan]` table and documented separately in
[docs/python-packaging.md](./python-packaging.md). `npm run python:check`
enforces that contract and runs in `npm run ci`;
`.github/workflows/python-wheels.yml` builds and qualifies the artifacts.

## Cross-platform qualification

The same table also declares the rest of the supported surface —
`node-addon-targets`, `cli-release-targets` (a strict subset: the CLI ships
no musl variant), `browser-engines`, and `node-support-majors` — documented
separately in
[docs/qualification.md](./qualification.md). `npm run artifacts:check` enforces
that every manifest, qualifier script, and workflow matrix agrees with those
lists, and that every workflow job takes least-privilege permissions and pins
every third-party action; it runs in `npm run ci`.
`.github/workflows/artifact-qualification.yml` builds and qualifies every artifact from
one commit and records an inventory tied to it.
