//! Single-pass redaction: replaces `block` and `redact` findings with
//! placeholder text produced by a [`PlaceholderFormatter`], leaving `warn`
//! and `allow` findings untouched.
//!
//! Redaction never exposes a matched value: it does not accept the value
//! itself (only [`Finding`] metadata and the immutable `input`), and every
//! failure is a sanitized [`SecretScanError`].

use std::collections::{BTreeMap, BTreeSet};

use crate::error::{FormatterFailure, SecretScanError, SecretScanErrorCode};
use crate::types::{ByteRange, Finding, PlaceholderContext, PlaceholderFormatter};

/// Maximum length in bytes of a placeholder a [`PlaceholderFormatter`] may
/// return.
pub const MAX_PLACEHOLDER_LENGTH: usize = 256;

/// The default formatter: `<SECRET_N>`, `N` one-based among replaced
/// findings.
///
/// # Errors
///
/// Never fails.
pub fn default_placeholder_formatter(
    _finding: &Finding,
    context: &PlaceholderContext,
) -> Result<String, FormatterFailure> {
    Ok(format!("<SECRET_{}>", context.placeholder_index()))
}

/// A formatter that names the finding type: `<TYPE_NAME_N>`, upper-cased
/// with `.` and `-` mapped to `_`.
///
/// # Errors
///
/// Never fails.
pub fn typed_placeholder_formatter(
    finding: &Finding,
    context: &PlaceholderContext,
) -> Result<String, FormatterFailure> {
    let normalized = finding
        .type_name()
        .to_ascii_uppercase()
        .replace(['.', '-'], "_");
    Ok(format!("<{normalized}_{}>", context.placeholder_index()))
}

/// Matched values eligible to be reproduced by a placeholder, indexed by
/// byte length so a formatter output can be checked in one pass over its
/// substrings.
///
/// Only `redact`/`block` findings whose matched text is no longer than
/// [`MAX_PLACEHOLDER_LENGTH`] are eligible: a longer matched value can never
/// fit inside a valid placeholder, so indexing it would be wasted work.
struct ForbiddenMatchedText {
    by_length: BTreeMap<usize, BTreeSet<String>>,
}

impl ForbiddenMatchedText {
    fn build(input: &str, findings: &[&Finding]) -> Self {
        let mut by_length: BTreeMap<usize, BTreeSet<String>> = BTreeMap::new();
        for finding in findings {
            if !finding.action().replaces_text() {
                continue;
            }
            let range = finding.range();
            if range.len() > MAX_PLACEHOLDER_LENGTH {
                continue;
            }
            by_length
                .entry(range.len())
                .or_default()
                .insert(input[range.start()..range.end()].to_string());
        }
        Self { by_length }
    }

    /// `true` when `placeholder` contains any indexed matched value as a
    /// substring.
    ///
    /// `by_length` iterates in ascending key order, so the scan stops as
    /// soon as a length exceeds what remains of `placeholder`.
    fn contains(&self, placeholder: &str) -> bool {
        for (&length, values) in &self.by_length {
            if length == 0 || length > placeholder.len() {
                continue;
            }
            let mut start = 0;
            while start + length <= placeholder.len() {
                if placeholder.is_char_boundary(start)
                    && placeholder.is_char_boundary(start + length)
                    && values.contains(&placeholder[start..start + length])
                {
                    return true;
                }
                start += 1;
            }
        }
        false
    }
}

fn ordered_and_disjoint<'a>(
    findings: &'a [Finding],
    input: &str,
) -> Result<Vec<&'a Finding>, SecretScanError> {
    for finding in findings {
        if !finding.range().is_char_aligned_in(input) {
            return Err(SecretScanErrorCode::InvalidFindings.into());
        }
    }

    let mut ordered: Vec<&Finding> = findings.iter().collect();
    ordered.sort_by_key(|finding| (finding.range().start(), finding.range().end()));

    let mut previous_end = 0;
    for finding in &ordered {
        let range: ByteRange = finding.range();
        if range.start() < previous_end {
            return Err(SecretScanErrorCode::InvalidFindings.into());
        }
        previous_end = range.end();
    }

    Ok(ordered)
}

