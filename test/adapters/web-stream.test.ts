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

const FINALIZED_PREFIX_INPUT =
  "api_key=SYNTHETIC_REVOKED_WEB_FINALIZED\n";
const FINALIZED_PREFIX_OUTPUT = "api_key=<SECRET_1>\n";
const UNRESOLVED_INPUT = "api_key=SYNTHETIC_REVOKED_WEB_UNRESOLVED";

async function writeAndRead(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<string>,
  input: string,
): Promise<string> {
  const writing = writer.write(new TextEncoder().encode(input));
  const result = await reader.read();
  await writing;
  expect(result.done).toBe(false);
  return result.value ?? "";
}

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

  it("stalls writes at native readable backpressure and resumes after a pull", async () => {
    const transform = createWebStreamSanitizer({ limits: LIMITS });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    let settled = false;
    const writing = writer.write(new TextEncoder().encode("ordinary line\n"))
      .then(() => { settled = true; });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(writer.desiredSize).toBe(0);

    await expect(reader.read()).resolves.toEqual({
      value: "ordinary line\n",
      done: false,
    });
    await writing;
    expect(settled).toBe(true);

    const closing = writer.close();
    await expect(reader.read()).resolves.toEqual({ value: undefined, done: true });
    await closing;
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

  it("keeps finalized output but discards unresolved plaintext on readable cancellation", async () => {
    const transform = createWebStreamSanitizer({ limits: LIMITS });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const output = await writeAndRead(
      writer,
      reader,
      FINALIZED_PREFIX_INPUT + UNRESOLVED_INPUT,
    );
    const pendingRead = reader.read();
    const reason = new Error("Synthetic readable cancellation.");

    await reader.cancel(reason);
    await expect(pendingRead).resolves.toEqual({ value: undefined, done: true });
    await expect(writer.close()).rejects.toBeInstanceOf(TypeError);
    expect(output).toBe(FINALIZED_PREFIX_OUTPUT);
    expect(Object.isFrozen(transform.findings)).toBe(true);
    expect(transform.findings).toHaveLength(1);
    expect(Object.isFrozen(transform.findings[0])).toBe(true);
  });

  it("keeps finalized output but discards unresolved plaintext on writable abort", async () => {
    const transform = createWebStreamSanitizer({ limits: LIMITS });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const output = await writeAndRead(
      writer,
      reader,
      FINALIZED_PREFIX_INPUT + UNRESOLVED_INPUT,
    );
    const pendingRead = reader.read();
    const reason = new Error("Synthetic writable abort.");

    await writer.abort(reason);
    await expect(pendingRead).rejects.toBe(reason);
    expect(output).toBe(FINALIZED_PREFIX_OUTPUT);
    expect(Object.isFrozen(transform.findings)).toBe(true);
    expect(transform.findings).toHaveLength(1);
    expect(Object.isFrozen(transform.findings[0])).toBe(true);
  });

  it("makes explicit abort idempotently win when it precedes close", async () => {
    const transform = createWebStreamSanitizer({ limits: LIMITS });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    await writer.write(new TextEncoder().encode(UNRESOLVED_INPUT));

    transform.abort();
    transform.abort();
    const closing = writer.close();
    const reading = reader.read();

    await expect(closing).rejects.toBeInstanceOf(IncrementalSanitizerError);
    await expect(reading).rejects.toSatisfy((error: unknown) =>
      error instanceof IncrementalSanitizerError
      && error.message === "The incremental sanitizer is no longer accepting input."
      && !error.message.includes(UNRESOLVED_INPUT));
    expect(transform.findings).toEqual([]);
  });

  it("lets close safely finalize when it precedes explicit abort", async () => {
    const transform = createWebStreamSanitizer({ limits: LIMITS });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    await writer.write(new TextEncoder().encode(UNRESOLVED_INPUT));

    const closing = writer.close();
    transform.abort();

    await expect(reader.read()).resolves.toEqual({
      value: "api_key=<SECRET_1>",
      done: false,
    });
    await expect(reader.read()).resolves.toEqual({ value: undefined, done: true });
    await closing;
    expect(transform.findings).toHaveLength(1);
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

  it("keeps only finalized output when malformed UTF-8 follows buffered plaintext", async () => {
    const transform = createWebStreamSanitizer({ limits: LIMITS });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const output = await writeAndRead(
      writer,
      reader,
      FINALIZED_PREFIX_INPUT + UNRESOLVED_INPUT,
    );
    const reading = reader.read();
    const writing = writer.write(Uint8Array.of(0xc3, 0x28));

    await expect(writing).rejects.toSatisfy((error: unknown) =>
      error instanceof StreamSanitizerError
      && error.message === "Stream sanitizer input is not valid UTF-8."
      && !("cause" in error));
    await expect(reading).rejects.toBeInstanceOf(StreamSanitizerError);
    expect(output).toBe(FINALIZED_PREFIX_OUTPUT);
    expect(Object.isFrozen(transform.findings)).toBe(true);
    expect(transform.findings).toHaveLength(1);
    expect(Object.isFrozen(transform.findings[0])).toBe(true);
  });
});
