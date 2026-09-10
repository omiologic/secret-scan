#!/usr/bin/env node
/**
 * Qualifies the compiled `@omiologic/secret-scan-node` N-API addon: loads it
 * through `packages/javascript`'s real public API — the same `#native`
 * import a consumer resolves, not a test double — and asserts one
 * canonical-corpus fixture end to end (issue #74, acceptance criterion 7).
 *
 * Preconditions:
 * - `napi build --platform --release` has produced the addon in
 *   `bindings/node` (its `.node` file and generated `index.js`).
 * - `npm run js:build` has produced `packages/javascript/dist`.
 *
 * `packages/javascript` declares no dependency on the addon yet (that is
 * `packages/javascript`'s own publishing contract, out of this issue's
 * scope), so this script links it in itself, through a symlink under
 * `packages/javascript/node_modules` that it removes when it is done.
 */

import { symlink, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  CANONICAL_FIXTURE_ID,
  REPO_ROOT_PATH,
  assertMatchesFixture,
  loadCanonicalFixture,
  packageVersion,
} from "./qualify-runtime-fixture.mjs";

const PACKAGE_ROOT = join(REPO_ROOT_PATH, "packages/javascript");
const ADDON_LINK_SCOPE_DIR = join(PACKAGE_ROOT, "node_modules", "@omiologic");
const ADDON_LINK = join(ADDON_LINK_SCOPE_DIR, "secret-scan-node");
const ADDON_TARGET = join(REPO_ROOT_PATH, "bindings/node");

async function main() {
  const fixture = await loadCanonicalFixture(CANONICAL_FIXTURE_ID);
  const expectedVersion = await packageVersion();

  await rm(ADDON_LINK, { recursive: true, force: true });
  await mkdir(ADDON_LINK_SCOPE_DIR, { recursive: true });
  await symlink(ADDON_TARGET, ADDON_LINK, "dir");
  try {
    const entry = pathToFileURL(join(PACKAGE_ROOT, "dist/index.js")).href;
    const { initialize, scan, VERSION } = await import(entry);

    await initialize();
    if (VERSION !== expectedVersion) {
      throw new Error(`version mismatch: package reports ${VERSION}, expected ${expectedVersion}`);
    }

    const findings = scan(fixture.input);
    if (findings.length !== 1) {
      throw new Error(`expected exactly one finding for fixture ${fixture.id}, got ${findings.length}`);
    }
    assertMatchesFixture(findings[0], fixture);
  } finally {
    await rm(ADDON_LINK, { recursive: true, force: true });
  }

  console.log(`Node addon qualification passed (fixture ${fixture.id}, version ${expectedVersion}).`);
}

await main();
