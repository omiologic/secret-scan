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
 *
 * `createIncrementalSanitizer` is declared optional here because this type
 * also describes any addon a consumer might have installed, including one
 * built before `bindings/node` implemented it: this adapter treats its
 * absence the same way `runtime/browser.ts` treats `bindings/wasm`'s
 * documented non-support — `INCREMENTAL_UNAVAILABLE` at call time, not a
 * load-time failure — rather than assuming every addon on disk is current.
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
  createIncrementalSanitizer?(
    options: NativeIncrementalOptions,
  ): NativeIncrementalSanitizer;
}

/**
 * One `optionalDependencies` entry per `node-publish-targets`, published in
 * lockstep with this package (`bindings/node/npm/<platform>/package.json`).
 * `os`/`cpu`/`libc` on each of those manifests is what makes every
 * non-matching entry optional in the literal npm sense: an install skips
 * the ones that do not match instead of failing on them.
 *
 * `node-publish-targets` is six of the eight triples `napi.targets` builds
 * and qualifies: npm ships glibc only
 * (`decision-ship-first-release-artifact-set`), so the two musl triples have
 * no entry here and no libc dimension below — there is nothing for one to
 * select between. A musl host's `process.platform`/`process.arch` still
 * matches the `linux` glibc entry, and each manifest's `libc` field is not
 * reliably enforced by every npm version, so a musl install can still
 * resolve and install the glibc package (`docs/qualification.md`).
 * `loadAddon`'s `require` of a glibc-linked `.node` file then fails to load
 * under a musl runtime, caught the same way a missing optional dependency
 * on any platform is, reaching the same `INITIALIZATION_FAILED` an
 * explicitly unsupported host gets. `scripts/check-artifact-matrix.py`
 * requires this mapping, the six `bindings/node/npm/<platform>/package.json`
 * manifests, and this package's own `optionalDependencies` to name exactly
 * the same six packages.
 */
const PLATFORM_PACKAGES: Readonly<
  Partial<Record<string, Readonly<Partial<Record<string, string>>>>>
> = {
  darwin: {
    arm64: "@redact-secret/node-darwin-arm64",
    x64: "@redact-secret/node-darwin-x64",
  },
  linux: {
    arm64: "@redact-secret/node-linux-arm64-gnu",
    x64: "@redact-secret/node-linux-x64-gnu",
  },
  win32: {
    arm64: "@redact-secret/node-win32-arm64-msvc",
    x64: "@redact-secret/node-win32-x64-msvc",
  },
};

/**
 * The addon package this host should have installed, or `undefined` on a
 * platform/architecture this package ships no addon for at all — the
 * runtime fallback that keeps an unsupported host's failure identical to a
 * supported host whose optional dependency did not install: both reach
 * `loadAddon`'s own `INITIALIZATION_FAILED`, never a raw `require` error.
 *
 * Exported so `scripts/qualify-node-addon.mjs` and
 * `scripts/qualify-package-consumer.mjs` compute the same host-to-package
 * mapping this module actually loads from, instead of restating it.
 */
export function resolveAddonSpecifier(): string | undefined {
  return PLATFORM_PACKAGES[process.platform]?.[process.arch];
}

function loadAddon(): NodeAddon {
  const specifier = resolveAddonSpecifier();
  if (specifier === undefined) {
    throw new SecretScanError("INITIALIZATION_FAILED");
  }

  const require = createRequire(import.meta.url);
  let addon: Partial<NodeAddon>;
  try {
    addon = require(specifier) as Partial<NodeAddon>;
  } catch {
    // Not installed (an optional dependency npm skipped, or one that failed
    // to install) and a corrupt addon both fail the same fixed way.
    throw new SecretScanError("INITIALIZATION_FAILED");
  }
  for (const name of [
    "version",
    "initialize",
    "scan",
    "redact",
    "scanAndRedact",
  ] as const) {
    if (typeof addon[name] !== "function") {
      throw new SecretScanError("INITIALIZATION_FAILED");
    }
  }
  return addon as NodeAddon;
}

/**
 * Builds the internal binding contract from an already-loaded addon.
 *
 * Exported so a test double can exercise this exact normalization —
 * including the `createIncrementalSanitizer` fallback — without loading the
 * real addon, the way `runtime/browser.ts`'s
 * `createBindingFromWasmModule` does for the WebAssembly artifact.
 */
export function createBindingFromAddon(addon: NodeAddon): NativeBinding {
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
    createIncrementalSanitizer: (options) => {
      if (typeof addon.createIncrementalSanitizer !== "function") {
        throw new SecretScanError("INCREMENTAL_UNAVAILABLE");
      }
      return addon.createIncrementalSanitizer(options);
    },
  };
}

export const loadNativeBinding = async (): Promise<NativeBinding> =>
  createBindingFromAddon(loadAddon());
