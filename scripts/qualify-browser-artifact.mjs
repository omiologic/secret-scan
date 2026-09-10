#!/usr/bin/env node
/**
 * Qualifies the `wasm-bindgen --target web` browser build of
 * `secret-scan-wasm`: loads `packages/javascript`'s real browser entry point
 * in a headless browser engine — not Node, and not a test double — and
 * asserts one canonical-corpus fixture end to end (issue #74, acceptance
 * criterion 4).
 *
 * Node's own `fetch()` refuses the `file:` scheme wasm-bindgen's generated
 * `init()` uses to self-fetch the `.wasm` binary, so this qualification is
 * only meaningful in a real browser; a plain Node import cannot substitute
 * for it (see `docs/decisions` and `packages/javascript/test/
 * package-import.browser.test.ts`, which bundles for the browser but never
 * loads the artifact).
 *
 * Usage: node scripts/qualify-browser-artifact.mjs --wasm-dir <dir>
 *
 * `<dir>` holds the `wasm-bindgen --target web --out-name secret_scan_wasm`
 * output for `secret-scan-wasm` (`secret_scan_wasm.js` and
 * `secret_scan_wasm_bg.wasm`). `packages/javascript/dist` must already exist
 * (`npm run js:build`). `playwright`'s `chromium` browser must be installed
 * (`npx playwright install chromium`); it is not a project dependency,
 * because only this qualification needs it.
 */

import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, writeFile, cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";

import {
  CANONICAL_FIXTURE_ID,
  REPO_ROOT_PATH,
  assertMatchesFixture,
  loadCanonicalFixture,
  packageVersion,
} from "./qualify-runtime-fixture.mjs";

const PACKAGE_ROOT = join(REPO_ROOT_PATH, "packages/javascript");
const WASM_SPECIFIER = "@omiologic/secret-scan-wasm";
const MIME_TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm" };

function parseArgs(argv) {
  const index = argv.indexOf("--wasm-dir");
  if (index === -1 || argv[index + 1] === undefined) {
    throw new Error("usage: qualify-browser-artifact.mjs --wasm-dir <dir>");
  }
  return { wasmDir: argv[index + 1] };
}

async function bundleBrowserEntry() {
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
      resolveDir: PACKAGE_ROOT,
      sourcefile: "browser-qualify-entry.js",
    },
    write: false,
  });
  if (result.errors.length > 0) {
    throw new Error(`esbuild failed: ${JSON.stringify(result.errors)}`);
  }
  return result.outputFiles[0].text;
}

async function writeHarness(root, bundleText, wasmDir, fixture) {
  await writeFile(join(root, "bundle.js"), bundleText);
  await cp(wasmDir, join(root, "wasm"), { recursive: true });
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

async function main() {
  const { wasmDir } = parseArgs(process.argv.slice(2));
  const fixture = await loadCanonicalFixture(CANONICAL_FIXTURE_ID);
  const expectedVersion = await packageVersion();

  const bundleText = await bundleBrowserEntry();
  const root = await mkdtemp(join(tmpdir(), "secret-scan-browser-qualify-"));
  const { chromium } = await import("playwright");

  let server;
  let browser;
  try {
    await writeHarness(root, bundleText, wasmDir, fixture);

    server = serveDirectory(root);
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
      throw new Error(`uncaught page errors: ${consoleErrors.join("; ")}`);
    }
    if (!result.ok) {
      throw new Error(`browser harness failed: ${result.error}`);
    }
    if (result.version !== expectedVersion) {
      throw new Error(`version mismatch: browser reports ${result.version}, expected ${expectedVersion}`);
    }
    if (result.findings.length !== 1) {
      throw new Error(`expected exactly one finding for fixture ${fixture.id}, got ${result.findings.length}`);
    }
    assertMatchesFixture(result.findings[0], fixture);
  } finally {
    await browser?.close();
    await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
    await rm(root, { recursive: true, force: true });
  }

  console.log(`Browser artifact qualification passed (fixture ${fixture.id}, version ${expectedVersion}).`);
}

await main();
