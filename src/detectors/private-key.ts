import type { SecretCandidate, SecretDetector } from "../types.js";

const PRIVATE_KEY_LABELS = [
  "PRIVATE KEY",
  "RSA PRIVATE KEY",
  "DSA PRIVATE KEY",
  "EC PRIVATE KEY",
  "OPENSSH PRIVATE KEY",
  "ENCRYPTED PRIVATE KEY",
] as const;

type PrivateKeyLabel = (typeof PRIVATE_KEY_LABELS)[number];

const DELIMITER_PATTERN = new RegExp(
  `-----((?:BEGIN)|(?:END)) (${PRIVATE_KEY_LABELS.join("|")})-----`,
  "g",
);
const MAX_DELIMITER_LENGTH = Math.max(
  ...PRIVATE_KEY_LABELS.map((label) => `-----BEGIN ${label}-----`.length),
);

interface PrivateKeyParserState {
  readonly stack: PrivateKeyLabel[];
  hasBegin: boolean;
  malformed: boolean;
  outerStart: number | undefined;
  outerBodyStart: number | undefined;
}

interface CompletedPrivateKeySpan {
  readonly start: number;
  readonly bodyStart: number;
  readonly footerStart: number;
  readonly end: number;
  readonly malformed: boolean;
}

export interface PrivateKeyRetentionTracker {
  append(piece: string): {
    readonly hasBegin: boolean;
    readonly hasOpen: boolean;
  };
  reset(): void;
}

function createParserState(): PrivateKeyParserState {
  return {
    stack: [],
    hasBegin: false,
    malformed: false,
    outerStart: undefined,
    outerBodyStart: undefined,
  };
}

function resetOpenSpan(state: PrivateKeyParserState): void {
  state.malformed = false;
  state.outerStart = undefined;
  state.outerBodyStart = undefined;
}

function processDelimiter(
  state: PrivateKeyParserState,
  kind: string,
  label: PrivateKeyLabel,
  start: number,
  end: number,
): CompletedPrivateKeySpan | undefined {
  if (kind === "BEGIN") {
    state.hasBegin = true;
    if (state.stack.length === 0) {
      state.outerStart = start;
      state.outerBodyStart = end;
    } else {
      state.malformed = true;
    }
    state.stack.push(label);
    return undefined;
  }

  if (state.stack.length === 0) return undefined;
  if (state.stack.at(-1) !== label) {
    state.malformed = true;
    return undefined;
  }

  state.stack.pop();

  if (state.stack.length > 0) return undefined;

  const outerStart = state.outerStart;
  const outerBodyStart = state.outerBodyStart;
  if (outerStart === undefined || outerBodyStart === undefined) return undefined;
  const completed = {
    start: outerStart,
    bodyStart: outerBodyStart,
    footerStart: start,
    end,
    malformed: state.malformed,
  };
  resetOpenSpan(state);
  return completed;
}

function scanDelimiters(
  input: string,
  state: PrivateKeyParserState,
  searchStart: number,
  processedCodeUnits: number,
  onComplete: (span: CompletedPrivateKeySpan) => void,
  inputOffset = 0,
): void {
  DELIMITER_PATTERN.lastIndex = searchStart;
  for (
    let match = DELIMITER_PATTERN.exec(input);
    match !== null;
    match = DELIMITER_PATTERN.exec(input)
  ) {
    const matched = match[0];
    const kind = match[1];
    const label = match[2] as PrivateKeyLabel | undefined;
    if (
      matched === undefined ||
      kind === undefined ||
      label === undefined ||
      inputOffset + match.index + matched.length <= processedCodeUnits
    ) {
      continue;
    }
    const completed = processDelimiter(
      state,
      kind,
      label,
      inputOffset + match.index,
      inputOffset + match.index + matched.length,
    );
    if (completed !== undefined) onComplete(completed);
  }
}

function hasEncodedBody(input: string, start: number, end: number): boolean {
  let runLength = 0;
  for (let index = start; index < end; index += 1) {
    const code = input.charCodeAt(index);
    if (code === 10 || code === 13) continue;
    if (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      code === 43 ||
      code === 47
    ) {
      runLength += 1;
      if (runLength >= 16) return true;
    } else {
      runLength = 0;
    }
  }
  return false;
}

function candidate(
  start: number,
  end: number,
  malformed: boolean,
): SecretCandidate {
  return {
    type: "private_key",
    detector: "private-key",
    confidence: "high",
    specificity: "private-key",
    signals: malformed
      ? ["pem-boundaries", "malformed-delimiters"]
      : ["pem-boundaries", "encoded-body"],
    start,
    end,
  };
}

/**
 * Tracks the same supported delimiter grammar incrementally, rescanning only
 * enough lookbehind to recognize a delimiter split across appended chunks.
 */
export function createPrivateKeyRetentionTracker(): PrivateKeyRetentionTracker {
  let state = createParserState();
  let processedCodeUnits = 0;
  let lookbehind = "";

  return {
    append(piece) {
      const input = lookbehind + piece;
      const inputOffset = processedCodeUnits - lookbehind.length;
      scanDelimiters(
        input,
        state,
        0,
        processedCodeUnits,
        () => {},
        inputOffset,
      );
      processedCodeUnits += piece.length;
      lookbehind = input.slice(-(MAX_DELIMITER_LENGTH - 1));
      return {
        hasBegin: state.hasBegin,
        hasOpen: state.stack.length > 0,
      };
    },
    reset() {
      state = createParserState();
      processedCodeUnits = 0;
      lookbehind = "";
    },
  };
}

/**
 * Complete, well-paired blocks require encoded body evidence. Nested,
 * repeated, or mismatched supported delimiters produce one conservative span
 * from the outermost header through resolution or end of input. A lone
 * incomplete header remains ignored to avoid classifying prose as a key.
 */
export const privateKeyDetector: SecretDetector = Object.freeze({
  id: "private-key",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];
    const state = createParserState();

    scanDelimiters(input, state, 0, 0, (span) => {
      if (
        span.malformed ||
        hasEncodedBody(input, span.bodyStart, span.footerStart)
      ) {
        candidates.push(candidate(span.start, span.end, span.malformed));
      }
    });

    if (state.stack.length > 0 && state.malformed) {
      const start = state.outerStart;
      if (start !== undefined && start < input.length) {
        candidates.push(candidate(start, input.length, true));
      }
    }

    return candidates;
  },
});
