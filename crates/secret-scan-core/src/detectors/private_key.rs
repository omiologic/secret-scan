//! PEM private-key delimiter parser.
//!
//! Complete, well-paired blocks require encoded body evidence. Nested,
//! repeated, or mismatched supported delimiters produce one conservative
//! candidate from the outermost header through resolution, or through end of
//! input when the delimiter stack never resolves. This prevents an inner
//! block from winning overlap resolution while surrounding key material is
//! left behind. A lone incomplete header is ignored so prose fragments are
//! not classified as a key. This mirrors `src/detectors/private-key.ts`
//! (`decision-govern-cross-language-conformance`).

use crate::error::DetectorFailure;
use crate::types::{ByteRange, Candidate, Confidence, Detector, DetectorContext, Specificity};

const LABELS: [&str; 6] = [
    "PRIVATE KEY",
    "RSA PRIVATE KEY",
    "DSA PRIVATE KEY",
    "EC PRIVATE KEY",
    "OPENSSH PRIVATE KEY",
    "ENCRYPTED PRIVATE KEY",
];

#[derive(Clone, Copy, PartialEq, Eq)]
enum DelimiterKind {
    Begin,
    End,
}

struct Delimiter {
    start: usize,
    end: usize,
    kind: DelimiterKind,
    label: usize,
}

/// Finds the next `-----BEGIN <label>-----` / `-----END <label>-----`
/// delimiter at or after `from`, scanning one byte at a time. `label` is an
/// index into [`LABELS`].
fn find_next_delimiter(input: &str, from: usize) -> Option<Delimiter> {
    let bytes = input.as_bytes();
    let mut position = from;
    while position + 5 <= bytes.len() {
        if &bytes[position..position + 5] == b"-----" {
            for (kind, keyword) in [(DelimiterKind::Begin, "BEGIN"), (DelimiterKind::End, "END")] {
                let keyword_start = position + 5;
                let keyword_end = keyword_start + keyword.len();
                if keyword_end < bytes.len()
                    && bytes[keyword_start..keyword_end] == *keyword.as_bytes()
                    && bytes[keyword_end] == b' '
                {
                    let label_start = keyword_end + 1;
                    for (label, name) in LABELS.iter().enumerate() {
                        let label_end = label_start + name.len();
                        let suffix_end = label_end + 5;
                        if suffix_end <= bytes.len()
                            && bytes[label_start..label_end] == *name.as_bytes()
                            && bytes[label_end..suffix_end] == *b"-----"
                        {
                            return Some(Delimiter {
                                start: position,
                                end: suffix_end,
                                kind,
                                label,
                            });
                        }
                    }
                }
            }
        }
        position += 1;
    }
    None
}

/// Delimiter-stack state carried across a full scan of the input.
struct ParserState {
    stack: Vec<usize>,
    malformed: bool,
    outer_start: Option<usize>,
    outer_body_start: Option<usize>,
}

impl ParserState {
    const fn new() -> Self {
        Self {
            stack: Vec::new(),
            malformed: false,
            outer_start: None,
            outer_body_start: None,
        }
    }
}

struct CompletedSpan {
    start: usize,
    body_start: usize,
    footer_start: usize,
    end: usize,
    malformed: bool,
}

/// Advances `state` past one delimiter, returning the completed span once the
/// stack unwinds back to empty.
fn process_delimiter(state: &mut ParserState, delimiter: &Delimiter) -> Option<CompletedSpan> {
    if delimiter.kind == DelimiterKind::Begin {
        if state.stack.is_empty() {
            state.outer_start = Some(delimiter.start);
            state.outer_body_start = Some(delimiter.end);
        } else {
            state.malformed = true;
        }
        state.stack.push(delimiter.label);
        return None;
    }

    let &top = state.stack.last()?;
    if top != delimiter.label {
        state.malformed = true;
        return None;
    }
    state.stack.pop();
    if !state.stack.is_empty() {
        return None;
    }

    let start = state.outer_start?;
    let body_start = state.outer_body_start?;
    let completed = CompletedSpan {
        start,
        body_start,
        footer_start: delimiter.start,
        end: delimiter.end,
        malformed: state.malformed,
    };
    state.malformed = false;
    state.outer_start = None;
    state.outer_body_start = None;
    Some(completed)
}

