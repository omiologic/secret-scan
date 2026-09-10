import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  validateCanonicalCoverageDeclarations,
  validateCanonicalErrorCodes,
  validateCanonicalFixtures,
  validateCanonicalIncrementalFixtures,
  validateCanonicalLifecycleFixtures,
  type CanonicalCoverageContext,
  type CanonicalCoverageDeclaration,
  type CanonicalErrorCode,
  type CanonicalFixture,
  type CanonicalIncrementalFixture,
  type CanonicalLifecycleFixture,
} from "./schema.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

function readJson<T>(...segments: readonly string[]): T {
  return JSON.parse(readFileSync(path.join(ROOT, ...segments), "utf-8")) as T;
}

const manifest = readJson<{
  types: readonly { detector: string; type: string }[];
  consumers: readonly { path: string }[];
}>("docs", "coverage", "detector-inventory.json");
const corpus = readJson<{ fixtures: readonly CanonicalFixture[] }>(
  "conformance",
  "fixtures",
  "synchronous-corpus.json",
);
const incrementalCorpus = readJson<{ fixtures: readonly CanonicalIncrementalFixture[] }>(
  "conformance",
  "fixtures",
  "incremental-corpus.json",
);
const lifecycleCorpus = readJson<{ fixtures: readonly CanonicalLifecycleFixture[] }>(
  "conformance",
  "fixtures",
  "incremental-lifecycle-corpus.json",
);
const unicodeCorpus = readJson<{ fixtures: readonly CanonicalFixture[] }>(
  "conformance",
  "fixtures",
  "unicode-conversion-corpus.json",
);
const errorCodesDoc = readJson<{ codes: readonly CanonicalErrorCode[] }>(
  "conformance",
  "fixtures",
  "error-codes.json",
);
const coverageDeclarations = readJson<{ declarations: readonly CanonicalCoverageDeclaration[] }>(
  "docs",
  "coverage",
  "coverage-declarations.json",
);

function realContext(): CanonicalCoverageContext {
  return {
    knownDetectors: new Set(manifest.types.map((entry) => entry.detector)),
    knownDetectorTypes: new Set(
      manifest.types.map((entry) => `${entry.detector}:${entry.type}`),
    ),
    knownConsumerPaths: new Set(manifest.consumers.map((consumer) => consumer.path)),
    // Every fixture id is a legitimate citation regardless of `support`
    // state -- an `intentionally-unsupported` boundary fixture is itself
    // evidence, not a gap (evidence-requirements.md §2). This set only
    // guards against citing an id that does not exist.
    knownEvidenceIds: new Set([
      ...corpus.fixtures.map((f) => f.id),
      ...unicodeCorpus.fixtures.map((f) => f.id),
      ...incrementalCorpus.fixtures.map((f) => f.id),
      ...lifecycleCorpus.fixtures.map((f) => f.id),
      ...errorCodesDoc.codes.map((c) => c.code),
    ]),
  };
}

/** A minimal, otherwise-valid provider row a rejection test can mutate one
 * field of at a time. */
function baseRow(): CanonicalCoverageDeclaration {
  return {
    type: "github_token",
    detector: "github-token",
    behaviorClass: "provider",
    dimensions: [
      { dimension: "positive", state: "supported", evidenceFixtureIds: ["github-positive-classic"] },
      { dimension: "near-miss-negative", state: "supported", evidenceFixtureIds: ["github-positive-classic"] },
      { dimension: "boundary", state: "supported", evidenceFixtureIds: ["github-positive-classic"] },
      { dimension: "malformed", state: "supported", evidenceFixtureIds: ["github-positive-classic"] },
      { dimension: "overlap", state: "supported", evidenceFixtureIds: ["github-positive-classic"] },
      {
        dimension: "host-context",
        state: "supported",
        evidenceFixtureIds: ["github-positive-classic"],
        classLevel: true,
      },
      {
        dimension: "range",
        state: "supported",
        evidenceFixtureIds: ["unicode-conversion-astral-before"],
        classLevel: true,
      },
      { dimension: "adversarial", state: "supported", evidenceFixtureIds: ["github-positive-classic"] },
    ],
    note: "test row",
  };
}

describe("canonical fixture files validate against the canonical schema", () => {
  test("synchronous-corpus.json", () => {
    expect(() => validateCanonicalFixtures(corpus.fixtures)).not.toThrow();
  });

  test("unicode-conversion-corpus.json", () => {
    expect(() => validateCanonicalFixtures(unicodeCorpus.fixtures)).not.toThrow();
  });

  test("incremental-corpus.json", () => {
    expect(() => validateCanonicalIncrementalFixtures(incrementalCorpus.fixtures)).not.toThrow();
  });

  test("incremental-lifecycle-corpus.json", () => {
    expect(() => validateCanonicalLifecycleFixtures(lifecycleCorpus.fixtures)).not.toThrow();
  });

  test("error-codes.json", () => {
    expect(() => validateCanonicalErrorCodes(errorCodesDoc.codes)).not.toThrow();
  });
});

