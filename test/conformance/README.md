# Detector conformance corpus

This directory contains the runtime-neutral fixture schema, synthetic corpus,
safe assertion helpers, and Vitest runner for built-in detector behavior. The
corpus complements detector-specific tests; it does not replace their detailed
format coverage.

Each fixture declares a stable identity, subject detector, case kind, support
state, qualification tier, applicable host contexts, synthetic input, safe
expected metadata, and a short boundary note. Grammar mutations also declare
their seed, operation, and stable ordinal; adversarial cases declare input,
finding-count, and runtime caps.
Expected metadata records detector, type, confidence, specificity, and UTF-16
range without copying the matched value into an expected public result.

Support states have distinct meanings:

- `supported`: current behavior is asserted, including explicit negative cases;
- `intentionally-unsupported`: a reviewed precision or scope exclusion is
  asserted as producing no finding; and
- `not-yet-evaluated`: no behavior is asserted until qualification provides an
  evidence-backed expectation.

Pending cases are validated but not executed. Assertion failures contain only
fixture identity and safe classification/range metadata; they do not include
source input, matched substrings, candidate signals, or exception causes.

Qualification tiers are `canonical`, `negative`, `malformed`, `contextual`,
`adversarial`, and `regression`. The tier is evidence organization rather than
a runtime classification. [`COVERAGE.md`](./COVERAGE.md) is generated from this
metadata plus the incremental corpus and fails CI when an applicable detector
dimension has no evidence or an inapplicable dimension has no reason.

The deterministic mutation harness uses fixed grammars and reproducible
ordering. It covers accepted forms and neighboring invalid prefixes, lengths,
alphabets, whitespace insertion, truncation, punctuation, quoting, encoded
prefixes, and host embedding without random seeds or network data.

## Coverage and exclusions

| Detector area | Supported behavior | Intentional or current boundary |
| --- | --- | --- |
| Private keys | Complete PEM-style private-key blocks plus fail-safe outer spans for nested, repeated, out-of-order, or mismatched supported delimiters | Public keys, unsupported labels, near-matches, and lone incomplete headers are ignored |
| AWS | Fixed-length `AKIA` and `ASIA` access-key IDs | Other AWS identifiers, prefixes, lengths, and embedded values are ignored |
| GitHub | Current classic and fine-grained shapes plus opaque and stateless App installation tokens | Unknown prefixes, short values, invalid rollout alphabets, and embedded values are ignored |
| GitLab | Documented standard token prefixes with substantial opaque suffixes | Customized PAT prefixes, short values, and embedded values are ignored |
| OpenAI | Current legacy, project, and service-account `sk-` shapes | Short or embedded values and the Anthropic `sk-ant-` namespace are ignored |
| Anthropic | The versioned `api03` detector shape | Unknown versions, short values, and embedded values are ignored |
| Shopify | Documented Admin and delegate access-token prefixes | Short values, unknown encodings, and embedded values are ignored |
| Vault | Modern service, batch, and recovery prefixes with at least 24 suffix characters | Collision-prone legacy one-letter prefixes, short values, and embedded values are ignored |
| Additional providers | Qualified Stripe, Slack, PyPI, Hugging Face, Docker, Cloudflare, DigitalOcean, Linear, Supabase secret, and Vercel credential prefixes | Short, embedded, invalid-alphabet, public-key, identifier-only, legacy, and unqualified provider variants are ignored |
| JWT | Three bounded base64url-looking segments with encoded-object header and payload prefixes | Short, malformed, and valid-but-differently-encoded JWTs are ignored |
| Bearer | Explicit Bearer scheme with a bounded credential alphabet | Short credentials and scheme text embedded in identifiers are ignored |
| Connection strings | Original encoded or unencoded password spans in the documented PostgreSQL, MySQL, MariaDB, MongoDB, Redis, and AMQP schemes, including MongoDB seed lists, Redis password-only userinfo, valid bracketed IPv6 hosts, and numeric ports | Host-only, empty-password, placeholder, unsupported-scheme, malformed-escape/authority, invalid SRV multi-host/port forms, and overlong authorities are ignored |
| Contextual | Documented high-signal assignments, including AWS secret/session names, plus Basic and Token authorization structures | Generic `token`, references, placeholders, short/overlong values, and entropy-only text are ignored |

The corpus retains an unassigned pending fixture so future provider families
must be qualified before behavior is asserted. Qualification records are
[secret-scan-00009](../../_notes/plans/archived/secret-scan-00009.qualify-provider-token-families.md),
[secret-scan-00017](../../_notes/plans/archived/secret-scan-00017.requalify-credential-coverage.md),
and [secret-scan-00023](../../_notes/plans/archived/secret-scan-00023.qualify-additional-provider-families.md).
Stable-release corpus qualification is recorded in
[secret-scan-00024](../../_notes/plans/archived/secret-scan-00024.qualify-stable-release-corpus.md).

## Incremental boundary corpus

[`incremental-partitions.ts`](./incremental-partitions.ts) defines the whole-input
reference results that the incremental core reproduces. Its
generators enumerate every two-chunk UTF-16 code-unit boundary, every UTF-8 byte
boundary under streaming decode, and a one-code-unit-at-a-time partition for
representative fixed-width, open-ended, structural, contextual, URL, Unicode,
overlap, multiline, negative, and end-of-input cases.

The integration suite executes the same partitions through the bounded session
implementation and compares them with the synchronous behavioral reference.
Independently scanning chunks remains unsafe.

## Regression intake

Every confirmed false positive or false negative becomes a permanent fixture
under the governed [synthetic regression convention](../../conventions/synthetic-secret-regressions.md):

1. Discard the submitted credential value; retain only a safe description of
   the grammar, boundary, and host context needed to reproduce the defect.
2. Construct an unmistakably synthetic or revoked replacement from scratch.
   Do not transform, encode, hash, truncate, or snapshot the submitted value.
3. Assign one stable fixture ID, the `regression` tier, applicable host
   contexts, safe expected metadata, and a note describing the behavior—not
   the reported plaintext.
4. Prove the fixture fails before the repair when practical, then passes in the
   detector, redaction/policy, incremental, and adapter surfaces it affects.
5. Inspect failures and logs so they contain only fixture identity and safe
   metadata. If safe reproduction is impossible, document the excluded shape
   without retaining the report material.

`regression-malformed-percent-authority` exercises the rule with a wholly
synthetic reproduction and no submitted credential material.
