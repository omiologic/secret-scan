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
- JWT structure
- bearer tokens
- provider-specific API key formats

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

Overlaps should be resolved deterministically with precedence roughly as follows:

1. private key / highly specific credential
2. provider-specific detector
3. structural detector
4. contextual detector
5. entropy-only candidate

## Policy evaluation

Detection and enforcement are separate concerns.

```ts
export interface SecretPolicy {
  evaluate(
    finding: SecretFinding,
    context: PolicyContext
  ): SecretAction;
}
```

```ts
type SecretAction = "redact" | "block" | "warn" | "allow";
```

This allows a browser chat input to redact and warn, while a production API may choose to block the same private key entirely.

## Redaction engine

The default placeholder strategy is semantic and non-recoverable:

```text
<SECRET_1>
<SECRET_2>
<SECRET_3>
```

Typed placeholders may be supported:

```text
<API_KEY_1>
<PRIVATE_KEY_1>
<BEARER_TOKEN_1>
```

Partial masking such as `sk-proj-****abcd` may be useful in credential-management UI, but it is not the preferred strategy for conversational redaction.

## Public result safety

Preferred result shape:

```ts
interface ScanResult {
  text: string;
  findings: SecretFinding[];
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

Recommended layout:

```text
src/
├── detectors/
│   ├── anthropic.ts
│   ├── aws.ts
│   ├── bearer-token.ts
│   ├── connection-string.ts
│   ├── generic-token.ts
│   ├── github.ts
│   ├── jwt.ts
│   ├── openai.ts
│   └── private-key.ts
├── entropy.ts
├── policy.ts
├── redact.ts
├── registry.ts
├── scan.ts
├── types.ts
└── index.ts
```

Runtime-specific helpers can later be added as adapters:

```text
adapters/
├── node-stream.ts
├── web-stream.ts
└── web-worker.ts
```

## Runtime constraints

The core should prefer JavaScript and Web Platform primitives.

Avoid coupling core logic to:

- `fs`
- browser storage
- DOM APIs
- server frameworks
- Node-only crypto APIs unless isolated behind an adapter

## Build strategy

Recommended:

- TypeScript
- ESM-first
- declaration output
- explicit package `exports`
- tree-shakeable detectors
- Node 20+ for development/CI
- browser-compatible runtime code

A CommonJS build should only be added if consumer demand justifies it.

## Performance and regex safety

v0.1 should prioritize correctness while avoiding pathological regular expressions.

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

The core package should not provide UI components in v0.1. Consumers can build review flows using findings and offsets.

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

Initial public extension points should be limited to:

- custom detectors
- detector registry
- custom policy
- placeholder formatter

Internal candidate-resolution mechanics should remain private until the algorithm stabilizes.

## Initial milestone

The first publishable version should prove four things:

1. Browser and server use the same core.
2. High-confidence credentials can be detected without network calls.
3. Sanitized output preserves enough semantic structure for downstream reasoning.
4. False-positive behavior is testable and tunable.

Recommended v0.1 acceptance criteria:

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
