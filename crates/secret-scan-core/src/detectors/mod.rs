//! Built-in detectors in canonical registration order.
//!
//! The order of the list returned by [`built_in_detectors`] is a public
//! contract: it is the registry order used as an overlap tie breaker, so it
//! must match the TypeScript oracle and the conformance corpus. This module
//! currently carries every qualified provider-token detector (AWS, GitHub,
//! GitLab, `OpenAI`, Anthropic, Shopify, Vault, Stripe, Slack, `PyPI`, Hugging
//! Face, Docker, Cloudflare, `DigitalOcean`, Linear, Supabase, and Vercel).
//! The private-key, structural, contextual, and entropy detectors are
//! ported in follow-up work; their positions in the TypeScript oracle's
//! `builtInDetectors` array surround this block without interleaving it, so
//! adding them later only requires splicing entries in, not reordering
//! these.

mod additional_providers;
mod anthropic;
mod aws;
mod github;
mod gitlab;
mod openai;
mod pattern;
mod shopify;
mod vault;

use crate::types::Detector;

/// Every built-in detector, in canonical registration order.
#[must_use]
pub fn built_in_detectors() -> Vec<Box<dyn Detector>> {
    vec![
        Box::new(aws::AwsAccessKeyDetector),
        Box::new(github::GitHubTokenDetector),
        Box::new(gitlab::GitlabTokenDetector),
        Box::new(openai::OpenAiTokenDetector),
        Box::new(anthropic::AnthropicTokenDetector),
        Box::new(shopify::ShopifyTokenDetector),
        Box::new(vault::VaultTokenDetector),
        Box::new(additional_providers::STRIPE),
        Box::new(additional_providers::SLACK),
        Box::new(additional_providers::PYPI),
        Box::new(additional_providers::HUGGING_FACE),
        Box::new(additional_providers::DOCKER),
        Box::new(additional_providers::CLOUDFLARE),
        Box::new(additional_providers::DIGITALOCEAN),
        Box::new(additional_providers::LINEAR),
        Box::new(additional_providers::SUPABASE),
        Box::new(additional_providers::VERCEL),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::is_identifier;
    use crate::types::{Candidate, DetectorContext, Specificity};

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

    #[test]
    fn built_in_order_matches_the_typescript_oracle() {
        let detectors = built_in_detectors();
        let ids: Vec<&str> = detectors.iter().map(|d| d.id()).collect();
        assert_eq!(
            ids,
            vec![
                "aws-access-key",
                "github-token",
                "gitlab-token",
                "openai-token",
                "anthropic-token",
                "shopify-token",
                "vault-token",
                "stripe-token",
                "slack-token",
                "pypi-token",
                "huggingface-token",
                "docker-token",
                "cloudflare-token",
                "digitalocean-token",
                "linear-token",
                "supabase-token",
                "vercel-token",
            ]
        );
    }

    #[test]
    fn every_built_in_provider_candidate_claims_provider_specificity() {
        let pypi_input = format!("pypi-{}", "SYNTHETIC_REVOKED_".repeat(5));
        let cases: [(&str, &str); 17] = [
            ("aws-access-key", "AKIASYNTHETICEXAMPLE"),
            (
                "github-token",
                &"ghp_SYNTHETICREVOKEDVALUE0000000000000000"[..40],
            ),
            ("gitlab-token", "glpat-SYNTHETIC_REVOKED_TOKEN_FIXTURE"),
            ("openai-token", "sk-proj-SYNTHETIC_REVOKED_OPENAI_KEY"),
            (
                "anthropic-token",
                "sk-ant-api03-SYNTHETIC_REVOKED_ANTHROPIC_KEY",
            ),
            ("shopify-token", "shpat_SYNTHETIC_REVOKED_SHOPIFY_TOKEN"),
            ("vault-token", "hvs.SYNTHETIC_REVOKED_VAULT_TOKEN"),
            ("stripe-token", "sk_live_SYNTHETICREVOKEDPROVIDERVALUE"),
            ("slack-token", "xoxb-SYNTHETICREVOKEDPROVIDERVALUE"),
            ("pypi-token", pypi_input.as_str()),
            ("huggingface-token", "hf_SYNTHETICREVOKEDPROVIDERVALUE"),
            ("docker-token", "dckr_pat_SYNTHETICREVOKEDPROVIDERVALUE"),
            ("cloudflare-token", "cfut_SYNTHETICREVOKEDPROVIDERVALUE"),
            ("digitalocean-token", "dop_v1_SYNTHETICREVOKEDPROVIDERVALUE"),
            ("linear-token", "lin_api_SYNTHETICREVOKEDPROVIDERVALUE"),
            ("supabase-token", "sb_secret_SYNTHETICREVOKEDPROVIDERVALUE"),
            ("vercel-token", "vcp_SYNTHETICREVOKEDPROVIDERVALUE"),
        ];
        let detectors = built_in_detectors();
        for (id, input) in cases {
            let registered = detectors
                .iter()
                .find(|detector| detector.id() == id)
                .expect("every case id names a registered built-in detector");
            let context = DetectorContext::new(input.len());
            let candidates: Vec<Candidate> = registered.detect(input, &context).unwrap();
            assert_eq!(candidates.len(), 1, "{id}");
            assert_eq!(
                candidates[0].effective_specificity(),
                Specificity::Provider,
                "{id}"
            );
        }
    }
}
