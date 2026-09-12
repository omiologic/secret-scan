# Residual detection-assurance evidence gaps

The 5 evidence-dimension backlog IDs
[`docs/coverage/coverage-declarations.json`](../coverage/coverage-declarations.json)
honestly reports as `pending`, routed here by
[the detection-assurance closeout audit](./detection-assurance-closeout-audit.md)
under issue #118 and reconciled to their current follow-up issues by
[#185](https://github.com/redact-secret/redact-secret/issues/185).

- **Recorded on:** 2026-09-10, at `e8bf910`.
- **Historical tracker:** [#136](https://github.com/redact-secret/redact-secret/issues/136),
  which has no parent by design and is closed as a tracking-artifact closeout.
- **Current owners:** [#186](https://github.com/redact-secret/redact-secret/issues/186),
  [#187](https://github.com/redact-secret/redact-secret/issues/187),
  [#188](https://github.com/redact-secret/redact-secret/issues/188),
  [#189](https://github.com/redact-secret/redact-secret/issues/189), and
  [#190](https://github.com/redact-secret/redact-secret/issues/190).
- **Status:** open work, deliberately outside Epic #95's tree. **Nothing in
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

`docs/coverage/coverage-report.md`'s own generator computed these 5 backlog
IDs from the corpus and declarations at the revision above — this document
does not introduce a new gap, it gives the already-declared `backlogId` slugs
a narrative, an exit condition, and an owner. Current declarations report the
same 5 backlog IDs across 9 pending cells: the current corpus adds
`otpauth_secret.host-context` to the shared
`structural-host-context-breadth` gap.

## Current reconciliation

| Backlog ID | Historical tracker | Current owner | Current pending cell(s) | Exit evidence |
|---|---|---|---|---|
| `structural-host-context-breadth` | #136 | [#186](https://github.com/redact-secret/redact-secret/issues/186) | `private_key.host-context`, `jwt.host-context`, `bearer_token.host-context`, `connection_string_password.host-context`, `otpauth_secret.host-context` | One structural-class type supplies supported positive fixtures across all five representative host-context classes, after which generated declarations replace the shared pending status with `supported`. |
| `bearer-token-overlap` | #136 | [#187](https://github.com/redact-secret/redact-secret/issues/187) | `bearer_token.overlap` | A genuine competing-candidate overlap fixture pins the resolved `bearer_token` metadata, byte range, and redaction outcome. |
| `contextual-secret-overlap` | #136 | [#188](https://github.com/redact-secret/redact-secret/issues/188) | `contextual_secret.overlap` | An independent `contextual_secret` overlap fixture pins resolved metadata, byte range, and redaction outcome. |
| `authorization-credential-overlap` | #136 | [#189](https://github.com/redact-secret/redact-secret/issues/189) | `authorization_credential.overlap` | An `authorization_credential` overlap fixture for an accepted Basic or Token scheme pins resolved metadata, byte range, and redaction outcome. |
| `authorization-credential-host-context-breadth` | #136 | [#190](https://github.com/redact-secret/redact-secret/issues/190) | `authorization_credential.host-context` | `authorization_credential` itself supplies positive fixtures across all five representative host-context classes. |

## Backlog

| ID | Class | Row(s) / dimension | Finding | Exit condition |
|---|---|---|---|---|
| `structural-host-context-breadth` | `evidence-gap` | `private_key`, `jwt`, `bearer_token`, `connection_string_password`, `otpauth_secret` — `host-context` (class-level) | No `structural`-class detector yet carries supported positive fixtures across all five representative host-context lexical classes (`structured-data-kv`, `shell-invocation`, `source-code`, `wire-and-log`, `prose-and-markup`; [`host-context-classes.md`](../coverage/host-context-classes.md) §1, §3). The historical closeout named four rows; current declarations also include `otpauth_secret` after the `otpauth-uri` detector entered the structural class. | At least one `structural`-class type gains supported positive fixtures completing the remaining representative contexts (`dotenv`, `shell`, `javascript`, and `markdown` or `xml`), so `evidence-requirements.md` §3's class-level requirement is met and `coverage-declarations.json`'s `host-context` cell for all structural rows resolves `supported`. |
| `bearer-token-overlap` | `evidence-gap` | `bearer_token` — `overlap` | `bearer_token` has no fixture pinning which candidate the default policy keeps when its byte range contends with another match (for example a `contextual_secret`/`authorization_credential` candidate over the same `Authorization:` header value). | One `kind: "overlap"` fixture for `bearer_token` in `conformance/fixtures/synchronous-corpus.json`, asserting the resolved detector, type, confidence, byte span, and redaction outcome. |
| `contextual-secret-overlap` | `evidence-gap` | `contextual_secret` — `overlap` | `contextual_secret` has no dedicated overlap fixture. The coverage-declarations generator does not borrow sibling `generic-token` evidence to resolve `overlap`, so `contextual_secret` must resolve it independently. | One `kind: "overlap"` fixture for `contextual_secret`. |
| `authorization-credential-overlap` | `evidence-gap` | `authorization_credential` — `overlap` | Same gap as `contextual-secret-overlap`, for `authorization_credential`; its overlap evidence cannot be inferred from `contextual_secret` fixtures. | One `kind: "overlap"` fixture for `authorization_credential`, for at least one of its two accepted schemes (`basic`, `token`). |
| `authorization-credential-host-context-breadth` | `evidence-gap` | `authorization_credential` — `host-context` (type-level) | `authorization_credential` is a `contextual`-class type, so `evidence-requirements.md` §3 requires its *own* type-level representative-class coverage, not a borrowed one — the same rule [`host-context-classes.md`](../coverage/host-context-classes.md) §4 already applied to close `contextual_secret`'s equivalent gap via issue #111. | `authorization_credential` gains its own positive fixtures across the five representative host-context classes, following the same pattern issue #111 used for `contextual_secret` (`host-context-classes.md` §4). |

## Sequencing notes

- `authorization-credential-overlap` and `authorization-credential-host-context-breadth`
  are independent gaps on the same row; either may be picked up first, and
  neither blocks the other.
- `structural-host-context-breadth` is one class-level gap shared by five
  declaration rows — closing it once, on any single `structural`-class type,
  clears the exception on all five per `evidence-requirements.md` §3's
  class-level rule. It does not require touching `private_key`, `jwt`,
  `connection_string_password`, and `otpauth_secret` separately.
- None of these 5 entries is a prerequisite for another; they may be closed
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
