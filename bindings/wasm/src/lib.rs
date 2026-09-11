//! Browser WebAssembly binding for the `redact-secret` core, built with
//! `wasm-bindgen` (`decision-define-runtime-bindings`).
//!
//! - Every synchronous operation ([`scan`], [`redact`], [`scan_and_redact`])
//!   requires a prior successful [`initialize`] call. `initialize` is
//!   idempotent and reports a fixed, input-free error if it ever fails; a
//!   call made before it has succeeded fails the same way, before touching
//!   its input.
//! - Ranges exposed here (see [`RangeJs`]) use UTF-16 code units; conversion
//!   from the core's UTF-8 byte offsets happens in the private `range`
//!   module without
//!   changing the selected span
//!   (`decision-govern-cross-language-conformance`).
//! - A custom `policy` or `formatter` callback ([`scan`], [`redact`],
//!   [`scan_and_redact`]) receives only the safe metadata the private
//!   `metadata` module builds; it never sees the scanned input or a matched
//!   value, and any
//!   failure (a thrown exception or an unexpected return value) becomes a
//!   fixed, input-free error, never the exception's own message.
//! - This crate's dependency graph contains only `wasm-bindgen`, `js-sys`,
//!   and the core: nothing Node-only, so it builds and runs for
//!   `wasm32-unknown-unknown` in any browser.

mod callbacks;
mod error;
mod finding;
mod lifecycle;
mod metadata;
mod range;
mod result;
mod util;

use js_sys::Function;
use redact_secret::{
    DefaultPolicy, DetectorRegistry, Finding, SecretScanError, default_placeholder_formatter,
};
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;

pub use finding::{FindingJs, RangeJs};
pub use result::ScanAndRedactResultJs;

use error::to_js_error;

/// Returns the shared product version.
#[wasm_bindgen]
#[must_use]
pub fn version() -> String {
    redact_secret::VERSION.to_owned()
}

/// Idempotently initializes the module: builds and caches the built-in
/// detector registry. Every later call, whether or not the first one
/// succeeded, returns the same cached result without rebuilding it.
///
/// # Errors
///
/// Returns a fixed, input-free `INITIALIZATION_FAILED` error when the
/// registry cannot be built.
#[wasm_bindgen]
pub fn initialize() -> Result<(), JsValue> {
    lifecycle::initialize().map_err(to_js_error)
}

fn run_scan(
    input: &str,
    registry: &DetectorRegistry,
    policy: Option<&Function>,
) -> Result<Vec<Finding>, SecretScanError> {
    match policy {
        Some(function) => {
            redact_secret::scan(input, registry, &callbacks::JsPolicy::new(input, function))
        }
        None => redact_secret::scan(input, registry, &DefaultPolicy),
    }
}

fn run_redact(
    input: &str,
    findings: &[Finding],
    formatter: Option<&Function>,
) -> Result<String, SecretScanError> {
    match formatter {
        Some(function) => redact_secret::redact(
            input,
            findings,
            &callbacks::JsPlaceholderFormatter::new(input, function),
        ),
        None => redact_secret::redact(input, findings, &default_placeholder_formatter),
    }
}

/// [`lifecycle::with_registry`] plus [`run_scan`], flattened into the one
/// `JsValue` error every exported function reports.
fn scan_after_initialize(input: &str, policy: Option<&Function>) -> Result<Vec<Finding>, JsValue> {
    lifecycle::with_registry(|registry| run_scan(input, registry, policy))
        .map_err(to_js_error)?
        .map_err(|error| to_js_error(error.into()))
}

/// Scans `input` for secrets, in registration order with the documented
/// overlap precedence, and evaluates `policy` (or the built-in default
/// policy when `policy` is omitted) once per finding.
///
/// `policy`, when given, is called as `policy(findingMetadata, context)` and
/// must return one of `"redact"`, `"block"`, `"warn"`, or `"allow"`.
///
/// # Errors
///
/// Returns a fixed `NOT_INITIALIZED` error, without inspecting `input`, when
/// [`initialize`] has not yet succeeded. Otherwise returns the sanitized,
/// input-free error the core pipeline or a failing `policy` call produces.
// `policy` cannot be `Option<&Function>`: wasm-bindgen only implements
// `FromWasmAbi` for owned imported types across an exported function
// boundary, so this crate takes ownership at every such boundary and
// borrows internally instead.
#[allow(clippy::needless_pass_by_value)]
#[wasm_bindgen]
pub fn scan(input: &str, policy: Option<Function>) -> Result<Vec<FindingJs>, JsValue> {
    let findings = scan_after_initialize(input, policy.as_ref())?;
    Ok(findings
        .into_iter()
        .map(|finding| FindingJs::new(input, finding))
        .collect())
}

/// Redacts `input` using `findings` (as returned by [`scan`] for the same
/// `input`), replacing every `redact`/`block` finding's span with a
/// placeholder from `formatter` (or the built-in default formatter when
/// `formatter` is omitted).
///
/// `formatter`, when given, is called as `formatter(findingMetadata,
/// context)` and must return the placeholder string.
///
/// # Errors
///
/// Returns a fixed `NOT_INITIALIZED` error, without inspecting `input`, when
/// [`initialize`] has not yet succeeded. Otherwise returns the sanitized,
/// input-free error the core redaction pass or a failing `formatter` call
/// produces.
#[allow(clippy::needless_pass_by_value)]
#[wasm_bindgen]
pub fn redact(
    input: &str,
    findings: Vec<FindingJs>,
    formatter: Option<Function>,
) -> Result<String, JsValue> {
    lifecycle::ensure_initialized().map_err(to_js_error)?;
    let findings: Vec<Finding> = findings.into_iter().map(FindingJs::into_inner).collect();
    run_redact(input, &findings, formatter.as_ref()).map_err(|error| to_js_error(error.into()))
}

