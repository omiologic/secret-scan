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
          "const { createIncrementalSanitizer } = await import('@omiologic/secret-scan');",
          "const session = createIncrementalSanitizer({ limits: { maxInputCodeUnits: 1024, maxBufferedCodeUnits: 384, maxTokenCodeUnits: 128, maxMultilineCodeUnits: 256 } });",
          "session.append('ordinary text'); const result = session.finalize();",
          "if (result.text !== 'ordinary text' || result.findings.length !== 0) throw new Error('package runtime check failed');",
        ].join(" "),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output).toBe("");
  });

  it("loads the isolated Node stream subpath", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        [
          "import { Readable } from 'node:stream';",
          "const { createNodeStreamSanitizer } = await import('@omiologic/secret-scan/node-stream');",
          "const adapter = createNodeStreamSanitizer({ limits: { maxInputCodeUnits: 1024, maxBufferedCodeUnits: 384, maxTokenCodeUnits: 128, maxMultilineCodeUnits: 256 } });",
          "const chunks = []; for await (const chunk of Readable.from([Buffer.from('ordinary text')]).pipe(adapter)) chunks.push(chunk);",
          "if (Buffer.concat(chunks).toString() !== 'ordinary text' || adapter.findings.length !== 0) throw new Error('adapter runtime check failed');",
        ].join(" "),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(output).toBe("");
  });
});
