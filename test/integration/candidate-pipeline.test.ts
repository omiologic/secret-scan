import { describe, expect, it } from "vitest";

import { DetectorRegistry } from "../../src/registry.js";
import {
  runDetectorPipeline,
  SecretScanError,
} from "../../src/scan.js";
import type {
  SecretCandidate,
  SecretCandidateSpecificity,
  SecretConfidence,
  SecretDetector,
} from "../../src/types.js";

interface CandidateInput {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly confidence?: SecretConfidence;
  readonly specificity?: SecretCandidateSpecificity;
}

function detector(
  id: string,
  candidates: readonly CandidateInput[],
): SecretDetector {
  return {
    id,
    detect() {
      return candidates.map(
        (candidate): SecretCandidate => ({
          ...candidate,
          detector: id,
          confidence: candidate.confidence ?? "high",
          specificity: candidate.specificity ?? "contextual",
        }),
      );
    },
  };
}

describe("deterministic candidate pipeline", () => {
  it("returns no findings for empty input", () => {
    const registry = new DetectorRegistry([
      detector("synthetic", [
        { type: "synthetic", start: 0, end: 1 },
      ]),
    ]);

    expect(runDetectorPipeline("", registry)).toEqual([]);
  });

  it("produces stable ordering and identifiers for repeated scans", () => {
    const input = "alpha beta gamma";
    const registry = new DetectorRegistry([
      detector("ordered", [
        { type: "third", start: 11, end: 16 },
        { type: "first", start: 0, end: 5 },
        { type: "second", start: 6, end: 10 },
      ]),
    ]);

    const first = runDetectorPipeline(input, registry);
    const second = runDetectorPipeline(input, registry);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.map(({ id, start, end }) => ({ id, start, end }))).toEqual([
      { id: "finding-1", start: 0, end: 5 },
      { id: "finding-2", start: 6, end: 10 },
      { id: "finding-3", start: 11, end: 16 },
    ]);
  });

  it("prefers specificity before confidence for nested spans", () => {
    const input = "prefix SYNTHETIC suffix";
    const registry = new DetectorRegistry([
      detector("broad", [
        {
          type: "context_match",
          start: 0,
          end: 22,
          confidence: "high",
          specificity: "contextual",
        },
      ]),
      detector("specific", [
        {
          type: "provider_match",
          start: 7,
          end: 16,
          confidence: "low",
          specificity: "provider",
        },
      ]),
    ]);

    expect(runDetectorPipeline(input, registry)).toEqual([
      {
        id: "finding-1",
        type: "provider_match",
        detector: "specific",
        confidence: "low",
        start: 7,
        end: 16,
      },
    ]);
  });

  it("gives candidates without explicit specificity the lowest tier", () => {
    const input = "abcdefghij";
    const registry = new DetectorRegistry([
      {
        id: "unclassified",
        detect() {
          return [
            {
              type: "unclassified_match",
              detector: "unclassified",
              confidence: "high",
              start: 0,
              end: 10,
            },
          ];
        },
      },
      detector("classified", [
        {
          type: "structural_match",
          start: 2,
          end: 8,
          confidence: "low",
          specificity: "structural",
        },
      ]),
    ]);

    expect(runDetectorPipeline(input, registry)).toEqual([
      {
        id: "finding-1",
        type: "structural_match",
        detector: "classified",
        confidence: "low",
        start: 2,
        end: 8,
      },
    ]);
  });

  it("uses confidence to resolve partial overlaps within a specificity tier", () => {
    const input = "abcdefghijklmnop";
    const registry = new DetectorRegistry([
      detector("registered-first", [
        { type: "wide", start: 0, end: 12, confidence: "medium" },
        { type: "narrow", start: 2, end: 8, confidence: "medium" },
      ]),
      detector("registered-second", [
        { type: "same-span", start: 2, end: 8, confidence: "medium" },
      ]),
      detector("higher-confidence", [
        { type: "partial", start: 7, end: 14, confidence: "high" },
      ]),
    ]);

    expect(runDetectorPipeline(input, registry)).toEqual([
      {
        id: "finding-1",
        type: "partial",
        detector: "higher-confidence",
        confidence: "high",
        start: 7,
        end: 14,
      },
    ]);
  });

  it("prefers the narrower span when specificity and confidence tie", () => {
    const input = "abcdefghijklmnop";
    const registry = new DetectorRegistry([
      detector("span-precision", [
        { type: "wide", start: 0, end: 12, confidence: "medium" },
        { type: "narrow", start: 2, end: 8, confidence: "medium" },
      ]),
    ]);

    expect(runDetectorPipeline(input, registry)).toEqual([
      {
        id: "finding-1",
        type: "narrow",
        detector: "span-precision",
        confidence: "medium",
        start: 2,
        end: 8,
      },
    ]);
  });

  it("retains adjacent spans while resolving duplicates by registry order", () => {
    const input = "abcdefgh";
    const registry = new DetectorRegistry([
      detector("first", [
        { type: "left", start: 0, end: 4 },
        { type: "right", start: 4, end: 8 },
      ]),
      detector("duplicate", [
        { type: "duplicate", start: 0, end: 4 },
      ]),
    ]);

    expect(runDetectorPipeline(input, registry)).toEqual([
      {
        id: "finding-1",
        type: "left",
        detector: "first",
        confidence: "high",
        start: 0,
        end: 4,
      },
      {
        id: "finding-2",
        type: "right",
        detector: "first",
        confidence: "high",
        start: 4,
        end: 8,
      },
    ]);
  });

  it("uses an immutable registry snapshot during detector execution", () => {
    const late = detector("late", [
      { type: "late_match", start: 1, end: 2 },
    ]);
    const registry = new DetectorRegistry();
    let registered = false;
    registry.register({
      id: "initial",
      detect() {
        if (!registered) {
          registry.register(late);
          registered = true;
        }
        return [
          {
            type: "initial_match",
            detector: "initial",
            confidence: "high",
            start: 0,
            end: 1,
          },
        ];
      },
    });

    expect(runDetectorPipeline("ab", registry)).toHaveLength(1);
    expect(runDetectorPipeline("ab", registry)).toHaveLength(2);
  });

  it("does not expose matched text in findings", () => {
    const input = "UNMISTAKABLY_SYNTHETIC_REVOKED_EXAMPLE";
    const registry = new DetectorRegistry([
      detector("safe-metadata", [
        {
          type: "synthetic_credential",
          start: 0,
          end: input.length,
          specificity: "provider",
        },
      ]),
    ]);

    const serialized = JSON.stringify(runDetectorPipeline(input, registry));

    expect(serialized).not.toContain(input);
    expect(serialized).not.toContain("signals");
    expect(serialized).not.toContain("value");
  });

  it("replaces detector failures with safe, input-free errors", () => {
    const input = "UNMISTAKABLY_SYNTHETIC_FAILURE_INPUT";
    const registry = new DetectorRegistry([
      {
        id: "failing",
        detect() {
          throw new Error(input);
        },
      },
    ]);

    let thrown: unknown;
    try {
      runDetectorPipeline(input, registry);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SecretScanError);
    expect(thrown).toMatchObject({
      code: "DETECTOR_FAILURE",
      message: "A secret detector failed.",
    });
    expect(String(thrown)).not.toContain(input);
    expect((thrown as Error & { cause?: unknown }).cause).toBeUndefined();
  });

  it("sanitizes scanner-shaped errors thrown by a detector", () => {
    const input = "UNMISTAKABLY_SYNTHETIC_MUTATED_ERROR";
    const registry = new DetectorRegistry([
      {
        id: "mutated-error",
        detect() {
          const error = new SecretScanError("INVALID_INPUT");
          error.message = input;
          throw error;
        },
      },
    ]);

    expect(() => runDetectorPipeline(input, registry)).toThrowError(
      "A secret detector failed.",
    );

    try {
      runDetectorPipeline(input, registry);
    } catch (error) {
      expect(String(error)).not.toContain(input);
    }
  });

  it("rejects malformed candidates without disclosing input", () => {
    const input = "UNMISTAKABLY_SYNTHETIC_INVALID_RANGE";
    const registry = new DetectorRegistry([
      detector("invalid-range", [
        { type: "synthetic_credential", start: 0, end: input.length + 1 },
      ]),
    ]);

    expect(() => runDetectorPipeline(input, registry)).toThrowError(
      "A secret detector returned an invalid candidate.",
    );

    try {
      runDetectorPipeline(input, registry);
    } catch (error) {
      expect(String(error)).not.toContain(input);
    }
  });
});
