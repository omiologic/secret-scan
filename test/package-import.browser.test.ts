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
          'import { scanAndRedact } from "@omiologic/secret-scan"; globalThis.secretScanResult = scanAndRedact("ordinary text");',
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
});
