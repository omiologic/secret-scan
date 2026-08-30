import type { SecretCandidate, SecretDetector } from "../types.js";

const ANTHROPIC_TOKEN_PATTERN = /sk-ant-api03-[A-Za-z0-9_-]{20,}/g;
const TOKEN_CHARACTER = /[A-Za-z0-9_-]/;

/**
 * Requires the versioned Anthropic API-key prefix and a substantial suffix.
 * This prioritizes precision; older, shortened, or newly versioned formats are
 * intentionally false negatives until their exact shape is supported.
 */
export const anthropicTokenDetector: SecretDetector = Object.freeze({
  id: "anthropic-token",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];
    for (const match of input.matchAll(ANTHROPIC_TOKEN_PATTERN)) {
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
        type: "anthropic_api_key",
        detector: "anthropic-token",
        confidence: "high",
        specificity: "provider",
        signals: ["anthropic-versioned-prefix", "opaque-suffix"],
        start,
        end,
      });
    }
    return candidates;
  },
});
