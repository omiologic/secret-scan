import { describe, expect, test } from "vitest";

import {
  availableMemory, measureAsyncOperation, measureOperation, summarizeDistribution,
  unavailableMemory,
} from "./performance.js";

describe("performance aggregation (issue #194)", () => {
  test("preserves raw samples and validates known distribution values", () => {
    expect(summarizeDistribution([1, 2, 3, 4], "milliseconds")).toEqual({
      unit: "milliseconds",
      samples: [1, 2, 3, 4],
      minimum: 1,
      median: 2.5,
      p95: 4,
      maximum: 4,
      mean: 2.5,
      standardDeviation: Math.sqrt(1.25),
    });
  });

  test("rejects empty or invalid timing samples", () => {
    expect(() => summarizeDistribution([], "milliseconds")).toThrow(/non-empty/);
    expect(() => summarizeDistribution([Number.NaN], "milliseconds")).toThrow(/finite/);
  });

  test("keeps available and unavailable memory structurally distinct", () => {
    expect(availableMemory([{ baselineBytes: 10, maximumObservedBytes: 12 }], "boundary"))
      .toEqual({
        unit: "bytes",
        samples: [{ baselineBytes: 10, maximumObservedBytes: 12 }],
        samplingLimit: "boundary",
      });
    expect(unavailableMemory("not exposed", "no samples")).toEqual({
      unit: "bytes",
      samples: [],
      unavailableReason: "not exposed",
      samplingLimit: "no samples",
    });
  });

  test("places only the requested operation inside sync and async timing boundaries", async () => {
    const syncEvents: string[] = [];
    const syncTimes = [10, 14];
    const sync = measureOperation(
      () => { syncEvents.push("clock"); return syncTimes.shift() ?? 0; },
      () => { syncEvents.push("operation"); return 7; },
    );
    expect(sync).toEqual({ elapsedMs: 4, value: 7 });
    expect(syncEvents).toEqual(["clock", "operation", "clock"]);

    const asyncEvents: string[] = [];
    const asyncTimes = [20, 25];
    const measured = await measureAsyncOperation(
      () => { asyncEvents.push("clock"); return asyncTimes.shift() ?? 0; },
      async () => { asyncEvents.push("operation"); return 9; },
    );
    expect(measured).toEqual({ elapsedMs: 5, value: 9 });
    expect(asyncEvents).toEqual(["clock", "operation", "clock"]);
  });
});
