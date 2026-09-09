//! AWS access-key detection.
//!
//! Mirrors `src/detectors/aws.ts`.

use crate::detectors::pattern::{self, RunLength};
use crate::error::DetectorFailure;
use crate::types::{ByteRange, Candidate, Confidence, Detector, DetectorContext, Specificity};

const PREFIXES: [&str; 2] = ["AKIA", "ASIA"];

/// Restricts matches to the two documented AWS access-key prefixes and their
/// fixed length. This intentionally excludes other AWS identifiers such as
/// role and user IDs; unknown or future prefixes are false negatives until
/// explicitly added.
pub(super) struct AwsAccessKeyDetector;

impl Detector for AwsAccessKeyDetector {
    fn id(&self) -> &'static str {
        "aws-access-key"
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
            RunLength::Exact(16),
            pattern::is_upper_alnum,
            pattern::is_alnum,
        ) {
            let Some(range) = ByteRange::new(start, end) else {
                continue;
            };
            candidates.push(
                Candidate::new("aws_access_key_id", Confidence::High, range)
                    .with_specificity(Specificity::Provider)
                    .with_signals(["aws-prefix", "fixed-length"]),
            );
        }
        Ok(candidates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detect(input: &str) -> Vec<Candidate> {
        AwsAccessKeyDetector
            .detect(input, &DetectorContext::new(input.len()))
            .unwrap()
    }

    #[test]
    fn detects_the_synthetic_fixture() {
        let input = format!("AKIA{}", "SYNTHETICEXAMPLE");
        let candidates = detect(&input);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].type_name(), "aws_access_key_id");
        assert_eq!(candidates[0].confidence(), Confidence::High);
        assert_eq!(candidates[0].effective_specificity(), Specificity::Provider);
        assert_eq!(
            candidates[0].range(),
            ByteRange::new(0, input.len()).unwrap()
        );
    }

    #[test]
    fn detects_the_asia_prefix() {
        let input = format!("ASIA{}", "SYNTHETICEXAMPLE");
        assert_eq!(detect(&input).len(), 1);
    }

    #[test]
    fn rejects_a_short_lookalike() {
        assert_eq!(detect("AKIASYNTHETICSHORT").len(), 0);
    }

    #[test]
    fn rejects_a_longer_alphanumeric_run() {
        assert_eq!(detect("AKIASYNTHETICEXAMPLEEXTRA").len(), 0);
    }

    #[test]
    fn accepts_punctuation_boundaries() {
        let value = format!("AKIA{}", "SYNTHETICEXAMPLE");
        let input = format!("({value}).");
        let candidates = detect(&input);
        assert_eq!(candidates.len(), 1);
        assert_eq!(
            candidates[0].range(),
            ByteRange::new(1, value.len() + 1).unwrap()
        );
    }

    #[test]
    fn rejects_an_embedded_lookalike() {
        let value = format!("AKIA{}", "SYNTHETICEXAMPLE");
        assert_eq!(detect(&format!("X{value}Y")).len(), 0);
    }
}
