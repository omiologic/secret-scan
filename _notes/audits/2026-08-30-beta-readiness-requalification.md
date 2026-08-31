# Beta readiness requalification

## Executive verdict

**READY FOR BETA APPROVAL**

All mandatory pre-beta gates from the 2026-08-30 audit are closed on the
audited working-tree snapshot. Clean-install CI passes on Node 20 and 22, the
remediation and adversarial suites pass, scaling is within the declared gates,
the inspection-only package surface is coherent, and the dependency and
governance checks are clean.

This is technical readiness evidence, not release authority. No version was
selected, and no branch, commit, tag, release, publication, deployment, or
release-channel change was performed.

## Audited snapshot

- Evaluation date: 2026-08-30 in `America/New_York`.
- Host: macOS 26.5.2, arm64, 24 GiB memory.
- Repository `HEAD`: `7f8ff1f2a4876f953e352a7a46e0d576ecbfddde`.
- Product snapshot hash:
  `5661018390f38b75f08c2646bb183a7f00b8df3ca4777a45c724a23f6ccea8b2`.
- Snapshot scope: every tracked or non-ignored repository file except
  `.agents/**` and `_notes/**`; generated `dist`, installed dependencies, and
  audit/lifecycle evidence are outside the product hash.
- Stability: the product hash matched before and after the final evaluation.

The first clean-copy attempt exposed a test-infrastructure integration defect:
the no-emit test typecheck tried to resolve package self-imports through an
emitted `dist` tree that does not exist after a clean install. The test compiler
configuration now maps the root, Node, and Web package names to their source
entry points for no-emit checking. Runtime tests continue to consume the built
package. The audit was restarted after that change; no product file changed
during the final evaluation recorded here.

## Prior finding disposition

| Finding | Disposition | Final evidence |
| --- | --- | --- |
| SS-AUD-001 | Closed | Escape-aware bounded contextual lexing replaces the complete encoded value or rejects the complete candidate. Structured contextual and redaction regressions pass in [contextual.test.ts](../../test/detectors/contextual.test.ts) and [policy-redaction.test.ts](../../test/integration/policy-redaction.test.ts). |
| SS-AUD-002 | Closed | Interval-aware overlap resolution, indexed placeholder exclusion, and the one-pass PEM parser pass the permanent scaling suite. A 50,000-finding scan completed in 64.3 ms on Node 22 and 74.1 ms on Node 20; a 1 MiB repeated-header scan completed in 7.1 ms and 6.9 ms respectively. |
| SS-AUD-003 | Closed | The 400-code-unit reproduction succeeds as one chunk, 20 chunks, and every two-way UTF-16 split. Mixed line-ending, Unicode, exact-limit, and failure-code partition cases pass in [incremental-semantics.test.ts](../../test/integration/incremental-semantics.test.ts). |
| SS-AUD-004 | Closed | Qualified GitHub and GitLab families, MongoDB seed lists, Redis password-only authorities, and AWS contextual names pass detector, conformance, malformed, boundary, overlap, and incremental cases. Scope and false-negative tradeoffs are explicit in the [known-format](../features/known-format-detection/README.md) and [contextual](../features/contextual-detection/README.md) qualification notes. |
| SS-AUD-005 | Closed | Nested, repeated, out-of-order, and mismatched supported PEM delimiters produce one conservative outermost blocked finding; the repeated-header parser scales linearly. |
| SS-AUD-006 | Closed | Permanent Node and Web tests cover native backpressure, normal close, destruction, readable cancellation, writable abort, explicit abort, downstream failure, malformed UTF-8 after finalized output, and competing or repeated terminal calls. |
| SS-AUD-007 | Closed | Placeholder validation covers every non-empty replaced range that can fit in a placeholder, including one-, two-, and three-code-unit caller-supplied findings. |
| SS-AUD-008 | Closed | The reviewed root surface excludes the incremental lookaround constant; runtime exports, declarations, package contents, README, architecture, security policy, feature notes, and Unreleased changelog agree. |
| SS-AUD-009 | Closed as non-blocking hardening | CI action references are immutable 40-character revisions, workflow permissions are minimized, checkout credentials are not persisted, and clean installation disables dependency lifecycle scripts. |

## Runtime and regression evidence

Both runtime checks used fresh temporary copies without `node_modules` or
`dist`. Installation used the repository's required `--ignore-scripts`
supply-chain boundary.

