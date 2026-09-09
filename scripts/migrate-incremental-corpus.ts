import { writeFileSync, mkdirSync } from "node:fs";

import { conformanceCorpus } from "../test/conformance/corpus.js";
import { incrementalPartitionCorpus } from "../test/conformance/incremental-partitions.js";
import { validateConformanceCorpus } from "../test/conformance/schema.js";
import {
  convertCorpusToCanonical,
  convertIncrementalCorpusToCanonical,
} from "../conformance/convert.js";
import type { Utf16IncrementalFixture } from "../conformance/convert.js";
import {
  validateCanonicalErrorCodes,
  validateCanonicalFixtures,
  validateCanonicalIncrementalFixtures,
  validateCanonicalLifecycleFixtures,
} from "../conformance/schema.js";
import type { CanonicalExpectation } from "../conformance/schema.js";
import { unicodeAstralFixtures } from "../conformance/fixtures/unicode-astral.source.js";
import { incrementalLifecycleFixtures } from "../conformance/fixtures/incremental-lifecycle.source.js";
import { errorCodeFixtures } from "../conformance/fixtures/error-codes.source.js";

/**
 * Migration tooling, not a canonical source. This migrates the
 * non-synchronous behavioral evidence the temporary TypeScript oracle
 * exercises today — whole-input incremental references, Unicode astral
 * conversion, and safe lifecycle/limit/malformed-input scenarios — into the
 * canonical, UTF-8-byte-offset corpus described by
 * `decision-govern-cross-language-conformance`. Companion to
 * `scripts/migrate-conformance-corpus.ts`, which migrates the synchronous
 * detector corpus.
 */

/**
 * `SecretFinding` (the oracle's public finding shape) carries no
 * specificity — it is resolved and dropped before a finding becomes public.
 * This rebuilds it per `type` from the synchronous corpus, which is
 * authored with an explicit specificity for every supported type, so the
 * canonical incremental corpus can still assert it.
 */
function buildSpecificityByType(): ReadonlyMap<string, CanonicalExpectation["specificity"]> {
  const byType = new Map<string, CanonicalExpectation["specificity"]>();
  for (const fixture of conformanceCorpus) {
    for (const expected of fixture.expected ?? []) {
      const existing = byType.get(expected.type);
      if (existing !== undefined && existing !== expected.specificity) {
        throw new TypeError(
          `Ambiguous specificity for type ${expected.type}: ${existing} vs ${expected.specificity}.`,
        );
      }
      byType.set(expected.type, expected.specificity);
    }
  }
  return byType;
}

function buildIncrementalFixtures(): readonly Utf16IncrementalFixture[] {
  const specificityByType = buildSpecificityByType();
  return incrementalPartitionCorpus.map((fixture) => ({
    id: fixture.id,
    input: fixture.input,
    expected: {
      text: fixture.expected.text,
      findings: fixture.expected.findings.map((finding) => {
        const specificity = specificityByType.get(finding.type);
        if (specificity === undefined) {
          throw new TypeError(
            `No synchronous-corpus specificity for incremental finding type ${finding.type} (${fixture.id}).`,
          );
        }
        return {
          detector: finding.detector,
          type: finding.type,
          confidence: finding.confidence,
          specificity,
          start: finding.start,
          end: finding.end,
        };
      }),
    },
    note: fixture.note,
  }));
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
  console.error(`Wrote ${path}.`);
}

function main(): void {
  const outDir = process.argv[2] ?? "conformance/fixtures";
  mkdirSync(outDir, { recursive: true });

  const incremental = validateCanonicalIncrementalFixtures(
    convertIncrementalCorpusToCanonical(buildIncrementalFixtures()),
  );
  writeJson(`${outDir}/incremental-corpus.json`, {
    offsetUnit: "utf8-byte",
    fixtureCount: incremental.length,
    fixtures: incremental,
  });

  const unicode = validateCanonicalFixtures(
    convertCorpusToCanonical(unicodeAstralFixtures),
  );
  writeJson(`${outDir}/unicode-conversion-corpus.json`, {
    offsetUnit: "utf8-byte",
    fixtureCount: unicode.length,
    fixtures: unicode,
  });

  const lifecycle = validateCanonicalLifecycleFixtures(incrementalLifecycleFixtures);
  writeJson(`${outDir}/incremental-lifecycle-corpus.json`, {
    fixtureCount: lifecycle.length,
    fixtures: lifecycle,
  });

  const errorCodes = validateCanonicalErrorCodes(errorCodeFixtures);
  writeJson(`${outDir}/error-codes.json`, {
    codeCount: errorCodes.length,
    codes: errorCodes,
  });

  // The temporary TypeScript oracle corpus itself: not migration output,
  // but re-validated here so a corpus edit that breaks its own contract
  // fails migration before it fails CI.
  validateConformanceCorpus(conformanceCorpus);
}

main();
