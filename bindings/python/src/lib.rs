//! `CPython` binding for the `secret-scan` core built with `PyO3` and maturin
//! (`decision-define-runtime-bindings`).
//!
//! Ranges exposed here use Unicode code points; conversion from the core's
//! UTF-8 byte offsets happens in this crate without changing the selected span.

use pyo3::prelude::{Bound, PyModule, PyModuleMethods as _, PyResult, pyfunction, pymodule};
use pyo3::wrap_pyfunction;

/// Returns the shared product version.
#[pyfunction]
fn version() -> &'static str {
    secret_scan::VERSION
}

/// The native extension module.
#[pymodule]
fn _native(module: &Bound<'_, PyModule>) -> PyResult<()> {
    module.add_function(wrap_pyfunction!(version, module)?)
}
