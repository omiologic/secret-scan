# Pre-release code and documentation review

[Documentation home](../README.md) · [Audit archive](README.md)

- Reviewed on: 2026-09-11.
- Base revision: `e32ec1f192dc997b906c21e5a62f962f23a54e1a`.
- Changes: local branch `fix/pre-release-review-docs`, on top of that revision.
- Scope: core candidate/overlap and redaction contracts; CLI reporting and host
  behavior; JavaScript initialization and artifact capabilities; Python Unicode
  indexing; consumer documentation and existing local validation gates.

## Result

The confirmed CLI reporting defect is fixed with a regression. Current consumer
claims now distinguish executable runtime support from exported API contracts
and qualified artifacts from published platform packages. A new documentation
hub organizes installation, language guides, common contracts, safety limits,
troubleshooting, and contributor instructions under `docs/`.

This is a local code and documentation review, not certification of a release
artifact or a claim that all historical backlog items have been resolved. No
version selection, commit, push, publication, tag, deployment, or live repository
configuration change is part of this work.

## Findings and changes

| Severity | Finding | Resolution and evidence |
| --- | --- | --- |
| Low | CLI paths containing line breaks or terminal controls can forge text records or alter terminal rendering. This also affects per-source error diagnostics. | `crates/secret-scan-cli/src/report.rs` escapes text identities. The new test failed on the original implementation and now passes for newline, carriage return, tab, ESC, NEL, Unicode line/paragraph separators, and literal backslashes; JSON source values still round-trip unchanged. Ordinary path output remains readable. This closes the implementation concern described as `C/F-01` in the older deferred backlog. |
| Medium | Root and npm READMEs presented working JavaScript incremental/stream examples, while both current artifacts reject session creation. | Removed non-working recipes, documented `INCREMENTAL_UNAVAILABLE` on both runtimes, and changed README checks to require supported examples and the explicit unavailable-factory contract. Whole-input example type checks remain. |
| Low | npm README claimed open-ended Node 20+ support, and architecture text implied a shipped musl addon. | Aligned consumer guidance with Node 20/22/24, six non-musl npm/CLI targets, and the separate qualification-only musl addons. |
| Low | Rust core README still named the removed TypeScript implementation as its oracle; workspace prose described an unnamed tooling package and a not-yet-existing corpus. | Replaced with the canonical conformance contract and actual private tooling identity. Corrected same-version retry versus new-version dependency publication wording. |
| Low | Rust `redact` rustdoc implied caller overlaps are resolved. | Clarified that findings are sorted and overlapping ranges rejected; behavior is unchanged and existing overlap tests pass. |
| Low | Python Unicode-index documentation claimed buffer-limit-bounded memory even though `observe` indexes the whole incoming chunk and deque capacity can retain the peak. | Corrected the source comment, binding README, and streaming guide; hosts are told to bound incoming chunks too. No allocator or retention behavior was changed. |
| Low | A JavaScript offset example logged a slice of the matched input. | Changed it to log range metadata and explicitly explain why the slice must not be logged. |
| Usability | Public docs were primarily packaging and audit records, with no consumer entry point. | Added `docs/README.md`, getting started, four runtime guides, safe integration, streaming, API/detection references, troubleshooting, contributing, and an audit archive index. Existing historical audit URLs and verdicts remain intact. |

## Validation

Executed locally on macOS arm64:

- Repository `npm run ci` gates, including declaration/governance checks,
  JavaScript types, 104 JavaScript tests, and 34 conformance-schema tests.
- `npm run rust:check`: 43 policy-check tests and zero workspace-policy errors.
- `cargo test --workspace --locked`: 450 tests passed across 20 suites.
- `cargo clippy --workspace --all-targets --locked -- -D warnings` and
  `cargo fmt --all --check` passed.
- `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps --locked` passed.
- Built the Python extension with maturin in an isolated CPython 3.12 environment;
  all 588 Python tests passed against that extension.
- Executed the three new Python guide examples, compiled and executed the Rust
  guide example, and checked the CLI quick-start output. Type-checked all three
  new TypeScript guide snippets; package README examples are covered by its
  existing test suite.
- Checked local Markdown file links and new/edited consumer-page heading links;
  checked patch whitespace with `git diff --check`.

## Remaining release and operational limits

The full native target matrix, real Node/WebAssembly consumer artifact
qualification, browser engines, wheel matrix, registry install verification,
MSRV toolchain run, dependency advisory freshness, SAST engine scan, and live
publisher/repository settings were not revalidated by this local review.
Repository script tests validate their declarations and guards, not the external
state. Run the [qualification workflow](../qualification.md) for the exact
approved release revision and follow the release authority before publication.

JavaScript streaming remains unavailable by design. Python's peak Unicode-index
allocation still depends on incoming chunk size. Whole-input operations still
need host resource limits, and `warn`/`allow` preserve text. `block` requires
host enforcement. These are now visible in consumer guidance rather than hidden
behind historical audit prose.

Earlier audit verdicts apply to their recorded revisions. The historical
[deferred quality backlog](deferred-quality-backlog.md) and
[detection evidence backlog](detection-assurance-residual-evidence-backlog.md)
were not exhaustively re-adjudicated here. The new CLI regression is concrete
exit evidence for its matching item, not evidence that every other item closed.

The documentation is portable Markdown, ready to become source input to a wiki
or static site. A site renderer, S3/CloudFront infrastructure, and deployment
remain future work; no deployment configuration was introduced.
