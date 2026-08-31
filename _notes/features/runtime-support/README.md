# Browser and Node runtime support

**State: current in the repository; pre-release package**

## What it does and why

The same side-effect-free core can scan text in modern browsers and Node.js services. This supports preventive client review and authoritative server enforcement without maintaining separate detection implementations.

## How it works

The package is TypeScript compiled to ES2022 ESM with an explicit runtime-neutral root export plus isolated Node and Web stream subpaths. Core runtime code uses JavaScript and Web Platform primitives and has no filesystem, DOM, storage, network, telemetry, secret-manager, or environment-dependent behavior.

## Supported now

- Node.js 20 or newer.
- Modern browsers capable of running the ES2022 output.
- ESM root, `./node-stream`, and `./web-stream` entry points with declarations and no CommonJS build.
- A reviewed root public surface that excludes detector-retention tuning constants and candidate-resolution internals.
- A native Node `Transform` adapter and Web `TransformStream` adapter over the bounded incremental core.
- Stateful fatal UTF-8 decoding, native backpressure and finalization, cancellation/abort handling, immutable accumulated findings, and fixed input-free errors.
- Deterministic adapter tests directly observe Node producer stall/drain and Web desired-size stall/pull behavior without timers. The lifecycle matrix covers destruction, downstream pipeline failure, readable cancellation, writable abort, explicit abort, normal close, malformed UTF-8 after finalized output, and competing or repeated terminal calls.
- Partition-invariant incremental acceptance: retention limits count only unresolved plaintext, not finalized safe output accumulated during a transport chunk.
- Browser bundling proves that the root and Web adapter graphs exclude Node-only modules.
- Representative deterministic performance gates for 1 KB, 100 KB, and 1 MB ordinary inputs.

## Planned or considered

- **current:** [Node and Web stream adapters](../../plans/archived/secret-scan-00012.deliver-stream-adapters.md) provide isolated runtime integrations. Release still requires explicit approval, version selection, changelog review, public API review, and passing release checks.
- **proposed:** A Web Worker adapter remains an architectural possibility, not an implementation commitment.
- **proposed:** A broader Context Safety Gateway could compose this package with other controls, while keeping `secret-scan` independently focused.

## Boundaries and tradeoffs

The package does not provide UI, request middleware, framework wrappers, or a CommonJS build. The stream adapters accept UTF-8 bytes and intentionally do not define network transport. Client-side scanning improves UX but can be bypassed, so it cannot replace server-side scanning. Server consumers must also avoid logging raw data before invoking the scanner.

The repository demonstrates package readiness, but no public version has been approved or released. The library is credential-focused and is not a vault, credential-liveness checker, PII scanner, prompt-injection detector, or complete DLP system.

## Evidence and references

- Package surface: [package.json](../../../package.json), [root exports](../../../src/index.ts), [Node adapter](../../../src/adapters/node-stream.ts), and [Web adapter](../../../src/adapters/web-stream.ts)
- Release notes: [version-neutral Unreleased changelog](../../../CHANGELOG.md)
- Tests: [adapter behavior](../../../test/adapters), [browser import](../../../test/package-import.browser.test.ts), [Node import](../../../test/package-import.node.test.ts), [performance](../../../test/performance/scan-performance.test.ts), and [package contents](../../../test/package-contents.test.ts)
- Architecture: [runtime constraints](../../../ARCHITECTURE.md#runtime-constraints), [build strategy](../../../ARCHITECTURE.md#build-strategy), [browser UX integration](../../../ARCHITECTURE.md#browser-ux-integration), and [Future: Context Safety Gateway](../../../ARCHITECTURE.md#future-context-safety-gateway)
- Completed readiness work item: [secret-scan-00006](../../plans/archived/secret-scan-00006.prove-package-readiness.md)
- Completed stream adapter work item: [secret-scan-00012](../../plans/archived/secret-scan-00012.deliver-stream-adapters.md)
- Incremental partition-invariance work item: [secret-scan-00014](../../plans/archived/secret-scan-00014.make-incremental-acceptance-partition-invariant.md)
- Completed adapter lifecycle evidence: [secret-scan-00018](../../plans/archived/secret-scan-00018.prove-adapter-lifecycle-behavior.md)
