/**
 * The WebAssembly binding's own adapter contract
 * (`runtime/browser.ts`, `bindings/wasm/src/{lib,metadata,finding}.rs`).
 *
 * Every test here runs against `createWasmShapedBinding` — a double injected
 * through `createSecretScanRuntime` exactly like `fake-binding.ts` and
 * `sanitizing-binding.ts` are, but shaped like the real WebAssembly artifact
 * (nested `range` objects, opaque `Finding` handles, a generated `default()`
 * init) rather than the flat Node shape those two use. It is passed through
 * `createBindingFromWasmModule`, the real normalization `runtime/browser.ts`
 * applies, so reverting that normalization fails these tests rather than
 * passing silently.
 */

import { describe, expect, it } from "vitest";

import { SecretScanError } from "../src/errors.js";
import { NATIVE_HANDLE } from "../src/native.js";
import { createSecretScanRuntime } from "../src/runtime.js";
import { VERSION } from "../src/version.js";
import {
  createWasmShapedBinding,
  sampleWasmFinding,
} from "./wasm-shaped-binding.js";

const LIMITS = {
  maxInputCodeUnits: 1_024,
  maxBufferedCodeUnits: 384,
  maxTokenCodeUnits: 128,
  maxMultilineCodeUnits: 256,
};

describe("WebAssembly-shaped binding: lifecycle", () => {
  it("runs the generated default() init before the binding's own initialize()", async () => {
    const wasm = createWasmShapedBinding();
    const runtime = createSecretScanRuntime(wasm.load);

    await runtime.initialize();

    expect(wasm.calls).toEqual(["default", "initialize"]);
  });

  it("loads at most once no matter how many callers await it", async () => {
    const wasm = createWasmShapedBinding();
    const runtime = createSecretScanRuntime(wasm.load);

    await Promise.all([
      runtime.initialize(),
      runtime.initialize(),
      runtime.initialize(),
    ]);
    await runtime.initialize();

    expect(wasm.calls).toEqual(["default", "initialize"]);
  });

  it("rejects an artifact built from a different product version", async () => {
    const wasm = createWasmShapedBinding({ version: "0.0.0-other" });
    const runtime = createSecretScanRuntime(wasm.load);

    await expect(runtime.initialize()).rejects.toThrowError(
      expect.objectContaining({ code: "INITIALIZATION_FAILED" }),
    );
    expect(() => runtime.scan("SYNTHETIC_REVOKED_VALUE")).toThrowError(
      expect.objectContaining({ code: "NOT_INITIALIZED" }),
    );
  });

  it("accepts the artifact that reports this package's version", async () => {
    const wasm = createWasmShapedBinding({ version: VERSION });
    const runtime = createSecretScanRuntime(wasm.load);

    await runtime.initialize();

    expect(runtime.scan("API_KEY=SYNTHETIC")).toEqual([]);
  });

  it("refuses every synchronous operation before initialize succeeds", () => {
    const wasm = createWasmShapedBinding();
    const runtime = createSecretScanRuntime(wasm.load);

    for (const call of [
      () => runtime.scan("SYNTHETIC_REVOKED_VALUE"),
      () => runtime.redact("SYNTHETIC_REVOKED_VALUE", []),
      () => runtime.scanAndRedact("SYNTHETIC_REVOKED_VALUE"),
      () => runtime.createIncrementalSanitizer({ limits: LIMITS }),
    ]) {
      expect(call).toThrowError(
        expect.objectContaining({ code: "NOT_INITIALIZED" }),
      );
    }
  });
});

describe("WebAssembly-shaped binding: finding normalization", () => {
  it("flattens the opaque, nested-range finding scan returns", async () => {
    const wasm = createWasmShapedBinding({ findings: [sampleWasmFinding] });
    const runtime = createSecretScanRuntime(wasm.load);
    await runtime.initialize();

    const [finding] = runtime.scan(
      "API_KEY=SYNTHETIC_REVOKED_CONTEXT_VALUE",
    );

    expect(finding).toEqual({
      id: "finding-1",
      type: "contextual_secret",
      detector: "generic-token",
      confidence: "high",
      action: "redact",
      start: 8,
      end: 39,
    });
    expect(Object.isFrozen(finding)).toBe(true);
  });

  it("returns the exact handle scan produced back to redact", async () => {
    const wasm = createWasmShapedBinding({ findings: [sampleWasmFinding] });
    const runtime = createSecretScanRuntime(wasm.load);
    await runtime.initialize();

    const input = "API_KEY=SYNTHETIC_REVOKED_CONTEXT_VALUE";
    const findings = runtime.scan(input);

    expect(
      (findings[0] as unknown as Record<symbol, unknown>)[NATIVE_HANDLE],
    ).toBe(sampleWasmFinding);
    expect(runtime.redact(input, findings)).toBe("<SECRET_1>");
  });
});

describe("WebAssembly-shaped binding: policy and formatter callbacks", () => {
  it("gives a policy callback a finding whose start and end are numbers, frozen", async () => {
    const wasm = createWasmShapedBinding({ findings: [sampleWasmFinding] });
    const runtime = createSecretScanRuntime(wasm.load);
    await runtime.initialize();

    let seen: unknown;
    runtime.scan("API_KEY=SYNTHETIC_REVOKED_CONTEXT_VALUE", {
      policy: {
        evaluate: (finding) => {
          seen = finding;
          return "warn";
        },
      },
    });

    expect(seen).toEqual({
      id: "finding-1",
      type: "contextual_secret",
      detector: "generic-token",
      confidence: "high",
      start: 8,
      end: 39,
    });
    expect(typeof (seen as { start: unknown }).start).toBe("number");
    expect(typeof (seen as { end: unknown }).end).toBe("number");
    expect(Object.isFrozen(seen)).toBe(true);
  });

  it("gives a formatter callback a finding whose start and end are numbers, frozen", async () => {
    const wasm = createWasmShapedBinding({ findings: [sampleWasmFinding] });
    const runtime = createSecretScanRuntime(wasm.load);
    await runtime.initialize();

    const input = "API_KEY=SYNTHETIC_REVOKED_CONTEXT_VALUE";
    const findings = runtime.scan(input);
    let seen: unknown;
    runtime.redact(input, findings, {
      placeholderFormatter: (finding) => {
        seen = finding;
        return "<REDACTED>";
      },
    });

    expect(seen).toEqual({
      id: "finding-1",
      type: "contextual_secret",
      detector: "generic-token",
      confidence: "high",
      action: "redact",
      start: 8,
      end: 39,
    });
    expect(typeof (seen as { start: unknown }).start).toBe("number");
    expect(typeof (seen as { end: unknown }).end).toBe("number");
    expect(Object.isFrozen(seen)).toBe(true);
  });
});

describe("WebAssembly-shaped binding: incremental sanitization", () => {
  it("rejects with a fixed code, since bindings/wasm has no such export", async () => {
    const wasm = createWasmShapedBinding();
    const runtime = createSecretScanRuntime(wasm.load);

    await runtime.initialize();

    expect(() =>
      runtime.createIncrementalSanitizer({ limits: LIMITS }),
    ).toThrowError(
      expect.objectContaining({
        name: "SecretScanError",
        code: "INCREMENTAL_UNAVAILABLE",
      }),
    );
  });

  it("does not stop initialize() from resolving", async () => {
    const wasm = createWasmShapedBinding();
    const runtime = createSecretScanRuntime(wasm.load);

    await expect(runtime.initialize()).resolves.toBeUndefined();
    expect(() =>
      runtime.createIncrementalSanitizer({ limits: LIMITS }),
    ).toThrowError(SecretScanError);
  });
});
