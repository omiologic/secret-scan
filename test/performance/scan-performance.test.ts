import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";

import { createIncrementalSanitizer, scanAndRedact } from "../../src/index.js";
import type { SecretCandidate, SecretDetector } from "../../src/index.js";

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

function findingHeavyFixture(count: number): {
  readonly input: string;
  readonly detector: SecretDetector;
} {
  const parts: string[] = [];
  const candidates: SecretCandidate[] = [];
  const suffix = " text\n";
  let offset = 0;

  for (let index = 0; index < count; index += 1) {
    const value = `synthetic${index.toString().padStart(5, "0")}`;
    parts.push(value, suffix);
    candidates.push({
      type: "synthetic_credential",
      detector: "dense-fixture",
      confidence: "high",
      specificity: "contextual",
      start: offset,
      end: offset + value.length,
    });
    offset += value.length + suffix.length;
  }

  return {
    input: parts.join(""),
    detector: {
      id: "dense-fixture",
      detect() {
        return candidates;
      },
    },
  };
}

function repeatedPrivateKeyHeaders(bytes: number): string {
  const header = "-----BEGIN PRIVATE KEY-----\n";
  return header.repeat(Math.ceil(bytes / header.length)).slice(0, bytes);
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

  it("scales finding-heavy scans without quadratic growth", () => {
    const counts = [12_500, 25_000, 50_000] as const;
    const elapsed: number[] = [];
    let largestHeapGrowth = 0;

    for (const count of counts) {
      const { input, detector } = findingHeavyFixture(count);
      const heapBefore = process.memoryUsage().heapUsed;
      const startedAt = performance.now();
      const result = scanAndRedact(input, { detectors: [detector] });
      elapsed.push(performance.now() - startedAt);
      largestHeapGrowth = Math.max(
        largestHeapGrowth,
        process.memoryUsage().heapUsed - heapBefore,
      );

      expect(result.findings).toHaveLength(count);
      expect(
        result.findings.every(
          (finding, index) =>
            finding.id === `finding-${index + 1}` &&
            finding.type === "synthetic_credential" &&
            finding.detector === "dense-fixture" &&
            finding.confidence === "high" &&
            finding.action === "redact" &&
            finding.start === index * 20 &&
            finding.end === index * 20 + 14,
        ),
      ).toBe(true);
      expect(result.text.startsWith("<SECRET_1>")).toBe(true);
      expect(
        result.text.endsWith(`<SECRET_${count}> text\n`),
      ).toBe(true);
    }

    for (let index = 1; index < elapsed.length; index += 1) {
      expect(elapsed[index]).toBeLessThan(
        (elapsed[index - 1] ?? 0) * 3.25 + 50,
      );
    }
    expect(elapsed.at(-1)).toBeLessThan(4_000);
    expect(largestHeapGrowth).toBeLessThan(128 * 1_024 * 1_024);
  }, 15_000);

  it("scales repeated unmatched private-key delimiters linearly", () => {
    const sizes = [256 * 1_024, 512 * 1_024, 1_024 * 1_024] as const;
    const elapsed: number[] = [];

    for (const bytes of sizes) {
      const input = repeatedPrivateKeyHeaders(bytes);
      const startedAt = performance.now();
      const result = scanAndRedact(input);
      elapsed.push(performance.now() - startedAt);

      expect(result.text).toBe("<SECRET_1>");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        type: "private_key",
        detector: "private-key",
        action: "block",
        start: 0,
        end: input.length,
      });
    }

    for (let index = 1; index < elapsed.length; index += 1) {
      expect(elapsed[index]).toBeLessThan(
        (elapsed[index - 1] ?? 0) * 3.25 + 50,
      );
    }
    expect(elapsed.at(-1)).toBeLessThan(4_000);
  }, 15_000);
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

  it("tracks one MiB of repeated private-key headers without rescanning prefixes", () => {
    const input = repeatedPrivateKeyHeaders(1_024 * 1_024);
    const session = createIncrementalSanitizer({
      limits: {
        maxInputCodeUnits: input.length,
        maxBufferedCodeUnits: input.length + 128,
        maxTokenCodeUnits: 4_096,
        maxMultilineCodeUnits: input.length,
      },
    });
    const startedAt = performance.now();
    const appended = session.append(input);
    const finalized = session.finalize();
    const elapsed = performance.now() - startedAt;

    expect(appended).toEqual({ text: "", findings: [] });
    expect(finalized.text).toBe("<SECRET_1>");
    expect(finalized.findings).toHaveLength(1);
    expect(elapsed).toBeLessThan(4_000);
  }, 10_000);
});
