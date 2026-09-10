//! Credential-bearing connection authority parser.
//!
//! Selects the original, undecoded password portion of credential-bearing
//! URLs for a bounded set of schemes. Requiring a valid credential-bearing
//! authority avoids classifying host-only and malformed URLs. Standard
//! MongoDB seed lists and Redis password-only authorities are handled
//! explicitly; unsupported schemes and placeholder passwords are false
//! negatives by design. This mirrors `src/detectors/connection-string.ts`
//! (`decision-govern-cross-language-conformance`).

use crate::entropy::shannon_entropy;
use crate::error::DetectorFailure;
use crate::types::{ByteRange, Candidate, Confidence, Detector, DetectorContext, Specificity};

/// Schemes in the exact order their alternation is tried, so a scheme whose
/// name is a prefix of another (`redis`/`rediss`, `amqp`/`amqps`,
/// `postgres`/`postgresql`, `mongodb`/`mongodb+srv`) resolves the same way a
/// backtracking regex alternation would: try the earlier alternative first,
/// and fall through to the next only when it is not immediately followed by
/// `://`.
const SCHEMES: [&str; 10] = [
    "postgresql",
    "postgres",
    "mysql",
    "mariadb",
    "mongodb+srv",
    "mongodb",
    "redis",
    "rediss",
    "amqp",
    "amqps",
];

const MAX_PASSWORD_LENGTH: usize = 4_096;
const MAX_AUTHORITY_LENGTH: usize = 8_192;

struct SchemeMatch {
    start: usize,
    end: usize,
    scheme: &'static str,
}

/// Finds the next `<scheme>://` occurrence at or after `from`, matching the
/// scheme name case-insensitively.
fn find_next_scheme(input: &str, from: usize) -> Option<SchemeMatch> {
    let bytes = input.as_bytes();
    let mut position = from;
    while position <= bytes.len() {
        for scheme in SCHEMES {
            let end = position + scheme.len() + 3;
            if end <= bytes.len()
                && bytes[position..position + scheme.len()].eq_ignore_ascii_case(scheme.as_bytes())
                && bytes[position + scheme.len()..end] == *b"://"
            {
                return Some(SchemeMatch {
                    start: position,
                    end,
                    scheme,
                });
            }
        }
        position += 1;
    }
    None
}

fn is_scheme_char(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'.' | b'-')
}

fn is_authority_terminator(byte: u8) -> bool {
    matches!(
        byte,
        b' ' | b'\t'
            | b'\n'
            | 0x0B
            | 0x0C
            | b'\r'
            | b'/'
            | b'?'
            | b'#'
            | b'"'
            | b'\''
            | b'<'
            | b'>'
            | b'\\'
    )
}

/// Scans forward from `start` for the end of the authority, bounded by
/// [`MAX_AUTHORITY_LENGTH`]. Returns `None` when the bound is exceeded before
/// a terminator or the end of input is reached.
fn authority_end(input: &str, start: usize) -> Option<usize> {
    let bytes = input.as_bytes();
    let mut end = start;
    while end < bytes.len() && !is_authority_terminator(bytes[end]) {
        if end - start >= MAX_AUTHORITY_LENGTH {
            return None;
        }
        end += 1;
    }
    Some(end)
}

/// The index of the sole `@` in `authority`, or `None` when there is no `@`,
/// more than one, or it is the first byte (an empty username section, which
/// this parser never treats as credential-bearing).
fn single_at(authority: &str) -> Option<usize> {
    let first = authority.find('@')?;
    if first == 0 || authority.rfind('@') != Some(first) {
        return None;
    }
    Some(first)
}

