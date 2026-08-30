# Architecture

## Overview

`secret-scan` is a deterministic text-inspection library for detecting and redacting credentials before untrusted content crosses a trust boundary.

The same core runtime is intended to work in modern browsers, Node.js services, CLIs, serverless runtimes, MCP clients/servers, and agent/tool gateways.

The core package must not depend on an AI model, network service, filesystem, database, secret manager, or UI framework.

## Core security boundary

The key architectural distinction is between intentional credential storage and conversational/textual context.

```text
Intentional credential path

User
  |
  v
Credential Manager
  |
  v
Secret Vault
  |
  v
Provider Gateway
  |
  v
External Provider
```

```text
Untrusted text path

User / Tool / MCP / Log
          |
          v
      secret-scan
          |
          v
     Sanitized Text
          |
          v
Conversation / Context / Storage / Model
```

A credential vault is allowed to contain secrets. Conversation history, context, knowledge, logs, telemetry, and model prompts should not.

## Client/server model

Client-side and server-side scanning serve different purposes.

```text
Browser
┌─────────────────────────────┐
│ User input                  │
│      |                      │
│      v                      │
│ Client scan + redact        │
│      |                      │
│      v                      │
│ Review / send safe text     │
└─────────────┬───────────────┘
              |
              v
Server
┌─────────────────────────────┐
│ Server scan + redact        │
│      |                      │
│      v                      │
│ Policy                      │
│      |                      │
│      +--> block             │
│      |                      │
│      v                      │
│ Safe persistence/context    │
│      |                      │
│      v                      │
│ Model/tool boundary         │
└─────────────────────────────┘
```

### Client responsibility

The client scanner prevents high-confidence secrets from leaving the device, gives immediate feedback, and supports review before submission.

It is not authoritative.

### Server responsibility

The server scanner enforces policy regardless of client behavior and protects direct API access, outdated or modified clients, CLIs, SDK consumers, MCP integrations, agents, and future clients.

Security-sensitive consumers should always perform server-side scanning.

## Processing pipeline

```text
Input
  |
  v
Normalization
  |
  v
Detector Registry
  |
  +--> Known-format detectors
  +--> Structural detectors
  +--> Context detectors
  +--> Entropy heuristic
  |
  v
Candidate Findings
  |
  v
Overlap / conflict resolution
  |
  v
Confidence normalization
  |
  v
Policy evaluation
  |
  v
Redaction plan
  |
  v
Sanitized text + safe metadata
```

## Detector model

A detector is an independent unit.

```ts
export interface SecretDetector {
  id: string;

  detect(
    input: string,
    context: DetectorContext
  ): SecretCandidate[];
}
```

A candidate contains classification and source-range metadata, not a public copy of the detected secret.

```ts
export interface SecretCandidate {
  type: string;
  detector: string;
  start: number;
  end: number;
  confidence: SecretConfidence;
  specificity?: SecretCandidateSpecificity;
  signals?: string[];
}
```

Internally, detectors may temporarily inspect matching substrings. Those values must not escape through public results, logs, telemetry, or thrown errors.

## Detector classes

### Known-format detectors

Examples include:

- private-key blocks
- AWS access keys
- GitHub token families
- GitLab token families
- JWT structure
- bearer tokens
- provider-specific API key formats
- Shopify access tokens
- modern Vault tokens

### Structural detectors

These recognize credential-bearing syntax such as:

```text
Authorization: Bearer ...
password=...
api_key: ...
postgres://user:password@host/db
```

### Context detectors

Contextual names can increase confidence:

```text
API_KEY
SECRET_KEY
ACCESS_TOKEN
REFRESH_TOKEN
PASSWORD
PRIVATE_KEY
CLIENT_SECRET
WEBHOOK_SECRET
```

The word `token` alone should not imply a secret because it is common in AI and parser-related text.

### Entropy heuristic

Entropy helps classify unknown formats but should not be used as the sole aggressive signal. Hashes, UUIDs, build IDs, checksums, and generated identifiers may all look random.

## Conflict resolution

Multiple detectors may identify the same span. For example, a JWT bearer token may trigger bearer-token, JWT, and generic high-entropy detection.

Overlaps are resolved deterministically with this specificity precedence:

1. private key / highly specific credential
2. provider-specific detector
3. structural detector
4. contextual detector
5. entropy-only candidate

Within the same specificity tier, higher confidence wins, followed by the
narrower span, detector registration order, and detector emission order.
Candidates that omit specificity use the lowest `entropy` tier, so an
unclassified custom detector cannot displace a detector that explicitly claims
stronger structural evidence. This favors precision and bounded redaction; the
tradeoff is that a detector which understates its specificity may lose a real
overlap, while one which overstates specificity may suppress a more accurate
candidate.