/// Scans `input`, then redacts it with the resulting findings, in one call.
/// Equivalent to calling [`scan`] followed by [`redact`] with its result, but
/// without a round trip through JavaScript for the intermediate findings.
///
/// # Errors
///
/// The same as [`scan`] and [`redact`].
#[allow(clippy::needless_pass_by_value)]
#[wasm_bindgen(js_name = "scanAndRedact")]
pub fn scan_and_redact(
    input: &str,
    policy: Option<Function>,
    formatter: Option<Function>,
) -> Result<ScanAndRedactResultJs, JsValue> {
    let findings = scan_after_initialize(input, policy.as_ref())?;
    let text = run_redact(input, &findings, formatter.as_ref())
        .map_err(|error| to_js_error(error.into()))?;
    let findings = findings
        .into_iter()
        .map(|finding| FindingJs::new(input, finding))
        .collect();
    Ok(ScanAndRedactResultJs::new(text, findings))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A synthetic AWS-shaped access key ahead of an astral (supplementary
    /// plane) character, exercising the same evidence
    /// `conformance/fixtures/unicode-conversion-corpus.json` documents
    /// (`decision-govern-cross-language-conformance`) through the full
    /// `scan`/`redact` surface rather than the isolated range conversion.
    fn synthetic_input() -> String {
        format!("prefix \u{1F511} AKIA{} suffix", "SYNTHETICEXAMPLE")
    }

    /// Canonical synchronous conformance, exercised through the exported
    /// `scan`/`redact`/`scanAndRedact` functions themselves (with no custom
    /// `policy`/`formatter`, so no JavaScript callback is invoked and this
    /// runs on a native host, not just `wasm32`): the built-in AWS detector
    /// fires, the default policy redacts a `Confidence::High`
    /// `aws_access_key_id` finding (`ALWAYS_REDACT_TYPES` in
    /// `redact_secret::policy`), and the default formatter replaces it with
    /// `<SECRET_1>` — deterministically, on every call, for the same input,
    /// whether `scan` and `redact` are called separately or as one
    /// `scanAndRedact` call.
    #[test]
    fn scan_and_redact_agree_on_a_canonical_synthetic_finding() {
        initialize().unwrap();
        let input = synthetic_input();

        let findings = scan(&input, None).unwrap();
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].type_name(), "aws_access_key_id");
        assert_eq!(findings[0].action(), "redact");

        let output = redact(&input, findings, None).unwrap();
        assert_eq!(output, "prefix \u{1F511} <SECRET_1> suffix");

        let combined = scan_and_redact(&input, None, None).unwrap();
        assert_eq!(combined.text(), output);
        assert_eq!(combined.findings().len(), 1);
        assert_eq!(combined.findings()[0].type_name(), "aws_access_key_id");
    }

    /// The finding's range converts to UTF-16 code units without changing
    /// the selected span, even with the astral character positioned before
    /// the match.
    #[test]
    fn finding_range_uses_utf16_offsets_end_to_end() {
        initialize().unwrap();
        let input = synthetic_input();
        let findings = scan(&input, None).unwrap();
        let range = findings[0].range();

        let utf16: Vec<u16> = input.encode_utf16().collect();
        let matched =
            String::from_utf16(&utf16[range.start() as usize..range.end() as usize]).unwrap();
        assert_eq!(matched, format!("AKIA{}", "SYNTHETICEXAMPLE"));
    }

    /// A call made before `initialize()` succeeds fails deterministically,
    /// through `lifecycle::ensure_initialized`/`with_registry`, before ever
    /// reaching the detector pipeline or touching `input`
    /// (`decision-define-runtime-bindings`). This is asserted directly on
    /// `lifecycle`, which never calls into JavaScript, rather than on `scan`/
    /// `redact` themselves: their own `NOT_INITIALIZED` error path builds a
    /// JavaScript `Error` object, which — like every other JavaScript call
    /// this crate makes — only runs under `wasm32`, not a native `cargo
    /// test`. `error::tests::js_error_carries_the_fixed_code_and_message_and_nothing_else`
    /// (a `wasm_bindgen_test`, run under `wasm32`) covers that JavaScript
    /// error shape directly.
    #[test]
    fn calls_before_initialize_fail_without_touching_input_or_the_registry() {
        assert_eq!(
            lifecycle::ensure_initialized().unwrap_err(),
            error::WasmErrorCode::NotInitialized
        );
    }

    /// A custom `policy`/`formatter` pair through the exported `scan` and
    /// `redact` functions themselves, not just the internal `JsPolicy`/
    /// `JsPlaceholderFormatter` wrappers (`callbacks::tests` exercises those
    /// directly). Only runs under `wasm32`: `js_sys::Function::new_with_args`
    /// builds a real JavaScript function.
    #[wasm_bindgen_test::wasm_bindgen_test]
    fn scan_and_redact_accept_custom_policy_and_formatter_callbacks() {
        initialize().unwrap();
        let input = synthetic_input();

        let policy = Function::new_with_args("finding, context", "return 'block';");
        let findings = scan(&input, Some(policy)).unwrap();
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].action(), "block");

        let formatter = Function::new_with_args(
            "finding, context",
            "return '[REDACTED:' + finding.type + ']';",
        );
        let output = redact(&input, findings, Some(formatter)).unwrap();
        assert_eq!(
            output,
            "prefix \u{1F511} [REDACTED:aws_access_key_id] suffix"
        );
    }
}
