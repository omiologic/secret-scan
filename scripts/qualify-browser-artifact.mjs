/**
 * Qualifies the browser WebAssembly artifact in a real engine.
 *
 * The artifact is served over HTTP from a temporary directory — with
 * `application/wasm` on the binary, which streaming instantiation requires —
 * and two pages run in each engine against that one artifact. Nothing is
 * stubbed; the engine fetches and instantiates the same `.wasm` a consumer
 * would.
 *
 * `scripts/browser-harness.mjs` drives the artifact through its own exports:
 * the lifecycle gate, the canonical conformance corpus, the UTF-16 range
 * conversion, redaction, and the sanitized error contract
 * (`decision-govern-cross-language-conformance`).
 * `scripts/browser-package-harness.mjs`, bundled the way a consumer bundles
 * it, drives the published `@omiologic/secret-scan` public API on top of the
 * same artifact.
 *
 * Chromium, Firefox, and WebKit are the supported engines, declared in
 * `[workspace.metadata.secret-scan] browser-engines`, and
 * `scripts/check-artifact-matrix.py` keeps this list and the workflow
 * matrix in agreement. Usage:
 *
 *     node scripts/qualify-browser-artifact.mjs --engine chromium
 *     node scripts/qualify-browser-artifact.mjs            # every engine
 *
 * `--artifact-dir` (also accepted as `--wasm-dir`) points at a build other
 * than the default `bindings/wasm/pkg`.
 *
 * Every corpus input is synthetic or explicitly revoked, and no diagnostic
 * this script prints carries an input, a matched value, or a placeholder.
 */

import { createServer } from "node:http";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPTS_DIR, "..");
const FIXTURES_DIR = join(REPO_ROOT, "conformance", "fixtures");
const DEFAULT_ARTIFACT_DIR = join(REPO_ROOT, "bindings", "wasm", "pkg");
const PACKAGE_ENTRY = join(REPO_ROOT, "packages", "javascript", "dist", "index.js");

/** The engines this artifact is qualified in, in the order they run. */
const ENGINES = ["chromium", "firefox", "webkit"];

/** The artifact files the page loads, copied next to the harness. */
const ARTIFACT_FILES = ["secret_scan_wasm.js", "secret_scan_wasm_bg.wasm"];

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
};

/**
 * The two pages each engine loads, in order: the artifact through its own
 * exports, then the published package on top of the same artifact. They run
 * in separate pages because each drives a fresh module instance through the
 * same one-time initialization gate.
 */
const PAGES = [
  { name: "artifact", file: "artifact.html", module: "./browser-harness.mjs" },
  { name: "package", file: "package.html", module: "./package-harness.js" },
];

function renderPage(module) {
  return `<!doctype html>
<meta charset="utf-8">
<title>secret-scan browser qualification</title>
<script type="module">
  import { qualify } from "${module}";
  const fixtures = await (await fetch("./fixtures.json")).json();
  try {
    globalThis.__qualification = await qualify(fixtures);
  } catch (error) {
    globalThis.__qualification = {
      ok: false,
      failures: 1,
      checks: [{ name: "harness", ok: false, detail: String(error) }],
    };
  }
</script>
`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArguments(argv) {
  const options = { engines: [], artifactDir: DEFAULT_ARTIFACT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--engine") {
      index += 1;
      const value = argv[index];
      if (value === undefined || !ENGINES.includes(value)) {
        fail(`--engine must be one of ${ENGINES.join(", ")}`);
      }
      options.engines.push(value);
    } else if (argument === "--artifact-dir" || argument === "--wasm-dir") {
      index += 1;
      const value = argv[index];
      if (value === undefined) fail(`${argument} requires a directory`);
      options.artifactDir = resolve(REPO_ROOT, value);
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }
  if (options.engines.length === 0) options.engines = [...ENGINES];
  return options;
}

function loadCorpus(name) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8"));
}

/**
 * The fixture payload the page fetches: the canonical corpora reduced to the
 * fields the harness asserts on, plus the version the artifact must report.
 */
function buildFixtures(artifactDir) {
  const synchronous = loadCorpus("synchronous-corpus.json");
  if (synchronous.offsetUnit !== "utf8-byte") {
    fail(
      `synchronous-corpus.json: offsetUnit is ${synchronous.offsetUnit}, not utf8-byte`,
    );
  }

  return {
    version: JSON.parse(
      readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
    ).version,
    // "not-yet-evaluated" fixtures carry no expectation and document a
    // future gap, not a current behavioral contract.
    synchronous: synchronous.fixtures
      .filter((fixture) => fixture.support !== "not-yet-evaluated")
      .map(({ id, input, expected }) => ({ id, input, expected })),
  };
}

/**
 * Bundles the package harness for the browser.
 *
 * The package resolves its runtime through its own `imports` map, so the
 * `browser` condition has to be the one a bundler applies — that is what
 * selects `dist/runtime/browser.js` over the Node adapter — and the artifact
 * specifier is aliased to the glue being served, so the bundle loads the same
 * `.wasm` the artifact page does. `import.meta.url` inside the generated glue
 * survives bundling, and the output sits beside the binary, so the module's
 * own `default()` fetches it exactly as a deployed consumer would.
 */
