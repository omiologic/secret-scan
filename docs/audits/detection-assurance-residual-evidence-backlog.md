# Residual detection-assurance evidence gaps

The 5 evidence-dimension gaps [`docs/coverage/coverage-declarations.json`](../coverage/coverage-declarations.json)
honestly reports as `pending`, routed here by
[the detection-assurance closeout audit](./detection-assurance-closeout-audit.md)
under issue #118.

- **Recorded on:** 2026-09-10, at `e8bf910`.
- **Tracked by:** [#136](https://github.com/omiologic/secret-scan/issues/136), which has no parent by design.
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

`docs/coverage/coverage-report.md`'s own generator computed these 5 entries
from the corpus and declarations at the revision above — this document does
not introduce a new gap, it gives the 5 already-declared `backlogId` slugs a
narrative, an exit condition, and an owner.

## Backlog

| ID | Class | Row(s) / dimension | Finding | Exit condition |
|---|---|---|---|---|
| `structural-host-context-breadth` | `evidence-gap` | `private_key`, `jwt`, `bearer_token`, `connection_string_password` — `host-context` (class-level) | No `structural`-class detector yet carries supported positive fixtures across all five representative host-context lexical classes (`structured-data-kv`, `shell-invocation`, `source-code`, `wire-and-log`, `prose-and-markup`; [`host-context-classes.md`](../coverage/host-context-classes.md) §1, §3). Each of the four rows defaults to a single `plain-text` fixture today; `connection_string_password` additionally carries a targeted `log` fixture (`wire-and-log`), which is not, by itself, class-level breadth. | At least one `structural`-class type gains supported positive fixtures completing the remaining representative contexts (`dotenv`, `shell`, `javascript`, and `markdown` or `xml`), so `evidence-requirements.md` §3's class-level requirement is met and `coverage-declarations.json`'s `host-context` cell for all four rows resolves `supported`. |
| `bearer-token-overlap` | `evidence-gap` | `bearer_token` — `overlap` | `bearer_token` has no fixture pinning which candidate the default policy keeps when its byte range contends with another match (for example a `contextual_secret`/`authorization_credential` candidate over the same `Authorization:` header value). | One `kind: "overlap"` fixture for `bearer_token` in `conformance/fixtures/synchronous-corpus.json`, asserting the resolved detector, type, confidence, and byte span. |
| `contextual-secret-overlap` | `evidence-gap` | `contextual_secret` — `overlap` | `contextual_secret` has no dedicated overlap fixture. `generic-token`'s `single-detector-family` exemption (`evidence-requirements.md` §5) currently covers only `adversarial` for its sibling `authorization_credential`; the coverage-declarations generator does not extend a `single-detector-family` exemption to `overlap` for either type, so each must resolve it independently. | One `kind: "overlap"` fixture for `contextual_secret`. |
| `authorization-credential-overlap` | `evidence-gap` | `authorization_credential` — `overlap` | Same gap as `contextual-secret-overlap`, for `authorization_credential`. | One `kind: "overlap"` fixture for `authorization_credential`, for at least one of its two accepted schemes (`basic`, `token`). |
| `authorization-credential-host-context-breadth` | `evidence-gap` | `authorization_credential` — `host-context` (type-level) | `authorization_credential` is a `contextual`-class type, so `evidence-requirements.md` §3 requires its *own* type-level representative-class coverage, not a borrowed one — the same rule [`host-context-classes.md`](../coverage/host-context-classes.md) §4 already applied to close `contextual_secret`'s equivalent gap via issue #111. `authorization_credential` currently has zero host-context fixtures of any kind; its only positive evidence today is the default `plain-text` fixture. | `authorization_credential` gains its own positive fixtures across the five representative host-context classes, following the same pattern issue #111 used for `contextual_secret` (`host-context-classes.md` §4). |

## Sequencing notes

- `authorization-credential-overlap` and `authorization-credential-host-context-breadth`
  are independent gaps on the same row; either may be picked up first, and
  neither blocks the other.
- `structural-host-context-breadth` is one class-level gap shared by four
  declaration rows — closing it once, on any single `structural`-class type,
  clears the exception on all four per `evidence-requirements.md` §3's
  class-level rule. It does not require touching `private_key`, `jwt`,
  *and* `connection_string_password` separately.
- None of these 5 entries is a prerequisite for another; they may be closed
  in any order, together or separately.

## Not in scope

The exit conditions above describe fixture-level corpus additions only.
Filing new fixtures does not itself authorize a version, tag, release,
publication, deployment, or archival — those remain out of scope for both
this document and issue #136, exactly as they are for Epic #95.

## Plaintext safety

No entry above reproduces a matched value, a fixture input, or a
credential-shaped string. Detector ids, finding types, dimension names,
representative-context names, and byte-range vocabulary are safe metadata.
