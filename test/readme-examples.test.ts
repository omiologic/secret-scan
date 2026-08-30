import { describe, expect, it } from "vitest";

import {
  scanAndRedact,
  typedPlaceholderFormatter,
} from "../src/index.js";

describe("README examples", () => {
  it("keeps the quick-start output and metadata accurate", () => {
    const value = "SYNTHETIC_REVOKED_CONTEXT_VALUE";
    const input = `API_KEY=${value}`;
    expect(scanAndRedact(input)).toEqual({
      text: "API_KEY=<SECRET_1>",
      findings: [
        {
          id: "finding-1",
          type: "contextual_secret",
          detector: "generic-token",
          confidence: "high",
          action: "redact",
          start: 8,
          end: 39,
        },
      ],
    });
  });

  it("keeps the typed-placeholder example accurate", () => {
    const input = "api_key=SYNTHETIC_REVOKED_TYPED_VALUE";
    expect(
      scanAndRedact(input, {
        placeholderFormatter: typedPlaceholderFormatter,
      }).text,
    ).toBe("api_key=<CONTEXTUAL_SECRET_1>");
  });
});
