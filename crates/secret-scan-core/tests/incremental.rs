//! Incremental sanitizer session tests, grouped by the areas the deliverable
//! calls out: session-state, limit-boundary, open-construct, multiline, and
//! progressive-emission.
//!
//! Every input is synthetic; no test embeds a credential-shaped value that
//! is not obviously a revoked fixture.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use secret_scan::{
    Action, Finding, IncrementalLimits, IncrementalResult, IncrementalSanitizer,
    SecretScanErrorCode, SessionState,
};

/// Generous limits for tests that are not exercising a specific boundary.
fn generous_limits() -> IncrementalLimits {
    IncrementalLimits::new(1_000_000, 16_512, 8_192, 16_384).unwrap()
}

fn session() -> IncrementalSanitizer {
    IncrementalSanitizer::new(generous_limits()).unwrap()
}

// ---------------------------------------------------------------------------
// session-state
// ---------------------------------------------------------------------------

#[test]
fn starts_accepting() {
    let sanitizer = session();
    assert_eq!(sanitizer.state(), SessionState::Accepting);
}

#[test]
fn finalize_is_single_use() {
    let mut sanitizer = session();
    sanitizer.finalize().unwrap();
    assert_eq!(sanitizer.state(), SessionState::Finalized);

    let error = sanitizer.finalize().unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidState);
    assert_eq!(sanitizer.state(), SessionState::Finalized);
}

#[test]
fn abort_rejects_every_later_call() {
    let mut sanitizer = session();
    sanitizer
        .append("api_key=SYNTHETIC_REVOKED_ABORT_FIXTURE")
        .unwrap();
    sanitizer.abort().unwrap();
    assert_eq!(sanitizer.state(), SessionState::Aborted);

    let error = sanitizer.append("ignored").unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidState);
    assert_eq!(sanitizer.state(), SessionState::Aborted);

    let error = sanitizer.finalize().unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidState);
    assert_eq!(sanitizer.state(), SessionState::Aborted);

    let error = sanitizer.abort().unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidState);
    assert_eq!(sanitizer.state(), SessionState::Aborted);
}

#[test]
fn abort_precedes_finalize() {
    let mut sanitizer = session();
    sanitizer.abort().unwrap();
    let error = sanitizer.finalize().unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidState);
    assert_eq!(sanitizer.state(), SessionState::Aborted);
}

#[test]
fn finalize_after_abort_stays_rejected() {
    let mut sanitizer = session();
    sanitizer.abort().unwrap();
    assert!(sanitizer.finalize().is_err());
    assert_eq!(sanitizer.state(), SessionState::Aborted);
}

#[test]
fn a_failure_discards_retained_text_and_rejects_every_later_call() {
    let limits = IncrementalLimits::new(1_000_000, 160, 32, 32).unwrap();
    let mut sanitizer = IncrementalSanitizer::new(limits).unwrap();

    let error = sanitizer.append(&"x".repeat(33)).unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::TokenLimitExceeded);
    assert_eq!(sanitizer.state(), SessionState::Failed);

    let error = sanitizer.append("ignored").unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidState);
    let error = sanitizer.finalize().unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidState);
    let error = sanitizer.abort().unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidState);
    assert_eq!(sanitizer.state(), SessionState::Failed);
}

#[test]
fn a_finding_free_session_finalizes_with_empty_text() {
    let mut sanitizer = session();
    let result = sanitizer.finalize().unwrap();
    assert_eq!(result.text(), "");
    assert!(result.findings().is_empty());
}

// ---------------------------------------------------------------------------
// limit-boundary
// ---------------------------------------------------------------------------

#[test]
fn limits_require_every_value_to_be_positive() {
    for limits in [
        (0, 200, 32, 32),
        (200, 0, 32, 32),
        (200, 200, 0, 32),
        (200, 200, 32, 0),
    ] {
        let error = IncrementalLimits::new(limits.0, limits.1, limits.2, limits.3).unwrap_err();
        assert_eq!(
            error.code(),
            SecretScanErrorCode::InvalidLimits,
            "{limits:?}"
        );
    }
}

#[test]
fn limits_require_token_and_multiline_within_input() {
    let error = IncrementalLimits::new(100, 300, 101, 32).unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidLimits);

    let error = IncrementalLimits::new(100, 300, 32, 101).unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidLimits);
}

#[test]
fn limits_require_buffered_to_accommodate_the_construct_limit_and_reserve() {
    // construct_max = 100, so buffered must be at least 100 + 128 = 228.
    let error = IncrementalLimits::new(1_000, 227, 100, 64).unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InvalidLimits);

    let limits = IncrementalLimits::new(1_000, 228, 100, 64).unwrap();
    assert_eq!(limits.max_buffered_bytes(), 228);
}

