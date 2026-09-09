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
