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

  it("keeps every documented internal module unreachable", async () => {
    for (const subpath of [
      "@omiologic/secret-scan/native",
      "@omiologic/secret-scan/runtime",
      "@omiologic/secret-scan/dist/index.js",
      "@omiologic/secret-scan/runtime/node",
    ]) {
      await expect(import(subpath)).rejects.toThrowError(
        /is not exported|ERR_PACKAGE_PATH_NOT_EXPORTED|Cannot find/,
      );
    }
  });
});
