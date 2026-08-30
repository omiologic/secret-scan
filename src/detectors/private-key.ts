import type { SecretCandidate, SecretDetector } from "../types.js";

const BEGIN_PATTERN =
  /-----BEGIN (?:RSA |DSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g;

/**
 * Requires a complete PEM-style private-key block. This avoids treating public
 * keys and prose mentioning a header as secrets, at the cost of missing
 * truncated blocks before they are completed.
 */
export const privateKeyDetector: SecretDetector = Object.freeze({
  id: "private-key",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];

    for (const match of input.matchAll(BEGIN_PATTERN)) {
      const start = match.index;
      const begin = match[0];
      if (start === undefined || begin === undefined) continue;

      const label = begin.slice(11, -5);
      const footer = `-----END ${label}-----`;
      const footerStart = input.indexOf(footer, start + begin.length);
      if (footerStart < 0) continue;

      const end = footerStart + footer.length;
      const body = input.slice(start + begin.length, footerStart);
      if (!/[A-Za-z0-9+/]{16}/.test(body.replace(/[\r\n]/g, ""))) continue;

      candidates.push({
        type: "private_key",
        detector: "private-key",
        confidence: "high",
        specificity: "private-key",
        signals: ["pem-boundaries", "encoded-body"],
        start,
        end,
      });
    }

    return candidates;
  },
});
