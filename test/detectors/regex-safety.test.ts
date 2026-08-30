import { describe, expect, it } from "vitest";

import { createDetectorRegistry } from "../../src/registry.js";
import { runDetectorPipeline } from "../../src/scan.js";

describe("regex safety", () => {
  it("handles long near-matches without findings", () => {
    const fragments = [
      `-----BEGIN PRIVATE KEY-----\n${"A".repeat(100_000)}`,
      `AKIA${"A".repeat(100_000)}`,
      `ghp_${"A".repeat(100_000)}`,
      `glpat-${"SYNTHETIC_REVOKED_".repeat(6_250)}!`,
      `eyJ${"A".repeat(100_000)}.missing`,
      `Bearer ${"!".repeat(100_000)}`,
      `sk-proj-${"A".repeat(100_000)}!`,
      `sk-ant-api03-${"A".repeat(100_000)}!`,
      `shpat_${"SYNTHETIC_REVOKED_".repeat(6_250)}!`,
      `hvs.${"SYNTHETIC_REVOKED_".repeat(6_250)}!`,
      `api_key="${"\\".repeat(100_000)}`,
    ];

    for (const input of fragments) {
      const result = runDetectorPipeline(input, createDetectorRegistry());
      expect(result.length).toBeLessThanOrEqual(1);
    }
  }, 2_000);

  it("scans a one-megabyte ordinary input deterministically", () => {
    const input = "ordinary text 1234\n".repeat(55_000);
    expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([]);
  }, 2_000);

  it("handles many unmatched private-key headers without repeated suffix searches", () => {
    const input = "-----BEGIN PRIVATE KEY-----\n".repeat(10_000);
    const result = runDetectorPipeline(input, createDetectorRegistry());

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "private_key",
      detector: "private-key",
      start: 0,
      end: input.length,
    });
  }, 2_000);

  it("finds one full span for a large complete private-key block", () => {
    const input = [
      "-----BEGIN PRIVATE KEY-----",
      "U1lOVEhFVElDX1JFVk9LRURfQk9EWQ==".repeat(32_000),
      "-----END PRIVATE KEY-----",
    ].join("\n");
    const result = runDetectorPipeline(input, createDetectorRegistry());

    expect(result).toEqual([
      {
        id: "finding-1",
        type: "private_key",
        detector: "private-key",
        confidence: "high",
        start: 0,
        end: input.length,
      },
    ]);
  }, 2_000);
});
