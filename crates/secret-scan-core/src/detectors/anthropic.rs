//! Anthropic token detection.
//!
//! Mirrors `src/detectors/anthropic.ts`.

use crate::detectors::pattern::{self, RunLength};
use crate::error::DetectorFailure;
use crate::types::{ByteRange, Candidate, Confidence, Detector, DetectorContext, Specificity};

const PREFIXES: [&str; 1] = ["sk-ant-api03-"];

/// Requires the versioned Anthropic API-key prefix and a substantial
/// suffix. This prioritizes precision; older, shortened, or newly versioned
/// formats are intentionally false negatives until their exact shape is
/// supported.
pub(super) struct AnthropicTokenDetector;

impl Detector for AnthropicTokenDetector {
    fn id(&self) -> &'static str {
        "anthropic-token"
    }

    fn detect(
        &self,
        input: &str,
        _context: &DetectorContext,
    ) -> Result<Vec<Candidate>, DetectorFailure> {
        let mut candidates = Vec::new();
        for (start, end) in pattern::scan_prefixed_runs(
            input,
            &PREFIXES,
            RunLength::AtLeast(20),
            pattern::is_alnum_dash,
            pattern::is_alnum_dash,
        ) {
            let Some(range) = ByteRange::new(start, end) else {
                continue;
            };
            candidates.push(
                Candidate::new("anthropic_api_key", Confidence::High, range)
                    .with_specificity(Specificity::Provider)
                    .with_signals(["anthropic-versioned-prefix", "opaque-suffix"]),
            );
        }
        Ok(candidates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detect(input: &str) -> Vec<Candidate> {
        AnthropicTokenDetector
            .detect(input, &DetectorContext::new(input.len()))
            .unwrap()
    }

    #[test]
    fn detects_the_synthetic_fixture() {
        let input = "sk-ant-api03-SYNTHETIC_REVOKED_ANTHROPIC_KEY";
        let candidates = detect(input);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].type_name(), "anthropic_api_key");
        assert_eq!(
            candidates[0].range(),
            ByteRange::new(0, input.len()).unwrap()
        );
    }

    #[test]
    fn rejects_an_unsupported_version_prefix() {
        assert_eq!(
            detect("sk-ant-api02-SYNTHETIC_REVOKED_ANTHROPIC_KEY").len(),
            0
        );
    }

    #[test]
    fn rejects_a_short_suffix() {
        assert_eq!(detect("sk-ant-api03-short").len(), 0);
    }
}
