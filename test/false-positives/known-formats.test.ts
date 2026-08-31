import { describe, expect, it } from "vitest";

import { createDetectorRegistry } from "../../src/registry.js";
import { runDetectorPipeline } from "../../src/scan.js";

describe("known-format false positives", () => {
  it.each([
    ["sha256", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["uuid", "123e4567-e89b-12d3-a456-426614174000"],
    ["commit", "0123456789abcdef0123456789abcdef01234567"],
    ["model", "gpt-5.6-codex-2026-08-30"],
    ["css hash", "button_S8mK2pQx_17"],
    ["test id", "SYNTHETIC_TEST_IDENTIFIER_987654321"],
    ["numeric id", "123456789012345678901234567890"],
    ["source map", "webpack:///src/example.ts:10:20"],
    ["public key header", "-----BEGIN PUBLIC KEY-----"],
    ["aws role id", "AROASYNTHETICEXAMPLE"],
    ["twilio api key SID", `SK${"0".repeat(32)}`],
    ["legacy vault-like identifier", "s.SYNTHETIC_REVOKED_IDENTIFIER"],
    ["shopify header name", "X-Shopify-Access-Token"],
    ["stripe publishable key", `pk_live_${"SYNTHETIC_PUBLIC_VALUE"}`],
    ["supabase publishable key", `sb_publishable_${"SYNTHETIC_PUBLIC_VALUE"}`],
    ["notion opaque token", "ntn_SYNTHETIC_REVOKED_OPAQUE_VALUE"],
    ["datadog-shaped hex", "0123456789abcdef0123456789abcdef"],
  ] as const)("does not classify a %s", (_name, input) => {
    expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([]);
  });

  it("requires token boundaries around fixed provider formats", () => {
    const embeddedAws = `XAKIA${"SYNTHETICEXAMPLE"}Y`;
    const embeddedGithub = `Xghp_${"SYNTHETICREVOKED".padEnd(36, "0")}Y`;
    const embeddedGithubInstallation =
      `Xghs_${"SYNTHETICREVOKED".padEnd(36, "0")}Y`;
    const embeddedGitlab = "Xglpat-SYNTHETIC_REVOKED_GITLAB_TOKENY";
    const embeddedShopify = "Xshpat_SYNTHETIC_REVOKED_SHOPIFY_TOKENY";
    const embeddedVault = "Xhvs.SYNTHETIC_REVOKED_VAULT_TOKENY";
    const embeddedCloudflare = "Xcfut_SYNTHETIC_REVOKED_PROVIDER_VALUEY";
    const embeddedVercel = "Xvcp_SYNTHETIC_REVOKED_PROVIDER_VALUEY";
    expect(runDetectorPipeline(embeddedAws, createDetectorRegistry())).toEqual([]);
    expect(runDetectorPipeline(embeddedGithub, createDetectorRegistry())).toEqual([]);
    expect(runDetectorPipeline(embeddedGithubInstallation, createDetectorRegistry())).toEqual([]);
    expect(runDetectorPipeline(embeddedGitlab, createDetectorRegistry())).toEqual([]);
    expect(runDetectorPipeline(embeddedShopify, createDetectorRegistry())).toEqual([]);
    expect(runDetectorPipeline(embeddedVault, createDetectorRegistry())).toEqual([]);
    expect(runDetectorPipeline(embeddedCloudflare, createDetectorRegistry())).toEqual([]);
    expect(runDetectorPipeline(embeddedVercel, createDetectorRegistry())).toEqual([]);
  });

  it("does not interpret bearer embedded in an identifier as a scheme", () => {
    const input = "notbearer SYNTHETIC_REVOKED_IDENTIFIER";
    expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([]);
  });
});
