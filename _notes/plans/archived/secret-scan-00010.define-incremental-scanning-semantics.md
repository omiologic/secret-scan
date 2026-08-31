---
work_item_id: "secret-scan-00010"
title: "Define safe incremental scanning semantics"
depends_on:
  - "secret-scan-00008"
  - "secret-scan-00009"
target_paths:
  - "ARCHITECTURE.md"
  - "src/types.ts"
  - "test/conformance"
  - "test/integration"
  - "_notes/features/detector-pipeline/README.md"
  - "_notes/features/policy-controls/README.md"
  - "_notes/features/safe-redaction/README.md"
created_at: "2026-08-30T18:41:34Z"
updated_at: "2026-08-30T19:29:57Z"
---

# Define safe incremental scanning semantics

## Outcome

A reviewed contract and executable boundary corpus define when chunked input may be emitted, how cross-chunk secrets are retained, how offsets and findings are reported, and how final incremental output compares with whole-string scanning.

## Context

Naively scanning each chunk can miss a credential split across boundaries or emit plaintext before enough context arrives. An incremental API therefore needs explicit buffering, finalization, offset, policy, memory, and failure semantics before implementation. The synchronous API remains the behavioral reference where equivalence is possible.

## Scope

### In scope

- Define incremental scanner/redactor states, input and output contracts, finalization, and sanitized error behavior.
- Define bounded retention requirements for fixed-width, contextual, URL, JWT, bearer, and multiline private-key matches.
- Build a chunk-partition corpus including every byte/JavaScript-code-unit boundary around representative synthetic matches.
- Record where strict whole-input equivalence is guaranteed and where buffering or explicit limits are required.

### Out of scope

- Implementing the incremental engine, Node/Web adapters, unbounded buffering, UI progress, framework middleware, or changing synchronous behavior.

## Implementation checklist

- [x] Inventory lookbehind/lookahead and maximum-bound assumptions for every built-in detector.
- [x] Specify safe emission, buffering, absolute-offset, policy-evaluation, redaction-numbering, abort, flush, and error contracts.
- [x] Define explicit input, buffer, and multiline-secret limits without environment-dependent defaults.
- [x] Add an executable partition corpus for cross-chunk positives, negatives, overlaps, Unicode, and end-of-stream cases.
- [x] Review public API additions for runtime neutrality and compatibility.

## Acceptance criteria

- [x] The contract never permits unscanned plaintext to be emitted before its detection window is closed.
- [x] Cross-chunk behavior is explicit for every built-in detector family, including private-key blocks.
- [x] Findings use deterministic absolute offsets into the logical original input.
- [x] Policy evaluation and placeholder numbering occur exactly once per finalized finding.
- [x] Memory bounds, finalization requirements, and any non-equivalent cases are explicit and testable.

## Verification

- [x] Review the contract against architecture, security, compatibility, and public-result invariants.
- [x] Run the partition-corpus generator and validate complete boundary coverage using synthetic inputs only.

## Completion record

- Result: Completed. Defined the incremental state, safe-emission, retention, explicit-limit, finalization, abort, failure, offset, policy, redaction, and equivalence contract. Added a synthetic executable corpus that enumerates every UTF-16 code-unit and streaming-decoded UTF-8 byte boundary for representative detector families. Public runtime and type exports were deliberately deferred until the implementation exists; the review identified the need for a distinct progressive policy context rather than weakening synchronous `PolicyContext.findingCount` semantics.
- Evidence: `npm run ci` passed typecheck, build, and all 235 tests across 15 files. The governance plan and profile validators completed with 0 errors and 0 warnings. Feature notes link the reviewed architecture contract and executable corpus.
- Follow-ups: `secret-scan-00011` is now ready to implement the runtime-neutral incremental core. Custom incremental detectors remain unsupported until a bounded retention declaration contract is separately justified.