#[test]
fn valid_limits_round_trip_through_their_accessors() {
    let limits = IncrementalLimits::new(1_000_000, 16_512, 8_192, 16_384).unwrap();
    assert_eq!(limits.max_input_bytes(), 1_000_000);
    assert_eq!(limits.max_buffered_bytes(), 16_512);
    assert_eq!(limits.max_token_bytes(), 8_192);
    assert_eq!(limits.max_multiline_bytes(), 16_384);
}

#[test]
fn input_limit_exceeded_fails_safely_with_no_output() {
    let limits = IncrementalLimits::new(10, 200, 10, 10).unwrap();
    let mut sanitizer = IncrementalSanitizer::new(limits).unwrap();
    let error = sanitizer.append(&"x".repeat(11)).unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::InputLimitExceeded);
    assert_eq!(sanitizer.state(), SessionState::Failed);
}

#[test]
fn token_limit_exceeded_fails_before_emitting_any_byte() {
    let limits = IncrementalLimits::new(1_000_000, 160, 32, 32).unwrap();
    let mut sanitizer = IncrementalSanitizer::new(limits).unwrap();
    let error = sanitizer.append(&"x".repeat(33)).unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::TokenLimitExceeded);
    assert_eq!(sanitizer.state(), SessionState::Failed);
}

#[test]
fn multiline_limit_exceeded_fails_before_emitting_any_byte() {
    let limits = IncrementalLimits::new(1_000_000, 192, 64, 64).unwrap();
    let mut sanitizer = IncrementalSanitizer::new(limits).unwrap();
    let chunk = format!("-----BEGIN PRIVATE KEY-----\n{}", "A".repeat(100));
    let error = sanitizer.append(&chunk).unwrap_err();
    assert_eq!(error.code(), SecretScanErrorCode::MultilineLimitExceeded);
    assert_eq!(sanitizer.state(), SessionState::Failed);
}

// ---------------------------------------------------------------------------
// open-construct
// ---------------------------------------------------------------------------

#[test]
fn a_bearer_header_split_across_a_physical_line_stays_open() {
    let mut sanitizer = session();
    let held = sanitizer.append("Authorization:\n").unwrap();
    assert_eq!(held.text(), "");
    assert!(held.findings().is_empty());

    let resolved = sanitizer
        .append("Bearer SYNTHETIC_REVOKED_BEARER_VALUE_1234567890\n")
        .unwrap();
    assert_eq!(resolved.findings().len(), 1);
    assert_eq!(resolved.findings()[0].type_name(), "bearer_token");
}

#[test]
fn a_contextual_assignment_name_without_its_operator_stays_open() {
    let mut sanitizer = session();
    let held = sanitizer.append("api_key\n").unwrap();
    assert_eq!(held.text(), "");
    assert!(held.findings().is_empty());

    let resolved = sanitizer
        .append("=SYNTHETIC_REVOKED_CONTEXT_VALUE\n")
        .unwrap();
    assert_eq!(resolved.findings().len(), 1);
    assert_eq!(resolved.findings()[0].type_name(), "contextual_secret");
}

#[test]
fn an_unrelated_open_line_does_not_block_flushing_a_prior_closed_line() {
    let mut sanitizer = session();
    let result = sanitizer.append("plain line\napi_key\n").unwrap();
    assert_eq!(result.text(), "plain line\n");
    assert!(result.findings().is_empty());

    let resolved = sanitizer
        .append("=SYNTHETIC_REVOKED_CONTEXT_VALUE\n")
        .unwrap();
    assert_eq!(resolved.findings().len(), 1);
}

// ---------------------------------------------------------------------------
// multiline
// ---------------------------------------------------------------------------

#[test]
fn a_pem_block_stays_retained_until_its_delimiter_stack_resolves() {
    let mut sanitizer = session();
    let held = sanitizer.append("-----BEGIN PRIVATE KEY-----\n").unwrap();
    assert_eq!(held.text(), "");

    let held = sanitizer
        .append(&"U1lOVEhFVElDX1JFVk9LRUQ=\n".repeat(2))
        .unwrap();
    assert_eq!(held.text(), "");

    let held = sanitizer.append("-----END PRIVATE KEY-----").unwrap();
    assert_eq!(held.text(), "");

    let result = sanitizer.finalize().unwrap();
    assert_eq!(result.findings().len(), 1);
    assert_eq!(result.findings()[0].type_name(), "private_key");
    assert_eq!(result.findings()[0].action(), Action::Block);
}

