---
work_item_id: "secret-scan-00008"
title: "Handle encoded connection credentials"
depends_on:
  - "secret-scan-00007"
target_paths:
  - "src/detectors/connection-string.ts"
  - "test/conformance"
  - "test/detectors/contextual.test.ts"
  - "test/false-positives"
  - "_notes/features/contextual-detection/README.md"
created_at: "2026-08-30T18:41:34Z"
updated_at: "2026-08-30T18:57:13Z"
---

# Handle encoded connection credentials

## Outcome

Credential-bearing URLs in the currently supported schemes detect correctly bounded password spans when userinfo contains percent encoding or valid host syntax that the existing structural matcher cannot safely handle.

## Context

Connection credentials are a current contextual-detection feature, but strict matching can miss encoded delimiters and realistic IPv6 or port forms. Broader parsing increases false-positive and offset risks, so this item stays within the existing scheme allowlist and preserves original JavaScript string offsets.

## Scope

### In scope

- Support percent-encoded userinfo and valid IPv6/port host forms for currently supported connection schemes.
- Select only the original-input password range without decoding, copying, or returning it.
- Preserve precision for ordinary URLs, incomplete userinfo, placeholders, references, and malformed percent escapes.
- Document the resulting false-positive and false-negative boundary.

### Out of scope

- New URI schemes, URL validation as a service, secret liveness checks, query-string credentials, or changes to policy defaults.

## Implementation checklist

- [x] Add conformance cases for encoded delimiters, Unicode-adjacent text, IPv6 hosts, ports, malformed escapes, and missing password components.
- [x] Refine parsing while preserving runtime neutrality and bounded work.
- [x] Verify exact original-input offsets before and after overlap resolution.
- [x] Add adversarial length and malformed-URL cases.
- [x] Update contextual-detection documentation and tradeoffs.

## Acceptance criteria

- [x] Supported connection URLs with encoded non-empty passwords yield exactly the password span from the original input.
- [x] Decoding never causes offsets to reference transformed text.
- [x] Ordinary URLs and malformed or credential-free userinfo remain unchanged.
- [x] Existing connection-string cases retain identical findings.
- [x] Findings, errors, fixtures, and snapshots do not expose detected plaintext.

## Verification

- [x] Run contextual, conformance, overlap, false-positive, adversarial-input, typecheck, build, and complete CI checks.
- [x] Inspect offset assertions and failure output for transformed-offset or plaintext leakage.

## Completion record

- Result: Completed. Connection authorities now support valid percent-encoded userinfo, bracketed IPv6 hosts, and numeric ports while selecting only the undecoded original-input password span.
- Evidence: Focused contextual, conformance, overlap, and false-positive checks passed (119 tests); `npm run ci` passed typecheck, production build, and all 180 tests across 14 files. The conformance corpus includes encoded/Unicode/IPv6/port offsets plus malformed and fixed-bound adversarial authorities, with input-free failure diagnostics.
- Follow-ups: None. `secret-scan-00010` remains blocked on open dependency `secret-scan-00009`.
