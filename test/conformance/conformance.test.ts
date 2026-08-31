import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { builtInDetectors } from "../../src/detectors/index.js";
import { createDetectorRegistry } from "../../src/registry.js";
import { runDetectorPipeline } from "../../src/scan.js";
import {
  assertCandidateSpecificity,
  assertPublicResultSafety,
  assertResolvedFindings,
} from "./assertions.js";
import { conformanceCorpus } from "./corpus.js";
import {
  buildCoverageRows,
  coverageDimensions,
  renderCoverageTable,
} from "./coverage.js";
import { incrementalPartitionCorpus } from "./incremental-partitions.js";
import { generateGrammarMutations } from "./qualification-corpus.js";
import { validateConformanceCorpus } from "./schema.js";

const executable = validateConformanceCorpus(conformanceCorpus).filter(
  (fixture) => fixture.support !== "not-yet-evaluated",
);
const detectorMap = new Map(
  builtInDetectors.map((detector) => [detector.id, detector]),
);

describe("detector conformance corpus", () => {
  it("covers every built-in detector and classification state", () => {
    const represented = new Set(conformanceCorpus.map(({ detector }) => detector));
    for (const detector of builtInDetectors) expect(represented.has(detector.id)).toBe(true);
    expect(new Set(conformanceCorpus.map(({ support }) => support))).toEqual(
      new Set(["supported", "intentionally-unsupported", "not-yet-evaluated"]),
    );
    expect(new Set(conformanceCorpus.map(({ kind }) => kind))).toEqual(
      new Set(["positive", "negative", "boundary", "overlap", "adversarial"]),
    );
    expect(new Set(conformanceCorpus.map(({ tier }) => tier))).toEqual(
      new Set(["canonical", "negative", "malformed", "contextual", "adversarial", "regression"]),
    );
  });

  it("requires positive, negative, boundary, and adversarial cases per detector", () => {
    for (const detector of builtInDetectors) {
      const kinds = new Set(
        conformanceCorpus
          .filter((fixture) => fixture.detector === detector.id)
          .map(({ kind }) => kind),
      );
      expect(kinds, detector.id).toEqual(
        new Set(["positive", "negative", "boundary", "overlap", "adversarial"]),
      );
    }
  });

  it.each(executable.map((fixture) => [fixture.id, fixture] as const))(
    "%s",
    (_id, fixture) => {
      const registry = createDetectorRegistry();
      const first = runDetectorPipeline(fixture.input, registry);
      const second = runDetectorPipeline(fixture.input, registry);

      assertResolvedFindings(fixture, first);
      assertResolvedFindings(fixture, second);
      assertCandidateSpecificity(fixture, detectorMap);
      assertPublicResultSafety(fixture, first);

      if (JSON.stringify(first) !== JSON.stringify(second)) {
        throw new Error(`Conformance failure ${fixture.id} (nondeterministic).`);
      }
    },
  );

  it("keeps the adversarial corpus within a bounded runtime", () => {
    for (const fixture of executable.filter(({ kind }) => kind === "adversarial")) {
      const startedAt = performance.now();
      const findings = runDetectorPipeline(fixture.input, createDetectorRegistry());
      assertResolvedFindings(fixture, findings);
      expect(fixture.resource, fixture.id).toBeDefined();
      expect(fixture.input.length, fixture.id).toBeLessThanOrEqual(
        fixture.resource?.maxInputCodeUnits ?? 0,
      );
      expect(findings.length, fixture.id).toBeLessThanOrEqual(
        fixture.resource?.maxFindings ?? 0,
      );
      expect(performance.now() - startedAt, fixture.id).toBeLessThan(
        fixture.resource?.maxRuntimeMs ?? 0,
      );
    }
  }, 2_500);

  it("has no silent stable-release coverage gaps", () => {
    const rows = buildCoverageRows(
      builtInDetectors,
      executable,
      incrementalPartitionCorpus,
    );
    for (const row of rows) {
      for (const dimension of coverageDimensions) {
        expect(row.dimensions[dimension].state, `${row.detector}:${dimension}`)
          .not.toBe("gap");
      }
    }
    const published = readFileSync(
      new URL("./COVERAGE.md", import.meta.url),
      "utf8",
    );
    expect(published).toContain(renderCoverageTable(rows));
  });

  it("generates grammar mutations in stable identity and order", () => {
    const first = generateGrammarMutations()
      .map(({ id, mutation }) => ({ id, mutation }));
    const second = generateGrammarMutations()
      .map(({ id, mutation }) => ({ id, mutation }));
    expect(first).toEqual(second);
    expect(new Set(first.map(({ id }) => id)).size).toBe(first.length);
    expect(first.some(({ mutation }) => mutation?.operation === "invalid-prefix")).toBe(true);
    expect(first.some(({ mutation }) => mutation?.operation === "encoded-prefix")).toBe(true);
  });

  it("keeps validator and assertion failures input-free", () => {
    const fixture = executable.find(
      ({ id }) => id === "contextual-positive-assignment",
    );
    if (fixture === undefined || fixture.expected === null) {
      throw new Error("Conformance failure corpus (missing-safety-fixture).");
    }
    const expected = fixture.expected[0];
    if (expected === undefined) {
      throw new Error("Conformance failure corpus (missing-safety-expectation).");
    }

    const messages: string[] = [];
    try {
      assertResolvedFindings(fixture, []);
    } catch (error) {
      messages.push(String(error));
    }
    try {
      validateConformanceCorpus([
        {
          ...fixture,
          expected: [{ ...expected, start: -1 }],
        },
      ]);
    } catch (error) {
      messages.push(String(error));
    }

    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message).not.toContain(fixture.input);
      for (const finding of fixture.expected) {
        expect(message).not.toContain(
          fixture.input.slice(finding.start, finding.end),
        );
      }
    }
  });
});
