import type { SecretCandidate, SecretDetector } from "../types.js";

const AWS_ACCESS_KEY_PATTERN = /(?:AKIA|ASIA)[A-Z0-9]{16}/g;
const TOKEN_CHARACTER = /[A-Za-z0-9]/;

/**
 * Restricts matches to the two AWS access-key prefixes and their fixed length.
 * This intentionally excludes other AWS identifiers such as role and user IDs;
 * unknown or future prefixes will be false negatives until explicitly added.
 */
export const awsAccessKeyDetector: SecretDetector = Object.freeze({
  id: "aws-access-key",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];

    for (const match of input.matchAll(AWS_ACCESS_KEY_PATTERN)) {
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
        type: "aws_access_key_id",
        detector: "aws-access-key",
        confidence: "high",
        specificity: "provider",
        signals: ["aws-prefix", "fixed-length"],
        start,
        end,
      });
    }

    return candidates;
  },
});