#[test]
fn a_pem_block_split_one_byte_at_a_time_still_resolves_to_one_finding() {
    let mut sanitizer = session();
    let input = format!(
        "-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----\n",
        "U1lOVEhFVElDX1JFVk9LRUQ=".repeat(4)
    );
    let mut text = String::new();
    let mut findings = Vec::new();
    for byte_chunk in input.as_bytes().chunks(1) {
        let piece = std::str::from_utf8(byte_chunk).unwrap();
        let result = sanitizer.append(piece).unwrap();
        text.push_str(result.text());
        findings.extend(result.findings().to_vec());
    }
    let result = sanitizer.finalize().unwrap();
    text.push_str(result.text());
    findings.extend(result.findings().to_vec());

    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].type_name(), "private_key");
    assert_eq!(text.matches("<SECRET_1>").count(), 1);
}

// ---------------------------------------------------------------------------
// progressive-emission
// ---------------------------------------------------------------------------

#[test]
fn ordinary_closed_lines_emit_immediately_without_finalize() {
    let mut sanitizer = session();
    let result = sanitizer.append("line one\nline two\n").unwrap();
    assert_eq!(result.text(), "line one\nline two\n");
    assert!(result.findings().is_empty());
    assert_eq!(sanitizer.state(), SessionState::Accepting);
}

#[test]
fn placeholder_numbering_advances_across_append_calls() {
    let mut sanitizer = session();
    let first = sanitizer
        .append("api_key=SYNTHETIC_REVOKED_CONTEXT_VALUE_ONE\n")
        .unwrap();
    let second = sanitizer
        .append("api_key=SYNTHETIC_REVOKED_CONTEXT_VALUE_TWO\n")
        .unwrap();
    assert_eq!(first.findings()[0].id(), "finding-1");
    assert_eq!(second.findings()[0].id(), "finding-2");
    assert!(first.text().contains("<SECRET_1>"));
    assert!(second.text().contains("<SECRET_2>"));
}

/// Runs `chunks` through a fresh session (`append` for each chunk, then
/// `finalize`), returning the concatenated text and the flattened findings
/// in call order.
fn run(chunks: &[&str]) -> (String, Vec<Finding>) {
    let mut sanitizer = session();
    let mut text = String::new();
    let mut findings = Vec::new();
    let mut collect = |result: IncrementalResult| {
        let (chunk_text, chunk_findings) = result.into_parts();
        text.push_str(&chunk_text);
        findings.extend(chunk_findings);
    };
    for chunk in chunks {
        collect(sanitizer.append(chunk).unwrap());
    }
    collect(sanitizer.finalize().unwrap());
    (text, findings)
}

#[test]
fn whole_input_acceptance_is_independent_of_chunk_partitioning() {
    let input = "api_key=SYNTHETIC_REVOKED_CONTEXT_VALUE\n";
    let (baseline_text, baseline_findings) = run(&[input]);
    assert_eq!(baseline_findings.len(), 1);

    for split in 0..=input.len() {
        let (text, findings) = run(&[&input[..split], &input[split..]]);
        assert_eq!(text, baseline_text, "split at {split}");
        assert_eq!(findings, baseline_findings, "split at {split}");
    }

    let one_byte_at_a_time: Vec<&str> = (0..input.len())
        .map(|index| &input[index..=index])
        .collect();
    let (text, findings) = run(&one_byte_at_a_time);
    assert_eq!(text, baseline_text);
    assert_eq!(findings, baseline_findings);
}

#[test]
fn whole_input_acceptance_is_independent_of_partitioning_for_a_multi_detector_input() {
    let input = concat!(
        "Authorization: Bearer SYNTHETIC_REVOKED_BEARER_VALUE_1234567890\n",
        "api_key=SYNTHETIC_REVOKED_CONTEXT_VALUE\n",
        "ordinary line with nothing secret in it\n",
        "-----BEGIN PRIVATE KEY-----\n",
        "U1lOVEhFVElDX1JFVk9LRUQ=\n",
        "-----END PRIVATE KEY-----\n",
    );
    let (baseline_text, baseline_findings) = run(&[input]);
    assert_eq!(baseline_findings.len(), 3);

    let by_line: Vec<&str> = input.split_inclusive('\n').collect();
    let (text, findings) = run(&by_line);
    assert_eq!(text, baseline_text);
    assert_eq!(findings, baseline_findings);

    let midpoint = input.len() / 2;
    let mut cut = midpoint;
    while !input.is_char_boundary(cut) {
        cut += 1;
    }
    let (text, findings) = run(&[&input[..cut], &input[cut..]]);
    assert_eq!(text, baseline_text);
    assert_eq!(findings, baseline_findings);
}
