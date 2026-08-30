import { defaultIncrementalSecretPolicy } from "./policy.js";
import { hasOpenBearerAuthorization } from "./detectors/bearer-token.js";
import { hasOpenContextualAssignment } from "./detectors/generic-token.js";
import {
  redact,
  defaultPlaceholderFormatter,
  SecretRedactionError,
} from "./redact.js";
import { createDetectorRegistry } from "./registry.js";
import { runDetectorPipeline } from "./scan.js";
import type {
  DetectedSecretFinding,
  IncrementalLimits,
  IncrementalSanitizer,
  IncrementalSanitizerOptions,
  IncrementalSanitizerResult,
  IncrementalSanitizerState,
  IncrementalSecretPolicy,
  PlaceholderFormatter,
  SecretAction,
  SecretFinding,
} from "./types.js";

export type IncrementalSanitizerErrorCode =
  | "INVALID_OPTIONS"
  | "INVALID_LIMITS"
  | "INVALID_INPUT"
  | "INPUT_LIMIT_EXCEEDED"
  | "BUFFER_LIMIT_EXCEEDED"
  | "TOKEN_LIMIT_EXCEEDED"
  | "MULTILINE_LIMIT_EXCEEDED"
  | "DETECTOR_FAILURE"
  | "POLICY_FAILURE"
  | "INVALID_POLICY_ACTION"
  | "PLACEHOLDER_FAILURE"
  | "INVALID_PLACEHOLDER"
  | "INVALID_STATE";

const ERROR_MESSAGES: Readonly<Record<IncrementalSanitizerErrorCode, string>> = {
  INVALID_OPTIONS: "Incremental sanitizer options are invalid.",
  INVALID_LIMITS: "Incremental sanitizer limits are invalid.",
  INVALID_INPUT: "Incremental sanitizer input must be a string.",
  INPUT_LIMIT_EXCEEDED: "Incremental sanitizer input limit exceeded.",
  BUFFER_LIMIT_EXCEEDED: "Incremental sanitizer buffer limit exceeded.",
  TOKEN_LIMIT_EXCEEDED: "Incremental sanitizer token limit exceeded.",
  MULTILINE_LIMIT_EXCEEDED: "Incremental sanitizer multiline limit exceeded.",
  DETECTOR_FAILURE: "An incremental secret detector failed.",
  POLICY_FAILURE: "The incremental secret policy failed.",
  INVALID_POLICY_ACTION: "The incremental secret policy returned an invalid action.",
  PLACEHOLDER_FAILURE: "The incremental placeholder formatter failed.",
  INVALID_PLACEHOLDER: "The incremental placeholder formatter returned an invalid value.",
  INVALID_STATE: "The incremental sanitizer is no longer accepting input.",
};

/** Reserve for the longest built-in fixed match and boundary lookaround. */
export const INCREMENTAL_LOOKAROUND_CODE_UNITS = 128;

