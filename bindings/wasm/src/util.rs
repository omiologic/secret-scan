//! Small helpers shared across this crate's modules.

/// Narrows a `usize` to `u32`, saturating rather than panicking.
///
/// Every caller in this crate applies this to a scan position (a byte or
/// UTF-16 offset, a finding index or count) that never approaches
/// `u32::MAX` for any input this crate can actually receive; saturating
/// keeps the conversion infallible instead of relying on that assumption.
pub(crate) fn saturating_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn narrows_in_range_values_exactly() {
        assert_eq!(saturating_u32(0), 0);
        assert_eq!(saturating_u32(42), 42);
        assert_eq!(saturating_u32(u32::MAX as usize), u32::MAX);
    }

    #[test]
    fn saturates_values_above_u32_max() {
        // `usize` is 32 bits on `wasm32-unknown-unknown`, where it never
        // exceeds `u32::MAX`; `usize::MAX` is the one over-`u32::MAX` value
        // guaranteed to exist (and be reachable without overflowing) on
        // every target this crate builds for.
        assert_eq!(saturating_u32(usize::MAX), u32::MAX);
    }
}
