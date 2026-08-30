# secret-scan

Deterministic secret detection and redaction for browser and server
JavaScript/TypeScript applications.

`secret-scan` inspects untrusted text before it is logged, persisted, indexed,
sent to a tool, or added to model context. The core is runtime-neutral,
side-effect free, and performs no network requests, telemetry, secret storage,
or environment-dependent lookup.

> Client-side scanning is preventive UX. Server-side scanning is the
> authoritative enforcement boundary.

## Release status

The intended package name is `@omiologic/secret-scan`. The package is currently
pre-release: no version has been selected or approved, and no release changelog
entry exists. Installation from npm applies only after a separately approved
release:

```bash
npm install @omiologic/secret-scan
```

For repository development, use `npm ci` followed by `npm run ci`.

## Quick start

All examples use unmistakably synthetic, revoked values.

```ts
import { scanAndRedact } from "@omiologic/secret-scan";

const input = "API_KEY=SYNTHETIC_REVOKED_CONTEXT_VALUE";
const result = scanAndRedact(input);

console.log(result.text);
// API_KEY=<SECRET_1>
```

Findings contain classification, action, and original-input offsets. They never
contain the matched plaintext value.

```ts
result.findings[0];
// {
//   id: "finding-1",
//   type: "contextual_secret",
//   detector: "generic-token",
//   confidence: "high",
//   action: "redact",
//   start: 8,
//   end: 39
// }
```

Offsets are JavaScript string offsets into the original input, including when
the sanitized text has a different length.

## Public API

### `scan(input, options?)`

Runs the built-in detectors plus any detectors supplied in `options.detectors`,
resolves overlaps, evaluates policy, and returns immutable findings.

```ts
import { scan } from "@omiologic/secret-scan";

const findings = scan("password=SYNTHETIC_REVOKED_PASSPHRASE");
```

### `redact(input, findings, options?)`

Reconstructs text in one ordered pass. Findings with `redact` or `block`
actions are replaced. Findings with `warn` or `allow` remain unchanged.

```ts
import { redact, scan } from "@omiologic/secret-scan";

const input = "client_secret=SYNTHETIC_REVOKED_CLIENT_VALUE";
const findings = scan(input);
const safeText = redact(input, findings);
```

The default placeholders are `<SECRET_1>`, `<SECRET_2>`, and so on. A typed
formatter is included:

```ts
import {
  scanAndRedact,
  typedPlaceholderFormatter,
} from "@omiologic/secret-scan";

const result = scanAndRedact(
  "api_key=SYNTHETIC_REVOKED_TYPED_VALUE",
  { placeholderFormatter: typedPlaceholderFormatter },
);
// api_key=<CONTEXTUAL_SECRET_1>
```

A custom formatter receives only normalized finding metadata and a one-based
placeholder index—not the input or matched value. It must return a non-empty
string of at most 256 characters and must not reproduce a detected value.

```ts
const result = scanAndRedact(input, {
  placeholderFormatter(finding, { placeholderIndex }) {
    return `<REMOVED_${finding.type}_${placeholderIndex}>`;
  },
});
```

### `scanAndRedact(input, options?)`

Scans once, evaluates policy once, and returns:

```ts
interface ScanResult {
  readonly text: string;
  readonly findings: readonly SecretFinding[];
}
```

### `createIncrementalSanitizer(options)`

Incrementally sanitizes chunked strings without treating chunk boundaries as
detection boundaries. Every session requires explicit input and plaintext
retention limits. Concatenate the `text` and `findings` returned by each
`append` call and the required final `finalize` call.

```ts
import { createIncrementalSanitizer } from "@omiologic/secret-scan";

const session = createIncrementalSanitizer({
  limits: {
    maxInputCodeUnits: 1_000_000,
    maxBufferedCodeUnits: 32_896,
    maxTokenCodeUnits: 8_192,
    maxMultilineCodeUnits: 32_768,
  },
});

const first = session.append("api_key=SYNTHETIC_REVOKED_");
const second = session.append("INCREMENTAL_VALUE\nordinary text");
const final = session.finalize();

const safeText = first.text + second.text + final.text;
// api_key=<SECRET_1>\nordinary text
```

`abort()` discards retained plaintext. Any limit, lifecycle, policy, detector,
or formatter failure also discards retained plaintext and throws a fixed,
input-free `IncrementalSanitizerError`. Custom synchronous detectors are not
accepted because they do not declare deterministic retention bounds. A custom
incremental policy receives `{ findingIndex }`, not the unknowable final
whole-input finding count. `maxBufferedCodeUnits` applies only to unresolved
plaintext still held by the session; finalized safe output does not accumulate
against it, so transport chunk partitioning does not change acceptance.

### Stream adapters

Runtime adapters are isolated package subpaths and accept UTF-8 byte chunks.
Each uses one fatal, stateful decoder, so a multibyte character may safely span
chunks and malformed UTF-8 fails without releasing buffered plaintext.

Node.js consumers receive a native `Transform` whose output is UTF-8 bytes:

```ts
import { Readable } from "node:stream";
import { createNodeStreamSanitizer } from "@omiologic/secret-scan/node-stream";

const adapter = createNodeStreamSanitizer({
  limits: {
    maxInputCodeUnits: 1_000_000,
    maxBufferedCodeUnits: 32_896,
    maxTokenCodeUnits: 8_192,
    maxMultilineCodeUnits: 32_768,
  },
});
const output = Readable.from([inputBytes]).pipe(adapter);
```

