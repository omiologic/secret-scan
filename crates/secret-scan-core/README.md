# secret-scan (Rust core)

Deterministic secret detection and redaction. This crate is the canonical
implementation of the `secret-scan` product; every language binding
translates to it rather than reimplementing detector behavior.

Path: `crates/secret-scan-core`. Registry name: `secret-scan` (library
`secret_scan`); see
[docs/rust-workspace.md](../../docs/rust-workspace.md#registry-names).

## Boundary

- `std` is allowed. Runtime network, filesystem, environment, process,
  clock, thread, telemetry, secret-storage, and UI facilities are not — in
  the dependency graph or in the sources.
- No binding-specific dependency, no Cargo features, no optional or
  target-specific dependencies. A dependent gets one shape of this crate.
- `#![forbid(unsafe_code)]`.
- Public ranges are UTF-8 byte offsets into the original input
  (`secret_scan::RANGE_UNIT`). Bindings convert to their host unit without
  changing the selected span.
- Errors are sanitized: a fixed code and message, never an input fragment, a
  matched value, or a placeholder.

The dependency list is intentionally empty. `npm run rust:check` fails when a
dependency, source facility, feature, or packaged file steps outside the
boundary declared in the root `Cargo.toml`.

## Public API

```rust
use secret_scan::{
    DefaultPolicy, DetectorRegistry, default_placeholder_formatter, scan_and_redact,
};

let registry = DetectorRegistry::with_built_in([])?;
let input = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000";

let result = scan_and_redact(input, &registry, &DefaultPolicy, &default_placeholder_formatter)?;

assert_eq!(result.text(), "API_KEY=<SECRET_1>");
// Findings keep byte offsets into the original input, not into the output.
let range = result.findings()[0].range();
assert_eq!(&input[range.start()..range.end()], "ghp_SYNTHETICREVOKED00000000000000000000");
```

(The same example runs as a doctest on `secret_scan`'s crate-level
documentation, inside a function that returns `Result`.)

| Concern | API |
| --- | --- |
| Scan | `scan`, `run_detector_pipeline` |
| Redact | `redact`, `MAX_PLACEHOLDER_LENGTH` |
| Scan and redact | `scan_and_redact` |
| Incremental | `IncrementalSanitizer`, `IncrementalLimits`, `SessionState` |
| Policy | `Policy`, `PolicyContext`, `DefaultPolicy`, `Action` |
| Formatter | `PlaceholderFormatter`, `PlaceholderContext`, `default_placeholder_formatter`, `typed_placeholder_formatter` |
| Finding | `Finding`, `DetectedFinding`, `ByteRange`, `Confidence`, `Specificity` |
| Result | `ScanResult`, `IncrementalResult` |
| Sanitized error | `SecretScanError`, `SecretScanErrorCode` |
| Custom detectors | `Detector`, `Candidate`, `DetectorContext`, `DetectorRegistry` |

Everything else is private. The built-in detector set is reached only through
`DetectorRegistry::with_built_in`, and the incremental retention tuning is
derived through `IncrementalLimits::minimum_buffered_bytes` rather than
exposed as a constant, so both can change without breaking a caller.

`[workspace.metadata.secret-scan] core-public-api` in the root `Cargo.toml`
lists that surface name by name, and
`crates/secret-scan-core/tests/public_api.rs` exercises each one through a
`secret_scan::` path — so a name cannot join or leave the API without a
reviewed manifest change.

## Behavior

- **Pipeline.** Every registered detector runs in registration order; each
  candidate is validated (identifier grammar, in-bounds ranges on UTF-8
  character boundaries); overlaps resolve by specificity, confidence,
  narrower span, registration order, then emission order; survivors are
  numbered `finding-1`, `finding-2`, … by input offset, and the policy is
  evaluated once per finding. Identical input and configuration always
  produce identical findings and ids.
- **Redaction.** One ordered pass replaces `redact` and `block` spans with
  formatter output, leaving `warn` and `allow` untouched, and rejects a
  placeholder that is empty, over-long, or reproduces a matched value.
- **Incremental.** `IncrementalSanitizer` is a bounded four-state session
  that emits only text whose detection window is closed and accepts input
  independently of how a caller partitions it into chunks.

Until the Rust core passes the shared conformance corpus, the TypeScript
implementation in `src/` remains the behavioral oracle
(`decision-govern-cross-language-conformance`).