/// Reconstructs `input` in one ordered pass: `warn` and `allow` findings
/// pass their span through unchanged; `redact` and `block` findings have
/// their span replaced by `formatter`'s output.
///
/// `findings` need not be pre-sorted or non-overlapping; this function
/// establishes both before producing output.
///
/// # Errors
///
/// - [`SecretScanErrorCode::InvalidFindings`] when a finding's range falls
///   outside `input`, is not character-aligned, or overlaps another
///   finding.
/// - [`SecretScanErrorCode::PlaceholderFailure`] when `formatter` fails.
/// - [`SecretScanErrorCode::InvalidPlaceholder`] when `formatter` returns an
///   empty placeholder, a placeholder longer than
///   [`MAX_PLACEHOLDER_LENGTH`], or a placeholder that reproduces any
///   eligible matched value.
///
/// No error carries `input`, a matched value, or a placeholder.
pub fn redact(
    input: &str,
    findings: &[Finding],
    formatter: &dyn PlaceholderFormatter,
) -> Result<String, SecretScanError> {
    let ordered = ordered_and_disjoint(findings, input)?;
    let forbidden = ForbiddenMatchedText::build(input, &ordered);

    let mut output = String::with_capacity(input.len());
    let mut cursor = 0;
    let mut placeholder_index = 0;
    for finding in ordered {
        if !finding.action().replaces_text() {
            continue;
        }

        let range = finding.range();
        output.push_str(&input[cursor..range.start()]);

        placeholder_index += 1;
        let context = PlaceholderContext::new(placeholder_index);
        let placeholder = formatter
            .format(finding, &context)
            .map_err(|_| SecretScanError::new(SecretScanErrorCode::PlaceholderFailure))?;
        if placeholder.is_empty()
            || placeholder.len() > MAX_PLACEHOLDER_LENGTH
            || forbidden.contains(&placeholder)
        {
            return Err(SecretScanErrorCode::InvalidPlaceholder.into());
        }
        output.push_str(&placeholder);

        cursor = range.end();
    }
    output.push_str(&input[cursor..]);
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Action, Confidence};

    fn finding(id: &str, start: usize, end: usize, action: Action) -> Finding {
        Finding::new(
            id,
            "synthetic-credential",
            "synthetic-detector",
            Confidence::High,
            action,
            ByteRange::new(start, end).unwrap(),
        )
        .unwrap()
    }

    #[test]
    fn reconstructs_repeated_and_adjacent_values_in_one_deterministic_pass() {
        let input = "SYNTHETIC_ONE|SYNTHETIC_ONE|SYNTHETIC_TWO";
        let findings = [
            finding("finding-3", 28, input.len(), Action::Block),
            finding("finding-1", 0, 13, Action::Redact),
            finding("finding-2", 14, 27, Action::Redact),
        ];
        let output = redact(input, &findings, &default_placeholder_formatter).unwrap();
        assert_eq!(output, "<SECRET_1>|<SECRET_2>|<SECRET_3>");
        assert_eq!(
            output,
            redact(input, &findings, &default_placeholder_formatter).unwrap()
        );
    }

    #[test]
    fn leaves_warn_and_allow_findings_unchanged_without_consuming_numbers() {
        let input = "WARN|ALLOW|REDACTED_VALUE";
        let findings = [
            finding("finding-1", 0, 4, Action::Warn),
            finding("finding-2", 5, 10, Action::Allow),
            finding("finding-3", 11, input.len(), Action::Redact),
        ];
        assert_eq!(
            redact(input, &findings, &default_placeholder_formatter).unwrap(),
            "WARN|ALLOW|<SECRET_1>"
        );
    }

    #[test]
    fn redacts_adjacent_findings_without_dropping_or_duplicating_text() {
        let input = "SYNTHETIC_ONESYNTHETIC_TWO";
        let findings = [
            finding("finding-1", 0, 13, Action::Redact),
            finding("finding-2", 13, 26, Action::Redact),
        ];
        assert_eq!(
            redact(input, &findings, &default_placeholder_formatter).unwrap(),
            "<SECRET_1><SECRET_2>"
        );
    }

    #[test]
    fn supports_typed_placeholders() {
        let input = "SYNTHETIC_REVOKED_VALUE";
        let findings = [finding("finding-1", 0, input.len(), Action::Redact)];
        assert_eq!(
            redact(input, &findings, &typed_placeholder_formatter).unwrap(),
            "<SYNTHETIC_CREDENTIAL_1>"
        );
    }

    #[test]
    fn sanitizes_formatter_failures() {
        let input = "SYNTHETIC_REVOKED_VALUE";
        let findings = [finding("finding-1", 0, input.len(), Action::Redact)];
        let failing = |_: &Finding, _: &PlaceholderContext| Err(FormatterFailure);
        let error = redact(input, &findings, &failing).unwrap_err();
        assert_eq!(error.code(), SecretScanErrorCode::PlaceholderFailure);
        assert!(!error.to_string().contains(input));
    }

    #[test]
    fn rejects_empty_and_oversized_placeholders() {
        let input = "SYNTHETIC_REVOKED_VALUE";
        let findings = [finding("finding-1", 0, input.len(), Action::Redact)];
        let empty = |_: &Finding, _: &PlaceholderContext| Ok(String::new());
        assert_eq!(
            redact(input, &findings, &empty).unwrap_err().code(),
            SecretScanErrorCode::InvalidPlaceholder
        );
        let oversized =
            |_: &Finding, _: &PlaceholderContext| Ok("x".repeat(MAX_PLACEHOLDER_LENGTH + 1));
        assert_eq!(
            redact(input, &findings, &oversized).unwrap_err().code(),
            SecretScanErrorCode::InvalidPlaceholder
        );
    }

    #[test]
    fn rejects_a_placeholder_containing_any_eligible_matched_value() {
        let input = "SYNTHETIC_ONE|SYNTHETIC_TWO|SYNTHETIC_ONE";
        let findings = [
            finding("finding-1", 0, 13, Action::Redact),
            finding("finding-2", 14, 27, Action::Redact),
            finding("finding-3", 28, input.len(), Action::Redact),
        ];
        let formatter = |_: &Finding, context: &PlaceholderContext| {
            Ok(if context.placeholder_index() == 1 {
                "<SYNTHETIC_TWO>".to_string()
            } else {
                format!("<REMOVED_{}>", context.placeholder_index())
            })
        };
        assert_eq!(
            redact(input, &findings, &formatter).unwrap_err().code(),
            SecretScanErrorCode::InvalidPlaceholder
        );
    }

    #[test]
    fn rejects_formatter_reproduction_of_a_short_caller_supplied_finding() {
        for input in ["x", "xy", "xyz"] {
            let findings = [finding("finding-1", 0, input.len(), Action::Redact)];
            let value = input.to_string();
            let formatter = move |_: &Finding, _: &PlaceholderContext| Ok(format!("<{value}>"));
            assert_eq!(
                redact(input, &findings, &formatter).unwrap_err().code(),
                SecretScanErrorCode::InvalidPlaceholder,
                "{input}"
            );
        }
    }

    #[test]
    fn rejects_overlapping_findings() {
        let input = "SYNTHETIC_REVOKED_VALUE";
        let findings = [
            finding("finding-1", 0, 10, Action::Redact),
            finding("finding-2", 5, 15, Action::Redact),
        ];
        let error = redact(input, &findings, &default_placeholder_formatter).unwrap_err();
        assert_eq!(error.code(), SecretScanErrorCode::InvalidFindings);
        assert!(!error.to_string().contains(input));
    }

    #[test]
    fn rejects_out_of_range_findings() {
        let input = "SYNTHETIC_REVOKED_VALUE";
        let findings = [finding("finding-1", 0, input.len() + 1, Action::Redact)];
        assert_eq!(
            redact(input, &findings, &default_placeholder_formatter)
                .unwrap_err()
                .code(),
            SecretScanErrorCode::InvalidFindings
        );
    }

    #[test]
    fn returns_input_unchanged_when_no_findings_replace_text() {
        let input = "ordinary text";
        assert_eq!(
            redact(input, &[], &default_placeholder_formatter).unwrap(),
            input
        );
    }
}
