import { describe, expect, it } from "vitest";

/**
 * The published runtime surface, in full.
 *
 * Adding a name here is a public API change; the list exists so that one
 * cannot happen by accident. Detector construction, registries, entropy
 * helpers, and every internal module are absent by design: built-in detectors
 * run in Rust and custom detector callbacks are not part of the first stable
 * API (`decision-define-runtime-bindings`).
 */
const PUBLIC_RUNTIME_EXPORTS = [
  "RANGE_UNIT",
  "SecretScanError",
  "VERSION",
  "createIncrementalSanitizer",
  "defaultPlaceholderFormatter",
  "initialize",
  "redact",
  "scan",
  "scanAndRedact",
  "typedPlaceholderFormatter",
];

/**
 * Each stream adapter subpath, in full. Both re-export `SecretScanError` so a
 * consumer of one adapter can catch its failures without also importing the
 * root, and neither adds an error type of its own.
 */
const PUBLIC_ADAPTER_EXPORTS = {
  "@omiologic/secret-scan/node-stream": [
    "NodeStreamSanitizer",
    "SecretScanError",
    "createNodeStreamSanitizer",
  ],
  "@omiologic/secret-scan/web-stream": [
    "SecretScanError",
    "WebStreamSanitizer",
    "createWebStreamSanitizer",
  ],
};

describe("exact exports", () => {
  it("exposes only the reviewed root runtime values", async () => {
    const publicApi = await import("@omiologic/secret-scan");

    expect(Object.keys(publicApi).sort()).toEqual(PUBLIC_RUNTIME_EXPORTS);
  });

  it("states its range unit and its lockstep product version", async () => {
    const { RANGE_UNIT, VERSION } = await import("@omiologic/secret-scan");
    const manifest = await import("../package.json", { with: { type: "json" } });

    expect(RANGE_UNIT).toBe("utf16-code-units");
    expect(VERSION).toBe(manifest.default.version);
  });

  it("exposes only the reviewed values on each stream adapter subpath", async () => {
    for (const [subpath, expected] of Object.entries(PUBLIC_ADAPTER_EXPORTS)) {
      const adapter = await import(subpath);

      expect(Object.keys(adapter).sort(), subpath).toEqual(expected);
    }
  });

  it("keeps every documented internal module unreachable", async () => {
    for (const subpath of [
      "@omiologic/secret-scan/native",
      "@omiologic/secret-scan/runtime",
      "@omiologic/secret-scan/session",
      "@omiologic/secret-scan/adapters/shared",
      "@omiologic/secret-scan/dist/index.js",
      "@omiologic/secret-scan/runtime/node",
    ]) {
      await expect(import(subpath)).rejects.toThrowError(
        /is not exported|ERR_PACKAGE_PATH_NOT_EXPORTED|Cannot find/,
      );
    }
  });
});
