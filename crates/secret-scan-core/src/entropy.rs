//! Shannon entropy over Unicode scalar values.

/// Returns Shannon entropy in bits per Unicode scalar value (`char`).
///
/// Entropy is a supporting classification signal only; callers must not
/// treat it as proof that an otherwise unstructured value is a secret.
///
/// The summation visits symbols in first-occurrence order, which is the same
/// order the TypeScript oracle uses, so the result is bit-identical across
/// implementations for the same input.
#[must_use]
pub fn shannon_entropy(input: &str) -> f64 {
    if input.is_empty() {
        return 0.0;
    }

    // First-occurrence ordered histogram. Inputs handed to this function are
    // candidate-sized tokens, so a linear probe per symbol is acceptable and
    // keeps the summation order identical to the oracle's insertion-ordered
    // map without pulling in a hasher.
    let mut frequencies: Vec<(char, u32)> = Vec::new();
    let mut symbol_count: u32 = 0;
    for symbol in input.chars() {
        match frequencies.iter_mut().find(|(seen, _)| *seen == symbol) {
            Some((_, count)) => *count += 1,
            None => frequencies.push((symbol, 1)),
        }
        symbol_count += 1;
    }

    let total = f64::from(symbol_count);
    let mut entropy = 0.0;
    for &(_, frequency) in &frequencies {
        let probability = f64::from(frequency) / total;
        entropy -= probability * probability.log2();
    }
    entropy
}

#[cfg(test)]
// Exact equality is the property under test: the summation order is part of
// the cross-language contract, so results must be bit-identical.
#[allow(clippy::float_cmp)]
mod tests {
    use super::*;

    #[test]
    fn empty_and_uniform_inputs() {
        assert_eq!(shannon_entropy(""), 0.0);
        assert_eq!(shannon_entropy("aaaa"), 0.0);
        assert_eq!(shannon_entropy("ab"), 1.0);
        assert_eq!(shannon_entropy("abcd"), 2.0);
        assert_eq!(shannon_entropy("abcdefghijklmnop"), 4.0);
    }

    #[test]
    fn counts_scalar_values_not_bytes() {
        // Two distinct four-byte symbols, equally frequent.
        assert_eq!(shannon_entropy("😀😃"), 1.0);
        assert_eq!(shannon_entropy("😀😀"), 0.0);
        // Same value as an ASCII pair of the same shape.
        assert_eq!(shannon_entropy("😀😃😀😃"), shannon_entropy("abab"));
    }

    #[test]
    fn is_deterministic_and_order_insensitive_for_permutations_of_equal_counts() {
        let first = shannon_entropy("aabbcc");
        let second = shannon_entropy("ccbbaa");
        assert_eq!(first, second);
        assert_eq!(first, shannon_entropy("aabbcc"));
    }

    #[test]
    fn known_value() {
        // p = {1/2, 1/4, 1/4} -> 1.5 bits.
        assert_eq!(shannon_entropy("aabc"), 1.5);
    }
}
