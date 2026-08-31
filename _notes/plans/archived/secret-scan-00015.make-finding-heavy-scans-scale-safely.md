---
work_item_id: "secret-scan-00015"
title: "Make finding-heavy scans scale safely"
depends_on: []
target_paths:
  - "src/scan.ts"
  - "src/redact.ts"
  - "test/integration/candidate-pipeline.test.ts"
  - "test/integration/policy-redaction.test.ts"
  - "test/performance/scan-performance.test.ts"
  - "ARCHITECTURE.md"
  - "README.md"
created_at: "2026-08-30T20:41:21Z"
updated_at: "2026-08-30T21:09:48Z"
---

# Make finding-heavy scans scale safely

## Outcome

Candidate resolution and placeholder safety remain practical under finding-heavy adversarial input without changing deterministic precedence, redaction, or public-result guarantees.

## Context

SS-AUD-002 measured roughly six seconds for 50,000 findings near one MiB. Candidate acceptance scans all prior accepted findings, and custom placeholder validation compares every placeholder with every matched value. Both paths are quadratic and can block an authoritative server's event loop.

## Scope

### In scope

- Replace overlap resolution with an interval-aware or otherwise bounded algorithm that preserves the exact documented winner ordering.
- Replace the placeholder-by-matched-value cross-product with an efficient strategy that preserves the chosen no-reproduction contract.
- Reduce unnecessary plaintext slice retention without exposing values or weakening formatter failure safety.
- Add deterministic scaling, memory, equivalence, overlap, and adversarial regressions.

### Out of scope

- Parallel or nondeterministic scanning, runtime network services, telemetry, worker-thread orchestration, or changing detector specificity to hide performance costs.

## Implementation checklist

- [x] Capture ordering, specificity, confidence, span-width, registration-order, and emission-order behavior in algorithm-independent tests.
- [x] Implement bounded overlap lookup and prove equivalence on dense, adjacent, nested, and duplicate candidates.
- [x] Implement efficient placeholder exclusion for custom formatters while keeping built-in formatters input-independent.
- [x] Add multiple input sizes and scaling-ratio assertions for dense findings instead of relying only on generous absolute timeouts.
- [x] Measure peak-memory behavior and document any explicit caller-side finding-count or request limits still required.

## Acceptance criteria

- [x] Dense-candidate outputs, finding IDs, ordering, actions, offsets, and placeholders exactly match the established deterministic contract.
- [x] Doubling adversarial candidate and finding counts no longer exhibits quadratic growth within the checked scaling envelope.
- [x] Placeholder validation does not perform every-placeholder by every-value comparison and never returns a formatter output that violates the selected reproduction rule.
- [x] Findings, errors, benchmarks, and diagnostics contain no matched plaintext values.

## Verification

- [x] Run candidate-pipeline, policy-redaction, performance, conformance, typecheck, build, and complete CI checks.
- [x] Re-run the audit's 50,000-finding case with recorded time and memory evidence plus a deterministic multi-size scaling assertion.

## Completion record

- Result: Completed. Greedy overlap resolution now uses a balanced interval tree with logarithmic lookup and insertion, candidate validation avoids matched-text slices, and placeholder safety uses an exact length-indexed set of unique reproducible matched values instead of a placeholder-by-finding cross-product.
- Evidence: `npm run ci` passed on Node 22.16.0 with 17 files and 282 tests; the focused candidate, redaction, performance, and 70-case conformance suites passed; governance and plan validators reported zero errors and warnings. The deterministic 12,500/25,000/50,000 scaling run measured 22.8/32.5/58.0 ms (1.43x/1.79x doubling ratios). A separate 50,000-finding, 1,000,000-code-unit run measured 72.5 ms, 43,350,672 bytes of heap growth, and 129,646,592 bytes peak RSS.
- Follow-ups: Whole-input request and custom-detector candidate limits remain caller-owned and are now documented. `secret-scan-00019` retains the final public-contract reconciliation for short caller-supplied findings; `secret-scan-00016` separately owns repeated and malformed PEM handling.
