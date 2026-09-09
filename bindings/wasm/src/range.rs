//! UTF-8 byte offset to JavaScript UTF-16 code-unit offset conversion
//! (`decision-govern-cross-language-conformance`).
//!
//! The core reports every range as a UTF-8 byte [`ByteRange`]
//! (`secret_scan::RANGE_UNIT`). JavaScript strings index by UTF-16 code unit,
//! so every range this binding hands to JavaScript is converted here without
//! changing the selected span: a Basic Multilingual Plane character advances
//! the JavaScript offset by one code unit, and an astral (supplementary-plane)
//! character advances it by two, unlike the core's four UTF-8 bytes or
//! Python's one code point.

use secret_scan::ByteRange;

use crate::util::saturating_u32;

/// Converts a UTF-8 byte offset within `input` to the UTF-16 code-unit offset
/// JavaScript string indexing sees at the same logical position.
///
/// Returns `None` when `byte_offset` is out of bounds or splits a
/// multi-byte character's encoding rather than landing on its boundary.
fn byte_offset_to_utf16_offset(input: &str, byte_offset: usize) -> Option<usize> {
    if byte_offset > input.len() || !input.is_char_boundary(byte_offset) {
        return None;
    }
    Some(input[..byte_offset].encode_utf16().count())
}

/// Converts `range`'s UTF-8 byte bounds, taken from a [`Finding`] or
/// [`DetectedFinding`] the core produced for `input`, to UTF-16 code-unit
/// bounds.
///
/// `range` is character-aligned within `input` by construction: the core
/// pipeline never returns a finding whose range fails
/// [`ByteRange::is_char_aligned_in`]. If that invariant were ever violated,
/// this falls back to `input`'s full UTF-16 length for the affected bound
/// rather than panicking.
///
/// [`Finding`]: secret_scan::Finding
/// [`DetectedFinding`]: secret_scan::DetectedFinding
pub(crate) fn to_utf16_range(input: &str, range: ByteRange) -> (u32, u32) {
    let full_length = || input.encode_utf16().count();
    let start = byte_offset_to_utf16_offset(input, range.start()).unwrap_or_else(full_length);
    let end = byte_offset_to_utf16_offset(input, range.end()).unwrap_or_else(full_length);
    (saturating_u32(start), saturating_u32(end))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Mirrors `conformance/fixtures/unicode-conversion-corpus.json`
    /// (`decision-govern-cross-language-conformance`): an astral
    /// (supplementary-plane) character positioned before, within, and after
    /// a finding's UTF-8 byte span, asserting the same canonical `start`/`end`
    /// byte offsets convert to the UTF-16 code-unit offsets every browser
    /// consumer of this binding actually sees.
    #[test]
    fn unicode_conversion_corpus_converts_to_utf16_offsets() {
        let cases = [
            // (input, canonical UTF-8 byte start/end, expected UTF-16 start/end)
            ("\u{1F511} TOKEN_SYNTHETIC_REVOKED_VALUE", 5, 34, 3, 32),
            ("TOKEN_\u{1F511}_SYNTHETIC_REVOKED", 0, 28, 0, 26),
            ("TOKEN_SYNTHETIC_REVOKED_VALUE \u{1F511}", 0, 29, 0, 29),
        ];
        for (input, byte_start, byte_end, utf16_start, utf16_end) in cases {
            let range = ByteRange::new(byte_start, byte_end).unwrap();
            assert_eq!(
                to_utf16_range(input, range),
                (utf16_start, utf16_end),
                "{input:?}"
            );
        }
    }

    #[test]
    fn rejects_offsets_that_split_the_astral_characters_four_byte_encoding() {
        let input = "\u{1F511}key";
        for byte_offset in [1, 2, 3] {
            assert_eq!(byte_offset_to_utf16_offset(input, byte_offset), None);
        }
        assert_eq!(byte_offset_to_utf16_offset(input, 4), Some(2));
    }

    #[test]
    fn rejects_an_out_of_bounds_offset() {
        assert_eq!(byte_offset_to_utf16_offset("abc", 4), None);
    }

    #[test]
    fn ascii_offsets_are_unchanged() {
        assert_eq!(byte_offset_to_utf16_offset("abcdef", 0), Some(0));
        assert_eq!(byte_offset_to_utf16_offset("abcdef", 6), Some(6));
    }
}
