/**
 * The N-API addon binding's own adapter contract (`runtime/node.ts`).
 *
 * Every test here runs against `createBindingFromAddon` — the same
 * normalization `runtime/node.ts` applies to the real per-platform addon
 * (`@omiologic/secret-scan-<platform>`), exercised here against a plain
 * object double instead of the compiled addon, which is not present in a
 * source checkout.
 */

import { describe, expect, it } from "vitest";

import { createBindingFromAddon } from "../src/runtime/node.js";
import { sampleFinding } from "./fake-binding.js";

const LIMITS = {
  maxInputCodeUnits: 1_024,
  maxBufferedCodeUnits: 384,
  maxTokenCodeUnits: 128,
  maxMultilineCodeUnits: 256,
};

describe("Node addon binding: createIncrementalSanitizer", () => {
  it("rejects with a fixed code when the addon has no such export", () => {
    const binding = createBindingFromAddon({
      version: () => "0.0.0-test",
      initialize: () => {},
      scan: () => [],
      redact: (input) => input,
      scanAndRedact: (input) => ({ findings: [], redacted: input }),
    });

    expect(() =>
      binding.createIncrementalSanitizer({ limits: LIMITS }),
    ).toThrowError(
      expect.objectContaining({
        name: "SecretScanError",
        code: "INCREMENTAL_UNAVAILABLE",
      }),
    );
  });

  it("delegates to the addon's own export when present", () => {
    const calls: string[] = [];
    const binding = createBindingFromAddon({
      version: () => "0.0.0-test",
      initialize: () => {},
      scan: () => [],
      redact: (input) => input,
      scanAndRedact: (input) => ({ findings: [], redacted: input }),
      createIncrementalSanitizer: (options) => {
        calls.push(`createIncrementalSanitizer:${options.limits.maxInputCodeUnits}`);
        return {
          state: "accepting",
          append: (chunk) => ({ text: chunk, findings: [] }),
          finalize: () => ({ text: "", findings: [sampleFinding] }),
          abort: () => {},
        };
      },
    });

    const session = binding.createIncrementalSanitizer({ limits: LIMITS });

    expect(calls).toEqual([`createIncrementalSanitizer:${LIMITS.maxInputCodeUnits}`]);
    expect(session.finalize()).toEqual({ text: "", findings: [sampleFinding] });
  });
});

describe("Node addon binding: scanAndRedact result shape", () => {
  it("renames the addon's redacted field to the contract's text", () => {
    const binding = createBindingFromAddon({
      version: () => "0.0.0-test",
      initialize: () => {},
      scan: () => [],
      redact: (input) => input,
      scanAndRedact: () => ({ findings: [sampleFinding], redacted: "<SECRET_1>" }),
    });

    expect(binding.scanAndRedact("input", undefined, undefined)).toEqual({
      text: "<SECRET_1>",
      findings: [sampleFinding],
    });
  });
});
