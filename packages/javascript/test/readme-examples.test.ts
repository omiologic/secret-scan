import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const README = readFileSync(join(PACKAGE_ROOT, "README.md"), "utf8");
const TSC = join(PACKAGE_ROOT, "..", "..", "node_modules", "typescript", "bin", "tsc");

/** Runs `tsc` over `project` and returns its diagnostics, empty when clean. */
function typeCheck(project: string): string {
  try {
    return execFileSync(process.execPath, [TSC, "--project", project], {
      cwd: PACKAGE_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string };
    return `${stdout ?? ""}${stderr ?? ""}` || String(error);
  }
}

/** Every fenced ` ```ts ` block in the README, in document order. */
function typeScriptExamples(): readonly string[] {
  return [...README.matchAll(/```ts\n([\s\S]*?)```/g)].map(
    ([, body]) => body ?? "",
  );
}

/** Every name a README example imports from `subpath` of the package. */
function importedNames(example: string, subpath = ""): readonly string[] {
  const names: string[] = [];
  const pattern = new RegExp(
    `import(?:\\s+type)?\\s+\\{([^}]*)\\}\\s+from\\s+"@redact-secret/core${subpath}"`,
    "g",
  );
  for (const [, clause] of example.matchAll(pattern)) {
    for (const name of (clause ?? "").split(",")) {
      const trimmed = name.trim();
      if (trimmed !== "") names.push(trimmed);
    }
  }
  return names;
}

describe("README examples", () => {
  it("documents at least one example per public capability", () => {
    const examples = typeScriptExamples();
    const imported = new Set(
      examples.flatMap((example) => importedNames(example)),
    );

    expect(examples.length).toBeGreaterThanOrEqual(6);
    for (const name of [
      "initialize",
      "scan",
      "redact",
      "scanAndRedact",
      "createIncrementalSanitizer",
      "typedPlaceholderFormatter",
      "SecretScanError",
      "RANGE_UNIT",
    ]) {
      expect(imported).toContain(name);
    }
  });

  it("documents both stream adapter subpaths", () => {
    const examples = typeScriptExamples();

    for (const [subpath, name] of [
      ["/node-stream", "createNodeStreamSanitizer"],
      ["/web-stream", "createWebStreamSanitizer"],
    ]) {
      const imported = new Set(
        examples.flatMap((example) => importedNames(example, subpath)),
      );

      expect(imported, `@redact-secret/core${subpath}`).toContain(name);
    }
  });

  it("imports only names the package actually exports", async () => {
    for (const [subpath, declarations] of [
      ["", "index.d.ts"],
      ["/node-stream", "adapters/node-stream.d.ts"],
      ["/web-stream", "adapters/web-stream.d.ts"],
    ]) {
      const module = `@redact-secret/core${subpath}`;
      const publicApi = (await import(module)) as Record<string, unknown>;
      const declared = readFileSync(
        join(PACKAGE_ROOT, "dist", declarations ?? ""),
        "utf8",
      );

      for (const name of new Set(
        typeScriptExamples().flatMap((example) =>
          importedNames(example, subpath),
        ),
      )) {
        const exported = name in publicApi || declared.includes(name);
        expect(exported, `${module} imports "${name}"`).toBe(true);
      }
    }
  });

  it("type-checks every example against the published declarations", () => {
    // The examples must compile inside the package so that
    // `@redact-secret/core` resolves through the same `exports` map a
    // consumer uses, rather than through a relative path into `src/`.
    const scratch = mkdtempSync(join(PACKAGE_ROOT, ".readme-examples-"));
    try {
      const sources: string[] = [];
      typeScriptExamples().forEach((example, index) => {
        const name = `example-${index}.ts`;
        writeFileSync(
          join(scratch, name),
          `${example}\nexport {};\n`,
        );
        sources.push(name);
      });
      writeFileSync(
        join(scratch, "tsconfig.json"),
        `${JSON.stringify(
          {
            extends: "../tsconfig.json",
            compilerOptions: {
              rootDir: ".",
              noEmit: true,
              declaration: false,
              lib: ["ES2022", "DOM"],
              // The Node adapter's own example needs `node:stream/promises`.
              // That the Web adapter and the root export resolve nothing
              // Node-only is proved by the browser bundle tests, not here.
              types: ["node"],
            },
            include: ["./*.ts"],
          },
          null,
          2,
        )}\n`,
      );

      expect(sources.length).toBeGreaterThan(0);
      const diagnostics = typeCheck(join(scratch, "tsconfig.json"));

      expect(diagnostics).toBe("");
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
