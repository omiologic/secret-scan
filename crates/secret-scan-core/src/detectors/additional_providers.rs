//! Stripe, Slack, `PyPI`, Hugging Face, Docker, Cloudflare, `DigitalOcean`,
//! Linear, Supabase, and Vercel token detection.
//!
//! Mirrors `src/detectors/additional-providers.ts`. Every one of these
//! providers reduces to the same shape as [`super::gitlab`] or
//! [`super::anthropic`] — a documented literal prefix set followed by a
//! minimum-length opaque suffix, with a boundary alphabet of
//! `[A-Za-z0-9_-]` — so they share one generic [`Detector`] implementation
//! instead of one bespoke type each.

use crate::detectors::pattern::{self, Alphabet, RunLength};
use crate::error::DetectorFailure;
use crate::types::{ByteRange, Candidate, Confidence, Detector, DetectorContext, Specificity};

/// A detector defined purely by a literal prefix set, a following
/// character-class run, and the resulting finding's metadata.
pub(super) struct KnownFormatProviderDetector {
    id: &'static str,
    type_name: &'static str,
    signals: &'static [&'static str],
    prefixes: &'static [&'static str],
    run: RunLength,
    alphabet: Alphabet,
    boundary: Alphabet,
}

impl Detector for KnownFormatProviderDetector {
    fn id(&self) -> &str {
        self.id
    }

    fn detect(
        &self,
        input: &str,
        _context: &DetectorContext,
    ) -> Result<Vec<Candidate>, DetectorFailure> {
        let mut candidates = Vec::new();
        for (start, end) in pattern::scan_prefixed_runs(
            input,
            self.prefixes,
            self.run,
            self.alphabet,
            self.boundary,
        ) {
            let Some(range) = ByteRange::new(start, end) else {
                continue;
            };
            candidates.push(
                Candidate::new(self.type_name, Confidence::High, range)
                    .with_specificity(Specificity::Provider)
                    .with_signals(self.signals.iter().copied()),
            );
        }
        Ok(candidates)
    }
}

/// Stripe secret, restricted, organization, and webhook-signing
/// credentials. The suffix alphabet is `[A-Za-z0-9]` — narrower than the
/// `[A-Za-z0-9_-]` boundary — so a trailing `_` or `-` still rejects a
/// truncated candidate.
pub(super) const STRIPE: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "stripe-token",
    type_name: "stripe_credential",
    signals: &["stripe-documented-prefix", "opaque-suffix"],
    prefixes: &[
        "sk_test_", "sk_live_", "rk_test_", "rk_live_", "sk_org_", "whsec_",
    ],
    run: RunLength::AtLeast(20),
    alphabet: pattern::is_alnum,
    boundary: pattern::is_alnum_dash,
};

/// Current Slack bot, user, app, workflow, rotating, and refresh tokens.
pub(super) const SLACK: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "slack-token",
    type_name: "slack_token",
    signals: &["slack-documented-prefix", "opaque-suffix"],
    prefixes: &[
        "xoxb-",
        "xoxp-",
        "xapp-",
        "xwfp-",
        "xoxe-",
        "xoxe.xoxb-",
        "xoxe.xoxp-",
    ],
    run: RunLength::AtLeast(20),
    alphabet: pattern::is_alnum_dash,
    boundary: pattern::is_alnum_dash,
};

/// `PyPI`'s documented Macaroon serialization with its exact minimum suffix.
pub(super) const PYPI: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "pypi-token",
    type_name: "pypi_api_token",
    signals: &["pypi-documented-prefix", "macaroon-minimum-length"],
    prefixes: &["pypi-"],
    run: RunLength::AtLeast(85),
    alphabet: pattern::is_alnum_dash,
    boundary: pattern::is_alnum_dash,
};

/// Hugging Face user access tokens in the provider's `hf_` namespace.
pub(super) const HUGGING_FACE: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "huggingface-token",
    type_name: "huggingface_token",
    signals: &["huggingface-documented-prefix", "opaque-suffix"],
    prefixes: &["hf_"],
    run: RunLength::AtLeast(20),
    alphabet: pattern::is_alnum_dash,
    boundary: pattern::is_alnum_dash,
};