Modern browsers receive a `TransformStream<Uint8Array, string>`:

```ts
import { createWebStreamSanitizer } from "@omiologic/secret-scan/web-stream";

const adapter = createWebStreamSanitizer({
  limits: {
    maxInputCodeUnits: 1_000_000,
    maxBufferedCodeUnits: 32_896,
    maxTokenCodeUnits: 8_192,
    maxMultilineCodeUnits: 32_768,
  },
});
const safeStrings = response.body.pipeThrough(adapter);
```

After normal finalization, `adapter.findings` contains immutable findings with
absolute offsets. Node destruction and Web readable cancellation or writable
abort discard retained plaintext. The Web adapter also exposes `abort()` for
explicit early termination. Adapter and decoder failures use fixed,
input-free errors. Importing the root or Web subpath never resolves Node-only
modules.

### Core types

```ts
type SecretConfidence = "high" | "medium" | "low";
type SecretAction = "redact" | "block" | "warn" | "allow";

interface SecretFinding {
  readonly id: string;
  readonly type: string;
  readonly detector: string;
  readonly confidence: SecretConfidence;
  readonly action: SecretAction;
  readonly start: number;
  readonly end: number;
}
```

The package also exports the detector registry, built-in detector instances,
the entropy helper, default policy, placeholder formatters, extension types,
and sanitized `SecretScanError` and `SecretRedactionError` classes.

## Policy

Detection and enforcement are separate. A policy receives immutable detection
metadata without plaintext and returns one action.

The default policy is:

| Detection | Default action |
| --- | --- |
| Private-key block | `block` |
| Known provider, bearer/JWT, authorization, or connection credential | `redact` |
| Other high-confidence secret | `redact` |
| Other medium- or low-confidence secret | `warn` |

Consumers can supply a stricter server policy without changing detection:

```ts
import type { SecretPolicy } from "@omiologic/secret-scan";

const serverPolicy: SecretPolicy = {
  evaluate(finding) {
    return finding.confidence === "high" ? "block" : "warn";
  },
};

const result = scanAndRedact(request.content, { policy: serverPolicy });
if (result.findings.some((finding) => finding.action === "block")) {
  throw new Error("Blocked sensitive input");
}
```

Policy and formatter exceptions are replaced with fixed, input-free library
errors. The original exception is not attached as a cause.

## Detection coverage

Built-in detection includes:

- PEM-style private-key blocks;
- AWS access-key IDs;
- GitHub classic and fine-grained tokens;
- GitLab tokens with documented standard prefixes;
- JWT structure and bearer credentials;
- OpenAI and Anthropic API-key shapes;
- Shopify Admin and delegate access tokens;
- modern HashiCorp Vault service, batch, and recovery tokens;
- contextual credential assignments;
- Basic and Token authorization headers; and
- credential-bearing PostgreSQL, MySQL, MariaDB, MongoDB, Redis, and AMQP URLs.

Entropy is only a supporting signal. Random-looking text is not classified
without structural or contextual evidence, and the generic name `token` alone
is deliberately ignored.

Strict prefixes, supported URI schemes, minimum lengths, bounded values, and
placeholder exclusions favor precision. The tradeoff is that truncated,
short, newly introduced, or unsupported credential formats can be missed.
Server applications should combine this library with appropriate request
limits and other security controls; it is not a complete DLP system.

## Browser boundary

Scan before constructing the request body so the original value does not leave
the device:

```ts
const result = scanAndRedact(userInput);
showSecretWarning(result.findings);

await fetch("/api/conversation", {
  method: "POST",
  body: JSON.stringify({ content: result.text }),
});
```

## Server boundary

Scan again before logging, persistence, context construction, or model/tool
invocation. This protects direct API clients, older or modified clients, CLIs,
SDKs, MCP integrations, and agents.

```ts
const result = scanAndRedact(request.content, { policy: serverPolicy });

if (result.findings.some((finding) => finding.action === "block")) {
  throw new Error("Blocked sensitive input");
}

await conversationStore.save(result.text);
return modelGateway.respond({ input: result.text });
```

Avoid logging raw request or tool bodies before scanning.

## Runtime and package compatibility

- ESM package with explicit root, `./node-stream`, and `./web-stream` exports.
- Node.js 20 or newer.
- Modern browsers capable of running ES2022 output.
- No Node-only or DOM dependency in the runtime core; Node stream imports are
  isolated to `./node-stream`.
- No CommonJS build.
- Incremental core accepts JavaScript strings; stream adapters accept UTF-8
  bytes and own their stateful decoding.

Once a public version is approved, the documented root exports and their
TypeScript contracts constitute the SemVer public API. Files under internal
package paths are not public API. Published version identifiers are immutable.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run ci
```

The test suite covers deterministic detection, false positives, overlap
resolution, redaction and policy invariants, error safety, browser bundling,
Node import, representative 1 KB/100 KB/1 MB performance thresholds, and
dry-run package contents. Package inspection uses `0.0.0-inspection` only inside a
temporary directory because selecting a release version requires explicit
approval.

## Security and release process

See [SECURITY.md](./SECURITY.md) for private vulnerability reporting and the
security model. Never submit active credentials in a report or fixture.

A release requires explicit user approval after tests pass and the public API
and required changelog entry have been reviewed. Readiness checks do not choose
a version or authorize a tag, package publication, deployment, or release.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for processing, trust boundaries,
overlap resolution, and extension constraints.

## License

[MIT](./LICENSE)
