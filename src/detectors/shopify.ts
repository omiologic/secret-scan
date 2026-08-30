import type { SecretCandidate, SecretDetector } from "../types.js";

const SHOPIFY_TOKEN_PATTERN = /shp(?:at|pa)_[A-Za-z0-9_-]{20,}/g;
const TOKEN_CHARACTER = /[A-Za-z0-9_-]/;

/**
 * Recognizes Shopify's documented Admin API and delegate access-token prefixes.
 * The suffix is opaque, so the minimum length and conservative alphabet favor
 * precision while accepting that short or newly encoded values can be missed.
 */
export const shopifyTokenDetector: SecretDetector = Object.freeze({
  id: "shopify-token",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];
    for (const match of input.matchAll(SHOPIFY_TOKEN_PATTERN)) {
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
        type: "shopify_access_token",
        detector: "shopify-token",
        confidence: "high",
        specificity: "provider",
        signals: ["shopify-documented-prefix", "opaque-suffix"],
        start,
        end,
      });
    }
    return candidates;
  },
});