/// `true` when `input[start..end]` (with CR and LF ignored) contains a run of
/// at least 16 consecutive base64-alphabet bytes.
fn has_encoded_body(input: &str, start: usize, end: usize) -> bool {
    let mut run_length = 0u32;
    for &byte in &input.as_bytes()[start..end] {
        if byte == b'\n' || byte == b'\r' {
            continue;
        }
        if byte.is_ascii_alphanumeric() || byte == b'+' || byte == b'/' {
            run_length += 1;
            if run_length >= 16 {
                return true;
            }
        } else {
            run_length = 0;
        }
    }
    false
}

/// Builds the candidate for a span, or `None` when `start == end` (never the
/// case for a delimiter-bounded span, but the pipeline validates ranges
/// rather than this detector trusting its own arithmetic).
fn candidate(start: usize, end: usize, malformed: bool) -> Option<Candidate> {
    let range = ByteRange::new(start, end)?;
    let signals: [&str; 2] = if malformed {
        ["pem-boundaries", "malformed-delimiters"]
    } else {
        ["pem-boundaries", "encoded-body"]
    };
    Some(
        Candidate::new("private_key", Confidence::High, range)
            .with_specificity(Specificity::PrivateKey)
            .with_signals(signals),
    )
}

/// Recognizes complete and fail-safe malformed PEM private-key blocks.
pub struct PrivateKeyDetector;

