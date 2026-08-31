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
- Qualified Stripe, Slack, PyPI, Hugging Face, Docker, Cloudflare,
  DigitalOcean, Linear, Supabase secret-key, and Vercel credential prefixes.

The OpenAI detector excludes Anthropic's `sk-ant-` namespace. Versioned
Anthropic values therefore retain the `anthropic_api_key` classification at the
public pipeline boundary instead of depending on equal-specificity registry
order.

The default policy blocks private-key findings and redacts the other known formats. Detection itself remains separate from that policy decision.

## Planned or considered

- **current:** The shared [detector conformance corpus](../../../test/conformance/README.md) makes supported, excluded, boundary, overlap, and adversarial behavior explicit.
- **current:** The [stable-release coverage matrix](../../../test/conformance/COVERAGE.md)
  records applicable evidence and explicit regression inapplicability without
  treating test count as complete credential coverage.
- **current:** Evidence-based qualification records the accepted and rejected provider families below and resolves the OpenAI/Anthropic precedence ambiguity.

## Provider-family qualification

A family is eligible only when an authoritative provider source documents a
stable prefix or structure, the shape is distinct enough for high-confidence
offline matching, false-positive and false-negative boundaries can be stated,
and maintenance does not require liveness checks or reverse engineering.

The additional-provider inventory was reviewed on **2026-08-31**. “Supported”
means offline shape detection, not credential liveness, scope, ownership, or
provider-side validation.

