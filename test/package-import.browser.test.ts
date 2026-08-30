import { build } from "esbuild";
import { describe, expect, it } from "vitest";

describe("browser package import", () => {
  it("bundles the package entry point without runtime-specific dependencies", async () => {
    const result = await build({
      bundle: true,
      format: "esm",
      platform: "browser",
      stdin: {
        contents:
          'import { createIncrementalSanitizer } from "@omiologic/secret-scan"; const session = createIncrementalSanitizer({ limits: { maxInputCodeUnits: 1024, maxBufferedCodeUnits: 384, maxTokenCodeUnits: 128, maxMultilineCodeUnits: 256 } }); session.append("ordinary text"); globalThis.secretScanResult = session.finalize();',
        loader: "js",
        resolveDir: process.cwd(),
        sourcefile: "browser-consumer.js",
      },
      write: false,
    });

    expect(result.errors).toEqual([]);
    expect(result.outputFiles).toHaveLength(1);
    const output = result.outputFiles[0]?.text;
    expect(output).toBeDefined();
    await import(`data:text/javascript;base64,${Buffer.from(output ?? "").toString("base64")}`);
    expect(
      (
        globalThis as typeof globalThis & {
          secretScanResult?: unknown;
        }
      ).secretScanResult,
    ).toEqual({ text: "ordinary text", findings: [] });
  });

  it("bundles the Web stream subpath without Node-only dependencies", async () => {
    const result = await build({
      bundle: true,
      format: "esm",
      metafile: true,
      platform: "browser",
      stdin: {
        contents:
          'import { createWebStreamSanitizer } from "@omiologic/secret-scan/web-stream"; globalThis.secretScanWebAdapter = createWebStreamSanitizer;',
        loader: "js",
        resolveDir: process.cwd(),
        sourcefile: "browser-stream-consumer.js",
      },
      write: false,
    });
    expect(result.errors).toEqual([]);
    expect(Object.keys(result.metafile.inputs).some((path) =>
      path.includes("node-stream") || path.startsWith("node:"),
    )).toBe(false);
  });
});
