# Known-format credential detection

**State: current**

## What it does and why

The scanner recognizes credential families with distinctive structure so applications can catch high-confidence secrets before logging, persistence, model context, or tool invocation. Specific shapes provide stronger evidence than randomness alone and reduce unnecessary redaction of ordinary identifiers.

## How it works

Independent detectors emit a type, confidence, specificity, and original-input range. The shared [detector pipeline](../detector-pipeline/) validates those candidates and chooses one finding when formats overlap; for example, a JWT inside a Bearer header resolves to the JWT finding.

## Supported now

- Complete PEM-style private-key blocks for the generic, RSA, DSA, EC,
  OpenSSH, and encrypted labels. Nested, repeated, or mismatched supported
  delimiters are covered by one conservative outermost finding.
- AWS access-key IDs with `AKIA` or `ASIA` prefixes.
- GitHub `ghp_`, `gho_`, `ghu_`, and `ghr_` fixed-width shapes, the supported
  fixed-width `github_pat_` shape, and both opaque and stateless `ghs_`
  installation-token shapes. The installation matcher follows GitHub's
  rollout-safe `ghs_[A-Za-z0-9.\-_]{36,}` guidance and selects the complete
  token rather than a legacy-length prefix.
- GitLab token families with the documented `glpat-`, `gloas-`, `gldt-`,
  `glrt-`, `glrtr-`, `glcbt-`, `glptt-`, `glft-`, `glimt-`, `glagent-`, and
  `glwt-` standard prefixes.
- Three-segment JWTs with encoded JSON-object-style header and payload prefixes.
- Bearer credentials.
- Recognized OpenAI and versioned Anthropic API-key shapes.
- Shopify Admin API and delegate access-token prefixes.
- Modern HashiCorp Vault service, batch, and recovery token prefixes.

The OpenAI detector excludes Anthropic's `sk-ant-` namespace. Versioned
Anthropic values therefore retain the `anthropic_api_key` classification at the
public pipeline boundary instead of depending on equal-specificity registry
order.

The default policy blocks private-key findings and redacts the other known formats. Detection itself remains separate from that policy decision.

## Planned or considered

- **current:** The shared [detector conformance corpus](../../../test/conformance/README.md) makes supported, excluded, boundary, overlap, and adversarial behavior explicit.
- **current:** Evidence-based qualification records the accepted and rejected provider families below and resolves the OpenAI/Anthropic precedence ambiguity.

## Provider-family qualification

A family is eligible only when an authoritative provider source documents a
stable prefix or structure, the shape is distinct enough for high-confidence
offline matching, false-positive and false-negative boundaries can be stated,
and maintenance does not require liveness checks or reverse engineering.

| Candidate | Result | Precision, recall, and maintenance rationale |
| --- | --- | --- |
| GitHub prefixed token families | Accepted with explicit shape boundaries | GitHub documents the token-type prefixes. Its 2021 format announcement supports the Base62-style classic alphabet and warns that lengths may evolve. The current App installation rollout specifically recommends `ghs_[A-Za-z0-9.\-_]{36,}` for both stateful and stateless forms, which this detector uses. Fixed-width classic and fine-grained matching stays intentionally narrow; future length changes outside the installation family can be missed until requalified. |
| GitLab standard token prefixes | Accepted | GitLab documents the prefix catalog and notes that only personal access token prefixes are configurable. Matching the documented catalog plus a substantial opaque suffix is precise; customized PAT prefixes, short values, and future families are expected false negatives. |
| Shopify Admin and delegate access tokens | Accepted | Shopify documents `shpat_` and `shppa_`. A conservative suffix alphabet and minimum length avoid header names and abbreviated examples, but may miss future encodings or short development values. |
| Vault 1.10+ service, batch, and recovery tokens | Accepted | HashiCorp documents `hvs.`, `hvb.`, and `hvr.` with at least 24 random characters. Modern prefixes are distinctive; the legacy `s.`, `b.`, and `r.` forms are intentionally rejected because they collide with ordinary prose and identifiers. |
| Twilio API Key SID | Rejected | Twilio documents `SK` plus 32 hexadecimal digits as a resource SID used with a separately issued secret. Detecting the SID alone would classify an identifier rather than secret material. |

