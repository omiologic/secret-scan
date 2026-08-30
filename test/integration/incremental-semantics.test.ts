import { describe, expect, it } from "vitest";

import {
  createIncrementalSanitizer,
  IncrementalSanitizerError,
  scanAndRedact,
  typedPlaceholderFormatter,
} from "../../src/index.js";
import type {
  IncrementalSanitizerOptions,
  IncrementalSanitizerResult,
  SecretAction,
} from "../../src/index.js";
import {
  codeUnitPartitions,
  fixedCodeUnitPartition,
  incrementalPartitionCorpus,
  singleCodeUnitPartition,
  utf8BytePartitions,
} from "../conformance/incremental-partitions.js";
import { conformanceCorpus } from "../conformance/corpus.js";

const LIMITS = Object.freeze({
  maxInputCodeUnits: 32_768,
  maxBufferedCodeUnits: 16_512,
  maxTokenCodeUnits: 8_192,
  maxMultilineCodeUnits: 16_384,
});

function sanitize(
  chunks: readonly string[],
  options: IncrementalSanitizerOptions = { limits: LIMITS },
): IncrementalSanitizerResult {
  const session = createIncrementalSanitizer(options);
  const results = chunks.map((chunk) => session.append(chunk));
  results.push(session.finalize());
  return {
    text: results.map(({ text }) => text).join(""),
    findings: results.flatMap(({ findings }) => findings),
  };
}

