//! The combined result [`scan_and_redact`](crate::scan_and_redact) returns.

use wasm_bindgen::prelude::wasm_bindgen;

use crate::finding::FindingJs;

/// The redacted text alongside every finding that produced it.
#[wasm_bindgen(js_name = "ScanAndRedactResult")]
#[derive(Clone, Debug)]
pub struct ScanAndRedactResultJs {
    text: String,
    findings: Vec<FindingJs>,
}

#[wasm_bindgen(js_class = "ScanAndRedactResult")]
impl ScanAndRedactResultJs {
    /// `input` with every `redact`/`block` finding replaced by its
    /// placeholder.
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn text(&self) -> String {
        self.text.clone()
    }

    /// Every finding `scan` produced for `input`, in the same order `scan`
    /// alone would have returned them.
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn findings(&self) -> Vec<FindingJs> {
        self.findings.clone()
    }
}

impl ScanAndRedactResultJs {
    /// Builds a result from `text` and `findings`.
    pub(crate) const fn new(text: String, findings: Vec<FindingJs>) -> Self {
        Self { text, findings }
    }
}
