import { describe, expect, it } from "vitest";

import {
  createWebStreamSanitizer,
  StreamSanitizerError,
} from "../../src/adapters/web-stream.js";
import { IncrementalSanitizerError } from "../../src/incremental.js";
import { incrementalPartitionCorpus } from "../conformance/incremental-partitions.js";

const LIMITS = Object.freeze({
  maxInputCodeUnits: 32_768,
  maxBufferedCodeUnits: 16_512,
  maxTokenCodeUnits: 8_192,
  maxMultilineCodeUnits: 16_384,
});

async function sanitize(chunks: readonly Uint8Array[]) {
  const transform = createWebStreamSanitizer({ limits: LIMITS });
  const writer = transform.writable.getWriter();
  const reader = transform.readable.getReader();
  const output: string[] = [];
  const writing = (async () => {
    for (const chunk of chunks) await writer.write(chunk);
    await writer.close();
  })();
  const reading = (async () => {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      output.push(result.value);
    }
  })();
  await Promise.all([writing, reading]);
  return { text: output.join(""), findings: transform.findings };
}

describe("Web stream adapter", () => {
  it("matches the incremental corpus at every UTF-8 byte boundary", async () => {
    const encoder = new TextEncoder();
    for (const fixture of incrementalPartitionCorpus) {
      const bytes = encoder.encode(fixture.input);
      for (let boundary = 0; boundary <= bytes.length; boundary += 1) {
        await expect(sanitize([
          bytes.slice(0, boundary),
          bytes.slice(boundary),
        ]), fixture.id).resolves.toEqual(fixture.expected);
      }
    }
  });

  it("flushes empty streams and exposes immutable findings", async () => {
    await expect(sanitize([])).resolves.toEqual({ text: "", findings: [] });
    const result = await sanitize([
      new TextEncoder().encode("api_key=SYNTHETIC_REVOKED_WEB_FINDING"),
    ]);
    expect(Object.isFrozen(result.findings)).toBe(true);
    expect(result.findings).toHaveLength(1);
  });

  it("propagates backpressure and preserves fragmented output order", async () => {
    const input = Array.from({ length: 256 }, (_, index) => `line-${index}\n`).join("");
    const bytes = new TextEncoder().encode(input);
    await expect(sanitize(
      Array.from(bytes, (byte) => Uint8Array.of(byte)),
    )).resolves.toMatchObject({ text: input });
  });

  it("cancels without releasing an open buffered value", async () => {
    const transform = createWebStreamSanitizer({ limits: LIMITS });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const pendingRead = reader.read();
    await writer.write(new TextEncoder().encode(
      "api_key=SYNTHETIC_REVOKED_WEB_CANCEL",
    ));
    await reader.cancel();
    await expect(pendingRead).resolves.toEqual({ value: undefined, done: true });
    expect(transform.findings).toEqual([]);
  });

  it("uses fixed errors and releases no buffered plaintext on failure", async () => {
    const input = "api_key=SYNTHETIC_REVOKED_WEB_FAILURE";
    const transform = createWebStreamSanitizer({
      limits: LIMITS,
      placeholderFormatter() { throw new Error(input); },
    });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const reading = reader.read().catch((error: unknown) => error);
    await writer.write(new TextEncoder().encode(input));
    await expect(writer.close()).rejects.toBeInstanceOf(IncrementalSanitizerError);
    await expect(reading).resolves.toSatisfy((error: unknown) =>
      error instanceof IncrementalSanitizerError && !String(error).includes(input));

    const invalid = createWebStreamSanitizer({ limits: LIMITS });
    const invalidWriter = invalid.writable.getWriter();
    const invalidReader = invalid.readable.getReader();
    const invalidReading = invalidReader.read().catch((error: unknown) => error);
    const invalidWriting = invalidWriter.write(Uint8Array.of(0xc3, 0x28))
      .catch((error: unknown) => error);
    await expect(invalidWriting).resolves.toBeInstanceOf(StreamSanitizerError);
    await expect(invalidReading).resolves.toBeInstanceOf(StreamSanitizerError);
  });
});
