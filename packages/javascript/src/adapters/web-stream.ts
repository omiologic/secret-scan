/**
 * The Web Streams adapter: a byte-to-string `TransformStream` over one
 * incremental session (`decision-define-runtime-bindings`).
 *
 * This module is reached through the package's `./web-stream` subpath and
 * imports nothing from `node:`, so a browser bundle resolves only it, the
 * root module, and the WebAssembly artifact.
 *
 * ```ts
 * await initialize();
 * await response.body.pipeThrough(createWebStreamSanitizer({ limits }))
 *   .pipeTo(destination);
 * ```
 *
 * Backpressure is the platform's: writes stall while the readable side is
 * full and resume when a reader pulls. The readable and writable sides are
 * wrapped so that a reader's `cancel()` and a writer's `abort()` — the two
 * ways a Web stream ends early — abort the session first, discarding the
 * plaintext it was still deciding about, before the underlying stream is torn
 * down.
 */

import { runtime } from "../session.js";
import type {
  IncrementalSanitizer,
  IncrementalSanitizerOptions,
  SecretFinding,
} from "../types.js";

import { createStreamSanitizerRuntime } from "./shared.js";

/** A byte-to-string Web transform backed by one incremental session. */
export class WebStreamSanitizer extends TransformStream<Uint8Array, string> {
  readonly #runtime;
  readonly #readable: ReadableStream<string>;
  readonly #writable: WritableStream<Uint8Array>;

  /**
   * Wraps `session`, which this transform owns: it is finalized when the
   * writable side closes normally and aborted on every other exit.
   */
  constructor(session: IncrementalSanitizer) {
    const sanitizer = createStreamSanitizerRuntime(session);
    super({
      transform(chunk, controller) {
        const { text } = sanitizer.append(chunk);
        if (text.length > 0) controller.enqueue(text);
      },
      flush(controller) {
        const { text } = sanitizer.finalize();
        if (text.length > 0) controller.enqueue(text);
      },
    });
    this.#runtime = sanitizer;

    const source = super.readable.getReader();
    this.#readable = new ReadableStream<string>({
      async pull(controller) {
        try {
          const result = await source.read();
          if (result.done) controller.close();
          else controller.enqueue(result.value);
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel(reason) {
        sanitizer.abort();
        await source.cancel(reason);
      },
    });

    const sink = super.writable.getWriter();
    this.#writable = new WritableStream<Uint8Array>({
      write(chunk) {
        return sink.write(chunk);
      },
      close() {
        return sink.close();
      },
      async abort(reason) {
        sanitizer.abort();
        await sink.abort(reason);
      },
    });
  }

  override get readable(): ReadableStream<string> {
    return this.#readable;
  }

  override get writable(): WritableStream<Uint8Array> {
    return this.#writable;
  }

  /**
   * Every finding the session has finalized so far, frozen, with absolute
   * UTF-16 offsets into the logical whole-stream input. It stays empty when
   * the stream is cancelled or aborted before anything settles.
   */
  get findings(): readonly SecretFinding[] {
    return this.#runtime.findings;
  }

  /**
   * Discards retained plaintext before explicit early termination.
   *
   * Idempotent, and safe after the session has already ended: a later
   * `close()` on the writable side then fails with `INVALID_STATE` rather
   * than flushing anything.
   */
  abort(): void {
    this.#runtime.abort();
  }
}

/**
 * Opens one incremental session and wraps it in a Web transform.
 *
 * Requires a successful `await initialize()`, like every other synchronous
 * operation in this package; it throws `NOT_INITIALIZED` otherwise.
 */
export function createWebStreamSanitizer(
  options: IncrementalSanitizerOptions,
): WebStreamSanitizer {
  return new WebStreamSanitizer(runtime.createIncrementalSanitizer(options));
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
