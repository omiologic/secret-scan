# Contextual credential detection

**State: current**

## What it does and why

The scanner detects likely credentials that lack a provider-specific shape by requiring credential-bearing names or syntax. This covers common configuration assignments, authorization headers, and passwords embedded in supported connection URLs without treating every random-looking string as a secret.

## How it works

The contextual detector normalizes selected key names, bounds value length, excludes common references and placeholders, and uses Shannon entropy only to adjust confidence. Its quoted-value lexer uses backslash parity to keep escaped quotes, slashes, and Unicode escape spellings inside one complete encoded span without decoding them. A separate structural detector selects only the original, undecoded password portion of a supported `user:password@host` URL. It validates percent escapes, bracketed IPv6 hosts, and numeric ports without transforming source offsets. The shared pipeline resolves any overlap in favor of more specific provider evidence.

## Supported now

- High-signal assignments such as `API_KEY=SYNTHETIC_REVOKED_FEATURE_VALUE`, including supported JSON-, YAML-, camelCase-, dotted-, and kebab-style names.
- Single- and double-quoted values up to 4,096 UTF-16 code units, with odd backslash runs escaping a matching quote and even runs allowing it to close; redaction preserves the surrounding quote and container syntax.
- Conservative handling of ambiguous names such as `credential` and `signing_key`.
- Basic and Token authorization header credentials.
- Encoded or unencoded password spans in PostgreSQL, MySQL, MariaDB, MongoDB, Redis, and AMQP URL variants, including valid bracketed IPv6 hosts and numeric ports.
- Standard `mongodb://` comma-separated seed lists; `mongodb+srv://` remains
  restricted to one DNS host without an explicit port.
- Redis and TLS Redis authorities with either `user:password@host` or
  `:password@host` userinfo.
- AWS `AWS_SECRET_ACCESS_KEY` / `aws_secret_access_key` and
  `AWS_SESSION_TOKEN` / `aws_session_token` assignment names, including their
  normalized dotted camel-case SDK forms.
- Deterministic entropy calculation over Unicode code points as a supporting exported helper.

## Planned or considered

- **current:** The shared [detector conformance corpus](../../../test/conformance/README.md) records assignment, authorization, connection-string, exclusion, overlap, boundary, and adversarial behavior.
- **current:** The corpus labels representative `.env`, JSON, YAML, TOML,
  shell, PowerShell, infrastructure, source-code, HTTP, log, transcript, chat,
  Markdown, and XML host contexts. These prove lexical offset behavior, not
  semantic parsing of those formats.
- **unknown:** The timing and scope of broader URI schemes or naming conventions remain undefined.

## Qualification record

Reviewed on 2026-08-30 against [MongoDB connection-string formats](https://www.mongodb.com/docs/manual/reference/connection-string-formats/), [Redis CLI URI and authentication guidance](https://redis.io/docs/latest/develop/tools/cli/), and [AWS access-key settings](https://docs.aws.amazon.com/sdkref/latest/guide/feature-static-credentials.html). Recheck these sources before each public release and whenever an upstream syntax announcement is identified; the runtime never performs those lookups.

- MongoDB documents `host1[:port1][,...hostN[:portN]]` for the standard scheme
  and exactly one host with no port for SRV. The detector accepts those bounded
  ASCII host forms. Unix-domain-socket and non-ASCII host variants remain
  excluded, so they are known false negatives; accepting a syntactically valid
  synthetic seed list can be a false positive because no host is resolved.
- Redis documents optional user and password components and password-only
  authentication. Empty-username `:password@host` is therefore accepted only
  for `redis` and `rediss`; accepting it for other schemes would broaden false
  positives without equivalent source support. Placeholder and empty passwords
  remain excluded.
- AWS documents the secret-access-key and session-token environment, shared
  file, and SDK setting names. They are accepted as high-signal context rather
  than provider-specific value shapes because AWS does not document one stable
  offline session-token shape. Values below eight code units and obvious
  references/placeholders remain false negatives by design. High-entropy values
  become high-confidence and default to `redact`; lower-entropy accepted values
  stay medium-confidence and default to `warn`. Detection does not choose that
  policy outcome.

## Boundaries and tradeoffs

The generic name `token`, entropy-only text, environment/file references, placeholders, host-only URLs, malformed percent escapes or authorities, and unsupported URL schemes do not trigger findings. A quoted contextual candidate is rejected as a whole, never partially matched, when it contains a physical line ending, lacks a closing quote, continues with non-delimiter text after that quote, or exceeds the length bound. The lexer deliberately does not validate or decode the host format, so it can accept a complete spelling that a JSON, YAML, or shell parser rejects, and it can miss multiline or host-specific quoting forms. Connection scanning accepts only ASCII userinfo syntax and a fixed scheme allowlist, does not decode encoded placeholders, and abandons oversized authorities. MongoDB standard seed lists require every comma-separated host to pass the same host/port checks, while SRV authorities require one three-label DNS name without a port. Empty usernames are accepted only for Redis password-only authorities. These choices reduce false positives and bound work, but can miss non-ASCII, unusually long, Unix-socket, nonstandard-host, or unsupported credentials; an encoded placeholder can still be classified because its bytes are intentionally not decoded. Entropy is not evidence of credential liveness.

Medium-confidence contextual findings default to `warn`, so their text is unchanged unless a consumer supplies a stricter policy. Findings and errors do not include the matched value.

## Evidence and references

- Source: [contextual assignments and authorization](../../../src/detectors/generic-token.ts), [connection strings](../../../src/detectors/connection-string.ts), and [entropy helper](../../../src/entropy.ts)
- Tests: [conformance corpus](../../../test/conformance/README.md), [conformance runner](../../../test/conformance/conformance.test.ts), [contextual and boundary coverage](../../../test/detectors/contextual.test.ts), [contextual false positives](../../../test/false-positives/contextual.test.ts), and [entropy behavior](../../../test/detectors/entropy.test.ts)
- Architecture: [structural detectors](../../../ARCHITECTURE.md#structural-detectors), [context detectors](../../../ARCHITECTURE.md#context-detectors), and [entropy heuristic](../../../ARCHITECTURE.md#entropy-heuristic)
- Completed work item: [secret-scan-00004](../../plans/archived/secret-scan-00004.detect-contextual-secrets.md)
- Completed work item: [secret-scan-00008](../../plans/archived/secret-scan-00008.handle-encoded-connection-credentials.md)
- Completed work item: [secret-scan-00013](../../plans/archived/secret-scan-00013.preserve-structured-quoted-secrets.md)
- Coverage requalification: [secret-scan-00017](../../plans/archived/secret-scan-00017.requalify-credential-coverage.md)
- Stable-release corpus qualification: [secret-scan-00024](../../plans/archived/secret-scan-00024.qualify-stable-release-corpus.md)
