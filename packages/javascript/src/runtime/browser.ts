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
 *
 * `bindings/wasm` exports a real `createIncrementalSanitizer`
 * (`decision-define-runtime-bindings`): it builds a bounded
 * `IncrementalSanitizer` session, wrapping the same core session
 * `bindings/node` and `bindings/python` wrap, with an explicit
 * `accepting`/`finalized`/`aborted`/`failed` lifecycle and absolute UTF-16
 * ranges converted chunk by chunk. `./web-stream` reaches it through this
 * same binding.
 */

import { SecretScanError } from "../errors.js";
import {
  NATIVE_HANDLE,
  type NativeBinding,
  type NativeDetectedFinding,
  type NativeFinding,
  type NativeFormatterCallback,
  type NativeIncrementalPolicyCallback,
  type NativeIncrementalResult,
  type NativePolicyCallback,
} from "../native.js";
import type {
  IncrementalSanitizerState,
  PlaceholderContext,
  PolicyContext,
} from "../types.js";

/** One opaque finding handle, as `scan`/`redact`/`scanAndRedact` return it. */
export interface WasmFinding {
  readonly id: string;
  readonly type: string;
  readonly detector: string;
  readonly confidence: string;
  readonly action: string;
  readonly range: { readonly start: number; readonly end: number };
}

/**
 * The safe metadata a `policy` callback is actually invoked with
 * (`bindings/wasm/src/metadata.rs`'s `policy_finding`): the same fields as
 * {@link WasmFinding} minus `action`, with the range still nested rather than
 * flattened onto the object.
 */
export interface WasmDetectedFindingMetadata {
  readonly id: string;
  readonly type: string;
  readonly detector: string;
  readonly confidence: string;
  readonly range: { readonly start: number; readonly end: number };
}

/**
 * The safe metadata a `formatter` callback is actually invoked with
 * (`metadata.rs`'s `formatter_finding`): adds the `action` the policy already
 * chose.
 */
export interface WasmFindingMetadata extends WasmDetectedFindingMetadata {
  readonly action: string;
}

type WasmPolicyCallback = (
  finding: WasmDetectedFindingMetadata,
  context: PolicyContext,
) => string;

type WasmFormatterCallback = (
  finding: WasmFindingMetadata,
  context: PlaceholderContext,
) => string;

/** The position information an incremental policy callback receives. */
export interface WasmIncrementalPolicyContext {
  readonly findingIndex: number;
}

type WasmIncrementalPolicyCallback = (
  finding: WasmDetectedFindingMetadata,
  context: WasmIncrementalPolicyContext,
) => string;

/** The result of one incremental `append`/`finalize` call. */
export interface WasmIncrementalResult {
  readonly text: string;
  readonly findings: readonly WasmFinding[];
}

/** The `IncrementalSanitizer` class `createIncrementalSanitizer` returns. */
export interface WasmIncrementalSanitizer {
  readonly state: string;
  append(chunk: string): WasmIncrementalResult;
  finalize(): WasmIncrementalResult;
  abort(): void;
}

