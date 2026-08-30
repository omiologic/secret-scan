import type {
  SecretCandidateSpecificity,
  SecretConfidence,
} from "../../src/types.js";

export type ConformanceCaseKind =
  | "positive"
  | "negative"
  | "boundary"
  | "overlap"
  | "adversarial";

export type ConformanceSupport =
  | "supported"
  | "intentionally-unsupported"
  | "not-yet-evaluated";

export interface ConformanceExpectation {
  readonly detector: string;
  readonly type: string;
  readonly confidence: SecretConfidence;
  readonly specificity: SecretCandidateSpecificity;
  readonly start: number;
  readonly end: number;
}

export interface ConformanceCase {
  readonly id: string;
  readonly detector: string | "unassigned";
  readonly kind: ConformanceCaseKind;
  readonly support: ConformanceSupport;
  readonly input: string;
  readonly expected: readonly ConformanceExpectation[] | null;
  readonly note: string;
}

const CASE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const KINDS: readonly ConformanceCaseKind[] = [
  "positive",
  "negative",
  "boundary",
  "overlap",
  "adversarial",
];
const SUPPORT: readonly ConformanceSupport[] = [
  "supported",
  "intentionally-unsupported",
  "not-yet-evaluated",
];
const CONFIDENCE = ["high", "medium", "low"] as const;
const SPECIFICITY = [
  "private-key",
  "provider",
  "structural",
  "contextual",
  "entropy",
] as const;

function invalid(id: string, code: string): never {
  throw new TypeError(`Invalid conformance fixture ${id}: ${code}.`);
}

/**
 * Validates fixture structure without including fixture input or matched text in
 * diagnostics. The corpus stays plain-data and is usable in browser test rigs.
 */
export function validateConformanceCorpus(
  value: readonly ConformanceCase[],
): readonly ConformanceCase[] {
  if (!Array.isArray(value)) invalid("corpus", "not-an-array");

  const ids = new Set<string>();
  for (const fixture of value) {
    const rawId =
      typeof fixture === "object" && fixture !== null &&
      typeof fixture.id === "string"
        ? fixture.id
        : undefined;
    const id =
      rawId !== undefined && rawId.length <= 64 && CASE_ID_PATTERN.test(rawId)
        ? rawId
        : "unknown";
    if (id === "unknown" || ids.has(id)) invalid(id, "invalid-id");
    ids.add(id);

    if (
      (fixture.detector !== "unassigned" &&
        !IDENTIFIER_PATTERN.test(fixture.detector)) ||
      !KINDS.includes(fixture.kind) ||
      !SUPPORT.includes(fixture.support) ||
      typeof fixture.input !== "string" ||
      typeof fixture.note !== "string" ||
      fixture.note.length === 0
    ) {
      invalid(id, "invalid-metadata");
    }

    if (fixture.support === "not-yet-evaluated") {
      if (fixture.expected !== null) invalid(id, "pending-has-expectation");
      continue;
    }
    if (!Array.isArray(fixture.expected)) invalid(id, "missing-expectation");
    if (fixture.kind === "positive" && fixture.expected.length === 0) {
      invalid(id, "positive-without-finding");
    }
    if (
      (fixture.kind === "negative" ||
        fixture.support === "intentionally-unsupported") &&
      fixture.expected.length !== 0
    ) {
      invalid(id, "excluded-with-finding");
    }

    let previousEnd = 0;
    for (const expected of fixture.expected) {
      if (
        !IDENTIFIER_PATTERN.test(expected.detector) ||
        !IDENTIFIER_PATTERN.test(expected.type) ||
        !CONFIDENCE.includes(expected.confidence) ||
        !SPECIFICITY.includes(expected.specificity) ||
        !Number.isInteger(expected.start) ||
        !Number.isInteger(expected.end) ||
        expected.start < previousEnd ||
        expected.end <= expected.start ||
        expected.end > fixture.input.length
      ) {
        invalid(id, "invalid-expectation");
      }
      previousEnd = expected.end;
    }
  }

  return value;
}
