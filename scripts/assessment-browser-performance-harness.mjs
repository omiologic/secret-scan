import { createIncrementalSanitizer, initialize, scanAndRedact } from "@redact-secret/core";
import { generateWorkloadInput } from "../assessment/generate.js";
import {
  measureAsyncOperation, measureOperation, partitionInput,
} from "../assessment/adapters/performance.js";

function processInput(input, chunks, chunkProfile, inputLimit) {
  if (chunkProfile === "whole") {
    const result = scanAndRedact(input);
    return result.text.length + result.findings.length;
  }
  const session = createIncrementalSanitizer({
    limits: {
      maxInputCodeUnits: inputLimit,
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
  const inputLimit = inputBytes + 1;
  const chunks = partitionInput(input, profile.chunkProfile);

  const initialization = await measureAsyncOperation(
    () => performance.now(),
    () => initialize(),
  );
  processInput(input, chunks, profile.chunkProfile, inputLimit);

  const baselineHeap = browserHeapBytes();
  const processing = measureOperation(
    () => performance.now(),
    () => processInput(input, chunks, profile.chunkProfile, inputLimit),
  );
  const afterHeap = browserHeapBytes();
  if (!Number.isSafeInteger(processing.value)) throw new Error("processing did not complete");
  if (processing.elapsedMs <= 0) throw new Error("processing duration was not positive");
  return {
    initializationMs: initialization.elapsedMs,
    processingMs: processing.elapsedMs,
    throughputBytesPerSecond: inputBytes / (processing.elapsedMs / 1000),
    browserHeap: baselineHeap === undefined || afterHeap === undefined ? undefined : {
      baselineBytes: baselineHeap,
      maximumObservedBytes: Math.max(baselineHeap, afterHeap),
    },
  };
}
