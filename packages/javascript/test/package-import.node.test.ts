import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Runs `source` in a fresh Node process resolving the built package. */
function runInNode(source: string): string {
  return execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", source],
    { cwd: PACKAGE_ROOT, encoding: "utf8" },
  );
}

describe("Node package import", () => {
  it("resolves the package entry point through its exports map", () => {
    const output = runInNode(
      [
        "const api = await import('@omiologic/secret-scan');",
        "console.log(JSON.stringify(Object.keys(api).sort()));",
      ].join(" "),
    );

    expect(JSON.parse(output)).toEqual([
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
    ]);
  });

  it("selects the Node adapter, not the browser one", () => {
    const output = runInNode(
      [
        "const { loadNativeBinding } = await import('#native');",
        "console.log(typeof loadNativeBinding);",
      ].join(" "),
    );

    expect(output.trim()).toBe("function");
    expect(
      runInNode(
        [
          "const resolved = import.meta.resolve('#native');",
          "console.log(resolved.endsWith('dist/runtime/node.js'));",
        ].join(" "),
      ).trim(),
    ).toBe("true");
  });

  it("resolves both stream adapter subpaths through the exports map", () => {
    const output = runInNode(
      [
        "const node = await import('@omiologic/secret-scan/node-stream');",
        "const web = await import('@omiologic/secret-scan/web-stream');",
        "console.log(JSON.stringify({",
        "  node: Object.keys(node).sort(),",
        "  web: Object.keys(web).sort(),",
        "}));",
      ].join(" "),
    );

    expect(JSON.parse(output)).toEqual({
      node: [
        "NodeStreamSanitizer",
        "SecretScanError",
        "createNodeStreamSanitizer",
      ],
      web: [
        "SecretScanError",
        "WebStreamSanitizer",
        "createWebStreamSanitizer",
      ],
    });
  });

  it("shares one initialization state across the root and the adapters", () => {
    const output = runInNode(
      [
        "const { createNodeStreamSanitizer } = await import('@omiologic/secret-scan/node-stream');",
        "const { createWebStreamSanitizer } = await import('@omiologic/secret-scan/web-stream');",
        "const limits = { maxInputCodeUnits: 1024, maxBufferedCodeUnits: 384, maxTokenCodeUnits: 128, maxMultilineCodeUnits: 256 };",
        "const codes = [];",
        "for (const open of [createNodeStreamSanitizer, createWebStreamSanitizer]) {",
        "  try { open({ limits }); codes.push('resolved'); }",
        "  catch (error) { codes.push(error.code); }",
        "}",
        "console.log(JSON.stringify(codes));",
      ].join(" "),
    );

    // Both adapters go through the same runtime as the root export, so both
    // report the root's own uninitialized state rather than opening a session.
    expect(JSON.parse(output)).toEqual(["NOT_INITIALIZED", "NOT_INITIALIZED"]);
  });

  it("refuses synchronous operations before initialize succeeds", () => {
    const output = runInNode(
      [
        "const { scan, SecretScanError } = await import('@omiologic/secret-scan');",
        "try { scan('API_KEY=SYNTHETIC_REVOKED_VALUE'); }",
        "catch (error) {",
        "  if (!(error instanceof SecretScanError)) throw new Error('wrong error type');",
        "  console.log(JSON.stringify({ code: error.code, name: error.name, message: error.message }));",
        "}",
      ].join(" "),
    );

    expect(JSON.parse(output)).toEqual({
      code: "NOT_INITIALIZED",
      name: "SecretScanError",
      message:
        "secret-scan is not initialized; await initialize() before this call.",
    });
  });

  it("reports a fixed error when the platform artifact is absent", () => {
    const output = runInNode(
      [
        "const { initialize } = await import('@omiologic/secret-scan');",
        "try { await initialize(); console.log('resolved'); }",
        "catch (error) { console.log(JSON.stringify({ code: error.code, message: error.message })); }",
      ].join(" "),
    );

    // A source checkout has no built addon, so this is the loader's failure
    // path: fixed code, fixed message, and nothing about the host or the file
    // it could not find.
    expect(JSON.parse(output)).toEqual({
      code: "INITIALIZATION_FAILED",
      message: "secret-scan failed to initialize.",
    });
  });

  it("keeps every internal module unreachable from outside the package", () => {
    for (const subpath of [
      "@omiologic/secret-scan/native",
      "@omiologic/secret-scan/runtime",
      "@omiologic/secret-scan/dist/index.js",
    ]) {
      const output = runInNode(
        [
          `try { await import(${JSON.stringify(subpath)}); console.log('resolved'); }`,
          "catch (error) { console.log(error.code); }",
        ].join(" "),
      );
      expect(output.trim()).toBe("ERR_PACKAGE_PATH_NOT_EXPORTED");
    }
  });
});
