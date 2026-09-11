import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

const ROOT_CONSUMER =
  'import { initialize, scanAndRedact } from "@redact-secret/core"; globalThis.secretScanEntry = [initialize, scanAndRedact];';

const WEB_STREAM_CONSUMER =
  'import { createWebStreamSanitizer } from "@redact-secret/core/web-stream"; globalThis.secretScanEntry = [createWebStreamSanitizer];';

/**
 * The Node addon is one of six `optionalDependencies`, selected at runtime
 * by `process.platform`/`process.arch` (`runtime/node.ts`), so unlike the
 * wasm glue below it is never a statically resolvable specifier for a
 * bundler to see — nothing here needs to mark it external.
 */
async function bundle(
  platform: "browser" | "node",
  contents: string = ROOT_CONSUMER,
) {
  const result = await build({
    bundle: true,
    format: "esm",
    metafile: true,
    platform,
    external: ["@redact-secret/wasm"],
    stdin: {
      contents,
      loader: "js",
      resolveDir: PACKAGE_ROOT,
      sourcefile: `${platform}-consumer.js`,
    },
    write: false,
  });

  expect(result.errors).toEqual([]);
  return {
    inputs: Object.keys(result.metafile.inputs),
    output: result.outputFiles[0]?.text ?? "",
  };
}

describe("bundler conditions", () => {
  it("routes a browser build through the WebAssembly adapter only", async () => {
    const { inputs, output } = await bundle("browser");

    expect(inputs.some((path) => path.endsWith("dist/runtime/browser.js"))).toBe(
      true,
    );
    expect(inputs.some((path) => path.endsWith("dist/runtime/node.js"))).toBe(
      false,
    );
    expect(inputs.some((path) => path.startsWith("node:"))).toBe(false);
    expect(output).not.toContain("node:module");
    expect(output).not.toContain("createRequire");
  });

  it("routes a Node build through the N-API adapter only", async () => {
    const { inputs } = await bundle("node");

    expect(inputs.some((path) => path.endsWith("dist/runtime/node.js"))).toBe(
      true,
    );
    expect(inputs.some((path) => path.endsWith("dist/runtime/browser.js"))).toBe(
      false,
    );
  });

  it("routes the Web adapter through the WebAssembly adapter only", async () => {
    const { inputs, output } = await bundle("browser", WEB_STREAM_CONSUMER);

    expect(
      inputs.some((path) => path.endsWith("dist/adapters/web-stream.js")),
    ).toBe(true);
    expect(inputs.some((path) => path.endsWith("dist/runtime/browser.js"))).toBe(
      true,
    );
    expect(inputs.some((path) => path.endsWith("dist/runtime/node.js"))).toBe(
      false,
    );
    expect(
      inputs.some((path) => path.endsWith("dist/adapters/node-stream.js")),
    ).toBe(false);
    expect(inputs.some((path) => path.startsWith("node:"))).toBe(false);
    expect(output).not.toContain("node:stream");
  });

  it("bundles the Node adapter for Node, and only there", async () => {
    const { inputs } = await bundle(
      "node",
      'import { createNodeStreamSanitizer } from "@redact-secret/core/node-stream"; globalThis.secretScanEntry = [createNodeStreamSanitizer];',
    );

    expect(
      inputs.some((path) => path.endsWith("dist/adapters/node-stream.js")),
    ).toBe(true);
    expect(inputs.some((path) => path.endsWith("dist/runtime/node.js"))).toBe(
      true,
    );
  });

  it("keeps the platform artifacts out of the module graph until initialize", async () => {
    const { output } = await bundle("browser");

    // The WebAssembly artifact is reached through a dynamic import, so a
    // bundle that never calls initialize() never loads it.
    expect(output).toContain('import("@redact-secret/wasm")');
  });
});
