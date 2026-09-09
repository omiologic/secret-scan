# bindings/python

PyO3 extension module built with maturin. Crate: `secret-scan-python`; native
module `secret_scan._native`.

- Owns CPython conversions and Unicode code point range conversion.
- Targets CPython 3.10+ abi3 wheels plus an sdist that needs a Rust toolchain.
- The `extension-module` Cargo feature is enabled only by maturin so the crate
  still links during `cargo test --workspace`.
- The Python package layout and PyPI distribution name are selected by the
  binding implementation issue. `secret-scan` on PyPI belongs to an unrelated
  project; see [docs/rust-workspace.md](../../docs/rust-workspace.md#registry-names).
