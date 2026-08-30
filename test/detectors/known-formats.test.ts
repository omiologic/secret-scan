import { describe, expect, it } from "vitest";

import {
  anthropicTokenDetector,
  awsAccessKeyDetector,
  bearerTokenDetector,
  githubTokenDetector,
  gitlabTokenDetector,
  jwtDetector,
  openAiTokenDetector,
  privateKeyDetector,
  shopifyTokenDetector,
  vaultTokenDetector,
} from "../../src/detectors/index.js";
import { createDetectorRegistry } from "../../src/registry.js";
import { runDetectorPipeline, scanAndRedact } from "../../src/scan.js";

const SYNTHETIC = {
  privateKey: [
    "-----BEGIN PRIVATE KEY-----",
    "U1lOVEhFVElDX1JFVk9LRURfRklYVFVSRS==",
    "-----END PRIVATE KEY-----",
  ].join("\n"),
  aws: `AKIA${"SYNTHETICEXAMPLE"}`,
  githubClassic: `ghp_${"SYNTHETICREVOKED".padEnd(36, "0")}`,
  githubFineGrained: `github_pat_${"SYNTHETICREVOKED".padEnd(22, "0")}_${"SYNTHETICREVOKED".padEnd(59, "0")}`,
  gitlab: "glpat-SYNTHETIC_REVOKED_GITLAB_TOKEN",
  jwt: [
    "eyJTWU5USEVUSUNfSEVBREVS",
    "eyJTWU5USEVUSUNfUEFZTE9BRA",
    "SYNTHETIC_REVOKED_SIGNATURE",
  ].join("."),
  bearer: "SYNTHETIC_REVOKED_BEARER_TOKEN",
  openai: "sk-proj-SYNTHETIC_REVOKED_OPENAI_KEY",
  anthropic: "sk-ant-api03-SYNTHETIC_REVOKED_ANTHROPIC_KEY",
  shopify: "shpat_SYNTHETIC_REVOKED_SHOPIFY_TOKEN",
  vault: "hvs.SYNTHETIC_REVOKED_VAULT_TOKEN",
} as const;

const PRIVATE_KEY_LABELS = [
  "PRIVATE KEY",
  "RSA PRIVATE KEY",
  "DSA PRIVATE KEY",
  "EC PRIVATE KEY",
  "OPENSSH PRIVATE KEY",
  "ENCRYPTED PRIVATE KEY",
] as const;

function privateKeyBlock(label: string): string {
  return [
    `-----BEGIN ${label}-----`,
    "U1lOVEhFVElDX1JFVk9LRURfUEVNX0JPRFk=",
    `-----END ${label}-----`,
  ].join("\n");
}

