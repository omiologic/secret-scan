//! Deterministic secret detection and redaction core.
//!
//! This crate is the canonical implementation that every language binding
//! translates to (`decision-adopt-rust-core-monorepo`). It uses `std` but is
//! side-effect free by policy:
//!
//! - no runtime network access,
//! - no filesystem access,
//! - no process-environment lookup,
//! - no telemetry or logging sinks,
//! - no secret storage,
//! - no user interface.
//!
//! The crate-level lints below make the policy visible at compile time, and
//! `scripts/check-rust-workspace.py` rejects dependencies that would breach it.
//! Ranges reported by this crate use UTF-8 byte offsets; each binding converts
//! them to its documented native unit (`decision-define-runtime-bindings`).
//!
//! # Pipeline contract
//!
//! [`run_detector_pipeline`] runs every detector in a [`DetectorRegistry`]
//! in registration order, validates each [`Candidate`], resolves overlapping
//! candidates with the documented precedence (specificity, confidence,
//! narrower span, registration order, emission order), and numbers the
//! disjoint survivors by input offset. [`scan`] then evaluates a [`Policy`]
//! once per finding. Identical input and configuration always produce
//! identical findings and ids.
//!
//! Every failure is a [`SecretScanError`] with a fixed code and message and
//! no payload; no public value carries an input fragment or a matched value.
//!
//! [`redact`] then applies [`Finding`] actions to the input in one ordered
//! pass, replacing `redact`/`block` ranges with placeholders from a
//! [`PlaceholderFormatter`] and validating that formatter's output.
//!
//! # Incremental sanitization contract
//!
//! [`IncrementalSanitizer`] runs the same built-in detectors, default
//! policy, and redaction over text supplied in chunks. It is a bounded,
//! four-state session (`accepting`, `finalized`, `aborted`, `failed`) that
//! emits only text whose detection window is closed, never rescans
//! finalized input, and accepts input independently of how a caller
//! partitions it into chunks. See the module documentation for the full
//! contract.
//!
//! Until the Rust core passes the shared conformance corpus, the
//! TypeScript implementation in `src/` remains the behavioral oracle
//! (`decision-govern-cross-language-conformance`).

#![forbid(unsafe_code)]
#![deny(clippy::print_stdout, clippy::print_stderr)]
#![deny(missing_docs)]

pub mod detectors;
mod entropy;
mod error;
mod incremental;
mod pipeline;
mod policy;
mod redact;
mod registry;
mod types;

pub use entropy::shannon_entropy;
pub use error::{
    DetectorFailure, FormatterFailure, PolicyFailure, SecretScanError, SecretScanErrorCode,
};
pub use incremental::{
    INCREMENTAL_LOOKAROUND_BYTES, IncrementalLimits, IncrementalPolicy, IncrementalPolicyContext,
    IncrementalResult, IncrementalSanitizer, SessionState,
};
pub use pipeline::{run_detector_pipeline, scan};
pub use policy::DefaultPolicy;
pub use redact::{
    MAX_PLACEHOLDER_LENGTH, default_placeholder_formatter, redact, typed_placeholder_formatter,
};
pub use registry::{DetectorRegistry, RegisteredDetector};
pub use types::{
    Action, ByteRange, Candidate, Confidence, DetectedFinding, Detector, DetectorContext, Finding,
    MAX_IDENTIFIER_LENGTH, PlaceholderContext, PlaceholderFormatter, Policy, PolicyContext,
    Specificity, is_identifier,
};

/// The shared product version. Every crate, binding, and package in the
/// workspace reports the same version (`decision-release-bindings-in-lockstep`).
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// The string-index unit used by every range this crate reports.
///
/// Bindings convert to their host unit without changing the selected span:
/// JavaScript uses UTF-16 code units and Python uses Unicode code points.
pub const RANGE_UNIT: &str = "utf8-bytes";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_matches_manifest() {
        assert_eq!(VERSION, env!("CARGO_PKG_VERSION"));
        assert!(!VERSION.is_empty());
    }

    #[test]
    fn range_unit_is_utf8_bytes() {
        assert_eq!(RANGE_UNIT, "utf8-bytes");
    }
}
