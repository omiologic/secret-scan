import { describe, expect, it } from "vitest";

import { builtInDetectors } from "../../src/detectors/index.js";
import { createDetectorRegistry } from "../../src/registry.js";
import { runDetectorPipeline } from "../../src/scan.js";
import {
  assertCandidateSpecificity,
  assertPublicResultSafety,
  assertResolvedFindings,
} from "./assertions.js";
import { conformanceCorpus } from "./corpus.js";
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
    const startedAt = Date.now();
    for (const fixture of executable.filter(({ kind }) => kind === "adversarial")) {
      const findings = runDetectorPipeline(fixture.input, createDetectorRegistry());
      assertResolvedFindings(fixture, findings);
    }
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  }, 2_500);

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
