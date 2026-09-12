/**
 * Renders one surface's `AssessmentResult` (`scoring.ts`) as Markdown: the
 * common human-readable report format alongside the common JSON contract
 * (`AGENTS.md`'s "Deliverable: Command-line runnable adapters producing
 * common JSON and Markdown").
 *
 * Every mismatch rendered here carries only a fixture id and safe metadata
 * (`AccuracyMismatch`), never a fixture's `input` or a matched value, so this
 * module is safe to print or write to a file unmodified.
 */

import type { AssessmentResult } from "../schema.js";
import type { AccuracyMismatch } from "./scoring.js";

function formatRange(range: readonly [number, number] | undefined): string {
  return range === undefined ? "—" : `[${range[0]}, ${range[1]})`;
}

function renderMismatchRow(mismatch: AccuracyMismatch): string {
  const range =
    mismatch.kind === "missing"
      ? formatRange(mismatch.expectedRange)
      : mismatch.kind === "extra"
        ? formatRange(mismatch.actualRange)
        : `expected ${formatRange(mismatch.expectedRange)} / actual ${formatRange(mismatch.actualRange)}`;
  const policy =
    mismatch.kind === "policy-mismatch"
      ? `expected \`${mismatch.expectedPolicy}\`, got \`${mismatch.actualPolicy}\``
      : mismatch.kind === "missing"
        ? `expected \`${mismatch.expectedPolicy}\``
        : "—";
  return `| ${mismatch.fixtureId} | ${mismatch.kind} | ${mismatch.detector} | ${mismatch.type} | ${range} | ${policy} |`;
}

/**
 * Renders a Markdown accuracy report for one `AssessmentResult`. `result`
 * must carry `accuracy` (a performance-only result has nothing this report
 * shows); `mismatches` is the detail `scoreFixture` returned for every
 * fixture the result aggregates, safe to include in full.
 */
export function renderMarkdownReport(
  result: AssessmentResult,
  mismatches: readonly AccuracyMismatch[],
): string {
  const accuracy = result.accuracy;
  if (accuracy === undefined) {
    throw new TypeError("renderMarkdownReport requires a result with accuracy metrics");
  }

  const lines: string[] = [
    `# Accuracy assessment — ${result.surface}`,
    "",
    `- Profile: \`${result.profileId}\``,
    `- Schema version: \`${result.schemaVersion}\``,
    `- Artifact: \`${result.provenance.artifactIdentity}\``,
    `- Commit: \`${result.provenance.commit}\``,
    `- Corpus: \`${result.provenance.corpusVersion}\` (\`${result.provenance.corpusHash}\`)`,
    `- Host: ${result.provenance.os} / ${result.provenance.cpu} / ${result.provenance.runtime}`,
    `- Command: \`${result.provenance.command}\``,
    "",
    "## Accuracy metrics",
    "",
    "| Metric | Count |",
    "| --- | --- |",
    `| True positives | ${accuracy.truePositives} |`,
    `| False positives | ${accuracy.falsePositives} |`,
    `| False negatives | ${accuracy.falseNegatives} |`,
    `| Policy mismatches | ${accuracy.policyMismatches} |`,
  ];

  lines.push("", "## Mismatches", "");
  if (mismatches.length === 0) {
    lines.push("None — every fixture matched its reviewed expectation.");
  } else {
    lines.push(
      "| Fixture | Kind | Detector | Type | Range | Policy |",
      "| --- | --- | --- | --- | --- | --- |",
      ...mismatches.map(renderMismatchRow),
    );
  }

  return `${lines.join("\n")}\n`;
}
