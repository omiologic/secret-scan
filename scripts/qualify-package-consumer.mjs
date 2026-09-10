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

import { build } from "esbuild";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  CANONICAL_FIXTURE_ID,
  REPO_ROOT_PATH,
  assertMatchesFixture,
  loadCanonicalFixture,
  packageVersion,
} from "./qualify-runtime-fixture.mjs";

const JS_PACKAGE_ROOT = join(REPO_ROOT_PATH, "packages/javascript");
const NODE_PLATFORM_ROOT = join(REPO_ROOT_PATH, "bindings/node");
const WASM_PACKAGE_ROOT = join(REPO_ROOT_PATH, "bindings/wasm/npm");
const WASM_SPECIFIER = "@omiologic/secret-scan-wasm";
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
};

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

function qualifyNode(consumerRoot, fixture, expectedVersion) {
  const source = [
    "const { initialize, scan, VERSION } = await import('@omiologic/secret-scan');",
    "await initialize();",
    `const findings = scan(${JSON.stringify(fixture.input)});`,
    "console.log(JSON.stringify({ version: VERSION, findings }));",
  ].join("\n");
  const output = execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", source],
    { cwd: consumerRoot, encoding: "utf8" },
  );
  const result = JSON.parse(output);
  if (result.version !== expectedVersion) {
    throw new Error(
      `Node lane version mismatch: reports ${result.version}, expected ${expectedVersion}`,
    );
  }
  if (result.findings.length !== 1) {
    throw new Error(
      `Node lane: expected exactly one finding for fixture ${fixture.id}, got ${result.findings.length}`,
    );
  }
  assertMatchesFixture(result.findings[0], fixture);
}

async function bundleForBrowser(consumerRoot) {
  const result = await build({
    bundle: true,
    format: "esm",
    platform: "browser",
    external: [WASM_SPECIFIER],
    stdin: {
      contents: [
        `import { initialize, scan, VERSION } from "@omiologic/secret-scan";`,
        "window.__secretScan = { initialize, scan, VERSION };",
      ].join("\n"),
      loader: "js",
      resolveDir: consumerRoot,
      sourcefile: "browser-consumer-qualify-entry.js",
    },
    write: false,
  });
  if (result.errors.length > 0) {
    throw new Error(`esbuild failed: ${JSON.stringify(result.errors)}`);
  }
  return result.outputFiles[0].text;
}

async function writeHarness(root, bundleText, installedWasmDir, fixture) {
  await writeFile(join(root, "bundle.js"), bundleText);
  await cp(installedWasmDir, join(root, "wasm"), { recursive: true });
  const importMap = { imports: { [WASM_SPECIFIER]: "/wasm/secret_scan_wasm.js" } };
  const html = `<!doctype html>
<script type="importmap">${JSON.stringify(importMap)}</script>
<script type="module">
  import "/bundle.js";
  (async () => {
    try {
      await window.__secretScan.initialize();
      const findings = window.__secretScan.scan(${JSON.stringify(fixture.input)});
      window.__qualifyResult = { ok: true, version: window.__secretScan.VERSION, findings };
    } catch (error) {
      window.__qualifyResult = { ok: false, error: String((error && error.stack) || error) };
    }
  })();
</script>
`;
  await writeFile(join(root, "harness.html"), html);
}

function serveDirectory(root) {
  return createServer(async (req, res) => {
    try {
      const path = req.url === "/" ? "/harness.html" : req.url;
      const data = await readFile(join(root, path));
      res.writeHead(200, { "content-type": MIME_TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
}

async function qualifyBrowser(consumerRoot, fixture, expectedVersion) {
  const bundleText = await bundleForBrowser(consumerRoot);
  const harnessRoot = await mkdtemp(join(tmpdir(), "secret-scan-consumer-browser-"));
  const { chromium } = await import("playwright");

  let server;
  let browser;
  try {
    await writeHarness(
      harnessRoot,
      bundleText,
      join(consumerRoot, "node_modules", WASM_SPECIFIER),
      fixture,
    );

    server = serveDirectory(harnessRoot);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address();

    browser = await chromium.launch();
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    await page.goto(`http://127.0.0.1:${port}/harness.html`);
    await page.waitForFunction(() => window.__qualifyResult !== undefined, { timeout: 10_000 });
    const result = await page.evaluate(() => window.__qualifyResult);

    if (consoleErrors.length > 0) {
      throw new Error(`Browser lane: uncaught page errors: ${consoleErrors.join("; ")}`);
    }
    if (!result.ok) {
      throw new Error(`Browser lane harness failed: ${result.error}`);
    }
    if (result.version !== expectedVersion) {
      throw new Error(
        `Browser lane version mismatch: reports ${result.version}, expected ${expectedVersion}`,
      );
    }
    if (result.findings.length !== 1) {
      throw new Error(
        `Browser lane: expected exactly one finding for fixture ${fixture.id}, got ${result.findings.length}`,
      );
    }
    assertMatchesFixture(result.findings[0], fixture);
  } finally {
    await browser?.close();
    await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
    await rm(harnessRoot, { recursive: true, force: true });
  }
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
