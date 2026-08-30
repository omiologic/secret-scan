import type { SecretCandidate, SecretDetector } from "../types.js";

const CLASSIC_TOKEN_PATTERN = /gh[opusr]_[A-Za-z0-9]{36}/g;
const FINE_GRAINED_TOKEN_PATTERN = /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g;
const TOKEN_CHARACTER = /[A-Za-z0-9_]/;

function collectPattern(
  input: string,
  pattern: RegExp,
  signals: readonly string[],
): SecretCandidate[] {
  const candidates: SecretCandidate[] = [];
  for (const match of input.matchAll(pattern)) {
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
 * Uses GitHub's fixed token shapes to avoid matching names and abbreviated
 * documentation examples. If GitHub introduces a new prefix or length, that
 * shape remains a false negative until deliberately supported.
 */
export const githubTokenDetector: SecretDetector = Object.freeze({
  id: "github-token",
  detect(input: string): readonly SecretCandidate[] {
    return [
      ...collectPattern(input, CLASSIC_TOKEN_PATTERN, [
        "github-prefix",
        "classic-fixed-length",
      ]),
      ...collectPattern(input, FINE_GRAINED_TOKEN_PATTERN, [
        "github-fine-grained-prefix",
        "fine-grained-fixed-length",
      ]),
    ];
  },
});