| Runtime | npm | Clean install | `npm run ci` |
| --- | --- | --- | --- |
| Node 20.20.2 | 11.4.1 | 146 packages installed; 0 vulnerabilities reported | 17 files and 357 tests passed after typecheck and build |
| Node 22.16.0 | 11.4.1 | 146 packages installed; 0 vulnerabilities reported | 17 files and 357 tests passed after typecheck and build |

A separate focused run of the structured-value, provider, conformance,
partition, redaction, adapter, performance, package, browser, Node, and README
suites passed 298 tests across 12 files.

### Scaling measurements

Measurements are single-process observations on the audit host, not general
consumer service-level objectives. The permanent tests retain generous
deterministic failure thresholds.

| Case | Node 20.20.2 | Node 22.16.0 | Result |
| --- | ---: | ---: | --- |
| Dense 12,500 findings | 23.6 ms | 24.7 ms | Pass |
| Dense 25,000 findings | 36.9 ms | 32.0 ms | Pass |
| Dense 50,000 findings / 1,000,000 code units | 74.1 ms | 64.3 ms | Pass |
| Largest dense-run heap growth | 29.9 MiB | 41.8 MiB | Pass; below the 128 MiB gate |
| Repeated PEM headers, 256 KiB | 2.8 ms | 2.4 ms | Pass |
| Repeated PEM headers, 512 KiB | 4.6 ms | 3.9 ms | Pass |
| Repeated PEM headers, 1 MiB | 6.9 ms | 7.1 ms | Pass |
| Incremental repeated PEM headers, 1 MiB | 326.9 ms | 333.4 ms | Pass; no output before finalization |
| Ordinary input, 1 MiB | 5.3 ms | 5.3 ms | Pass |

Dense doubling ratios stayed between 1.30x and 2.01x; repeated-PEM doubling
ratios stayed between 1.50x and 1.82x. Both remain below the permanent
`3.25x + 50 ms` scaling guard.

## Package and public-contract inspection

An actual `0.0.0-inspection` tarball was built only in a temporary copy. It
contained 102 intended entries, was 54,932 bytes packed and 219,840 bytes
unpacked, and included compiled JavaScript, declarations, source maps, and the
six intended documentation/license files. It excluded source, tests, planning,
agent, and CI files.

- Root, Node-stream, and Web-stream imports from the installed tarball passed.
- Runtime export review found exactly 27 root values and 3 values on each
  stream subpath.
- A strict external TypeScript declaration consumer covering the root and both
  stream subpaths passed.
- The root browser bundle used 21 inputs and emitted 42,676 bytes; the Web
  bundle used 22 inputs and emitted 54,944 bytes. Neither graph contained a
  `node:` input or the Node-stream adapter.
- The repository manifest still has no `version`. The inspection identifier
  existed only in the removed temporary copy.
- The final `Unreleased` changelog describes the package surface and security
  changes without selecting a version or implying publication.

## Dependency, CI, documentation, and governance evidence

- `npm audit --package-lock-only` reported zero known vulnerabilities at audit
  time.
- The lockfile is version 3 with 147 package entries; every non-root entry has
  registry resolution and integrity metadata. The three declared install-script
  packages were identified, and clean installs did not execute their scripts.
- The CI workflow parses as YAML, uses the reviewed immutable checkout and
  setup-node revisions, denies workflow permissions by default, grants only
  job-level content read access, avoids persisted checkout credentials, and
  installs with `npm ci --ignore-scripts`.
- Scanning the workflow and security policy produced zero findings.
- The root and feature documentation set has 11 documents with no broken local
  links. Public API, package contents, runtime claims, security boundaries, and
  the Unreleased changelog are internally coherent.
- `git diff --check` passed.
- Governance and plan validation each completed with 0 errors and 0 warnings.
- All temporary clean-copy, package, consumer, and diagnostic artifacts were
  removed.

## Residual risk and authority

No mandatory beta blocker remains. The documented precision/recall tradeoffs,
trusted-extension boundary, caller-owned whole-input resource limits, modern
browser baseline, provider requalification cadence, and absence of CommonJS
remain accepted package boundaries rather than audit failures.

The vulnerability result and provider qualifications are time-sensitive and
must be refreshed for the eventual release snapshot. A release still requires
explicit user approval after this evidence, the public API, and the Unreleased
changelog are reviewed. This audit does not provide that approval.
