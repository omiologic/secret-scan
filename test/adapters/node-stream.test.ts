import { once } from "node:events";
import { Readable } from "node:stream";
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

  it("honors native backpressure while preserving output order", async () => {
    const transform = createNodeStreamSanitizer({ limits: LIMITS });
    const input = Array.from({ length: 256 }, (_, index) => `line-${index}\n`).join("");
    const source = Readable.from(
      Array.from(new TextEncoder().encode(input), (byte) => Uint8Array.of(byte)),
    );
    const output: Buffer[] = [];
    for await (const chunk of source.pipe(transform)) output.push(chunk as Buffer);
    expect(Buffer.concat(output).toString("utf8")).toBe(input);
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
});
