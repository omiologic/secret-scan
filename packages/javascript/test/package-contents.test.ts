import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = join(PACKAGE_ROOT, "..", "..");

interface PackFile {
  readonly path: string;
}

interface PackResult {
  readonly name: string;
  readonly version: string;
  readonly files: readonly PackFile[];
}

/**
 * Packs the package in a temporary copy.
 *
 * `LICENSE` lives at the repository root, so the copy is also what proves the
 * published tarball can carry it without the repository layout leaking in.
 */
function pack(): PackResult {
  const temporary = mkdtempSync(join(tmpdir(), "secret-scan-js-package-"));
  try {
    const manifest = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as Record<string, unknown>;
    writeFileSync(
      join(temporary, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    cpSync(join(PACKAGE_ROOT, "dist"), join(temporary, "dist"), {
      recursive: true,
    });
    cpSync(join(PACKAGE_ROOT, "README.md"), join(temporary, "README.md"));
    cpSync(join(REPOSITORY_ROOT, "LICENSE"), join(temporary, "LICENSE"));

    const output = execFileSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["pack", "--dry-run", "--json"],
      { cwd: temporary, encoding: "utf8" },
    );
    const [result] = JSON.parse(output) as PackResult[];
    if (result === undefined) throw new Error("npm pack produced no result");
    return result;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

describe("package contents", () => {
  it("publishes the runtime, the declarations, and the documentation", () => {
    const result = pack();
    const paths = result.files.map(({ path }) => path);

    expect(result.name).toBe("@omiologic/secret-scan");
    expect(paths).toContain("package.json");
    expect(paths).toContain("README.md");
    expect(paths).toContain("LICENSE");
    expect(paths).toContain("dist/index.js");
    expect(paths).toContain("dist/index.d.ts");
    expect(paths).toContain("dist/runtime/node.js");
    expect(paths).toContain("dist/runtime/browser.js");
    expect(paths).toContain("dist/adapters/node-stream.js");
    expect(paths).toContain("dist/adapters/node-stream.d.ts");
    expect(paths).toContain("dist/adapters/web-stream.js");
    expect(paths).toContain("dist/adapters/web-stream.d.ts");
  });

  it("publishes nothing from the repository around it", () => {
    const paths = pack().files.map(({ path }) => path);

    for (const prefix of [
      "src/",
      "test/",
      "crates/",
      "bindings/",
      "conformance/",
      ".github/",
      "_notes/",
    ]) {
      expect(paths.some((path) => path.startsWith(prefix))).toBe(false);
    }
    expect(paths.some((path) => path.endsWith(".map"))).toBe(false);
    expect(paths.some((path) => path.endsWith("tsconfig.json"))).toBe(false);
  });

  it("carries the shared product version in every place that states it", () => {
    const result = pack();
    const workspaceManifest = JSON.parse(
      readFileSync(join(REPOSITORY_ROOT, "package.json"), "utf8"),
    ) as { version: string };
    const declaredVersion = readFileSync(
      join(PACKAGE_ROOT, "dist", "version.js"),
      "utf8",
    );

    expect(result.version).toBe(workspaceManifest.version);
    expect(declaredVersion).toContain(`"${workspaceManifest.version}"`);
  });

  it("exposes the reviewed public subpaths and no internal ones", () => {
    const manifest = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as { exports: Record<string, unknown>; imports: Record<string, unknown> };

    // The root API plus the two stream adapters. Each adapter is its own
    // subpath so that resolving the Web one never reaches `node:stream`.
    expect(Object.keys(manifest.exports).sort()).toEqual([
      ".",
      "./node-stream",
      "./package.json",
      "./web-stream",
    ]);
    // `#native` is a subpath *import*: it is how this package selects its own
    // runtime adapter and is not reachable from outside.
    expect(Object.keys(manifest.imports)).toEqual(["#native"]);
  });

  it("keeps the Web adapter free of Node-only modules", () => {
    for (const file of [
      "web-stream.js",
      "web-stream.d.ts",
      "shared.js",
      "shared.d.ts",
    ]) {
      const source = readFileSync(
        join(PACKAGE_ROOT, "dist", "adapters", file),
        "utf8",
      );

      expect(source, file).not.toMatch(/from\s+["']node:/);
    }
  });

  it("keeps implementation details out of the published declarations", () => {
    const declarations = readFileSync(
      join(PACKAGE_ROOT, "dist", "index.d.ts"),
      "utf8",
    );

    for (const internal of [
      "#native",
      "NATIVE_HANDLE",
      "NativeBinding",
      "createSecretScanRuntime",
      "INCREMENTAL_LOOKAROUND",
      "SecretDetector",
      "DetectorRegistry",
    ]) {
      expect(declarations).not.toContain(internal);
    }
  });
});
