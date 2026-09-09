//! Built-in detectors in canonical registration order.
//!
//! The order of the list returned by [`built_in_detectors`] is a public
//! contract: it is the registry order used as an overlap tie breaker, so it
//! must match the TypeScript oracle and the conformance corpus
//! (`src/detectors/index.ts`'s `builtInDetectors`). Provider and contextual
//! detectors are ported in follow-up work; until then only the private-key
//! and connection-string parsers run as built-ins.

mod connection_string;
mod private_key;

use crate::types::Detector;
use connection_string::ConnectionStringDetector;
use private_key::PrivateKeyDetector;

/// Every built-in detector, in canonical registration order.
#[must_use]
pub fn built_in_detectors() -> Vec<Box<dyn Detector>> {
    vec![
        Box::new(PrivateKeyDetector),
        Box::new(ConnectionStringDetector),
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