const BEGIN_PRIVATE_KEY_PATTERN =
  /-----BEGIN (?:RSA |DSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/;

export class IncrementalSanitizerError extends Error {
  readonly code: IncrementalSanitizerErrorCode;

  constructor(code: IncrementalSanitizerErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "IncrementalSanitizerError";
    this.code = code;
  }
}

function isAction(value: unknown): value is SecretAction {
  return value === "redact" || value === "block" || value === "warn" || value === "allow";
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

function resolveLimits(value: unknown): IncrementalLimits {
  try {
    if (typeof value !== "object" || value === null) throw new TypeError();
    const limits = value as Partial<IncrementalLimits>;
    const {
      maxInputCodeUnits,
      maxBufferedCodeUnits,
      maxTokenCodeUnits,
      maxMultilineCodeUnits,
    } = limits;
    if (
      !isPositiveSafeInteger(maxInputCodeUnits) ||
      !isPositiveSafeInteger(maxBufferedCodeUnits) ||
      !isPositiveSafeInteger(maxTokenCodeUnits) ||
      !isPositiveSafeInteger(maxMultilineCodeUnits) ||
      maxTokenCodeUnits > maxInputCodeUnits ||
      maxMultilineCodeUnits > maxInputCodeUnits ||
      Math.max(maxTokenCodeUnits, maxMultilineCodeUnits) >
        Number.MAX_SAFE_INTEGER - INCREMENTAL_LOOKAROUND_CODE_UNITS ||
      maxBufferedCodeUnits <
        Math.max(maxTokenCodeUnits, maxMultilineCodeUnits) +
          INCREMENTAL_LOOKAROUND_CODE_UNITS
    ) {
      throw new TypeError();
    }
    return Object.freeze({
      maxInputCodeUnits,
      maxBufferedCodeUnits,
      maxTokenCodeUnits,
      maxMultilineCodeUnits,
    });
  } catch {
    throw new IncrementalSanitizerError("INVALID_LIMITS");
  }
}

function frozenResult(
  text: string,
  findings: readonly SecretFinding[],
): IncrementalSanitizerResult {
  return Object.freeze({ text, findings: Object.freeze([...findings]) });
}

function inspectPrivateKeys(input: string): {
  readonly hasBegin: boolean;
  readonly openFooter?: string;
} {
  let cursor = 0;
  let hasBegin = false;
  while (cursor < input.length) {
    const remaining = input.slice(cursor);
    const match = BEGIN_PRIVATE_KEY_PATTERN.exec(remaining);
    const begin = match?.[0];
    if (begin === undefined || match?.index === undefined) return { hasBegin };
    hasBegin = true;
    const footer = `-----END ${begin.slice(11, -5)}-----`;
    const footerStart = input.indexOf(footer, cursor + match.index + begin.length);
    if (footerStart < 0) return { hasBegin, openFooter: footer };
    cursor = footerStart + footer.length;
  }
  return { hasBegin };
}

/**
 * Creates a bounded, runtime-neutral incremental sanitizer. Complete logical
 * lines are finalized progressively; an open line or PEM block remains held.
 */
export function createIncrementalSanitizer(
  options: IncrementalSanitizerOptions,
): IncrementalSanitizer {
  if (typeof options !== "object" || options === null) {
    throw new IncrementalSanitizerError("INVALID_OPTIONS");
  }

  let limits: IncrementalLimits;
  let policy: IncrementalSecretPolicy;
  let formatter: PlaceholderFormatter;
  try {
    if ("detectors" in options) throw new TypeError();
    limits = resolveLimits(options.limits);
    policy = options.policy ?? defaultIncrementalSecretPolicy;
    formatter = options.placeholderFormatter ?? defaultPlaceholderFormatter;
    if (
      typeof policy !== "object" ||
      policy === null ||
      typeof policy.evaluate !== "function" ||
      typeof formatter !== "function"
    ) {
      throw new TypeError();
    }
  } catch (error) {
    if (error instanceof IncrementalSanitizerError) throw error;
    throw new IncrementalSanitizerError("INVALID_OPTIONS");
  }

  const registry = createDetectorRegistry();
  let state: IncrementalSanitizerState = "accepting";
  let retainedPlaintext = "";
  let finalizedInputCodeUnits = 0;
  let totalInputCodeUnits = 0;
  let findingCount = 0;
  let placeholderCount = 0;
  let multilineFooter: string | undefined;
  let multilineDetected = false;

  function fail(code: IncrementalSanitizerErrorCode): never {
    retainedPlaintext = "";
    multilineFooter = undefined;
    multilineDetected = false;
    state = "failed";
    throw new IncrementalSanitizerError(code);
  }

  function requireAccepting(): void {
    if (state !== "accepting") {
      throw new IncrementalSanitizerError("INVALID_STATE");
    }
  }

  function processUnit(input: string, inputOffset: number): IncrementalSanitizerResult {
    let detected: readonly DetectedSecretFinding[];
    try {
      detected = runDetectorPipeline(input, registry);
    } catch {
      return fail("DETECTOR_FAILURE");
    }

    const findings: SecretFinding[] = [];
    for (const local of detected) {
      const global = Object.freeze({
        ...local,
        id: `finding-${findingCount + 1}`,
        start: local.start + inputOffset,
        end: local.end + inputOffset,
      });
      let action: unknown;
      try {
        action = policy.evaluate(
          global,
          Object.freeze({ findingIndex: findingCount }),
        );
      } catch {
        return fail("POLICY_FAILURE");
      }
      if (!isAction(action)) return fail("INVALID_POLICY_ACTION");
      findings.push(Object.freeze({ ...global, action }));
      findingCount += 1;
    }

    const byId = new Map(findings.map((finding) => [finding.id, finding]));
    const localFindings = findings.map((finding) => Object.freeze({
      ...finding,
      start: finding.start - inputOffset,
      end: finding.end - inputOffset,
    }));
    let text: string;
    try {
      text = redact(input, localFindings, {
        placeholderFormatter(localFinding, context) {
          const globalFinding = byId.get(localFinding.id);
          if (globalFinding === undefined) throw new TypeError();
          return formatter(
            globalFinding,
            Object.freeze({ placeholderIndex: placeholderCount + context.placeholderIndex }),
          );
        },
      });
    } catch (error) {
      const code =
        error instanceof SecretRedactionError && error.code === "INVALID_PLACEHOLDER"
          ? "INVALID_PLACEHOLDER"
          : "PLACEHOLDER_FAILURE";
      return fail(code);
    }

    placeholderCount += findings.filter(
      ({ action }) => action === "redact" || action === "block",
    ).length;
    return frozenResult(text, findings);
  }

  function appendRetained(piece: string, closesLine = false): void {
    retainedPlaintext += piece;
    const privateKeys = inspectPrivateKeys(retainedPlaintext);
    multilineDetected ||= privateKeys.hasBegin;
    multilineFooter = privateKeys.openFooter;
    const constructLimit = multilineDetected
      ? limits.maxMultilineCodeUnits
      : limits.maxTokenCodeUnits;
    const openLength = closesLine
      ? retainedPlaintext.length - 1
      : retainedPlaintext.length;
    if (openLength > constructLimit) {
      fail(multilineDetected
        ? "MULTILINE_LIMIT_EXCEEDED"
        : "TOKEN_LIMIT_EXCEEDED");
    }
    if (retainedPlaintext.length > limits.maxBufferedCodeUnits) {
      fail("BUFFER_LIMIT_EXCEEDED");
    }
  }

  function hasOpenSingleLineConstruct(): boolean {
    return (
      hasOpenContextualAssignment(retainedPlaintext) ||
      hasOpenBearerAuthorization(retainedPlaintext)
    );
  }

  function append(chunk: string): IncrementalSanitizerResult {
    requireAccepting();
    if (typeof chunk !== "string") return fail("INVALID_INPUT");
    if (chunk.length > limits.maxInputCodeUnits - totalInputCodeUnits) {
      return fail("INPUT_LIMIT_EXCEEDED");
    }
    totalInputCodeUnits += chunk.length;

    const emittedTexts: string[] = [];
    const findings: SecretFinding[] = [];
    let cursor = 0;
    while (cursor < chunk.length) {
      const lineFeed = chunk.indexOf("\n", cursor);
      const carriageReturn = chunk.indexOf("\r", cursor);
      const newline = lineFeed < 0
        ? carriageReturn
        : carriageReturn < 0
          ? lineFeed
          : Math.min(lineFeed, carriageReturn);
      if (newline < 0) {
        appendRetained(chunk.slice(cursor));
        break;
      }

      appendRetained(chunk.slice(cursor, newline + 1), true);
      if (
        (multilineFooter === undefined && !hasOpenSingleLineConstruct())
      ) {
        const result = processUnit(retainedPlaintext, finalizedInputCodeUnits);
        emittedTexts.push(result.text);
        findings.push(...result.findings);
        finalizedInputCodeUnits += retainedPlaintext.length;
        retainedPlaintext = "";
        multilineFooter = undefined;
        multilineDetected = false;
      }
      cursor = newline + 1;
    }
    return frozenResult(emittedTexts.join(""), findings);
  }

  function finalize(): IncrementalSanitizerResult {
    requireAccepting();
    const input = retainedPlaintext;
    const inputOffset = finalizedInputCodeUnits;
    retainedPlaintext = "";
    multilineFooter = undefined;
    multilineDetected = false;
    try {
      const result = processUnit(input, inputOffset);
      state = "finalized";
      return result;
    } catch (error) {
      if (state === "accepting") state = "failed";
      throw error;
    }
  }

  function abort(): void {
    requireAccepting();
    retainedPlaintext = "";
    multilineFooter = undefined;
    multilineDetected = false;
    state = "aborted";
  }

  return Object.freeze({
    get state() { return state; },
    append,
    finalize,
    abort,
  });
}
