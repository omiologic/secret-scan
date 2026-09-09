/**
 * The single sanitized error type this package throws.
 *
 * Every code and message below is fixed and input-free: no error carries the
 * scanned input, a matched value, a placeholder, or a failing callback's own
 * message (`decision-define-runtime-bindings`). Sixteen codes come from the
 * Rust core; `NOT_INITIALIZED` and `INITIALIZATION_FAILED` are produced by the
 * binding layer and `INVALID_CHUNK` and `INVALID_UTF8` by the stream adapters,
 * and this package normalizes all of them into the same class so `instanceof
 * SecretScanError` holds on every runtime and every subpath.
 */

export type SecretScanErrorCode =
  | "INVALID_INPUT"
  | "INVALID_OPTIONS"
  | "INVALID_DETECTOR"
  | "DETECTOR_FAILURE"
  | "INVALID_CANDIDATE"
  | "POLICY_FAILURE"
  | "INVALID_POLICY_ACTION"
  | "INVALID_FINDINGS"
  | "PLACEHOLDER_FAILURE"
  | "INVALID_PLACEHOLDER"
  | "INVALID_LIMITS"
  | "INPUT_LIMIT_EXCEEDED"
  | "BUFFER_LIMIT_EXCEEDED"
  | "TOKEN_LIMIT_EXCEEDED"
  | "MULTILINE_LIMIT_EXCEEDED"
  | "INVALID_STATE"
  | "NOT_INITIALIZED"
  | "INITIALIZATION_FAILED"
  | "INVALID_CHUNK"
  | "INVALID_UTF8";

/** The fixed message for every code, mirroring the core's own strings. */
const ERROR_MESSAGES: Readonly<Record<SecretScanErrorCode, string>> = {
  INVALID_INPUT: "Secret scan input must be a string.",
  INVALID_OPTIONS: "Secret scan options are invalid.",
  INVALID_DETECTOR: "Invalid detector registration.",
  DETECTOR_FAILURE: "A secret detector failed.",
  INVALID_CANDIDATE: "A secret detector returned an invalid candidate.",
  POLICY_FAILURE: "The secret policy failed.",
  INVALID_POLICY_ACTION: "The secret policy returned an invalid action.",
  INVALID_FINDINGS: "Redaction findings are invalid.",
  PLACEHOLDER_FAILURE: "The placeholder formatter failed.",
  INVALID_PLACEHOLDER: "The placeholder formatter returned an invalid value.",
  INVALID_LIMITS: "Incremental sanitizer limits are invalid.",
  INPUT_LIMIT_EXCEEDED: "Incremental sanitizer input limit exceeded.",
  BUFFER_LIMIT_EXCEEDED: "Incremental sanitizer buffer limit exceeded.",
  TOKEN_LIMIT_EXCEEDED: "Incremental sanitizer token limit exceeded.",
  MULTILINE_LIMIT_EXCEEDED: "Incremental sanitizer multiline limit exceeded.",
  INVALID_STATE: "The incremental sanitizer is no longer accepting input.",
  NOT_INITIALIZED:
    "secret-scan is not initialized; await initialize() before this call.",
  INITIALIZATION_FAILED: "secret-scan failed to initialize.",
  INVALID_CHUNK: "Stream sanitizer input must contain bytes.",
  INVALID_UTF8: "Stream sanitizer input is not valid UTF-8.",
};

const ERROR_CODES = new Set<string>(Object.keys(ERROR_MESSAGES));

/** A sanitized failure. It carries nothing but its fixed code and message. */
export class SecretScanError extends Error {
  readonly code: SecretScanErrorCode;

  constructor(code: SecretScanErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "SecretScanError";
    this.code = code;
  }
}

function nativeErrorCode(value: unknown): SecretScanErrorCode | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { code } = value as { code?: unknown };
  return typeof code === "string" && ERROR_CODES.has(code)
    ? (code as SecretScanErrorCode)
    : undefined;
}

/**
 * Rewrites whatever a binding threw as a {@link SecretScanError}.
 *
 * The Node addon throws an N-API error whose `code` is the core's fixed code;
 * the WebAssembly binding throws a `js_sys::Error` with the same property. A
 * value that carries no recognized code is replaced by `fallback` rather than
 * surfaced, so a host-specific message can never reach a caller.
 */
export function toSecretScanError(
  thrown: unknown,
  fallback: SecretScanErrorCode,
): SecretScanError {
  if (thrown instanceof SecretScanError) return thrown;
  return new SecretScanError(nativeErrorCode(thrown) ?? fallback);
}
