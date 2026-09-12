# Cross-language evaluation protocol

This directory defines the language-neutral evaluation protocol described by
[`decision-define-cross-language-evaluation-protocol`](../docs/decisions/2026-09-12-define-cross-language-evaluation-protocol.md):
a synthetic assessment corpus, a set of named workload profiles, and a common
result contract that every supported surface — the Rust core, Python, Node,
the browser WebAssembly artifact, and the CLI — reports through.

It is not the behavioral contract. [`conformance/`](../conformance/README.md)
remains the single executable contract every binding must pass to release.
This directory measures accuracy and performance against a shared contract
and is never itself a release gate; a low score here is a finding to act on,
not a build failure.

## Files

- [`schema.ts`](./schema.ts) — the canonical `AssessmentFixture`,
  `AssessmentWorkloadProfile`, and `AssessmentResult` types, plus
  `validateAssessmentFixtures`, `validateAssessmentWorkloadProfiles`, and
  `validateAssessmentResults`: pure-data validators with input-free
  diagnostics (failures report only a record identity and a stable code,
  never a fixture's `input` or any matched substring). Tested by
  [`schema.test.ts`](./schema.test.ts)
  (`npx vitest run assessment/schema.test.ts`), which also validates every
  file below against this schema.
- [`schema.json`](./schema.json) — the same shapes as a JSON Schema
  (draft 2020-12) document, for a validator in Rust, Python, or any other
  language without a TypeScript toolchain. It documents, but cannot itself
  enforce, the cross-field invariants `schema.ts` checks (accuracy/scale
  profile size and chunking rules, at-least-one-metrics-kind on a result); a
  conforming validator in any language must check both.
- [`generate.ts`](./generate.ts) — the deterministic, pure generator for a
  scale workload profile's input text. Nothing about a generated input is
  stored as data; a profile is its own complete, reproducible provenance
  (see [Deterministic workload generation](#deterministic-workload-generation)).
- [`fixtures/accuracy-corpus.json`](./fixtures/accuracy-corpus.json) — the
  reviewed synthetic accuracy corpus: hand-authored `logs`, `code`, `chat`,
  and `negative-text` fixtures, each with reviewed expected findings, UTF-8
  byte ranges, and the policy-aware outcome (`block`, `redact`, `warn`, or
  `allow`) the shipped default policy applies.
- [`fixtures/workload-profiles.json`](./fixtures/workload-profiles.json) —
  named workload profiles spanning both purposes
  (see [Accuracy is not scale](#accuracy-is-not-scale)), every category, a
  range of target input sizes and densities, every chunk profile, and both
  ASCII and non-ASCII filler mixes.
- [`fixtures/result-contract-examples.json`](./fixtures/result-contract-examples.json) —
  tiny known-answer example result records, one per surface plus one
  performance example, proving the result contract round-trips through the
  schema. These are illustrative shapes, not real measurements.

## UTF-8 byte offset model

`fixtures[].expected[].start`/`end` are **UTF-8 byte offsets** into `input`,
on the same terms as [`conformance/README.md`'s UTF-8 byte offset
model](../conformance/README.md#utf-8-byte-offset-model). A runner comparing
its own native offsets against this corpus normalizes both sides to UTF-8
byte ranges first, then verifies the converted span selects the same
original substring in its own native units. `fixtures/accuracy-corpus.json`'s
`logs-unicode-astral-boundary` fixture places an astral character immediately
before a finding — the case where UTF-16 and UTF-8 offsets diverge most, the
same boundary `conformance/fixtures/unicode-astral.source.ts` exercises.

## Safe expectations

An `AssessmentExpectation` carries only `detector`, `type`, `confidence`,
`specificity`, `start`, `end`, and `policyOutcome` — no field for the matched
value. Both validators (`schema.ts`'s closed key check and `schema.json`'s
`additionalProperties: false` on `#/$defs/expectation`) reject any expectation
object with an extra key. Every fixture `input` is unmistakably synthetic or
revoked; the corpus's only synthetic secret shape is
`token=ghp_ASSESSMENTSYNTHETIC0000000000000000`, distinct from any string used
in `conformance/`, on the same [fixture safety review](../conformance/README.md#fixture-safety-review)
terms.

## Accuracy is not scale

Every workload profile declares a `purpose`: `"accuracy"` or `"scale"`.
`validateAssessmentWorkloadProfiles` enforces the separation `schema.ts`
documents: an accuracy profile stays at or under `ACCURACY_MAX_INPUT_BYTES`
(4096 bytes) and is always fed as a single `"whole"` call, so measuring
accuracy never contends with, or is distorted by, chunking or timing
overhead. A scale profile is always larger, and exists to measure
initialization, processing time, throughput, repeated-run variance, and peak
memory — never to also serve as an accuracy sample. This keeps the two kinds
of measurement from contaminating each other, per
[the governing decision](../docs/decisions/2026-09-12-define-cross-language-evaluation-protocol.md).

## Deterministic workload generation

A scale workload profile's input text is never committed as data — only the
profile's parameters (`category`, `targetInputBytes`, `targetDensityPerKiB`,
`unicodeMix`, `generatorAlgorithm`) are. `generateWorkloadInput` is a pure
function of exactly those fields: constant filler lines per category (ASCII
or non-ASCII, selected by `unicodeMix`), with the one constant synthetic
secret line inserted every N lines to approximate the target density.
`schema.test.ts` proves this two ways:

- **Determinism**: regenerating any committed profile's input twice produces
  a byte-identical string, and its size meets the profile's declared target.
- **Known-answer cases**: a zero-density profile emits only the filler line
  used, and an overwhelming-density profile emits only the synthetic secret
  line — both spelled out verbatim in `schema.test.ts` so a reviewer can
  confirm the generator's exact output by eye without running it.

Every committed scale profile in `fixtures/workload-profiles.json` targets at
most 1 MiB, so regenerating and asserting on every profile completes in a
fraction of a second; there is currently no profile a reviewer needs to
inspect before running because none is close to taking five minutes to
generate or check. A future profile that would take that long must be
inspected before it is proposed, on the terms `AGENTS.md` sets for any
command expected to run that long.

`chunkProfile` (`"whole"`, `"fixed-1024"`, `"fixed-4096"`, `"fixed-65536"`, or
`"utf16-boundary"`) is not applied by the generator — a runner partitions the
generated text itself when it drives a streaming or incremental API, the
same way `conformance/README.md`'s
[Partition invariance](../conformance/README.md#partition-invariance) section
keeps partitioning out of stored fixture data.

## Common result contract

`AssessmentResult` is the one shape all five surfaces report through:
`schemaVersion`, `surface`, the `profileId` it ran, either `accuracy`
(`truePositives`, `falsePositives`, `falseNegatives`, `policyMismatches`) or
`performance` (`initializationMs`, `processingMs`,
`throughputBytesPerSecond`, `repetitionRuns`, `repetitionStdDevMs`,
`peakMemoryBytes`) — or both — and a `provenance` block recording exactly
what produced the number: `commit` (full source SHA), `artifactIdentity`
(the exact built artifact, e.g. a package name and version), `corpusVersion`
and `corpusHash` (which revision of this corpus ran), `os`, `cpu`, `runtime`,
and the exact `command` invoked. A result with no reproducible provenance is
not evidence.

## Node and browser accuracy runners

- [`adapters/scoring.ts`](./adapters/scoring.ts) — pure accuracy scoring:
  `scoreFixture` compares one fixture's real findings against its reviewed
  `expected` array and returns `AssessmentAccuracyMetrics` plus safe,
  fixture-id-keyed `AccuracyMismatch` diagnostics (`missing`, `extra`, or
  `policy-mismatch`; a wrong-range finding surfaces as one of each rather
  than needing special handling). `aggregateAccuracyMetrics` sums per-fixture
  metrics across the corpus, and `runAccuracyFixtures` drives a `scan`
  function over every fixture — the one corpus-iteration path every
  surface's runner shares, so "what counts as a match" cannot drift between
  them. A `scan` rejection propagates out rather than being absorbed into a
  zero-finding result, so an evaluation that could not finish is never
  reported as one that finished and found nothing. Tested by
  [`adapters/scoring.test.ts`](./adapters/scoring.test.ts) with tiny fixtures
  exercising each kind of mismatch, every policy action, and UTF-8/UTF-16
  Unicode normalization.
- [`adapters/report.ts`](./adapters/report.ts) — renders one surface's
  `AssessmentResult` and its mismatches as Markdown, the common
  human-readable counterpart to the JSON result contract. Never receives a
  fixture's `input`, so it is safe to print or write to a file unmodified.
- [`../scripts/assessment-run.mjs`](../scripts/assessment-run.mjs) —
  command-line runnable: evaluates the real, installed `@redact-secret/core`
  package on Node against `fixtures/accuracy-corpus.json` and emits a
  conforming `"node"`-surface `AssessmentResult` (`node scripts/assessment-run.mjs`,
  or `npm run assessment:node`). It drives the package's public API the same
  way `scripts/qualify-node-addon.mjs`'s `integrateWithPackage` pass does,
  and does no building or linking of its own — a missing package build or
  native addon fails loudly (a distinct, non-zero exit) rather than reporting
  a false zero-finding success.
- [`../scripts/assessment-browser-run.mjs`](../scripts/assessment-browser-run.mjs) —
  the same evaluation against the real browser WebAssembly artifact in a
  real engine (`node scripts/assessment-browser-run.mjs [--engine chromium|firefox|webkit]`,
  or `npm run assessment:browser`), staged and served the same way
  `scripts/qualify-browser-artifact.mjs` qualifies the artifact.
  [`../scripts/assessment-browser-harness.mjs`](../scripts/assessment-browser-harness.mjs)
  is the in-page module it bundles with the published package aliased to the
  real artifact, on the same terms `scripts/browser-package-harness.mjs`
  does for conformance.
- Both runners accept `--json-out <path>` (default: stdout),
  `--markdown-out <path>`, and `--mismatches-out <path>` (the safe mismatch
  list, omitted by default), and `--strict` to exit non-zero when any
  mismatch is found — off by default, since a low score here is a finding to
  act on, per [Common result contract](#common-result-contract), not a
  build failure. Every fixture is synthetic or explicitly revoked, and
  neither runner's output carries a fixture's `input` or a matched value.

## What this directory is not (yet)

This item defines the schema, the corpus, the workload profiles, and the
result contract — the common language every surface's evaluation reports
through. The Node and browser WebAssembly runners above are the first two of
the five per-surface runners that execute a profile, collect real `accuracy`
or `performance` metrics, and emit a conforming `AssessmentResult`; a Rust,
Python, and CLI runner, and every surface's `performance` (scale) runner, are
separate, larger work tracked elsewhere, on the same terms
`conformance/README.md`'s "What this directory is not (yet)" section
describes for the behavioral contract. This directory adds no runtime
instrumentation, telemetry, or public API to any product surface; `secret-scan-core`
stays side-effect free.

## Out of scope

Per the governing decision: a web UI for browsing results, comparisons
against competing products, new language bindings, and any release,
versioning, or publication action. Producing or reporting a result is not a
release gate and does not by itself authorize any release action; see
`AGENTS.md`'s release authority section.
