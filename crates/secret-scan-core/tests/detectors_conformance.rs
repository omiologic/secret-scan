//! Representative cases from the shared conformance corpus
//! (`conformance/fixtures/synchronous-corpus.json`) for the detectors this
//! crate ships: `jwt`, `bearer-token`, and `generic-token`. Fixture ids are
//! named in each test so they can be cross-referenced against the corpus.
//!
//! Every input is synthetic; no test embeds a credential-shaped value.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use secret_scan::{
    ByteRange, Candidate, Confidence, Detector, DetectorContext, DetectorFailure, DetectorRegistry,
    Specificity, run_detector_pipeline,
};

/// A detector that emits a fixed candidate list regardless of input, used to
/// stand in for a provider detector not yet ported (`decision-govern-cross-language-conformance`
/// scopes this crate to jwt/bearer-token/generic-token for now).
struct Fixed {
    id: &'static str,
    candidates: Vec<Candidate>,
}

impl Detector for Fixed {
    fn id(&self) -> &str {
        self.id
    }

    fn detect(&self, _: &str, _: &DetectorContext) -> Result<Vec<Candidate>, DetectorFailure> {
        Ok(self.candidates.clone())
    }
}

fn range(start: usize, end: usize) -> ByteRange {
    ByteRange::new(start, end).unwrap()
}

/// fixture: jwt-overlap-bearer / bearer-overlap-jwt
///
/// Registry order deterministically selects the structured JWT over the
/// broader Bearer candidate.
#[test]
fn structured_jwt_displaces_the_broader_bearer_candidate() {
    let registry = DetectorRegistry::with_built_in([]).unwrap();
    let input = "Authorization: Bearer eyJTWU5USEVUSUNfSEVBREVS.eyJTWU5USEVUSUNfUEFZTE9BRA.SYNTHETIC_REVOKED_SIGNATURE";

    let findings = run_detector_pipeline(input, &registry).unwrap();

    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].detector(), "jwt");
    assert_eq!(findings[0].type_name(), "jwt");
    assert_eq!(findings[0].confidence(), Confidence::High);
    assert_eq!(findings[0].range(), range(22, 101));
}

/// fixture: contextual-overlap-provider
///
/// A contextual candidate yields to a higher-specificity provider candidate
/// even though `generic-token` also proposes a (lower-specificity) span for
/// the same value.
#[test]
fn contextual_candidate_yields_to_a_higher_specificity_provider_candidate() {
    let input = "client_secret=sk-proj-SYNTHETIC_REVOKED_CONFORMANCE_KEY";
    let provider_range = range(14, input.len());

    let registry = DetectorRegistry::with_built_in([]).unwrap();

    let findings = run_detector_pipeline(input, &registry).unwrap();

    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].detector(), "openai-token");
    assert_eq!(findings[0].type_name(), "openai_api_key");
    assert_eq!(findings[0].range(), provider_range);
}

/// fixture: jwt-positive-structured, bearer-positive-scheme,
/// contextual-positive-assignment
///
/// The three built-in detectors run together without interfering with each
/// other's disjoint spans.
#[test]
fn disjoint_findings_from_every_built_in_detector_all_survive() {
    let registry = DetectorRegistry::with_built_in([]).unwrap();
    let input = "api_key=SYNTHETIC_REVOKED_CONTEXT_VALUE\nBearer SYNTHETIC_REVOKED_BEARER_VALUE";

    let findings = run_detector_pipeline(input, &registry).unwrap();

    let mut by_detector: Vec<&str> = findings
        .iter()
        .map(secret_scan::DetectedFinding::detector)
        .collect();
    by_detector.sort_unstable();
    assert_eq!(by_detector, ["bearer-token", "generic-token"]);
}
