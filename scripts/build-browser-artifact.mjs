/**
 * Builds the browser WebAssembly artifact from the workspace source
 * (`decision-define-runtime-bindings`).
 *
 * `cargo build` produces the `wasm32-unknown-unknown` cdylib and
 * `wasm-bindgen` generates the ES module glue for the `web` target, so the
 * emitted directory is loadable by a browser directly from a static server:
 * the generated `default()` init resolves `secret_scan_wasm_bg.wasm` relative
 * to its own `import.meta.url`.
 *
 * The emitted `package.json` names the artifact `@omiologic/secret-scan-wasm`,
 * the specifier `packages/javascript/src/runtime/browser.ts` imports, and
 * carries the shared product version so a bundler and
 * `scripts/qualify-browser-artifact.mjs` resolve exactly what a consumer
 * would (`decision-release-bindings-in-lockstep`).
 *
 * The `wasm-bindgen` CLI must be the exact version the crate is compiled
 * against; a mismatch produces glue that cannot instantiate the module, so it
 * fails here rather than in a browser. Usage:
 *
 *     node scripts/build-browser-artifact.mjs [--out-dir <dir>] [--debug]
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The crate whose cdylib becomes the browser artifact. */
const CRATE = "secret-scan-wasm";
/** The npm specifier the JavaScript package's browser runtime imports. */
const ARTIFACT_PACKAGE = "@omiologic/secret-scan-wasm";
/** The `--out-name` given to `wasm-bindgen`; every emitted file uses it. */
const OUT_NAME = "secret_scan_wasm";
const DEFAULT_OUT_DIR = join("bindings", "wasm", "pkg");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  });
}

function parseArguments(argv) {
  const options = { outDir: DEFAULT_OUT_DIR, profile: "release" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--out-dir") {
      index += 1;
      const value = argv[index];
      if (value === undefined) fail("--out-dir requires a directory");
      options.outDir = value;
    } else if (argument === "--debug") {
      options.profile = "debug";
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }
  return options;
}

/**
 * Reads the resolved workspace metadata once: the shared product version and
 * the exact `wasm-bindgen` version the crate links, both taken from the
 * lockfile rather than from a hand-maintained copy.
 */
function readWorkspace() {
  const metadata = JSON.parse(
    run("cargo", ["metadata", "--format-version", "1", "--locked"]),
  );
  const crate = metadata.packages.find((entry) => entry.name === CRATE);
  if (crate === undefined) fail(`${CRATE} is not a workspace member`);
  const bindgen = metadata.packages.find(
    (entry) => entry.name === "wasm-bindgen",
  );
  if (bindgen === undefined) fail("wasm-bindgen is not a resolved dependency");
  return {
    version: crate.version,
    bindgenVersion: bindgen.version,
    targetDirectory: metadata.target_directory,
  };
}

function requireMatchingBindgenCli(expected) {
  let reported;
  try {
    reported = run("wasm-bindgen", ["--version"]).trim();
  } catch {
    fail(
      `wasm-bindgen ${expected} is not on PATH; install it with ` +
        `\`cargo install wasm-bindgen-cli --version ${expected} --locked\``,
    );
    return;
  }
  const actual = reported.split(/\s+/).at(-1);
  if (actual !== expected) {
    fail(
      `wasm-bindgen CLI is ${actual}, but the crate is built against ` +
        `${expected}; the generated glue would refuse the module`,
    );
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const workspace = readWorkspace();
  requireMatchingBindgenCli(workspace.bindgenVersion);

  const build = ["build", "-p", CRATE, "--target", "wasm32-unknown-unknown", "--locked"];
  if (options.profile === "release") build.push("--release");
  run("cargo", build, { stdio: "inherit" });

  const wasm = join(
    workspace.targetDirectory,
    "wasm32-unknown-unknown",
    options.profile,
    `${OUT_NAME}.wasm`,
  );
  const outDir = resolve(REPO_ROOT, options.outDir);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  run(
    "wasm-bindgen",
    ["--target", "web", "--out-dir", outDir, "--out-name", OUT_NAME, wasm],
    { stdio: "inherit" },
  );

  // A minimal manifest: the artifact is resolved by specifier and loaded as
  // an ES module, and it is published in lockstep rather than on its own.
  writeFileSync(
    join(outDir, "package.json"),
    `${JSON.stringify(
      {
        name: ARTIFACT_PACKAGE,
        version: workspace.version,
        // Private for the same reason `bindings/node/package.json` is: this
        // is build output resolved by specifier, and what a release ships is
        // a separate, approved decision.
        private: true,
        description:
          "WebAssembly browser artifact for @omiologic/secret-scan. Built from bindings/wasm; not published on its own.",
        license: "MIT",
        type: "module",
        main: `${OUT_NAME}.js`,
        module: `${OUT_NAME}.js`,
        types: `${OUT_NAME}.d.ts`,
        sideEffects: [`./${OUT_NAME}.js`],
        files: [
          `${OUT_NAME}.js`,
          `${OUT_NAME}.d.ts`,
          `${OUT_NAME}_bg.wasm`,
          `${OUT_NAME}_bg.wasm.d.ts`,
        ],
      },
      null,
      2,
    )}\n`,
  );
  copyFileSync(join(REPO_ROOT, "LICENSE"), join(outDir, "LICENSE"));
  copyFileSync(
    join(REPO_ROOT, "bindings", "wasm", "README.md"),
    join(outDir, "README.md"),
  );

  console.log(
    `built ${ARTIFACT_PACKAGE}@${workspace.version} (${options.profile}) in ${options.outDir}`,
  );
}

main();
