---
work_item_id: "secret-scan-00018"
title: "Prove adapter lifecycle and backpressure behavior"
depends_on:
  - "secret-scan-00014"
target_paths:
  - "src/adapters/node-stream.ts"
  - "src/adapters/web-stream.ts"
  - "src/adapters/shared.ts"
  - "test/adapters/node-stream.test.ts"
  - "test/adapters/web-stream.test.ts"
  - "_notes/features/runtime-support/README.md"
created_at: "2026-08-30T20:41:21Z"
updated_at: "2026-08-30T21:46:42Z"
---

# Prove adapter lifecycle and backpressure behavior

## Outcome

Permanent Node and Web adapter tests demonstrate native backpressure and every security-relevant terminal transition, including competing failure and cancellation orderings.

## Context

SS-AUD-006 found that current backpressure assertions mainly compare final output and that several abort, downstream-failure, decoder-failure, and terminal-race cases exist only as temporary audit evidence. This item follows the incremental accounting repair so adapter evidence targets the final core lifecycle semantics.

## Scope

### In scope

- Measure actual producer pause/resume or desired-size behavior under downstream backpressure.
- Cover Node destruction and pipeline failure plus Web readable cancellation, writable abort, explicit abort, and error propagation.
- Exercise malformed UTF-8 after prior safe output and competing close, abort, cancel, destroy, and failure events.
- Make only bounded adapter fixes exposed by deterministic tests.

### Out of scope

- New adapter families, framework middleware, transport I/O, CommonJS output, or duplicated detector/policy logic.

## Implementation checklist

- [x] Define the Node and Web adapter state-transition matrix and expected safe outcome for every terminal ordering.
- [x] Add deterministic backpressure tests that observe stalled and resumed flow rather than only final concatenated output.
- [x] Add downstream failure, writable/readable cancellation, explicit abort, malformed-decoder, and repeated-terminal tests after zero and some safe output.
- [x] Assert retained plaintext is discarded, findings remain immutable, and errors remain fixed and input-free.
- [x] Update runtime-support notes only where the durable evidence changes or sharpens a claim.

## Acceptance criteria

- [x] Node and Web tests prove native backpressure without timers or race-prone wall-clock assumptions.
- [x] Every terminal transition and tested race produces one deterministic final state and releases no buffered plaintext after the boundary.
- [x] Safe output finalized before a later failure may remain emitted, while unresolved output at the failure boundary is never emitted.
- [x] Root and Web dependency graphs still cannot resolve Node-only modules.

## Verification

- [x] Run adapter tests on Node 20 and 22, all UTF-8 partition cases, browser bundle/import checks, typecheck, build, and complete CI checks.
- [x] Inspect failures and diagnostics for plaintext leakage and validate repeated runs for deterministic ordering.

## Completion record

- Result: Completed. Permanent Node and Web adapter tests now directly prove native backpressure and the security-relevant close, destruction, cancellation, abort, downstream-failure, decoder-failure, and repeated-terminal orderings. The tests confirmed the existing adapter implementations already satisfy the contract, so no production runtime change was needed.
- Evidence: The focused adapter suites passed 10 consecutive runs with 18 tests per run and no timers or wall-clock races. Node 22.16.0 and Node 20.20.2 each passed typecheck, build, all UTF-8 partition cases, browser and package import checks, and the complete 17-file, 352-test suite. Assertions preserve finalized safe output, exclude unresolved plaintext after terminal boundaries, verify immutable findings, and check fixed input-free library errors.
- Follow-ups: `secret-scan-00021` remains blocked until `secret-scan-00019` is completed. No version, release, publication, or deployment operation is authorized or performed.
