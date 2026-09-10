# Canonical conformance schema

This directory defines the top-level, language-neutral fixture schema and
UTF-8 range model required by
[`decision-govern-cross-language-conformance`](../docs/decisions/2026-09-09-govern-cross-language-conformance.md).
It is the eventual single behavioral contract for the Rust core and every
supported binding. It is not itself a detector implementation and does not
depend on `src/`.

## Files

- [`schema.ts`](./schema.ts) — canonical fixture types and
  `validateCanonicalFixtures`, a pure-data validator with input-free
  diagnostics (failures report only a fixture ID and a stable code, never
  fixture `input` or a matched substring).
- [`schema.json`](./schema.json) — the same shape as a JSON Schema
  (draft 2020-12) document, for validation from Rust, Python, or any other
  binding without a TypeScript toolchain. It documents, but cannot itself
  enforce, the cross-field invariants `schema.ts` checks (no overlapping
  expectations, ranges within input bounds); a conforming validator in any
  language must check both.
- [`convert.ts`](./convert.ts) — UTF-16 code unit <-> UTF-8 byte offset
  conversion, and the fixture-level translation from the temporary
  TypeScript oracle's corpus shape into the canonical schema.
- [`fixtures/unicode-astral.source.ts`](./fixtures/unicode-astral.source.ts) —
  fixtures with an astral (supplementary-plane) character positioned before,
  within, and after a finding, used to exercise the UTF-16/UTF-8 conversion
  at its most divergent case.
- [`fixtures/synchronous-corpus.json`](./fixtures/synchronous-corpus.json) —
  the full synchronous detector, exclusion, overlap, and adversarial-resource
  corpus (`test/conformance/corpus.ts`), migrated to canonical UTF-8 byte
  offsets by `scripts/migrate-conformance-corpus.ts`. This is the canonical
  corpus for detector behavior today; regenerate it with
  `npm run corpus:migrate -- conformance/fixtures/synchronous-corpus.json`
  whenever `test/conformance/corpus.ts` changes.
  `test/conformance/canonical-oracle.test.ts` fails if the two drift, and
  proves the current TypeScript implementation reproduces exactly this
  file's findings, per-detector specificity, and redacted output.
- [`fixtures/incremental-corpus.json`](./fixtures/incremental-corpus.json) —
  whole-input incremental references (`test/conformance/incremental-partitions.ts`),
  migrated to canonical UTF-8 byte offsets. A bounded incremental session
  must reproduce each fixture's `text` and `expected` findings identically at
  every UTF-16 code-unit and streaming UTF-8 byte partition of `input`;
  partitioning itself is generated deterministically by each binding runner,
  not stored as data. The Rust consumer is
  `crates/secret-scan-core/tests/incremental_partitions.rs`; see
  [Partition invariance](#partition-invariance) below.
- [`fixtures/unicode-conversion-corpus.json`](./fixtures/unicode-conversion-corpus.json) —
  `fixtures/unicode-astral.source.ts`, migrated to canonical UTF-8 byte
  offsets, persisted so every binding checks the same committed values
  rather than only an in-memory conversion.
- [`fixtures/incremental-lifecycle-corpus.json`](./fixtures/incremental-lifecycle-corpus.json) —
  lifecycle, abort, malformed-UTF-8, and buffer/token/multiline resource-limit
  scenarios (`fixtures/incremental-lifecycle.source.ts`), each an ordered,
  replayable operation sequence and its terminal outcome. Already canonical
  (there is no UTF-16 oracle shape to convert from); no fixture or outcome
  carries a matched value.
- [`fixtures/error-codes.json`](./fixtures/error-codes.json) — the safe,
  cross-language error-code registry (`fixtures/error-codes.source.ts`):
  every stable code the incremental sanitizer and its stream adapters can
  raise, paired with its fixed, input-free message.

`scripts/migrate-conformance-corpus.ts` migrates the synchronous detector
corpus; `scripts/migrate-incremental-corpus.ts` migrates the four files
above (`npm run corpus:migrate:incremental`). Both read the existing
TypeScript oracle, convert with `convert.ts`, validate with the matching
`schema.ts` validator, and write canonical JSON. See those scripts and the
decision record for why the TypeScript exporter is adapted rather than
retained as a second canonical source.
`test/conformance/canonical-incremental-oracle.test.ts` is the incremental
counterpart of `canonical-oracle.test.ts`: it fails if any of the four files
above drift from a fresh migration, and separately replays every lifecycle
fixture's operations against the real `createIncrementalSanitizer` and
`createStreamSanitizerRuntime` to prove the current TypeScript
implementation reproduces exactly the declared outcome.

## UTF-8 byte offset model

Canonical `expected[].start`/`end` are **UTF-8 byte offsets** into `input`
encoded as UTF-8 — the count of bytes that `TextEncoder().encode(input)`
would produce up to that position, not a UTF-16 code unit count and not a
Unicode scalar (code point) count. A byte offset must fall on a UTF-8 code
point boundary; an offset that would split a multi-byte encoded character is
invalid.

This differs from the temporary TypeScript oracle's fixtures
(`test/conformance/schema.ts`), which use UTF-16 code unit offsets matching
this package's public `start`/`end` semantics (`String.prototype.length`,
`.slice()`, `.indexOf()`). Each binding runner is responsible for converting
canonical UTF-8 byte offsets to its own native offset unit and verifying
that the converted span has the same meaning
(`decision-govern-cross-language-conformance`).

