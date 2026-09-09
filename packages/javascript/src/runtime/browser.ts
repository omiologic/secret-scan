/**
 * The browser adapter: the `wasm-bindgen` build, normalized to the internal
 * binding contract (`decision-define-runtime-bindings`).
 *
 * The package's `imports` map reaches this module under the `browser`
 * condition and by default. It imports nothing from `node:` and touches no
 * Node global, so a bundle produced for the browser resolves only this file
 * and the WebAssembly artifact it loads.
 *
 * There are two distinct setup steps behind one `await initialize()`: the
 * generated `init()` that fetches and instantiates the `.wasm` binary, and the
 * binding's own idempotent `initialize()` that builds the detector registry.
 * Wrapping both is exactly this adapter's job.
 */

import { SecretScanError } from "../errors.js";
import {
  NATIVE_HANDLE,
  type NativeBinding,
  type NativeFinding,
  type NativeFormatterCallback,
  type NativeIncrementalOptions,
  type NativeIncrementalResult,
  type NativeIncrementalSanitizer,
  type NativePolicyCallback,
} from "../native.js";
import type { IncrementalSanitizerState } from "../types.js";

/** One opaque finding handle, as the WebAssembly build returns it. */
interface WasmFinding {
  readonly id: string;
  readonly type: string;
  readonly detector: string;
  readonly confidence: string;
  readonly action: string;
  readonly range: { readonly start: number; readonly end: number };
}

interface WasmIncrementalResult {
  readonly text: string;
  readonly findings: readonly WasmFinding[];
}

interface WasmIncrementalSanitizer {
  readonly state: IncrementalSanitizerState;
  append(chunk: string): WasmIncrementalResult;
  finalize(): WasmIncrementalResult;
  abort(): void;
}

interface WasmModule {
  default(): Promise<unknown>;
  version(): string;
  initialize(): void;
  scan(input: string, policy?: NativePolicyCallback): readonly WasmFinding[];
  redact(
    input: string,
    findings: readonly WasmFinding[],
    formatter?: NativeFormatterCallback,
  ): string;
  scanAndRedact(
    input: string,
    policy?: NativePolicyCallback,
    formatter?: NativeFormatterCallback,
  ): { readonly text: string; readonly findings: readonly WasmFinding[] };
  createIncrementalSanitizer(
    options: NativeIncrementalOptions,
  ): WasmIncrementalSanitizer;
}

/**
 * Flattens an opaque handle into the contract's shape while keeping the handle
 * itself, because the WebAssembly `redact` only accepts the objects its own
 * `scan` returned.
 */
function toNativeFinding(finding: WasmFinding): NativeFinding {
  const { start, end } = finding.range;
  return {
    id: finding.id,
    type: finding.type,
    detector: finding.detector,
    confidence: finding.confidence,
    action: finding.action,
    start,
    end,
    [NATIVE_HANDLE]: finding,
  };
}

/** Recovers the handle `scan` produced, refusing a foreign finding. */
function toWasmFinding(finding: NativeFinding): WasmFinding {
  const handle = finding[NATIVE_HANDLE];
  if (handle === undefined) throw new SecretScanError("INVALID_FINDINGS");
  return handle as WasmFinding;
}

function toNativeIncrementalResult(
  result: WasmIncrementalResult,
): NativeIncrementalResult {
  return { text: result.text, findings: result.findings.map(toNativeFinding) };
}

/**
 * Loads the WebAssembly artifact published in lockstep with this package.
 *
 * The specifier is a literal so a bundler can resolve and include the glue and
 * the `.wasm` binary it references, and the import is dynamic so nothing is
 * fetched until a caller awaits `initialize()`.
 */
async function loadWasmModule(): Promise<WasmModule> {
  const module = (await import(
    "@omiologic/secret-scan-wasm"
  )) as unknown as Partial<WasmModule>;
  for (const name of [
    "default",
    "version",
    "initialize",
    "scan",
    "redact",
    "scanAndRedact",
    "createIncrementalSanitizer",
  ] as const) {
    if (typeof module[name] !== "function") {
      throw new SecretScanError("INITIALIZATION_FAILED");
    }
  }
  return module as WasmModule;
}

export const loadNativeBinding = async (): Promise<NativeBinding> => {
  const wasm = await loadWasmModule();
  await wasm.default();
  return {
    version: () => wasm.version(),
    initialize: () => {
      wasm.initialize();
    },
    scan: (input, policy) => wasm.scan(input, policy).map(toNativeFinding),
    redact: (input, findings, formatter) =>
      wasm.redact(input, findings.map(toWasmFinding), formatter),
    scanAndRedact: (input, policy, formatter) => {
      const result = wasm.scanAndRedact(input, policy, formatter);
      return {
        text: result.text,
        findings: result.findings.map(toNativeFinding),
      };
    },
    createIncrementalSanitizer: (
      options,
    ): NativeIncrementalSanitizer => {
      const session = wasm.createIncrementalSanitizer(options);
      return {
        get state() {
          return session.state;
        },
        append: (chunk) => toNativeIncrementalResult(session.append(chunk)),
        finalize: () => toNativeIncrementalResult(session.finalize()),
        abort: () => {
          session.abort();
        },
      };
    },
  };
};
