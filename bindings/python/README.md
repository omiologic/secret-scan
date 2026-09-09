# bindings/python

PyO3 extension module built with maturin as a mixed Rust/Python project.
Crate: `secret-scan-python`; native module `secret_scan._native`; pure
Python package under `python/secret_scan/`.

- `src/lib.rs` owns CPython conversions, Unicode code point range
  conversion, and the synchronous `scan`/`redact`/`scan_and_redact` API:
  immutable finding and result types, sanitized exceptions, and the default
  policy and formatter helpers. Every built-in detector runs; there is no
  custom detector callback surface (`decision-define-runtime-bindings`).
- `src/incremental.rs` owns the bounded incremental session:
  `IncrementalSanitizer`, its mandatory `IncrementalLimits`, the lifecycle
  states, and the incremental policy callback. Its `CodePointIndex` converts
  the core's absolute UTF-8 byte offsets to the absolute code point offsets a
  session reports, by recording only where the input's UTF-8 continuation
  bytes fall - never the characters themselves - within a window bounded by
  the session's own `max_buffered_bytes`.
- `python/secret_scan/__init__.py` re-exports the native module's public
  surface; `python/secret_scan/_native.pyi` and `py.typed` mark the package
  as typed (PEP 561).
- `tests/` runs against a built extension (`maturin develop`) and exercises
  the shared `conformance/` corpus, Unicode code point conversion, callback
  failure sanitization, placeholder safety, and determinism. The incremental
  suites add native-string partition invariance
  (`test_incremental_partitions.py`), astral-character boundaries
  (`test_incremental_unicode.py`), and the canonical lifecycle, limit,
  callback, and failure-cleanup cases (`test_incremental.py`).
- Targets CPython 3.10+ abi3 wheels plus an sdist that needs a Rust toolchain.
- The `extension-module` Cargo feature is enabled only by maturin so the crate
  still links during `cargo test --workspace`.
- The PyPI distribution name is provisional. `secret-scan` on PyPI belongs to
  an unrelated project; see
  [docs/rust-workspace.md](../../docs/rust-workspace.md#registry-names).

## Running the Python test suite

```sh
cd bindings/python
python3 -m venv .venv && source .venv/bin/activate
pip install '.[test]' maturin pytest
maturin develop
pytest
```

Rebuild with `maturin develop` after any change under `src/`; `pytest` imports
the installed extension, not the Rust sources.
