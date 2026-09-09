import { describe, expect, it } from "vitest";

import {
  convertCorpusToCanonical,
  convertFixtureToCanonical,
  utf16OffsetToUtf8ByteOffset,
  utf8ByteOffsetToUtf16Offset,
} from "../../conformance/convert.js";
import { validateCanonicalFixtures } from "../../conformance/schema.js";
import { unicodeAstralFixtures } from "../../conformance/fixtures/unicode-astral.source.js";
import { conformanceCorpus } from "./corpus.js";
import { validateConformanceCorpus } from "./schema.js";

/** Ground truth independent of `conformance/convert.ts`: encodes the exact
 * prefix and measures its byte length directly. */
function referenceUtf8ByteOffset(input: string, utf16Offset: number): number {
  return new TextEncoder().encode(input.slice(0, utf16Offset)).length;
}

describe("UTF-16 <-> UTF-8 byte offset conversion", () => {
  it("matches an independently computed byte offset for ASCII, BMP, and astral text", () => {
    const cases: readonly [string, number][] = [
      ["", 0],
      ["hello", 0],
      ["hello", 5],
      ["café", 3], // "é" is a 2-byte UTF-8 character
      ["café", 4],
      ["€100", 1], // "€" is a 3-byte UTF-8 character
      ["€100", 4],
      ["\u{1F511}key", 2], // astral surrogate pair before the rest
      ["\u{1F511}key", 5],
    ];
    for (const [input, utf16Offset] of cases) {
      expect(utf16OffsetToUtf8ByteOffset(input, utf16Offset)).toBe(
        referenceUtf8ByteOffset(input, utf16Offset),
      );
    }
  });

  it("round-trips UTF-16 -> UTF-8 byte -> UTF-16 across ASCII, BMP, and astral text", () => {
    const inputs = [
      "plain ascii text",
      "café € 100", // BMP accented + currency
      "\u{1F511} token \u{1F510} more \u{1F511}", // multiple astral characters
    ];
    for (const input of inputs) {
      for (let utf16Offset = 0; utf16Offset <= input.length; utf16Offset++) {
        // Skip offsets that split a surrogate pair; those are not valid
        // UTF-16 boundaries and are covered by the rejection test below.
        const precedingUnit = input.charCodeAt(utf16Offset - 1);
        if (precedingUnit >= 0xd800 && precedingUnit <= 0xdbff) continue;

        const byteOffset = utf16OffsetToUtf8ByteOffset(input, utf16Offset);
        expect(utf8ByteOffsetToUtf16Offset(input, byteOffset)).toBe(utf16Offset);
      }
    }
  });

  it("rejects a UTF-16 offset that splits a surrogate pair", () => {
    const input = "\u{1F511}key";
    expect(() => utf16OffsetToUtf8ByteOffset(input, 1)).toThrow(RangeError);
  });

  it("rejects a UTF-8 byte offset that splits a multi-byte character", () => {
    const input = "\u{1F511}key"; // 4-byte astral character first
    expect(() => utf8ByteOffsetToUtf16Offset(input, 1)).toThrow(RangeError);
    expect(() => utf8ByteOffsetToUtf16Offset(input, 2)).toThrow(RangeError);
    expect(() => utf8ByteOffsetToUtf16Offset(input, 3)).toThrow(RangeError);
    expect(utf8ByteOffsetToUtf16Offset(input, 4)).toBe(2);
  });

  it("rejects out-of-bounds offsets in both directions", () => {
    expect(() => utf16OffsetToUtf8ByteOffset("abc", -1)).toThrow(RangeError);
    expect(() => utf16OffsetToUtf8ByteOffset("abc", 4)).toThrow(RangeError);
    expect(() => utf8ByteOffsetToUtf16Offset("abc", -1)).toThrow(RangeError);
    expect(() => utf8ByteOffsetToUtf16Offset("abc", 4)).toThrow(RangeError);
  });
});

