# Canonical core, conformance, and CLI boundary review

An independent review of the release candidate across the canonical Rust core
(`crates/secret-scan-core`), the shared conformance contract
(`conformance/`), and the command-line host boundary
(`crates/secret-scan-cli`), required by issue #63 under Feature #61 and
Epic #60.

- **Assessed revision:** `c616e113433ba17d378493e4e4af1b67c4089ef5`
  (merge of PR #67, *Closed-issue acceptance evidence ledger*).
- **Assessed on:** 2026-09-09.
- **Scope:** the three areas issue #63 names. JavaScript and Python bindings
  and package contracts belong to #64; CI, release automation, documentation,
  and supply-chain controls belong to #65.
- **Authority:** this review records evidence. It does not change behavior,
  authorize implementation changes, or authorize any release operation.
  Disposition of these findings belongs to #66.

## Method and cost policy

Every claim below is either a span in the tree at the assessed revision, the
output of a check that already exists in the repository, or a minimal
synthetic reproduction run for this review and recorded verbatim. Nothing is
inferred from a document alone.

What was run:

| Check | Result |
|---|---|
| `cargo test --workspace` | 388 passed, 16 suites, 14.27s |
| `npm run ci` (decisions:validate + typecheck + build + vitest) | pass |
| `cargo build --release -p secret-scan-cli` | used for every CLI reproduction |
| One temporary partition-invariance probe (F-05), removed after measuring | 0 divergent |
| `secret-scan` check mode over this document and the two files it touches | 0 findings |

No long-running workflow was dispatched. Reproductions use inputs sized to the
property under test — the smallest input that can exhibit it — not to any
notion of realistic volume.

No entry reproduces a matched value, a fixture input, or a credential-shaped
string — the reproductions below construct their synthetic token in the shell
rather than embedding it, so this document scans clean against the tool it
reviews. Detector ids, finding types, error codes, and byte offsets are safe
metadata and are used freely. Every reproduction input below is unmistakably
synthetic.

## Classification vocabulary

This review reuses the vocabulary of
[the closed-issue acceptance evidence ledger](./closed-issue-acceptance-evidence-ledger.md)
so #66 can consolidate both without translation.

| Class | Meaning |
|---|---|
| `evidence-gap` | The behavior appears correct but no deterministic, recorded check binds it at the asserted scope. |
| `new-risk` | A risk no closed issue's criteria anticipated, surfaced while reviewing. |
| `stale-claim` | A statement the tree itself now contradicts. |

Severity is this review's reading of release impact. Epic #60 and issue #66
decide what blocks.

## Summary

Eight findings. None is a detection, redaction, policy-separation, or
plaintext-safety defect: the core's security-relevant behavior held under
every reproduction attempted, including an extension of partition invariance
to 170 corpus fixtures that no committed test currently covers.

| ID | Class | Severity | Area | One line |
|---|---|---|---|---|
| [F-01](#f-01--new-risk--the-check-report-interpolates-a-source-identity-without-escaping-it) | `new-risk` | low, non-blocking | CLI | A path containing a newline injects forged lines into the text report and the stderr diagnostics. |
| [F-02](#f-02--new-risk--the-streamed-and-whole-file-paths-disagree-above-the-token-limit) | `new-risk` | low, non-blocking | CLI | One logical line above 1 MiB exits `0` by path and `2` on standard input; the parity test pins only 64 KiB. |
| [F-03](#f-03--evidence-gap--authorization_credential-has-a-policy-entry-and-no-fixture) | `evidence-gap` | medium | conformance | A reachable finding type with its own always-redact policy entry has zero fixtures in the canonical corpus. |
| [F-04](#f-04--evidence-gap--nothing-binds-the-built-in-type-names-to-the-default-policy) | `evidence-gap` | medium | core | A new provider detector's type silently degrades to `warn`; no check would notice. |
| [F-05](#f-05--evidence-gap--partition-invariance-is-proven-over-16-fixtures-and-holds-over-170) | `evidence-gap` | low | core | Partition invariance holds over the whole synchronous corpus; only the 16-fixture incremental corpus asserts it. |
| [F-06](#f-06--stale-claim--the-shipped-crate-documents-itself-as-not-yet-conformant) | `stale-claim` | medium | core | The crate's own rustdoc, which reaches docs.rs on publish, says the Rust core has not yet passed the shared corpus. |
| [F-07](#f-07--evidence-gap--the-full-synchronous-corpus-reaches-the-rust-core-only-through-the-python-wheel-job) | `evidence-gap` | low | conformance | `ci.yml` never asserts the canonical synchronous corpus against the Rust core. |
| [F-08](#f-08--new-risk--the-contract-names-its-offset-unit-two-ways) | `new-risk` | low, cosmetic | conformance | The corpus declares `utf8-byte`; every runtime reports `utf8-bytes`. |

## What was reviewed and found sound

Recorded so an absent finding is not read as an absent review. Each line names
the span checked and the evidence that settles it.

### Criterion 1 — detection, validation, ordering, policy, redaction, ranges

- **Deterministic detection.** Candidate ranking is a total order:
  `crates/secret-scan-core/src/pipeline.rs:30-38` sorts on specificity,
  confidence, span width, registry order, then emission order, and the last
  two keys are unique per candidate, so `sort_unstable_by` cannot reorder
  equals. The only hash container in the core
  (`crates/secret-scan-core/src/incremental.rs:535`) is used for lookup by id
  and never iterated into output, so no result depends on hash order.
  `crates/secret-scan-core/tests/adversarial_bounds.rs:137-145` asserts
  run-to-run equality over the adversarial tier.
- **Candidate validation.** `crates/secret-scan-core/src/pipeline.rs:41-71`
  rejects a malformed type identifier, a range outside the input, a range off
  a character boundary, and — the non-obvious one — a range whose matched
  text equals its own type or detector id, which would let a public field
  mirror input. `ByteRange::new`
  (`crates/secret-scan-core/src/types.rs:189-195`) makes an empty or reversed
  range unconstructible.
- **Overlap ordering.** Greedy acceptance over a `BTreeMap` keyed by start
  offset (`crates/secret-scan-core/src/pipeline.rs:93-101`); because accepted
  spans are disjoint, the greatest start below the candidate's end is the only
  one that can overlap, and the unit test at
  `crates/secret-scan-core/src/pipeline.rs:263-278` pins the adjacency edges.
- **Policy separation.** `Policy::evaluate`
  (`crates/secret-scan-core/src/types.rs:600-612`) receives a
  `DetectedFinding` and a `PolicyContext` and nothing else. Neither type can
  reach the input: `DetectedFinding` holds five scalar/identifier fields
  (`crates/secret-scan-core/src/types.rs:362-368`) and `PolicyContext` holds
  two indices. The default policy
  (`crates/secret-scan-core/src/policy.rs:39-51`) branches only on type name
  and confidence.
- **One-pass redaction.** `redact`
  (`crates/secret-scan-core/src/redact.rs:177-212`) establishes ordering and
  disjointness first, then walks the input once with a single cursor.
  Placeholder safety is enforced by the core, not the formatter: empty,
  oversized, and matched-value-reproducing placeholders are all rejected
  (`crates/secret-scan-core/src/redact.rs:201-206`), with the reproduction
  index built at `crates/secret-scan-core/src/redact.rs:67-80`.
- **Public byte-range semantics.** Ranges index the *original* input, never
  the sanitized text, and `ScanResult`'s own doc comment carries the
  executable proof (`crates/secret-scan-core/src/types.rs:507-533`).
  Reproduced end to end through the CLI with an astral character ahead of the
  finding:

  ```console
  $ TOKEN="ghp_$(printf 'SYNTHETICREVOKED%020d' 0)"   # 40 chars, synthetic, revoked-shaped
  $ printf '\xf0\x9f\x94\x91 API_KEY=%s\n' "$TOKEN" > astral.txt
  $ secret-scan astral.txt
  astral.txt:13-53 github_token detector=github-token confidence=high action=redact id=finding-1
  ```

  13 is the UTF-8 byte offset; the same position is 11 in UTF-16 code units
  and 10 in code points, so the reported unit is unambiguously the declared
  one.

### Criterion 2 — partition invariance, limits, lifecycle, input-free failures

- **Partition invariance.** `crates/secret-scan-core/tests/incremental_partitions.rs:155-196`
  enumerates *every* host-native `&str` boundary and *every* UTF-8 byte
  boundary — including indices inside a multi-byte code point — for every
  fixture in `conformance/fixtures/incremental-corpus.json`, plus the
  maximally fragmented one-chunk-per-character and one-chunk-per-byte
  partitions. This review extended the same property to the synchronous
  corpus and found no divergence; see [F-05](#f-05--evidence-gap--partition-invariance-is-proven-over-16-fixtures-and-holds-over-170).
- **Resource limits.** `IncrementalLimits::new`
  (`crates/secret-scan-core/src/incremental.rs:147-172`) rejects a zero limit,
  a construct limit above the input limit, and a buffered limit below the
  derived minimum, so there is no silent default and no environment-derived
  value. Cost is linear in input, not superlinear: the entropy helper
  (`crates/secret-scan-core/src/entropy.rs:12-38`) uses a linear probe, but
  both call sites bound their alphabet or their length — the contextual value
  is capped at 4096 bytes
  (`crates/secret-scan-core/src/detectors/generic_token.rs:44,196-197`) and
  the authorization value alphabet is 66 ASCII symbols
  (`crates/secret-scan-core/src/detectors/generic_token.rs:412-414`).
  Measured on a release build over 4096-byte values of 1365 distinct CJK
  characters under a high-signal name — the worst case the bounds allow:

  | Input | Wall time |
  |---|---|
  | 1 MiB, worst-case value cardinality | 0.24s |
  | 4 MiB, same | 0.92s |
  | 9.8 MiB, 200k provider tokens | 1.62s |
  | 64 MiB + 1 byte | 0.03s, rejected `INPUT_LIMIT_EXCEEDED` |

  Four times the input costs four times the time. The input cap is applied to
  bytes actually read (`crates/secret-scan-cli/src/input.rs:103-118`), so a
  file that grows during the read is still rejected, and the boundary is
  exact: 67 108 864 bytes is accepted by path, 67 108 865 is not.
- **Lifecycle cleanup.** `discard_retained`
  (`crates/secret-scan-core/src/incremental.rs:425-430`) releases the buffer
  rather than truncating it, so the discarded bytes do not survive in a
  reusable allocation, and it resets the private-key parser state with them.
  Every discarding transition is pinned by a test that asserts both
  `retained == ""` *and* `retained.capacity() == 0`
  (`crates/secret-scan-core/src/incremental.rs:688-693`), across abort, an
  open PEM block, a token-limit failure, an input-limit failure, a policy
  failure, a formatter failure, an invalid placeholder, and a state failure.
  `Debug` for the session prints state and limits only
  (`crates/secret-scan-core/src/incremental.rs:350-357`).
- **Fixed, input-free failures.** `SecretScanError` holds nothing but its code
  (`crates/secret-scan-core/src/error.rs:163-165`); the message is selected by
  a `const fn` over 16 fixed strings
  (`crates/secret-scan-core/src/error.rs:110-129`). On the CLI side,
  `Failure::Usage` carries one of four `&'static str` reasons and never
  argument text (`crates/secret-scan-cli/src/failure.rs:10-17,50-60`), and the
  undecodable bytes are dropped with the `FromUtf8Error` that owns them
  (`crates/secret-scan-cli/src/input.rs:115-117`).

### Criterion 3 — the CLI boundary

- **Detection is delegated, not reimplemented.** `crates/secret-scan-cli` has
  no detector, no policy, and no redaction logic; both modes call
  `secret_scan::scan`, `secret_scan::scan_and_redact`, or
  `IncrementalSanitizer` (`crates/secret-scan-cli/src/modes.rs:18-104`).
  Verified behaviorally rather than only structurally: the streamed and
  whole-file paths report identical types, detectors, confidences, actions and
  byte offsets, and produce byte-identical redactions, across CRLF input, a
  contextual assignment whose value is on the next line, an authorization
  header whose value is on the next line, and an unterminated final line.
- **UTF-8 handling.** One fatal, stateful decoder carries at most three bytes
  of an incomplete sequence across chunks and rejects anything no
  continuation can complete (`crates/secret-scan-cli/src/input.rs:42-61`);
  `finish` (`crates/secret-scan-cli/src/input.rs:69-75`) makes a sequence left
  open at end of input invalid rather than ignored. Both fail closed, and both
  abort the session behind them
  (`crates/secret-scan-cli/src/modes.rs:141-144,155-157`).
- **Downstream failures.** A closed pipe becomes `WRITE_FAILED` and aborts the
  session (`crates/secret-scan-cli/src/modes.rs:149-152`); a buffered write
  that only fails at flush time still fails the run
  (`crates/secret-scan-cli/src/main.rs:75-77`). Reproduced:
  `secret-scan --redact < big.txt | head -1` reports
  `WRITE_FAILED: Writing the output failed.` and exits 2 rather than hanging
  or exiting 0.
- **Exit semantics.** Every documented case was reproduced against the release
  binary:

  | Invocation | Exit | Contract |
  |---|---|---|
  | check, clean file | 0 | nothing found |
  | check, file with a finding | 1 | something found |
  | check, finding **and** a missing file | 2 | a failure outranks a finding |
  | check, clean file and a missing file | 2 | same |
  | check, non-UTF-8 file | 2 | fails closed |
  | check, directory | 2 | read failure |
  | redact, file with a finding | 0 | a finding is not a redaction failure |
  | redact, non-UTF-8 / missing / directory | 2 | processing failure |
  | redact, two paths / with `--json` / unknown option | 2 | usage |
  | `--help`, `--version` | 0 | — |

- **The input is never opened for writing.** The only file handle in the crate
  is `File::open` (`crates/secret-scan-cli/src/input.rs:91`).
- **Reports carry no matched text.** No renderer in
  `crates/secret-scan-cli/src/report.rs` has the input available to resolve a
  range; `SafeFinding` (`crates/secret-scan-cli/src/report.rs:15-23`) is built
  from `Finding` accessors alone. Finding ids are renumbered so `id` is unique
  across a multi-source report
  (`crates/secret-scan-cli/src/report.rs:74-84`), verified with two files and
  with the same file passed twice.

## Findings

### F-01 · `new-risk` · The check report interpolates a source identity without escaping it

- **Area:** CLI.
- **Evidence:** the text renderer writes `source.identity` straight into the
  line format (`crates/secret-scan-cli/src/report.rs:120-133`, identity at
  `:126`), and the failure renderer does the same
  (`crates/secret-scan-cli/src/report.rs:247-257`, identity at `:252`). The
  identity is `path.to_string_lossy()`
  (`crates/secret-scan-cli/src/args.rs:30-35`), so it can contain any
  character a filesystem permits, including a line terminator. The JSON
  renderer is not affected: it routes every identity through
  `write_json_string` (`crates/secret-scan-cli/src/report.rs:177,226,268-281`),
  which escapes `\n`.
- **Reproduction** — a file whose name contains a newline and a forged record:

  ```console
  $ TOKEN="ghp_$(printf 'SYNTHETICREVOKED%020d' 0)"
  $ printf 'API_KEY=%s\n' "$TOKEN" \
      > $'clean\n<forged>:0-1 fake_type detector=none confidence=high action=allow id=finding-99'
  $ secret-scan -- $'clean\n<forged>:0-1 fake_type detector=none confidence=high action=allow id=finding-99'
  clean
  <forged>:0-1 fake_type detector=none confidence=high action=allow id=finding-99:8-48 github_token detector=github-token confidence=high action=redact id=finding-1
  ```

  A consumer parsing the line format sees a complete, well-formed record it
  was never given. The same holds on standard error for a path that cannot be
  read, which needs no file to exist:

  ```console
  $ secret-scan -- $'missing\nsecret-scan: <other>: OK: nothing found'
  secret-scan: missing
  secret-scan: <other>: OK: nothing found: READ_FAILED: Reading the input failed.
  ```

- **Blast radius:** reporting only. The exit code is unaffected — both runs
  above still exit 1 and 2 respectively — so the enforcement contract a
  pre-commit hook or CI job branches on cannot be forged this way. No matched
  plaintext is involved.
- **Exit condition:** the line renderer and the diagnostic renderer either
  reject a source identity containing a line terminator or escape it, and a
  test constructs a path with an embedded newline and asserts the report is
  one record per finding.
- **Severity:** low, non-blocking. It corrupts a text report a machine
  consumer should be reading as `--json` anyway, and the JSON path is already
  correct.

### F-02 · `new-risk` · The streamed and whole-file paths disagree above the token limit

- **Area:** CLI.
- **Evidence:** the streamed path applies `MAX_TOKEN_BYTES = 1 MiB`
  (`crates/secret-scan-cli/src/limits.rs:21`) to every unresolved logical
  line; the whole-file path is bounded by `MAX_INPUT_BYTES = 64 MiB`
  (`crates/secret-scan-cli/src/limits.rs:19`) alone. The asymmetry is
  documented — `ARCHITECTURE.md:269-275` and the binary's own `--help`
  (`crates/secret-scan-cli/src/main.rs:211-224`) both state it — so this is
  not undeclared behavior. What is not pinned is where it starts.
- **Reproduction** — one 2 MiB line with no terminator, sixteen times under
  the shared input cap:

  ```console
  $ python3 -c "open('one_line.txt','wb').write(b'x'*(2*1024*1024))"
  $ secret-scan one_line.txt        ; echo "exit=$?"
  secret-scan: 0 finding(s) in 1 source(s); ranges are utf8-bytes
  exit=0
  $ secret-scan < one_line.txt      ; echo "exit=$?"
  secret-scan: 0 finding(s) in 0 source(s); ranges are utf8-bytes
  secret-scan: <stdin>: TOKEN_LIMIT_EXCEEDED: Incremental sanitizer token limit exceeded.
  exit=2
  ```

  The same input is also accepted by path and refused on standard input at
  exactly the shared 64 MiB cap when it carries no newline.
- **What makes this a finding rather than a documented tradeoff:** the parity
  test's own doc comment states the purpose of the sizing — "a limit tuned to
  credential length would make the two paths disagree about ordinary input: a
  minified bundle, a lockfile entry, or a base64 blob would scan by path and
  fail on standard input"
  (`crates/secret-scan-cli/tests/cli.rs:536-539`) — but the test exercises a
  64 KiB line (`crates/secret-scan-cli/tests/cli.rs:540-568`), sixteen times
  below the limit in force. Nothing in the suite establishes where parity
  ends, so a future change to `MAX_TOKEN_BYTES` could narrow the agreeing
  range without failing a check.
- **Not evidenced:** how often a real input exceeds 1 MiB on one line. A sweep
  of this repository's `node_modules` found no file with a line above 1 MiB,
  so the practical exposure is unquantified here and should not be assumed
  either way.
- **Exit condition:** either (a) a test asserts the behavior at a line above
  `MAX_TOKEN_BYTES` — the streamed run exits 2 with `TOKEN_LIMIT_EXCEEDED`
  while the path run exits 0 — so the boundary is pinned wherever the limit
  moves, or (b) the streamed construct limit is raised to `MAX_INPUT_BYTES` so
  the two paths accept exactly the same inputs and the asymmetry disappears.
- **Severity:** low, non-blocking. It fails closed: the streamed path refuses
  input rather than scanning it in part, and no unsanitized text is emitted
  (verified — the failing redact run wrote 0 bytes).

### F-03 · `evidence-gap` · `authorization_credential` has a policy entry and no fixture

- **Area:** conformance.
- **Evidence:** `authorization_credential` is a reachable finding type emitted
  by the `generic-token` detector with `Structural` specificity
  (`crates/secret-scan-core/src/detectors/generic_token.rs:497`), and it has a
  dedicated entry in the default policy's always-redact list
  (`crates/secret-scan-core/src/policy.rs:11`). It appears in **zero**
  fixtures across all five corpus files:

  ```console
  $ grep -c authorization_credential conformance/fixtures/*.json
  conformance/fixtures/error-codes.json:0
  conformance/fixtures/incremental-corpus.json:0
  conformance/fixtures/incremental-lifecycle-corpus.json:0
  conformance/fixtures/synchronous-corpus.json:0
  conformance/fixtures/unicode-conversion-corpus.json:0
  ```

  The four fixtures whose input mentions `Authorization`
  (`structural-overlap`, `host-http-github`, `jwt-overlap-bearer`,
  `bearer-overlap-jwt`) all use the `Bearer` scheme, which the separate
  `bearer-token` detector claims as `bearer_token`. Cross-checking the corpus
  against the policy list confirms the inverse too: of the 22 finding types
  the corpus asserts, `contextual_secret` is the only one deliberately outside
  the always-redact list, and `authorization_credential` is the only
  always-redact entry the corpus never exercises.
- **Reproduction** — both schemes the detector accepts are live:

  ```console
  $ printf 'Authorization: Basic U1lOVEhFVElDX1JFVk9LRURfQkFTSUM=\nAuthorization: Token SYNTHETIC_REVOKED_TOKEN_VALUE\n' | secret-scan
  <stdin>:21-53 authorization_credential detector=generic-token confidence=high action=redact id=finding-1
  <stdin>:75-104 authorization_credential detector=generic-token confidence=high action=redact id=finding-2
  ```

- **Why it matters:** the corpus is the single executable behavioral contract,
  and every binding proves parity against it. A finding type absent from the
  corpus is a behavior each surface is free to disagree about without any
  check noticing — including its redaction, since this type is redacted at
  *any* confidence rather than by the confidence rule.
- **Exit condition:** `conformance/fixtures/synchronous-corpus.json` carries at
  least one supported positive fixture per accepted scheme (`basic`, `token`)
  asserting detector, type, confidence, specificity and byte span, plus one
  boundary fixture at `MIN_AUTHORIZATION_VALUE_LENGTH`
  (`crates/secret-scan-core/src/detectors/generic_token.rs:45`), and the
  TypeScript oracle and the Python conformance run both pass with them.
- **Severity:** medium. It is a hole in the contract, not a known defect —
  the Rust behavior above is correct on its face — but it is the kind of hole
  a cross-language release is supposed to have closed.

### F-04 · `evidence-gap` · Nothing binds the built-in type names to the default policy

- **Area:** core.
- **Evidence:** `default_action`
  (`crates/secret-scan-core/src/policy.rs:39-51`) special-cases
  `private_key`, then matches a hand-maintained 21-element array
  (`crates/secret-scan-core/src/policy.rs:9-31`), then falls back to
  "redact at high confidence, warn otherwise". The array is a literal list of
  strings; nothing derives it from, or checks it against, the detectors that
  can actually emit those names. The existing policy tests iterate the array
  itself (`crates/secret-scan-core/src/policy.rs:117-126`) — which passes for
  any array, including one missing an entry — and
  `crates/secret-scan-core/tests/policy_redaction.rs` builds candidates from
  literals rather than from the built-in registry.
- **Failure mode:** a new provider detector is added with a new type name and
  the author forgets `ALWAYS_REDACT_TYPES`. Every candidate it emits at
  `Confidence::Medium` or `Confidence::Low` is then `Action::Warn` — left in
  the output unredacted — instead of `Action::Redact`. No test, lint, or
  workspace check fails. The blast radius is every surface, because they all
  share this policy.
- **Exit condition:** a test enumerates the type names the built-in registry
  can emit (either from a per-detector declaration or by running the registry
  over the corpus) and asserts each one is `private_key`, present in
  `ALWAYS_REDACT_TYPES`, or listed on an explicit, commented
  confidence-gated allowlist whose sole current member is
  `contextual_secret`.
- **Severity:** medium. Nothing is wrong today — this review verified the two
  sets agree at this revision — but the property that makes them agree is
  maintained by hand and unguarded, and the failure it admits is silent
  under-redaction.

### F-05 · `evidence-gap` · Partition invariance is proven over 16 fixtures and holds over 170

- **Area:** core.
- **Evidence:** the committed proof
  (`crates/secret-scan-core/tests/incremental_partitions.rs:155-196`) is
  exhaustive in *boundaries* — every char boundary, every UTF-8 byte boundary
  including indices inside a code point, plus maximal fragmentation — but its
  input set is `conformance/fixtures/incremental-corpus.json`, which the test
  itself floors at 16 fixtures
  (`crates/secret-scan-core/tests/incremental_partitions.rs:134-146`).
  `crates/secret-scan-core/tests/adversarial_bounds.rs:165-243` adds the 26
  adversarial fixtures at one chunk width. The remaining ~128 supported
  fixtures of `synchronous-corpus.json` — the contextual, negative, malformed,
  canonical and regression tiers — are never run through an incremental
  session in any language.
- **What this review measured:** a temporary probe ran every supported
  synchronous fixture through an incremental session — all char boundaries and
  all UTF-8 byte boundaries for the 146 fixtures at or under 4096 bytes, and
  chunk widths 1, 7, 64 and 1024 for the 24 larger ones — and compared text,
  finding ids, types, detectors, confidences, actions and absolute byte ranges
  against the whole-input reference:

  ```text
  PROBE: 146 small fixtures (char+byte boundaries), 24 large fixtures (widths 1/7/64/1024), 0 divergent
  test result: ok. 1 passed; finished in 1.46s
  ```

  The probe was removed after measuring; it is not in the tree.
- **Reading:** this is a positive result. Partition invariance holds well
  beyond what is asserted, so the gap is coverage, not behavior — and closing
  it costs 1.46 seconds of release-build test time.
- **Exit condition:** a committed Rust test runs every `support != "not-yet-evaluated"`
  fixture in `synchronous-corpus.json` through an incremental session and
  asserts equality with the whole-input reference — all char and byte
  boundaries below a size threshold, fixed chunk widths above it — and it runs
  in `ci.yml`'s `rust-native` job.
- **Severity:** low. The property is the one criterion 2 names, and it is
  currently true; only its proof is narrower than its claim.

### F-06 · `stale-claim` · The shipped crate documents itself as not yet conformant

- **Area:** core.
- **Evidence:** `crates/secret-scan-core/src/lib.rs:93-95`:

  > Until the Rust core passes the shared conformance corpus, the TypeScript
  > implementation in `src/` remains the behavioral oracle.

  This is crate-root rustdoc on the artifact under release, so it is what
  docs.rs renders and what `cargo doc` shows a consumer. The tree contradicts
  the premise: the Rust core is held to the full canonical synchronous corpus
  by `bindings/python/tests/test_conformance.py:35-49`, to the full incremental
  corpus by `crates/secret-scan-core/tests/incremental_partitions.rs`, and to
  the adversarial tier's declared caps by
  `crates/secret-scan-core/tests/adversarial_bounds.rs` — all passing at this
  revision.
- **Distinct from ledger G-01.** G-01 records that the TypeScript core is
  still *present* in the tree, which is true and owned by issue #35. This
  finding is narrower and separately actionable: the sentence's stated
  precondition ("until the Rust core passes the shared conformance corpus")
  has been met, so the sentence is inaccurate today regardless of when #35
  lands.
- **Exit condition:** the sentence is corrected or removed, and no crate-root
  rustdoc in `crates/secret-scan-core` states that the Rust core has not
  passed the shared corpus. `ARCHITECTURE.md:29-30` and `README.md:17-25`
  describe the *migration state* (the TypeScript package is still the
  published npm artifact) and are accurate as written; only the crate's own
  claim about conformance needs to change.
- **Severity:** medium. It is documentation, but it is documentation published
  with the release candidate, and it understates the artifact's own
  qualification.

### F-07 · `evidence-gap` · The full synchronous corpus reaches the Rust core only through the Python wheel job

- **Area:** conformance.
- **Evidence:** `.github/workflows/ci.yml` has five jobs — `test`,
  `rust-policy`, `rust-native`, `rust-msrv`, `rust-wasm` — and none of them
  runs Python or pytest (`grep -n 'python\|pytest\|maturin' .github/workflows/ci.yml`
  returns nothing). `rust-native` runs `cargo test --workspace --locked`,
  which covers the incremental corpus in full and the adversarial tier, and
  then smoke-checks only `secret-scan --version`
  (`.github/workflows/ci.yml:123-130`). The `test` job runs `npm run ci`,
  whose canonical-oracle suite asserts the corpus against the *TypeScript*
  implementation (`test/conformance/canonical-oracle.test.ts:23-33`), not
  against the Rust core. The only check that runs the canonical synchronous
  corpus against Rust behavior is
  `bindings/python/tests/test_conformance.py`, invoked by
  `scripts/qualify-python-wheel.py:393-430` from the `Qualify the wheel` step
  of `.github/workflows/python-wheels.yml:193-201`.
- **Mitigation already in place:** that workflow's pull-request path filter
  includes `crates/secret-scan-core/**` and `conformance/**`
  (`.github/workflows/python-wheels.yml:17-28`), so the core and the corpus
  cannot change without it running. The gap is narrower than "unverified": it
  is that the parity fact lives outside the workflow every pull request runs,
  in a job whose purpose is wheel qualification.
- **Relationship to the ledger:** this confirms and sharpens G-04 and G-06 at
  the assessed revision. It is recorded here with the precise call chain so
  #66 can dispose of one item rather than three.
- **Exit condition:** either a Rust integration test iterates every supported
  `synchronous-corpus.json` fixture and asserts detector, type, confidence and
  byte span directly (closing this and part of G-04 in `rust-native`), or the
  Python conformance run is promoted into `ci.yml` unconditionally.
- **Severity:** low, on the strength of the path filter. It rises if the
  filter is ever narrowed.

### F-08 · `new-risk` · The contract names its offset unit two ways

- **Area:** conformance.
- **Evidence:** the canonical corpus declares `"offsetUnit": "utf8-byte"`
  (`conformance/schema.json:11`, and every file under
  `conformance/fixtures/`), while every runtime reports the unit as
  `"utf8-bytes"` — `RANGE_UNIT` (`crates/secret-scan-core/src/lib.rs:140`) and
  the CLI's JSON `rangeUnit` field
  (`crates/secret-scan-cli/src/report.rs:164-166`). Both spellings are
  internally consistent and each has its own assertions
  (`crates/secret-scan-core/tests/support/mod.rs:149-153` for one,
  `crates/secret-scan-core/tests/public_api.rs:107` for the other), so nothing
  is broken.
- **Why record it:** they name the same concept in the same contract. A
  consumer that reads `offsetUnit` from a fixture and compares it to
  `rangeUnit` from a scan result gets a mismatch and must know to special-case
  it.
- **Exit condition:** one spelling, or a sentence in `conformance/README.md`
  stating that `offsetUnit` and `rangeUnit` are deliberately distinct field
  names with distinct value vocabularies.
- **Severity:** low, cosmetic. Changing either string is a cross-language
  contract change, so the documentation option may well be the right one; that
  is #66's call, not this review's.

## Appendix — reproducing this review

Every command below is read-only against the tree except the two the
repository already provides as its own gates.

```bash
# Gates
cargo test --workspace
npm run ci

# The binary every CLI reproduction uses
cargo build --release -p secret-scan-cli

# F-03: the type with a policy entry and no fixture
grep -c authorization_credential conformance/fixtures/*.json
printf 'Authorization: Token SYNTHETIC_REVOKED_TOKEN_VALUE\n' |
  ./target/release/secret-scan

# F-08: the two spellings
grep -rn 'utf8-byte"' conformance/schema.json
grep -n 'RANGE_UNIT: &str' crates/secret-scan-core/src/lib.rs
```

F-01, F-02 and the exit-semantics table are reproduced by the console blocks
quoted inline. F-05's probe is a temporary test file that was removed; its
exit condition specifies the committed form.
