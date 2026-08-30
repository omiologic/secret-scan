import type { SecretCandidate, SecretDetector } from "../types.js";

const BEARER_PATTERN = /(?:authorization\s*:\s*)?bearer[ \t]+([A-Za-z0-9._~+/-]{16,}={0,2})/gi;

/**
 * Requires the explicit Bearer scheme and a token of at least 16 characters.
 * This keeps arbitrary identifiers out of scope but intentionally misses short
 * development tokens. Only the credential value, not the header, is selected.
 */
export const bearerTokenDetector: SecretDetector = Object.freeze({
  id: "bearer-token",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];
    for (const match of input.matchAll(BEARER_PATTERN)) {
      const whole = match[0];
      const token = match[1];
      const matchStart = match.index;
      if (matchStart === undefined || whole === undefined || token === undefined) {
        continue;
      }
      if (matchStart > 0 && /[A-Za-z0-9_-]/.test(input[matchStart - 1] ?? "")) {
        continue;
      }
      const relativeStart = whole.lastIndexOf(token);
      const start = matchStart + relativeStart;
      candidates.push({
        type: "bearer_token",
        detector: "bearer-token",
        confidence: "high",
        specificity: "structural",
        signals: ["bearer-scheme"],
        start,
        end: start + token.length,
      });
    }
    return candidates;
  },
});
