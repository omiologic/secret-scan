# secret-scan for Python

Deterministic secret detection and redaction for CPython, over the same Rust
core that backs the JavaScript, Rust, and CLI surfaces of
[secret-scan](https://github.com/omiologic/secret-scan). Every built-in
detector runs in Rust; there is no pure-Python fallback implementation to drift
from it.

The distribution is `omiologic-secret-scan` and the import name is
`secret_scan`. The product name is `secret-scan` everywhere, but that name on
PyPI belongs to an unrelated project, so this distribution uses the registry
fallback recorded in
[docs/rust-workspace.md](https://github.com/omiologic/secret-scan/blob/main/docs/rust-workspace.md#registry-names).

> No release is authorized by the version currently in the development
> manifests. Installation applies only after a separately approved release.

## Install

```sh
pip install omiologic-secret-scan
```

Wheels are CPython 3.10+ `abi3`: one wheel per platform serves every supported
interpreter, and installing one needs no Rust toolchain and no compiler. See
[Supported wheels](#supported-wheels). Where no wheel applies, pip falls back to
the source distribution, which does need Rust — see
[Building from source](#building-from-source).

## Use

```python
import secret_scan

findings = secret_scan.scan(text)
redacted = secret_scan.redact(text, findings)

# or, to guarantee the findings and the redacted text agree:
result = secret_scan.scan_and_redact(text)
result.text, result.findings
```

Ranges on every `DetectedFinding` and `Finding` are Unicode code point offsets
(`secret_scan.RANGE_UNIT == "unicode-code-points"`), so they index a `str` the
way Python itself does.

For input that arrives in pieces, `IncrementalSanitizer` sanitizes a bounded
session chunk by chunk. Independently scanning chunks is unsafe, because a
credential may cross any chunk boundary; a session carries the boundary state
that makes it safe. Limits are mandatory and are counted in UTF-8 bytes:

```python
limits = secret_scan.IncrementalLimits(
    max_input_bytes=1_000_000,
    max_buffered_bytes=32_896,
    max_token_bytes=8_192,
    max_multiline_bytes=32_768,
)

with secret_scan.IncrementalSanitizer(limits) as session:
    first = session.append("api_key=SYNTHETIC_REVOKED_")
    second = session.append("INCREMENTAL_VALUE\nordinary text")
    final = session.finalize()

safe_text = first.text + second.text + final.text
# api_key=<SECRET_1>\nordinary text
```

Leaving the `with` block aborts a session that was not finalized, so whatever it
still retained is discarded. A session's findings carry absolute code point
offsets into the logical whole-session input, so they index `"".join(chunks)`
exactly as the synchronous API's findings index the same joined string.

`policy` and `formatter` callbacks receive only normalized safe metadata, never
the input or a matched value. A callback that raises, or that returns something
other than the documented protocol, never propagates its own error: it becomes
one of the fixed `SecretScanError` subclasses. There is no custom detector
callback surface.

The package is typed (PEP 561): the wheel ships `py.typed` and a `_native.pyi`
stub, so type checkers resolve the API without a stub package.

## Supported wheels

| Platform | Architectures | Wheel tag |
| --- | --- | --- |
| manylinux (glibc 2.17+) | `x86_64`, `aarch64` | `cp310-abi3-manylinux_2_17_*` |
| musllinux (musl 1.2+) | `x86_64`, `aarch64` | `cp310-abi3-musllinux_1_2_*` |
| macOS 11+ | `x86_64`, `arm64` | `cp310-abi3-macosx_*` |
| Windows | `x64`, `arm64` | `cp310-abi3-win_*` |

Every wheel in that matrix is built and smoke-tested on its own architecture
before a release candidate is accepted; see
[docs/python-packaging.md](https://github.com/omiologic/secret-scan/blob/main/docs/python-packaging.md).

## Building from source

The source distribution needs a Rust toolchain at or above the workspace MSRV
(**1.88**, Rust 2024 edition). With `cargo` on `PATH`, `pip install` builds it
like any other source install.

Without one, maturin's build backend downloads a toolchain into a local cache
and continues. To refuse that instead and fail immediately with
`Cargo metadata failed. Do you have cargo in your PATH?`, set:

```sh
MATURIN_NO_INSTALL_RUST=1 pip install --no-binary omiologic-secret-scan omiologic-secret-scan
```

Set it in any environment that must not fetch a toolchain over the network.

## Development

This directory is a mixed Rust/Python maturin project. The crate is
`secret-scan-python`, the native module is `secret_scan._native`, and the pure
Python package lives under `python/secret_scan/`.

- `src/lib.rs` owns CPython conversions, Unicode code point range conversion,
  and the synchronous `scan`/`redact`/`scan_and_redact` API: immutable finding
  and result types, sanitized exceptions, and the default policy and formatter
  helpers (`decision-define-runtime-bindings`).
- `src/incremental.rs` owns the bounded incremental session:
  `IncrementalSanitizer`, its mandatory `IncrementalLimits`, the lifecycle
  states, and the incremental policy callback. Its `CodePointIndex` converts
  the core's absolute UTF-8 byte offsets to the absolute code point offsets a
  session reports, by recording only where the input's UTF-8 continuation bytes
  fall - never the characters themselves - within a window bounded by the
  session's own `max_buffered_bytes`.
- `python/secret_scan/__init__.py` re-exports the native module's public
  surface; `python/secret_scan/_native.pyi` and `py.typed` mark the package as
  typed.
- `tests/` runs against a built extension and exercises the shared
  `conformance/` corpus, Unicode code point conversion, callback failure
  sanitization, placeholder safety, and determinism. The incremental suites add
  native-string partition invariance (`test_incremental_partitions.py`), astral
  character boundaries (`test_incremental_unicode.py`), and the canonical
  lifecycle, limit, callback, and failure-cleanup cases
  (`test_incremental.py`). They read the corpus from the repository, so they
  ship with neither the wheel nor the source distribution.
- The `extension-module` Cargo feature is enabled only by maturin, so the crate
  still links during `cargo test --workspace`.

```sh
cd bindings/python
python3 -m venv .venv && source .venv/bin/activate
pip install '.[test]' maturin pytest
maturin develop
pytest
```

Rebuild with `maturin develop` after any change under `src/`; `pytest` imports
the installed extension, not the Rust sources.

Packaging identity, the abi3 contract, and the wheel matrix are declared in
`[workspace.metadata.secret-scan]` in the root `Cargo.toml` and enforced by
`scripts/check-python-package.py`. Build and qualify artifacts with
`scripts/qualify-python-wheel.py`; see
[docs/python-packaging.md](https://github.com/omiologic/secret-scan/blob/main/docs/python-packaging.md).
