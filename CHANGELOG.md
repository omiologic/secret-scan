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
