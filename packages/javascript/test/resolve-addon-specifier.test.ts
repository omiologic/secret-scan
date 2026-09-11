import { describe, expect, it } from "vitest";

import { resolveAddonSpecifier } from "../src/runtime/node.js";

/**
 * `resolveAddonSpecifier`'s host-to-package mapping
 * (`decision-ship-first-release-artifact-set`), pinned against every
 * `napi.targets` entry `bindings/node/package.json` declares so the two
 * cannot drift silently: adding a target there without a matching case here
 * is a runtime gap this test would not catch on its own, but removing or
 * renaming a case here without updating that manifest is exactly what this
 * test exists to catch.
 */
const EXPECTED: ReadonlyArray<
  readonly [platform: string, arch: string, specifier: string]
> = [
  ["darwin", "arm64", "@redact-secret/node-darwin-arm64"],
  ["darwin", "x64", "@redact-secret/node-darwin-x64"],
  ["linux", "arm64", "@redact-secret/node-linux-arm64-gnu"],
  ["linux", "x64", "@redact-secret/node-linux-x64-gnu"],
  ["win32", "arm64", "@redact-secret/node-win32-arm64-msvc"],
  ["win32", "x64", "@redact-secret/node-win32-x64-msvc"],
];

function withHost<T>(platform: string, arch: string, fn: () => T): T {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  const archDescriptor = Object.getOwnPropertyDescriptor(process, "arch");
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  Object.defineProperty(process, "arch", { value: arch, configurable: true });
  try {
    return fn();
  } finally {
    if (platformDescriptor) Object.defineProperty(process, "platform", platformDescriptor);
    if (archDescriptor) Object.defineProperty(process, "arch", archDescriptor);
  }
}

describe("resolveAddonSpecifier", () => {
  it.each(EXPECTED)("maps %s/%s to %s", (platform, arch, specifier) => {
    expect(withHost(platform, arch, () => resolveAddonSpecifier())).toBe(specifier);
  });

  it("has one entry per bindings/node/package.json napi.target", () => {
    expect(EXPECTED).toHaveLength(6);
  });

  it("returns undefined for a platform this package ships no addon for", () => {
    expect(withHost("freebsd", "x64", () => resolveAddonSpecifier())).toBeUndefined();
  });

  it("returns undefined for a supported platform on an unsupported architecture", () => {
    expect(withHost("linux", "ia32", () => resolveAddonSpecifier())).toBeUndefined();
  });
});