## Policy evaluation

Detection and enforcement are separate concerns.

```ts
export interface SecretPolicy {
  evaluate(
    finding: DetectedSecretFinding,
    context: PolicyContext
  ): SecretAction;
}
```

```ts
type SecretAction = "redact" | "block" | "warn" | "allow";
```

The policy receives immutable classification and range metadata before an
action exists; it never receives the matched value. This allows browser and
server consumers to enforce different actions over identical detections.

## Redaction engine

The default placeholder strategy is semantic and non-recoverable:

```text
<SECRET_1>
<SECRET_2>
<SECRET_3>
```

The exported typed placeholder formatter derives labels from safe finding
types:

```text
<API_KEY_1>
<PRIVATE_KEY_1>
<BEARER_TOKEN_1>
```

Partial masking such as `sk-proj-****abcd` may be useful in credential-management UI, but it is not the preferred strategy for conversational redaction.

## Incremental scanning contract

The package exposes a bounded incremental runtime API implemented under this
contract. It does not change synchronous behavior, and independently scanning
chunks remains unsafe.

### Logical input and lifecycle

An incremental session consumes JavaScript strings. The logical original input
is the exact UTF-16 code-unit concatenation of every appended chunk, including
empty chunks and chunks that divide a surrogate pair. Runtime adapters that
start from bytes must use one stateful, fatal UTF-8 decoder and pass only decoded
strings to the core. Decoder errors belong to the adapter and must not release
undecoded or buffered input.

The state machine has four terminally distinct states:

```text
accepting --finalize--> finalized
    |             |
    +--abort------> aborted
    |
    +--failure----> failed
```

- `accepting` may receive chunks and return only output whose detection window
  is closed;
- `finalize` is required, supplies the end-of-input boundary, and may be called
  exactly once;
- `abort` discards retained plaintext and emits no further text or findings;
- a limit, detector, policy, formatter, or state failure discards retained
  plaintext, enters `failed`, and throws a fixed input-free error; and
- append, finalize, or abort after a terminal transition fails safely and does
  not expose retained state.

Garbage collection is not a security erasure guarantee for JavaScript strings.
Discarding means dropping library references and never returning, logging,
storing, or attaching buffered text to an error.

### Safe emission and final findings

An input range is emit-safe only after every built-in detector that could start
before or inside it is unable to produce or displace a finding that overlaps
that range. A chunk boundary, a minimum token length, or a provisional match is
never a closing boundary. A delimiter, a complete fixed-width match plus its
required right boundary, or explicit finalization may close a window.

The implementation may emit confirmed ordinary prefixes progressively. It must
retain an open lexical line, URL authority, variable-length token, or private-key
block until that construct closes or a configured limit fails. It must not emit
any code unit from a provisional finding, including a finding that may later
lose overlap resolution. Output fragments concatenate in original order and
must not end between the two code units of a valid surrogate pair.

Final findings are immutable and use absolute UTF-16 offsets into the logical
original input. IDs and ordering follow the synchronous pipeline. Policy is
evaluated exactly once after each finding is final, and only then may its text
or placeholder be emitted. Placeholder numbering is one-based across the
session and advances only for `redact` and `block` actions.

The existing `SecretPolicy` receives the final whole-input `findingCount`.
Progressive evaluation cannot know that value. Therefore the incremental API
must use a separate policy context that contains the zero-based finalized
`findingIndex` but no provisional or total count. The default incremental policy
has the same action mapping as `defaultSecretPolicy`. A caller that requires the
existing whole-input policy context must continue using `scan` or
`scanAndRedact`; adapting such a policy is explicit and is not guaranteed to be
behaviorally equivalent.

### Required limits

Every session must receive explicit positive safe-integer limits. There are no
environment-derived or silent defaults:

- `maxInputCodeUnits` bounds the total logical input accepted by one session;
- `maxBufferedCodeUnits` bounds plaintext retained but not yet emitted;
- `maxTokenCodeUnits` bounds an open logical line, single-line credential, JWT,
  contextual assignment, or other delimiter-terminated token; and
- `maxMultilineCodeUnits` bounds an open PEM-style private-key block.

The implementation validates the complete limit relationship before accepting
input. `maxBufferedCodeUnits` must accommodate the larger of the token and
multiline limits plus the detector lookaround reserve. A construct that reaches
a limit without a closing boundary is not reclassified as ordinary text: the
session fails before any code unit from that construct is emitted. This turns
otherwise unbounded detector shapes into explicit rejection boundaries rather
than false-negative paths.

### Detector retention inventory

