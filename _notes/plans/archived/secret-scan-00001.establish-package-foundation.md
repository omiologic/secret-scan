---
work_item_id: "secret-scan-00001"
title: "Establish the runtime-neutral package foundation"
depends_on: []
target_paths:
  - ".gitignore"
  - "package.json"
  - "package-lock.json"
  - "tsconfig.json"
  - "vitest.config.ts"
  - "src/types.ts"
  - "src/index.ts"
  - "test"
created_at: "2026-08-30T17:25:37Z"
updated_at: "2026-08-30T17:32:55Z"
---

# Establish the runtime-neutral package foundation

## Outcome

A TypeScript package skeleton compiles in browser-compatible and Node.js environments and exposes the safe public contracts needed by later detector, policy, and redaction work.

## Context

The repository currently describes the intended library but has no implementation scaffold. The core must remain side-effect free, runtime neutral, deterministic, and unable to expose plaintext secret values through public result types.

## Scope

### In scope

- Configure TypeScript, ESM packaging, declaration output, and Vitest.
- Define the initial detector, candidate, finding, policy, scan-option, and scan-result types without a public plaintext-value field.
- Establish browser-compatible exports and a minimal compile/test smoke check.

### Out of scope

- Detector implementations, policy behavior, redaction, CI, publication, version selection, or release operations.

## Implementation checklist

- [x] Add package and compiler configuration using runtime-neutral source settings.
- [x] Define public contracts and the minimum private candidate contract required by the architecture.
- [x] Export only the intended initial API surface.
- [x] Add smoke tests proving the package compiles without Node-only or DOM-only runtime dependencies.

## Acceptance criteria

- [x] TypeScript emits ESM JavaScript and declarations without source errors.
- [x] Public finding and result contracts contain classification, action, and original-input offsets but no plaintext secret value.
- [x] Browser-oriented and Node-oriented import smoke tests consume the same entry point.
- [x] Importing the package performs no logging, telemetry, network, filesystem, storage, or environment-dependent work.

## Verification

- [x] Run the configured typecheck, unit-test, and build commands.
- [x] Inspect emitted declarations and package exports for runtime-specific or plaintext-bearing fields.

## Completion record

- Result: Completed the runtime-neutral TypeScript package foundation with a type-only public entry point and safe detector, policy, finding, option, and result contracts.
- Evidence: `npm run typecheck`, `npm test`, and `npm run build` pass; browser bundling and Node import smoke tests consume `@omiologic/secret-scan`; emitted declarations and JavaScript contain no plaintext-value field or runtime-specific dependency.
- Follow-ups: `secret-scan-00002` can begin the deterministic candidate-processing pipeline.
