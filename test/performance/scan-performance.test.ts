import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";

import { createIncrementalSanitizer, scanAndRedact } from "../../src/index.js";

const CASES = [
  { bytes: 1_024, maximumMilliseconds: 100 },
  { bytes: 100 * 1_024, maximumMilliseconds: 500 },
  { bytes: 1_024 * 1_024, maximumMilliseconds: 3_000 },
] as const;
const ORDINARY_SEED = "ordinary browser and server text 1234567890\n";

function ordinaryInput(bytes: number): string {
  return ORDINARY_SEED.repeat(Math.ceil(bytes / ORDINARY_SEED.length)).slice(
    0,
    bytes,
  );
}

describe("representative scan performance", () => {
  it.each(CASES)(
    "scans $bytes ASCII bytes within $maximumMilliseconds ms",
    ({ bytes, maximumMilliseconds }) => {
      const input = ordinaryInput(bytes);
      const startedAt = performance.now();
      const result = scanAndRedact(input);
      const elapsed = performance.now() - startedAt;

      expect(result).toEqual({ text: input, findings: [] });
      expect(elapsed).toBeLessThan(maximumMilliseconds);
    },
    5_000,
  );
});

describe("representative incremental performance and retention", () => {
  it("sanitizes one MiB in bounded line-sized plaintext retention", () => {
    const input = ordinaryInput(1_024 * 1_024);
    const session = createIncrementalSanitizer({
      limits: {
        maxInputCodeUnits: input.length,
        maxBufferedCodeUnits: 4_224,
        maxTokenCodeUnits: 4_096,
        maxMultilineCodeUnits: 4_096,
      },
    });
    const startedAt = performance.now();
    const results = [];
    for (let offset = 0; offset < input.length; offset += 1_024) {
      results.push(session.append(input.slice(offset, offset + 1_024)));
    }
    results.push(session.finalize());
    const elapsed = performance.now() - startedAt;

    expect(results.map(({ text }) => text).join("")).toBe(input);
    expect(results.flatMap(({ findings }) => findings)).toEqual([]);
    expect(elapsed).toBeLessThan(3_000);
  }, 5_000);
});