Authoritative format sources: [GitHub token prefixes](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats), [GitHub's 2021 token-format design](https://github.blog/engineering/behind-githubs-new-authentication-token-formats/), [GitHub's installation-token rollout guidance](https://github.blog/changelog/2026-05-15-github-app-installation-tokens-per-request-override-header/), [GitLab token prefixes](https://docs.gitlab.com/security/tokens/#token-prefixes), [Shopify access-token types](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens#access-token-types), [Vault token prefixes](https://developer.hashicorp.com/vault/docs/concepts/tokens#token-prefixes), and [Twilio API Key SID schema](https://www.twilio.com/docs/iam/api-keys/key-resource-v1).

Qualification was reviewed on 2026-08-30. Recheck provider sources before each
public release and whenever an upstream format announcement is identified.
This is a repository maintenance activity; runtime detection remains offline
and deterministic.

## Boundaries and tradeoffs

Strict prefixes, lengths, conservative alphabets, token boundaries, and complete private-key delimiters favor precision. GitHub installation values below the documented minimum and values outside the documented rollout-safe alphabet are rejected; a long prefixed synthetic identifier can be a false positive because offline matching cannot establish liveness. Other GitHub families retain intentionally narrow fixed shapes and can miss future length changes. GitLab customized PAT prefixes, short suffixes, and future prefixes remain false negatives. JWTs using differently encoded, serialized, or encrypted forms are excluded unless they have the accepted three base64url-looking segments and encoded JSON-object-style header and payload prefixes. Legacy Vault `s.`, `b.`, and `r.` forms are intentionally excluded. The rules can also miss lone truncated private keys, short development credentials, and legacy or new provider variants. A normally paired private-key block requires encoded body evidence; multiple, nested, out-of-order, or mismatched exact supported delimiters instead produce one fail-safe outermost finding through resolution or end of input. That conservative malformed rule can classify documentation containing multiple exact private-key headers. Malformed delimiter spellings, public-key blocks, certificates, and unsupported-label near-matches remain excluded. A match indicates a likely credential, not that it is live: the core performs no provider validation or network access.

Findings expose classification and offsets, never the matched plaintext. Client scanning is preventive UX; security-sensitive consumers must scan again on the server.

## Evidence and references

- Source: [built-in detector registry](../../../src/detectors/index.ts), [private key](../../../src/detectors/private-key.ts), [AWS](../../../src/detectors/aws.ts), [GitHub](../../../src/detectors/github.ts), [GitLab](../../../src/detectors/gitlab.ts), [JWT](../../../src/detectors/jwt.ts), [Bearer](../../../src/detectors/bearer-token.ts), [OpenAI](../../../src/detectors/openai.ts), [Anthropic](../../../src/detectors/anthropic.ts), [Shopify](../../../src/detectors/shopify.ts), and [Vault](../../../src/detectors/vault.ts)
- Tests: [conformance corpus](../../../test/conformance/README.md), [conformance runner](../../../test/conformance/conformance.test.ts), [positive and boundary coverage](../../../test/detectors/known-formats.test.ts), [false positives](../../../test/false-positives/known-formats.test.ts), and [regex safety](../../../test/detectors/regex-safety.test.ts)
- Architecture: [known-format detectors](../../../ARCHITECTURE.md#known-format-detectors), [conflict resolution](../../../ARCHITECTURE.md#conflict-resolution), and [public result safety](../../../ARCHITECTURE.md#public-result-safety)
- Completed work item: [secret-scan-00003](../../plans/archived/secret-scan-00003.detect-high-confidence-credential-formats.md)
- Provider qualification: [secret-scan-00009](../../plans/archived/secret-scan-00009.qualify-provider-token-families.md)
- Coverage requalification: [secret-scan-00017](../../plans/archived/secret-scan-00017.requalify-credential-coverage.md)
- PEM delimiter hardening: [secret-scan-00016](../../plans/archived/secret-scan-00016.handle-pem-delimiters-linearly.md)
