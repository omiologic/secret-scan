# Detector/finding-type/policy/consumer coverage baseline

The deterministic baseline issue [#101](https://github.com/omiologic/secret-scan/issues/101)
(tracking-key `dacd-f1-t1`, under Epic [#96](https://github.com/omiologic/secret-scan/issues/96))
asks for: one inventory row per built-in detector and emitted finding type,
each distinguished as `supported`, `intentionally-unsupported`,
`not-applicable`, or `unresolved`, without treating a raw fixture count as
sufficient coverage evidence.

## Files

- [`detector-inventory.json`](./detector-inventory.json) — the hand-authored
  declared baseline: every finding type the built-in registry
  (`crates/secret-scan-core/src/detectors`) can emit, its owning detector id,
  its default-policy classification (`crates/secret-scan-core/src/policy.rs`),
  its accepted schemes where the finding type has any, and a
  `reconciliationTrigger` synthetic input already shipped verbatim elsewhere
  in the crate's own source. Reconciled against the real registry and
  `DefaultPolicy` — through the crate's public API only — by
  `crates/secret-scan-core/tests/detector_inventory.rs`
  (`cargo test -p secret-scan --test detector_inventory`). Edit this file
  when a detector, its finding type(s), or its policy class changes; the
  Rust test fails the next `cargo test` run if this file falls out of sync.
- [`inventory-report.json`](./inventory-report.json) — the generated join of
  the baseline above with the canonical corpus
  (`conformance/fixtures/synchronous-corpus.json`) and the declared runtime
  consumers, produced by
  [`scripts/generate-coverage-inventory.py`](../../scripts/generate-coverage-inventory.py).
  Regenerate it after changing either input:

  ```sh
  python3 -B scripts/generate-coverage-inventory.py --out docs/coverage/inventory-report.json
  ```

  The generator is deterministic (sorted keys, no timestamps, no fixture
  `input` or matched values) and exits non-zero only on structural drift — a
  declared detector missing from the corpus, a corpus detector missing from
  the declaration, or a declared consumer path that no longer exists.
  Reporting a row as `unresolved` is not an error: it is the baseline
  honestly stating that a reachable finding type or scheme currently has no
  positive corpus evidence and no documented reason to be exempt (see
  `authorization_credential`, tracked separately as `C/F-03` in
  [`docs/audits/deferred-quality-backlog.md`](../audits/deferred-quality-backlog.md)).

Tests: `python3 -B -m unittest discover -s scripts/tests -p 'test_generate_coverage_inventory.py'`.

- [`coverage-declarations.json`](./coverage-declarations.json) — the
  evidence-requirements model (below) encoded and machine-validated: one
  `CanonicalCoverageDeclaration` row per declared finding type, the
  cross-cutting `incremental` surface, and each declared consumer, with every
  evidence dimension resolved to `supported`, `not-applicable`, or `pending`
  per `evidence-requirements.md`'s requirement matrix and bounded exception
  codes (issue [#103](https://github.com/omiologic/secret-scan/issues/103),
  tracking-key `dacd-f1-t3`). Produced deterministically by
  [`scripts/generate-coverage-declarations.py`](../../scripts/generate-coverage-declarations.py)
  from `detector-inventory.json` and the canonical corpus — the same "migrate
  the existing fixture files into the new schema without hand-authored
  duplication" approach `conformance/convert.ts` used for the UTF-16 → UTF-8
  migration. Regenerate it after changing any input:

  ```sh
  python3 -B scripts/generate-coverage-declarations.py --out docs/coverage/coverage-declarations.json
  ```

  The declarations validate against
  [`conformance/schema.ts`](../../conformance/schema.ts)'s
  `validateCanonicalCoverageDeclarations`, which rejects an unknown detector
  or type, a row missing a dimension its behavior class requires, a stale
  evidence id, a contradictory state/exception pairing, and an exception
  whose reference does not resolve to a real, itself-`supported` dimension.

  Tests: `python3 -B -m unittest discover -s scripts/tests -p 'test_generate_coverage_declarations.py'`
  and `npx vitest run conformance/schema.test.ts` (also validates every other
  canonical fixture file against the schema, and re-runs the generator twice
  to prove the migration is deterministic).

## Scope

This is the baseline, the evidence model that defines what a row needs to
resolve honestly, and that model encoded as data:

- [`evidence-requirements.md`](./evidence-requirements.md) — the minimum
  evidence dimensions per behavior class and the bounded-rationale exception
  rule (issue [#102](https://github.com/omiologic/secret-scan/issues/102)),
  applied against every row of `detector-inventory.json` and `consumers`.
- `coverage-declarations.json` and `conformance/schema.ts`'s coverage-
  declaration types (above) — that model, machine-validated (issue #103).

It does not yet make coverage drift a CI failure (issue
[#104](https://github.com/omiologic/secret-scan/issues/104)) — none of the
scripts here are wired into `npm run ci` yet, deliberately.
