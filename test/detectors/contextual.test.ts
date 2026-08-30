import { describe, expect, it } from "vitest";

import {
  connectionStringDetector,
  genericTokenDetector,
} from "../../src/detectors/index.js";
import { createDetectorRegistry } from "../../src/registry.js";
import { runDetectorPipeline } from "../../src/scan.js";

const HIGH_ENTROPY_VALUE = "SYNTHETIC_REVOKED_CONTEXT_42";
const LOW_ENTROPY_VALUE = "aaaaaaaaaaaaaaaa";
const OPENAI_VALUE = "sk-proj-SYNTHETIC_REVOKED_CONTEXT_KEY";

describe("generic contextual detector", () => {
  it("detects high-signal assignments and bounds only their values", () => {
    const input = `prefix\nAPI_KEY=${HIGH_ENTROPY_VALUE}\nsuffix`;
    expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([
      {
        id: "finding-1",
        type: "contextual_secret",
        detector: "generic-token",
        confidence: "high",
        start: input.indexOf(HIGH_ENTROPY_VALUE),
        end: input.indexOf(HIGH_ENTROPY_VALUE) + HIGH_ENTROPY_VALUE.length,
      },
    ]);
  });

  it("supports quoted JSON and YAML-style assignments", () => {
    const jsonValue = "SYNTHETIC REVOKED PASSPHRASE";
    const yamlValue = "SYNTHETIC_REVOKED_CLIENT_VALUE";
    const input = `{"password": "${jsonValue}"}\nclient-secret: '${yamlValue}'`;
    const result = runDetectorPipeline(input, createDetectorRegistry());

    expect(result.map(({ type, start, end }) => ({ type, start, end }))).toEqual([
      {
        type: "contextual_secret",
        start: input.indexOf(jsonValue),
        end: input.indexOf(jsonValue) + jsonValue.length,
      },
      {
        type: "contextual_secret",
        start: input.indexOf(yamlValue),
        end: input.indexOf(yamlValue) + yamlValue.length,
      },
    ]);
  });

  it.each([
    ["one backslash before an escaped quote", 'SYNTHETIC_REVOKED_"QUOTED_VALUE'],
    ["two backslashes before the closing quote", "SYNTHETIC_REVOKED_TRAILING\\"],
    ["three backslashes before an escaped quote", 'SYNTHETIC_REVOKED_\\"QUOTED_VALUE'],
    ["four backslashes before the closing quote", "SYNTHETIC_REVOKED_TRAILING\\\\"],
  ])("bounds a JSON value with %s", (_case, value) => {
    const encodedValue = JSON.stringify(value).slice(1, -1);
    const input = `{"api_key":"${encodedValue}","note":"ordinary"}`;
    const [finding] = runDetectorPipeline(input, createDetectorRegistry());

    expect(finding).toMatchObject({
      type: "contextual_secret",
      detector: "generic-token",
      start: input.indexOf(encodedValue),
      end: input.indexOf(encodedValue) + encodedValue.length,
    });
  });

  it("keeps escaped slashes and Unicode escapes inside the detected span", () => {
    const input = String.raw`{"api_key":"SYNTHETIC_REVOKED_\/PATH_\u0056ALUE"}`;
    const encodedValue = String.raw`SYNTHETIC_REVOKED_\/PATH_\u0056ALUE`;
    const [finding] = runDetectorPipeline(input, createDetectorRegistry());

    expect(finding).toMatchObject({
      start: input.indexOf(encodedValue),
      end: input.indexOf(encodedValue) + encodedValue.length,
    });
  });

  it("keeps an escaped single quote inside an assignment-style value", () => {
    const input = String.raw`client_secret='SYNTHETIC_REVOKED_\'QUOTED_VALUE'`;
    const encodedValue = String.raw`SYNTHETIC_REVOKED_\'QUOTED_VALUE`;
    const [finding] = runDetectorPipeline(input, createDetectorRegistry());

    expect(finding).toMatchObject({
      start: input.indexOf(encodedValue),
      end: input.indexOf(encodedValue) + encodedValue.length,
    });
  });

  it("accepts the maximum quoted value length and rejects the next code unit", () => {
    const maximum = `api_key="${"A".repeat(4_096)}"`;
    const overlong = `api_key="${"A".repeat(4_097)}"`;

    expect(genericTokenDetector.detect(maximum, { inputLength: maximum.length }))
      .toHaveLength(1);
    expect(genericTokenDetector.detect(overlong, { inputLength: overlong.length }))
      .toEqual([]);
  });

  it.each([
    ['api_key="SYNTHETIC_REVOKED_TRAILING\\"'],
    ['api_key="SYNTHETIC_REVOKED_LINE\nBREAK"'],
    ['api_key="SYNTHETIC_REVOKED_VALUE"suffix'],
    ["api_key='SYNTHETIC_REVOKED_TRAILING\\'"],
  ])("rejects malformed quoted structure without a partial finding", (input) => {
    expect(genericTokenDetector.detect(input, { inputLength: input.length })).toEqual([]);
  });

  it("ignores quoted placeholders beside supported quoted values", () => {
    const input = `{"api_key":"<SECRET_1>","client_secret":"${HIGH_ENTROPY_VALUE}"}`;
    const candidates = genericTokenDetector.detect(input, {
      inputLength: input.length,
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        start: input.indexOf(HIGH_ENTROPY_VALUE),
        end: input.indexOf(HIGH_ENTROPY_VALUE) + HIGH_ENTROPY_VALUE.length,
      }),
    ]);
  });

  it.each(["clientSecret", "client-secret", "client.secret", "CLIENT_SECRET"])(
    "normalizes the contextual name %s",
    (name) => {
      const input = `${name}=${HIGH_ENTROPY_VALUE}`;
      expect(runDetectorPipeline(input, createDetectorRegistry())).toHaveLength(1);
    },
  );

  it("keeps low-entropy high-signal values at medium confidence", () => {
    const input = `secret_key=${LOW_ENTROPY_VALUE}`;
    expect(genericTokenDetector.detect(input, { inputLength: input.length })).toEqual([
      expect.objectContaining({ confidence: "medium", specificity: "contextual" }),
    ]);
  });

  it("enforces the contextual length and entropy upgrade boundaries", () => {
    const belowMinimum = "abcdefg";
    const minimumMedium = "aaaaaaaa";
    const belowUpgrade = "abcdefghijklmno";
    const atUpgrade = "abcdefghijklmnop";
    const belowMinimumInput = `api_key=${belowMinimum}`;
    const minimumMediumInput = `api_key=${minimumMedium}`;
    const belowUpgradeInput = `api_key=${belowUpgrade}`;
    const atUpgradeInput = `api_key=${atUpgrade}`;

    expect(
      genericTokenDetector.detect(belowMinimumInput, {
        inputLength: belowMinimumInput.length,
      }),
    ).toEqual([]);
    expect(
      genericTokenDetector.detect(minimumMediumInput, {
        inputLength: minimumMediumInput.length,
      }),
    ).toEqual([expect.objectContaining({ confidence: "medium" })]);
    expect(
      genericTokenDetector.detect(belowUpgradeInput, {
        inputLength: belowUpgradeInput.length,
      }),
    ).toEqual([expect.objectContaining({ confidence: "medium" })]);
    expect(
      genericTokenDetector.detect(atUpgradeInput, {
        inputLength: atUpgradeInput.length,
      }),
    ).toEqual([expect.objectContaining({ confidence: "high" })]);
  });

  it("keeps entropy-qualified ambiguous names at medium confidence", () => {
    const input = `credential=${HIGH_ENTROPY_VALUE}`;
    expect(genericTokenDetector.detect(input, { inputLength: input.length })).toEqual([
      expect.objectContaining({ confidence: "medium", specificity: "contextual" }),
    ]);
  });

  it("detects explicit Basic and Token authorization structures", () => {
    const basic = "U1lOVEhFVElDX1JFVk9LRUQ=";
    const token = "SYNTHETIC_REVOKED_AUTH_TOKEN";
    const input = `Authorization: Basic ${basic}\nAuthorization: Token ${token}`;
    const candidates = genericTokenDetector.detect(input, {
      inputLength: input.length,
    });
    expect(candidates).toHaveLength(2);
    expect(candidates.map(({ type, specificity }) => ({ type, specificity }))).toEqual([
      { type: "authorization_credential", specificity: "structural" },
      { type: "authorization_credential", specificity: "structural" },
    ]);
  });

  it("preserves UTF-16 offsets in multiline Unicode context", () => {
    const input = `😀 heading\n说明 API_KEY=${HIGH_ENTROPY_VALUE}\nend`;
    const [finding] = runDetectorPipeline(input, createDetectorRegistry());
    expect(finding).toMatchObject({
      start: input.indexOf(HIGH_ENTROPY_VALUE),
      end: input.indexOf(HIGH_ENTROPY_VALUE) + HIGH_ENTROPY_VALUE.length,
    });
  });

  it("lets a provider-specific detector win an assignment overlap", () => {
    const input = `api_key=${OPENAI_VALUE}`;
    expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([
      {
        id: "finding-1",
        type: "openai_api_key",
        detector: "openai-token",
        confidence: "high",
        start: input.indexOf(OPENAI_VALUE),
        end: input.length,
      },
    ]);
  });
});

