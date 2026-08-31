# Deterministic scanning and detector extensions

**State: current**

## What it does and why

`scan` runs built-in and consumer-supplied detectors through one deterministic pipeline, returning stable, non-overlapping findings. This gives every detector the same validation and safety boundary and makes repeated scans reproducible.

## How it works

An ordered registry runs built-ins first and appends detectors supplied through `ScanOptions`. Candidates are validated, prioritized by specificity and confidence, then by narrower range and stable registration/emission order. Accepted findings are sorted by original-input position and assigned deterministic IDs before policy evaluation.

## Supported now

- The exported `SecretDetector` contract and `DetectorRegistry`.
- Custom detectors through `scan` and `scanAndRedact` options.
- Stable overlap resolution, adjacent findings, original JavaScript string offsets, and immutable public findings.
- Fixed, input-free errors for invalid registration, detector failures, and malformed candidates.
- Public metadata containing classification, confidence, action, and ranges without candidate signals or matched plaintext.
- Bounded incremental scanning with the same built-in detector pipeline and absolute UTF-16 offsets.
- Node and Web UTF-8 stream adapters over that bounded incremental core.
- A stable-release [coverage matrix](../../../test/conformance/COVERAGE.md)
  across positive, near-miss, false-positive, host-context, overlap, mutation,
  incremental, adversarial, and permanent regression evidence.

## Planned or considered

- **current:** The reusable [detector conformance corpus](../../../test/conformance/README.md) and [incremental boundary corpus](../../../test/conformance/incremental-partitions.ts) define whole-input behavior and exhaustive representative chunk partitions.
- **current:** Fixed grammar mutations and explicit qualification tiers make
  corpus ordering and accepted/rejected boundaries reviewable without treating
  fixture count as completeness.
- **current:** [Incremental scanning](../../plans/archived/secret-scan-00011.implement-incremental-sanitization.md) implements the approved [safe incremental contract](../../../ARCHITECTURE.md#incremental-scanning-contract).
- **unknown:** Internal candidate-resolution mechanics remain private until the algorithm stabilizes; the architecture does not commit to making them public.

## Boundaries and tradeoffs

A custom candidate without an explicit specificity uses the lowest tier and cannot displace stronger classified evidence. Understating specificity may lose a real overlap; overstating it may suppress a more accurate candidate. Custom detector logic may inspect input internally, so its implementer must preserve the no-plaintext-results, diagnostics, and errors boundary.

Custom detectors are trusted in-process code, receive the entire plaintext
input, and must reject rather than truncate above a documented per-request
candidate limit selected for the authoritative server's resource budget. The
library sanitizes a thrown detector error but cannot prevent a malicious or
careless detector from logging, storing, or otherwise exfiltrating input.

The incremental API finalizes complete logical lines or PEM blocks through the
same built-in pipeline. Custom synchronous detectors do not declare finite
retention requirements and are therefore outside the approved incremental
equivalence boundary. The Node and Web subpaths provide byte-stream adapters;
framework-specific middleware remains outside the package. Detection does not
enforce whether a finding is allowed, warned, redacted, or blocked.

## Evidence and references

- Source: [registry](../../../src/registry.ts), [pipeline and scan API](../../../src/scan.ts), and [extension types](../../../src/types.ts)
- Tests: [candidate pipeline](../../../test/integration/candidate-pipeline.test.ts) and [public type contracts](../../../test/type-contracts.ts)
- Corpus evidence: [qualification contract](../../../test/conformance/README.md)
  and [generated coverage table](../../../test/conformance/COVERAGE.md)
- Architecture: [processing pipeline](../../../ARCHITECTURE.md#processing-pipeline), [detector model](../../../ARCHITECTURE.md#detector-model), [conflict resolution](../../../ARCHITECTURE.md#conflict-resolution), and [extension model](../../../ARCHITECTURE.md#extension-model)
- Completed work items: [secret-scan-00001](../../plans/archived/secret-scan-00001.establish-package-foundation.md), [secret-scan-00002](../../plans/archived/secret-scan-00002.build-candidate-processing-pipeline.md), [secret-scan-00007](../../plans/archived/secret-scan-00007.establish-detector-conformance-corpus.md), [secret-scan-00010](../../plans/archived/secret-scan-00010.define-incremental-scanning-semantics.md), and [secret-scan-00024](../../plans/archived/secret-scan-00024.qualify-stable-release-corpus.md)