impl Detector for PrivateKeyDetector {
    fn id(&self) -> &'static str {
        "private-key"
    }

    fn detect(
        &self,
        input: &str,
        _context: &DetectorContext,
    ) -> Result<Vec<Candidate>, DetectorFailure> {
        let mut candidates = Vec::new();
        let mut state = ParserState::new();
        let mut position = 0;

        while let Some(delimiter) = find_next_delimiter(input, position) {
            position = delimiter.end;
            if let Some(span) = process_delimiter(&mut state, &delimiter)
                && (span.malformed || has_encoded_body(input, span.body_start, span.footer_start))
                && let Some(found) = candidate(span.start, span.end, span.malformed)
            {
                candidates.push(found);
            }
        }

        if !state.stack.is_empty()
            && state.malformed
            && let Some(start) = state.outer_start
            && start < input.len()
            && let Some(found) = candidate(start, input.len(), true)
        {
            candidates.push(found);
        }

        Ok(candidates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detect(input: &str) -> Vec<Candidate> {
        PrivateKeyDetector
            .detect(input, &DetectorContext::new(input.len()))
            .unwrap()
    }

    fn spans(candidates: &[Candidate]) -> Vec<(usize, usize)> {
        candidates
            .iter()
            .map(|c| (c.range().start(), c.range().end()))
            .collect()
    }

    fn block(label: &str) -> String {
        format!(
            "-----BEGIN {label}-----\nU1lOVEhFVElDX1JFVk9LRURfRklYVFVSRQ==\n-----END {label}-----"
        )
    }

    #[test]
    fn detects_a_complete_block_with_encoded_body() {
        let input = block("PRIVATE KEY");
        let found = detect(&input);
        assert_eq!(spans(&found), [(0, input.len())]);
        assert_eq!(found[0].type_name(), "private_key");
        assert_eq!(found[0].confidence(), Confidence::High);
        assert_eq!(found[0].effective_specificity(), Specificity::PrivateKey);
    }

    #[test]
    fn every_supported_label_is_recognized() {
        for label in LABELS {
            let input = block(label);
            assert_eq!(spans(&detect(&input)), [(0, input.len())], "{label}");
        }
    }

    #[test]
    fn rejects_public_key_and_unsupported_labels() {
        for input in [
            "-----BEGIN PUBLIC KEY-----",
            "-----BEGIN CERTIFICATE-----\nU1lOVEhFVElDX1JFVk9LRURfQ0VSVA==\n-----END CERTIFICATE-----",
            "----BEGIN PRIVATE KEY-----\nU1lOVEhFVElDX1JFVk9LRURfTk8=\n-----END PRIVATE KEY-----",
            "-----BEGIN PRIVATE KEYS-----\nU1lOVEhFVElDX1JFVk9LRURfTk8=\n-----END PRIVATE KEYS-----",
        ] {
            assert_eq!(detect(input), Vec::new(), "{input}");
        }
    }

    #[test]
    fn ignores_a_lone_incomplete_header() {
        assert_eq!(
            detect("-----BEGIN PRIVATE KEY-----\nSYNTHETIC_TRUNCATED"),
            Vec::new()
        );
    }

    #[test]
    fn rejects_a_complete_pair_without_enough_encoded_body() {
        assert_eq!(
            detect("-----BEGIN PRIVATE KEY-----\nSHORT\n-----END PRIVATE KEY-----"),
            Vec::new()
        );
    }

    #[test]
    fn returns_separate_spans_for_adjacent_complete_blocks() {
        let first = block("PRIVATE KEY");
        let second = block("EC PRIVATE KEY");
        let input = format!("{first}\n{second}");
        assert_eq!(
            spans(&detect(&input)),
            [(0, first.len()), (first.len() + 1, input.len())]
        );
    }

    #[test]
    fn blocks_one_outer_span_for_properly_nested_delimiters() {
        let input = [
            "-----BEGIN RSA PRIVATE KEY-----",
            "U1lOVEhFVElDX1JFVk9LRURfT1VURVI=",
            "-----BEGIN EC PRIVATE KEY-----",
            "U1lOVEhFVElDX1JFVk9LRURfSU5ORVI=",
            "-----END EC PRIVATE KEY-----",
            "-----END RSA PRIVATE KEY-----",
        ]
        .join("\n");
        let found = detect(&input);
        assert_eq!(spans(&found), [(0, input.len())]);
        assert_eq!(
            found[0].signals(),
            ["pem-boundaries", "malformed-delimiters"]
        );
    }

    #[test]
    fn blocks_unresolved_repeated_or_mismatched_delimiters_to_end_of_input() {
        let fixtures = [
            [
                "-----BEGIN PRIVATE KEY-----",
                "SYNTHETIC_REVOKED_OUTER_BODY",
                "-----BEGIN PRIVATE KEY-----",
                "SYNTHETIC_REVOKED_INNER_BODY",
            ]
            .join("\n"),
            [
                "-----BEGIN RSA PRIVATE KEY-----",
                "SYNTHETIC_REVOKED_MISMATCHED_BODY",
                "-----END EC PRIVATE KEY-----",
                "ordinary trailing text",
            ]
            .join("\n"),
            [
                "-----BEGIN RSA PRIVATE KEY-----",
                "-----BEGIN EC PRIVATE KEY-----",
                "-----END RSA PRIVATE KEY-----",
                "SYNTHETIC_REVOKED_TRAILING_INNER_BODY",
                "-----END EC PRIVATE KEY-----",
            ]
            .join("\n"),
        ];

        for input in fixtures {
            assert_eq!(spans(&detect(&input)), [(0, input.len())], "{input}");
        }
    }

    #[test]
    fn handles_many_unmatched_headers_in_bounded_time() {
        let input = "-----BEGIN PRIVATE KEY-----\n".repeat(10_000);
        let found = detect(&input);
        assert_eq!(spans(&found), [(0, input.len())]);
    }

    #[test]
    fn finds_one_full_span_for_a_large_complete_block() {
        let input = format!(
            "-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----",
            "U1lOVEhFVElDX1JFVk9LRURfQk9EWQ==".repeat(32_000)
        );
        assert_eq!(spans(&detect(&input)), [(0, input.len())]);
    }

    #[test]
    fn long_missing_footer_terminates_without_a_finding() {
        let input = format!("-----BEGIN PRIVATE KEY-----\n{}", "A".repeat(100_000));
        assert_eq!(detect(&input), Vec::new());
    }

    #[test]
    fn id_is_stable() {
        assert_eq!(PrivateKeyDetector.id(), "private-key");
    }
}
