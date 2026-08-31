---
work_item_id: "secret-scan-00011"
title: "Implement incremental scan and redaction"
depends_on:
  - "secret-scan-00010"
target_paths:
  - "src/incremental.ts"
  - "src/types.ts"
  - "src/index.ts"
  - "test/conformance"
  - "test/integration"
  - "test/performance"
  - "_notes/features/detector-pipeline/README.md"
  - "_notes/features/policy-controls/README.md"
  - "_notes/features/safe-redaction/README.md"
created_at: "2026-08-30T18:41:34Z"
updated_at: "2026-08-30T19:51:08Z"
---

# Implement incremental scan and redaction

## Outcome

Consumers can incrementally sanitize chunked text through a side-effect-free runtime-neutral API that honors the approved buffering contract and produces deterministic safe output and metadata.

## Context

Streaming is valuable only if split credentials cannot bypass detection and unsafe bytes are not emitted prematurely. The implementation must preserve separation between detection, policy, and redaction while remaining compatible with both Node and browser adapters.

## Scope

### In scope

- Implement the approved incremental state machine and public runtime-neutral API.
- Preserve deterministic absolute offsets, policy actions, overlap resolution, and placeholder numbering.
- Enforce explicit limits and sanitized failures without returning buffered input fragments.
- Prove chunk-partition equivalence and bounded memory behavior for the supported contract.

### Out of scope

- Node streams, Web streams, Web Workers, framework middleware, network I/O, or changes to whole-string API behavior.

## Implementation checklist

- [x] Implement append, safe-output retrieval, finalization, and abort behavior from the approved contract.
- [x] Reuse detector, policy, overlap, and redaction logic without duplicating security rules.
- [x] Add partition-equivalence tests across all detector and redaction families.
- [x] Add buffer-limit, malformed-extension, policy-error, formatter-error, abort, and repeated-finalization tests.
- [x] Add representative incremental performance and memory gates.
- [x] Update public exports and affected feature documentation.

## Acceptance criteria

- [x] No chunk partition in the conformance corpus permits detected plaintext to cross the output boundary.
- [x] Supported incremental results match whole-string sanitized text, actions, ordering, and absolute offsets.
- [x] Buffer and input limits fail with fixed input-free errors and no partial unsafe output.
- [x] Identical logical input, options, and partitioning produce identical outputs.
- [x] The implementation performs no runtime network, filesystem, storage, telemetry, or environment-dependent behavior.

## Verification

- [x] Run partition-equivalence, invariant, error-safety, performance, browser-build, Node-import, typecheck, build, and complete CI checks.
- [x] Inspect exported declarations, error paths, and retained state for plaintext-bearing public fields.

## Completion record

- Result: Completed. Added a bounded runtime-neutral incremental sanitizer with append, finalize, abort, immutable absolute-offset findings, progressive policy context, deterministic global placeholder numbering, fixed input-free failures, and explicit input, buffer, token, and multiline limits. Complete logical lines and PEM blocks reuse the built-in detector pipeline, default action mapping, overlap resolution, and redactor; synchronous custom detectors remain rejected because they lack retention declarations.
- Evidence: `npm run ci` passed typecheck, build, and all 241 tests across 15 files. The suite covers every bounded evaluated detector family, every representative UTF-16 and streaming-decoded UTF-8 partition, provisional-output safety, lifecycle and error paths, browser bundling, Node import, package contents, and a one-MiB bounded-retention performance gate. Exported declarations and retained/error state were inspected. Governance and plan validators completed with 0 errors and 0 warnings.
- Follow-ups: `secret-scan-00012` is ready to add Node and Web stream adapters. Custom incremental detectors remain unsupported until a bounded retention-declaration contract is approved.
