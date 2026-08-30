import type { SecretCandidate, SecretDetector } from "../../src/types.js";
import type {
  ConformanceCase,
  ConformanceExpectation,
} from "./schema.js";

interface SafeFinding {
  readonly detector: string;
  readonly type: string;
  readonly confidence: string;
  readonly start: number;
  readonly end: number;
}

function fail(
  fixture: ConformanceCase,
  code: string,
  metadata: unknown,
): never {
  throw new Error(
    `Conformance failure ${fixture.id} (${code}): ${JSON.stringify(metadata)}`,
  );
}

function safe(candidate: SafeFinding): SafeFinding {
  return {
    detector: candidate.detector,
    type: candidate.type,
    confidence: candidate.confidence,
    start: candidate.start,
    end: candidate.end,
  };
}

function sameSafeFinding(
  actual: SafeFinding,
  expected: ConformanceExpectation,
): boolean {
  return (
    actual.detector === expected.detector &&
    actual.type === expected.type &&
    actual.confidence === expected.confidence &&
    actual.start === expected.start &&
    actual.end === expected.end
  );
}

export function assertResolvedFindings(
  fixture: ConformanceCase,
  actual: readonly SafeFinding[],
): void {
  if (fixture.expected === null) fail(fixture, "pending-executed", {});
  if (
    actual.length !== fixture.expected.length ||
    actual.some((finding, index) => {
      const expected = fixture.expected?.[index];
      return expected === undefined || !sameSafeFinding(finding, expected);
    })
  ) {
    fail(fixture, "finding-mismatch", {
      expected: fixture.expected.map(safe),
      actual: actual.map(safe),
    });
  }

  for (let index = 1; index < actual.length; index += 1) {
    const previous = actual[index - 1];
    const current = actual[index];
    if (previous !== undefined && current !== undefined && previous.end > current.start) {
      fail(fixture, "overlapping-findings", { index });
    }
  }
}

export function assertCandidateSpecificity(
  fixture: ConformanceCase,
  detectors: ReadonlyMap<string, SecretDetector>,
): void {
  if (fixture.expected === null || fixture.expected.length === 0) return;

  for (const expected of fixture.expected) {
    const detector = detectors.get(expected.detector);
    if (detector === undefined) fail(fixture, "missing-detector", {
      detector: expected.detector,
    });

    let candidates: readonly SecretCandidate[];
    try {
      candidates = detector.detect(fixture.input, {
        inputLength: fixture.input.length,
      });
    } catch {
      fail(fixture, "detector-threw", { detector: expected.detector });
    }
    const candidate = candidates.find((value) => sameSafeFinding(value, expected));
    if (candidate?.specificity !== expected.specificity) {
      fail(fixture, "specificity-mismatch", {
        detector: expected.detector,
        expected: expected.specificity,
        actual: candidate?.specificity ?? "missing",
      });
    }
  }
}

export function assertPublicResultSafety(
  fixture: ConformanceCase,
  actual: readonly SafeFinding[],
): void {
  const serialized = JSON.stringify(actual);
  if (serialized.includes("signals") || serialized.includes("value")) {
    fail(fixture, "unsafe-public-field", {});
  }
  for (const finding of actual) {
    const matched = fixture.input.slice(finding.start, finding.end);
    if (matched.length >= 4 && serialized.includes(matched)) {
      fail(fixture, "plaintext-exposure", { detector: finding.detector });
    }
  }
}