describe("incremental partition equivalence", () => {
  it("matches all bounded, evaluated detector conformance families", () => {
    const fixtures = conformanceCorpus.filter(
      ({ input, support }) => support !== "not-yet-evaluated" && input.length <= 1_024,
    );
    expect(new Set(fixtures.map(({ detector }) => detector))).toEqual(
      new Set([
        "private-key",
        "aws-access-key",
        "github-token",
        "gitlab-token",
        "openai-token",
        "anthropic-token",
        "shopify-token",
        "vault-token",
        "jwt",
        "bearer-token",
        "connection-string",
        "generic-token",
      ]),
    );
    for (const fixture of fixtures) {
      const expected = scanAndRedact(fixture.input);
      for (const chunks of codeUnitPartitions(fixture.input)) {
        expect(sanitize(chunks), fixture.id).toEqual(expected);
      }
    }
  });

  it.each(incrementalPartitionCorpus.map((fixture) => [fixture.id, fixture] as const))(
    "%s matches the whole-input result at every UTF-16 boundary",
    (_id, fixture) => {
      expect(scanAndRedact(fixture.input)).toEqual(fixture.expected);
      for (const chunks of codeUnitPartitions(fixture.input)) {
        expect(sanitize(chunks)).toEqual(fixture.expected);
      }
      expect(sanitize(singleCodeUnitPartition(fixture.input))).toEqual(fixture.expected);
    },
  );

  it.each(incrementalPartitionCorpus.map((fixture) => [fixture.id, fixture] as const))(
    "%s matches the whole-input result at every streaming UTF-8 boundary",
    (_id, fixture) => {
      for (const chunks of utf8BytePartitions(fixture.input)) {
        expect(sanitize(chunks)).toEqual(fixture.expected);
      }
    },
  );

  it("never emits a provisional detected value", () => {
    for (const fixture of incrementalPartitionCorpus) {
      for (const chunks of codeUnitPartitions(fixture.input)) {
        const replacedValues = fixture.expected.findings.map((finding) =>
          fixture.input.slice(finding.start, finding.end));
        const session = createIncrementalSanitizer({ limits: LIMITS });
        for (const chunk of chunks) {
          const result = session.append(chunk);
          for (const value of replacedValues) expect(result.text).not.toContain(value);
        }
        const final = session.finalize();
        for (const value of replacedValues) expect(final.text).not.toContain(value);
      }
    }
  });

  it("is deterministic and keeps placeholder numbering across emitted units", () => {
    const input = [
      `api_key=${"SYNTHETIC_REVOKED_FIRST_VALUE"}`,
      `password=${"SYNTHETIC_REVOKED_SECOND_VALUE"}`,
    ].join("\n");
    const chunks = singleCodeUnitPartition(input);
    const first = sanitize(chunks);
    const second = sanitize(chunks);
    expect(first).toEqual(second);
    expect(first.text).toBe("api_key=<SECRET_1>\npassword=<SECRET_2>");
  });

  it.each([
    `api_key\n=\n${"SYNTHETIC_REVOKED_MULTILINE_CONTEXT"}`,
    `authorization\n:\nbearer ${"SYNTHETIC_REVOKED_MULTILINE_BEARER"}`,
  ])("retains built-in constructs whose whitespace crosses lines", (input) => {
    expect(sanitize(singleCodeUnitPartition(input))).toEqual(scanAndRedact(input));
  });

  it("does not release a second private-key header after a completed block", () => {
    const block = [
      "-----BEGIN PRIVATE KEY-----",
      "U1lOVEhFVElDX1JFVk9LRURfU0VDT05EX0JMT0NL",
      "-----END PRIVATE KEY-----",
    ].join("\n");
    const input = `${block}\n${block}`;
    expect(sanitize(singleCodeUnitPartition(input))).toEqual(scanAndRedact(input));
  });

  it("accepts the audit reproduction identically as one chunk and every split", () => {
    const input = "x\n".repeat(200);
    const limits = {
      maxInputCodeUnits: 512,
      maxBufferedCodeUnits: 192,
      maxTokenCodeUnits: 32,
      maxMultilineCodeUnits: 64,
    };
    const expected = scanAndRedact(input);
    const twentyChunks = fixedCodeUnitPartition(input, 20);

    expect(input).toHaveLength(400);
    expect(twentyChunks).toHaveLength(20);
    expect(sanitize([input], { limits })).toEqual(expected);
    expect(sanitize(twentyChunks, { limits })).toEqual(expected);
    for (const chunks of codeUnitPartitions(input)) {
      expect(sanitize(chunks, { limits })).toEqual(expected);
    }
  });

  it("keeps retained and finalized units separate across line endings and Unicode", () => {
    const privateKey = [
      "-----BEGIN PRIVATE KEY-----",
      "U1lOVEhFVElDX1JFVk9LRURfUEFSVElUSU9O",
      "-----END PRIVATE KEY-----",
    ].join("\r\n");
    const lineEndings = ["\r", "\n", "\r\n"] as const;
    const closedLines = Array.from(
      { length: 24 },
      (_, index) => `closed-${index}-🧪${lineEndings[index % lineEndings.length]}`,
    ).join("");
    const input = `${closedLines}api_key=${
      "SYNTHETIC_REVOKED_PARTITION_VALUE"
    }\r${privateKey}\ntail`;
    const limits = {
      maxInputCodeUnits: 2_048,
      maxBufferedCodeUnits: 384,
      maxTokenCodeUnits: 128,
      maxMultilineCodeUnits: 256,
    };
    const expected = scanAndRedact(input);

    for (const chunks of [
      [input],
      fixedCodeUnitPartition(input, 1),
      fixedCodeUnitPartition(input, 7),
      fixedCodeUnitPartition(input, 31),
    ]) {
      expect(sanitize(chunks, { limits })).toEqual(expected);
    }
    for (const chunks of codeUnitPartitions(input)) {
      expect(sanitize(chunks, { limits })).toEqual(expected);
    }
  });

  it.each([
    [
      "token",
      {
        maxInputCodeUnits: 512,
        maxBufferedCodeUnits: 192,
        maxTokenCodeUnits: 32,
        maxMultilineCodeUnits: 64,
      },
      "x".repeat(32),
    ],
    [
      "multiline",
      {
        maxInputCodeUnits: 512,
        maxBufferedCodeUnits: 256,
        maxTokenCodeUnits: 64,
        maxMultilineCodeUnits: 128,
      },
      `-----BEGIN PRIVATE KEY-----\n${"A".repeat(100)}`,
    ],
  ] as const)("accepts an open %s construct at its exact limit", (
    name,
    limits,
    input,
  ) => {
    const expected = scanAndRedact(input);
    expect(input).toHaveLength(
      name === "token" ? limits.maxTokenCodeUnits : limits.maxMultilineCodeUnits,
    );
    for (const chunks of [
      ...codeUnitPartitions(input),
      fixedCodeUnitPartition(input, 1),
      fixedCodeUnitPartition(input, 17),
    ]) {
      expect(sanitize(chunks, { limits })).toEqual(expected);
    }
  });
});

