/**
 * The safe, cross-language error-code registry
 * (`decision-govern-cross-language-conformance`): every stable code the
 * bounded incremental sanitizer and its byte-oriented stream adapters can
 * raise, with the fixed, input-free message that accompanies it. A code and
 * its message are part of the cross-language contract; changing either here
 * is a corpus review, not a routine edit.
 *
 * This was originally hand-transcribed from the retired TypeScript oracle's
 * `IncrementalSanitizerErrorCode` and `StreamSanitizerErrorCode` modules,
 * because `conformance/` does not depend on any single binding's source. It
 * is now the independently maintained canonical source; a change here is a
 * corpus review against every binding's actual codes and messages.
 */

import type { CanonicalErrorCode } from "../schema.js";

export const errorCodeFixtures: readonly CanonicalErrorCode[] = [
  {
    code: "INVALID_OPTIONS",
    message: "Incremental sanitizer options are invalid.",
    surface: "incremental",
  },
  {
    code: "INVALID_LIMITS",
    message: "Incremental sanitizer limits are invalid.",
    surface: "incremental",
  },
  {
    code: "INVALID_INPUT",
    message: "Incremental sanitizer input must be a string.",
    surface: "incremental",
  },
  {
    code: "INPUT_LIMIT_EXCEEDED",
    message: "Incremental sanitizer input limit exceeded.",
    surface: "incremental",
  },
  {
    code: "BUFFER_LIMIT_EXCEEDED",
    message: "Incremental sanitizer buffer limit exceeded.",
    surface: "incremental",
  },
  {
    code: "TOKEN_LIMIT_EXCEEDED",
    message: "Incremental sanitizer token limit exceeded.",
    surface: "incremental",
  },
  {
    code: "MULTILINE_LIMIT_EXCEEDED",
    message: "Incremental sanitizer multiline limit exceeded.",
    surface: "incremental",
  },
  {
    code: "DETECTOR_FAILURE",
    message: "An incremental secret detector failed.",
    surface: "incremental",
  },
  {
    code: "POLICY_FAILURE",
    message: "The incremental secret policy failed.",
    surface: "incremental",
  },
  {
    code: "INVALID_POLICY_ACTION",
    message: "The incremental secret policy returned an invalid action.",
    surface: "incremental",
  },
  {
    code: "PLACEHOLDER_FAILURE",
    message: "The incremental placeholder formatter failed.",
    surface: "incremental",
  },
  {
    code: "INVALID_PLACEHOLDER",
    message: "The incremental placeholder formatter returned an invalid value.",
    surface: "incremental",
  },
  {
    code: "INVALID_STATE",
    message: "The incremental sanitizer is no longer accepting input.",
    surface: "incremental",
  },
  {
    code: "INVALID_CHUNK",
    message: "Stream sanitizer input must contain bytes.",
    surface: "stream",
  },
  {
    code: "INVALID_UTF8",
    message: "Stream sanitizer input is not valid UTF-8.",
    surface: "stream",
  },
] as const;
