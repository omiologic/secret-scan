//! Sanitized error mapping between [`secret_scan::SecretScanError`] and the
//! JavaScript error contract (`decision-define-runtime-bindings`).
//!
//! Every thrown error carries the core's fixed `SCREAMING_SNAKE_CASE` code as
//! its `code` property and the core's fixed message as `message`. No thrown
//! error carries input or a matched value.

use napi::Error as NapiError;
use secret_scan::SecretScanError;

/// The JavaScript error type this crate throws: `status` (surfaced to
/// JavaScript as `code`) carries the fixed [`secret_scan::SecretScanErrorCode`]
/// string instead of a generic N-API status name.
pub type JsError = NapiError<String>;

/// Converts a sanitized core error into the JavaScript error contract.
#[must_use]
pub fn to_js_error(error: SecretScanError) -> JsError {
    NapiError::new(error.code().as_str().to_owned(), error.message().to_owned())
}

#[cfg(test)]
mod tests {
    use secret_scan::SecretScanErrorCode;

    use super::*;

    #[test]
    fn carries_the_fixed_code_and_message() {
        let error = to_js_error(SecretScanErrorCode::InvalidFindings.into());
        assert_eq!(error.status, "INVALID_FINDINGS");
        assert_eq!(error.reason, "Redaction findings are invalid.");
    }
}
