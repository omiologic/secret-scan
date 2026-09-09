//! GitLab token detection.
//!
//! Mirrors `src/detectors/gitlab.ts`.

use crate::detectors::pattern::{self, RunLength};
use crate::error::DetectorFailure;
use crate::types::{ByteRange, Candidate, Confidence, Detector, DetectorContext, Specificity};

const PREFIXES: [&str; 11] = [
    "glpat-", "gloas-", "gldt-", "glrt-", "glrtr-", "glcbt-", "glptt-", "glft-", "glimt-",
    "glagent-", "glwt-",
];

/// Requires one of GitLab's documented, non-configurable token prefixes and
/// a substantial opaque suffix. Personal-access-token prefixes can be
/// customized by an administrator and are therefore an intentional
/// false-negative source.
pub(super) struct GitlabTokenDetector;

impl Detector for GitlabTokenDetector {
    fn id(&self) -> &'static str {
        "gitlab-token"
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
                Candidate::new("gitlab_token", Confidence::High, range)
                    .with_specificity(Specificity::Provider)
                    .with_signals(["gitlab-documented-prefix", "opaque-suffix"]),
            );
        }
        Ok(candidates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detect(input: &str) -> Vec<Candidate> {
        GitlabTokenDetector
            .detect(input, &DetectorContext::new(input.len()))
            .unwrap()
    }

    #[test]
    fn detects_every_documented_prefix() {
        for prefix in PREFIXES {
            let input = format!("{prefix}SYNTHETIC_REVOKED_PREFIX_FIXTURE");
            let candidates = detect(&input);
            assert_eq!(candidates.len(), 1, "{prefix}");
            assert_eq!(
                candidates[0].range(),
                ByteRange::new(0, input.len()).unwrap(),
                "{prefix}"
            );
        }
    }

    #[test]
    fn distinguishes_glrt_from_its_longer_glrtr_sibling() {
        let input = "glrt-SYNTHETIC_REVOKED_PREFIX_FIXTURE";
        let candidates = detect(input);
        assert_eq!(candidates.len(), 1);
        assert_eq!(
            candidates[0].range(),
            ByteRange::new(0, input.len()).unwrap()
        );
    }

    #[test]
    fn rejects_a_short_suffix() {
        assert_eq!(detect("glpat-SYNTHETIC_SHORT").len(), 0);
    }

    #[test]
    fn rejects_an_undocumented_prefix() {
        assert_eq!(
            detect("glpersonal-SYNTHETIC_REVOKED_TOKEN_FIXTURE").len(),
            0
        );
    }
}
