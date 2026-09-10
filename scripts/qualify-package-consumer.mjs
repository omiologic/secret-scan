#!/usr/bin/env node
/**
 * Qualifies `packages/javascript` as an actual npm consumer would install
 * it: packs it and its native/WebAssembly dependencies into tarballs, installs
 * the packed `@omiologic/secret-scan` tarball into a clean directory outside
 * the repository (nothing under it resolves back into this checkout), and
 * awaits `initialize()` successfully on both the Node runtime and a real
 * browser runtime (issue #79, "Under either branch" criterion 1).
 *
 * `optionalDependencies`/`dependencies` in `packages/javascript/package.json`
 * name registry versions of `@omiologic/secret-scan-<platform>` and
 * `@omiologic/secret-scan-wasm` (issue #79) that are not published yet
 * (RB-2, issue #72, is what starts publishing `packages/javascript` at
 * all). This script substitutes local tarballs for exactly those two
 * dependency kinds via npm's `overrides`, which is the standard way to
 * exercise a real install shape without a real registry; everything else
 * about the install — `optionalDependencies` resolution, `os`/`cpu`/`libc`
 * matching, the resulting `node_modules` layout — is the real npm installer,
 * not a simulation of it.
 *
 * Preconditions (the same artifacts `qualify-node-addon.mjs` and
 * `qualify-browser-artifact.mjs` require):
 * - `napi build --platform --release` has produced this host's addon in
 *   `bindings/node`.
 * - `wasm-bindgen --target web --out-name secret_scan_wasm` has produced the
 *   browser build in some directory (`--wasm-dir`).
 * - `npm run js:build` has produced `packages/javascript/dist`.
 * - `playwright`'s `chromium` browser is installed for the browser lane.
 *
 * Usage: node scripts/qualify-package-consumer.mjs --wasm-dir <dir>
 */

import { execFileSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  CANONICAL_FIXTURE_ID,
  REPO_ROOT_PATH,
  loadCanonicalFixture,
  packageVersion,
} from "./qualify-runtime-fixture.mjs";
import { WASM_SPECIFIER, qualifyBrowser, qualifyNode } from "./consumer-harness.mjs";

const JS_PACKAGE_ROOT = join(REPO_ROOT_PATH, "packages/javascript");
const NODE_PLATFORM_ROOT = join(REPO_ROOT_PATH, "bindings/node");
const WASM_PACKAGE_ROOT = join(REPO_ROOT_PATH, "bindings/wasm/npm");

function parseArgs(argv) {
  const index = argv.indexOf("--wasm-dir");
  if (index === -1 || argv[index + 1] === undefined) {
    throw new Error("usage: qualify-package-consumer.mjs --wasm-dir <dir>");
  }
  return { wasmDir: argv[index + 1] };
}

function npmPack(cwd) {
  const output = execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["pack", "--json"],
    { cwd, encoding: "utf8" },
  );
  const [result] = JSON.parse(output);
  if (result === undefined) throw new Error(`npm pack produced no result in ${cwd}`);
  return join(cwd, result.filename);
}

/** This host's platform package directory, with the built addon copied in. */
async function assembleNodePlatformPackage() {
  const { resolveAddonSpecifier } = await import(
    pathToFileURL(join(JS_PACKAGE_ROOT, "dist/runtime/node.js")).href
  );
  const specifier = resolveAddonSpecifier();
  if (specifier === undefined) {
    throw new Error(
      `no platform package is mapped for ${process.platform}/${process.arch}`,
    );
  }
  const suffix = specifier.split("/")[1].replace("secret-scan-", "");
  const dir = join(NODE_PLATFORM_ROOT, "npm", suffix);
  const manifest = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
  await cp(
    join(NODE_PLATFORM_ROOT, manifest.main),
    join(dir, manifest.main),
  );
  return { specifier, dir };
}

/** The wasm package directory, with the wasm-bindgen web build copied in. */
async function assembleWasmPackage(wasmDir) {
  await cp(wasmDir, WASM_PACKAGE_ROOT, { recursive: true });
  return WASM_PACKAGE_ROOT;
}

/**
 * A package.json outside the repository whose only path back into it is
 * three absolute `file:` tarball references, resolved once by `npm install`
 * and never again.
 */
async function buildConsumerProject(tarballs) {
  const root = await mkdtemp(join(tmpdir(), "secret-scan-consumer-"));
  const manifest = {
    name: "secret-scan-consumer-qualification",
    private: true,
    type: "module",
    dependencies: {
      "@omiologic/secret-scan": `file:${tarballs.js}`,
    },
    overrides: {
      [WASM_SPECIFIER]: `file:${tarballs.wasm}`,
      [tarballs.nodeSpecifier]: `file:${tarballs.node}`,
    },
  };
  await writeFile(join(root, "package.json"), JSON.stringify(manifest, null, 2));
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", [
    "install",
    "--no-audit",
    "--no-fund",
  ], { cwd: root, stdio: "inherit" });
  return root;
}

async function main() {
  const { wasmDir } = parseArgs(process.argv.slice(2));
  const fixture = await loadCanonicalFixture(CANONICAL_FIXTURE_ID);
  const expectedVersion = await packageVersion();

  const { specifier: nodeSpecifier, dir: nodePlatformDir } =
    await assembleNodePlatformPackage();
  const wasmPackageDir = await assembleWasmPackage(wasmDir);

  const tarballs = {
    js: npmPack(JS_PACKAGE_ROOT),
    node: npmPack(nodePlatformDir),
    wasm: npmPack(wasmPackageDir),
    nodeSpecifier,
  };

  let consumerRoot;
  try {
    consumerRoot = await buildConsumerProject(tarballs);
    qualifyNode(consumerRoot, fixture, expectedVersion);
    await qualifyBrowser(consumerRoot, fixture, expectedVersion);
  } finally {
    await rm(tarballs.js, { force: true });
    await rm(tarballs.node, { force: true });
    await rm(tarballs.wasm, { force: true });
    await mkdir(nodePlatformDir, { recursive: true });
    await rm(join(nodePlatformDir, JSON.parse(await readFile(join(nodePlatformDir, "package.json"), "utf8")).main), { force: true });
    await rm(join(wasmPackageDir, "secret_scan_wasm.js"), { force: true });
    await rm(join(wasmPackageDir, "secret_scan_wasm.d.ts"), { force: true });
    await rm(join(wasmPackageDir, "secret_scan_wasm_bg.wasm"), { force: true });
    await rm(join(wasmPackageDir, "secret_scan_wasm_bg.wasm.d.ts"), { force: true });
    if (consumerRoot) await rm(consumerRoot, { recursive: true, force: true });
  }

  console.log(
    `Package consumer qualification passed (fixture ${fixture.id}, version ${expectedVersion}): ` +
      "Node and browser lanes both installed the packed tarball into a clean directory and initialized.",
  );
}

await main();
