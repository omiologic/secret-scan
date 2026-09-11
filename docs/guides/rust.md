# Rust

[Documentation home](../README.md) · [Installation](../getting-started.md)

The `redact-secret` crate is imported as `redact_secret`. It has no normal
runtime dependencies and performs no network or filesystem access.

```rust
use redact_secret::{
    DefaultPolicy, DetectorRegistry, SecretScanError,
    default_placeholder_formatter, scan_and_redact,
};

fn main() -> Result<(), SecretScanError> {
    let registry = DetectorRegistry::with_built_in([])?;
    let result = scan_and_redact(
        "API_KEY=SYNTHETIC_REVOKED_CONTEXT_VALUE",
        &registry,
        &DefaultPolicy,
        &default_placeholder_formatter,
    )?;
    assert_eq!(result.text(), "API_KEY=<SECRET_1>");
    assert_eq!(result.findings().len(), 1);
    Ok(())
}
```

Reuse the registry for repeated scans. `scan` returns policy-evaluated findings;
`redact` takes the original input, findings, and a formatter. `scan_and_redact`
combines those operations. Ranges are half-open UTF-8 byte offsets on character
boundaries. Never apply them to redacted output or log the selected input span.

`DefaultPolicy` redacts known credentials and blocks private-key material.
`block` still replaces the range; the host must reject downstream use itself.
`Policy` and `PlaceholderFormatter` support trusted callbacks with safe metadata.
The direct Rust API also exposes custom detector traits; these receive input
and are trusted code. The JavaScript and Python bindings do not expose custom
detector callbacks.

`IncrementalSanitizer` requires explicit `IncrementalLimits`. Derive the buffer
minimum with `IncrementalLimits::minimum_buffered_bytes`; do not copy internal
retention constants. See [streaming](streaming.md) for lifecycle and failure rules.

The [core API inventory](../../crates/secret-scan-core/README.md#public-api)
lists the full surface. Generate local rustdoc with
`cargo doc -p redact-secret --no-deps --locked`.
