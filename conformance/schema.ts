/**
 * Canonical, language-neutral conformance fixture schema.
 *
 * This is the single behavioral contract described by
 * `decision-govern-cross-language-conformance`: every supported binding
 * (Rust core, JavaScript, Python, future ports) validates and runs its own
 * translation of these fixtures. Nothing here depends on the TypeScript
 * package internals — types are redeclared rather than imported from `src/`
 * so this module stays meaningful after the TypeScript detector core is
 * removed.
 *
 * Canonical expected ranges are UTF-8 byte offsets into the fixture's
 * `input` string, encoded as UTF-8. This differs from the temporary
 * TypeScript oracle's fixtures (`test/conformance/schema.ts`), which use
 * UTF-16 code unit offsets matching this package's public `start`/`end`
 * semantics. `conformance/convert.ts` performs that translation; it is not
 * done by hand.
 */

export type CanonicalConfidence = "high" | "medium" | "low";

export type CanonicalSpecificity =
  | "private-key"
  | "provider"
  | "structural"
  | "contextual"
  | "entropy";

export type CanonicalCaseKind =
  | "positive"
  | "negative"
  | "boundary"
  | "overlap"
  | "adversarial";

export type CanonicalTier =
  | "canonical"
  | "negative"
  | "malformed"
  | "contextual"
  | "adversarial"
  | "regression";

export type CanonicalSupport =
  | "supported"
  | "intentionally-unsupported"
  | "not-yet-evaluated";

export type CanonicalHostContext =
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

export interface CanonicalMutationProvenance {
  readonly grammar: string;
  readonly seedId: string;
  readonly operation: string;
  readonly ordinal: number;
}

/** Adversarial resource caps, expressed in UTF-8 bytes rather than code units. */
export interface CanonicalResourceExpectation {
  readonly maxInputBytes: number;
  readonly maxFindings: number;
  readonly maxRuntimeMs: number;
}

/**
 * A safe public expectation. Deliberately closed to exactly these fields:
 * nothing here may carry the matched plaintext, so a converter or hand
 * author cannot smuggle a secret value into the corpus through an
 * unanticipated key.
 */
export interface CanonicalExpectation {
  readonly detector: string;
  readonly type: string;
  readonly confidence: CanonicalConfidence;
  readonly specificity: CanonicalSpecificity;
  /** UTF-8 byte offset, inclusive. */
  readonly start: number;
  /** UTF-8 byte offset, exclusive. */
  readonly end: number;
}

export interface CanonicalFixture {
  readonly id: string;
  readonly detector: string | "unassigned";
  readonly kind: CanonicalCaseKind;
  readonly support: CanonicalSupport;
  readonly tier: CanonicalTier;
  readonly contexts: readonly CanonicalHostContext[];
  readonly mutation?: CanonicalMutationProvenance;
  readonly resource?: CanonicalResourceExpectation;
  readonly input: string;
  readonly expected: readonly CanonicalExpectation[] | null;
  readonly note: string;
}

const CASE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

const KINDS: readonly CanonicalCaseKind[] = [
  "positive",
  "negative",
  "boundary",
  "overlap",
  "adversarial",
];
const SUPPORT: readonly CanonicalSupport[] = [
  "supported",
  "intentionally-unsupported",
  "not-yet-evaluated",
];
const TIERS: readonly CanonicalTier[] = [
  "canonical",
  "negative",
  "malformed",
  "contextual",
  "adversarial",
  "regression",
];
const CONTEXTS: readonly CanonicalHostContext[] = [
  "plain-text", "dotenv", "json", "yaml", "toml", "shell", "powershell",
  "docker-compose", "github-actions", "terraform", "kubernetes",
  "javascript", "typescript", "python", "http", "curl", "log",
  "terminal", "stack-trace", "chat", "markdown", "xml",
];
const CONFIDENCE: readonly CanonicalConfidence[] = ["high", "medium", "low"];
const SPECIFICITY: readonly CanonicalSpecificity[] = [
  "private-key",
  "provider",
  "structural",
  "contextual",
  "entropy",
];
const EXPECTATION_KEYS = new Set([
  "detector",
  "type",
  "confidence",
  "specificity",
  "start",
  "end",
]);

const encoder = new TextEncoder();

/** UTF-8 byte length of a JavaScript string, without retaining the string. */
export function utf8ByteLength(input: string): number {
  return encoder.encode(input).length;
}

/**
 * The set of UTF-8 byte offsets into `input` that fall on a code point
 * boundary (including 0 and the full byte length). A canonical `start`/`end`
 * that is not one of these offsets would split a multi-byte encoded
 * character and cannot refer to a real position in the UTF-8 text.
 */
function utf8BoundaryOffsets(input: string): ReadonlySet<number> {
  const boundaries = new Set<number>([0]);
  let byteIndex = 0;
  for (const codePoint of input) {
    byteIndex += encoder.encode(codePoint).length;
    boundaries.add(byteIndex);
  }
  return boundaries;
}

/**
 * Diagnostics carry only a fixture identity and a stable failure code —
 * never the fixture's `input`, a matched substring, or any other value
 * derived from fixture content. This is what makes validator failures safe
 * to log and safe to surface in CI without redaction.
 */
function invalid(id: string, code: string): never {
  throw new TypeError(`Invalid canonical fixture ${id}: ${code}.`);
}

/**
 * Validates the canonical corpus shape and its UTF-8 byte-offset invariants.
 * Rejects invalid, overlapping, out-of-bounds, or plaintext-bearing public
 * expectations. Never reads fixture `input` content into a diagnostic.
 */
export function validateCanonicalFixtures(
  value: readonly CanonicalFixture[],
): readonly CanonicalFixture[] {
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
      fixture.contexts.some(
        (context: CanonicalHostContext) => !CONTEXTS.includes(context),
      ) ||
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

    const inputByteLength = utf8ByteLength(fixture.input);

    if (fixture.resource !== undefined && (
      !Number.isSafeInteger(fixture.resource.maxInputBytes) ||
      fixture.resource.maxInputBytes < inputByteLength ||
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

    const boundaries = fixture.expected.length > 0
      ? utf8BoundaryOffsets(fixture.input)
      : undefined;
    let previousEnd = 0;
    for (const expected of fixture.expected) {
      if (
        typeof expected !== "object" ||
        expected === null ||
        Object.keys(expected).some((key) => !EXPECTATION_KEYS.has(key))
      ) {
        invalid(id, "plaintext-bearing-expectation");
      }
      if (
        !IDENTIFIER_PATTERN.test(expected.detector) ||
        !IDENTIFIER_PATTERN.test(expected.type) ||
        !CONFIDENCE.includes(expected.confidence) ||
        !SPECIFICITY.includes(expected.specificity) ||
        !Number.isInteger(expected.start) ||
        !Number.isInteger(expected.end) ||
        expected.start < previousEnd ||
        expected.end <= expected.start ||
        expected.end > inputByteLength ||
        !boundaries?.has(expected.start) ||
        !boundaries.has(expected.end)
      ) {
        invalid(id, "invalid-expectation");
      }
      previousEnd = expected.end;
    }
  }

  return value;
}
