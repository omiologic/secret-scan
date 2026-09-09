# Changelog

This file records user-visible package changes. An `Unreleased` entry does not
select or authorize a release.

## Unreleased

### Added

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
  replaced by `IncrementalLimits::minimum_buffered_bytes`.
- `npm run rust:check` gained public-API, source-boundary, core-manifest-shape,
  and package-content checks, so the core keeps no runtime I/O, no Cargo
  features, and no binding-specific dependency, and the published package
  carries only the library and its README. CI additionally builds the docs with
  warnings denied and verifies that the published core package builds on its
  own. The crates.io names `secret-scan` and `secret_scan` were rechecked on
  2026-09-09 before the manifests were finalized.
- Unified `@omiologic/secret-scan` npm package in `packages/javascript`: one
  typed API whose conditional `exports` select the Node N-API addon or the
  browser WebAssembly build, a shared `await initialize()` contract that gates
  every synchronous operation, frozen findings with explicit UTF-16 code-unit
  offsets, one sanitized `SecretScanError`, and a lockstep version check. It is
  not published yet; the repository-root TypeScript implementation remains the
  released package and the behavioral oracle.

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
