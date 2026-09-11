//! Safe, input-free CLI failures.
//!
//! Every failure the binary can report carries a fixed code and a fixed
//! message. No failure carries argument text, input, a matched value, or an
//! operating-system message that might quote either.

use redact_secret::{SecretScanError, SecretScanErrorCode};

/// The command line named an option the binary does not accept.
pub const UNKNOWN_OPTION: &str = "unrecognized option";
/// `--help` or `--version` appeared alongside another argument.
pub const SOLE_OPTION: &str = "--help and --version take no other arguments";
/// `--json` reports check findings, so it cannot describe a redaction.
pub const JSON_WITH_REDACT: &str = "--json is a check option and cannot be combined with --redact";
/// `--redact` writes one sanitized stream, so it reads one input.
pub const REDACT_ONE_PATH: &str = "--redact reads standard input or exactly one path";

/// A failure the CLI reports to its host.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Failure {
    /// The command line could not be interpreted. The payload is one of the
    /// fixed reasons in this module, never text taken from the arguments.
    Usage(&'static str),
    /// The input was not valid UTF-8. The bytes that proved it are dropped
    /// rather than reported.
    NotUtf8,
    /// Reading the input failed, including a partial or interrupted read
    /// that could not be resumed.
    ReadFailed,
    /// Writing the output failed, including a closed downstream pipe.
    WriteFailed,
    /// The core rejected the run. Core codes and messages are already
    /// sanitized, so they pass through unchanged.
    Core(SecretScanErrorCode),
}

impl Failure {
    /// The stable `SCREAMING_SNAKE_CASE` code a machine consumer matches on.
    pub const fn code(self) -> &'static str {
        match self {
            Self::Usage(_) => "USAGE",
            Self::NotUtf8 => "NOT_UTF8",
            Self::ReadFailed => "READ_FAILED",
            Self::WriteFailed => "WRITE_FAILED",
            Self::Core(code) => code.as_str(),
        }
    }

    /// The fixed, input-free message for this failure.
    pub const fn message(self) -> &'static str {
        match self {
            Self::Usage(reason) => reason,
            Self::NotUtf8 => "Input is not valid UTF-8.",
            Self::ReadFailed => "Reading the input failed.",
            Self::WriteFailed => "Writing the output failed.",
            Self::Core(code) => code.message(),
        }
    }
}

impl From<SecretScanError> for Failure {
    fn from(error: SecretScanError) -> Self {
        Self::Core(error.code())
    }
}

impl From<SecretScanErrorCode> for Failure {
    fn from(code: SecretScanErrorCode) -> Self {
        Self::Core(code)
    }
}
