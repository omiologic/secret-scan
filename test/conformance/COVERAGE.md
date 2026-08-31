# Stable-release conformance coverage

This table is generated from validated fixture metadata and the executable
incremental corpus. “Yes” means at least one stable fixture supplies that
evidence for the detector; it does not mean every possible credential shape is
detectable. “N/A” is permitted only with the explicit reason below.

| Detector | positive | near-miss | false-positive | context | overlap | mutation | incremental | adversarial | regression |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `private-key` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `aws-access-key` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `github-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `gitlab-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `openai-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `anthropic-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `shopify-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `vault-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `stripe-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `slack-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `pypi-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `huggingface-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `docker-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `cloudflare-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `digitalocean-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `linear-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `supabase-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `vercel-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `jwt` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `bearer-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |
| `connection-string` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `generic-token` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | N/A¹ |

¹ No confirmed detector defect has required a family-specific regression fixture; the permanent regression intake rule still applies.

## Interpretation

- Positive and near-miss evidence establishes only the documented lexical
  grammars and their immediate rejected neighbors.
- False-positive evidence covers common hashes, checksums, UUIDs, ULIDs,
  generated IDs, CSS/source-map hashes, base64 assets, JWT-like examples,
  package integrity values, and model identifiers. It is representative, not
  exhaustive.
- Context evidence includes `.env`, JSON, YAML, TOML, shell, PowerShell,
  Docker Compose, GitHub Actions, Terraform, Kubernetes, JavaScript,
  TypeScript, Python, HTTP, curl, logs, terminal transcripts, stack traces,
  chat, Markdown fences, and XML. These fixtures establish lexical scanning,
  not host-language parsing or validity.
- Incremental evidence means the detector appears in the all-boundary UTF-16
  and streaming UTF-8 equivalence corpus. Adapter lifecycle and malformed-byte
  behavior remain in their focused suites.
- Adversarial evidence has per-fixture input, finding-count, and runtime caps.
  The caps are deterministic regression gates, not production sizing advice.

Residual gaps are intentional and remain documented in the feature notes:
unsupported provider variants, host-language semantic decoding, credential
liveness, encrypted or differently serialized tokens, and inputs outside the
declared synchronous or incremental bounds. Test count is never treated as a
completeness claim.