| Detector family | Evidence that must remain open | Closing evidence | Bound |
| --- | --- | --- | --- |
| AWS and GitHub | Prefix, fixed body, and one boundary code unit on each side | Exact length plus a non-token right boundary or finalization | Fixed match plus lookaround reserve |
| GitLab, OpenAI, Anthropic, Shopify, and Vault | Recognized prefix and the complete opaque suffix | Non-token delimiter or finalization | `maxTokenCodeUnits` |
| JWT | All three potentially growing segments and left/right token boundaries | Non-token delimiter or finalization | `maxTokenCodeUnits` |
| Bearer, Basic, and Token authorization | Current logical line from the structural scheme through its credential | Credential delimiter, line end, or finalization | `maxTokenCodeUnits` |
| Contextual assignment | Current logical line from the possible name through the bounded value | Assignment delimiter, line end, or finalization | `maxTokenCodeUnits`; the detector still rejects values above 4,096 code units |
| Connection URL | Possible scheme boundary and complete authority through host and optional port | Authority delimiter or finalization | Existing 8,192-code-unit authority bound within `maxTokenCodeUnits` |
| Private key | Possible begin marker suffix; after recognition, the complete block through the matching footer | Matching footer, subject to overlap lookahead, or failure at the multiline limit | `maxMultilineCodeUnits` |

The open-line rule is intentionally conservative. It covers unbounded whitespace
and name portions in the current contextual regular expressions without
changing their synchronous meaning. Custom synchronous detectors have no
retention declaration and therefore are not accepted by the incremental API.
A future custom incremental detector contract would need deterministic maximum
lookbehind, match, and closing-bound declarations; adding it is not part of the
approved implementation item.

### Equivalence boundary

For built-in detectors, accepted input within all explicit limits, the default
incremental policy, and the same placeholder formatter, concatenated incremental
text and final findings must equal one `scanAndRedact` call over the concatenated
logical input. This includes actions, ordering, IDs, absolute offsets, overlap
resolution, and placeholder numbering. Chunk partitioning cannot affect the
result.

The contract intentionally does not claim equivalence for malformed UTF-8,
limit-exceeding input, aborted or failed sessions, custom synchronous detectors,
or whole-input policies that depend on `PolicyContext.findingCount`. These cases
fail or remain on the synchronous API rather than emitting potentially unsafe
plaintext. The executable partition corpus covers every UTF-16 code-unit and
UTF-8 byte boundary around representative synthetic matches and is the shared
acceptance source for the core and future stream adapters.

## Public result safety

Public result shape:

```ts
interface ScanResult {
  readonly text: string;
  readonly findings: readonly SecretFinding[];
}
```

```ts
interface SecretFinding {
  id: string;
  type: string;
  detector: string;
  confidence: SecretConfidence;
  action: SecretAction;
  start: number;
  end: number;
}
```

Do not expose:

```ts
{ value: "actual-secret" }
```

Callers that need interactive review can use the returned offsets against the original input while it remains local to that process.

## Package architecture

The initial implementation should remain one package:

```text
@omiologic/secret-scan
```

Do not prematurely split browser and server packages because the scanning core should remain runtime-neutral.

Current layout:

```text
src/
├── adapters/
│   ├── node-stream.ts
│   ├── shared.ts
│   └── web-stream.ts
├── detectors/
│   ├── anthropic.ts
│   ├── aws.ts
│   ├── bearer-token.ts
│   ├── connection-string.ts
│   ├── generic-token.ts
│   ├── github.ts
│   ├── gitlab.ts
│   ├── jwt.ts
│   ├── openai.ts
│   ├── private-key.ts
│   ├── shopify.ts
│   └── vault.ts
├── entropy.ts
├── incremental.ts
├── policy.ts
├── redact.ts
├── registry.ts
├── scan.ts
├── types.ts
└── index.ts
```

The Node and Web adapters are thin wrappers around `incremental.ts`. Shared
UTF-8 decoding and result aggregation remain runtime-neutral in
`adapters/shared.ts`; only `node-stream.ts` imports `node:stream`. A Web Worker
adapter remains a possible future extension rather than current scope.

### Stream adapter boundary

Both adapters accept `Uint8Array` chunks and keep one fatal `TextDecoder` for
the complete stream. They pass decoded strings to one incremental sanitizer,
emit only the sanitizer's finalized text, and expose accumulated immutable
finding metadata. They do not rerun detectors or policy.

The Node adapter subclasses `Transform`; `_flush` supplies the required final
input boundary and `_destroy` aborts an accepting sanitizer. The Web adapter
uses native readable and writable stream backpressure around a
`TransformStream`; close flushes, readable cancellation and writable abort drop
retained plaintext, and transform failures error both sides with sanitized
library errors. Output already emitted before a later failure was previously
finalized as safe; output retained at the failure boundary is never enqueued.

