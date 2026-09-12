import { describe, expect, test } from "vitest";

import { RESULT_SCHEMA_VERSION, type AssessmentResult } from "../schema.js";
import { renderMarkdownPerformanceReport, renderMarkdownReport } from "./report.js";
import type { AccuracyMismatch } from "./scoring.js";

function baseResult(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    surface: "node",
    profileId: "accuracy-corpus",
    accuracy: {
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 0,
      policyMismatches: 0,
    },
    provenance: {
      commit: "0".repeat(40),
      artifactIdentity: "@redact-secret/core@0.0.0-test",
      corpusVersion: "1",
      corpusHash: "0".repeat(64),
      os: "linux-6.8",
      cpu: "x86_64",
      runtime: "node-22.11.0",
      command: "node scripts/assessment-run.mjs --surface node",
    },
    ...overrides,
  };
}

describe("renderMarkdownReport", () => {
  test("requires an accuracy result", () => {
    expect(() =>
      renderMarkdownReport(baseResult({ accuracy: undefined }), []),
    ).toThrowError(/requires a result with accuracy metrics/);
  });

  test("reports a clean run with no mismatches", () => {
    const markdown = renderMarkdownReport(baseResult(), []);
    expect(markdown).toContain("# Accuracy assessment — node");
    expect(markdown).toContain("| True positives | 1 |");
    expect(markdown).toContain("None — every fixture matched its reviewed expectation.");
  });

  test("renders every mismatch kind by fixture id and metadata only, never plaintext", () => {
    const mismatches: readonly AccuracyMismatch[] = [
      {
        fixtureId: "logs-github-token",
        kind: "missing",
        detector: "github-token",
        type: "github_token",
        expectedRange: [6, 46],
        expectedPolicy: "redact",
      },
      {
        fixtureId: "chat-bearer-token",
        kind: "extra",
        detector: "bearer-token",
        type: "bearer_token",
        actualRange: [0, 10],
      },
      {
        fixtureId: "logs-contextual-secret-warn",
        kind: "policy-mismatch",
        detector: "generic-token",
        type: "contextual_secret",
        expectedRange: [38, 75],
        actualRange: [38, 75],
        expectedPolicy: "warn",
        actualPolicy: "allow",
      },
    ];
    const markdown = renderMarkdownReport(
      baseResult({
        accuracy: { truePositives: 1, falsePositives: 1, falseNegatives: 1, policyMismatches: 1 },
      }),
      mismatches,
    );

    expect(markdown).toContain("logs-github-token");
    expect(markdown).toContain("chat-bearer-token");
    expect(markdown).toContain("logs-contextual-secret-warn");
    expect(markdown).toContain("expected `warn`, got `allow`");
    // Never a matched value: the corpus's only synthetic secret shape.
    expect(markdown).not.toContain("ghp_ASSESSMENTSYNTHETIC");
  });
});

test("performance report labels sampled maxima and keeps memory categories separate", () => {
  const distribution = {
    unit: "milliseconds" as const, samples: [1, 2], minimum: 1, median: 1.5,
    p95: 2, maximum: 2, mean: 1.5, standardDeviation: 0.5,
  };
  const unavailable = {
    unit: "bytes" as const, samples: [], unavailableReason: "not exposed",
    samplingLimit: "no samples",
  };
  const markdown = renderMarkdownPerformanceReport(baseResult({
    accuracy: undefined,
    performance: {
      initialization: distribution,
      processing: distribution,
      throughput: { ...distribution, unit: "bytes-per-second" },
      memory: {
        nodeHeap: { unit: "bytes", samples: [{ baselineBytes: 10, maximumObservedBytes: 12 }], samplingLimit: "boundary samples" },
        nodeRss: unavailable,
        nodeExternal: unavailable,
        browserJsHeap: unavailable,
        wasmLinearMemory: unavailable,
        pythonHeap: unavailable,
        processRss: unavailable,
        streamingBuffer: unavailable,
      },
    },
  }));
  expect(markdown).toContain("Raw samples are preserved");
  expect(markdown).toContain("must not be summed");
  expect(markdown).toContain("not guaranteed true peaks");
});