async function bundlePackageHarness(artifactDir, outFile) {
  const { build } = await import("esbuild");
  const result = await build({
    entryPoints: [join(SCRIPTS_DIR, "browser-package-harness.mjs")],
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "browser",
    conditions: ["browser", "import"],
    alias: {
      "@omiologic/secret-scan": PACKAGE_ENTRY,
      "@omiologic/secret-scan-wasm": join(artifactDir, "secret_scan_wasm.js"),
    },
    logLevel: "silent",
  });
  if (result.errors.length > 0) {
    fail(`bundling the package harness failed: ${JSON.stringify(result.errors)}`);
  }
}

async function stageServeDirectory(artifactDir) {
  if (!existsSync(PACKAGE_ENTRY)) {
    fail(`${PACKAGE_ENTRY}: missing; build the package with \`npm run js:build\``);
  }
  const directory = mkdtempSync(join(tmpdir(), "secret-scan-browser-"));
  for (const name of ARTIFACT_FILES) {
    try {
      copyFileSync(join(artifactDir, name), join(directory, name));
    } catch {
      rmSync(directory, { recursive: true, force: true });
      fail(
        `${join(artifactDir, name)}: missing; build it with ` +
          "`npm run wasm:build`",
      );
    }
  }
  copyFileSync(
    join(SCRIPTS_DIR, "browser-harness.mjs"),
    join(directory, "browser-harness.mjs"),
  );
  await bundlePackageHarness(artifactDir, join(directory, "package-harness.js"));
  for (const { file, module } of PAGES) {
    writeFileSync(join(directory, file), renderPage(module));
  }
  writeFileSync(
    join(directory, "fixtures.json"),
    JSON.stringify(buildFixtures(artifactDir)),
  );
  return directory;
}

async function serve(directory) {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const name = path.slice(1);
    // Only the staged files are reachable: a name with a separator or a
    // parent reference never becomes a path.
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      response.writeHead(404).end();
      return;
    }
    let body;
    try {
      body = readFileSync(join(directory, name));
    } catch {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(name)] ?? "application/octet-stream",
      "content-length": String(body.byteLength),
    });
    response.end(body);
  });
  await new Promise((resolveListening) => {
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const { port } = server.address();
  return { server, origin: `http://127.0.0.1:${port}` };
}

/**
 * Runs every page once in one engine. Each page gets its own tab, because
 * each drives a fresh module instance through the one-time initialization
 * gate its first check asserts.
 */
async function runEngine(playwright, engine, origin) {
  const browser = await playwright[engine].launch();
  const runs = [];
  try {
    for (const { name, file } of PAGES) {
      const diagnostics = [];
      const tab = await browser.newPage();
      tab.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
      tab.on("console", (message) => {
        if (message.type() === "error") diagnostics.push(`console: ${message.text()}`);
      });
      await tab.goto(`${origin}/${file}`, { waitUntil: "load" });
      await tab.waitForFunction(
        () => globalThis.__qualification !== undefined,
        undefined,
        { timeout: 120_000 },
      );
      runs.push({
        page: name,
        report: await tab.evaluate(() => globalThis.__qualification),
        diagnostics,
      });
      await tab.close();
    }
  } finally {
    await browser.close();
  }
  return runs;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    fail(
      "playwright is not installed; run `npm ci` and " +
        "`npx playwright install --with-deps chromium firefox webkit`",
    );
    return;
  }

  const directory = await stageServeDirectory(options.artifactDir);
  const { server, origin } = await serve(directory);
  let failed = 0;
  try {
    for (const engine of options.engines) {
      const started = Date.now();
      let runs;
      try {
        runs = await runEngine(playwright, engine, origin);
      } catch (error) {
        failed += 1;
        console.error(`${engine}: FAILED to run — ${error.message}`);
        continue;
      }
      let passed = 0;
      let engineFailed = false;
      for (const { page: name, report, diagnostics } of runs) {
        for (const entry of report.checks) {
          console.log(
            `${entry.ok ? "ok" : "not ok"} - ${engine} · ${name} · ${entry.name}`,
          );
          if (!entry.ok) console.error(`    ${entry.detail}`);
        }
        for (const line of diagnostics) console.error(`    ${engine}: ${line}`);
        passed += report.checks.length;
        if (!report.ok) {
          engineFailed = true;
          console.error(`${engine} · ${name}: ${report.failures} check(s) FAILED`);
        }
      }
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (engineFailed) {
        failed += 1;
        console.error(`${engine}: FAILED\n`);
      } else {
        console.log(`${engine}: ${passed} check(s) passed in ${seconds}s\n`);
      }
    }
  } finally {
    server.close();
    rmSync(directory, { recursive: true, force: true });
  }

  if (failed > 0) {
    console.error(`browser qualification FAILED in ${failed} engine(s)`);
    process.exit(1);
  }
  console.log(`browser qualification passed in ${options.engines.join(", ")}`);
}

await main();