fn is_placeholder(value: &str) -> bool {
    const NAMES: [&str; 7] = [
        "password",
        "secret",
        "example",
        "sample",
        "placeholder",
        "redacted",
        "changeme",
    ];
    if NAMES.iter().any(|name| value.eq_ignore_ascii_case(name)) {
        return true;
    }
    if value.len() >= 2 && value.starts_with('<') && value.ends_with('>') {
        let inner = &value[1..value.len() - 1];
        if !inner.is_empty() && !inner.contains('>') {
            return true;
        }
    }
    if value.len() >= 3 && value.starts_with("${") && value.ends_with('}') {
        let inner = &value[2..value.len() - 1];
        if !inner.is_empty() && !inner.contains('}') {
            return true;
        }
    }
    false
}

fn is_userinfo_char(byte: u8) -> bool {
    byte.is_ascii_alphanumeric()
        || matches!(
            byte,
            b'.' | b'_'
                | b'~'
                | b'!'
                | b'$'
                | b'&'
                | b'\''
                | b'('
                | b')'
                | b'*'
                | b'+'
                | b','
                | b';'
                | b'='
                | b':'
                | b'-'
        )
}

fn has_valid_userinfo_encoding(value: &str) -> bool {
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let valid_escape = bytes.get(index + 1).is_some_and(u8::is_ascii_hexdigit)
                && bytes.get(index + 2).is_some_and(u8::is_ascii_hexdigit);
            if !valid_escape {
                return false;
            }
            index += 3;
        } else if is_userinfo_char(bytes[index]) {
            index += 1;
        } else {
            return false;
        }
    }
    true
}

fn is_valid_ipv4_octet(part: &str) -> bool {
    let bytes = part.as_bytes();
    let well_formed = match bytes.len() {
        1 => bytes[0].is_ascii_digit(),
        2 | 3 => {
            bytes[0].is_ascii_digit()
                && bytes[0] != b'0'
                && bytes[1..].iter().all(u8::is_ascii_digit)
        }
        _ => false,
    };
    well_formed && part.parse::<u16>().is_ok_and(|value| value <= 255)
}

fn is_valid_ipv4(value: &str) -> bool {
    let parts: Vec<&str> = value.split('.').collect();
    parts.len() == 4 && parts.iter().all(|part| is_valid_ipv4_octet(part))
}

fn is_hex_group(group: &str) -> bool {
    (1..=4).contains(&group.len()) && group.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn is_valid_ipv6(value: &str) -> bool {
    if !value.contains(':') {
        return false;
    }
    let compression = value.find("::");
    if compression != value.rfind("::") {
        return false;
    }

    let sides: Vec<&str> = match compression {
        None => vec![value],
        Some(index) => vec![&value[..index], &value[index + 2..]],
    };
    let groups: Vec<&str> = sides
        .into_iter()
        .filter(|side| !side.is_empty())
        .flat_map(|side| side.split(':'))
        .collect();
    if groups.iter().any(|group| group.is_empty()) {
        return false;
    }

    let last = groups.len().saturating_sub(1);
    let mut units = 0u32;
    for (index, group) in groups.iter().enumerate() {
        if group.contains('.') {
            if index != last || !is_valid_ipv4(group) {
                return false;
            }
            units += 2;
        } else {
            if !is_hex_group(group) {
                return false;
            }
            units += 1;
        }
    }
    if compression.is_none() {
        units == 8
    } else {
        units < 8
    }
}

fn is_valid_port(value: &str) -> bool {
    (1..=5).contains(&value.len())
        && value.bytes().all(|byte| byte.is_ascii_digit())
        && value.parse::<u32>().is_ok_and(|port| port <= 65_535)
}

fn is_reg_name_label(label: &str) -> bool {
    let bytes = label.as_bytes();
    !bytes.is_empty()
        && bytes[0].is_ascii_alphanumeric()
        && bytes[bytes.len() - 1].is_ascii_alphanumeric()
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'-')
}

fn is_reg_name(value: &str) -> bool {
    !value.is_empty() && value.split('.').all(is_reg_name_label)
}

