//! Shopify token detection.
//!
//! Mirrors `src/detectors/shopify.ts`.

use crate::detectors::pattern::{self, RunLength};
use crate::error::DetectorFailure;
use crate::types::{ByteRange, Candidate, Confidence, Detector, DetectorContext, Specificity};

const PREFIXES: [&str; 2] = ["shpat_", "shppa_"];

/// Recognizes Shopify's documented Admin API and delegate access-token
/// prefixes. The suffix is opaque, so the minimum length and conservative
/// alphabet favor precision while accepting that short or newly encoded
/// values can be missed.
pub(super) struct ShopifyTokenDetector;

impl Detector for ShopifyTokenDetector {
    fn id(&self) -> &'static str {
        "shopify-token"
    }

    fn detect(
        &self,
        input: &str,
        _context: &DetectorContext,
    ) -> Result<Vec<Candidate>, DetectorFailure> {
        let mut candidates = Vec::new();
        for (start, end) in pattern::scan_prefixed_runs(
            input,
            &PREFIXES,
            RunLength::AtLeast(20),
            pattern::is_alnum_dash,
            pattern::is_alnum_dash,
        ) {
            let Some(range) = ByteRange::new(start, end) else {
                continue;
            };
            candidates.push(
                Candidate::new("shopify_access_token", Confidence::High, range)
                    .with_specificity(Specificity::Provider)
                    .with_signals(["shopify-documented-prefix", "opaque-suffix"]),
            );
        }
        Ok(candidates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detect(input: &str) -> Vec<Candidate> {
        ShopifyTokenDetector
            .detect(input, &DetectorContext::new(input.len()))
            .unwrap()
    }

    #[test]
    fn detects_the_admin_api_prefix() {
        let input = "shpat_SYNTHETIC_REVOKED_SHOPIFY_TOKEN";
        let candidates = detect(input);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].type_name(), "shopify_access_token");
        assert_eq!(
            candidates[0].range(),
            ByteRange::new(0, input.len()).unwrap()
        );
    }

    #[test]
    fn detects_the_delegate_access_prefix() {
        let input = "shppa_SYNTHETIC_REVOKED_SHOPIFY_TOKEN";
        assert_eq!(detect(input).len(), 1);
    }

    #[test]
    fn rejects_a_short_suffix() {
        assert_eq!(detect("shpat_SYNTHETIC_SHORT").len(), 0);
    }

    #[test]
    fn rejects_the_public_storefront_prefix() {
        assert_eq!(detect("shpca_SYNTHETIC_REVOKED_SHOPIFY_TOKEN").len(), 0);
    }
}
