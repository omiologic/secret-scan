# secret-scan (Rust core)

Canonical detection and redaction implementation for the `secret-scan`
product. Path: `crates/secret-scan-core`. Registry name: `secret-scan`
(see [docs/rust-workspace.md](../../docs/rust-workspace.md#crate-names)).

Boundary:

- `std` is allowed; runtime network, filesystem, environment, telemetry,
  secret-storage, and UI dependencies are not.
- `#![forbid(unsafe_code)]`.
- Public ranges use UTF-8 byte offsets.

The dependency list is intentionally empty. `npm run rust:check` fails when a
dependency outside the workspace allowlist is added.
