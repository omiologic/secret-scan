import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  createIncrementalSanitizer,
  IncrementalSanitizerError,
} from "../../src/incremental.js";
import type { IncrementalSanitizerErrorCode } from "../../src/incremental.js";
import {
  createStreamSanitizerRuntime,
  StreamSanitizerError,
} from "../../src/adapters/shared.js";
import type { StreamSanitizerErrorCode } from "../../src/adapters/shared.js";
import { scanAndRedact } from "../../src/index.js";
import {
  convertCorpusToCanonical,
  convertIncrementalCorpusToCanonical,
  utf8ByteOffsetToUtf16Offset,
} from "../../conformance/convert.js";
import type {
  CanonicalErrorCode,
  CanonicalExpectation,
  CanonicalFixture,
  CanonicalIncrementalFixture,
  CanonicalIncrementalOperation,
  CanonicalLifecycleFixture,
} from "../../conformance/schema.js";
import {
  validateCanonicalErrorCodes,
  validateCanonicalFixtures,
  validateCanonicalIncrementalFixtures,
  validateCanonicalLifecycleFixtures,
} from "../../conformance/schema.js";
import { unicodeAstralFixtures } from "../../conformance/fixtures/unicode-astral.source.js";
import { incrementalLifecycleFixtures } from "../../conformance/fixtures/incremental-lifecycle.source.js";
import { errorCodeFixtures } from "../../conformance/fixtures/error-codes.source.js";
import { conformanceCorpus } from "./corpus.js";
import { incrementalPartitionCorpus } from "./incremental-partitions.js";
import {
  codeUnitPartitions,
  utf8BytePartitions,
} from "./incremental-partitions.js";

/**
 * Proves the persisted canonical, non-synchronous evidence — whole-input
 * incremental references, Unicode astral conversion, and safe
 * lifecycle/abort/malformed-UTF-8/limit scenarios — against the current
 * TypeScript implementation, per `decision-govern-cross-language-conformance`.
 * Companion to `canonical-oracle.test.ts`, which covers the synchronous
 * detector corpus. The TypeScript core must pass every fixture here before
 * the Rust core may use this corpus as its own oracle.
 */

const DEFAULT_LIMITS = Object.freeze({
  maxInputCodeUnits: 32_768,
  maxBufferedCodeUnits: 16_512,
  maxTokenCodeUnits: 8_192,
  maxMultilineCodeUnits: 16_384,
});

