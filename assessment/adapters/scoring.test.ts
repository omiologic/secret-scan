import { describe, expect, test } from "vitest";

import type { AssessmentFixture } from "../schema.js";
import {
  aggregateAccuracyMetrics,
  byteOffsetToUtf16CodeUnit,
  runAccuracyFixtures,
  scoreFixture,
  type ActualFinding,
} from "./scoring.js";

/** A tiny, otherwise-valid fixture a test can override fields on. */
function fixture(overrides: Partial<AssessmentFixture> = {}): AssessmentFixture {
  return {
    id: "scoring-test-fixture",
    category: "logs",
    unicode: false,
    input: "token=ghp_ASSESSMENTSYNTHETIC0000000000000000",
    expected: [
      {
        detector: "github-token",
        type: "github_token",
        confidence: "high",
        specificity: "provider",
        start: 6,
        end: 45,
        policyOutcome: "redact",
      },
    ],
    note: "scoring test fixture",
    ...overrides,
  };
}

function finding(overrides: Partial<ActualFinding> = {}): ActualFinding {
  return {
    detector: "github-token",
    type: "github_token",
    start: 6,
    end: 45,
    action: "redact",
    ...overrides,
  };
}

describe("scoreFixture: exact matches", () => {
  test("a finding matching the expectation is one true positive with no mismatch", () => {
    const result = scoreFixture(fixture(), [finding()]);
    expect(result.metrics).toEqual({
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 0,
      policyMismatches: 0,
    });
    expect(result.mismatches).toEqual([]);
  });

  test("a fixture with no expectation and no findings is a clean negative", () => {
    const result = scoreFixture(fixture({ expected: [] }), []);
    expect(result.metrics).toEqual({
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      policyMismatches: 0,
    });
  });

  test.each(["block", "redact", "warn", "allow"] as const)(
    "a matched finding whose action equals a %s expectation is not a policy mismatch",
    (action) => {
      const result = scoreFixture(
        fixture({ expected: [{ ...fixture().expected[0], policyOutcome: action }] }),
        [finding({ action })],
      );
      expect(result.metrics.policyMismatches).toBe(0);
      expect(result.metrics.truePositives).toBe(1);
    },
  );
});

describe("scoreFixture: missing, extra, and wrong-range findings", () => {
  test("an expectation with no matching finding is a false negative", () => {
    const result = scoreFixture(fixture(), []);
    expect(result.metrics).toEqual({
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 1,
      policyMismatches: 0,
    });
    expect(result.mismatches).toEqual([
      {
        fixtureId: "scoring-test-fixture",
        kind: "missing",
        detector: "github-token",
        type: "github_token",
        expectedRange: [6, 45],
        expectedPolicy: "redact",
      },
    ]);
  });

  test("a finding with no matching expectation is a false positive", () => {
    const result = scoreFixture(fixture({ expected: [] }), [finding()]);
    expect(result.metrics).toEqual({
      truePositives: 0,
      falsePositives: 1,
      falseNegatives: 0,
      policyMismatches: 0,
    });
    expect(result.mismatches).toEqual([
      {
        fixtureId: "scoring-test-fixture",
        kind: "extra",
        detector: "github-token",
        type: "github_token",
        actualRange: [6, 45],
      },
    ]);
  });

  test("a wrong-range finding is both a missing expectation and an extra finding", () => {
    // Same detector/type as the expectation but shifted by one code unit —
    // it must not silently pair with the expectation it almost matches.
    const result = scoreFixture(fixture(), [finding({ start: 7, end: 45 })]);
    expect(result.metrics).toEqual({
      truePositives: 0,
      falsePositives: 1,
      falseNegatives: 1,
      policyMismatches: 0,
    });
    expect(result.mismatches.map((m) => m.kind).sort()).toEqual(["extra", "missing"]);
  });

  test("a duplicate finding for an already-claimed span is an extra, not a second true positive", () => {
    const result = scoreFixture(fixture(), [finding(), finding()]);
    expect(result.metrics).toEqual({
      truePositives: 1,
      falsePositives: 1,
      falseNegatives: 0,
      policyMismatches: 0,
    });
  });
});