describe("connection string detector", () => {
  it.each(["postgresql", "mysql", "mongodb+srv", "rediss", "amqps"])(
    "detects a credential-bearing %s URL and selects only its password",
    (scheme) => {
      const password = "SYNTHETIC_REVOKED_DB_PASSWORD";
      const input = `${scheme}://fixture-user:${password}@localhost/example`;
      const candidates = connectionStringDetector.detect(input, {
        inputLength: input.length,
      });
      expect(candidates).toEqual([
        expect.objectContaining({
          type: "connection_string_password",
          confidence: "high",
          specificity: "structural",
          start: input.indexOf(password),
          end: input.indexOf(password) + password.length,
        }),
      ]);
    },
  );

  it("keeps a short, non-placeholder password at medium confidence", () => {
    const password = "REVOKED7";
    const input = `redis://fixture:${password}@localhost`;
    expect(connectionStringDetector.detect(input, { inputLength: input.length })).toEqual([
      expect.objectContaining({ confidence: "medium" }),
    ]);
  });

  it("keeps encoded delimiters in the original password span", () => {
    const password = "SYNTHETIC%40REVOKED%3ADB%2FVALUE";
    const input = `mongodb://fixture%3Auser:${password}@db.example.test:27017/example`;
    expect(connectionStringDetector.detect(input, { inputLength: input.length })).toEqual([
      expect.objectContaining({
        confidence: "high",
        start: input.indexOf(password),
        end: input.indexOf(password) + password.length,
      }),
    ]);
  });

  it.each([
    "[2001:db8::1]",
    "[2001:db8::1]:5432",
    "localhost:5432",
    "localhost:05432",
  ])("accepts the valid host and port form %s", (host) => {
    const password = "SYNTHETIC_REVOKED_IPV6_VALUE";
    const input = `postgres://fixture:${password}@${host}/example`;
    expect(connectionStringDetector.detect(input, { inputLength: input.length })).toEqual([
      expect.objectContaining({
        start: input.indexOf(password),
        end: input.indexOf(password) + password.length,
      }),
    ]);
  });

  it("preserves UTF-16 offsets next to Unicode text", () => {
    const password = "SYNTHETIC%23REVOKED_VALUE";
    const input = `😀 说明 redis://fixture:${password}@[::1]:6379/0 fin`;
    expect(connectionStringDetector.detect(input, { inputLength: input.length })).toEqual([
      expect.objectContaining({
        start: input.indexOf(password),
        end: input.indexOf(password) + password.length,
      }),
    ]);
  });

  it.each([
    "postgres://fixture:SYNTHETIC%REVOKED@localhost/db",
    "postgres://fixture:SYNTHETIC%2REVOKED@localhost/db",
    "postgres://fixture:SYNTHETIC%GGREVOKED@localhost/db",
    "postgres://fixture:@localhost/db",
    "postgres://fixture@localhost/db",
    "postgres://fixture:SYNTHETIC_REVOKED@one@localhost/db",
    "postgres://fixture:SYNTHETIC_REVOKED@[2001:::1]/db",
    "postgres://fixture:SYNTHETIC_REVOKED@localhost:99999/db",
    "postgres://fixture:SYNTHETIC_REVOKED@-invalid.example/db",
  ])("ignores malformed or credential-free authority %s", (input) => {
    expect(connectionStringDetector.detect(input, { inputLength: input.length })).toEqual([]);
  });
});

describe("contextual detector safety", () => {
  it("handles malformed and long near-matches without throwing", () => {
    const inputs = [
      'api_key="unterminated',
      `api_key="${"\\".repeat(100_000)}`,
      `api_key=${"A".repeat(100_000)}`,
      `postgres://fixture:${"A".repeat(100_000)}@localhost/db`,
      `postgres://fixture:${"%2".repeat(50_000)}@localhost/db`,
      `token=${"A1b2".repeat(25_000)}`,
    ];
    for (const input of inputs) {
      expect(() => runDetectorPipeline(input, createDetectorRegistry())).not.toThrow();
    }
  }, 2_000);

  it("does not expose matched values or internal signals", () => {
    const input = `api_key=${HIGH_ENTROPY_VALUE}`;
    const serialized = JSON.stringify(
      runDetectorPipeline(input, createDetectorRegistry()),
    );
    expect(serialized).not.toContain(HIGH_ENTROPY_VALUE);
    expect(serialized).not.toContain("signals");
    expect(serialized).not.toContain("value");
  });
});