fn has_valid_host_and_port(value: &str) -> bool {
    if let Some(rest) = value.strip_prefix('[') {
        return match rest.find(']') {
            None => false,
            Some(close) => {
                if !is_valid_ipv6(&rest[..close]) {
                    return false;
                }
                let suffix = &rest[close + 1..];
                suffix.is_empty() || (suffix.starts_with(':') && is_valid_port(&suffix[1..]))
            }
        };
    }

    match value.rfind(':') {
        None => is_reg_name(value),
        Some(separator) => {
            is_reg_name(&value[..separator]) && is_valid_port(&value[separator + 1..])
        }
    }
}

fn has_valid_mongo_host_list(value: &str) -> bool {
    value.split(',').all(has_valid_host_and_port)
}

fn has_valid_srv_host(value: &str) -> bool {
    !value.contains(',')
        && !value.contains(':')
        && is_reg_name(value)
        && value.split('.').count() >= 3
}

fn has_valid_host_for_scheme(scheme: &str, value: &str) -> bool {
    match scheme {
        "mongodb" => has_valid_mongo_host_list(value),
        "mongodb+srv" => has_valid_srv_host(value),
        _ => has_valid_host_and_port(value),
    }
}

/// Recognizes the password of a credential-bearing connection authority for
/// a bounded set of schemes.
pub struct ConnectionStringDetector;

