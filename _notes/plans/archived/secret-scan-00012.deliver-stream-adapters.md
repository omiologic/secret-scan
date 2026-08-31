---
work_item_id: "secret-scan-00012"
title: "Deliver Node and Web stream adapters"
depends_on:
  - "secret-scan-00011"
target_paths:
  - "src/adapters/node-stream.ts"
  - "src/adapters/web-stream.ts"
  - "src/index.ts"
  - "package.json"
  - "test/adapters"
  - "test/package-import.browser.test.ts"
  - "test/package-import.node.test.ts"
  - "README.md"
  - "ARCHITECTURE.md"
  - "_notes/features/runtime-support/README.md"
created_at: "2026-08-30T18:41:34Z"
updated_at: "2026-08-30T20:00:01Z"
---

# Deliver Node and Web stream adapters

## Outcome

Node.js and modern-browser consumers can apply the same incremental sanitizer through idiomatic stream adapters with equivalent output, backpressure, cancellation, and safe-error behavior.

## Context

Runtime adapters are a proposed extension point, but they must remain thin wrappers around the runtime-neutral incremental core. Node-specific dependencies must stay isolated from browser exports, and neither adapter may weaken the authoritative server boundary or emit unsafe buffered text on failure.

## Scope

### In scope

- Add a Node.js transform adapter and a Web `TransformStream` adapter over the incremental API.
- Define explicit package subpath exports so browser consumers do not resolve Node-only code.
- Support backpressure, flush/finalization, cancellation, and sanitized error propagation.
- Prove adapter output equivalence across chunk partitions and supported runtimes.

### Out of scope

- Web Worker adapter, UI components, request middleware, framework-specific wrappers, CommonJS output, network transport, or release operations.

## Implementation checklist

- [x] Implement thin Node and Web adapters without duplicating detector or policy behavior.
- [x] Add isolated typed subpath exports and package-content checks.
- [x] Test backpressure, cancellation, early termination, flush, empty streams, Unicode splits, and injected failures.
- [x] Verify browser bundles exclude Node-only modules.
- [x] Update usage, architecture, runtime-support, and security-boundary documentation.

## Acceptance criteria

- [x] Both adapters produce the same sanitized output and finalized findings as the incremental core for the conformance corpus.
- [x] Cancellation or failure emits no buffered plaintext after the error boundary.
- [x] Node-only dependencies are unreachable from root and browser adapter exports.
- [x] Backpressure and finalization follow native runtime conventions without hidden I/O or telemetry.
- [x] Whole-string APIs and their package entry point remain compatible.

## Verification

- [x] Run Node 20/22 adapter tests, browser bundle/import tests, partition equivalence, package-content inspection, typecheck, build, and complete CI checks.
- [x] Inspect export maps and browser bundles for Node-only dependency leakage.

## Completion record

- Result: Completed. Added isolated `./node-stream` and `./web-stream` byte-stream adapters over one bounded incremental sanitizer session. Both use stateful fatal UTF-8 decoding, preserve absolute finding metadata and native backpressure, finalize on close, discard retained plaintext on destruction/cancellation/abort, and propagate fixed input-free library failures. The root entry point remains runtime-neutral and unchanged.
- Evidence: `npm run ci` passed on Node 22.16.0 and through `node@20` 20.20.2. Each run passed typecheck, build, and all 253 tests across 17 files. Adapter tests cover every UTF-8 byte partition in the incremental corpus, empty and fragmented streams, backpressure, finalization, cancellation, destruction, malformed UTF-8, and injected formatter failure. Package, export, declaration, and browser bundle inspection found `node:stream` only in the Node adapter. Plan and governance validators completed with 0 errors and 0 warnings.
- Follow-ups: None. Release operations, version selection, tagging, changelog creation, publishing, and deployment remain outside this item and require explicit approval.
