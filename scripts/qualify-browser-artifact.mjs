/**
 * Qualifies the browser WebAssembly artifact in a real engine.
 *
 * The artifact is served over HTTP from a temporary directory — with
 * `application/wasm` on the binary, which streaming instantiation requires —
 * and `scripts/browser-harness.mjs` runs inside the page: initialization, the
 * lifecycle gate, the canonical conformance corpus, the UTF-16 range
 * conversion, redaction, and the sanitized error contract
 * (`decision-govern-cross-language-conformance`). Nothing is stubbed; the
 * engine fetches and instantiates the same `.wasm` a consumer would.
 *
 * Chromium, Firefox, and WebKit are the supported engines, declared in
 * `[workspace.metadata.secret-scan] browser-engines`, and
 * `scripts/check-qualification-matrix.py` keeps this list and the workflow
 * matrix in agreement. Usage:
 *
 *     node scripts/qualify-browser-artifact.mjs --engine chromium
 *     node scripts/qualify-browser-artifact.mjs            # every engine
 *
 * Every corpus input is synthetic or explicitly revoked, and no diagnostic
 * this script prints carries an input, a matched value, or a placeholder.
 */

import { createServer } from "node:http";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPTS_DIR, "..");
const FIXTURES_DIR = join(REPO_ROOT, "conformance", "fixtures");
const DEFAULT_ARTIFACT_DIR = join(REPO_ROOT, "bindings", "wasm", "pkg");

/** The engines this artifact is qualified in, in the order they run. */
const ENGINES = ["chromium", "firefox", "webkit"];

/** The artifact files the page loads, copied next to the harness. */
const ARTIFACT_FILES = [
  "secret_scan_wasm.js",
  "secret_scan_wasm_bg.wasm",
  "package.json",
];

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
};

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>secret-scan browser qualification</title>
<script type="module">
  import { qualify } from "./browser-harness.mjs";
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
    } else if (argument === "--artifact-dir") {
      index += 1;
      const value = argv[index];
      if (value === undefined) fail("--artifact-dir requires a directory");
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

  const manifest = JSON.parse(
    readFileSync(join(artifactDir, "package.json"), "utf8"),
  );
  return {
    version: manifest.version,
    // "not-yet-evaluated" fixtures carry no expectation and document a
    // future gap, not a current behavioral contract.
    synchronous: synchronous.fixtures
      .filter((fixture) => fixture.support !== "not-yet-evaluated")
      .map(({ id, input, expected }) => ({ id, input, expected })),
  };
}

function stageServeDirectory(artifactDir) {
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
  writeFileSync(join(directory, "index.html"), PAGE);
  writeFileSync(
    join(directory, "fixtures.json"),
    JSON.stringify(buildFixtures(artifactDir)),
  );
  return directory;
}

async function serve(directory) {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const name = path === "/" ? "index.html" : path.slice(1);
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
  return { server, url: `http://127.0.0.1:${port}/index.html` };
}

async function runEngine(playwright, engine, url) {
  const browser = await playwright[engine].launch();
  const diagnostics = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.push(`console: ${message.text()}`);
    });
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(
      () => globalThis.__qualification !== undefined,
      undefined,
      { timeout: 120_000 },
    );
    return { report: await page.evaluate(() => globalThis.__qualification), diagnostics };
  } finally {
    await browser.close();
  }
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

  const directory = stageServeDirectory(options.artifactDir);
  const { server, url } = await serve(directory);
  let failed = 0;
  try {
    for (const engine of options.engines) {
      const started = Date.now();
      let report;
      let diagnostics = [];
      try {
        ({ report, diagnostics } = await runEngine(playwright, engine, url));
      } catch (error) {
        failed += 1;
        console.error(`${engine}: FAILED to run — ${error.message}`);
        continue;
      }
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      for (const entry of report.checks) {
        console.log(`${entry.ok ? "ok" : "not ok"} - ${engine} · ${entry.name}`);
        if (!entry.ok) console.error(`    ${entry.detail}`);
      }
      for (const line of diagnostics) console.error(`    ${engine}: ${line}`);
      if (report.ok) {
        console.log(`${engine}: ${report.checks.length} check(s) passed in ${seconds}s\n`);
      } else {
        failed += 1;
        console.error(`${engine}: ${report.failures} check(s) FAILED\n`);
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
