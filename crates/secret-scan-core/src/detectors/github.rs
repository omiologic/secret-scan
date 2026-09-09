//! GitHub token detection: classic, installation, and fine-grained tokens.
//!
//! Mirrors `src/detectors/github.ts`.

use crate::detectors::pattern::{self, RunLength};
use crate::error::DetectorFailure;
use crate::types::{ByteRange, Candidate, Confidence, Detector, DetectorContext, Specificity};

const CLASSIC_PREFIXES: [&str; 4] = ["gho_", "ghp_", "ghu_", "ghr_"];
const INSTALLATION_PREFIXES: [&str; 1] = ["ghs_"];
const FINE_GRAINED_PREFIX: &str = "github_pat_";
const FINE_GRAINED_FIRST_LEN: usize = 22;
const FINE_GRAINED_SECOND_LEN: usize = 59;

/// Uses GitHub's documented prefixes and conservative token boundaries.
/// Installation tokens follow GitHub's rollout-safe expression so both the
/// stateful opaque and stateless JWT-shaped forms are selected in full.
pub(super) struct GitHubTokenDetector;

impl Detector for GitHubTokenDetector {
    fn id(&self) -> &'static str {
        "github-token"
    }

    fn detect(
        &self,
        input: &str,
        _context: &DetectorContext,
    ) -> Result<Vec<Candidate>, DetectorFailure> {
        // Emission order matches the TypeScript oracle: classic, then
        // installation, then fine-grained, each in its own left-to-right
        // pass. This order is a public contract for overlap tie breaking,
        // not just cosmetic.
        let mut candidates = Vec::new();
        push(
            &mut candidates,
            pattern::scan_prefixed_runs(
                input,
                &CLASSIC_PREFIXES,
                RunLength::Exact(36),
                pattern::is_alnum,
                pattern::is_alnum_underscore,
            ),
        );
        push(
            &mut candidates,
            pattern::scan_prefixed_runs(
                input,
                &INSTALLATION_PREFIXES,
                RunLength::AtLeast(36),
                pattern::is_alnum_dash_dot,
                pattern::is_alnum_dash_dot,
            ),
        );
        push(&mut candidates, scan_fine_grained(input));
        Ok(candidates)
    }
}

fn push(candidates: &mut Vec<Candidate>, ranges: Vec<(usize, usize)>) {
    for (start, end) in ranges {
        let Some(range) = ByteRange::new(start, end) else {
            continue;
        };
        candidates.push(
            Candidate::new("github_token", Confidence::High, range)
                .with_specificity(Specificity::Provider),
        );
    }
}

/// `github_pat_` followed by an exact 22-byte alphanumeric run, a literal
/// `_`, and an exact 59-byte alphanumeric run. Both runs are fixed-length,
/// so unlike [`RunLength::AtLeast`] there is no single alphabet run to hand
/// to [`pattern::scan_prefixed_runs`]; the literal `_` separator between
/// them is outside the alphanumeric alphabet, so it cannot be absorbed into
/// either run.
fn scan_fine_grained(input: &str) -> Vec<(usize, usize)> {
    let bytes = input.as_bytes();
    let mut matches = Vec::new();
    let mut start = 0;
    while start < bytes.len() {
        if !bytes[start..].starts_with(FINE_GRAINED_PREFIX.as_bytes()) {
            start += 1;
            continue;
        }
        let Some(end) = fine_grained_end(bytes, start + FINE_GRAINED_PREFIX.len()) else {
            start += 1;
            continue;
        };
        if pattern::boundary_ok(bytes, start, end, pattern::is_alnum_underscore) {
            matches.push((start, end));
        }
        start = end;
    }
    matches
}

fn fine_grained_end(bytes: &[u8], first_start: usize) -> Option<usize> {
    let separator = first_start + FINE_GRAINED_FIRST_LEN;
    if !exact_run(bytes, first_start, FINE_GRAINED_FIRST_LEN) || bytes.get(separator) != Some(&b'_')
    {
        return None;
    }
    let second_start = separator + 1;
    if !exact_run(bytes, second_start, FINE_GRAINED_SECOND_LEN) {
        return None;
    }
    Some(second_start + FINE_GRAINED_SECOND_LEN)
}

/// `true` when the `len` bytes starting at `start` are all present and all
/// alphanumeric.
fn exact_run(bytes: &[u8], start: usize, len: usize) -> bool {
    bytes
        .get(start..start.saturating_add(len))
        .is_some_and(|run| run.iter().all(|&byte| pattern::is_alnum(byte)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detect(input: &str) -> Vec<Candidate> {
        GitHubTokenDetector
            .detect(input, &DetectorContext::new(input.len()))
            .unwrap()
    }

    #[test]
    fn detects_a_classic_token() {
        let input = format!("ghp_{}", "S".repeat(36));
        let candidates = detect(&input);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].type_name(), "github_token");
        assert_eq!(
            candidates[0].range(),
            ByteRange::new(0, input.len()).unwrap()
        );
    }

    #[test]
    fn detects_a_fine_grained_token() {
        let first = "S".repeat(FINE_GRAINED_FIRST_LEN);
        let second = "T".repeat(FINE_GRAINED_SECOND_LEN);
        let input = format!("github_pat_{first}_{second}");
        let candidates = detect(&input);
        assert_eq!(candidates.len(), 1);
        assert_eq!(
            candidates[0].range(),
            ByteRange::new(0, input.len()).unwrap()
        );
    }

    #[test]
    fn detects_a_stateful_installation_token() {
        let input = format!("ghs_{}", "S".repeat(36));
        assert_eq!(detect(&input).len(), 1);
    }

    #[test]
    fn selects_the_complete_stateless_installation_token() {
        let token =
            "ghs_SYNTHETIC_APP_ID.eyJTWU5USEVUSUNfUkVWT0tFRF9IRUFERVI.SYNTHETIC_REVOKED_SIGNATURE";
        let input = format!("before {token} after");
        let candidates = detect(&input);
        assert_eq!(candidates.len(), 1);
        let start = input.find(token).unwrap();
        assert_eq!(
            candidates[0].range(),
            ByteRange::new(start, start + token.len()).unwrap()
        );
    }

    #[test]
    fn rejects_short_lookalikes() {
        assert_eq!(detect("ghp_SYNTHETICSHORT").len(), 0);
        assert_eq!(detect("ghs_SYNTHETICSHORT").len(), 0);
        let short_fine_grained = format!(
            "github_pat_{}_{}",
            "S".repeat(FINE_GRAINED_FIRST_LEN),
            "T".repeat(FINE_GRAINED_SECOND_LEN - 1)
        );
        assert_eq!(detect(&short_fine_grained).len(), 0);
    }

    #[test]
    fn rejects_a_fine_grained_token_with_the_wrong_separator() {
        let first = "S".repeat(FINE_GRAINED_FIRST_LEN);
        let second = "T".repeat(FINE_GRAINED_SECOND_LEN);
        let input = format!("github_pat_{first}-{second}");
        assert_eq!(detect(&input).len(), 0);
    }

    #[test]
    fn finds_deterministic_findings_across_repeated_calls() {
        let input = format!("ghp_{}", "S".repeat(36));
        assert_eq!(detect(&input), detect(&input));
    }
}
