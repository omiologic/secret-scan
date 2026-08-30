import { describe, expect, it } from "vitest";

import { calculateShannonEntropy } from "../../src/entropy.js";

describe("calculateShannonEntropy", () => {
  it.each([
    ["", 0],
    ["aaaaaaaa", 0],
    ["abababab", 1],
    ["abcd", 2],
    ["😀😀éé", 1],
  ] as const)("returns deterministic entropy for %j", (input, expected) => {
    expect(calculateShannonEntropy(input)).toBe(expected);
    expect(calculateShannonEntropy(input)).toBe(expected);
  });
});