| Family | Disposition and exact implemented boundary | Precision, recall, limitations, and maintenance trigger | Primary source |
| --- | --- | --- | --- |
| Stripe | **Supported:** `sk_test_`, `sk_live_`, `rk_test_`, `rk_live_`, `sk_org_`, and `whsec_` plus at least 20 alphanumeric suffix characters. Publishable `pk_` keys are excluded. | Distinct secret prefixes favor precision. Short, non-alphanumeric, rotated, or future prefixes can be missed; a long synthetic prefixed identifier can be a false positive. Recheck on Stripe key-format or webhook announcements and before release. | [API keys](https://docs.stripe.com/keys), [webhook signatures](https://docs.stripe.com/webhooks/signature) |
| Slack | **Supported:** `xoxb-`, `xoxp-`, `xapp-`, `xwfp-`, `xoxe-`, `xoxe.xoxb-`, and `xoxe.xoxp-` plus at least 20 alphanumeric or hyphen characters. | Published token namespaces are strong signals, but service/legacy forms without a published prefix, shorter values, and future alphabets remain false negatives. Long documentation-shaped values can be false positives. Recheck token-type and rotation docs before release. | [token types](https://api.slack.com/concepts/token-types), [token rotation](https://api.slack.com/authentication/rotation) |
| npm | **Intentionally unsupported standalone.** Bearer use can still be caught structurally and `api_key`-style assignments contextually. | Current npm docs describe the access token as a hexadecimal string and no longer document a distinctive scanner prefix. Standalone hex matching would collide with hashes and IDs; qualify only if npm publishes a stable scannable form. | [access tokens](https://docs.npmjs.com/about-access-tokens/) |
| PyPI | **Supported:** `pypi-` followed by at least 85 base64url characters, with an unbounded delimiter-terminated suffix. | This mirrors PyPI's published minimum Macaroon serialization. Short and invalid-alphabet values are rejected; arbitrary caveats can lengthen a token. Recheck the secret-reporting grammar before release. | [secret reporting format](https://docs.pypi.org/api/secrets/) |
| Discord | **Already supported structurally for OAuth Bearer headers; standalone bot tokens intentionally unsupported.** | Discord publishes authentication header usage and an example, but not a normative standalone bot-token grammar. Guessing from the example would be reverse engineering and could miss format changes. Requalify if Discord publishes a scanner contract. | [API authentication](https://docs.discord.com/developers/reference#authentication) |
| Twilio | **Already supported structurally for Basic authorization; standalone SID/secret pairs intentionally unsupported.** | `SK` plus 32 hex digits is an API Key SID, not the separately issued secret. Auth Tokens and key secrets have no sufficiently distinctive published standalone grammar. Requalify if Twilio publishes a secret prefix or checksum usable offline. | [SID catalog](https://www.twilio.com/docs/glossary/what-is-a-sid), [API keys](https://www.twilio.com/docs/iam/api-keys) |
| SendGrid | **Already supported structurally for Bearer authorization; standalone keys not currently qualifiable.** | Official key-management docs identify the credential but do not specify a stable prefix, length, and alphabet. Do not copy third-party `SG.` regexes; requalify on an authoritative format contract. | [API keys](https://www.twilio.com/docs/sendgrid/api-reference/api-keys) |
| Azure / Microsoft Entra | **Already supported for JWTs and `client_secret` context; no Azure-specific standalone detector.** | Microsoft documents a broad client-secret alphabet and its own high-confidence classifier uses checksum/context. Reproducing an unavailable validity signal or matching all password-like strings would exceed the offline precision boundary. Recheck if a stable public scannable prefix is introduced. | [Entra client-secret definition](https://learn.microsoft.com/en-us/purview/sit-defn-azure-ad-client-secret), [credential creation](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials) |
| GCP service accounts | **Already supported:** decoded `private_key` assignments and PEM private-key blocks are detected; service-account IDs and `private_key_id` remain non-secret. | The scanner does not parse or attest an entire Google credential document and does not decode outer base64 or P12 containers. Escaped JSON `private_key` contents are caught contextually. Recheck if Google changes the service-account key container. | [service-account key format](https://cloud.google.com/iam/docs/keys-create-delete) |
| Hugging Face | **Supported:** `hf_` plus at least 20 alphanumeric, underscore, or hyphen characters. | The provider publishes and enforces the namespace but keeps the remainder opaque. The conservative minimum rejects placeholders; short/future encodings can be missed and long prefixed IDs can be false positives. Recheck Hub token docs and client validation before release. | [user access tokens](https://huggingface.co/docs/hub/en/security-tokens), [official client prefix check](https://github.com/huggingface/huggingface_hub/blob/main/src/huggingface_hub/inference/_client.py) |
| Docker | **Supported:** `dckr_pat_` and `dckr_oat_` plus at least 20 alphanumeric, underscore, or hyphen characters. | Distinct personal/organization prefixes favor precision; passwords, short examples, future token types, and different suffix encodings remain false negatives. Recheck Docker authentication docs before release. | [Docker authentication formats](https://docs.docker.com/reference/api/ai-governance/#authentication) |
| Cloudflare | **Supported:** new `cfut_` scannable API tokens plus at least 20 alphanumeric, underscore, or hyphen characters. | The new namespace is explicitly intended for scanners. Legacy unprefixed API tokens/global keys remain unsupported to avoid broad random-string or hex matching. Recheck Cloudflare's scannable-format page before release. | [create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) |
| DigitalOcean | **Supported:** `dop_v1_`, `doo_v1_`, and `dor_v1_` plus at least 20 alphanumeric, underscore, or hyphen characters. | Versioned provider prefixes are high signal. Short examples, endpoint-specific agent keys, future versions, and changed alphabets can be missed; long prefixed IDs can be false positives. Recheck the OAuth authentication section before release. | [OAuth token prefixes](https://docs.digitalocean.com/products/inference/reference/api/dedicated-inference/#oauth-authentication) |
| Datadog | **Intentionally unsupported standalone.** Generic `api_key` assignments remain contextual only. | Official docs define API/application key roles and headers but no distinctive standalone scanner namespace. Matching unprefixed hashes would collide with checksums and commit IDs. Requalify if Datadog publishes a prefix or an offline validation contract. | [API and application keys](https://docs.datadoghq.com/account_management/api-app-keys/), [authentication headers](https://docs.datadoghq.com/api/latest/authentication/) |
| Linear | **Supported:** `lin_api_` and `lin_oauth_` plus at least 20 alphanumeric, underscore, or hyphen characters. | Linear introduced the prefixes specifically for secret scanning. Older unprefixed keys, short values, and future alphabets remain false negatives; synthetic prefixed IDs can be false positives. Recheck Linear security announcements before release. | [secret-scanning announcement](https://linear.app/changelog/2021-08-19-github-secret-scanning) |
| Notion | **Not currently qualifiable standalone.** Bearer use and high-signal generic assignments can still be caught structurally/contextually. | Notion documents `ntn_` and legacy `secret_` but explicitly advises against regex validation because the opaque format may change. `secret_` is also too generic for standalone high confidence. Revisit only with a scanner-specific contract. | [token-format announcement](https://developers.notion.com/page/changelog#september-11-2024) |
| Supabase | **Supported:** elevated `sb_secret_` keys plus at least 20 alphanumeric, underscore, or hyphen characters. Publishable `sb_publishable_` keys are excluded; legacy `service_role` JWTs remain covered structurally as JWTs. | Privilege semantics make the secret/public distinction important. Short/future suffixes can be missed; a long synthetic prefixed ID can be a false positive. Recheck the API-key migration docs before release and at the stated legacy-key deprecation. | [API key types](https://supabase.com/docs/guides/getting-started/api-keys) |
| Vercel | **Supported:** `vcp_`, `vci_`, `vca_`, `vcr_`, and `vck_` plus at least 20 alphanumeric, underscore, or hyphen characters. | The prefixes were introduced for visual identification and secret scanning. Old unprefixed credentials, short values, and future alphabets can be missed; synthetic prefixed IDs can be false positives. Recheck Vercel token-format announcements before release. | [new token formats](https://vercel.com/changelog/new-token-formats-and-secret-scanning), [access-token example](https://vercel.com/docs/sign-in-with-vercel/tokens#access-token) |

Earlier qualification remains in force for GitHub, GitLab, Shopify, Vault, and
Twilio SID exclusion: [GitHub token prefixes](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats), [GitHub's installation-token rollout](https://github.blog/changelog/2026-05-15-github-app-installation-tokens-per-request-override-header/), [GitLab prefixes](https://docs.gitlab.com/security/tokens/#token-prefixes), [Shopify access-token types](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens#access-token-types), and [Vault prefixes](https://developer.hashicorp.com/vault/docs/concepts/tokens#token-prefixes).

Recheck all accepted and deferred sources before each public release and on any
upstream credential-format announcement. This is repository maintenance;
runtime detection remains offline and deterministic.

## Boundaries and tradeoffs

Strict prefixes, lengths, conservative alphabets, token boundaries, and complete private-key delimiters favor precision. Qualified additional providers use a 20-character opaque-suffix floor unless the provider publishes a stronger minimum, as PyPI does. This rejects placeholders and abbreviations but can miss real short or newly encoded values; conversely, a long provider-prefixed synthetic identifier can be a false positive because offline matching cannot establish liveness. GitHub installation values below the documented minimum and values outside the documented rollout-safe alphabet are rejected; other GitHub families retain intentionally narrow fixed shapes and can miss future length changes. GitLab customized PAT prefixes, short suffixes, and future prefixes remain false negatives. JWTs using differently encoded, serialized, or encrypted forms are excluded unless they have the accepted three base64url-looking segments and encoded JSON-object-style header and payload prefixes. Legacy Vault `s.`, `b.`, and `r.` forms are intentionally excluded. The rules can also miss lone truncated private keys, short development credentials, and legacy or new provider variants. A normally paired private-key block requires encoded body evidence; multiple, nested, out-of-order, or mismatched exact supported delimiters instead produce one fail-safe outermost finding through resolution or end of input. That conservative malformed rule can classify documentation containing multiple exact private-key headers. Malformed delimiter spellings, public-key blocks, certificates, and unsupported-label near-matches remain excluded. A match indicates a likely credential, not that it is live: the core performs no provider validation or network access.

Findings expose classification and offsets, never the matched plaintext. Client scanning is preventive UX; security-sensitive consumers must scan again on the server.

## Evidence and references

- Source: [built-in detector registry](../../../src/detectors/index.ts), [additional providers](../../../src/detectors/additional-providers.ts), [private key](../../../src/detectors/private-key.ts), [AWS](../../../src/detectors/aws.ts), [GitHub](../../../src/detectors/github.ts), [GitLab](../../../src/detectors/gitlab.ts), [JWT](../../../src/detectors/jwt.ts), [Bearer](../../../src/detectors/bearer-token.ts), [OpenAI](../../../src/detectors/openai.ts), [Anthropic](../../../src/detectors/anthropic.ts), [Shopify](../../../src/detectors/shopify.ts), and [Vault](../../../src/detectors/vault.ts)
- Tests: [conformance corpus](../../../test/conformance/README.md), [conformance runner](../../../test/conformance/conformance.test.ts), [positive and boundary coverage](../../../test/detectors/known-formats.test.ts), [false positives](../../../test/false-positives/known-formats.test.ts), and [regex safety](../../../test/detectors/regex-safety.test.ts)
- Architecture: [known-format detectors](../../../ARCHITECTURE.md#known-format-detectors), [conflict resolution](../../../ARCHITECTURE.md#conflict-resolution), and [public result safety](../../../ARCHITECTURE.md#public-result-safety)
- Completed work item: [secret-scan-00003](../../plans/archived/secret-scan-00003.detect-high-confidence-credential-formats.md)
- Provider qualification: [secret-scan-00009](../../plans/archived/secret-scan-00009.qualify-provider-token-families.md)
- Coverage requalification: [secret-scan-00017](../../plans/archived/secret-scan-00017.requalify-credential-coverage.md)
- Additional-provider qualification: [secret-scan-00023](../../plans/archived/secret-scan-00023.qualify-additional-provider-families.md)
- Stable-release corpus qualification: [secret-scan-00024](../../plans/archived/secret-scan-00024.qualify-stable-release-corpus.md)
- PEM delimiter hardening: [secret-scan-00016](../../plans/archived/secret-scan-00016.handle-pem-delimiters-linearly.md)
