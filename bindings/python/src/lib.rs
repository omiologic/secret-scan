//! `CPython` binding for the `secret-scan` core built with `PyO3` and maturin
//! (`decision-define-runtime-bindings`).
//!
//! Ranges exposed here use Unicode code points; conversion from the core's
//! UTF-8 byte offsets happens in this crate without changing the selected span.

use pyo3::exceptions::PyValueError;
use pyo3::prelude::{Bound, PyModule, PyModuleMethods as _, PyResult, pyfunction, pymodule};
use pyo3::wrap_pyfunction;

/// Returns the shared product version.
#[pyfunction]
fn version() -> &'static str {
    secret_scan::VERSION
}

/// Converts a UTF-8 byte offset into `text` (the core's native range unit,
/// [`secret_scan::RANGE_UNIT`]) to the Unicode code point offset Python's
/// `str` indexing sees at the same logical position
/// (`decision-govern-cross-language-conformance`). Every code point counts
/// as one unit regardless of plane, so an astral (supplementary-plane)
/// character advances this offset by exactly 1, unlike JavaScript's UTF-16
/// code units (2 for the same character) or the core's own UTF-8 bytes (4).
///
/// # Errors
///
/// Returns a `ValueError` when `byte_offset` is out of bounds or falls
/// inside a multi-byte character's encoding rather than on its boundary.
#[pyfunction]
fn byte_offset_to_char_offset(text: &str, byte_offset: usize) -> PyResult<usize> {
    if byte_offset > text.len() || !text.is_char_boundary(byte_offset) {
        return Err(PyValueError::new_err(
            "byte_offset is out of bounds or splits a character.",
        ));
    }
    Ok(text[..byte_offset].chars().count())
}

/// The native extension module.
#[pymodule]
fn _native(module: &Bound<'_, PyModule>) -> PyResult<()> {
    module.add_function(wrap_pyfunction!(version, module)?)?;
    module.add_function(wrap_pyfunction!(byte_offset_to_char_offset, module)?)
}

#[cfg(test)]
mod tests {
    use super::byte_offset_to_char_offset;

    /// Mirrors `conformance/fixtures/unicode-conversion-corpus.json`
    /// (`decision-govern-cross-language-conformance`): an astral
    /// (supplementary-plane) character positioned before, within, and after
    /// a finding's UTF-8 byte span, asserting the same canonical `start`/
    /// `end` byte offsets convert to the Python-native code point offsets
    /// every Python consumer of this binding actually sees.
    #[test]
    fn unicode_conversion_corpus_converts_to_code_point_offsets() {
        let cases = [
            // (input, canonical UTF-8 byte start/end, expected code point start/end)
            ("\u{1F511} TOKEN_SYNTHETIC_REVOKED_VALUE", 5, 34, 2, 31),
            ("TOKEN_\u{1F511}_SYNTHETIC_REVOKED", 0, 28, 0, 25),
            ("TOKEN_SYNTHETIC_REVOKED_VALUE \u{1F511}", 0, 29, 0, 29),
        ];
        for (input, byte_start, byte_end, char_start, char_end) in cases {
            assert_eq!(
                byte_offset_to_char_offset(input, byte_start).unwrap(),
                char_start,
                "{input:?}"
            );
            assert_eq!(
                byte_offset_to_char_offset(input, byte_end).unwrap(),
                char_end,
                "{input:?}"
            );
        }
    }

    #[test]
    fn rejects_offsets_that_split_the_astral_characters_four_byte_encoding() {
        let input = "\u{1F511}key";
        for byte_offset in [1, 2, 3] {
            assert!(byte_offset_to_char_offset(input, byte_offset).is_err());
        }
        assert_eq!(byte_offset_to_char_offset(input, 4).unwrap(), 1);
    }

    #[test]
    fn rejects_an_out_of_bounds_offset() {
        assert!(byte_offset_to_char_offset("abc", 4).is_err());
    }
}