The divergence is largest for astral (supplementary-plane) characters: a
character above U+FFFF is exactly one UTF-16 surrogate pair (2 code units)
and exactly 4 UTF-8 bytes, versus a BMP character, which is exactly 1 UTF-16
code unit and 1–3 UTF-8 bytes. `fixtures/unicode-astral.source.ts` and the
conversion round-trip tests specifically exercise this case: an astral
character before a finding, one inside a finding's span, and one after a
finding.

## Safe expectations

A canonical expectation carries only `detector`, `type`, `confidence`,
`specificity`, `start`, and `end`. It has no field for the matched value.
Both validators (`schema.ts`'s closed key check and `schema.json`'s
`additionalProperties: false` on `#/$defs/expectation`) reject any
expectation object with an extra key — the fixture format itself has no way
to carry plaintext into a public expectation.

## Partition invariance

A bounded incremental session must accept exactly what the whole-input
pipeline accepts, however the caller divides the input. Each runner proves
this by enumerating partitions itself, over the fixtures in
`fixtures/incremental-corpus.json`:

- **Every UTF-8 byte boundary**, including byte indices inside a multi-byte
  code point. A core whose native string type cannot hold a partial code
  point (Rust's `&str`, JavaScript's `string`) reaches those indices through
  the same streaming decoder a byte-oriented host must place in front of it,
  which retains an incomplete sequence between chunks.
- **Every applicable host-native string boundary** — every `&str` char
  boundary in Rust, every UTF-16 code-unit boundary in JavaScript — plus the
  maximally fragmented partition of one chunk per unit.

At every one of those partitions the concatenated text, the findings and
their actions, their order, IDs and absolute ranges, and placeholder
numbering must equal the whole-input reference. Only the distribution of
safe output across `append` and `finalize` results may vary: feeding the
whole input in a single `append`, so that all finalized safe output
accumulates in one call, must accept exactly what the fragmented partitions
accept.

Two whole-input capabilities are outside the incremental API by
construction, and each runner records that rather than asserting an
equivalence that cannot exist: **custom synchronous detectors** (an
incremental session takes no registry, because a custom detector declares no
retention bound) and **whole-input count-dependent policies** (the
incremental policy context carries the finalized index but no total, because
a progressive evaluation cannot know the whole session's finding count).
See the `incremental` module documentation in the Rust core, and
`createIncrementalSanitizer`'s `INVALID_OPTIONS` rejection of a `detectors`
option in the TypeScript oracle.

## Adversarial resource caps

Every fixture in the `adversarial` tier of `fixtures/synchronous-corpus.json`
carries a `resource` object declaring `maxInputBytes`, `maxFindings`, and
`maxRuntimeMs`. A runner must assert all three, on the whole-input surface
and — where the language has one — on the incremental surface, including a
fragmented partition of the same input, since fragmentation is where an
implementation that rescans retained text degrades. The Rust consumer is
`crates/secret-scan-core/tests/adversarial_bounds.rs`; the TypeScript oracle
asserts the same caps in `test/conformance/conformance.test.ts`.

`maxInputBytes` and `maxFindings` are properties of the fixture and its
expected result, so every runner asserts them exactly. `maxRuntimeMs`
describes the shipped, optimized implementation. A runner whose default test
build is unoptimized may hold that build to a fixed, documented multiple of
the declared cap instead — the Rust runner allows 8x for a debug binary and
the declared cap exactly for an optimized one — but never to a value derived
from the machine it happens to run on. The caps exist to catch superlinear
blowup, which is orders of magnitude, not a constant factor.

## What this directory is not (yet)

This item defines the schema, the UTF-8 range model, migration tooling, and
the migrated synchronous, incremental, Unicode-conversion, and safe-error
corpora. The Rust core consumes the incremental and adversarial corpora
directly (see the two sections above); a full Rust or Python
detector-pipeline consumer for the whole synchronous corpus is a separate,
larger change tracked elsewhere. The existing TypeScript corpus
(`test/conformance/`) remains the executable behavioral oracle until the
Rust core reaches parity, and every JSON file under `fixtures/` remains a
derived artifact of it, not an independently authored source.

Unicode range conversion is asserted for all three of today's units, against
the exact fixture values in `fixtures/unicode-conversion-corpus.json`:
JavaScript's UTF-16 code units
(`conformance/convert.ts`, exercised by `test/conformance/conversion.test.ts`
and `canonical-incremental-oracle.test.ts`), Rust's native UTF-8 bytes
(`crates/secret-scan-core/src/types.rs`'s
`unicode_conversion_corpus_byte_offsets_are_char_aligned` test — Rust's
`RANGE_UNIT` is already bytes, so there is no conversion step, only a proof
that the canonical offsets are char-aligned and select the same substring),
and Python's Unicode code points
(`bindings/python/src/lib.rs`'s `byte_offset_to_char_offset` and its tests).

The `Artifact qualification` workflow adds three artifact-level consumers of the
synchronous corpus, each running it through a built artifact rather than
through the source tree: the N-API addon
(`scripts/qualify-node-addon.mjs`), the browser WebAssembly artifact in
Chromium, Firefox, and WebKit (`scripts/browser-harness.mjs`), and the CLI
(`scripts/qualify-cli-binary.mjs`, which compares against the corpus's own
UTF-8 byte offsets because the CLI reports that unit). The first two convert
canonical offsets to UTF-16 code units with a reference conversion
independent of the binding under test, as the Python runner does for code
points. See [docs/qualification.md](../docs/qualification.md).
