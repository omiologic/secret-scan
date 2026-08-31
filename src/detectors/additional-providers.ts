import type { SecretCandidate, SecretDetector } from "../types.js";

const TOKEN_CHARACTER = /[A-Za-z0-9_-]/;

interface ProviderDetectorDefinition {
  readonly id: string;
  readonly type: string;
  readonly pattern: RegExp;
  readonly signals: readonly string[];
}

function createProviderDetector(
  definition: ProviderDetectorDefinition,
): SecretDetector {
  return Object.freeze({
    id: definition.id,
    detect(input: string): readonly SecretCandidate[] {
      const candidates: SecretCandidate[] = [];
      for (const match of input.matchAll(definition.pattern)) {
        const start = match.index;
        const value = match[0];
        if (start === undefined || value === undefined) continue;
        const end = start + value.length;
        if (
          (start > 0 && TOKEN_CHARACTER.test(input[start - 1] ?? "")) ||
          (end < input.length && TOKEN_CHARACTER.test(input[end] ?? ""))
        ) {
          continue;
        }
        candidates.push({
          type: definition.type,
          detector: definition.id,
          confidence: "high",
          specificity: "provider",
          signals: definition.signals,
          start,
          end,
        });
      }
      return candidates;
    },
  });
}

/** Stripe secret, restricted, organization, and webhook-signing credentials. */
export const stripeTokenDetector = createProviderDetector({
  id: "stripe-token",
  type: "stripe_credential",
  pattern:
    /(?:(?:[sr]k_(?:test|live)|sk_org|whsec)_[A-Za-z0-9]{20,})/g,
  signals: ["stripe-documented-prefix", "opaque-suffix"],
});

/** Current Slack bot, user, app, workflow, rotating, and refresh tokens. */
export const slackTokenDetector = createProviderDetector({
  id: "slack-token",
  type: "slack_token",
  pattern:
    /(?:xoxb|xoxp|xapp|xwfp)-[A-Za-z0-9-]{20,}|xoxe(?:\.xox[bp])?-[A-Za-z0-9-]{20,}/g,
  signals: ["slack-documented-prefix", "opaque-suffix"],
});

/** PyPI's documented Macaroon serialization with its exact minimum suffix. */
export const pypiTokenDetector = createProviderDetector({
  id: "pypi-token",
  type: "pypi_api_token",
  pattern: /pypi-[A-Za-z0-9_-]{85,}/g,
  signals: ["pypi-documented-prefix", "macaroon-minimum-length"],
});

/** Hugging Face user access tokens in the provider's `hf_` namespace. */
export const huggingFaceTokenDetector = createProviderDetector({
  id: "huggingface-token",
  type: "huggingface_token",
  pattern: /hf_[A-Za-z0-9_-]{20,}/g,
  signals: ["huggingface-documented-prefix", "opaque-suffix"],
});

/** Docker Hub personal and organization access tokens. */
export const dockerTokenDetector = createProviderDetector({
  id: "docker-token",
  type: "docker_token",
  pattern: /dckr_(?:pat|oat)_[A-Za-z0-9_-]{20,}/g,
  signals: ["docker-documented-prefix", "opaque-suffix"],
});

/** Cloudflare's current scannable user and account API-token namespace. */
export const cloudflareTokenDetector = createProviderDetector({
  id: "cloudflare-token",
  type: "cloudflare_api_token",
  pattern: /cfut_[A-Za-z0-9_-]{20,}/g,
  signals: ["cloudflare-scannable-prefix", "opaque-suffix"],
});

/** DigitalOcean personal, OAuth access, and OAuth refresh token families. */
export const digitalOceanTokenDetector = createProviderDetector({
  id: "digitalocean-token",
  type: "digitalocean_token",
  pattern: /do(?:p|o|r)_v1_[A-Za-z0-9_-]{20,}/g,
  signals: ["digitalocean-documented-prefix", "versioned-opaque-suffix"],
});

/** Linear API keys and OAuth access tokens with scanner-oriented prefixes. */
export const linearTokenDetector = createProviderDetector({
  id: "linear-token",
  type: "linear_token",
  pattern: /lin_(?:api|oauth)_[A-Za-z0-9_-]{20,}/g,
  signals: ["linear-scannable-prefix", "opaque-suffix"],
});

/** Supabase elevated-access secret keys; publishable keys are excluded. */
export const supabaseTokenDetector = createProviderDetector({
  id: "supabase-token",
  type: "supabase_secret_key",
  pattern: /sb_secret_[A-Za-z0-9_-]{20,}/g,
  signals: ["supabase-secret-prefix", "elevated-access-key"],
});

/** Vercel personal, integration, app, refresh, and API-key credentials. */
export const vercelTokenDetector = createProviderDetector({
  id: "vercel-token",
  type: "vercel_token",
  pattern: /vc[piark]_[A-Za-z0-9_-]{20,}/g,
  signals: ["vercel-documented-prefix", "opaque-suffix"],
});
