import { describe, expect, it } from "vitest";

import {
  redact,
  scan,
  scanAndRedact,
  SecretRedactionError,
  SecretScanError,
  typedPlaceholderFormatter,
} from "../../src/index.js";
import type {
  DetectedSecretFinding,
  SecretAction,
  SecretDetector,
  SecretFinding,
  SecretPolicy,
} from "../../src/index.js";

const OPENAI_VALUE = "sk-proj-SYNTHETIC_REVOKED_POLICY_KEY";
const CONTEXT_VALUE = "aaaaaaaaaaaaaaaa";
const PRIVATE_KEY = [
  "-----BEGIN PRIVATE KEY-----",
  "U1lOVEhFVElDX1JFVk9LRURfUE9MSUNZ",
  "-----END PRIVATE KEY-----",
].join("\n");

function finding(
  start: number,
  end: number,
  action: SecretAction = "redact",
  id = `finding-${start + 1}`,
): SecretFinding {
  return {
    id,
    type: "synthetic_credential",
    detector: "synthetic-detector",
    confidence: "high",
    action,
    start,
    end,
  };
}

function metadataOnly(value: DetectedSecretFinding | SecretFinding) {
  const { action: _action, ...metadata } = value as SecretFinding;
  return metadata;
}

describe("default policy", () => {
  it("blocks private keys, redacts known formats, and warns on medium context", () => {
    const input = `${PRIVATE_KEY}\napi_key=${OPENAI_VALUE}\nsecret_key=${CONTEXT_VALUE}`;
    expect(scan(input).map(({ type, confidence, action }) => ({
      type,
      confidence,
      action,
    }))).toEqual([
      { type: "private_key", confidence: "high", action: "block" },
      { type: "openai_api_key", confidence: "high", action: "redact" },
      { type: "contextual_secret", confidence: "medium", action: "warn" },
    ]);
  });

  it("keeps detection metadata stable across browser and server policies", () => {
    const input = `api_key=${OPENAI_VALUE}`;
    const browserPolicy: SecretPolicy = { evaluate: () => "warn" };
    const serverPolicy: SecretPolicy = { evaluate: () => "block" };
    const browser = scan(input, { policy: browserPolicy });
    const server = scan(input, { policy: serverPolicy });

    expect(browser.map(metadataOnly)).toEqual(server.map(metadataOnly));
    expect(browser[0]?.action).toBe("warn");
    expect(server[0]?.action).toBe("block");
  });

  it("passes immutable, plaintext-free metadata and deterministic context", () => {
    const input = `api_key=${OPENAI_VALUE}`;
    const policy: SecretPolicy = {
      evaluate(detected, context) {
        expect(Object.isFrozen(detected)).toBe(true);
        expect(Object.isFrozen(context)).toBe(true);
        expect(Object.keys(detected).sort()).toEqual([
          "confidence",
          "detector",
          "end",
          "id",
          "start",
          "type",
        ]);
        expect(JSON.stringify(detected)).not.toContain(OPENAI_VALUE);
        expect(context).toEqual({ findingIndex: 0, findingCount: 1 });
        return "redact";
      },
    };

    expect(scan(input, { policy })).toHaveLength(1);
  });

  it("sanitizes policy failures and rejects invalid actions", () => {
    const input = `api_key=${OPENAI_VALUE}`;
    const failing = {
      evaluate() {
        throw new Error(input);
      },
    } satisfies SecretPolicy;
    const invalid = {
      evaluate() {
        return "invalid" as SecretAction;
      },
    } satisfies SecretPolicy;

    expect(() => scan(input, { policy: failing })).toThrowError(
      "The secret policy failed.",
    );
    try {
      scan(input, { policy: failing });
    } catch (error) {
      expect(error).toBeInstanceOf(SecretScanError);
      expect(String(error)).not.toContain(OPENAI_VALUE);
    }
    expect(() => scan(input, { policy: invalid })).toThrowError(
      "The secret policy returned an invalid action.",
    );
  });

  it("sanitizes hostile option getters", () => {
    const input = `api_key=${OPENAI_VALUE}`;
    const options = Object.defineProperty({}, "policy", {
      get() {
        throw new Error(input);
      },
    });
    try {
      scan(input, options);
    } catch (error) {
      expect(error).toBeInstanceOf(SecretScanError);
      expect(String(error)).not.toContain(OPENAI_VALUE);
    }
  });
});

