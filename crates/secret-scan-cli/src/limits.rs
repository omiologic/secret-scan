//! The explicit limits every run applies.
//!
//! Neither mode ever hands the core an unbounded input or an unbounded
//! retention window: standard input is streamed under an
//! [`IncrementalLimits`] set derived from these constants, and a file is read
//! whole under the same total-input bound.

use secret_scan::{IncrementalLimits, SecretScanError};

/// The largest logical input a single source may supply, streamed or whole.
pub const MAX_INPUT_BYTES: usize = 64 * 1024 * 1024;
/// The largest open single-line construct a streamed run holds unresolved.
pub const MAX_TOKEN_BYTES: usize = 8 * 1024;
/// The largest open PEM-style block a streamed run holds unresolved.
pub const MAX_MULTILINE_BYTES: usize = 64 * 1024;
/// The retained-plaintext bound, derived from the construct limits so the
/// CLI does not reproduce the core's lookaround arithmetic.
pub const MAX_BUFFERED_BYTES: usize =
    IncrementalLimits::minimum_buffered_bytes(MAX_TOKEN_BYTES, MAX_MULTILINE_BYTES);
/// How much the streaming reader asks for per read. A short read is normal
/// and the caller loops; this only bounds one request.
pub const READ_CHUNK_BYTES: usize = 64 * 1024;

/// The limit set every streamed run uses.
///
/// # Errors
///
/// Returns [`secret_scan::SecretScanErrorCode::InvalidLimits`] only if the
/// constants above stop satisfying the core's documented relationship, which
/// a unit test in this module pins.
pub fn incremental_limits() -> Result<IncrementalLimits, SecretScanError> {
    IncrementalLimits::new(
        MAX_INPUT_BYTES,
        MAX_BUFFERED_BYTES,
        MAX_TOKEN_BYTES,
        MAX_MULTILINE_BYTES,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_declared_limits_satisfy_the_core() {
        let limits = incremental_limits().unwrap();
        assert_eq!(limits.max_input_bytes(), MAX_INPUT_BYTES);
        assert_eq!(limits.max_buffered_bytes(), MAX_BUFFERED_BYTES);
        assert_eq!(limits.max_token_bytes(), MAX_TOKEN_BYTES);
        assert_eq!(limits.max_multiline_bytes(), MAX_MULTILINE_BYTES);
    }

    #[test]
    fn the_buffered_limit_is_derived_not_guessed() {
        assert_eq!(
            MAX_BUFFERED_BYTES,
            IncrementalLimits::minimum_buffered_bytes(MAX_TOKEN_BYTES, MAX_MULTILINE_BYTES)
        );
        const { assert!(MAX_BUFFERED_BYTES > MAX_MULTILINE_BYTES) };
    }
}