/// Docker Hub personal and organization access tokens.
pub(super) const DOCKER: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "docker-token",
    type_name: "docker_token",
    signals: &["docker-documented-prefix", "opaque-suffix"],
    prefixes: &["dckr_pat_", "dckr_oat_"],
    run: RunLength::AtLeast(20),
    alphabet: pattern::is_alnum_dash,
    boundary: pattern::is_alnum_dash,
};

/// Cloudflare's current scannable user and account API-token namespace.
pub(super) const CLOUDFLARE: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "cloudflare-token",
    type_name: "cloudflare_api_token",
    signals: &["cloudflare-scannable-prefix", "opaque-suffix"],
    prefixes: &["cfut_"],
    run: RunLength::AtLeast(20),
    alphabet: pattern::is_alnum_dash,
    boundary: pattern::is_alnum_dash,
};

/// `DigitalOcean` personal, `OAuth` access, and `OAuth` refresh token families.
pub(super) const DIGITALOCEAN: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "digitalocean-token",
    type_name: "digitalocean_token",
    signals: &["digitalocean-documented-prefix", "versioned-opaque-suffix"],
    prefixes: &["dop_v1_", "doo_v1_", "dor_v1_"],
    run: RunLength::AtLeast(20),
    alphabet: pattern::is_alnum_dash,
    boundary: pattern::is_alnum_dash,
};

/// Linear API keys and OAuth access tokens with scanner-oriented prefixes.
pub(super) const LINEAR: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "linear-token",
    type_name: "linear_token",
    signals: &["linear-scannable-prefix", "opaque-suffix"],
    prefixes: &["lin_api_", "lin_oauth_"],
    run: RunLength::AtLeast(20),
    alphabet: pattern::is_alnum_dash,
    boundary: pattern::is_alnum_dash,
};

/// Supabase elevated-access secret keys; publishable keys are excluded.
pub(super) const SUPABASE: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "supabase-token",
    type_name: "supabase_secret_key",
    signals: &["supabase-secret-prefix", "elevated-access-key"],
    prefixes: &["sb_secret_"],
    run: RunLength::AtLeast(20),
    alphabet: pattern::is_alnum_dash,
    boundary: pattern::is_alnum_dash,
};

/// Vercel personal, integration, app, refresh, and API-key credentials.
pub(super) const VERCEL: KnownFormatProviderDetector = KnownFormatProviderDetector {
    id: "vercel-token",
    type_name: "vercel_token",
    signals: &["vercel-documented-prefix", "opaque-suffix"],
    prefixes: &["vcp_", "vci_", "vca_", "vcr_", "vck_"],
    run: RunLength::AtLeast(20),
    alphabet: pattern::is_alnum_dash,
    boundary: pattern::is_alnum_dash,
};

#[cfg(test)]
mod tests {
    use super::*;

    const BODY: &str = "SYNTHETICREVOKEDPROVIDERVALUE";

    fn detect(detector: &KnownFormatProviderDetector, input: &str) -> Vec<Candidate> {
        detector
            .detect(input, &DetectorContext::new(input.len()))
            .unwrap()
    }

    struct Family {
        detector: KnownFormatProviderDetector,
        value: String,
        short: &'static str,
    }

    fn families() -> Vec<Family> {
        vec![
            Family {
                detector: STRIPE,
                value: format!("sk_live_{BODY}"),
                short: "sk_live_SYNTHETICSHORT",
            },
            Family {
                detector: SLACK,
                value: format!("xoxb-{BODY}"),
                short: "xoxb-SYNTHETICSHORT",
            },
            Family {
                detector: PYPI,
                value: format!("pypi-{}", "SYNTHETIC_REVOKED_".repeat(5)),
                short: "pypi-SYNTHETICSHORT",
            },
            Family {
                detector: HUGGING_FACE,
                value: format!("hf_{BODY}"),
                short: "hf_SYNTHETIC_SHORT",
            },
            Family {
                detector: DOCKER,
                value: format!("dckr_pat_{BODY}"),
                short: "dckr_pat_SYNTHETIC_SHORT",
            },
            Family {
                detector: CLOUDFLARE,
                value: format!("cfut_{BODY}"),
                short: "cfut_SYNTHETIC_SHORT",
            },
            Family {
                detector: DIGITALOCEAN,
                value: format!("dop_v1_{BODY}"),
                short: "dop_v1_SYNTHETIC_SHORT",
            },
            Family {
                detector: LINEAR,
                value: format!("lin_api_{BODY}"),
                short: "lin_api_SYNTHETIC_SHORT",
            },
            Family {
                detector: SUPABASE,
                value: format!("sb_secret_{BODY}"),
                short: "sb_secret_SYNTHETIC_SHORT",
            },
            Family {
                detector: VERCEL,
                value: format!("vcp_{BODY}"),
                short: "vcp_SYNTHETIC_SHORT",
            },
        ]
    }

