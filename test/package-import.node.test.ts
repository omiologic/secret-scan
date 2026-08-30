import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Node package import", () => {
  it("loads the package entry point without observable output", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        [
          "const { scanAndRedact } = await import('@omiologic/secret-scan');",
          "const result = scanAndRedact('ordinary text');",
          "if (result.text !== 'ordinary text' || result.findings.length !== 0) throw new Error('package runtime check failed');",
        ].join(" "),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output).toBe("");
  });
});
