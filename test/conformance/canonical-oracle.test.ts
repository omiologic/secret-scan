import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { builtInDetectors } from "../../src/detectors/index.js";
import { createDetectorRegistry } from "../../src/registry.js";
import { runDetectorPipeline } from "../../src/scan.js";
import { scanAndRedact } from "../../src/index.js";
import {
  assertCandidateSpecificity,
  assertPublicResultSafety,
  assertResolvedFindings,
} from "./assertions.js";
import { conformanceCorpus } from "./corpus.js";
import type { ConformanceCase } from "./schema.js";
import { validateConformanceCorpus } from "./schema.js";
import {
  convertCorpusToCanonical,
  utf8ByteOffsetToUtf16Offset,
} from "../../conformance/convert.js";
import type { CanonicalFixture } from "../../conformance/schema.js";
import { validateCanonicalFixtures } from "../../conformance/schema.js";

/**
 * Proves the persisted canonical corpus (`conformance/fixtures/synchronous-corpus.json`),
 * not just the in-memory conversion exercised by `conversion.test.ts`, against the
 * current TypeScript implementation. `decision-govern-cross-language-conformance`
 * makes the canonical, UTF-8-byte-offset corpus the eventual single behavioral
 * contract; this file is the TypeScript oracle's proof that its committed export
 * still matches what the detector, policy, and redaction pipeline actually does.
 */

const CORPUS_URL = new URL(
  "../../conformance/fixtures/synchronous-corpus.json",
  import.meta.url,
);

interface CanonicalCorpusFile {
  readonly offsetUnit: string;
  readonly fixtureCount: number;
  readonly fixtures: readonly CanonicalFixture[];
}

const raw = JSON.parse(
  readFileSync(CORPUS_URL, "utf8"),
) as CanonicalCorpusFile;
const canonical = validateCanonicalFixtures(raw.fixtures);

/** Converts a canonical (UTF-8 byte offset) fixture back to the temporary
 * oracle's UTF-16 shape so it can be run through the existing safe assertion
 * helpers and compared with what the detector pipeline actually returns. */
function toUtf16Case(fixture: CanonicalFixture): ConformanceCase {
  return {
    id: fixture.id,
    detector: fixture.detector,
    kind: fixture.kind,
    support: fixture.support,
    tier: fixture.tier,
    contexts: fixture.contexts,
    input: fixture.input,
    expected: fixture.expected === null
      ? null
      : fixture.expected.map((expected) => ({
        detector: expected.detector,
        type: expected.type,
        confidence: expected.confidence,
        specificity: expected.specificity,
        start: utf8ByteOffsetToUtf16Offset(fixture.input, expected.start),
        end: utf8ByteOffsetToUtf16Offset(fixture.input, expected.end),
      })),
    note: fixture.note,
  };
}

const executable = canonical
  .filter((fixture) => fixture.support !== "not-yet-evaluated")
  .map(toUtf16Case);
const detectorMap = new Map(
  builtInDetectors.map((detector) => [detector.id, detector]),
);

describe("canonical corpus oracle", () => {
  it("is declared UTF-8-byte-offset JSON with an accurate fixture count", () => {
    expect(raw.offsetUnit).toBe("utf8-byte");
    expect(raw.fixtureCount).toBe(raw.fixtures.length);
  });

  it("matches a fresh conversion of the temporary oracle's corpus, with no drift", () => {
    const fresh = convertCorpusToCanonical(validateConformanceCorpus(conformanceCorpus));
    expect(raw.fixtures).toEqual(fresh);
  });

  it.each(executable.map((fixture) => [fixture.id, fixture] as const))(
    "%s",
    (_id, fixture) => {
      const registry = createDetectorRegistry();
      const findings = runDetectorPipeline(fixture.input, registry);

      assertResolvedFindings(fixture, findings);
      assertCandidateSpecificity(fixture, detectorMap);
      assertPublicResultSafety(fixture, findings);
    },
  );

  it("retains pending fixtures as reviewed but unasserted", () => {
    const pending = canonical.filter(
      (fixture) => fixture.support === "not-yet-evaluated",
    );
    expect(pending.length).toBeGreaterThan(0);
    for (const fixture of pending) expect(fixture.expected).toBeNull();
  });

  it("produces exactly the migrated expected findings and redacted output", () => {
    for (const fixture of executable) {
      if (fixture.expected === null || fixture.expected.length === 0) continue;

      const result = scanAndRedact(fixture.input);
      if (
        result.findings.length !== fixture.expected.length ||
        result.findings.some((finding, index) => {
          const expected = fixture.expected?.[index];
          return (
            expected === undefined ||
            finding.detector !== expected.detector ||
            finding.type !== expected.type ||
            finding.confidence !== expected.confidence ||
            finding.start !== expected.start ||
            finding.end !== expected.end
          );
        })
      ) {
        throw new Error(`Conformance failure ${fixture.id} (redaction-finding-mismatch).`);
      }

      for (const finding of result.findings) {
        const matched = fixture.input.slice(finding.start, finding.end);
        if (matched.length < 4) continue;
        const stillPresent = result.text.includes(matched);
        const shouldBeRemoved = finding.action === "redact" || finding.action === "block";
        if (shouldBeRemoved && stillPresent) {
          throw new Error(`Conformance failure ${fixture.id} (unredacted-secret): ${finding.detector}`);
        }
        if (!shouldBeRemoved && !stillPresent) {
          throw new Error(`Conformance failure ${fixture.id} (unexpected-redaction): ${finding.detector}`);
        }
      }
    }
  });
});
