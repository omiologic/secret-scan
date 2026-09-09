//! Shared low-level scanning helpers for hand-written detector grammars.
//!
//! The core crate depends on nothing outside `std`
//! (`workspace.metadata.secret-scan.allowed-dependencies` is empty), so every
//! detector parses its grammar by hand instead of through a regex engine.
//! These helpers centralize the small pieces of ECMAScript character-class
//! semantics that more than one ported grammar depends on, operating on
//! UTF-8 byte offsets throughout ([`crate::RANGE_UNIT`]).

/// `true` for a character ECMAScript's `\s` class matches outside Unicode
/// mode: `WhiteSpace` or `LineTerminator`. Rust's `char::is_whitespace`
/// covers the same `White_Space` code points except the byte-order-mark,
/// which ECMAScript's `WhiteSpace` production also includes.
pub(super) fn is_js_whitespace(ch: char) -> bool {
    ch.is_whitespace() || ch == '\u{FEFF}'
}

/// `true` for a character ECMAScript treats as a `LineTerminator`.
pub(super) fn is_js_line_terminator(ch: char) -> bool {
    matches!(ch, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

/// The character starting at byte offset `pos`, or `None` past the end of
/// `input` or when `pos` is not on a character boundary.
pub(super) fn char_at(input: &str, pos: usize) -> Option<char> {
    input.get(pos..)?.chars().next()
}

/// The character immediately before byte offset `pos`, or `None` at the
/// start of `input` or when `pos` is not on a character boundary.
pub(super) fn prev_char(input: &str, pos: usize) -> Option<char> {
    input.get(..pos)?.chars().next_back()
}

/// `true` when `pos` is a multiline-mode `^` position: the start of `input`
/// or immediately after a [`is_js_line_terminator`] character.
pub(super) fn is_line_start(input: &str, pos: usize) -> bool {
    pos == 0 || prev_char(input, pos).is_some_and(is_js_line_terminator)
}

/// Advances `start` past every consecutive character matching `pred`.
pub(super) fn skip_while_chars(input: &str, start: usize, pred: fn(char) -> bool) -> usize {
    let mut cursor = start;
    while let Some(ch) = char_at(input, cursor) {
        if pred(ch) {
            cursor += ch.len_utf8();
        } else {
            break;
        }
    }
    cursor
}

/// Length in bytes of the maximal run of `pred`-matching bytes starting at
/// `start`. Every predicate used with this helper matches ASCII bytes only,
/// so byte and character boundaries coincide.
pub(super) fn ascii_run_len(bytes: &[u8], start: usize, pred: fn(u8) -> bool) -> usize {
    let mut end = start;
    while end < bytes.len() && pred(bytes[end]) {
        end += 1;
    }
    end - start
}

/// Case-insensitive ASCII literal match at byte offset `pos`. Byte
/// comparison never requires `pos` to be on a character boundary.
pub(super) fn starts_with_ci(input: &str, pos: usize, literal: &str) -> bool {
    let literal = literal.as_bytes();
    input
        .as_bytes()
        .get(pos..pos + literal.len())
        .is_some_and(|window| window.eq_ignore_ascii_case(literal))
}

/// Case-insensitive ASCII literal suffix match.
pub(super) fn ends_with_ci(value: &str, suffix: &str) -> bool {
    let bytes = value.as_bytes();
    let suffix = suffix.as_bytes();
    bytes.len() >= suffix.len() && bytes[bytes.len() - suffix.len()..].eq_ignore_ascii_case(suffix)
}