impl Detector for ConnectionStringDetector {
    fn id(&self) -> &'static str {
        "connection-string"
    }

    fn detect(
        &self,
        input: &str,
        _context: &DetectorContext,
    ) -> Result<Vec<Candidate>, DetectorFailure> {
        let mut candidates = Vec::new();
        let mut position = 0;

        while let Some(scheme_match) = find_next_scheme(input, position) {
            position = scheme_match.end;

            if scheme_match.start > 0 && is_scheme_char(input.as_bytes()[scheme_match.start - 1]) {
                continue;
            }

            let user_info_start = scheme_match.end;
            let Some(authority_stop) = authority_end(input, user_info_start) else {
                continue;
            };
            let authority = &input[user_info_start..authority_stop];

            let Some(at) = single_at(authority) else {
                continue;
            };
            let user_info = &authority[..at];
            let scheme = scheme_match.scheme;
            let password_only_redis =
                user_info.find(':') == Some(0) && matches!(scheme, "redis" | "rediss");

            let separator = match user_info.find(':') {
                None => continue,
                Some(0) if !password_only_redis => continue,
                Some(separator) if separator == user_info.len() - 1 => continue,
                Some(separator) => separator,
            };

            let password = &user_info[separator + 1..];
            if password.len() > MAX_PASSWORD_LENGTH || is_placeholder(password) {
                continue;
            }
            if !has_valid_userinfo_encoding(user_info)
                || !has_valid_host_for_scheme(scheme, &authority[at + 1..])
            {
                continue;
            }

            let start = user_info_start + separator + 1;
            let end = start + password.len();
            let confidence = if password.len() >= 12 && shannon_entropy(password) >= 2.5 {
                Confidence::High
            } else {
                Confidence::Medium
            };

            let mut signals = vec!["credential-bearing-authority", "supported-scheme"];
            if password_only_redis {
                signals.push("redis-password-only");
            }
            if scheme == "mongodb" && authority.contains(',') {
                signals.push("mongodb-seed-list");
            }

            if let Some(range) = ByteRange::new(start, end) {
                candidates.push(
                    Candidate::new("connection_string_password", confidence, range)
                        .with_specificity(Specificity::Structural)
                        .with_signals(signals),
                );
            }
        }

        Ok(candidates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detect(input: &str) -> Vec<Candidate> {
        ConnectionStringDetector
            .detect(input, &DetectorContext::new(input.len()))
            .unwrap()
    }

    fn spans(candidates: &[Candidate]) -> Vec<(usize, usize)> {
        candidates
            .iter()
            .map(|c| (c.range().start(), c.range().end()))
            .collect()
    }

    #[test]
    fn selects_only_the_password_in_a_postgres_authority() {
        let input = "postgres://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost/db";
        let password_start = input.find("SYNTHETIC").unwrap();
        let found = detect(input);
        assert_eq!(
            spans(&found),
            [(password_start, input.len() - "@localhost/db".len())]
        );
        assert_eq!(found[0].type_name(), "connection_string_password");
        assert_eq!(found[0].effective_specificity(), Specificity::Structural);
    }

    #[test]
    fn selects_a_mongodb_seed_list_password_once() {
        let input = "mongodb://fixture:SYNTHETIC_REVOKED_DB_VALUE@db0.example.test:27017,db1.example.test:27018/db";
        let password_start = input.find("SYNTHETIC").unwrap();
        let password_end = password_start + "SYNTHETIC_REVOKED_DB_VALUE".len();
        assert_eq!(spans(&detect(input)), [(password_start, password_end)]);
    }

    #[test]
    fn rejects_srv_authorities_with_multiple_hosts() {
        let input =
            "mongodb+srv://fixture:SYNTHETIC_REVOKED_DB_VALUE@db0.example.test,db1.example.test/db";
        assert_eq!(detect(input), Vec::new());
    }

    #[test]
    fn selects_redis_password_only_authentication() {
        let input = "redis://:SYNTHETIC_REVOKED_DB_VALUE@cache.example.test:6379/0";
        let password_start = input.find("SYNTHETIC").unwrap();
        let found = detect(input);
        assert_eq!(
            spans(&found),
            [(
                password_start,
                password_start + "SYNTHETIC_REVOKED_DB_VALUE".len()
            )]
        );
        assert!(
            found[0]
                .signals()
                .contains(&"redis-password-only".to_string())
        );
    }

    #[test]
    fn requires_immediate_backtrack_between_prefix_schemes() {
        for (input, scheme) in [
            (
                "postgres://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost/db",
                "postgres",
            ),
            (
                "postgresql://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost/db",
                "postgresql",
            ),
            (
                "mysql://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost:3306/db",
                "mysql",
            ),
            (
                "mariadb://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost:3306/db",
                "mariadb",
            ),
            (
                "mongodb+srv://fixture:SYNTHETIC_REVOKED_DB_VALUE@cluster0.example.mongodb.net/db",
                "mongodb+srv",
            ),
            (
                "mongodb://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost:27017/db",
                "mongodb",
            ),
            (
                "redis://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost:6379/0",
                "redis",
            ),
            (
                "rediss://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost:6379/0",
                "rediss",
            ),
            (
                "amqp://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost/vh",
                "amqp",
            ),
            (
                "amqps://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost/vh",
                "amqps",
            ),
        ] {
            let found = detect(input);
            assert_eq!(found.len(), 1, "{input}");
            let _ = scheme;
        }
    }

    #[test]
    fn host_only_url_has_no_credential() {
        assert_eq!(detect("postgres://localhost/example"), Vec::new());
    }

    #[test]
    fn obvious_placeholder_is_ignored() {
        assert_eq!(
            detect("postgres://fixture:password@localhost/example"),
            Vec::new()
        );
    }

    #[test]
    fn empty_password_userinfo_is_ignored() {
        assert_eq!(detect("postgres://fixture:@localhost/example"), Vec::new());
    }

    #[test]
    fn malformed_percent_escape_invalidates_the_authority() {
        assert_eq!(
            detect("postgres://fixture:SYNTHETIC%GGREVOKED@localhost/example"),
            Vec::new()
        );
    }

    #[test]
    fn overlong_password_is_ignored_in_bounded_time() {
        let input = format!("postgres://fixture:{}@localhost/db", "A".repeat(100_000));
        assert_eq!(detect(&input), Vec::new());
    }

    #[test]
    fn overlong_malformed_authority_is_abandoned_after_a_fixed_bound() {
        let input = format!("postgres://fixture:{}@localhost/db", "%2".repeat(50_000));
        assert_eq!(detect(&input), Vec::new());
    }

    #[test]
    fn unsupported_scheme_is_ignored() {
        assert_eq!(
            detect("ftp://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost/db"),
            Vec::new()
        );
    }

    #[test]
    fn a_scheme_embedded_in_a_longer_identifier_is_ignored() {
        assert_eq!(
            detect("xmongodb://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost:27017/db"),
            Vec::new()
        );
    }

    #[test]
    fn id_is_stable() {
        assert_eq!(ConnectionStringDetector.id(), "connection-string");
    }

    // --- issue #108: deepened connection-string scheme and escaping coverage --
    //
    // `requires_immediate_backtrack_between_prefix_schemes` (above) now also
    // exercises `mysql`, `mariadb`, and `mongodb+srv` positive detection.
    // These tests deepen the remaining acceptance criteria: a valid mongodb+srv
    // DNS-seedlist host, IPv6 host validity at its accepted/rejected edge, a
    // Unicode host, and the reserved-delimiter escaping rules for `@` and `/`
    // in userinfo. `conformance/fixtures/synchronous-corpus.json` carries the
    // cross-language fixtures for the same behaviors, named per scheme.

    #[test]
    fn a_standard_mongodb_srv_host_is_recognized() {
        let input =
            "mongodb+srv://fixture:SYNTHETIC_REVOKED_DB_VALUE@cluster0.example.mongodb.net/db";
        let password_start = input.find("SYNTHETIC").unwrap();
        let found = detect(input);
        assert_eq!(
            spans(&found),
            [(
                password_start,
                password_start + "SYNTHETIC_REVOKED_DB_VALUE".len()
            )]
        );
    }

    #[test]
    fn ipv6_host_with_a_valid_hex_group_is_accepted() {
        let input = "postgres://fixture:SYNTHETIC_REVOKED_DB_VALUE@[2001:db8::1]:5432/db";
        assert_eq!(detect(input).len(), 1);
    }

    #[test]
    fn ipv6_host_with_a_non_hex_group_is_rejected() {
        assert_eq!(
            detect("postgres://fixture:SYNTHETIC_REVOKED_DB_VALUE@[2001:db8::g]/db"),
            Vec::new()
        );
    }

    #[test]
    fn a_unicode_host_label_is_not_an_ascii_reg_name_and_is_rejected() {
        assert_eq!(
            detect("postgres://fixture:SYNTHETIC_REVOKED_DB_VALUE@café.example.test/db"),
            Vec::new()
        );
    }

    #[test]
    fn an_unescaped_at_in_the_password_makes_the_authority_boundary_ambiguous() {
        assert_eq!(
            detect("redis://:pass@word@cache.example.test:6379/0"),
            Vec::new()
        );
    }

    #[test]
    fn an_unescaped_slash_in_the_password_ends_the_authority_before_its_at() {
        assert_eq!(detect("postgres://fixture:pa/ss@localhost/db"), Vec::new());
    }

    #[test]
    fn a_percent_encoded_reserved_delimiter_in_the_password_is_kept_undecoded() {
        let input = "postgres://fixture:SYNTHETIC%3AREVOKED@localhost/db";
        let password_start = input.find("SYNTHETIC").unwrap();
        let found = detect(input);
        assert_eq!(
            spans(&found),
            [(password_start, password_start + "SYNTHETIC%3AREVOKED".len())]
        );
    }

    #[test]
    fn a_query_string_with_no_path_terminates_the_authority() {
        let input = "postgres://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost?sslmode=require";
        assert_eq!(detect(input).len(), 1);
    }

    #[test]
    fn a_fragment_with_no_path_terminates_the_authority() {
        let input = "postgres://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost#primary";
        assert_eq!(detect(input).len(), 1);
    }

    #[test]
    fn a_port_above_the_valid_range_is_rejected() {
        assert_eq!(
            detect("postgres://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost:70000/db"),
            Vec::new()
        );
    }

    #[test]
    fn a_port_longer_than_five_digits_is_rejected() {
        assert_eq!(
            detect("postgres://fixture:SYNTHETIC_REVOKED_DB_VALUE@localhost:123456/db"),
            Vec::new()
        );
    }
}
