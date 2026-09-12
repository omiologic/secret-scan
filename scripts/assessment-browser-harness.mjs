/**
 * The in-page half of `scripts/assessment-browser-run.mjs`: evaluates the
 * published `@redact-secret/core` public API against
 * `assessment/fixtures/accuracy-corpus.json`, running on the real browser
 * WebAssembly artifact in a real engine — exactly the way
 * `scripts/browser-package-harness.mjs` drives the package's conformance
 * pass, except this scores accuracy against reviewed expectations instead of
 * asserting exact conformance.
 *
 * Bundled by `scripts/assessment-browser-run.mjs` with `@redact-secret/core`
 * aliased to the real installed package and `@redact-secret/wasm` aliased to
 * the built artifact, so the page resolves and fetches the same `.wasm` a
 * consumer would. Scoring itself is delegated to
 * `assessment/adapters/scoring.ts`'s `runAccuracyFixtures`, the identical
 * corpus-iteration path `scripts/assessment-run.mjs` uses for Node, so
 * "what counts as a match" cannot drift between the two surfaces.
 */

import { initialize, scan } from "@redact-secret/core";
import { runAccuracyFixtures } from "../assessment/adapters/scoring.js";

/**
 * `fixtures` is `assessment/fixtures/accuracy-corpus.json`'s `fixtures`
 * array, served alongside this bundle as `fixtures.json`. Every input in it
 * is synthetic or explicitly revoked, and nothing this function returns
 * carries an input or a matched value — only the aggregate metrics and safe,
 * fixture-id-keyed mismatch metadata `scoreFixture` produces.
 */
export async function assess(fixtures) {
  await initialize();
  const run = await runAccuracyFixtures(fixtures, (input) =>
    scan(input).map((finding) => ({
      detector: finding.detector,
      type: finding.type,
      start: finding.start,
      end: finding.end,
      action: finding.action,
    })),
  );
  return {
    metrics: run.metrics,
    mismatches: run.mismatches,
    fixturesEvaluated: run.fixturesEvaluated,
  };
}