export interface WasmModule {
  default(): Promise<unknown>;
  version(): string;
  initialize(): void;
  scan(input: string, policy?: WasmPolicyCallback): readonly WasmFinding[];
  redact(
    input: string,
    findings: readonly WasmFinding[],
    formatter?: WasmFormatterCallback,
  ): string;
  scanAndRedact(
    input: string,
    policy?: WasmPolicyCallback,
    formatter?: WasmFormatterCallback,
  ): { readonly text: string; readonly findings: readonly WasmFinding[] };
  createIncrementalSanitizer(
    maxInputCodeUnits: number,
    maxBufferedCodeUnits: number,
    maxTokenCodeUnits: number,
    maxMultilineCodeUnits: number,
    policy?: WasmIncrementalPolicyCallback,
    formatter?: WasmFormatterCallback,
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

/**
 * Flattens and freezes the nested-`range` metadata a `policy` callback is
 * actually invoked with, so a callback crossing this boundary sees the same
 * numeric `start`/`end` fields it sees on Node, matching `types.ts`.
 */
function toNativeDetectedFinding(
  finding: WasmDetectedFindingMetadata,
): NativeDetectedFinding {
  const { start, end } = finding.range;
  return Object.freeze({
    id: finding.id,
    type: finding.type,
    detector: finding.detector,
    confidence: finding.confidence,
    start,
    end,
  });
}

/** As {@link toNativeDetectedFinding}, plus the `action` a formatter sees. */
function toNativeFormatterMetadata(
  finding: WasmFindingMetadata,
): NativeFinding {
  const { start, end } = finding.range;
  return Object.freeze({
    id: finding.id,
    type: finding.type,
    detector: finding.detector,
    confidence: finding.confidence,
    action: finding.action,
    start,
    end,
  });
}

function toWasmPolicyCallback(
  policy: NativePolicyCallback | undefined,
): WasmPolicyCallback | undefined {
  if (policy === undefined) return undefined;
  return (finding, context) =>
    policy(toNativeDetectedFinding(finding), context);
}

function toWasmFormatterCallback(
  formatter: NativeFormatterCallback | undefined,
): WasmFormatterCallback | undefined {
  if (formatter === undefined) return undefined;
  return (finding, context) =>
    formatter(toNativeFormatterMetadata(finding), context);
}

function toWasmIncrementalPolicyCallback(
  policy: NativeIncrementalPolicyCallback | undefined,
): WasmIncrementalPolicyCallback | undefined {
  if (policy === undefined) return undefined;
  return (finding, context) =>
    policy(toNativeDetectedFinding(finding), context);
}

function toNativeIncrementalResult(
  result: WasmIncrementalResult,
): NativeIncrementalResult {
  return {
    text: result.text,
    findings: result.findings.map(toNativeFinding),
  };
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
    "@redact-secret/wasm"
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

/**
 * Builds the internal binding contract from an already-loaded WebAssembly
 * module.
 *
 * Exported so a test double can exercise this exact normalization — the
 * nested-metadata flattening above and the incremental session wiring below
 * — against a fake module shaped like the real artifact, without loading the
 * artifact itself.
 */
export function createBindingFromWasmModule(wasm: WasmModule): NativeBinding {
  return {
    version: () => wasm.version(),
    initialize: () => {
      wasm.initialize();
    },
    scan: (input, policy) =>
      wasm.scan(input, toWasmPolicyCallback(policy)).map(toNativeFinding),
    redact: (input, findings, formatter) =>
      wasm.redact(
        input,
        findings.map(toWasmFinding),
        toWasmFormatterCallback(formatter),
      ),
    scanAndRedact: (input, policy, formatter) => {
      const result = wasm.scanAndRedact(
        input,
        toWasmPolicyCallback(policy),
        toWasmFormatterCallback(formatter),
      );
      return {
        text: result.text,
        findings: result.findings.map(toNativeFinding),
      };
    },
    createIncrementalSanitizer: (options) => {
      const session = wasm.createIncrementalSanitizer(
        options.limits.maxInputCodeUnits,
        options.limits.maxBufferedCodeUnits,
        options.limits.maxTokenCodeUnits,
        options.limits.maxMultilineCodeUnits,
        toWasmIncrementalPolicyCallback(options.policy),
        toWasmFormatterCallback(options.formatter),
      );
      return {
        get state() {
          return session.state as IncrementalSanitizerState;
        },
        append: (chunk) => toNativeIncrementalResult(session.append(chunk)),
        finalize: () => toNativeIncrementalResult(session.finalize()),
        abort: () => {
          session.abort();
        },
      };
    },
  };
}

export const loadNativeBinding = async (): Promise<NativeBinding> => {
  const wasm = await loadWasmModule();
  await wasm.default();
  return createBindingFromWasmModule(wasm);
};
