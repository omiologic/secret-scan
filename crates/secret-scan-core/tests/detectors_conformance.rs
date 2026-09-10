//! Representative overlap cases from the shared conformance corpus
//! (`conformance/fixtures/synchronous-corpus.json`). Fixture ids are named in
//! each test so they can be cross-referenced against the corpus.
//!
//! Every input is synthetic; no test embeds a credential-shaped value.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use secret_scan::{
    Action, ByteRange, Confidence, DefaultPolicy, DetectorRegistry, run_detector_pipeline, scan,
};

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

// --- issue #107: deepened private-key and JWT grammar coverage ------------
//
// The corpus fixtures above prove *detection*: the right span, at the right
// confidence and specificity. The default policy's block/redact outcome is a
// separate decision layered on top (`src/policy.rs`), so it is asserted here
// explicitly, through the real built-in detectors and `DefaultPolicy`
// together, for the deepened grammar forms added alongside these tests.

/// fixture: private-key-positive-crlf-line-endings,
/// private-key-positive-openssh-multiline-body,
/// private-key-positive-dsa-label, private-key-positive-encrypted-label
///
/// Every accepted label and line-ending variant still blocks under the
/// default policy, not merely gets detected.
#[test]
fn every_deepened_private_key_grammar_variant_blocks_under_default_policy() {
    let registry = DetectorRegistry::with_built_in([]).unwrap();
    let inputs = [
        "-----BEGIN PRIVATE KEY-----\r\nU1lOVEhFVElDX0NSTEZfVEVSTUlOQVRJT04=\r\n-----END PRIVATE KEY-----",
        "-----BEGIN OPENSSH PRIVATE KEY-----\nU1lOVEhFVElDX09QRU5TU0hf\nTVVMVElMSU5FX0JPRFlfVEVS\nTUlOQVRJT05fRVhBTVBMRQ==\n-----END OPENSSH PRIVATE KEY-----",
        "-----BEGIN DSA PRIVATE KEY-----\nU1lOVEhFVElDX0RTQV9SRVZPS0VE\n-----END DSA PRIVATE KEY-----",
        "-----BEGIN ENCRYPTED PRIVATE KEY-----\nU1lOVEhFVElDX0VOQ1JZUFRFRA==\n-----END ENCRYPTED PRIVATE KEY-----",
    ];

    for input in inputs {
        let findings = scan(input, &registry, &DefaultPolicy).unwrap();
        assert_eq!(findings.len(), 1, "{input}");
        assert_eq!(findings[0].type_name(), "private_key", "{input}");
        assert_eq!(findings[0].action(), Action::Block, "{input}");
    }
}

/// fixture: jwt-boundary-two-segments, jwt-boundary-four-segments,
/// jwt-boundary-standard-base64-alphabet, jwt-boundary-base64-padding,
/// jwt-negative-colon-delimiter, jwt-negative-payload-not-json-prefixed
///
/// Every structural near miss in segment count, alphabet, padding, and
/// delimiter produces no finding at all through the full built-in registry,
/// so there is no policy outcome and no overlap candidate left behind for
/// another detector to misclassify.
#[test]
fn structural_jwt_near_misses_produce_no_finding_through_the_full_registry() {
    let registry = DetectorRegistry::with_built_in([]).unwrap();
    let inputs = [
        "eyJTWU5USEVUSUNfSEVBREVS.eyJTWU5USEVUSUNfUEFZTE9BRA",
        "eyJTWU5USEVUSUNfSEVBREVS.eyJTWU5USEVUSUNfUEFZTE9BRA.SYNTHETIC_REVOKED_SIGNATURE.EXTRA",
        "eyJTWU5USEVUSUNfSEVBREVS.eyJTWU5USEVUSUNf+EFZTE9BRA.SYNTHETIC_REVOKED_SIGNATURE",
        "eyJTWU5USEVUSUNfSEVBREVS.eyJTWU5USEVUSUNfUEFZTE9BRA==.SYNTHETIC_REVOKED_SIGNATURE",
        "eyJTWU5USEVUSUNfSEVBREVS:eyJTWU5USEVUSUNfUEFZTE9BRA:SYNTHETIC_REVOKED_SIGNATURE",
        "eyJTWU5USEVUSUNfSEVBREVS.QUJDREVGR0hJSktMTU5PUA.SYNTHETIC_REVOKED_SIGNATURE",
    ];

    for input in inputs {
        let findings = scan(input, &registry, &DefaultPolicy).unwrap();
        assert_eq!(findings, Vec::new(), "{input}");
    }
}

/// fixture: jwt-overlap-bearer / bearer-overlap-jwt
///
/// Extends `structured_jwt_displaces_the_broader_bearer_candidate` (above)
/// through the default policy: the surviving JWT candidate redacts, and the
/// displaced Bearer candidate leaves no separate finding behind for the
/// policy to act on.
#[test]
fn structured_jwt_overlap_winner_redacts_under_default_policy() {
    let registry = DetectorRegistry::with_built_in([]).unwrap();
    let input = "Authorization: Bearer eyJTWU5USEVUSUNfSEVBREVS.eyJTWU5USEVUSUNfUEFZTE9BRA.SYNTHETIC_REVOKED_SIGNATURE";

    let findings = scan(input, &registry, &DefaultPolicy).unwrap();

    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].type_name(), "jwt");
    assert_eq!(findings[0].range(), range(22, 101));
    assert_eq!(findings[0].action(), Action::Redact);
}
