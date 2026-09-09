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

## Implemented

- `DetectorRegistry`: ordered, duplicate-free registration; built-in detectors
  always precede custom ones.
- `run_detector_pipeline` and `scan`: candidate validation (identifier
  grammar, in-bounds ranges on UTF-8 character boundaries), overlap resolution
  by specificity, confidence, narrower span, registration order, then emission
  order, deterministic `finding-N` ids, and one policy evaluation per finding.
- `shannon_entropy`: bits per Unicode scalar value, summed in first-occurrence
  order so results match the TypeScript oracle exactly.
- `SecretScanError`: a code and nothing else. Codes and messages are fixed and
  never include input, candidate fields, or matched values.

Not yet ported: built-in detectors (`detectors::built_in_detectors` is
empty), the default policy, redaction and placeholder validation, and the
incremental sanitizer.
