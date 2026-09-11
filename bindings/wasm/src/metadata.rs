//! Safe metadata JavaScript objects for policy and placeholder-formatter
//! callbacks (`decision-define-runtime-bindings`).
//!
//! Every object built here is assembled field by field from a
//! [`DetectedFinding`], [`Finding`], [`PolicyContext`], or
//! [`PlaceholderContext`]: normalized safe metadata only. None of them ever
//! carries the scanned input or a matched value, so a custom policy or
//! formatter callback cannot see either.

use js_sys::{Object, Reflect};
use redact_secret::{DetectedFinding, Finding, PlaceholderContext, PolicyContext};
use wasm_bindgen::JsValue;

use crate::range;
use crate::util::saturating_u32;

fn set(object: &Object, key: &str, value: &JsValue) -> Result<(), JsValue> {
    Reflect::set(object, &JsValue::from_str(key), value).map(|_| ())
}

/// Builds `{ id, type, detector, confidence, range: { start, end } }` for
/// `finding`, with `range` converted to UTF-16 code units for `input`.
fn detected_finding_object(input: &str, finding: &DetectedFinding) -> Result<Object, JsValue> {
    let object = Object::new();
    set(&object, "id", &JsValue::from_str(finding.id()))?;
    set(&object, "type", &JsValue::from_str(finding.type_name()))?;
    set(&object, "detector", &JsValue::from_str(finding.detector()))?;
    set(
        &object,
        "confidence",
        &JsValue::from_str(finding.confidence().as_str()),
    )?;

    let (start, end) = range::to_utf16_range(input, finding.range());
    let range_object = Object::new();
    set(&range_object, "start", &JsValue::from_f64(f64::from(start)))?;
    set(&range_object, "end", &JsValue::from_f64(f64::from(end)))?;
    set(&object, "range", &range_object.into())?;

    Ok(object)
}

/// Builds the safe metadata a policy callback receives: `finding`'s fields,
/// with no `action` (the policy has not chosen one yet).
pub(crate) fn policy_finding(input: &str, finding: &DetectedFinding) -> Result<JsValue, JsValue> {
    Ok(detected_finding_object(input, finding)?.into())
}

/// Builds `{ findingIndex, findingCount }` for `context`.
pub(crate) fn policy_context(context: PolicyContext) -> Result<JsValue, JsValue> {
    let object = Object::new();
    set(
        &object,
        "findingIndex",
        &JsValue::from_f64(f64::from(saturating_u32(context.finding_index()))),
    )?;
    set(
        &object,
        "findingCount",
        &JsValue::from_f64(f64::from(saturating_u32(context.finding_count()))),
    )?;
    Ok(object.into())
}

/// Builds the safe metadata a placeholder-formatter callback receives:
/// `finding`'s fields plus the `action` the policy already chose.
pub(crate) fn formatter_finding(input: &str, finding: &Finding) -> Result<JsValue, JsValue> {
    let object = detected_finding_object(input, finding.detected())?;
    set(
        &object,
        "action",
        &JsValue::from_str(finding.action().as_str()),
    )?;
    Ok(object.into())
}

/// Builds `{ placeholderIndex }` for `context`.
pub(crate) fn placeholder_context(context: PlaceholderContext) -> Result<JsValue, JsValue> {
    let object = Object::new();
    set(
        &object,
        "placeholderIndex",
        &JsValue::from_f64(f64::from(saturating_u32(context.placeholder_index()))),
    )?;
    Ok(object.into())
}
