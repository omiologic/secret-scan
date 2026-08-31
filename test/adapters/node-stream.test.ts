import { once } from "node:events";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { describe, expect, it } from "vitest";

import {
  createNodeStreamSanitizer,
  StreamSanitizerError,
} from "../../src/adapters/node-stream.js";
import { IncrementalSanitizerError } from "../../src/incremental.js";
import { incrementalPartitionCorpus } from "../conformance/incremental-partitions.js";

const LIMITS = Object.freeze({
  maxInputCodeUnits: 32_768,
  maxBufferedCodeUnits: 16_512,
  maxTokenCodeUnits: 8_192,
  maxMultilineCodeUnits: 16_384,
});

const BACKPRESSURE_LIMITS = Object.freeze({
  maxInputCodeUnits: 1_048_576,
  maxBufferedCodeUnits: 16_512,
  maxTokenCodeUnits: 8_192,
  maxMultilineCodeUnits: 16_384,
});

const FINALIZED_PREFIX_INPUT =
  "api_key=SYNTHETIC_REVOKED_NODE_FINALIZED\n";
const FINALIZED_PREFIX_OUTPUT = "api_key=<SECRET_1>\n";
const UNRESOLVED_INPUT = "api_key=SYNTHETIC_REVOKED_NODE_UNRESOLVED";

async function sanitize(chunks: readonly Uint8Array[]) {
  const transform = createNodeStreamSanitizer({ limits: LIMITS });
  const output: Buffer[] = [];
  for await (const chunk of Readable.from(chunks).pipe(transform)) {
    output.push(chunk as Buffer);
  }
  return {
    text: Buffer.concat(output).toString("utf8"),
    findings: transform.findings,
  };
}

describe("Node stream adapter", () => {
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
    const empty = createNodeStreamSanitizer({ limits: LIMITS });
    const chunks: Buffer[] = [];
    for await (const chunk of Readable.from([]).pipe(empty)) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString("utf8")).toBe("");
    expect(empty.findings).toEqual([]);

    const result = await sanitize([
      new TextEncoder().encode("api_key=SYNTHETIC_REVOKED_NODE_FINDING"),
    ]);
    expect(Object.isFrozen(result.findings)).toBe(true);
    expect(result.findings).toHaveLength(1);
  });

  it("stalls producers at native backpressure and resumes on drain", async () => {
    const transform = createNodeStreamSanitizer({ limits: BACKPRESSURE_LIMITS });
    const output: Buffer[] = [];
    const written: Buffer[] = [];
    let stalled = false;

    for (let index = 0; index < 512; index += 1) {
      const chunk = Buffer.from(`line-${index}-${"x".repeat(1_000)}\n`);
      written.push(chunk);
      if (!transform.write(chunk)) {
        stalled = true;
        break;
      }
    }

    expect(stalled).toBe(true);
    expect(transform.writableNeedDrain).toBe(true);
    expect(transform.readableLength).toBeGreaterThan(0);

    const drained = once(transform, "drain");
    transform.on("data", (chunk: Buffer) => output.push(chunk));
    await drained;

    const ended = once(transform, "end");
    transform.end();
    await ended;
    expect(Buffer.concat(output)).toEqual(Buffer.concat(written));
  });

  it("destroys early without emitting an open buffered value", async () => {
    const transform = createNodeStreamSanitizer({ limits: LIMITS });
    const output: Buffer[] = [];
    transform.on("data", (chunk: Buffer) => output.push(chunk));
    transform.write(Buffer.from("api_key=SYNTHETIC_REVOKED_NODE_ABORT"));
    transform.destroy();
    await once(transform, "close");
    expect(Buffer.concat(output).toString("utf8")).toBe("");
    expect(transform.findings).toEqual([]);
  });

  it("keeps finalized output but discards unresolved plaintext on downstream failure", async () => {
    const transform = createNodeStreamSanitizer({ limits: LIMITS });
    const output: Buffer[] = [];
    let supplied = false;
    const source = new Readable({
      read() {
        if (supplied) return;
        supplied = true;
        this.push(Buffer.from(FINALIZED_PREFIX_INPUT + UNRESOLVED_INPUT));
      },
    });
    const downstreamError = new Error("Synthetic downstream failure.");
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output.push(chunk);
        callback(downstreamError);
      },
    });

    await expect(pipeline(source, transform, sink)).rejects.toBe(downstreamError);
    expect(Buffer.concat(output).toString("utf8")).toBe(FINALIZED_PREFIX_OUTPUT);
    expect(transform.destroyed).toBe(true);
    expect(Object.isFrozen(transform.findings)).toBe(true);
    expect(transform.findings).toHaveLength(1);
    expect(Object.isFrozen(transform.findings[0])).toBe(true);
  });

  it("makes destroy idempotently win over later terminal calls", async () => {
    const transform = createNodeStreamSanitizer({ limits: LIMITS });
    const output: Buffer[] = [];
    let closeCount = 0;
    transform.on("data", (chunk: Buffer) => output.push(chunk));
    transform.on("close", () => { closeCount += 1; });
    transform.write(Buffer.from(UNRESOLVED_INPUT));

    transform.destroy();
    transform.destroy();
    transform.end();
    await once(transform, "close");

    expect(closeCount).toBe(1);
    expect(Buffer.concat(output).toString("utf8")).toBe("");
    expect(transform.findings).toEqual([]);
  });

  it("uses fixed errors and releases no buffered plaintext on failure", async () => {
    const input = "api_key=SYNTHETIC_REVOKED_NODE_FAILURE";
    const transform = createNodeStreamSanitizer({
      limits: LIMITS,
      placeholderFormatter() { throw new Error(input); },
    });
    const output: Buffer[] = [];
    transform.on("data", (chunk: Buffer) => output.push(chunk));
    transform.end(Buffer.from(input));
    const [error] = await once(transform, "error") as [Error];
    expect(error).toBeInstanceOf(IncrementalSanitizerError);
    expect(String(error)).not.toContain(input);
    expect(Buffer.concat(output).toString("utf8")).toBe("");

    const invalid = createNodeStreamSanitizer({ limits: LIMITS });
    invalid.end(Uint8Array.of(0xc3, 0x28));
    const [decodeError] = await once(invalid, "error") as [Error];
    expect(decodeError).toBeInstanceOf(StreamSanitizerError);
    expect(decodeError.message).toBe("Stream sanitizer input is not valid UTF-8.");
  });

  it("keeps only finalized output when malformed UTF-8 follows buffered plaintext", async () => {
    const transform = createNodeStreamSanitizer({ limits: LIMITS });
    const output: Buffer[] = [];
    transform.on("data", (chunk: Buffer) => output.push(chunk));
    transform.write(Buffer.from(FINALIZED_PREFIX_INPUT + UNRESOLVED_INPUT));

    transform.end(Uint8Array.of(0xc3, 0x28));
    const [error] = await once(transform, "error") as [Error];
    expect(error).toBeInstanceOf(StreamSanitizerError);
    expect(error.message).toBe("Stream sanitizer input is not valid UTF-8.");
    expect(error).not.toHaveProperty("cause");
    expect(Buffer.concat(output).toString("utf8")).toBe(FINALIZED_PREFIX_OUTPUT);
    expect(Object.isFrozen(transform.findings)).toBe(true);
    expect(transform.findings).toHaveLength(1);
    expect(Object.isFrozen(transform.findings[0])).toBe(true);
  });
});
