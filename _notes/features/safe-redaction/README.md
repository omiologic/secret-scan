# Safe redaction

**State: current**

## What it does and why

`redact` and `scanAndRedact` replace sensitive ranges while preserving the surrounding text. This prevents detected plaintext from reaching logs, storage, context, models, or tools while leaving enough structure for downstream use.

## How it works

The redactor validates and orders non-overlapping findings, then reconstructs output in one pass from original-input offsets. Findings with `redact` or `block` actions receive numbered placeholders; `warn` and `allow` findings remain unchanged.

## Supported now

- Default placeholders such as `<SECRET_1>`.
- Typed placeholders derived from safe finding types.
- Custom formatters that receive only immutable finding metadata and a one-based replacement index.
- Deterministic handling of repeated and adjacent values.
- Original-input offsets retained in findings even when replacement length differs.
- Fixed, input-free errors for invalid findings, formatters, and placeholders.
- Incremental append, finalize, and abort behavior with explicit input, token, multiline, and buffer limits.

## Planned or considered

- **current:** [Safe incremental semantics](../../../ARCHITECTURE.md#incremental-scanning-contract) define emission, retention, finalization, absolute-offset, limit, abort, and failure behavior. The [partition corpus](../../../test/conformance/incremental-partitions.ts) supplies executable reference results.
- **current:** [Incremental redaction](../../plans/archived/secret-scan-00011.implement-incremental-sanitization.md) implements those semantics through a runtime-neutral string session.
- **unknown:** Framework-specific adapters remain outside the committed scope.

## Boundaries and tradeoffs

Redaction is non-recoverable and does not provide reversible masking or credential storage. Custom placeholders must be non-empty and at most 256 UTF-16 code units. The implementation rejects a placeholder containing any replaced matched range that can fit inside it, including one-, two-, and three-code-unit caller-supplied findings. Formatters receive only metadata, not input or matched plaintext, but remain trusted in-process code and can access application-captured state. Callers that select `warn` or `allow` intentionally leave the corresponding text present.

For incremental redaction, a chunk boundary never makes text safe. Open lines,
token suffixes, URL authorities, and private-key blocks remain buffered until
their detection windows close; crossing an explicit limit fails instead of
releasing the unresolved plaintext.

The API accepts trusted finding ranges against the same original input and rejects overlaps or invalid bounds. It does not rerun detection or authenticate caller-supplied classifications and actions. Sanitized output should be used before a trust boundary, but the package does not supply UI review components or request middleware.

## Evidence and references

- Source: [redaction engine and formatters](../../../src/redact.ts), [scan-and-redact orchestration](../../../src/scan.ts), and [redaction types](../../../src/types.ts)
- Tests: [redaction invariants, formatters, offsets, and safe errors](../../../test/integration/policy-redaction.test.ts) and [README examples](../../../test/readme-examples.test.ts)
- Architecture: [redaction engine](../../../ARCHITECTURE.md#redaction-engine), [public result safety](../../../ARCHITECTURE.md#public-result-safety), and [core invariants](../../../ARCHITECTURE.md#core-invariants)
- Completed work items: [secret-scan-00005](../../plans/archived/secret-scan-00005.deliver-policy-redaction-apis.md) and [secret-scan-00010](../../plans/archived/secret-scan-00010.define-incremental-scanning-semantics.md)
