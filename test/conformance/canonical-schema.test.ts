import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { CanonicalFixture } from "../../conformance/schema.js";
import {
  utf8ByteLength,
  validateCanonicalFixtures,
} from "../../conformance/schema.js";

function baseFixture(
  overrides: Partial<CanonicalFixture> = {},
): CanonicalFixture {
  const input = "prefix TOKEN_SYNTHETIC_REVOKED_VALUE suffix";
  const start = input.indexOf("TOKEN_SYNTHETIC_REVOKED_VALUE");
  return {
    id: "canonical-fixture-example",
    detector: "unicode-conversion",
    kind: "positive",
    support: "supported",
    tier: "canonical",
    contexts: ["plain-text"],
    input,
    expected: [
      {
        detector: "unicode-conversion",
        type: "synthetic_token",
        confidence: "high",
        specificity: "structural",
        start,
        end: start + "TOKEN_SYNTHETIC_REVOKED_VALUE".length,
      },
    ],
    note: "Baseline canonical fixture used only by schema tests.",
    ...overrides,
  };
}

describe("canonical fixture schema", () => {
  it("accepts a well-formed fixture with byte-offset expectations", () => {
    expect(() => validateCanonicalFixtures([baseFixture()])).not.toThrow();
  });

  it("reads the schema.json document and keeps it structurally in sync", () => {
    const document = JSON.parse(
      readFileSync(new URL("../../conformance/schema.json", import.meta.url), "utf8"),
    ) as { $defs: { expectation: { additionalProperties: unknown } } };
    expect(document.$defs.expectation.additionalProperties).toBe(false);
  });

  it("computes UTF-8 byte length distinctly from UTF-16 code unit length for astral text", () => {
    const astral = "\u{1F511}";
    expect(astral.length).toBe(2); // UTF-16 surrogate pair
    expect(utf8ByteLength(astral)).toBe(4); // UTF-8 4-byte sequence
  });

  it("rejects a duplicate fixture id with an input-free diagnostic", () => {
    const fixture = baseFixture();
    let message = "";
    try {
      validateCanonicalFixtures([fixture, fixture]);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("invalid-id");
    expect(message).not.toContain(fixture.input);
  });

  it("accepts a byte range using the true UTF-8 byte length, not the UTF-16 code unit length", () => {
    // "€" is 1 UTF-16 code unit but a 3-byte UTF-8 sequence.
    const input = "€";
    expect(input.length).toBe(1);
    expect(utf8ByteLength(input)).toBe(3);
    const fixture = baseFixture({
      input,
      expected: [
        {
          detector: "unicode-conversion",
          type: "synthetic_token",
          confidence: "high",
          specificity: "structural",
          start: 0,
          end: utf8ByteLength(input),
        },
      ],
    });
    expect(() => validateCanonicalFixtures([fixture])).not.toThrow();
  });

  it("rejects an out-of-bounds expectation end (byte length, not code unit length)", () => {
    const input = "€";
    const outOfBounds = baseFixture({
      input,
      expected: [
        {
          detector: "unicode-conversion",
          type: "synthetic_token",
          confidence: "high",
          specificity: "structural",
          start: 0,
          end: utf8ByteLength(input) + 1,
        },
      ],
    });
    let message = "";
    try {
      validateCanonicalFixtures([outOfBounds]);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("invalid-expectation");
    expect(message).not.toContain(input);
  });

  it("rejects a byte offset that splits a multi-byte encoded character", () => {
    // "€" is a 3-byte UTF-8 sequence with no valid boundary at byte 1 or 2.
    const input = "€";
    const splitsCharacter = baseFixture({
      input,
      expected: [
        {
          detector: "unicode-conversion",
          type: "synthetic_token",
          confidence: "high",
          specificity: "structural",
          start: 0,
          end: 1,
        },
      ],
    });
    let message = "";
    try {
      validateCanonicalFixtures([splitsCharacter]);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("invalid-expectation");
    expect(message).not.toContain(input);
  });

  it("rejects overlapping expectations with an input-free diagnostic", () => {
    const input = "AAAA_SYNTHETIC_TOKEN_BBBB";
    const fixture = baseFixture({
      input,
      expected: [
        {
          detector: "unicode-conversion",
          type: "synthetic_token",
          confidence: "high",
          specificity: "structural",
          start: 0,
          end: 10,
        },
        {
          detector: "unicode-conversion",
          type: "synthetic_token",
          confidence: "high",
          specificity: "structural",
          start: 5,
          end: 15,
        },
      ],
    });
    let message = "";
    try {
      validateCanonicalFixtures([fixture]);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("invalid-expectation");
    expect(message).not.toContain(input);
  });

  it("rejects a plaintext-bearing expectation with an input-free diagnostic", () => {
    const fixture = baseFixture();
    const plaintextBearing = {
      ...fixture,
      expected: [
        {
          ...fixture.expected![0]!,
          // Not part of the closed expectation shape.
          value: "TOKEN_SYNTHETIC_REVOKED_VALUE",
        },
      ],
    } as unknown as CanonicalFixture;
    let message = "";
    try {
      validateCanonicalFixtures([plaintextBearing]);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("plaintext-bearing-expectation");
    expect(message).not.toContain("TOKEN_SYNTHETIC_REVOKED_VALUE");
  });

  it("keeps every diagnostic path free of fixture input across all failure codes", () => {
    const secretLookingSubstring = "TOKEN_SYNTHETIC_REVOKED_VALUE";
    const cases: CanonicalFixture[] = [
      baseFixture({ id: "Invalid ID" as string }),
      baseFixture({
        expected: [
          {
            detector: "unicode-conversion",
            type: "synthetic_token",
            confidence: "high",
            specificity: "structural",
            start: -1,
            end: 5,
          },
        ],
      }),
      baseFixture({ kind: "positive", expected: [] }),
    ];
    for (const fixture of cases) {
      let message = "";
      try {
        validateCanonicalFixtures([fixture]);
      } catch (error) {
        message = String(error);
      }
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain(fixture.input);
      expect(message).not.toContain(secretLookingSubstring);
    }
  });
});
