import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("rust assessment adapter", () => {
  it("passes tiny public API self-tests for Unicode, failures, and incomplete runs", () => {
    const output = execFileSync(
      "cargo",
      ["run", "-p", "redact-secret", "--example", "assessment_adapter", "--", "self-test"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    expect(output).toBe("");
  }, 30_000);
});
