/**
 * Drives the public `@omiologic/secret-scan` API against a real install in
 * a clean directory outside this repository, on both JavaScript runtimes.
 * Shared between `scripts/qualify-package-consumer.mjs` (installs packed
 * local tarballs, standing in for a registry `npm install` before the
 * dependency packages are published) and `scripts/verify-registry-install.mjs`
 * (installs the real, published package from the registry, after they are)
 * -- the install source differs, but "does the installed package initialize
 * and scan correctly" does not.
 */

import { build } from "esbuild";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

import { assertMatchesFixture } from "./qualify-runtime-fixture.mjs";

export const WASM_SPECIFIER = "@omiologic/secret-scan-wasm";

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
};

export function qualifyNode(consumerRoot, fixture, expectedVersion) {
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

export async function qualifyBrowser(consumerRoot, fixture, expectedVersion) {
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
