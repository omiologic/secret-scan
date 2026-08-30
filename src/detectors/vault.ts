import type { SecretCandidate, SecretDetector } from "../types.js";

const VAULT_TOKEN_PATTERN = /hv[sbr]\.[A-Za-z0-9_-]{24,}/g;
const TOKEN_CHARACTER = /[A-Za-z0-9_.-]/;

/**
 * Recognizes modern Vault service, batch, and recovery token prefixes with the
 * documented minimum suffix length. Legacy one-letter prefixes are excluded
 * because they are too common to classify safely without added context.
 */
export const vaultTokenDetector: SecretDetector = Object.freeze({
  id: "vault-token",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];
    for (const match of input.matchAll(VAULT_TOKEN_PATTERN)) {
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
        type: "vault_token",
        detector: "vault-token",
        confidence: "high",
        specificity: "provider",
        signals: ["vault-modern-prefix", "documented-minimum-length"],
        start,
        end,
      });
    }
    return candidates;
  },
});
