# Residual detection-assurance evidence gaps

The five historical evidence-dimension backlog IDs formerly reported as
`pending` by
[`docs/coverage/coverage-declarations.json`](../coverage/coverage-declarations.json), routed here by
[the detection-assurance closeout audit](./detection-assurance-closeout-audit.md)
under issue #118 and reconciled to their current follow-up issues by
[#185](https://github.com/redact-secret/redact-secret/issues/185).

- **Recorded on:** 2026-09-10, at `e8bf910`.
- **Historical tracker:** [#136](https://github.com/redact-secret/redact-secret/issues/136),
  which has no parent by design and is closed as a tracking-artifact closeout.
- **Resolved owners:** [#186](https://github.com/redact-secret/redact-secret/issues/186) and
  [#187](https://github.com/redact-secret/redact-secret/issues/187).
- **Current open owners:** [#188](https://github.com/redact-secret/redact-secret/issues/188),
  [#189](https://github.com/redact-secret/redact-secret/issues/189), and
  [#190](https://github.com/redact-secret/redact-secret/issues/190).
- **Status:** two gaps resolved and three remain open, deliberately outside Epic #95's tree. **Nothing in
  this document blocks Epic #95's closeout.**
- **Authority:** this document records deferred evidence gaps. It does not
  authorize implementation changes or any release operation.

## Why these are deferred and not blocking

Each entry is an honestly-labeled `pending` dimension cell under
[`evidence-requirements.md`](../coverage/evidence-requirements.md)'s bounded
exception rule (§5): a dimension that is genuinely required, currently
unmet, and tracked with an owning backlog item — an honest gap, not an
invented pass. None is a detector regression, a false negative against
currently declared corpus evidence, or a security-boundary violation; each
is missing *breadth* evidence for a dimension whose *depth* evidence (a
positive match, its boundaries, its malformed-input survival, its
adversarial caps) already exists and passes for that row.

`docs/coverage/coverage-report.md`'s own generator originally computed these 5 backlog
IDs from the corpus and declarations at the revision above — this document
does not introduce a new gap, it gives the already-declared `backlogId` slugs
a narrative, an exit condition, and an owner. Current declarations report three
remaining backlog IDs across three pending cells. The former five structural
`host-context` cells now resolve `supported` from one class-level
`connection_string_password` representative, and `bearer_token.overlap` now
resolves `supported` from the dedicated competing-candidate fixture.

## Current reconciliation

| Backlog ID | Historical tracker | Current owner | Current pending cell(s) | Exit evidence |
|---|---|---|---|---|
| `structural-host-context-breadth` | #136 | [#186](https://github.com/redact-secret/redact-secret/issues/186) | **Resolved:** no pending cells | `connection_string_password` supplies positive `dotenv`, `shell`, `javascript`, `log`, and `markdown` fixtures in the [canonical corpus](../../conformance/fixtures/synchronous-corpus.json). The [generator regression](../../scripts/tests/test_generate_coverage_declarations.py) proves the representative and all four `owned-elsewhere` resolutions; the regenerated [declarations](../coverage/coverage-declarations.json) and [report](../coverage/coverage-report.md) are validated by `npm run coverage:check`, and the canonical detector result is validated by `cargo test -p redact-secret --test canonical_corpus scan_matches_the_canonical_synchronous_corpus`. |
| `bearer-token-overlap` | #136 | [#187](https://github.com/redact-secret/redact-secret/issues/187) | **Resolved:** no pending cells | The [canonical overlap fixture](../../conformance/fixtures/synchronous-corpus.json) pins the winning `bearer_token` metadata and byte range. The [candidate-contention regression](../../crates/secret-scan-core/src/detectors/mod.rs) proves both built-in detectors emit overlapping candidates, while the [policy/redaction regression](../../crates/secret-scan-core/tests/detectors_conformance.rs) pins the default redaction outcome. The regenerated [declarations](../coverage/coverage-declarations.json) and [report](../coverage/coverage-report.md) are validated by `npm run coverage:check`, and the canonical result is validated by `cargo test -p redact-secret --test canonical_corpus scan_matches_the_canonical_synchronous_corpus`. |
| `contextual-secret-overlap` | #136 | [#188](https://github.com/redact-secret/redact-secret/issues/188) | `contextual_secret.overlap` | An independent `contextual_secret` overlap fixture pins resolved metadata, byte range, and redaction outcome. |
| `authorization-credential-overlap` | #136 | [#189](https://github.com/redact-secret/redact-secret/issues/189) | `authorization_credential.overlap` | An `authorization_credential` overlap fixture for an accepted Basic or Token scheme pins resolved metadata, byte range, and redaction outcome. |
| `authorization-credential-host-context-breadth` | #136 | [#190](https://github.com/redact-secret/redact-secret/issues/190) | `authorization_credential.host-context` | `authorization_credential` itself supplies positive fixtures across all five representative host-context classes. |

## Backlog

| ID | Class | Row(s) / dimension | Finding | Exit condition |
|---|---|---|---|---|
| `structural-host-context-breadth` | `resolved-evidence-gap` | `private_key`, `jwt`, `bearer_token`, `connection_string_password`, `otpauth_secret` — `host-context` (class-level) | Resolved by #186: `connection_string_password` now carries supported positive evidence across all five representative lexical classes. | Demonstrated by the linked corpus fixtures, generator regression, generated declarations/report, coverage check, and canonical Rust conformance test in the reconciliation table above. |
| `bearer-token-overlap` | `resolved-evidence-gap` | `bearer_token` — `overlap` | Resolved by #187: the structural Bearer candidate now contends with a wider contextual assignment candidate, wins on specificity, and is redacted under the default policy. | Demonstrated by the linked canonical fixture, direct candidate-contention regression, policy/redaction regression, generated declarations/report, coverage check, and canonical Rust conformance test in the reconciliation table above. |
| `contextual-secret-overlap` | `evidence-gap` | `contextual_secret` — `overlap` | `contextual_secret` has no dedicated overlap fixture. The coverage-declarations generator does not borrow sibling `generic-token` evidence to resolve `overlap`, so `contextual_secret` must resolve it independently. | One `kind: "overlap"` fixture for `contextual_secret`. |
| `authorization-credential-overlap` | `evidence-gap` | `authorization_credential` — `overlap` | Same gap as `contextual-secret-overlap`, for `authorization_credential`; its overlap evidence cannot be inferred from `contextual_secret` fixtures. | One `kind: "overlap"` fixture for `authorization_credential`, for at least one of its two accepted schemes (`basic`, `token`). |
| `authorization-credential-host-context-breadth` | `evidence-gap` | `authorization_credential` — `host-context` (type-level) | `authorization_credential` is a `contextual`-class type, so `evidence-requirements.md` §3 requires its *own* type-level representative-class coverage, not a borrowed one — the same rule [`host-context-classes.md`](../coverage/host-context-classes.md) §4 already applied to close `contextual_secret`'s equivalent gap via issue #111. | `authorization_credential` gains its own positive fixtures across the five representative host-context classes, following the same pattern issue #111 used for `contextual_secret` (`host-context-classes.md` §4). |

## Sequencing notes

- `authorization-credential-overlap` and `authorization-credential-host-context-breadth`
  are independent gaps on the same row; either may be picked up first, and
  neither blocks the other.
- `structural-host-context-breadth` closed once on
  `connection_string_password`; no redundant fixtures were added for the
  other four structural types.
- None of these five historical entries is a prerequisite for another; the four open gaps may be closed
  in any order, together or separately.

## Not in scope

The exit conditions above describe fixture-level corpus additions only.
Filing new fixtures does not itself authorize a version, tag, release,
publication, deployment, or archival — those remain out of scope for this
document, the historical tracker #136, and the current owner issues, exactly
as they are for Epic #95.

## Plaintext safety

No entry above reproduces a matched value, a fixture input, or a
credential-shaped string. Detector ids, finding types, dimension names,
representative-context names, and byte-range vocabulary are safe metadata.
