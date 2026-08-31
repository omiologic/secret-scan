# Policy controls

**State: current**

## What it does and why

Policy maps each finalized detection to `allow`, `warn`, `redact`, or `block` without changing how detection works. Browser UX and authoritative server enforcement can therefore take different actions over identical findings.

## How it works

After overlap resolution, `scan` passes immutable, plaintext-free finding metadata and deterministic list position to the selected `SecretPolicy`. The returned action becomes part of the public finding. `scanAndRedact` evaluates each finding once and then applies redaction behavior.

## Supported now

- A default policy that blocks private-key findings.
- Default redaction for known providers, Bearer/JWT, authorization, connection credentials, and other high-confidence findings.
- Default warnings for other medium- and low-confidence findings.
- Consumer-supplied policies, including different browser and server policies.
- Sanitized failures when policy evaluation throws or returns an invalid action.
- A distinct incremental policy with immutable final metadata and a zero-based `findingIndex`.

## Planned or considered

- **current:** The [incremental contract](../../../ARCHITECTURE.md#incremental-scanning-contract) requires exactly-once policy evaluation after each streamed finding is final.
- **current:** [Incremental scanning](../../plans/archived/secret-scan-00011.implement-incremental-sanitization.md) uses a distinct progressive policy context because the synchronous `PolicyContext.findingCount` is unknowable before end of input.
- **proposed:** Framework-specific wrappers may live outside the core after common abstractions stabilize; no implementation commitment exists.

## Boundaries and tradeoffs

The policy receives metadata, not input or matched plaintext, so it cannot evaluate credential liveness or content beyond classification, confidence, and ranges. A `block` action is a result for the consuming application to enforce; the library does not reject a request by itself. Redaction replaces `block` ranges when sanitized text is requested, while `warn` and `allow` ranges remain unchanged.

A custom policy is trusted in-process code. Although the API passes it only
immutable plaintext-free metadata, application code can still capture other
process state. Server consumers own the policy choice and must not treat a
client-selected action as authoritative.

The incremental API does not silently adapt a synchronous custom policy. Its default action mapping remains equivalent, but policies that require the final whole-input finding count remain synchronous by design.

Client policy is not authoritative. Server applications must scan and enforce policy before unsafe logging, persistence, context construction, or model/tool invocation.

## Evidence and references

- Source: [default policy](../../../src/policy.ts), [policy evaluation](../../../src/scan.ts), and [policy types](../../../src/types.ts)
- Tests: [default/custom policy, action, and failure behavior](../../../test/integration/policy-redaction.test.ts)
- Architecture: [policy evaluation](../../../ARCHITECTURE.md#policy-evaluation), [client/server model](../../../ARCHITECTURE.md#clientserver-model), and [server integration](../../../ARCHITECTURE.md#server-integration)
- Completed work items: [secret-scan-00005](../../plans/archived/secret-scan-00005.deliver-policy-redaction-apis.md) and [secret-scan-00010](../../plans/archived/secret-scan-00010.define-incremental-scanning-semantics.md)