Package subpath exports isolate these surfaces:

```text
@omiologic/secret-scan             runtime-neutral core
@omiologic/secret-scan/node-stream Node Transform adapter
@omiologic/secret-scan/web-stream  Web TransformStream adapter
```

The root and Web graphs cannot resolve `node:stream`. This keeps browser
bundling independent of Node shims while preserving the whole-string entry
point.

## Runtime constraints

The core should prefer JavaScript and Web Platform primitives.

Avoid coupling core logic to:

- `fs`
- browser storage
- DOM APIs
- server frameworks
- Node-only crypto APIs unless isolated behind an adapter

## Build strategy

Current strategy:

- TypeScript
- ESM-first
- declaration output
- explicit package `exports`
- tree-shakeable detectors
- Node 20+ runtime support and Node 20/22 CI coverage
- browser-compatible runtime code

The current package intentionally has no CommonJS build. One should only be
added if consumer demand justifies the additional compatibility surface.

## Performance and regex safety

The initial release should prioritize correctness while avoiding pathological regular expressions.

Requirements:

- no catastrophic regex backtracking
- deterministic detector order
- avoid unnecessary full-string copies
- reconstruct redacted output in a single pass after findings are finalized
- benchmark representative 1 KB, 100 KB, and 1 MB inputs

Every regex detector should include adversarial tests for ReDoS risk.

## Testing strategy

The library requires strong negative testing because false positives directly harm usability.

### Positive fixtures

Use synthetic examples only. Never commit active credentials.

### Negative fixtures

Include values that may look secret-like but should remain unchanged:

- SHA hashes
- UUIDs
- Git commit IDs
- model names
- CSS hashes
- random test IDs
- long numeric IDs
- source-map fragments

### Core invariants

1. Redacted output must not contain detected plaintext secrets.
2. Public findings must not contain secret values.
3. Identical input/configuration must produce identical findings.
4. Findings must not overlap after conflict resolution.
5. Offsets must refer to the original input.
6. Scanning sanitized output must not rediscover the original secret.

## Browser UX integration

The initial core package should not provide UI components. Consumers can build
review flows using findings and offsets.

Example UX:

```text
Sensitive credential detected

2 values will be removed before sending.

[Send safely] [Review]
```

## Server integration

Recommended request path:

```text
HTTP request
   |
   v
parse request
   |
   v
secret-scan
   |
   +--> policy block -> safe error
   |
   v
sanitized text
   |
   +--> persistence
   +--> logs/traces
   +--> context construction
   +--> model invocation
```

Applications should avoid logging raw request bodies before scanning.

## MCP and agent integration

Tool output is an important exfiltration path.

```text
Tool execution
    |
    v
Raw output
    |
    v
secret-scan
    |
    v
Sanitized result
    |
    v
Agent/model context
```

Framework-specific wrappers should remain outside core until common abstractions stabilize.

## Error handling and telemetry

Errors must not contain input fragments that could include secrets.

The core library should emit no telemetry.

Applications may record safe aggregate events such as:

```json
{
  "event": "secret.redacted",
  "type": "api_key",
  "count": 1,
  "source": "conversation_input"
}
```

They must never include plaintext secret values.

## Extension model

Public extension points are limited to:

- custom detectors
- detector registry
- custom policy
- custom incremental policy
- placeholder formatter

Internal candidate-resolution mechanics should remain private until the algorithm stabilizes.

## Initial readiness milestone

The first publishable version should prove four things:

1. Browser and server use the same core.
2. High-confidence credentials can be detected without network calls.
3. Sanitized output preserves enough semantic structure for downstream reasoning.
4. False-positive behavior is testable and tunable.

Implemented readiness criteria:

- `scan`, `redact`, and `scanAndRedact`
- typed detector interface
- typed policy interface
- semantic placeholders
- private-key detector
- bearer/JWT detector
- GitHub detector
- AWS detector
- OpenAI/Anthropic detector strategy
- generic key/value contextual detector
- entropy helper
- overlap resolver
- Vitest suite
- browser build test
- Node build test
- CI
- README
- ARCHITECTURE
- SECURITY
- MIT license

## Future: Context Safety Gateway

`secret-scan` should stay focused even if it later becomes one component of a broader safety layer.

```text
Untrusted Context
      |
      v
Context Safety Gateway
      |
      +--> secret-scan
      +--> PII policy
      +--> prompt-injection analysis
      +--> organization data policy
      +--> provenance checks
      |
      v
Approved Context
```

The scanner should remain independently publishable rather than absorbing every context-safety concern.
