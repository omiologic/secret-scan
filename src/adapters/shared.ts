import {
  createIncrementalSanitizer,
  IncrementalSanitizerError,
} from "../incremental.js";
import type {
  IncrementalSanitizerOptions,
  IncrementalSanitizerResult,
  SecretFinding,
} from "../types.js";

export type StreamSanitizerErrorCode = "INVALID_CHUNK" | "INVALID_UTF8";

const ERROR_MESSAGES: Readonly<Record<StreamSanitizerErrorCode, string>> = {
  INVALID_CHUNK: "Stream sanitizer input must contain bytes.",
  INVALID_UTF8: "Stream sanitizer input is not valid UTF-8.",
};

export class StreamSanitizerError extends Error {
  readonly code: StreamSanitizerErrorCode;

  constructor(code: StreamSanitizerErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "StreamSanitizerError";
    this.code = code;
  }
}

export interface StreamSanitizerRuntime {
  readonly findings: readonly SecretFinding[];
  append(chunk: Uint8Array): IncrementalSanitizerResult;
  finalize(): IncrementalSanitizerResult;
  abort(): void;
}

export function createStreamSanitizerRuntime(
  options: IncrementalSanitizerOptions,
): StreamSanitizerRuntime {
  const sanitizer = createIncrementalSanitizer(options);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const findings: SecretFinding[] = [];

  function abort(): void {
    if (sanitizer.state === "accepting") sanitizer.abort();
  }

  function decode(chunk?: Uint8Array, stream = false): string {
    try {
      return decoder.decode(chunk, { stream });
    } catch {
      abort();
      throw new StreamSanitizerError("INVALID_UTF8");
    }
  }

  function append(chunk: Uint8Array): IncrementalSanitizerResult {
    if (!(chunk instanceof Uint8Array)) {
      abort();
      throw new StreamSanitizerError("INVALID_CHUNK");
    }
    const result = sanitizer.append(decode(chunk, true));
    findings.push(...result.findings);
    return result;
  }

  function finalize(): IncrementalSanitizerResult {
    const decoded = decode();
    let decodedResult: IncrementalSanitizerResult;
    let finalResult: IncrementalSanitizerResult;
    try {
      decodedResult = sanitizer.append(decoded);
      finalResult = sanitizer.finalize();
    } catch (error) {
      if (error instanceof IncrementalSanitizerError) throw error;
      abort();
      throw error;
    }
    findings.push(...decodedResult.findings, ...finalResult.findings);
    return Object.freeze({
      text: decodedResult.text + finalResult.text,
      findings: Object.freeze([
        ...decodedResult.findings,
        ...finalResult.findings,
      ]),
    });
  }

  return Object.freeze({
    get findings() { return Object.freeze([...findings]); },
    append,
    finalize,
    abort,
  });
}
