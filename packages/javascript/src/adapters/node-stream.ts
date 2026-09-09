/**
 * The Node.js stream adapter: a byte-to-byte `Transform` over one incremental
 * session (`decision-define-runtime-bindings`).
 *
 * This module is reached only through the package's `./node-stream` subpath.
 * It is the one published module that imports `node:stream`; the root export
 * and `./web-stream` never resolve a Node-only module, so a browser bundle
 * that uses them pulls none of this in.
 *
 * ```ts
 * await initialize();
 * await pipeline(source, createNodeStreamSanitizer({ limits }), destination);
 * ```
 *
 * Backpressure, error propagation, and teardown are Node's own: the transform
 * pushes into its readable side and lets the stream machinery stall the
 * producer, and `_destroy` — which Node runs for `destroy()`, for a failed
 * `pipeline`, and for a downstream error alike — aborts the session so the
 * plaintext it was still deciding about is discarded rather than flushed.
 */

import { Transform } from "node:stream";
import type { TransformCallback } from "node:stream";

import { runtime } from "../session.js";
import type {
  IncrementalSanitizer,
  IncrementalSanitizerOptions,
  SecretFinding,
} from "../types.js";

import { createStreamSanitizerRuntime } from "./shared.js";

/** A byte-to-byte Node transform backed by one incremental session. */
export class NodeStreamSanitizer extends Transform {
  readonly #runtime;

  /**
   * Wraps `session`, which this transform owns: it is finalized when the
   * stream ends normally and aborted on every other exit.
   */
  constructor(session: IncrementalSanitizer) {
    super();
    this.#runtime = createStreamSanitizerRuntime(session);
  }

  /**
   * Every finding the session has finalized so far, frozen, with absolute
   * UTF-16 offsets into the logical whole-stream input. It stays empty when
   * the stream is destroyed before anything settles.
   */
  get findings(): readonly SecretFinding[] {
    return this.#runtime.findings;
  }

  override _transform(
    chunk: Uint8Array,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    try {
      const { text } = this.#runtime.append(chunk);
      if (text.length > 0) this.push(text, "utf8");
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  override _flush(callback: TransformCallback): void {
    try {
      const { text } = this.#runtime.finalize();
      if (text.length > 0) this.push(text, "utf8");
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  override _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void,
  ): void {
    this.#runtime.abort();
    callback(error);
  }
}

/**
 * Opens one incremental session and wraps it in a Node transform.
 *
 * Requires a successful `await initialize()`, like every other synchronous
 * operation in this package; it throws `NOT_INITIALIZED` otherwise.
 */
export function createNodeStreamSanitizer(
  options: IncrementalSanitizerOptions,
): NodeStreamSanitizer {
  return new NodeStreamSanitizer(runtime.createIncrementalSanitizer(options));
}

export { SecretScanError } from "../errors.js";
export type { SecretScanErrorCode } from "../errors.js";
export type {
  IncrementalLimits,
  IncrementalSanitizer,
  IncrementalSanitizerOptions,
  IncrementalSecretPolicy,
  SecretFinding,
} from "../types.js";
