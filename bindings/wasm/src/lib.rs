//! Browser WebAssembly binding for the `secret-scan` core
//! (`decision-define-runtime-bindings`).
//!
//! Ranges exposed here use UTF-16 code units; conversion from the core's UTF-8
//! byte offsets happens in this crate without changing the selected span.

use wasm_bindgen::prelude::wasm_bindgen;

/// Returns the shared product version.
#[wasm_bindgen]
#[must_use]
pub fn version() -> String {
    secret_scan::VERSION.to_owned()
}
