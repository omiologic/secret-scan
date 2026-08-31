import type { SecretDetector } from "../../src/types.js";
import type { IncrementalPartitionCase } from "./incremental-partitions.js";
import type { ConformanceCase } from "./schema.js";

export const coverageDimensions = [
  "positive",
  "near-miss",
  "false-positive",
  "context",
  "overlap",
  "mutation",
  "incremental",
  "adversarial",
  "regression",
] as const;

export type CoverageDimension = typeof coverageDimensions[number];

export interface CoverageCell {
  readonly state: "covered" | "not-applicable" | "gap";
  readonly fixtureIds: readonly string[];
  readonly reason?: string;
}

export interface DetectorCoverageRow {
  readonly detector: string;
  readonly dimensions: Readonly<Record<CoverageDimension, CoverageCell>>;
}

function matchingFixtureIds(
  detector: string,
  fixtures: readonly ConformanceCase[],
  dimension: Exclude<CoverageDimension, "incremental">,
): readonly string[] {
  return fixtures.filter((fixture) => {
    if (fixture.detector !== detector) return false;
    switch (dimension) {
      case "positive": return fixture.kind === "positive" && (fixture.expected?.length ?? 0) > 0;
      case "near-miss": return fixture.tier === "malformed";
      case "false-positive": return fixture.tier === "negative";
      case "context": return fixture.tier === "contextual" || fixture.contexts.some((value) => value !== "plain-text");
      case "overlap": return fixture.kind === "overlap";
      case "mutation": return fixture.mutation !== undefined;
      case "adversarial": return fixture.tier === "adversarial";
      case "regression": return fixture.tier === "regression";
    }
  }).map(({ id }) => id);
}

export function buildCoverageRows(
  detectors: readonly SecretDetector[],
  fixtures: readonly ConformanceCase[],
  incrementalFixtures: readonly IncrementalPartitionCase[],
): readonly DetectorCoverageRow[] {
  const incrementalByDetector = new Map<string, string[]>();
  for (const fixture of incrementalFixtures) {
    for (const finding of fixture.expected.findings) {
      const ids = incrementalByDetector.get(finding.detector) ?? [];
      if (!ids.includes(fixture.id)) ids.push(fixture.id);
      incrementalByDetector.set(finding.detector, ids);
    }
  }

  return detectors.map((detector) => {
    const dimensions = Object.fromEntries(coverageDimensions.map((dimension) => {
      const fixtureIds = dimension === "incremental"
        ? incrementalByDetector.get(detector.id) ?? []
        : matchingFixtureIds(detector.id, fixtures, dimension);
      if (fixtureIds.length > 0) {
        return [dimension, { state: "covered", fixtureIds }] as const;
      }
      if (dimension === "regression") {
        return [dimension, {
          state: "not-applicable",
          fixtureIds,
          reason: "No confirmed detector defect has required a family-specific regression fixture.",
        }] as const;
      }
      return [dimension, { state: "gap", fixtureIds }] as const;
    })) as unknown as Readonly<Record<CoverageDimension, CoverageCell>>;
    return Object.freeze({ detector: detector.id, dimensions });
  });
}

export function renderCoverageTable(rows: readonly DetectorCoverageRow[]): string {
  const short = (cell: CoverageCell): string => {
    if (cell.state === "covered") return "Yes";
    if (cell.state === "not-applicable") return "N/A¹";
    return "GAP";
  };
  const heading = `| Detector | ${coverageDimensions.join(" | ")} |`;
  const separator = `| --- | ${coverageDimensions.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) =>
    `| \`${row.detector}\` | ${coverageDimensions.map((dimension) => short(row.dimensions[dimension])).join(" | ")} |`
  );
  return [
    heading,
    separator,
    ...body,
    "",
    "¹ No confirmed detector defect has required a family-specific regression fixture; the permanent regression intake rule still applies.",
  ].join("\n");
}
