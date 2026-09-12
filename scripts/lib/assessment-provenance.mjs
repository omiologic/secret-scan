/**
 * Reproducibility provenance shared by every surface's accuracy-assessment
 * runner (`scripts/assessment-run.mjs` for Node,
 * `scripts/assessment-browser-run.mjs` for the browser WebAssembly
 * artifact): the exact commit, corpus revision, host, and command that
 * produced a result, on the terms `assessment/schema.ts`'s
 * `AssessmentProvenance` documents. Neither runner embeds a corpus fixture
 * or a matched value; both read `assessment/fixtures/accuracy-corpus.json`
 * through this one path.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ACCURACY_CORPUS_PATH = join(
  REPO_ROOT,
  "assessment",
  "fixtures",
  "accuracy-corpus.json",
);

export function gitCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
}

export function loadAccuracyCorpus() {
  return JSON.parse(readFileSync(ACCURACY_CORPUS_PATH, "utf8"));
}

export function accuracyCorpusHash() {
  return createHash("sha256").update(readFileSync(ACCURACY_CORPUS_PATH)).digest("hex");
}

/** `<platform>-<release>`, e.g. `darwin-24.6`, matching the contract's example. */
export function hostOs() {
  return `${process.platform}-${release()}`;
}

export function hostCpu() {
  return process.arch;
}

export function readPackageVersion(packageJsonPath) {
  return JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
}