describe("known-format detectors", () => {
  it.each([
    [privateKeyDetector, SYNTHETIC.privateKey, "private_key", "private-key"],
    [awsAccessKeyDetector, SYNTHETIC.aws, "aws_access_key_id", "provider"],
    [githubTokenDetector, SYNTHETIC.githubClassic, "github_token", "provider"],
    [githubTokenDetector, SYNTHETIC.githubFineGrained, "github_token", "provider"],
    [gitlabTokenDetector, SYNTHETIC.gitlab, "gitlab_token", "provider"],
    [jwtDetector, SYNTHETIC.jwt, "jwt", "structural"],
    [bearerTokenDetector, `Bearer ${SYNTHETIC.bearer}`, "bearer_token", "structural"],
    [openAiTokenDetector, SYNTHETIC.openai, "openai_api_key", "provider"],
    [anthropicTokenDetector, SYNTHETIC.anthropic, "anthropic_api_key", "provider"],
    [shopifyTokenDetector, SYNTHETIC.shopify, "shopify_access_token", "provider"],
    [vaultTokenDetector, SYNTHETIC.vault, "vault_token", "provider"],
  ] as const)("detects %s synthetic fixtures", (detector, input, type, specificity) => {
    const candidates = detector.detect(input, { inputLength: input.length });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type,
      detector: detector.id,
      confidence: "high",
      specificity,
      start: input.indexOf(input.startsWith("Bearer ") ? SYNTHETIC.bearer : input),
      end: input.length,
    });
  });

  it("finds more than one credential deterministically", () => {
    const input = `${SYNTHETIC.aws}\n${SYNTHETIC.openai}`;
    const first = runDetectorPipeline(input, createDetectorRegistry());
    const second = runDetectorPipeline(input, createDetectorRegistry());

    expect(first).toEqual(second);
    expect(first.map(({ type }) => type)).toEqual([
      "aws_access_key_id",
      "openai_api_key",
    ]);
  });

  it.each(PRIVATE_KEY_LABELS)(
    "detects the supported %s delimiter pair",
    (label) => {
      const input = privateKeyBlock(label);
      expect(privateKeyDetector.detect(input, { inputLength: input.length }))
        .toEqual([
          expect.objectContaining({
            type: "private_key",
            confidence: "high",
            specificity: "private-key",
            start: 0,
            end: input.length,
          }),
        ]);
    },
  );

  it("returns separate full spans for adjacent complete blocks", () => {
    const first = privateKeyBlock("PRIVATE KEY");
    const second = privateKeyBlock("EC PRIVATE KEY");
    const input = `${first}\n${second}`;
    const result = scanAndRedact(input);

    expect(result.text).toBe("<SECRET_1>\n<SECRET_2>");
    expect(result.findings).toEqual([
      expect.objectContaining({
        id: "finding-1",
        action: "block",
        start: 0,
        end: first.length,
      }),
      expect.objectContaining({
        id: "finding-2",
        action: "block",
        start: first.length + 1,
        end: input.length,
      }),
    ]);
  });

  it("blocks one outer span for properly nested supported delimiters", () => {
    const nested = [
      "-----BEGIN RSA PRIVATE KEY-----",
      "U1lOVEhFVElDX1JFVk9LRURfT1VURVI=",
      "-----BEGIN EC PRIVATE KEY-----",
      "U1lOVEhFVElDX1JFVk9LRURfSU5ORVI=",
      "-----END EC PRIVATE KEY-----",
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");
    const input = `before\n${nested}\nafter`;
    const result = scanAndRedact(input);

    expect(result.text).toBe("before\n<SECRET_1>\nafter");
    expect(result.findings).toEqual([
      expect.objectContaining({
        type: "private_key",
        detector: "private-key",
        confidence: "high",
        action: "block",
        start: input.indexOf("-----BEGIN"),
        end: input.lastIndexOf("-----") + 5,
      }),
    ]);
  });

  it("blocks unresolved repeated or mismatched supported delimiters to end of input", () => {
    const fixtures = [
      [
        "-----BEGIN PRIVATE KEY-----",
        "SYNTHETIC_REVOKED_OUTER_BODY",
        "-----BEGIN PRIVATE KEY-----",
        "SYNTHETIC_REVOKED_INNER_BODY",
      ].join("\n"),
      [
        "-----BEGIN RSA PRIVATE KEY-----",
        "SYNTHETIC_REVOKED_MISMATCHED_BODY",
        "-----END EC PRIVATE KEY-----",
        "ordinary trailing text",
      ].join("\n"),
      [
        "-----BEGIN RSA PRIVATE KEY-----",
        "-----BEGIN EC PRIVATE KEY-----",
        "-----END RSA PRIVATE KEY-----",
        "SYNTHETIC_REVOKED_TRAILING_INNER_BODY",
        "-----END EC PRIVATE KEY-----",
      ].join("\n"),
    ];

    for (const input of fixtures) {
      const result = scanAndRedact(input);
      expect(result.text).toBe("<SECRET_1>");
      expect(result.findings).toEqual([
        expect.objectContaining({
          type: "private_key",
          detector: "private-key",
          action: "block",
          start: 0,
          end: input.length,
        }),
      ]);
    }
  });

  it.each([
    [SYNTHETIC.gitlab, "gitlab_token"],
    [SYNTHETIC.shopify, "shopify_access_token"],
    [SYNTHETIC.vault, "vault_token"],
  ] as const)("redacts the qualified %s family under default policy", (input, type) => {
    expect(scanAndRedact(input)).toEqual({
      text: "<SECRET_1>",
      findings: [
        {
          id: "finding-1",
          type,
          detector: type === "gitlab_token"
            ? "gitlab-token"
            : type === "vault_token"
              ? "vault-token"
              : "shopify-token",
          confidence: "high",
          action: "redact",
          start: 0,
          end: input.length,
        },
      ],
    });
  });

  it("resolves a bearer-wrapped JWT to the JWT finding", () => {
    const input = `Authorization: Bearer ${SYNTHETIC.jwt}`;
    expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([
      {
        id: "finding-1",
        type: "jwt",
        detector: "jwt",
        confidence: "high",
        start: input.indexOf(SYNTHETIC.jwt),
        end: input.length,
      },
    ]);
  });

  it("returns public metadata without candidate signals or plaintext", () => {
    const serialized = JSON.stringify(
      runDetectorPipeline(SYNTHETIC.openai, createDetectorRegistry()),
    );
    expect(serialized).not.toContain(SYNTHETIC.openai);
    expect(serialized).not.toContain("signals");
    expect(serialized).not.toContain("value");
  });
});

describe("documented precision and recall boundaries", () => {
  it.each([
    [awsAccessKeyDetector, "AKIASYNTHETICSHORT"],
    [githubTokenDetector, "ghp_SYNTHETICSHORT"],
    [gitlabTokenDetector, "glpat-SYNTHETIC_SHORT"],
    [jwtDetector, "header.payload.signature"],
    [bearerTokenDetector, "Bearer short-token"],
    [openAiTokenDetector, "sk-proj-short-example"],
    [anthropicTokenDetector, "sk-ant-api02-SYNTHETIC_REVOKED_ANTHROPIC_KEY"],
    [shopifyTokenDetector, "shpat_SYNTHETIC_SHORT"],
    [vaultTokenDetector, "s.SYNTHETIC_REVOKED_LEGACY_VAULT_TOKEN"],
    [privateKeyDetector, "-----BEGIN PRIVATE KEY-----\nSYNTHETIC_TRUNCATED"],
  ] as const)("rejects deliberately unsupported lookalike for %s", (detector, input) => {
    expect(detector.detect(input, { inputLength: input.length })).toEqual([]);
  });

  it.each([
    "----BEGIN PRIVATE KEY-----\nSYNTHETIC_REVOKED_NEAR_MATCH",
    "-----BEGIN PRIVATE KEYS-----\nSYNTHETIC_REVOKED_NEAR_MATCH",
    "-----BEGIN CERTIFICATE-----\nSYNTHETIC_REVOKED_CERTIFICATE",
    "Documentation mentions -----BEGIN PRIVATE KEY----- once.",
    "-----BEGIN PRIVATE KEY-----\nSHORT\n-----END PRIVATE KEY-----",
  ])("does not classify private-key delimiter prose or near matches", (input) => {
    expect(privateKeyDetector.detect(input, { inputLength: input.length }))
      .toEqual([]);
  });
});
