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

    /// One `conformance/fixtures/unicode-conversion-corpus.json` fixture: an
    /// input and the single canonical UTF-8 byte span it declares.
    struct RangeFixture {
        id: String,
        input: String,
        start: usize,
        end: usize,
    }

    /// Reads `conformance/fixtures/unicode-conversion-corpus.json` directly
    /// rather than copying its values into Rust, which
    /// `decision-govern-cross-language-conformance` rejects: "Copying
    /// fixtures into each binding was rejected because copies can diverge."
    fn unicode_conversion_fixtures() -> Vec<RangeFixture> {
        const CORPUS: &str =
            include_str!("../../../conformance/fixtures/unicode-conversion-corpus.json");
        let document: serde_json::Value = serde_json::from_str(CORPUS).unwrap();
        assert_eq!(document["offsetUnit"], "utf8-byte");
        let fixtures = document["fixtures"].as_array().unwrap();
        assert!(!fixtures.is_empty());
        fixtures
            .iter()
            .map(|fixture| {
                let id = fixture["id"].as_str().unwrap().to_owned();
                let expected = fixture["expected"].as_array().unwrap();
                assert_eq!(expected.len(), 1, "{id}: expected exactly one expectation");
                RangeFixture {
                    input: fixture["input"].as_str().unwrap().to_owned(),
                    start: usize::try_from(expected[0]["start"].as_u64().unwrap()).unwrap(),
                    end: usize::try_from(expected[0]["end"].as_u64().unwrap()).unwrap(),
                    id,
                }
            })
            .collect()
    }

    /// An astral (supplementary-plane) character positioned before, within,
    /// and after a finding's UTF-8 byte span, asserting the same canonical
    /// `start`/`end` byte offsets convert to the UTF-16 code-unit offsets
    /// every browser consumer of this binding actually sees, checked against
    /// summing `char::len_utf16` -- an independent reference conversion (the
    /// algorithm `bindings/node/src/offsets.rs` implements), not
    /// `to_utf16_range` under test.
    #[test]
    fn unicode_conversion_corpus_converts_to_utf16_offsets() {
        for fixture in unicode_conversion_fixtures() {
            let range = ByteRange::new(fixture.start, fixture.end).unwrap();
            let reference = |byte_offset: usize| -> u32 {
                let count = fixture.input[..byte_offset]
                    .chars()
                    .map(char::len_utf16)
                    .sum::<usize>();
                u32::try_from(count).unwrap()
            };
            assert_eq!(
                to_utf16_range(&fixture.input, range),
                (reference(fixture.start), reference(fixture.end)),
                "{}",
                fixture.id,
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