    #[test]
    fn detects_a_synthetic_credential_with_provider_specificity() {
        for family in families() {
            let candidates = detect(&family.detector, &family.value);
            assert_eq!(candidates.len(), 1, "{}", family.detector.id());
            assert_eq!(candidates[0].confidence(), Confidence::High);
            assert_eq!(candidates[0].effective_specificity(), Specificity::Provider);
            assert_eq!(
                candidates[0].range(),
                ByteRange::new(0, family.value.len()).unwrap()
            );
        }
    }

    #[test]
    fn rejects_short_invalid_alphabet_and_embedded_lookalikes() {
        for family in families() {
            let embedded = format!("X{}Y", family.value);
            let broken = family.value.replacen("REVOKED", "REVO!KED", 1);
            for input in [family.short, broken.as_str(), embedded.as_str()] {
                assert_eq!(
                    detect(&family.detector, input).len(),
                    0,
                    "{} {input}",
                    family.detector.id()
                );
            }
        }
    }

    #[test]
    fn accepts_punctuation_boundaries() {
        for family in families() {
            let input = format!("({}).", family.value);
            let candidates = detect(&family.detector, &input);
            assert_eq!(candidates.len(), 1, "{}", family.detector.id());
            assert_eq!(
                candidates[0].range(),
                ByteRange::new(1, family.value.len() + 1).unwrap(),
                "{}",
                family.detector.id()
            );
        }
    }

    #[test]
    fn detects_every_documented_prefix_variant() {
        let cases: [(&KnownFormatProviderDetector, &str); 25] = [
            (&STRIPE, "sk_test_"),
            (&STRIPE, "sk_live_"),
            (&STRIPE, "rk_test_"),
            (&STRIPE, "rk_live_"),
            (&STRIPE, "sk_org_"),
            (&STRIPE, "whsec_"),
            (&SLACK, "xoxb-"),
            (&SLACK, "xoxp-"),
            (&SLACK, "xapp-"),
            (&SLACK, "xwfp-"),
            (&SLACK, "xoxe-"),
            (&SLACK, "xoxe.xoxb-"),
            (&SLACK, "xoxe.xoxp-"),
            (&DOCKER, "dckr_pat_"),
            (&DOCKER, "dckr_oat_"),
            (&DIGITALOCEAN, "dop_v1_"),
            (&DIGITALOCEAN, "doo_v1_"),
            (&DIGITALOCEAN, "dor_v1_"),
            (&LINEAR, "lin_api_"),
            (&LINEAR, "lin_oauth_"),
            (&VERCEL, "vcp_"),
            (&VERCEL, "vci_"),
            (&VERCEL, "vca_"),
            (&VERCEL, "vcr_"),
            (&VERCEL, "vck_"),
        ];
        for (detector, prefix) in cases {
            let value = format!("{prefix}{BODY}");
            let candidates = detect(detector, &value);
            assert_eq!(candidates.len(), 1, "{prefix}");
            assert_eq!(
                candidates[0].range(),
                ByteRange::new(0, value.len()).unwrap(),
                "{prefix}"
            );
        }
    }

    #[test]
    fn does_not_classify_neighboring_public_or_identifier_only_formats() {
        for input in [
            format!("pk_live_{BODY}"),
            format!("sb_publishable_{BODY}"),
            format!("SK{}", "0".repeat(32)),
        ] {
            assert_eq!(detect(&STRIPE, &input).len(), 0);
            assert_eq!(detect(&SUPABASE, &input).len(), 0);
        }
    }
}