describe("scoreFixture: policy mismatches", () => {
  test("a matched finding whose action disagrees with policyOutcome is a policy mismatch", () => {
    const result = scoreFixture(fixture(), [finding({ action: "warn" })]);
    expect(result.metrics).toEqual({
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 0,
      policyMismatches: 1,
    });
    expect(result.mismatches).toEqual([
      {
        fixtureId: "scoring-test-fixture",
        kind: "policy-mismatch",
        detector: "github-token",
        type: "github_token",
        expectedRange: [6, 45],
        actualRange: [6, 45],
        expectedPolicy: "redact",
        actualPolicy: "warn",
      },
    ]);
  });
});

describe("byteOffsetToUtf16CodeUnit: Unicode normalization", () => {
  test("converts a UTF-8 byte offset past an astral character to its UTF-16 code-unit offset", () => {
    // "\u{1F511}" (a supplementary-plane key emoji) is 4 UTF-8 bytes and 2
    // UTF-16 code units, so a binding that leaked byte offsets would report
    // this span two units too far to the right.
    const input = "\u{1F511}token=ghp_ASSESSMENTSYNTHETIC0000000000000000";
    const byteStart = 4 + 6; // emoji bytes + "token="
    const byteEnd = byteStart + 39;
    expect(byteOffsetToUtf16CodeUnit(input, byteStart)).toBe(2 + 6);
    expect(byteOffsetToUtf16CodeUnit(input, byteEnd)).toBe(2 + 6 + 39);
  });

  test("scoreFixture matches a finding through a Unicode prefix using UTF-16 offsets", () => {
    const input = "\u{1F511}token=ghp_ASSESSMENTSYNTHETIC0000000000000000";
    const unicodeFixture = fixture({
      unicode: true,
      input,
      expected: [{ ...fixture().expected[0], start: 4 + 6, end: 4 + 6 + 39 }],
    });
    const result = scoreFixture(unicodeFixture, [finding({ start: 2 + 6, end: 2 + 6 + 39 })]);
    expect(result.metrics.truePositives).toBe(1);
    expect(result.mismatches).toEqual([]);
  });
});

describe("aggregateAccuracyMetrics", () => {
  test("sums per-fixture metrics across the corpus", () => {
    const clean = scoreFixture(fixture(), [finding()]);
    const missed = scoreFixture(fixture({ id: "second-fixture" }), []);
    expect(aggregateAccuracyMetrics([clean, missed])).toEqual({
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 1,
      policyMismatches: 0,
    });
  });

  test("an empty result list aggregates to all zeros, not an absent report", () => {
    expect(aggregateAccuracyMetrics([])).toEqual({
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      policyMismatches: 0,
    });
  });
});

describe("runAccuracyFixtures: runner failure", () => {
  test("scores every fixture and aggregates across the corpus", async () => {
    const fixtures = [fixture(), fixture({ id: "second-fixture", expected: [] })];
    const run = await runAccuracyFixtures(fixtures, () => [finding()]);
    expect(run.fixturesEvaluated).toBe(2);
    // The first fixture's finding matches; the second fixture expects
    // nothing, so the same finding there is an extra.
    expect(run.metrics).toEqual({
      truePositives: 1,
      falsePositives: 1,
      falseNegatives: 0,
      policyMismatches: 0,
    });
  });

  test("a scan rejection aborts the run rather than becoming a zero-finding result", async () => {
    const fixtures = [fixture(), fixture({ id: "second-fixture" })];
    let calls = 0;
    const scan = () => {
      calls += 1;
      if (calls === 2) throw new Error("simulated runner failure");
      return [finding()];
    };
    await expect(runAccuracyFixtures(fixtures, scan)).rejects.toThrow(
      "simulated runner failure",
    );
  });
});
