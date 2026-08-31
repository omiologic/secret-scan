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

export type ConformanceTier =
  | "canonical"
  | "negative"
  | "malformed"
  | "contextual"
  | "adversarial"
  | "regression";

export type ConformanceHostContext =
  | "plain-text"
  | "dotenv"
  | "json"
  | "yaml"
  | "toml"
  | "shell"
  | "powershell"
  | "docker-compose"
  | "github-actions"
  | "terraform"
  | "kubernetes"
  | "javascript"
  | "typescript"
  | "python"
  | "http"
  | "curl"
  | "log"
  | "terminal"
  | "stack-trace"
  | "chat"
  | "markdown"
  | "xml";

export interface MutationProvenance {
  readonly grammar: string;
  readonly seedId: string;
  readonly operation: string;
  readonly ordinal: number;
}

export interface ResourceExpectation {
  readonly maxInputCodeUnits: number;
  readonly maxFindings: number;
  readonly maxRuntimeMs: number;
}

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
  readonly tier: ConformanceTier;
  readonly contexts: readonly ConformanceHostContext[];
  readonly mutation?: MutationProvenance;
  readonly resource?: ResourceExpectation;
  readonly input: string;
  readonly expected: readonly ConformanceExpectation[] | null;
  readonly note: string;
}

export type ConformanceCaseInput = Omit<
  ConformanceCase,
  "tier" | "contexts" | "resource"
> & Partial<Pick<ConformanceCase, "tier" | "contexts" | "resource">>;

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
const TIERS: readonly ConformanceTier[] = [
  "canonical",
  "negative",
  "malformed",
  "contextual",
  "adversarial",
  "regression",
];
const CONTEXTS: readonly ConformanceHostContext[] = [
  "plain-text", "dotenv", "json", "yaml", "toml", "shell", "powershell",
  "docker-compose", "github-actions", "terraform", "kubernetes",
  "javascript", "typescript", "python", "http", "curl", "log",
  "terminal", "stack-trace", "chat", "markdown", "xml",
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

const DEFAULT_TIER: Readonly<Record<ConformanceCaseKind, ConformanceTier>> = {
  positive: "canonical",
  negative: "negative",
  boundary: "malformed",
  overlap: "contextual",
  adversarial: "adversarial",
};

/** Adds explicit qualification metadata to legacy-shaped corpus entries. */
export function defineConformanceCases(
  fixtures: readonly ConformanceCaseInput[],
): readonly ConformanceCase[] {
  return Object.freeze(fixtures.map((fixture) => Object.freeze({
    ...fixture,
    tier: fixture.tier ?? DEFAULT_TIER[fixture.kind],
    contexts: Object.freeze(fixture.contexts ?? ["plain-text"]),
    ...(fixture.mutation !== undefined
      ? { mutation: Object.freeze(fixture.mutation) }
      : fixture.kind === "boundary" && fixture.support !== "not-yet-evaluated" &&
          fixture.tier !== "regression"
        ? {
            mutation: Object.freeze({
              grammar: fixture.detector,
              seedId: fixture.id,
              operation: "declared-boundary",
              ordinal: 0,
            }),
          }
        : {}),
    ...(fixture.kind === "adversarial"
      ? {
          resource: fixture.resource ?? Object.freeze({
            maxInputCodeUnits: fixture.input.length,
            maxFindings: fixture.expected?.length ?? 0,
            maxRuntimeMs: 250,
          }),
        }
      : fixture.resource === undefined ? {} : { resource: fixture.resource }),
  })) as readonly ConformanceCase[]);
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
      !TIERS.includes(fixture.tier) ||
      !Array.isArray(fixture.contexts) ||
      fixture.contexts.length === 0 ||
      fixture.contexts.some((context: ConformanceHostContext) => !CONTEXTS.includes(context)) ||
      new Set(fixture.contexts).size !== fixture.contexts.length ||
      typeof fixture.input !== "string" ||
      typeof fixture.note !== "string" ||
      fixture.note.length === 0
    ) {
      invalid(id, "invalid-metadata");
    }

    if (fixture.mutation !== undefined && (
      !IDENTIFIER_PATTERN.test(fixture.mutation.grammar) ||
      !CASE_ID_PATTERN.test(fixture.mutation.seedId) ||
      !IDENTIFIER_PATTERN.test(fixture.mutation.operation) ||
      !Number.isSafeInteger(fixture.mutation.ordinal) ||
      fixture.mutation.ordinal < 0
    )) invalid(id, "invalid-mutation-provenance");

    if (fixture.resource !== undefined && (
      !Number.isSafeInteger(fixture.resource.maxInputCodeUnits) ||
      fixture.resource.maxInputCodeUnits < fixture.input.length ||
      !Number.isSafeInteger(fixture.resource.maxFindings) ||
      fixture.resource.maxFindings < 0 ||
      !Number.isSafeInteger(fixture.resource.maxRuntimeMs) ||
      fixture.resource.maxRuntimeMs <= 0
    )) invalid(id, "invalid-resource-expectation");
    if (fixture.kind === "adversarial" && fixture.resource === undefined) {
      invalid(id, "adversarial-without-resource-expectation");
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
