//! Asserts the canonical Unicode range-conversion corpus
//! (`decision-govern-cross-language-conformance`) against the Rust core's own
//! `ByteRange`, reading `conformance/fixtures/unicode-conversion-corpus.json`
//! directly rather than a hand-copied mirror of its values -- the same
//! canonical-corpus pattern `canonical_corpus.rs` uses for the synchronous
//! corpus, and the one `decision-govern-cross-language-conformance` requires:
//! "Copying fixtures into each binding was rejected because copies can
//! diverge."
//!
//! Every fixture value is synthetic; nothing here reproduces a matched value
//! outside the fixture input it came from.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod support;

use secret_scan::ByteRange;

#[test]
fn every_fixture_range_is_char_aligned_and_selects_its_declared_span() {
    let fixtures = support::unicode_conversion_corpus();
    assert!(!fixtures.is_empty());
    for fixture in fixtures {
        let range = ByteRange::new(fixture.start, fixture.end).unwrap_or_else(|| {
            panic!(
                "{}: start={} end={} is not a valid byte range",
                fixture.id, fixture.start, fixture.end
            )
        });
        assert!(
            range.is_char_aligned_in(&fixture.input),
            "{}: range is not char-aligned in the fixture input",
            fixture.id,
        );
        // Every fixture in this corpus exists to prove a multibyte character
        // adjacent to or inside the declared span does not perturb it.
        let selected = &fixture.input[fixture.start..fixture.end];
        assert!(
            !selected.is_empty(),
            "{}: the declared span selects nothing",
            fixture.id,
        );
    }
}
