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

## Scope

This is the baseline, plus the evidence model that defines what a row needs
to resolve honestly:

- [`evidence-requirements.md`](./evidence-requirements.md) — the minimum
  evidence dimensions per behavior class and the bounded-rationale exception
  rule (issue [#102](https://github.com/omiologic/secret-scan/issues/102)),
  applied against every row of `detector-inventory.json` and `consumers`.

It does not yet:

- encode coverage declarations into the canonical corpus schema itself
  (issue [#103](https://github.com/omiologic/secret-scan/issues/103)), or
- make coverage drift a CI failure (issue
  [#104](https://github.com/omiologic/secret-scan/issues/104)) — neither
  script here is wired into `npm run ci` yet, deliberately.
