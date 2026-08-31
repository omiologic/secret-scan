import { describe, expect, it } from "vitest";

import {
  cloudflareTokenDetector,
  digitalOceanTokenDetector,
  dockerTokenDetector,
  huggingFaceTokenDetector,
  linearTokenDetector,
  pypiTokenDetector,
  slackTokenDetector,
  stripeTokenDetector,
  supabaseTokenDetector,
  vercelTokenDetector,
} from "../../src/detectors/index.js";
import { createDetectorRegistry } from "../../src/registry.js";
import { runDetectorPipeline, scanAndRedact } from "../../src/scan.js";
import type { SecretDetector } from "../../src/types.js";

const BODY = "SYNTHETICREVOKEDPROVIDERVALUE";
const PYPI_BODY = "SYNTHETIC_REVOKED_".repeat(5);

const FAMILIES: readonly {
  readonly detector: SecretDetector;
  readonly type: string;
  readonly value: string;
  readonly short: string;
}[] = [
  {
    detector: stripeTokenDetector,
    type: "stripe_credential",
    value: `sk_live_${BODY}`,
    short: "sk_live_SYNTHETICSHORT",
  },
  {
    detector: slackTokenDetector,
    type: "slack_token",
    value: `xoxb-${BODY}`,
    short: "xoxb-SYNTHETICSHORT",
  },
  {
    detector: pypiTokenDetector,
    type: "pypi_api_token",
    value: `pypi-${PYPI_BODY}`,
    short: `pypi-${BODY}`,
  },
  {
    detector: huggingFaceTokenDetector,
    type: "huggingface_token",
    value: `hf_${BODY}`,
    short: "hf_SYNTHETIC_SHORT",
  },
  {
    detector: dockerTokenDetector,
    type: "docker_token",
    value: `dckr_pat_${BODY}`,
    short: "dckr_pat_SYNTHETIC_SHORT",
  },
  {
    detector: cloudflareTokenDetector,
    type: "cloudflare_api_token",
    value: `cfut_${BODY}`,
    short: "cfut_SYNTHETIC_SHORT",
  },
  {
    detector: digitalOceanTokenDetector,
    type: "digitalocean_token",
    value: `dop_v1_${BODY}`,
    short: "dop_v1_SYNTHETIC_SHORT",
  },
  {
    detector: linearTokenDetector,
    type: "linear_token",
    value: `lin_api_${BODY}`,
    short: "lin_api_SYNTHETIC_SHORT",
  },
  {
    detector: supabaseTokenDetector,
    type: "supabase_secret_key",
    value: `sb_secret_${BODY}`,
    short: "sb_secret_SYNTHETIC_SHORT",
  },
  {
    detector: vercelTokenDetector,
    type: "vercel_token",
    value: `vcp_${BODY}`,
    short: "vcp_SYNTHETIC_SHORT",
  },
];

describe("additional qualified provider detectors", () => {
  it.each(FAMILIES.map((family) => [family.detector.id, family] as const))(
    "detects a synthetic %s credential with provider specificity",
    (_id, { detector, type, value }) => {
      expect(detector.detect(value, { inputLength: value.length })).toEqual([
        expect.objectContaining({
          detector: detector.id,
          type,
          confidence: "high",
          specificity: "provider",
          start: 0,
          end: value.length,
        }),
      ]);
    },
  );

  it.each(FAMILIES.map((family) => [family.detector.id, family] as const))(
    "rejects short, invalid-alphabet, and embedded %s lookalikes",
    (_id, { detector, value, short }) => {
      for (const input of [
        short,
        value.replace("REVOKED", "REVO!KED"),
        `X${value}Y`,
      ]) {
        expect(detector.detect(input, { inputLength: input.length })).toEqual([]);
      }
    },
  );

  it.each(FAMILIES.map((family) => [family.detector.id, family] as const))(
    "wins contextual overlap and redacts %s under the default policy",
    (_id, { detector, type, value }) => {
      const input = `access_token=${value}`;
      const result = scanAndRedact(input);
      expect(result.text).toBe("access_token=<SECRET_1>");
      expect(result.findings).toEqual([
        {
          id: "finding-1",
          type,
          detector: detector.id,
          confidence: "high",
          action: "redact",
          start: input.indexOf(value),
          end: input.length,
        },
      ]);
    },
  );

  it.each(FAMILIES.map((family) => [family.detector.id, family] as const))(
    "accepts punctuation boundaries around %s credentials",
    (_id, { detector, value }) => {
      const input = `(${value}).`;
      expect(detector.detect(input, { inputLength: input.length })).toEqual([
        expect.objectContaining({ start: 1, end: value.length + 1 }),
      ]);
    },
  );

  it.each([
    [stripeTokenDetector, "sk_test_"],
    [stripeTokenDetector, "sk_live_"],
    [stripeTokenDetector, "rk_test_"],
    [stripeTokenDetector, "rk_live_"],
    [stripeTokenDetector, "sk_org_"],
    [stripeTokenDetector, "whsec_"],
    [slackTokenDetector, "xoxb-"],
    [slackTokenDetector, "xoxp-"],
    [slackTokenDetector, "xapp-"],
    [slackTokenDetector, "xwfp-"],
    [slackTokenDetector, "xoxe-"],
    [slackTokenDetector, "xoxe.xoxb-"],
    [slackTokenDetector, "xoxe.xoxp-"],
    [dockerTokenDetector, "dckr_pat_"],
    [dockerTokenDetector, "dckr_oat_"],
    [digitalOceanTokenDetector, "dop_v1_"],
    [digitalOceanTokenDetector, "doo_v1_"],
    [digitalOceanTokenDetector, "dor_v1_"],
    [linearTokenDetector, "lin_api_"],
    [linearTokenDetector, "lin_oauth_"],
    [vercelTokenDetector, "vcp_"],
    [vercelTokenDetector, "vci_"],
    [vercelTokenDetector, "vca_"],
    [vercelTokenDetector, "vcr_"],
    [vercelTokenDetector, "vck_"],
  ] as const)("detects the qualified %s variant", (detector, prefix) => {
    const value = `${prefix}${BODY}`;
    expect(detector.detect(value, { inputLength: value.length })).toEqual([
      expect.objectContaining({ start: 0, end: value.length }),
    ]);
  });

  it("does not classify public or identifier-only neighboring formats", () => {
    for (const input of [
      `pk_live_${BODY}`,
      `sb_publishable_${BODY}`,
      `SK${"0".repeat(32)}`,
      "ntn_SYNTHETIC_REVOKED_OPAQUE_VALUE",
      "0123456789abcdef0123456789abcdef",
    ]) {
      expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([]);
    }
  });

  it("keeps public metadata free of plaintext and detector signals", () => {
    const value = `cfut_${BODY}`;
    const serialized = JSON.stringify(
      runDetectorPipeline(value, createDetectorRegistry()),
    );
    expect(serialized).not.toContain(value);
    expect(serialized).not.toContain("signals");
    expect(serialized).not.toContain("value");
  });
});
