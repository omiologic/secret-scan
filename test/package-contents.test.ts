import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface PackFile {
  readonly path: string;
}

interface PackResult {
  readonly name: string;
  readonly version: string;
  readonly files: readonly PackFile[];
}

describe("package contents", () => {
  it("contains only intended runtime and documentation files", () => {
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), "secret-scan-package-inspection-"),
    );

    try {
      const manifest = JSON.parse(
        readFileSync("package.json", "utf8"),
      ) as Record<string, unknown>;
      expect(manifest.version).toBe("0.1.0-beta.1");
      writeFileSync(
        join(temporaryDirectory, "package.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
      for (const path of [
        "dist",
        "README.md",
        "ARCHITECTURE.md",
        "CHANGELOG.md",
        "LICENSE",
        "SECURITY.md",
      ]) {
        cpSync(path, join(temporaryDirectory, path), { recursive: true });
      }

      const output = execFileSync(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["pack", "--dry-run", "--json"],
        { cwd: temporaryDirectory, encoding: "utf8" },
      );
      const [result] = JSON.parse(output) as PackResult[];
      const paths = result?.files.map(({ path }) => path) ?? [];

      expect(result).toMatchObject({
        name: "@omiologic/secret-scan",
        version: "0.1.0-beta.1",
      });
      expect(paths).toContain("package.json");
      expect(paths).toContain("README.md");
      expect(paths).toContain("LICENSE");
      expect(paths).toContain("ARCHITECTURE.md");
      expect(paths).toContain("CHANGELOG.md");
      expect(paths).toContain("SECURITY.md");
      expect(paths).toContain("dist/index.js");
      expect(paths).toContain("dist/index.d.ts");
      expect(paths).toContain("dist/adapters/node-stream.js");
      expect(paths).toContain("dist/adapters/node-stream.d.ts");
      expect(paths).toContain("dist/adapters/web-stream.js");
      expect(paths).toContain("dist/adapters/web-stream.d.ts");
      expect(readFileSync("dist/index.d.ts", "utf8")).not.toContain(
        "INCREMENTAL_LOOKAROUND_CODE_UNITS",
      );
      expect(paths.some((path) => path.startsWith("src/"))).toBe(false);
      expect(paths.some((path) => path.startsWith("test/"))).toBe(false);
      expect(paths.some((path) => path.startsWith("_notes/"))).toBe(false);
      expect(paths.some((path) => path.startsWith(".agents/"))).toBe(false);
      expect(paths.some((path) => path.startsWith(".github/"))).toBe(false);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
