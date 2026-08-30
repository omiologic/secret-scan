import {
  createStreamSanitizerRuntime,
  StreamSanitizerError,
} from "./shared.js";
import type { StreamSanitizerErrorCode } from "./shared.js";
import type {
  IncrementalSanitizerOptions,
  SecretFinding,
} from "../types.js";

/** A byte-to-string Web TransformStream backed by one incremental session. */
export class WebStreamSanitizer extends TransformStream<Uint8Array, string> {
  readonly #runtime;
  readonly #readable: ReadableStream<string>;
  readonly #writable: WritableStream<Uint8Array>;

  constructor(options: IncrementalSanitizerOptions) {
    const runtime = createStreamSanitizerRuntime(options);
    super({
      transform(chunk, controller) {
        const result = runtime.append(chunk);
        if (result.text.length > 0) controller.enqueue(result.text);
      },
      flush(controller) {
        const result = runtime.finalize();
        if (result.text.length > 0) controller.enqueue(result.text);
      },
    });
    this.#runtime = runtime;

    const nativeReader = super.readable.getReader();
    this.#readable = new ReadableStream<string>({
      async pull(controller) {
        try {
          const result = await nativeReader.read();
          if (result.done) controller.close();
          else controller.enqueue(result.value);
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel(reason) {
        runtime.abort();
        await nativeReader.cancel(reason);
      },
    });

    const nativeWriter = super.writable.getWriter();
    this.#writable = new WritableStream<Uint8Array>({
      write(chunk) {
        return nativeWriter.write(chunk);
      },
      close() {
        return nativeWriter.close();
      },
      async abort(reason) {
        runtime.abort();
        await nativeWriter.abort(reason);
      },
    });
  }

  override get readable(): ReadableStream<string> {
    return this.#readable;
  }

  override get writable(): WritableStream<Uint8Array> {
    return this.#writable;
  }

  get findings(): readonly SecretFinding[] {
    return this.#runtime.findings;
  }

  /** Discards retained plaintext before explicit early termination. */
  abort(): void {
    this.#runtime.abort();
  }
}

export function createWebStreamSanitizer(
  options: IncrementalSanitizerOptions,
): WebStreamSanitizer {
  return new WebStreamSanitizer(options);
}

export { StreamSanitizerError };
export type { StreamSanitizerErrorCode };
export type {
  IncrementalLimits,
  IncrementalSanitizerOptions,
  IncrementalSecretPolicy,
  SecretFinding,
} from "../types.js";
