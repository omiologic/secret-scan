//! Built-in detectors in canonical registration order.
//!
//! The order of the list returned by [`built_in_detectors`] is a public
//! contract: it is the registry order used as an overlap tie breaker, so it
//! must match the TypeScript oracle and the conformance corpus. Provider and
//! structural (private-key, connection-string) detectors are ported in
//! follow-up work.

mod bearer_token;
mod generic_token;
mod jwt;
mod text;

use crate::types::Detector;

/// Every built-in detector, in canonical registration order.
#[must_use]
pub fn built_in_detectors() -> Vec<Box<dyn Detector>> {
    vec![
        jwt::jwt_detector(),
        bearer_token::bearer_token_detector(),
        generic_token::generic_token_detector(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::is_identifier;

    #[test]
    fn built_in_ids_are_valid_and_unique() {
        let detectors = built_in_detectors();
        let mut ids: Vec<&str> = detectors.iter().map(|d| d.id()).collect();
        assert!(ids.iter().all(|id| is_identifier(id)));
        let count = ids.len();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), count);
    }
}
