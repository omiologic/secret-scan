import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

import { conformanceCorpus } from "../test/conformance/corpus.js";
import { validateConformanceCorpus } from "../test/conformance/schema.js";
import { convertCorpusToCanonical } from "../conformance/convert.js";
import { validateCanonicalFixtures } from "../conformance/schema.js";

/**
 * Migration tooling, not a canonical source. This converts the temporary
 * TypeScript oracle's UTF-16-offset corpus (`test/conformance/corpus.ts`)
 * into the canonical UTF-8-byte-offset schema (`conformance/schema.ts`),
 * per `decision-govern-cross-language-conformance`. The emitted JSON is a
 * derived migration artifact for non-TypeScript ports to consume or diff
 * against; the TypeScript corpus remains the executable behavioral oracle
 * until the Rust core reaches parity and this script is retired along with
 * it.
 */
function main(): void {
  validateConformanceCorpus(conformanceCorpus);
  const canonical = convertCorpusToCanonical(conformanceCorpus);
  validateCanonicalFixtures(canonical);

  const outPath = process.argv[2] ?? "dist/conformance-corpus.json";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        offsetUnit: "utf8-byte",
        fixtureCount: canonical.length,
        fixtures: canonical,
      },
      null,
      2,
    ) + "\n",
  );

  console.error(
    `Migrated ${canonical.length} conformance fixtures to ${outPath} ` +
      "(UTF-8 byte offsets; not a canonical source).",
  );
}

main();
