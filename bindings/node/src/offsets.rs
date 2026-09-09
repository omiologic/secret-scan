//! UTF-8 byte offset <-> UTF-16 code-unit offset conversion
//! (`decision-define-runtime-bindings`).
//!
//! JavaScript strings index by UTF-16 code units; the core reports ranges as
//! UTF-8 byte offsets ([`secret_scan::RANGE_UNIT`]). These functions convert
//! between the two without changing the selected span
//! (`decision-govern-cross-language-conformance`).

use secret_scan::{SecretScanError, SecretScanErrorCode};

/// Converts a UTF-8 byte offset into `text` to the UTF-16 code-unit offset at
/// the same logical position.
///
/// `byte_offset` is assumed to already be a valid, character-aligned offset
/// into `text` — every caller in this crate converts offsets the core
/// pipeline has already validated.
#[must_use]
pub fn byte_to_utf16(text: &str, byte_offset: usize) -> u32 {
    let units: usize = text[..byte_offset].chars().map(char::len_utf16).sum();
    u32::try_from(units).unwrap_or(u32::MAX)
}

/// Converts a UTF-16 code-unit offset supplied by a JavaScript caller back to
/// a UTF-8 byte offset into `text`.
///
/// # Errors
///
/// Returns [`SecretScanErrorCode::InvalidFindings`] when `utf16_offset` is
/// out of bounds or falls inside a surrogate pair rather than on a code
/// point boundary.
pub fn utf16_to_byte(text: &str, utf16_offset: usize) -> Result<usize, SecretScanError> {
    let mut units = 0usize;
    for (byte_offset, ch) in text.char_indices() {
        if units == utf16_offset {
            return Ok(byte_offset);
        }
        if units > utf16_offset {
            break;
        }
        units += ch.len_utf16();
    }
    if units == utf16_offset {
        return Ok(text.len());
    }
    Err(SecretScanErrorCode::InvalidFindings.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Mirrors `conformance/fixtures/unicode-conversion-corpus.json`
    /// (`decision-govern-cross-language-conformance`): an astral
    /// (supplementary-plane) character positioned before, within, and after
    /// a finding's UTF-8 byte span, asserting the same canonical `start`/
    /// `end` byte offsets convert to the UTF-16 code-unit offsets every
    /// JavaScript consumer of this binding actually sees.
    #[test]
    fn unicode_conversion_corpus_converts_to_utf16_offsets() {
        let cases = [
            // (input, canonical UTF-8 byte start/end, expected UTF-16 start/end)
            ("\u{1F511} TOKEN_SYNTHETIC_REVOKED_VALUE", 5, 34, 3, 32),
            ("TOKEN_\u{1F511}_SYNTHETIC_REVOKED", 0, 28, 0, 26),
            ("TOKEN_SYNTHETIC_REVOKED_VALUE \u{1F511}", 0, 29, 0, 29),
        ];
        for (input, byte_start, byte_end, utf16_start, utf16_end) in cases {
            assert_eq!(byte_to_utf16(input, byte_start), utf16_start, "{input:?}");
            assert_eq!(byte_to_utf16(input, byte_end), utf16_end, "{input:?}");
        }
    }

    #[test]
    fn round_trips_through_both_conversions() {
        let input = "TOKEN_\u{1F511}_SYNTHETIC_REVOKED";
        for byte_offset in [0, 6, 10, 28] {
            let utf16 = byte_to_utf16(input, byte_offset);
            assert_eq!(
                utf16_to_byte(input, utf16 as usize).unwrap(),
                byte_offset,
                "byte_offset={byte_offset}"
            );
        }
    }

    #[test]
    fn rejects_a_utf16_offset_that_splits_a_surrogate_pair() {
        let input = "\u{1F511}key";
        // The astral character occupies UTF-16 code units 0 and 1 (a
        // surrogate pair); offset 1 lands inside it.
        assert!(utf16_to_byte(input, 1).is_err());
        assert_eq!(utf16_to_byte(input, 2).unwrap(), 4);
    }

    #[test]
    fn rejects_an_out_of_bounds_utf16_offset() {
        assert!(utf16_to_byte("abc", 4).is_err());
    }
}
