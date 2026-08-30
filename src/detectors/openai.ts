import type { SecretCandidate, SecretDetector } from "../types.js";

const OPENAI_TOKEN_PATTERN =
  /sk-(?:(?:proj-|svcacct-)[A-Za-z0-9_-]{20,}|(?!ant-)[A-Za-z0-9_-]{20,})/g;
const TOKEN_CHARACTER = /[A-Za-z0-9_-]/;

/**
 * Requires a recognized `sk-` form and a substantial opaque suffix. Anthropic's
 * documented `sk-ant-` namespace is excluded so the more specific provider
 * detector owns it. Short examples and future prefixes can still be missed.
 */
export const openAiTokenDetector: SecretDetector = Object.freeze({
  id: "openai-token",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];
    for (const match of input.matchAll(OPENAI_TOKEN_PATTERN)) {
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
        type: "openai_api_key",
        detector: "openai-token",
        confidence: "high",
        specificity: "provider",
        signals: ["openai-prefix", "opaque-suffix"],
        start,
        end,
      });
    }
    return candidates;
  },
});
