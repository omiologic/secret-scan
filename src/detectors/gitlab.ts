import type { SecretCandidate, SecretDetector } from "../types.js";

const GITLAB_TOKEN_PATTERN =
  /(?:glpat|gloas|gldt|glrt|glrtr|glcbt|glptt|glft|glimt|glagent|glwt)-[A-Za-z0-9_-]{20,}/g;
const TOKEN_CHARACTER = /[A-Za-z0-9_-]/;

/**
 * Requires one of GitLab's documented, non-configurable token prefixes and a
 * substantial opaque suffix. Personal-access-token prefixes can be customized
 * by an administrator and are therefore an intentional false-negative source.
 */
export const gitlabTokenDetector: SecretDetector = Object.freeze({
  id: "gitlab-token",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];
    for (const match of input.matchAll(GITLAB_TOKEN_PATTERN)) {
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
        type: "gitlab_token",
        detector: "gitlab-token",
        confidence: "high",
        specificity: "provider",
        signals: ["gitlab-documented-prefix", "opaque-suffix"],
        start,
        end,
      });
    }
    return candidates;
  },
});
