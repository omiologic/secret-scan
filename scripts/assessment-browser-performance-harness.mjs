import { createIncrementalSanitizer, initialize, scanAndRedact } from "@redact-secret/core";
import { generateWorkloadInput } from "../assessment/generate.js";
import { measureAsyncOperation, measureOperation } from "../assessment/adapters/performance.js";

function chunksFor(input, chunkProfile) {
  if (chunkProfile === "whole") return [input];
  if (chunkProfile === "utf16-boundary") return [...input];
  const maximumBytes = Number(chunkProfile.slice("fixed-".length));
  const encoder = new TextEncoder();
  const chunks = [];
  let chunk = "";
  let bytes = 0;
  for (const scalar of input) {
    const scalarBytes = encoder.encode(scalar).length;
    if (chunk.length > 0 && bytes + scalarBytes > maximumBytes) {
      chunks.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += scalar;
    bytes += scalarBytes;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

function processInput(input, chunks, chunkProfile) {
  if (chunkProfile === "whole") {
    const result = scanAndRedact(input);
    return result.text.length + result.findings.length;
  }
  const session = createIncrementalSanitizer({
    limits: {
      maxInputCodeUnits: input.length + 1,
      maxBufferedCodeUnits: 32_896,
      maxTokenCodeUnits: 8_192,
      maxMultilineCodeUnits: 32_768,
    },
  });
  let sink = 0;
  for (const chunk of chunks) {
    const result = session.append(chunk);
    sink += result.text.length + result.findings.length;
  }
  const final = session.finalize();
  return sink + final.text.length + final.findings.length;
}

function browserHeapBytes() {
  const value = globalThis.performance.memory?.usedJSHeapSize;
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export async function measure(profile) {
  const input = generateWorkloadInput(profile);
  const inputBytes = new TextEncoder().encode(input).length;
  const chunks = chunksFor(input, profile.chunkProfile);

  const initialization = await measureAsyncOperation(
    () => performance.now(),
    () => initialize(),
  );
  processInput(input, chunks, profile.chunkProfile);

  const baselineHeap = browserHeapBytes();
  const processing = measureOperation(
    () => performance.now(),
    () => processInput(input, chunks, profile.chunkProfile),
  );
  const afterHeap = browserHeapBytes();
  if (!Number.isSafeInteger(processing.value)) throw new Error("processing did not complete");
  return {
    initializationMs: initialization.elapsedMs,
    processingMs: processing.elapsedMs,
    throughputBytesPerSecond: processing.elapsedMs === 0 ? 0 : inputBytes / (processing.elapsedMs / 1000),
    browserHeap: baselineHeap === undefined || afterHeap === undefined ? undefined : {
      baselineBytes: baselineHeap,
      maximumObservedBytes: Math.max(baselineHeap, afterHeap),
    },
  };
}
