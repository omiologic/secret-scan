//! Reconciles `docs/coverage/detector-inventory.json` (issue #101's declared
//! baseline, tracking-key `dacd-f1-t1`) against the real built-in registry
//! and [`DefaultPolicy`], entirely through the crate's public API.
//!
//! A detector, an emitted finding type, or a policy classification cannot
//! drift from the declared inventory unnoticed: this test finds each
//! declared detector through [`DetectorRegistry::with_built_in`], drives it
//! with the declared `reconciliationTrigger`, and asserts the resulting
//! candidate carries the declared type. Policy classification is derived
//! only by calling [`DefaultPolicy::evaluate`] at `high` and `medium`
//! confidence, never by reading `secret-scan-core`'s private
//! `ALWAYS_REDACT_TYPES`, so this test exercises exactly the contract an
//! external caller observes.
//!
//! Lives in `tests/`, not `src/`, so it can `include_str!` the manifest:
//! `scripts/check-rust-workspace.py` forbids that macro anywhere under the
//! core crate's `src/` as runtime-I/O-shaped, even behind `#[cfg(test)]`.

#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::collections::BTreeSet;

use secret_scan::{
    Action, ByteRange, Confidence, DefaultPolicy, DetectedFinding, DetectorContext,
    DetectorRegistry, Policy, PolicyContext,
};
use serde_json::Value;

const MANIFEST: &str = include_str!("../../../docs/coverage/detector-inventory.json");

fn action_for(type_name: &str, detector: &str, confidence: Confidence) -> Action {
    let range = ByteRange::new(0, 1).unwrap();
    let finding = DetectedFinding::new("finding-1", type_name, detector, confidence, range)
        .expect("declared type/detector names must be valid identifiers");
    DefaultPolicy
        .evaluate(&finding, &PolicyContext::new(0, 1))
        .expect("DefaultPolicy is infallible")
}

#[test]
fn built_in_inventory_matches_the_declared_baseline() {
    let manifest: Value = serde_json::from_str(MANIFEST)
        .expect("docs/coverage/detector-inventory.json must be valid JSON");
    let declared = manifest["types"]
        .as_array()
        .expect("manifest must declare a types array");

    let registry = DetectorRegistry::with_built_in([]).expect("built-in registration cannot fail");
    let declared_ids: BTreeSet<&str> = declared
        .iter()
        .map(|entry| entry["detector"].as_str().expect("detector id"))
        .collect();
    let actual_ids: BTreeSet<&str> = registry.ids().collect();
    assert_eq!(
        declared_ids, actual_ids,
        "docs/coverage/detector-inventory.json must declare exactly the ids DetectorRegistry::with_built_in registers"
    );

    let mut declared_types: Vec<&str> = declared
        .iter()
        .map(|entry| entry["type"].as_str().expect("type name"))
        .collect();
    let type_count = declared_types.len();
    declared_types.sort_unstable();
    declared_types.dedup();
    assert_eq!(
        declared_types.len(),
        type_count,
        "declared finding types must be unique"
    );

    for entry in declared {
        let id = entry["detector"].as_str().unwrap();
        let type_name = entry["type"].as_str().unwrap();
        let policy_class = entry["policyClass"].as_str().unwrap();
        let trigger = entry["reconciliationTrigger"]
            .as_str()
            .expect("every declared type must carry a reconciliationTrigger string");

        let registered = registry
            .detectors()
            .iter()
            .find(|registered| registered.id() == id)
            .expect(
                "every declared detector id must be registered by DetectorRegistry::with_built_in",
            );
        let context = DetectorContext::new(trigger.len());
        let candidates = registered.detector().detect(trigger, &context).unwrap();
        assert!(
            candidates
                .iter()
                .any(|candidate| candidate.type_name() == type_name),
            "{id}'s reconciliationTrigger did not produce a {type_name} candidate: {candidates:?}"
        );

        let high = action_for(type_name, id, Confidence::High);
        let medium = action_for(type_name, id, Confidence::Medium);
        let observed_class = if high == Action::Block {
            "block"
        } else if high == Action::Redact && medium == Action::Redact {
            "always-redact"
        } else if high == Action::Redact && medium == Action::Warn {
            "confidence-gated"
        } else {
            "unrecognized"
        };
        assert_eq!(
            observed_class, policy_class,
            "{type_name}: declared policyClass {policy_class:?} does not match DefaultPolicy's observed actions (high={high:?}, medium={medium:?})"
        );
    }
}
