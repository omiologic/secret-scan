//! Ordered detector registry.
//!
//! Registration order is a pipeline input: it is the fourth overlap tie
//! breaker and it fixes the order in which detectors run. Built-in detectors
//! are always registered before custom ones.

use crate::detectors::built_in_detectors;
use crate::error::{SecretScanError, SecretScanErrorCode};
use crate::types::{Detector, is_identifier};

/// A detector together with the id captured at registration time.
///
/// The id is read exactly once so a detector whose `id()` is not stable
/// cannot change the public `detector` field of findings after validation.
pub struct RegisteredDetector {
    id: String,
    detector: Box<dyn Detector>,
}

impl RegisteredDetector {
    /// The validated id.
    #[must_use]
    pub fn id(&self) -> &str {
        &self.id
    }

    /// The registered detector.
    #[must_use]
    pub fn detector(&self) -> &dyn Detector {
        self.detector.as_ref()
    }
}

impl std::fmt::Debug for RegisteredDetector {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RegisteredDetector")
            .field("id", &self.id)
            .finish_non_exhaustive()
    }
}

/// An ordered, duplicate-free set of detectors.
#[derive(Debug, Default)]
pub struct DetectorRegistry {
    detectors: Vec<RegisteredDetector>,
}

impl DetectorRegistry {
    /// Creates an empty registry.
    #[must_use]
    pub const fn new() -> Self {
        Self {
            detectors: Vec::new(),
        }
    }

    /// Creates a registry holding every built-in detector in canonical
    /// order, followed by `custom` in the given order.
    ///
    /// This is the only way to reach the built-in detectors: which ones
    /// exist and how they are constructed is private, so it can change
    /// without breaking a caller. Their order is not: it is the fourth
    /// overlap tie breaker.
    ///
    /// # Examples
    ///
    /// ```
    /// use redact_secret::{DefaultPolicy, DetectorRegistry, scan};
    ///
    /// let registry = DetectorRegistry::with_built_in([])?;
    /// assert!(registry.contains("github-token"));
    ///
    /// let input = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000";
    /// assert_eq!(scan(input, &registry, &DefaultPolicy)?.len(), 1);
    ///
    /// // An empty registry detects nothing; it is not the built-in set.
    /// assert_eq!(scan(input, &DetectorRegistry::new(), &DefaultPolicy)?.len(), 0);
    /// # Ok::<(), redact_secret::SecretScanError>(())
    /// ```
    ///
    /// # Errors
    ///
    /// Returns [`SecretScanErrorCode::InvalidDetector`] when a custom
    /// detector has a malformed id or repeats an id that is already
    /// registered.
    pub fn with_built_in<I>(custom: I) -> Result<Self, SecretScanError>
    where
        I: IntoIterator<Item = Box<dyn Detector>>,
    {
        let mut registry = Self::new();
        for detector in built_in_detectors() {
            registry.register(detector)?;
        }
        for detector in custom {
            registry.register(detector)?;
        }
        Ok(registry)
    }

    /// Appends `detector`.
    ///
    /// # Errors
    ///
    /// Returns [`SecretScanErrorCode::InvalidDetector`] when the id does
    /// not satisfy [`is_identifier`] or is already registered. The registry
    /// is unchanged on error.
    pub fn register(&mut self, detector: Box<dyn Detector>) -> Result<&mut Self, SecretScanError> {
        let id = detector.id();
        if !is_identifier(id) || self.contains(id) {
            return Err(SecretScanErrorCode::InvalidDetector.into());
        }
        self.detectors.push(RegisteredDetector {
            id: id.to_owned(),
            detector,
        });
        Ok(self)
    }

    /// Detectors in registration order.
    #[must_use]
    pub fn detectors(&self) -> &[RegisteredDetector] {
        &self.detectors
    }

    /// Registered ids in registration order.
    pub fn ids(&self) -> impl Iterator<Item = &str> {
        self.detectors.iter().map(RegisteredDetector::id)
    }

    /// Number of registered detectors.
    #[must_use]
    pub fn len(&self) -> usize {
        self.detectors.len()
    }

    /// `true` when no detector is registered.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.detectors.is_empty()
    }

    /// `true` when a detector with `id` is registered.
    #[must_use]
    pub fn contains(&self, id: &str) -> bool {
        self.detectors.iter().any(|registered| registered.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::DetectorFailure;
    use crate::types::{Candidate, DetectorContext};

    struct Named(&'static str);

    impl Detector for Named {
        fn id(&self) -> &str {
            self.0
        }

        fn detect(&self, _: &str, _: &DetectorContext) -> Result<Vec<Candidate>, DetectorFailure> {
            Ok(Vec::new())
        }
    }

    #[test]
    fn preserves_registration_order() {
        let mut registry = DetectorRegistry::new();
        registry
            .register(Box::new(Named("zeta")))
            .unwrap()
            .register(Box::new(Named("alpha")))
            .unwrap()
            .register(Box::new(Named("mid.point-1_a")))
            .unwrap();
        assert_eq!(
            registry.ids().collect::<Vec<_>>(),
            ["zeta", "alpha", "mid.point-1_a"]
        );
        assert_eq!(registry.len(), 3);
        assert!(!registry.is_empty());
        assert!(registry.contains("alpha"));
        assert!(!registry.contains("beta"));
        assert_eq!(registry.detectors()[1].detector().id(), "alpha");
    }

    #[test]
    fn rejects_malformed_and_duplicate_ids() {
        let mut registry = DetectorRegistry::new();
        registry.register(Box::new(Named("dup"))).unwrap();
        for id in ["", "Dup", "dup", "1x", "a--b", "a-", " a"] {
            let error = registry.register(Box::new(Named(id))).unwrap_err();
            assert_eq!(error.code(), SecretScanErrorCode::InvalidDetector);
            assert_eq!(error.to_string(), "Invalid detector registration.");
        }
        assert_eq!(registry.len(), 1);
    }

    #[test]
    fn rejects_ids_over_the_length_limit() {
        let long = "a".repeat(crate::MAX_IDENTIFIER_LENGTH + 1).leak();
        let mut registry = DetectorRegistry::new();
        let error = registry.register(Box::new(Named(long))).unwrap_err();
        assert_eq!(error.code(), SecretScanErrorCode::InvalidDetector);
    }

    #[test]
    fn built_in_come_first() {
        let registry =
            DetectorRegistry::with_built_in([Box::new(Named("custom")) as Box<dyn Detector>])
                .unwrap();
        let built_in: Vec<String> = built_in_detectors()
            .iter()
            .map(|d| d.id().to_owned())
            .collect();
        let ids: Vec<&str> = registry.ids().collect();
        assert_eq!(ids.len(), built_in.len() + 1);
        assert_eq!(ids[..built_in.len()], built_in);
        assert_eq!(ids[built_in.len()], "custom");
    }

    #[test]
    fn debug_output_shows_only_ids() {
        let mut registry = DetectorRegistry::new();
        registry.register(Box::new(Named("only"))).unwrap();
        let rendered = format!("{registry:?}");
        assert!(rendered.contains("only"));
        assert!(rendered.contains(".."));
    }
}