describe("docs/coverage/coverage-declarations.json migrates deterministically", () => {
  test("validates against the real detector-inventory.json and corpus context", () => {
    expect(() =>
      validateCanonicalCoverageDeclarations(coverageDeclarations.declarations, realContext()),
    ).not.toThrow();
  });

  test("declares exactly the baseline's types, the incremental surface, and every consumer", () => {
    const declaredTypes = new Set(coverageDeclarations.declarations.map((row) => row.type));
    for (const entry of manifest.types) expect(declaredTypes.has(entry.type)).toBe(true);
    for (const consumer of manifest.consumers) expect(declaredTypes.has(consumer.path)).toBe(true);
    expect(declaredTypes.has("incremental")).toBe(true);
  });

  test("re-running the generator produces byte-identical output (migration determinism)", () => {
    const run = () =>
      execFileSync("python3", ["-B", "scripts/generate-coverage-declarations.py"], {
        cwd: ROOT,
        encoding: "utf-8",
      });
    const first = run();
    const second = run();
    expect(first).toEqual(second);
    expect(JSON.parse(first)).toEqual(coverageDeclarations);
  });
});

describe("validateCanonicalCoverageDeclarations", () => {
  test("accepts a well-formed row", () => {
    expect(() => validateCanonicalCoverageDeclarations([baseRow()], realContext())).not.toThrow();
  });

  test("rejects an unknown detector", () => {
    const row = baseRow();
    expect(() =>
      validateCanonicalCoverageDeclarations(
        [{ ...row, detector: "not-a-real-detector" }],
        realContext(),
      ),
    ).toThrow(/unknown-detector-or-type/);
  });

  test("rejects an unknown type for a known detector", () => {
    const row = baseRow();
    expect(() =>
      validateCanonicalCoverageDeclarations([{ ...row, type: "not_a_real_type" }], realContext()),
    ).toThrow(/unknown-detector-or-type/);
  });

  test("rejects a row missing a required dimension", () => {
    const row = baseRow();
    expect(() =>
      validateCanonicalCoverageDeclarations(
        [{ ...row, dimensions: row.dimensions.filter((d) => d.dimension !== "adversarial") }],
        realContext(),
      ),
    ).toThrow(/missing-required-dimension/);
  });

  test("rejects a stale evidence fixture id", () => {
    const row = baseRow();
    expect(() =>
      validateCanonicalCoverageDeclarations(
        [
          {
            ...row,
            dimensions: row.dimensions.map((d) =>
              d.dimension === "positive"
                ? { ...d, evidenceFixtureIds: ["this-fixture-id-does-not-exist"] }
                : d,
            ),
          },
        ],
        realContext(),
      ),
    ).toThrow(/stale-evidence-id/);
  });

  test("rejects a supported dimension with no evidence and no exception", () => {
    const row = baseRow();
    expect(() =>
      validateCanonicalCoverageDeclarations(
        [
          {
            ...row,
            dimensions: row.dimensions.map((d) =>
              d.dimension === "positive" ? { ...d, evidenceFixtureIds: [] } : d,
            ),
          },
        ],
        realContext(),
      ),
    ).toThrow(/unsupported-claim/);
  });

  test("rejects a supported dimension that also carries an exception", () => {
    const row = baseRow();
    expect(() =>
      validateCanonicalCoverageDeclarations(
        [
          {
            ...row,
            dimensions: row.dimensions.map((d) =>
              d.dimension === "positive"
                ? { ...d, exception: { code: "no-concept" as const } }
                : d,
            ),
          },
        ],
        realContext(),
      ),
    ).toThrow(/contradictory-state/);
  });

  test("rejects a pending dimension whose backlogId is free-form prose", () => {
    const row = baseRow();
    expect(() =>
      validateCanonicalCoverageDeclarations(
        [
          {
            ...row,
            dimensions: row.dimensions.map((d) =>
              d.dimension === "positive"
                ? {
                    dimension: d.dimension,
                    state: "pending" as const,
                    evidenceFixtureIds: [],
                    exception: {
                      code: "pending" as const,
                      backlogId: "we'll get to this eventually",
                    },
                  }
                : d,
            ),
          },
        ],
        realContext(),
      ),
    ).toThrow(/unjustified-exception/);
  });

  test("rejects owned-elsewhere pointing at a row that does not exist", () => {
    const row = baseRow();
    expect(() =>
      validateCanonicalCoverageDeclarations(
        [
          {
            ...row,
            dimensions: row.dimensions.map((d) =>
              d.dimension === "positive"
                ? {
                    dimension: d.dimension,
                    state: "supported" as const,
                    evidenceFixtureIds: [],
                    exception: {
                      code: "owned-elsewhere" as const,
                      ownedBy: "nonexistent_type:positive",
                    },
                  }
                : d,
            ),
          },
        ],
        realContext(),
      ),
    ).toThrow(/unjustified-exception/);
  });

  test("rejects owned-elsewhere pointing at a dimension that is not itself supported", () => {
    const owner = baseRow();
    const pendingOwner: CanonicalCoverageDeclaration = {
      ...owner,
      type: "aws_access_key_id",
      detector: "aws-access-key",
      dimensions: owner.dimensions.map((d) =>
        d.dimension === "overlap"
          ? {
              dimension: "overlap" as const,
              state: "pending" as const,
              evidenceFixtureIds: [],
              exception: { code: "pending" as const, backlogId: "aws-overlap-gap" },
            }
          : d,
      ),
    };
    const base = baseRow();
    const claimant: CanonicalCoverageDeclaration = {
      ...base,
      dimensions: base.dimensions.map((d) =>
        d.dimension === "overlap"
          ? {
              dimension: "overlap" as const,
              state: "supported" as const,
              evidenceFixtureIds: [],
              exception: { code: "owned-elsewhere" as const, ownedBy: "aws_access_key_id:overlap" },
            }
          : d,
      ),
    };
    expect(() =>
      validateCanonicalCoverageDeclarations([pendingOwner, claimant], realContext()),
    ).toThrow(/unjustified-exception/);
  });

  test("rejects single-detector-family citing a type on a different detector", () => {
    const sibling: CanonicalCoverageDeclaration = {
      ...baseRow(),
      type: "gitlab_token",
      detector: "gitlab-token",
    };
    const base = baseRow();
    const claimant: CanonicalCoverageDeclaration = {
      ...base,
      dimensions: base.dimensions.map((d) =>
        d.dimension === "overlap"
          ? {
              dimension: "overlap" as const,
              state: "supported" as const,
              evidenceFixtureIds: [],
              exception: { code: "single-detector-family" as const, sharedWith: "gitlab_token" },
            }
          : d,
      ),
    };
    expect(() =>
      validateCanonicalCoverageDeclarations([sibling, claimant], realContext()),
    ).toThrow(/unjustified-exception/);
  });

  test("rejects a declared dimension the matrix marks not-applicable for the row's class", () => {
    const incrementalRow: CanonicalCoverageDeclaration = {
      type: "incremental",
      detector: "unassigned",
      behaviorClass: "incremental",
      dimensions: [
        { dimension: "malformed", state: "supported", evidenceFixtureIds: ["INVALID_UTF8"] },
        {
          dimension: "range",
          state: "supported",
          evidenceFixtureIds: ["unicode-conversion-astral-before"],
        },
        {
          dimension: "incremental",
          state: "supported",
          evidenceFixtureIds: ["fixed-width-unicode"],
        },
        {
          dimension: "adversarial",
          state: "supported",
          evidenceFixtureIds: ["github-positive-classic"],
        },
        // "positive" is not-applicable for the incremental class.
        { dimension: "positive", state: "supported", evidenceFixtureIds: ["github-positive-classic"] },
      ],
      note: "test row",
    };
    expect(() =>
      validateCanonicalCoverageDeclarations([incrementalRow], realContext()),
    ).toThrow(/dimension-not-applicable-for-class/);
  });

  test("rejects an unknown consumer path", () => {
    const row: CanonicalCoverageDeclaration = {
      type: "not/a/declared/consumer.rs",
      detector: "unassigned",
      behaviorClass: "binding-edge",
      dimensions: [
        { dimension: "malformed", state: "supported", evidenceFixtureIds: ["INVALID_UTF8"] },
        {
          dimension: "range",
          state: "supported",
          evidenceFixtureIds: ["unicode-conversion-astral-before"],
        },
        {
          dimension: "incremental",
          state: "not-applicable",
          evidenceFixtureIds: [],
          exception: { code: "no-concept" },
        },
        {
          dimension: "adversarial",
          state: "supported",
          evidenceFixtureIds: [],
          exception: {
            code: "owned-elsewhere",
            ownedBy: "crates/secret-scan-core/tests/adversarial_bounds.rs:adversarial",
          },
        },
      ],
      note: "test row",
    };
    expect(() => validateCanonicalCoverageDeclarations([row], realContext())).toThrow(
      /unknown-consumer/,
    );
  });
});
