/**
 * Emits one surface's `AssessmentResult` and its safe mismatch detail as
 * JSON and Markdown — to stdout by default, or to a file when a path is
 * given — shared by every surface's CLI runner
 * (`scripts/assessment-run.mjs`, `scripts/assessment-browser-run.mjs`) so
 * the two output formats stay in sync across surfaces.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function emit(text, destination) {
  if (destination === undefined || destination === "-") {
    process.stdout.write(text);
    return;
  }
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text);
}

/** Writes the conforming `AssessmentResult` alone — no diagnostic fields. */
export function writeJsonResult(result, destination) {
  emit(`${JSON.stringify(result, null, 2)}\n`, destination);
}

/** Writes the rendered Markdown report. No-op when `destination` is unset. */
export function writeMarkdownReport(markdown, destination) {
  if (destination === undefined) return;
  emit(markdown, destination);
}

/** Writes the safe, plaintext-free mismatch list. No-op when unset. */
export function writeMismatches(mismatches, destination) {
  if (destination === undefined) return;
  emit(`${JSON.stringify(mismatches, null, 2)}\n`, destination);
}