function readCorpus<T>(name: string): { readonly fixtureCount: number; readonly fixtures: readonly T[] } {
  const url = new URL(`../../conformance/fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as {
    fixtureCount: number;
    fixtures: readonly T[];
  };
}

const incrementalRaw = readCorpus<CanonicalIncrementalFixture>("incremental-corpus.json");
const incrementalCanonical = validateCanonicalIncrementalFixtures(incrementalRaw.fixtures);

const unicodeRaw = readCorpus<CanonicalFixture>("unicode-conversion-corpus.json");
const unicodeCanonical = validateCanonicalFixtures(unicodeRaw.fixtures);

const lifecycleRaw = readCorpus<CanonicalLifecycleFixture>("incremental-lifecycle-corpus.json");
const lifecycleCanonical = validateCanonicalLifecycleFixtures(lifecycleRaw.fixtures);

const errorCodesRaw = JSON.parse(
  readFileSync(new URL("../../conformance/fixtures/error-codes.json", import.meta.url), "utf8"),
) as { readonly codeCount: number; readonly codes: readonly CanonicalErrorCode[] };
const errorCodesCanonical = validateCanonicalErrorCodes(errorCodesRaw.codes);

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

interface LifecycleRun {
  readonly text: string;
  readonly findingCount: number;
  readonly state?: string | undefined;
  readonly errorCode?: string | undefined;
}

function runLifecycleFixture(fixture: CanonicalLifecycleFixture): LifecycleRun {
  const limits = fixture.limits ?? DEFAULT_LIMITS;
  let text = "";
  let findingCount = 0;

  if (fixture.surface === "incremental") {
    const session = createIncrementalSanitizer({ limits });
    for (const [index, operation] of fixture.operations.entries()) {
      try {
        const result = runIncrementalOperation(session, operation);
        text += result.text;
        findingCount += result.findingCount;
      } catch (error) {
        if (index !== fixture.operations.length - 1) throw error;
        return {
          text,
          findingCount,
          state: session.state,
          errorCode: error instanceof IncrementalSanitizerError ? error.code : undefined,
        };
      }
    }
    return { text, findingCount, state: session.state };
  }

  const runtime = createStreamSanitizerRuntime({ limits });
  for (const [index, operation] of fixture.operations.entries()) {
    try {
      if (operation.op !== "appendBytesHex" && operation.op !== "finalize" && operation.op !== "abort") {
        throw new TypeError(`Operation ${operation.op} is not valid on the stream surface.`);
      }
      if (operation.op === "appendBytesHex") {
        text += runtime.append(hexToBytes(operation.bytesHex)).text;
      } else if (operation.op === "finalize") {
        text += runtime.finalize().text;
      } else {
        runtime.abort();
      }
    } catch (error) {
      if (index !== fixture.operations.length - 1) throw error;
      return {
        text,
        findingCount: runtime.findings.length,
        errorCode: error instanceof StreamSanitizerError || error instanceof IncrementalSanitizerError
          ? error.code
          : undefined,
      };
    }
  }
  return { text, findingCount: runtime.findings.length };
}

function runIncrementalOperation(
  session: ReturnType<typeof createIncrementalSanitizer>,
  operation: CanonicalIncrementalOperation,
): { readonly text: string; readonly findingCount: number } {
  switch (operation.op) {
    case "append": {
      const result = session.append(operation.chunk);
      return { text: result.text, findingCount: result.findings.length };
    }
    case "finalize": {
      const result = session.finalize();
      return { text: result.text, findingCount: result.findings.length };
    }
    case "abort":
      session.abort();
      return { text: "", findingCount: 0 };
    case "appendBytesHex":
      throw new TypeError("appendBytesHex is only valid on the stream surface.");
  }
}

describe("canonical incremental-reference oracle", () => {
  it("is declared UTF-8-byte-offset JSON with an accurate fixture count", () => {
    expect(incrementalRaw.fixtureCount).toBe(incrementalRaw.fixtures.length);
  });

  it("matches a fresh conversion of the temporary oracle's incremental corpus, with no drift", () => {
    const specificityByType = new Map<string, CanonicalExpectation["specificity"]>();
    for (const fixture of conformanceCorpus) {
      for (const expected of fixture.expected ?? []) {
        specificityByType.set(expected.type, expected.specificity);
      }
    }
    const fresh = convertIncrementalCorpusToCanonical(
      incrementalPartitionCorpus.map((fixture) => ({
        id: fixture.id,
        input: fixture.input,
        expected: {
          text: fixture.expected.text,
          findings: fixture.expected.findings.map((finding) => {
            const specificity = specificityByType.get(finding.type);
            if (specificity === undefined) {
              throw new TypeError(`No synchronous-corpus specificity for type ${finding.type}.`);
            }
            return {
              detector: finding.detector,
              type: finding.type,
              confidence: finding.confidence,
              specificity,
              start: finding.start,
              end: finding.end,
            };
          }),
        },
        note: fixture.note,
      })),
    );
    expect(incrementalCanonical).toEqual(fresh);
  });

  it.each(incrementalCanonical.map((fixture) => [fixture.id, fixture] as const))(
    "%s reproduces the canonical whole-input reference",
    (_id, fixture) => {
      const result = scanAndRedact(fixture.input);
      expect(result.text).toBe(fixture.text);
      expect(result.findings).toHaveLength(fixture.expected.length);
      for (const [index, expected] of fixture.expected.entries()) {
        const finding = result.findings[index]!;
        expect(finding.detector).toBe(expected.detector);
        expect(finding.type).toBe(expected.type);
        expect(finding.confidence).toBe(expected.confidence);
        expect(utf8ByteOffsetToUtf16Offset(fixture.input, expected.start)).toBe(finding.start);
        expect(utf8ByteOffsetToUtf16Offset(fixture.input, expected.end)).toBe(finding.end);
      }
    },
  );

  it.each(incrementalCanonical.map((fixture) => [fixture.id, fixture] as const))(
    "%s matches the reference at every UTF-16 and streaming UTF-8 partition",
    (_id, fixture) => {
      function sanitize(chunks: readonly string[]): string {
        const session = createIncrementalSanitizer({ limits: DEFAULT_LIMITS });
        const parts = chunks.map((chunk) => session.append(chunk).text);
        parts.push(session.finalize().text);
        return parts.join("");
      }

      for (const chunks of codeUnitPartitions(fixture.input)) {
        expect(sanitize(chunks)).toBe(fixture.text);
      }
      for (const chunks of utf8BytePartitions(fixture.input)) {
        expect(sanitize(chunks)).toBe(fixture.text);
      }
    },
  );
});

describe("canonical Unicode conversion oracle", () => {
  it("matches a fresh conversion of the astral fixture source, with no drift", () => {
    expect(unicodeCanonical).toEqual(convertCorpusToCanonical(unicodeAstralFixtures));
  });
});

describe("canonical lifecycle, abort, malformed-input, and resource-limit oracle", () => {
  it("matches its hand-authored canonical source, with no drift", () => {
    expect(lifecycleCanonical).toEqual(incrementalLifecycleFixtures);
  });

  it.each(lifecycleCanonical.map((fixture) => [fixture.id, fixture] as const))(
    "%s reproduces the declared outcome",
    (_id, fixture) => {
      const run = runLifecycleFixture(fixture);
      expect(run.text).toBe(fixture.outcome.text);
      expect(run.findingCount).toBe(fixture.outcome.findingCount);
      if (fixture.outcome.ok) {
        expect(run.errorCode).toBeUndefined();
        // Only the `incremental` surface exposes a public state getter; the
        // stream surface intentionally does not, so state is unverified
        // there (see `CanonicalLifecycleFixture`'s doc comment).
        if (fixture.surface === "incremental") expect(run.state).toBe(fixture.outcome.state);
      } else {
        expect(run.errorCode).toBe(fixture.outcome.code);
        if (fixture.surface === "incremental") expect(run.state).toBe(fixture.outcome.state);
      }
    },
  );
});

describe("canonical safe-error code registry", () => {
  it("matches its hand-authored canonical source, with no drift", () => {
    expect(errorCodesCanonical).toEqual(errorCodeFixtures);
  });

  it("carries every incremental sanitizer code with its exact, current message", () => {
    const incrementalCodes: readonly IncrementalSanitizerErrorCode[] = [
      "INVALID_OPTIONS",
      "INVALID_LIMITS",
      "INVALID_INPUT",
      "INPUT_LIMIT_EXCEEDED",
      "BUFFER_LIMIT_EXCEEDED",
      "TOKEN_LIMIT_EXCEEDED",
      "MULTILINE_LIMIT_EXCEEDED",
      "DETECTOR_FAILURE",
      "POLICY_FAILURE",
      "INVALID_POLICY_ACTION",
      "PLACEHOLDER_FAILURE",
      "INVALID_PLACEHOLDER",
      "INVALID_STATE",
    ];
    const registered = new Map(
      errorCodesCanonical
        .filter((entry) => entry.surface === "incremental")
        .map((entry) => [entry.code, entry.message]),
    );
    expect(new Set(registered.keys())).toEqual(new Set(incrementalCodes));
    for (const code of incrementalCodes) {
      expect(registered.get(code)).toBe(new IncrementalSanitizerError(code).message);
    }
  });

  it("carries every stream adapter code with its exact, current message", () => {
    const streamCodes: readonly StreamSanitizerErrorCode[] = ["INVALID_CHUNK", "INVALID_UTF8"];
    const registered = new Map(
      errorCodesCanonical
        .filter((entry) => entry.surface === "stream")
        .map((entry) => [entry.code, entry.message]),
    );
    expect(new Set(registered.keys())).toEqual(new Set(streamCodes));
    for (const code of streamCodes) {
      expect(registered.get(code)).toBe(new StreamSanitizerError(code).message);
    }
  });

  it("never lets a registry lookup or message carry a matched value", () => {
    for (const entry of errorCodesCanonical) {
      expect(entry.message).not.toMatch(/SYNTHETIC|REVOKED/);
    }
  });
});