describe("Unicode astral conversion fixtures", () => {
  it("covers an astral character before, within, and after a finding", () => {
    const ids = unicodeAstralFixtures.map((fixture) => fixture.id);
    expect(ids).toEqual([
      "unicode-conversion-astral-before",
      "unicode-conversion-astral-within",
      "unicode-conversion-astral-after",
    ]);
  });

  it("converts to canonical byte offsets that independently verify against the source text", () => {
    const canonical = unicodeAstralFixtures.map(convertFixtureToCanonical);
    validateCanonicalFixtures(canonical);

    for (const [index, fixture] of unicodeAstralFixtures.entries()) {
      const converted = canonical[index]!;
      const sourceExpectation = fixture.expected![0]!;
      const convertedExpectation = converted.expected![0]!;

      expect(convertedExpectation.start).toBe(
        referenceUtf8ByteOffset(fixture.input, sourceExpectation.start),
      );
      expect(convertedExpectation.end).toBe(
        referenceUtf8ByteOffset(fixture.input, sourceExpectation.end),
      );

      // The converted span, read back from the encoded bytes, must equal
      // the UTF-16 span read back from the source string.
      const encoded = new TextEncoder().encode(converted.input);
      const decodedSlice = new TextDecoder().decode(
        encoded.slice(convertedExpectation.start, convertedExpectation.end),
      );
      expect(decodedSlice).toBe(
        fixture.input.slice(sourceExpectation.start, sourceExpectation.end),
      );
    }
  });

  it("widens the astral-within span by exactly the astral character's extra bytes", () => {
    const within = unicodeAstralFixtures.find(
      (fixture) => fixture.id === "unicode-conversion-astral-within",
    )!;
    const canonical = convertFixtureToCanonical(within);
    const source = within.expected![0]!;
    const converted = canonical.expected![0]!;

    const utf16Span = source.end - source.start;
    const byteSpan = converted.end - converted.start;
    // One astral character (2 UTF-16 units, 4 UTF-8 bytes) plus ASCII text
    // (1 UTF-16 unit per UTF-8 byte) — the byte span exceeds the code-unit
    // span by exactly (4 - 2) for the one astral character present.
    expect(byteSpan - utf16Span).toBe(2);
  });
});

describe("migration tooling: existing TypeScript corpus to canonical schema", () => {
  it("still validates against the existing UTF-16 schema (the temporary oracle's own contract)", () => {
    expect(() => validateConformanceCorpus(conformanceCorpus)).not.toThrow();
  });

  it("converts the whole corpus to canonical form and passes canonical validation", () => {
    const canonical = convertCorpusToCanonical(conformanceCorpus);
    expect(canonical).toHaveLength(conformanceCorpus.length);
    expect(() => validateCanonicalFixtures(canonical)).not.toThrow();
  });

  it("round-trips every converted expectation's byte offsets back to its original UTF-16 offsets", () => {
    for (const fixture of conformanceCorpus) {
      if (fixture.expected === null) continue;
      const canonical = convertFixtureToCanonical(fixture);
      for (const [index, expected] of fixture.expected.entries()) {
        const converted = canonical.expected![index]!;
        expect(utf8ByteOffsetToUtf16Offset(fixture.input, converted.start), fixture.id)
          .toBe(expected.start);
        expect(utf8ByteOffsetToUtf16Offset(fixture.input, converted.end), fixture.id)
          .toBe(expected.end);
      }
    }
  });

  it("carries no matched value into a converted expectation", () => {
    const canonical = convertCorpusToCanonical(conformanceCorpus);
    const allowedKeys = new Set([
      "detector",
      "type",
      "confidence",
      "specificity",
      "start",
      "end",
    ]);
    for (const fixture of canonical) {
      for (const expected of fixture.expected ?? []) {
        expect(Object.keys(expected).sort()).toEqual(
          [...allowedKeys].sort(),
        );
      }
    }
  });
});
