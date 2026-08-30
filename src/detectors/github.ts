import type { SecretCandidate, SecretDetector } from "../types.js";

const CLASSIC_TOKEN_PATTERN = /gh[opur]_[A-Za-z0-9]{36}/g;
const INSTALLATION_TOKEN_PATTERN = /ghs_[A-Za-z0-9._-]{36,}/g;
const FINE_GRAINED_TOKEN_PATTERN = /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g;
const CLASSIC_TOKEN_CHARACTER = /[A-Za-z0-9_]/;
const INSTALLATION_TOKEN_CHARACTER = /[A-Za-z0-9._-]/;

function collectPattern(
  input: string,
  pattern: RegExp,
  tokenCharacter: RegExp,
  signals: readonly string[],
): SecretCandidate[] {
  const candidates: SecretCandidate[] = [];
  for (const match of input.matchAll(pattern)) {
    const start = match.index;
    const value = match[0];
    if (start === undefined || value === undefined) continue;
    const end = start + value.length;
    if (
      (start > 0 && tokenCharacter.test(input[start - 1] ?? "")) ||
      (end < input.length && tokenCharacter.test(input[end] ?? ""))
    ) {
      continue;
    }
    candidates.push({
      type: "github_token",
      detector: "github-token",
      confidence: "high",
      specificity: "provider",
      signals,
      start,
      end,
    });
  }
  return candidates;
}

/**
 * Uses GitHub's documented prefixes and conservative token boundaries.
 * Installation tokens follow GitHub's rollout-safe expression so both the
 * stateful opaque and stateless JWT-shaped forms are selected in full.
 */
export const githubTokenDetector: SecretDetector = Object.freeze({
  id: "github-token",
  detect(input: string): readonly SecretCandidate[] {
    return [
      ...collectPattern(
        input,
        CLASSIC_TOKEN_PATTERN,
        CLASSIC_TOKEN_CHARACTER,
        ["github-prefix", "classic-fixed-length"],
      ),
      ...collectPattern(
        input,
        INSTALLATION_TOKEN_PATTERN,
        INSTALLATION_TOKEN_CHARACTER,
        [
          "github-installation-prefix",
          "installation-current-or-stateless-shape",
        ],
      ),
      ...collectPattern(
        input,
        FINE_GRAINED_TOKEN_PATTERN,
        CLASSIC_TOKEN_CHARACTER,
        ["github-fine-grained-prefix", "fine-grained-fixed-length"],
      ),
    ];
  },
});
