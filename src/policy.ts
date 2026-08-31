import type {
  DetectedSecretFinding,
  IncrementalSecretPolicy,
  PolicyContext,
  SecretAction,
  SecretPolicy,
} from "./types.js";

const ALWAYS_REDACT_TYPES = new Set([
  "anthropic_api_key",
  "authorization_credential",
  "aws_access_key_id",
  "bearer_token",
  "cloudflare_api_token",
  "connection_string_password",
  "digitalocean_token",
  "docker_token",
  "github_token",
  "gitlab_token",
  "huggingface_token",
  "jwt",
  "linear_token",
  "openai_api_key",
  "pypi_api_token",
  "shopify_access_token",
  "slack_token",
  "stripe_credential",
  "supabase_secret_key",
  "vault_token",
  "vercel_token",
]);

/**
 * Detection remains independent from enforcement: this policy maps finalized
 * safe metadata to an action without inspecting input or matched substrings.
 */
function defaultAction(finding: DetectedSecretFinding): SecretAction {
  if (finding.type === "private_key") return "block";
  if (ALWAYS_REDACT_TYPES.has(finding.type)) return "redact";
  return finding.confidence === "high" ? "redact" : "warn";
}

export const defaultSecretPolicy: SecretPolicy = Object.freeze({
  evaluate(finding: DetectedSecretFinding, _context: PolicyContext) {
    return defaultAction(finding);
  },
});

export const defaultIncrementalSecretPolicy: IncrementalSecretPolicy = Object.freeze({
  evaluate(finding: DetectedSecretFinding) {
    return defaultAction(finding);
  },
});
