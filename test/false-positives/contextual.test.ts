import { describe, expect, it } from "vitest";

import { createDetectorRegistry } from "../../src/registry.js";
import { runDetectorPipeline } from "../../src/scan.js";

describe("contextual false positives", () => {
  it.each([
    ["entropy alone", "aB3dE5fG7hJ9kL2mN4pQ6rS8tV0xYz"],
    ["generic token", "token=aB3dE5fG7hJ9kL2mN4pQ6rS8tV0xYz"],
    ["hash", "sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["UUID", "request_id=123e4567-e89b-12d3-a456-426614174000"],
    ["source map", "source=webpack:///src/example.ts:10:20"],
    ["generated ID", "build_id=SYNTHETIC_GENERATED_IDENTIFIER_42"],
    ["numeric ID", "account_id=12345678901234567890"],
    ["environment reference", "api_key=${API_KEY_FROM_ENV}"],
    ["file reference", "private_key=./fixtures/revoked.pem"],
    ["placeholder URL", "postgres://fixture:password@localhost/example"],
    ["host-only URL", "postgres://localhost/example"],
    ["missing password URL", "postgres://fixture:@localhost/example"],
    ["malformed percent escape URL", "postgres://fixture:SYNTHETIC%GGVALUE@localhost/example"],
    ["invalid IPv6 URL", "postgres://fixture:SYNTHETIC_REVOKED_VALUE@[2001:::1]/example"],
    ["invalid port URL", "postgres://fixture:SYNTHETIC_REVOKED_VALUE@localhost:99999/example"],
    ["unsupported URL", "https://fixture:SYNTHETIC_REVOKED_VALUE@example.test"],
    ["malformed quote", 'api_key="unterminated'],
  ] as const)("does not classify %s", (_name, input) => {
    expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([]);
  });

  it("requires strong entropy for ambiguous contextual names", () => {
    const input = "credential=aaaaaaaaaaaaaaaaaaaaaaaa";
    expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([]);
  });

  it("requires a URL-scheme boundary", () => {
    const input = "notpostgres://fixture:SYNTHETIC_REVOKED_VALUE@localhost/db";
    expect(runDetectorPipeline(input, createDetectorRegistry())).toEqual([]);
  });
});
