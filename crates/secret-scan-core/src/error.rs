//! Sanitized public errors.
//!
//! Every failure that crosses the crate boundary is a [`SecretScanError`]
//! carrying only a fixed [`SecretScanErrorCode`]. The code selects a fixed
//! message; nothing about the input, a candidate, or a matched value is ever
//! attached. Bindings surface the code string and message verbatim so every
//! host reports identical, input-free diagnostics.

use std::fmt;

/// Fixed public error codes.
///
/// The string form ([`as_str`](Self::as_str)) and the message
/// ([`message`](Self::message)) are part of the cross-language contract and
/// must not change without a corpus review.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum SecretScanErrorCode {
    /// The host passed something other than a text input. The core itself
    /// only accepts `&str`, so this code is produced by bindings.
    InvalidInput,
    /// Scan options could not be interpreted. Produced by bindings that accept
    /// dynamically typed option objects.
    InvalidOptions,
    /// A detector registration was rejected: malformed or duplicate id.
    InvalidDetector,
    /// A detector reported a failure while scanning.
    DetectorFailure,
    /// A detector returned a candidate that violates the candidate contract.
    InvalidCandidate,
    /// The policy reported a failure while evaluating a finding.
    PolicyFailure,
    /// A policy returned something that is not one of the four actions.
    /// The Rust [`Action`](crate::Action) enum cannot express this, so this
    /// code is produced by bindings that accept dynamically typed actions.
    InvalidPolicyAction,
}

impl SecretScanErrorCode {
    /// Every code, in declaration order.
    pub const ALL: [Self; 7] = [
        Self::InvalidInput,
        Self::InvalidOptions,
        Self::InvalidDetector,
        Self::DetectorFailure,
        Self::InvalidCandidate,
        Self::PolicyFailure,
        Self::InvalidPolicyAction,
    ];

    /// The stable `SCREAMING_SNAKE_CASE` code string.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InvalidInput => "INVALID_INPUT",
            Self::InvalidOptions => "INVALID_OPTIONS",
            Self::InvalidDetector => "INVALID_DETECTOR",
            Self::DetectorFailure => "DETECTOR_FAILURE",
            Self::InvalidCandidate => "INVALID_CANDIDATE",
            Self::PolicyFailure => "POLICY_FAILURE",
            Self::InvalidPolicyAction => "INVALID_POLICY_ACTION",
        }
    }

    /// The fixed, input-free message for this code.
    #[must_use]
    pub const fn message(self) -> &'static str {
        match self {
            Self::InvalidInput => "Secret scan input must be a string.",
            Self::InvalidOptions => "Secret scan options are invalid.",
            Self::InvalidDetector => "Invalid detector registration.",
            Self::DetectorFailure => "A secret detector failed.",
            Self::InvalidCandidate => "A secret detector returned an invalid candidate.",
            Self::PolicyFailure => "The secret policy failed.",
            Self::InvalidPolicyAction => "The secret policy returned an invalid action.",
        }
    }
}

impl fmt::Display for SecretScanErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A sanitized scan error. It holds nothing but its code.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct SecretScanError {
    code: SecretScanErrorCode,
}

impl SecretScanError {
    /// Creates an error for `code`.
    #[must_use]
    pub const fn new(code: SecretScanErrorCode) -> Self {
        Self { code }
    }

    /// The error code.
    #[must_use]
    pub const fn code(self) -> SecretScanErrorCode {
        self.code
    }

    /// The fixed message; identical to the `Display` output.
    #[must_use]
    pub const fn message(self) -> &'static str {
        self.code.message()
    }
}

impl From<SecretScanErrorCode> for SecretScanError {
    fn from(code: SecretScanErrorCode) -> Self {
        Self::new(code)
    }
}

impl fmt::Display for SecretScanError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.message())
    }
}

impl std::error::Error for SecretScanError {}

/// Opaque failure reported by a [`Detector`](crate::Detector).
///
/// It carries no payload by design: a detector that fails cannot leak the
/// substring it was inspecting. The pipeline maps it to
/// [`SecretScanErrorCode::DetectorFailure`].
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub struct DetectorFailure;

/// Opaque failure reported by a [`Policy`](crate::Policy).
///
/// The pipeline maps it to [`SecretScanErrorCode::PolicyFailure`].
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub struct PolicyFailure;

/// Opaque failure reported by a [`PlaceholderFormatter`](crate::PlaceholderFormatter).
///
/// Redaction maps it to its own fixed placeholder-failure code.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub struct FormatterFailure;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_and_messages_are_fixed() {
        let expected = [
            ("INVALID_INPUT", "Secret scan input must be a string."),
            ("INVALID_OPTIONS", "Secret scan options are invalid."),
            ("INVALID_DETECTOR", "Invalid detector registration."),
            ("DETECTOR_FAILURE", "A secret detector failed."),
            (
                "INVALID_CANDIDATE",
                "A secret detector returned an invalid candidate.",
            ),
            ("POLICY_FAILURE", "The secret policy failed."),
            (
                "INVALID_POLICY_ACTION",
                "The secret policy returned an invalid action.",
            ),
        ];
        for (code, (name, message)) in SecretScanErrorCode::ALL.into_iter().zip(expected) {
            assert_eq!(code.as_str(), name);
            assert_eq!(code.message(), message);
            assert_eq!(code.to_string(), name);
            let error = SecretScanError::new(code);
            assert_eq!(error.code(), code);
            assert_eq!(error.to_string(), message);
            assert_eq!(
                format!("{error:?}"),
                format!("SecretScanError {{ code: {code:?} }}")
            );
        }
    }

    #[test]
    fn opaque_failures_carry_nothing() {
        assert_eq!(std::mem::size_of::<DetectorFailure>(), 0);
        assert_eq!(std::mem::size_of::<PolicyFailure>(), 0);
        assert_eq!(std::mem::size_of::<FormatterFailure>(), 0);
        assert_eq!(std::mem::size_of::<SecretScanError>(), 1);
    }
}
