import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

import { conformanceCorpus } from "../test/conformance/corpus.js";
import { validateConformanceCorpus } from "../test/conformance/schema.js";

/**
 * Exports the runtime-neutral conformance corpus as JSON for consumption by
 * non-TypeScript ports (e.g. secret-scan-python). Offsets remain UTF-16 code
 * unit offsets, matching this package's `start`/`end` semantics; a consuming
 * port must convert them to its own native string-index unit before comparing
 * results.
 */
function main(): void {
  validateConformanceCorpus(conformanceCorpus);

  const outPath = process.argv[2] ?? "dist/conformance-corpus.json";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        offsetUnit: "utf16-code-unit",
        fixtureCount: conformanceCorpus.length,
        fixtures: conformanceCorpus,
      },
      null,
      2,
    ) + "\n",
  );

  console.error(
    `Exported ${conformanceCorpus.length} conformance fixtures to ${outPath}`,
  );
}

main();