describe("redact", () => {
  it("reconstructs repeated and adjacent values in one deterministic pass", () => {
    const input = "SYNTHETIC_ONE|SYNTHETIC_ONE|SYNTHETIC_TWO";
    const firstStart = input.indexOf("SYNTHETIC_ONE");
    const secondStart = input.indexOf("SYNTHETIC_ONE", firstStart + 1);
    const thirdStart = input.indexOf("SYNTHETIC_TWO");
    const findings = [
      finding(thirdStart, input.length, "block", "finding-3"),
      finding(firstStart, firstStart + 13, "redact", "finding-1"),
      finding(secondStart, secondStart + 13, "redact", "finding-2"),
    ];

    expect(redact(input, findings)).toBe("<SECRET_1>|<SECRET_2>|<SECRET_3>");
    expect(redact(input, findings)).toBe(redact(input, findings));
  });

  it("leaves warn and allow findings unchanged without consuming numbers", () => {
    const input = "WARN|ALLOW|REDACTED_VALUE";
    const findings = [
      finding(0, 4, "warn", "finding-1"),
      finding(5, 10, "allow", "finding-2"),
      finding(11, input.length, "redact", "finding-3"),
    ];
    expect(redact(input, findings)).toBe("WARN|ALLOW|<SECRET_1>");
  });

  it("redacts adjacent findings without dropping or duplicating text", () => {
    const input = "SYNTHETIC_ONESYNTHETIC_TWO";
    expect(
      redact(input, [
        finding(0, 13, "redact", "finding-1"),
        finding(13, 26, "redact", "finding-2"),
      ]),
    ).toBe("<SECRET_1><SECRET_2>");
  });

  it("supports typed placeholders and safe custom formatters", () => {
    const input = "SYNTHETIC_REVOKED_VALUE";
    const findings = [finding(0, input.length)];
    expect(
      redact(input, findings, {
        placeholderFormatter: typedPlaceholderFormatter,
      }),
    ).toBe("<SYNTHETIC_CREDENTIAL_1>");

    expect(
      redact(input, findings, {
        placeholderFormatter(safeFinding, context) {
          expect(Object.isFrozen(safeFinding)).toBe(true);
          expect(Object.isFrozen(context)).toBe(true);
          expect(Object.keys(safeFinding)).not.toContain("value");
          expect(context.placeholderIndex).toBe(1);
          return `<REMOVED_${safeFinding.type}_${context.placeholderIndex}>`;
        },
      }),
    ).toBe("<REMOVED_synthetic_credential_1>");
  });

  it("sanitizes formatter failures and rejects plaintext placeholders", () => {
    const input = "SYNTHETIC_REVOKED_VALUE";
    const findings = [finding(0, input.length)];
    expect(() =>
      redact(input, findings, {
        placeholderFormatter() {
          throw new Error(input);
        },
      }),
    ).toThrowError("The placeholder formatter failed.");
    expect(() =>
      redact(input, findings, {
        placeholderFormatter: () => input,
      }),
    ).toThrowError("The placeholder formatter returned an invalid value.");

    try {
      redact(input, findings, {
        placeholderFormatter() {
          throw new Error(input);
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SecretRedactionError);
      expect(String(error)).not.toContain(input);
    }
  });

  it("rejects a placeholder containing any eligible matched value", () => {
    const input = "SYNTHETIC_ONE|SYNTHETIC_TWO|SYNTHETIC_ONE";
    const firstEnd = input.indexOf("|");
    const secondStart = firstEnd + 1;
    const secondEnd = input.indexOf("|", secondStart);
    const findings = [
      finding(0, firstEnd, "redact", "finding-1"),
      finding(secondStart, secondEnd, "redact", "finding-2"),
      finding(secondEnd + 1, input.length, "redact", "finding-3"),
    ];

    expect(() =>
      redact(input, findings, {
        placeholderFormatter(_safeFinding, context) {
          return context.placeholderIndex === 1
            ? "<SYNTHETIC_TWO>"
            : `<REMOVED_${context.placeholderIndex}>`;
        },
      }),
    ).toThrowError("The placeholder formatter returned an invalid value.");
  });

  it.each(["x", "xy", "xyz"])(
    "rejects formatter reproduction of the short caller-supplied finding %s",
    (input) => {
      expect(() =>
        redact(input, [finding(0, input.length, "redact", "finding-1")], {
          placeholderFormatter: () => `<${input}>`,
        }),
      ).toThrowError("The placeholder formatter returned an invalid value.");
    },
  );

  it("rejects overlapping and out-of-range findings with safe errors", () => {
    const input = "SYNTHETIC_REVOKED_VALUE";
    expect(() =>
      redact(input, [finding(0, 10), finding(5, 15)]),
    ).toThrowError("Secret redaction findings are invalid.");
    expect(() =>
      redact(input, [finding(0, input.length + 1)]),
    ).toThrowError("Secret redaction findings are invalid.");
  });

  it("sanitizes hostile finding and option getters", () => {
    const input = "SYNTHETIC_REVOKED_VALUE";
    const hostileFinding = Object.defineProperty({}, "id", {
      get() {
        throw new Error(input);
      },
    });
    const hostileOptions = Object.defineProperty({}, "placeholderFormatter", {
      get() {
        throw new Error(input);
      },
    });

    for (const operation of [
      () => redact(input, [hostileFinding as SecretFinding]),
      () => redact(input, [finding(0, input.length)], hostileOptions),
    ]) {
      let thrown = false;
      try {
        operation();
      } catch (error) {
        thrown = true;
        expect(error).toBeInstanceOf(SecretRedactionError);
        expect(String(error)).not.toContain(input);
      }
      expect(thrown).toBe(true);
    }
  });
});

describe("public scanning APIs", () => {
  it.each([
    ["escaped quote", 'SYNTHETIC_REVOKED_"QUOTED_VALUE'],
    ["escaped backslash", "SYNTHETIC_REVOKED_TRAILING\\"],
    ["odd backslash run", 'SYNTHETIC_REVOKED_\\"QUOTED_VALUE'],
    ["even backslash run", "SYNTHETIC_REVOKED_TRAILING\\\\"],
  ])("redacts a complete JSON string with an %s", (_case, value) => {
    const input = JSON.stringify({ api_key: value, note: "ordinary" });
    const encodedValue = JSON.stringify(value).slice(1, -1);
    const result = scanAndRedact(input);

    expect(JSON.parse(result.text)).toEqual({
      api_key: "<SECRET_1>",
      note: "ordinary",
    });
    expect(result.findings).toEqual([
      expect.objectContaining({
        start: input.indexOf(encodedValue),
        end: input.indexOf(encodedValue) + encodedValue.length,
      }),
    ]);
    expect(result.text).not.toContain(encodedValue);
  });

  it("preserves JSON syntax around escaped slash and Unicode spellings", () => {
    const input = String.raw`{"api_key":"SYNTHETIC_REVOKED_\/PATH_\u0056ALUE","safe":true}`;
    const result = scanAndRedact(input);

    expect(JSON.parse(result.text)).toEqual({ api_key: "<SECRET_1>", safe: true });
    expect(result.text).toBe(`{"api_key":"<SECRET_1>","safe":true}`);
  });

  it("preserves assignment syntax around an escaped single quote", () => {
    const input = String.raw`client_secret='SYNTHETIC_REVOKED_\'QUOTED_VALUE'`;
    const result = scanAndRedact(input);

    expect(result.text).toBe("client_secret='<SECRET_1>'");
  });

  it("preserves original offsets after redaction and rescans cleanly", () => {
    const input = `before ${OPENAI_VALUE} after`;
    const result = scanAndRedact(input);

    expect(result.text).toBe("before <SECRET_1> after");
    expect(result.findings[0]).toMatchObject({
      start: input.indexOf(OPENAI_VALUE),
      end: input.indexOf(OPENAI_VALUE) + OPENAI_VALUE.length,
      action: "redact",
    });
    expect(scan(result.text)).toEqual([]);
  });

  it("evaluates each finding once and honors every custom action", () => {
    const input = "AAAA BBBB CCCC DDDD";
    const detector: SecretDetector = {
      id: "action-fixture",
      detect() {
        return [
          { type: "fixture_a", detector: this.id, confidence: "high", start: 0, end: 4 },
          { type: "fixture_b", detector: this.id, confidence: "high", start: 5, end: 9 },
          { type: "fixture_c", detector: this.id, confidence: "high", start: 10, end: 14 },
          { type: "fixture_d", detector: this.id, confidence: "high", start: 15, end: 19 },
        ];
      },
    };
    const actions = ["allow", "warn", "redact", "block"] as const;
    let evaluations = 0;
    const policy: SecretPolicy = {
      evaluate(_detected, context) {
        evaluations += 1;
        return actions[context.findingIndex] ?? "allow";
      },
    };

    const result = scanAndRedact(input, { detectors: [detector], policy });
    expect(evaluations).toBe(4);
    expect(result.findings.map(({ action }) => action)).toEqual(actions);
    expect(result.text).toBe("AAAA BBBB <SECRET_1> <SECRET_2>");
  });

  it("returns an immutable empty result for ordinary text", () => {
    const result = scanAndRedact("ordinary text");
    expect(result).toEqual({ text: "ordinary text", findings: [] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.findings)).toBe(true);
  });
});
