import type { SecretCandidate, SecretDetector } from "../types.js";

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{16,}/g;
const TOKEN_CHARACTER = /[A-Za-z0-9_.-]/;

/**
 * Requires three non-empty base64url-looking segments and JSON-object-style
 * prefixes for both header and payload. This avoids generic dotted IDs but
 * misses valid JWTs whose encoded payload does not begin with `eyJ`.
 */
export const jwtDetector: SecretDetector = Object.freeze({
  id: "jwt",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];
    for (const match of input.matchAll(JWT_PATTERN)) {
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
        type: "jwt",
        detector: "jwt",
        confidence: "high",
        specificity: "structural",
        signals: ["three-segments", "encoded-json-prefixes"],
        start,
        end,
      });
    }
    return candidates;
  },
});
