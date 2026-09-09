# bindings/python

PyO3 extension module built with maturin as a mixed Rust/Python project.
Crate: `secret-scan-python`; native module `secret_scan._native`; pure
Python package under `python/secret_scan/`.

- `src/lib.rs` owns CPython conversions, Unicode code point range
  conversion, and the synchronous `scan`/`redact`/`scan_and_redact` API:
  immutable finding and result types, sanitized exceptions, and the default
  policy and formatter helpers. Every built-in detector runs; there is no
  custom detector callback surface (`decision-define-runtime-bindings`).
- `python/secret_scan/__init__.py` re-exports the native module's public
  surface; `python/secret_scan/_native.pyi` and `py.typed` mark the package
  as typed (PEP 561).
- `tests/` runs against a built extension (`maturin develop`) and exercises
  the shared `conformance/` corpus, Unicode code point conversion, callback
  failure sanitization, placeholder safety, and determinism.
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
pip install '.[test]'
maturin develop
pytest
```
