import { Transform } from "node:stream";
import type { TransformCallback } from "node:stream";

import {
  createStreamSanitizerRuntime,
  StreamSanitizerError,
} from "./shared.js";
import type { StreamSanitizerErrorCode } from "./shared.js";
import type {
  IncrementalSanitizerOptions,
  SecretFinding,
} from "../types.js";

/** A byte-to-byte Node transform backed by one incremental sanitizer session. */
export class NodeStreamSanitizer extends Transform {
  readonly #runtime;

  constructor(options: IncrementalSanitizerOptions) {
    super();
    this.#runtime = createStreamSanitizerRuntime(options);
  }

  get findings(): readonly SecretFinding[] {
    return this.#runtime.findings;
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    try {
      const result = this.#runtime.append(chunk);
      if (result.text.length > 0) this.push(result.text, "utf8");
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  override _flush(callback: TransformCallback): void {
    try {
      const result = this.#runtime.finalize();
      if (result.text.length > 0) this.push(result.text, "utf8");
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.#runtime.abort();
    callback(error);
  }
}

export function createNodeStreamSanitizer(
  options: IncrementalSanitizerOptions,
): NodeStreamSanitizer {
  return new NodeStreamSanitizer(options);
}

export { StreamSanitizerError };
export type { StreamSanitizerErrorCode };
export type {
  IncrementalLimits,
  IncrementalSanitizerOptions,
  IncrementalSecretPolicy,
  SecretFinding,
} from "../types.js";
