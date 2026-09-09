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
//! Detection, overlap resolution, policy, redaction, and incremental
//! sanitization are not implemented yet. Until the Rust core passes the shared
//! conformance corpus, the TypeScript implementation in `src/` remains the
//! behavioral oracle.

#![forbid(unsafe_code)]
#![deny(clippy::print_stdout, clippy::print_stderr)]
#![deny(missing_docs)]

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
