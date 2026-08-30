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

function referenceResolution(
  detectorCandidates: readonly (readonly CandidateInput[])[],
) {
  const specificityRank: Readonly<Record<SecretCandidateSpecificity, number>> = {
    "private-key": 5,
    provider: 4,
    structural: 3,
    contextual: 2,
    entropy: 1,
  };
  const confidenceRank: Readonly<Record<SecretConfidence, number>> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  const ranked = detectorCandidates.flatMap((candidates, detectorOrder) =>
    candidates.map((candidate, candidateOrder) => ({
      ...candidate,
      detector: `reference-${detectorOrder}`,
      confidence: candidate.confidence ?? "high",
      specificity: candidate.specificity ?? "contextual",
      detectorOrder,
      candidateOrder,
    })),
  );

  ranked.sort(
    (left, right) =>
      specificityRank[right.specificity] -
        specificityRank[left.specificity] ||
      confidenceRank[right.confidence] - confidenceRank[left.confidence] ||
      left.end - left.start - (right.end - right.start) ||
      left.detectorOrder - right.detectorOrder ||
      left.candidateOrder - right.candidateOrder,
  );

  const accepted: typeof ranked = [];
  for (const candidate of ranked) {
    if (
      accepted.every(
        (current) =>
          current.end <= candidate.start || current.start >= candidate.end,
      )
    ) {
      accepted.push(candidate);
    }
  }

  accepted.sort(
    (left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.type.localeCompare(right.type) ||
      left.detector.localeCompare(right.detector),
  );

  return accepted.map((candidate, index) => ({
    id: `finding-${index + 1}`,
    type: candidate.type,
    detector: candidate.detector,
    confidence: candidate.confidence,
    start: candidate.start,
    end: candidate.end,
  }));
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

  it("uses detector emission order after all earlier precedence dimensions tie", () => {
    const registry = new DetectorRegistry([
      detector("emission-order", [
        { type: "emitted_first", start: 0, end: 8 },
        { type: "emitted_second", start: 0, end: 8 },
      ]),
    ]);

    expect(runDetectorPipeline("abcdefgh", registry)).toEqual([
      {
        id: "finding-1",
        type: "emitted_first",
        detector: "emission-order",
        confidence: "high",
        start: 0,
        end: 8,
      },
    ]);
  });

  it("resolves dense adjacent, duplicate, and containing candidates", () => {
    const spanCount = 1_000;
    const input = "x".repeat(spanCount * 2);
    const adjacent = Array.from({ length: spanCount }, (_, index) => ({
      type: `span_${index}`,
      start: index * 2,
      end: index * 2 + 2,
      confidence: "high" as const,
      specificity: "contextual" as const,
    }));
    const duplicates = adjacent.map((candidate, index) => ({
      ...candidate,
      type: `duplicate_${index}`,
    }));
    const registry = new DetectorRegistry([
      detector("adjacent", adjacent),
      detector("duplicates", duplicates),
      detector("containing", [
        {
          type: "containing_span",
          start: 0,
          end: input.length,
          confidence: "low",
          specificity: "contextual",
        },
      ]),
    ]);

    const findings = runDetectorPipeline(input, registry);

    expect(findings).toHaveLength(spanCount);
    expect(
      findings.every(
        (finding, index) =>
          finding.id === `finding-${index + 1}` &&
          finding.detector === "adjacent" &&
          finding.start === index * 2 &&
          finding.end === index * 2 + 2,
      ),
    ).toBe(true);
  });

  it("matches an algorithm-independent greedy reference on dense overlaps", () => {
    const input = "x".repeat(512);
    const confidences = ["high", "medium", "low"] as const;
    const specificities = [
      "private-key",
      "provider",
      "structural",
      "contextual",
      "entropy",
    ] as const;
    let state = 0x15_5ca1e;
    const random = (maximum: number) => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state % maximum;
    };
    const detectorCandidates = Array.from({ length: 4 }, (_, detectorOrder) =>
      Array.from({ length: 300 }, (_, candidateOrder) => {
        const start = random(input.length - 1);
        return {
          type: `candidate_${detectorOrder}_${candidateOrder}`,
          start,
          end: Math.min(input.length, start + 1 + random(48)),
          confidence: confidences[random(confidences.length)] ?? "high",
          specificity:
            specificities[random(specificities.length)] ?? "contextual",
        };
      }),
    );
    const registry = new DetectorRegistry(
      detectorCandidates.map((candidates, index) =>
        detector(`reference-${index}`, candidates),
      ),
    );

    expect(runDetectorPipeline(input, registry)).toEqual(
      referenceResolution(detectorCandidates),
    );
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