describe("incremental lifecycle and safety", () => {
  it("passes immutable final metadata to the incremental policy exactly once", () => {
    const contexts: unknown[] = [];
    const input = `api_key=${"SYNTHETIC_REVOKED_POLICY_VALUE"}`;
    const result = sanitize([input], {
      limits: LIMITS,
      policy: {
        evaluate(finding, context) {
          expect(Object.isFrozen(finding)).toBe(true);
          expect(Object.isFrozen(context)).toBe(true);
          expect(Object.keys(context)).toEqual(["findingIndex"]);
          contexts.push(context);
          return "redact";
        },
      },
      placeholderFormatter: typedPlaceholderFormatter,
    });
    expect(contexts).toEqual([{ findingIndex: 0 }]);
    expect(result.text).toBe("api_key=<CONTEXTUAL_SECRET_1>");
  });

  it("aborts without output and rejects every later operation", () => {
    const session = createIncrementalSanitizer({ limits: LIMITS });
    expect(session.append("api_key=SYNTHETIC_REVOKED_ABORT_VALUE")).toEqual({
      text: "",
      findings: [],
    });
    session.abort();
    expect(session.state).toBe("aborted");
    expect(() => session.append("ignored")).toThrowError(IncrementalSanitizerError);
    expect(() => session.finalize()).toThrowError("no longer accepting");
    expect(() => session.abort()).toThrowError("no longer accepting");
  });

  it("finalizes exactly once", () => {
    const session = createIncrementalSanitizer({ limits: LIMITS });
    expect(session.finalize()).toEqual({ text: "", findings: [] });
    expect(session.state).toBe("finalized");
    expect(() => session.finalize()).toThrowError("no longer accepting");
  });

  it.each([
    ["input", { ...LIMITS, maxInputCodeUnits: 16_384 }, "x".repeat(16_385), "INPUT_LIMIT_EXCEEDED"],
    ["token", { ...LIMITS, maxTokenCodeUnits: 32 }, "x".repeat(33), "TOKEN_LIMIT_EXCEEDED"],
    [
      "multiline",
      { ...LIMITS, maxMultilineCodeUnits: 128 },
      `-----BEGIN PRIVATE KEY-----\n${"A".repeat(101)}`,
      "MULTILINE_LIMIT_EXCEEDED",
    ],
  ] as const)("fails safely at the %s limit", (_name, limits, input, code) => {
    const session = createIncrementalSanitizer({ limits });
    try {
      session.append(input);
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(IncrementalSanitizerError);
      expect((error as IncrementalSanitizerError).code).toBe(code);
      expect(String(error)).not.toContain(input);
      expect(session.state).toBe("failed");
    }
    expect(() => session.finalize()).toThrowError("no longer accepting");
  });

  it.each([
    [
      "token",
      {
        maxInputCodeUnits: 512,
        maxBufferedCodeUnits: 192,
        maxTokenCodeUnits: 64,
        maxMultilineCodeUnits: 64,
      },
      `ordinary\r\napi_key=${"SYNTHETIC_REVOKED_"}${"X".repeat(48)}`,
      "TOKEN_LIMIT_EXCEEDED",
    ],
    [
      "multiline",
      {
        maxInputCodeUnits: 512,
        maxBufferedCodeUnits: 256,
        maxTokenCodeUnits: 64,
        maxMultilineCodeUnits: 128,
      },
      `ordinary\n-----BEGIN PRIVATE KEY-----\r\n${"U1lOVEhFVElD".repeat(10)}`,
      "MULTILINE_LIMIT_EXCEEDED",
    ],
  ] as const)("fails with the same safe %s error across every partition", (
    _name,
    limits,
    input,
    code,
  ) => {
    for (const chunks of [
      ...codeUnitPartitions(input),
      fixedCodeUnitPartition(input, 1),
      fixedCodeUnitPartition(input, 17),
    ]) {
      const session = createIncrementalSanitizer({ limits });
      const emitted: string[] = [];
      let failure: unknown;
      try {
        for (const chunk of chunks) emitted.push(session.append(chunk).text);
        emitted.push(session.finalize().text);
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(IncrementalSanitizerError);
      expect((failure as IncrementalSanitizerError).code).toBe(code);
      expect(failure).not.toHaveProperty("cause");
      expect(String(failure)).not.toContain(input);
      expect(emitted.join("")).not.toContain("SYNTHETIC_REVOKED_");
      expect(session.state).toBe("failed");
      expect(() => session.finalize()).toThrowError("no longer accepting");
    }
  });

  it("rejects incomplete, unsafe limit relationships and detector extensions", () => {
    expect(() => createIncrementalSanitizer({ limits: {
      ...LIMITS,
      maxBufferedCodeUnits: LIMITS.maxMultilineCodeUnits,
    } })).toThrowError("limits are invalid");
    expect(() => createIncrementalSanitizer({} as IncrementalSanitizerOptions))
      .toThrowError("limits are invalid");
    expect(() => createIncrementalSanitizer({
      limits: LIMITS,
      detectors: [],
    } as IncrementalSanitizerOptions)).toThrowError("options are invalid");
  });

  it("sanitizes policy and formatter failures without returning buffered input", () => {
    const input = `api_key=${"SYNTHETIC_REVOKED_FAILURE_VALUE"}`;
    for (const options of [
      {
        limits: LIMITS,
        policy: { evaluate() { throw new Error(input); } },
      },
      {
        limits: LIMITS,
        policy: { evaluate() { return "invalid" as SecretAction; } },
      },
      {
        limits: LIMITS,
        placeholderFormatter() { throw new Error(input); },
      },
      {
        limits: LIMITS,
        placeholderFormatter() { return input; },
      },
    ] satisfies IncrementalSanitizerOptions[]) {
      const session = createIncrementalSanitizer(options);
      expect(session.append(input)).toEqual({ text: "", findings: [] });
      try {
        session.finalize();
        throw new Error("expected failure");
      } catch (error) {
        expect(error).toBeInstanceOf(IncrementalSanitizerError);
        expect(String(error)).not.toContain(input);
        expect(session.state).toBe("failed");
      }
    }
  });
});
