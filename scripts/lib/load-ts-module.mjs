/**
 * Loads one of `assessment/`'s pure TypeScript modules (the schema
 * validators, `scoring.ts`, `report.ts`) as a real ES module from a plain-JS
 * CLI script, without a build step and without reimplementing any of their
 * logic.
 *
 * Transforms (does not bundle) the file with `esbuild` — already a
 * devDependency, the same tool `scripts/qualify-browser-artifact.mjs` uses to
 * bundle the browser package harness — and imports the result from a `data:`
 * URL, so nothing is written to disk. `import type { ... }` is erased by the
 * transform, so this only works for a module whose remaining imports are
 * loaded the same way; every module under `assessment/` today has none left
 * once its type-only imports are stripped.
 */
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

export async function loadTsModule(absolutePath) {
  const source = await readFile(absolutePath, "utf8");
  const { code } = await transform(source, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    sourcefile: absolutePath,
  });
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
}
