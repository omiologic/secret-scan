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

`scripts/migrate-conformance-corpus.ts` is migration tooling built on this
directory: it reads the existing TypeScript corpus
(`test/conformance/corpus.ts`), converts it with `convert.ts`, validates the
result with `validateCanonicalFixtures`, and writes canonical JSON. See that
script and the decision record for why the TypeScript exporter is adapted
rather than retained as a second canonical source.

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

## What this directory is not (yet)

This item defines the schema, the UTF-8 range model, and migration tooling.
It does not migrate the full existing corpus, and it does not add a Rust or
Python consumer — those are separate, larger changes tracked elsewhere. The
existing TypeScript corpus (`test/conformance/`) remains the executable
behavioral oracle until the Rust core reaches parity.
