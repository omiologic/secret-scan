/**
 * Unicode conversion fixtures: astral (supplementary-plane, surrogate-pair)
 * characters positioned before, within, and after a finding's UTF-16 span.
 * Astral characters are the case that most differs between UTF-16 code unit
 * counting and UTF-8 byte counting — a BMP character is at most one UTF-16
 * code unit and up to 3 UTF-8 bytes, while an astral character is exactly 2
 * UTF-16 code units (a surrogate pair) and exactly 4 UTF-8 bytes.
 *
 * These fixtures are authored in the temporary UTF-16 oracle shape (offsets
 * from `String.prototype.indexOf`, matching the TypeScript package's public
 * `start`/`end` semantics) and are converted to the canonical UTF-8
 * byte-offset schema by `conformance/convert.ts`. They exist to exercise
 * that conversion, not the detector pipeline — `detector` is a synthetic,
 * non-registry identifier and these fixtures are intentionally not part of
 * `test/conformance/corpus.ts`'s executable corpus.
 */

import type { Utf16Fixture } from "../convert.js";

function positive(
  id: string,
  input: string,
  matched: string,
  note: string,
): Utf16Fixture {
  const start = input.indexOf(matched);
  if (start < 0) {
    throw new TypeError(`Invalid unicode conversion fixture ${id}.`);
  }
  return {
    id,
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
        end: start + matched.length,
      },
    ],
    note,
  };
}

const SYNTHETIC_TOKEN = "TOKEN_SYNTHETIC_REVOKED_VALUE";

export const unicodeAstralFixtures: readonly Utf16Fixture[] = [
  positive(
    "unicode-conversion-astral-before",
    `\u{1F511} ${SYNTHETIC_TOKEN}`,
    SYNTHETIC_TOKEN,
    "A 4-byte astral character (U+1F511, a surrogate pair in UTF-16) " +
      "precedes the finding; its UTF-8 byte offset must advance by 4 bytes " +
      "for 2 UTF-16 code units, not 2.",
  ),
  positive(
    "unicode-conversion-astral-within",
    `TOKEN_\u{1F511}_SYNTHETIC_REVOKED`,
    `TOKEN_\u{1F511}_SYNTHETIC_REVOKED`,
    "The finding span itself contains a 4-byte astral character; the " +
      "converted span must widen by the astral character's extra UTF-8 " +
      "bytes without splitting the surrogate pair or the encoded code point.",
  ),
  positive(
    "unicode-conversion-astral-after",
    `${SYNTHETIC_TOKEN} \u{1F511}`,
    SYNTHETIC_TOKEN,
    "A 4-byte astral character follows the finding; the finding's own " +
      "converted end offset must be unaffected by text after it.",
  ),
];
