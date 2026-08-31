import type {
  PlaceholderContext,
  PlaceholderFormatter,
  RedactOptions,
  SecretAction,
  SecretConfidence,
  SecretFinding,
} from "./types.js";

export type SecretRedactionErrorCode =
  | "INVALID_INPUT"
  | "INVALID_FINDINGS"
  | "INVALID_OPTIONS"
  | "PLACEHOLDER_FAILURE"
  | "INVALID_PLACEHOLDER";

const ERROR_MESSAGES: Readonly<Record<SecretRedactionErrorCode, string>> = {
  INVALID_INPUT: "Secret redaction input must be a string.",
  INVALID_FINDINGS: "Secret redaction findings are invalid.",
  INVALID_OPTIONS: "Secret redaction options are invalid.",
  PLACEHOLDER_FAILURE: "The placeholder formatter failed.",
  INVALID_PLACEHOLDER: "The placeholder formatter returned an invalid value.",
};

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const MAX_IDENTIFIER_LENGTH = 64;
const MAX_PLACEHOLDER_LENGTH = 256;

interface ForbiddenMatchedTextIndex {
  readonly byLength: ReadonlyMap<number, ReadonlySet<string>>;
  readonly lengths: readonly number[];
}

export class SecretRedactionError extends Error {
  readonly code: SecretRedactionErrorCode;

  constructor(code: SecretRedactionErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "SecretRedactionError";
    this.code = code;
  }
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    IDENTIFIER_PATTERN.test(value)
  );
}

function isConfidence(value: unknown): value is SecretConfidence {
  return value === "high" || value === "medium" || value === "low";
}

function isAction(value: unknown): value is SecretAction {
  return (
    value === "redact" ||
    value === "block" ||
    value === "warn" ||
    value === "allow"
  );
}

function normalizeFinding(input: string, value: unknown): SecretFinding {
  if (typeof value !== "object" || value === null) {
    throw new SecretRedactionError("INVALID_FINDINGS");
  }

  try {
    const finding = value as Partial<SecretFinding>;
    if (
      !isIdentifier(finding.id) ||
      !isIdentifier(finding.type) ||
      !isIdentifier(finding.detector) ||
      !isConfidence(finding.confidence) ||
      !isAction(finding.action) ||
      !Number.isInteger(finding.start) ||
      !Number.isInteger(finding.end) ||
      finding.start === undefined ||
      finding.end === undefined ||
      finding.start < 0 ||
      finding.end <= finding.start ||
      finding.end > input.length
    ) {
      throw new TypeError();
    }

    return Object.freeze({
      id: finding.id,
      type: finding.type,
      detector: finding.detector,
      confidence: finding.confidence,
      action: finding.action,
      start: finding.start,
      end: finding.end,
    });
  } catch {
    throw new SecretRedactionError("INVALID_FINDINGS");
  }
}

export const defaultPlaceholderFormatter: PlaceholderFormatter = (
  _finding,
  context,
) => `<SECRET_${context.placeholderIndex}>`;

export const typedPlaceholderFormatter: PlaceholderFormatter = (
  finding,
  context,
) => `<${finding.type.toUpperCase().replace(/[.-]/g, "_")}_${context.placeholderIndex}>`;

function resolveFormatter(options: RedactOptions): PlaceholderFormatter {
  if (typeof options !== "object" || options === null) {
    throw new SecretRedactionError("INVALID_OPTIONS");
  }
  try {
    const formatter =
      options.placeholderFormatter ?? defaultPlaceholderFormatter;
    if (typeof formatter !== "function") throw new TypeError();
    return formatter;
  } catch {
    throw new SecretRedactionError("INVALID_OPTIONS");
  }
}

function formatPlaceholder(
  formatter: PlaceholderFormatter,
  finding: SecretFinding,
  context: PlaceholderContext,
  forbiddenMatchedTexts: ForbiddenMatchedTextIndex,
): string {
  let placeholder: unknown;
  try {
    placeholder = formatter(finding, context);
  } catch {
    throw new SecretRedactionError("PLACEHOLDER_FAILURE");
  }

  if (
    typeof placeholder !== "string" ||
    placeholder.length === 0 ||
    placeholder.length > MAX_PLACEHOLDER_LENGTH ||
    containsForbiddenMatchedText(placeholder, forbiddenMatchedTexts)
  ) {
    throw new SecretRedactionError("INVALID_PLACEHOLDER");
  }
  return placeholder;
}

function buildForbiddenMatchedTextIndex(
  input: string,
  findings: readonly SecretFinding[],
): ForbiddenMatchedTextIndex {
  const byLength = new Map<number, Set<string>>();

  for (const finding of findings) {
    if (finding.action !== "redact" && finding.action !== "block") continue;

    const length = finding.end - finding.start;
    if (length > MAX_PLACEHOLDER_LENGTH) {
      continue;
    }

    let values = byLength.get(length);
    if (values === undefined) {
      values = new Set<string>();
      byLength.set(length, values);
    }
    values.add(input.slice(finding.start, finding.end));
  }

  return {
    byLength,
    lengths: [...byLength.keys()].sort((left, right) => left - right),
  };
}

function containsForbiddenMatchedText(
  placeholder: string,
  index: ForbiddenMatchedTextIndex,
): boolean {
  for (const length of index.lengths) {
    if (length > placeholder.length) break;

    const forbiddenValues = index.byLength.get(length);
    if (forbiddenValues === undefined) continue;

    for (let start = 0; start + length <= placeholder.length; start += 1) {
      if (forbiddenValues.has(placeholder.slice(start, start + length))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Reconstructs text in one pass. Findings with `warn` or `allow` remain
 * unchanged; `redact` and `block` ranges receive deterministic placeholders.
 */
export function redact(
  input: string,
  findings: readonly SecretFinding[],
  options: RedactOptions = {},
): string {
  if (typeof input !== "string") {
    throw new SecretRedactionError("INVALID_INPUT");
  }
  if (!Array.isArray(findings)) {
    throw new SecretRedactionError("INVALID_FINDINGS");
  }

  const formatter = resolveFormatter(options);
  let normalized: SecretFinding[];
  try {
    normalized = findings
      .map((finding) => normalizeFinding(input, finding))
      .sort((left, right) => left.start - right.start || left.end - right.end);
  } catch {
    throw new SecretRedactionError("INVALID_FINDINGS");
  }

  let previousEnd = 0;
  for (const finding of normalized) {
    if (finding.start < previousEnd) {
      throw new SecretRedactionError("INVALID_FINDINGS");
    }
    previousEnd = finding.end;
  }

  const chunks: string[] = [];
  let cursor = 0;
  let placeholderIndex = 0;
  const forbiddenMatchedTexts = buildForbiddenMatchedTextIndex(
    input,
    normalized,
  );
  for (const finding of normalized) {
    if (finding.action === "warn" || finding.action === "allow") continue;

    chunks.push(input.slice(cursor, finding.start));
    placeholderIndex += 1;
    const context = Object.freeze({ placeholderIndex });
    chunks.push(
      formatPlaceholder(
        formatter,
        finding,
        context,
        forbiddenMatchedTexts,
      ),
    );
    cursor = finding.end;
  }
  chunks.push(input.slice(cursor));
  return chunks.join("");
}
