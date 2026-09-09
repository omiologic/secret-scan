//! Conformance tests for the default policy and redaction working together
//! through the public `scan` + `redact` contract, using synthetic candidates
//! in place of not-yet-implemented built-in detectors.

// Integration tests are outside `#[cfg(test)]`, so the test-only relaxation in
// `clippy.toml` does not apply; these helpers may unwrap and panic on purpose.
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use secret_scan::{
    Action, ByteRange, Candidate, Confidence, DefaultPolicy, DetectedFinding, Detector,
    DetectorContext, DetectorRegistry, Finding, PlaceholderContext, Policy, SecretScanErrorCode,
    Specificity, default_placeholder_formatter, redact, scan,
};

struct Fixed {
    id: &'static str,
    candidates: Vec<(&'static str, Confidence, Specificity, ByteRange)>,
}

impl Detector for Fixed {
    fn id(&self) -> &str {
        self.id
    }

    fn detect(
        &self,
        _input: &str,
        _context: &DetectorContext,
    ) -> Result<Vec<Candidate>, secret_scan::DetectorFailure> {
        Ok(self
            .candidates
            .iter()
            .map(|(type_name, confidence, specificity, range)| {
                Candidate::new(*type_name, *confidence, *range).with_specificity(*specificity)
            })
            .collect())
    }
}

fn registry(detector: Fixed) -> DetectorRegistry {
    let mut registry = DetectorRegistry::new();
    registry.register(Box::new(detector)).unwrap();
    registry
}

#[test]
fn default_policy_blocks_private_keys_redacts_known_formats_and_warns_on_medium_context() {
    let input = "AAAAAAAAAA BBBBBBBBBB CCCCCCCCCC";
    let range = |s: usize, e: usize| ByteRange::new(s, e).unwrap();
    let detector = Fixed {
        id: "fixture",
        candidates: vec![
            (
                "private_key",
                Confidence::High,
                Specificity::PrivateKey,
                range(0, 10),
            ),
            (
                "github_token",
                Confidence::High,
                Specificity::Provider,
                range(11, 21),
            ),
            (
                "contextual_secret",
                Confidence::Medium,
                Specificity::Contextual,
                range(22, 32),
            ),
        ],
    };

    let findings = scan(input, &registry(detector), &DefaultPolicy).unwrap();
    let actions: Vec<(&str, Action)> = findings
        .iter()
        .map(|finding| (finding.type_name(), finding.action()))
        .collect();
    assert_eq!(
        actions,
        [
            ("private_key", Action::Block),
            ("github_token", Action::Redact),
            ("contextual_secret", Action::Warn),
        ]
    );
}

#[test]
fn scan_then_redact_round_trip_leaves_no_matched_value_in_output_or_error() {
    let input = "token=AAAAAAAAAA and note=ordinary";
    let range = ByteRange::new(6, 16).unwrap();
    let detector = Fixed {
        id: "fixture",
        candidates: vec![(
            "github_token",
            Confidence::High,
            Specificity::Provider,
            range,
        )],
    };

    let findings = scan(input, &registry(detector), &DefaultPolicy).unwrap();
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].action(), Action::Redact);

    let output = redact(input, &findings, &default_placeholder_formatter).unwrap();
    assert_eq!(output, "token=<SECRET_1> and note=ordinary");
    assert!(!output.contains("AAAAAAAAAA"));

    // Rescanning the redacted output finds nothing further.
    let rescan_registry = registry(Fixed {
        id: "fixture",
        candidates: Vec::new(),
    });
    assert!(
        scan(&output, &rescan_registry, &DefaultPolicy)
            .unwrap()
            .is_empty()
    );
}

#[test]
fn redact_rejects_a_caller_supplied_finding_that_overlaps_another() {
    let input = "SYNTHETIC_REVOKED_VALUE";
    let findings = [
        Finding::new(
            "finding-1",
            "synthetic_credential",
            "caller",
            Confidence::High,
            Action::Redact,
            ByteRange::new(0, 10).unwrap(),
        )
        .unwrap(),
        Finding::new(
            "finding-2",
            "synthetic_credential",
            "caller",
            Confidence::High,
            Action::Redact,
            ByteRange::new(5, 15).unwrap(),
        )
        .unwrap(),
    ];

    let error = redact(input, &findings, &default_placeholder_formatter).unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidFindings);
    assert!(!error.to_string().contains(input));
}

#[test]
fn redact_rejects_a_placeholder_that_reproduces_a_short_caller_supplied_finding() {
    for input in ["x", "xy", "xyz"] {
        let findings = [Finding::new(
            "finding-1",
            "synthetic_credential",
            "caller",
            Confidence::High,
            Action::Redact,
            ByteRange::new(0, input.len()).unwrap(),
        )
        .unwrap()];
        let value = input.to_string();
        let formatter = move |_: &Finding, _: &PlaceholderContext| Ok(format!("<{value}>"));

        let error = redact(input, &findings, &formatter).unwrap_err();
        assert_eq!(
            error.code(),
            SecretScanErrorCode::InvalidPlaceholder,
            "{input}"
        );
    }
}

#[test]
fn detected_finding_from_a_caller_supplied_id_participates_in_default_policy() {
    let detected = DetectedFinding::new(
        "finding-1",
        "aws_access_key_id",
        "caller",
        Confidence::Low,
        ByteRange::new(0, 4).unwrap(),
    )
    .unwrap();
    let action = DefaultPolicy
        .evaluate(&detected, &secret_scan::PolicyContext::new(0, 1))
        .unwrap();
    assert_eq!(action, Action::Redact);
}
