/**
 * The Node.js adapter: the N-API native addon, normalized to the internal
 * binding contract (`decision-define-runtime-bindings`).
 *
 * The package's `imports` map reaches this module only under the `node`
 * condition, so a browser build never resolves it and never pulls in the
 * `node:` module below.
 *
 * Node's own loading has nothing to await, so `initialize()` here is a fast
 * idempotent no-op in the addon. It stays part of the contract regardless, so
 * the usage model does not vary by runtime.
 */

import { createRequire } from "node:module";

import { SecretScanError } from "../errors.js";
import type {
  NativeBinding,
  NativeFinding,
  NativeFormatterCallback,
  NativeIncrementalOptions,
  NativeIncrementalSanitizer,
  NativePolicyCallback,
  NativeScanAndRedactResult,
} from "../native.js";

/**
 * The addon's own exported shape. `scanAndRedact` names its text `redacted`,
 * which this adapter renames to the contract's `text`; everything else is
 * already the documented UTF-16 shape.
 */
interface NodeAddon {
  version(): string;
  initialize(): void;
  scan(
    input: string,
    policy?: NativePolicyCallback,
  ): readonly NativeFinding[];
  redact(
    input: string,
    findings: readonly NativeFinding[],
    formatter?: NativeFormatterCallback,
  ): string;
  scanAndRedact(
    input: string,
    policy?: NativePolicyCallback,
    formatter?: NativeFormatterCallback,
  ): { readonly findings: readonly NativeFinding[]; readonly redacted: string };
  createIncrementalSanitizer(
    options: NativeIncrementalOptions,
  ): NativeIncrementalSanitizer;
}

/** The platform artifact published in lockstep with this package. */
const ADDON_SPECIFIER = "@omiologic/secret-scan-node";

function loadAddon(): NodeAddon {
  const require = createRequire(import.meta.url);
  const addon = require(ADDON_SPECIFIER) as Partial<NodeAddon>;
  for (const name of [
    "version",
    "initialize",
    "scan",
    "redact",
    "scanAndRedact",
    "createIncrementalSanitizer",
  ] as const) {
    if (typeof addon[name] !== "function") {
      throw new SecretScanError("INITIALIZATION_FAILED");
    }
  }
  return addon as NodeAddon;
}

export const loadNativeBinding = async (): Promise<NativeBinding> => {
  const addon = loadAddon();
  return {
    version: () => addon.version(),
    initialize: () => {
      addon.initialize();
    },
    scan: (input, policy) => addon.scan(input, policy),
    redact: (input, findings, formatter) =>
      addon.redact(input, findings, formatter),
    scanAndRedact: (input, policy, formatter): NativeScanAndRedactResult => {
      const result = addon.scanAndRedact(input, policy, formatter);
      return { text: result.redacted, findings: result.findings };
    },
    createIncrementalSanitizer: (options) =>
      addon.createIncrementalSanitizer(options),
  };
};
