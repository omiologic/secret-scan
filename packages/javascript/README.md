# @omiologic/secret-scan

Deterministic secret detection and redaction for browser and server
JavaScript/TypeScript applications.

One typed API, two artifacts: the package's `exports` map selects the Node
N-API addon on Node.js and the browser WebAssembly build everywhere else
(`decision-define-runtime-bindings`). Every built-in detector runs in the Rust
core, so both runtimes see the same findings for the same input.

## Install

```bash
npm install @omiologic/secret-scan
```

Node.js 20 or newer, or a browser that can run ES2022 output. The package is
ESM only.

## Initialize once, then work synchronously

Every runtime requires one successful `await initialize()` before any
synchronous operation. On Node the underlying setup has nothing to await, but
the call stays part of the contract so the usage model does not vary by
runtime. It is idempotent, so any number of call sites may await it; a failed
attempt is not cached and may be retried.

```ts
import { initialize, scanAndRedact } from "@omiologic/secret-scan";

await initialize();

const { text, findings } = scanAndRedact("API_KEY=SYNTHETIC_REVOKED_VALUE");

if (findings.some((finding) => finding.action === "block")) {
  throw new Error("Blocked sensitive input");
}

console.log(text);
```

Calling a synchronous operation first throws `SecretScanError` with code
`NOT_INITIALIZED`, without inspecting the input.

## Scan, redact, or both

```ts
import { initialize, redact, scan } from "@omiologic/secret-scan";

await initialize();

const input = "API_KEY=SYNTHETIC_REVOKED_VALUE";
const findings = scan(input);
const redacted = redact(input, findings);
```

`scanAndRedact` does the same in one call, so the text and the findings cannot
disagree. `redact` expects the findings `scan` returned for that same input.

Every finding is frozen and carries only safe metadata — id, type, detector,
confidence, action, and a range. It never carries the matched value.

## Offsets are UTF-16 code units

`start` and `end` index the JavaScript string you passed in, so
`input.slice(start, end)` selects exactly the matched span. The exported
`RANGE_UNIT` states this, and the Rust core's UTF-8 byte offsets are converted
by each binding without changing the selected span.

```ts
import { initialize, RANGE_UNIT, scan } from "@omiologic/secret-scan";

await initialize();

const input = "🔑 API_KEY=SYNTHETIC_REVOKED_VALUE";
const [finding] = scan(input);

if (finding !== undefined) {
  console.log(RANGE_UNIT, input.slice(finding.start, finding.end));
}
```

## Custom policy and placeholder formatter

The first stable extension surface is a policy and a placeholder formatter.
Both receive safe metadata only, never the input or a matched value. Custom
detector callbacks are not part of this API.

```ts
import {
  initialize,
  scanAndRedact,
  typedPlaceholderFormatter,
} from "@omiologic/secret-scan";
import type { SecretPolicy } from "@omiologic/secret-scan";

await initialize();

const policy: SecretPolicy = {
  evaluate: (finding) => (finding.confidence === "high" ? "block" : "warn"),
};

const result = scanAndRedact("api_key=SYNTHETIC_REVOKED_VALUE", {
  policy,
  placeholderFormatter: typedPlaceholderFormatter,
});
```

Omit `policy` to use the built-in policy, which runs in Rust. Pass
`defaultPlaceholderFormatter` to name the built-in placeholder format
(`<SECRET_1>`, `<SECRET_2>`, ...) explicitly; `typedPlaceholderFormatter`
names the finding type instead (`<JWT_1>`).

## Bounded incremental sanitization

An incremental session consumes text in chunks and emits only the text and
findings whose detection window is closed. Limits are explicit UTF-16
code-unit counts; there are no defaults. Findings carry absolute offsets into
the logical whole-session input.

Incremental sanitization is not available in the browser: `bindings/wasm`
does not build a streaming session, so `createIncrementalSanitizer` (and
`@omiologic/secret-scan/web-stream`, below) rejects with the fixed
`INCREMENTAL_UNAVAILABLE` code there. `await initialize()` and the
synchronous `scan`/`redact`/`scanAndRedact` operations are unaffected.

```ts
import { createIncrementalSanitizer, initialize } from "@omiologic/secret-scan";

await initialize();

const session = createIncrementalSanitizer({
  limits: {
    maxInputCodeUnits: 4_096,
    maxBufferedCodeUnits: 2_176,
    maxTokenCodeUnits: 1_024,
    maxMultilineCodeUnits: 2_048,
  },
});

let output = session.append("first line\n").text;
output += session.append("api_key=SYNTHETIC_REVOKED_VALUE\n").text;
output += session.finalize().text;
```

A session is `accepting`, then terminally `finalized`, `aborted`, or `failed`.
`abort()` discards retained plaintext and emits nothing further.

## Streams

Two subpaths wrap one incremental session in the host's own stream contract,
so byte streams do not have to be buffered whole. Both accept UTF-8 byte
chunks through a single fatal, stateful decoder, so a multibyte character may
be split across chunks; malformed bytes fail rather than becoming `U+FFFD`.
Both emit only text whose detection window is closed and expose the findings
that have been finalized so far, frozen and with absolute offsets into the
whole stream. Both require `await initialize()` first.

`@omiologic/secret-scan/node-stream` is a `Transform`. Backpressure, error
propagation, and teardown are Node's own; a `destroy()`, a failed `pipeline`,
or a downstream error aborts the session, so the plaintext it was still
deciding about is discarded instead of flushed.

```ts
import { pipeline } from "node:stream/promises";
import { initialize } from "@omiologic/secret-scan";
import { createNodeStreamSanitizer } from "@omiologic/secret-scan/node-stream";

await initialize();

const sanitizer = createNodeStreamSanitizer({
  limits: {
    maxInputCodeUnits: 1_048_576,
    maxBufferedCodeUnits: 16_512,
    maxTokenCodeUnits: 8_192,
    maxMultilineCodeUnits: 16_384,
  },
});

await pipeline(process.stdin, sanitizer, process.stdout);

console.log(sanitizer.findings.length);
```

`@omiologic/secret-scan/web-stream` is a `TransformStream<Uint8Array, string>`
and resolves no `node:` module, so a browser bundle that uses it pulls in none
of the Node adapter. Cancelling the readable side, aborting the writable side,
and its own `abort()` all discard retained plaintext. On the WebAssembly
runtime this subpath's `createWebStreamSanitizer` rejects with the same fixed
`INCREMENTAL_UNAVAILABLE` code as `createIncrementalSanitizer`, since incremental
sanitization is not available there (see above).

```ts
import { initialize } from "@omiologic/secret-scan";
import { createWebStreamSanitizer } from "@omiologic/secret-scan/web-stream";

await initialize();

const sanitizer = createWebStreamSanitizer({
  limits: {
    maxInputCodeUnits: 1_048_576,
    maxBufferedCodeUnits: 16_512,
    maxTokenCodeUnits: 8_192,
    maxMultilineCodeUnits: 16_384,
  },
});

const response = await fetch("/upload-preview");

await response.body
  ?.pipeThrough(sanitizer)
  .pipeTo(new WritableStream({ write: (text) => void text }));
```

Each adapter also takes an already-open session directly —
`new NodeStreamSanitizer(session)`, `new WebStreamSanitizer(session)` — which
is the same thing the factories build: one session per stream, owned by the
stream.

## Errors

Every failure is a `SecretScanError` carrying nothing but a fixed `code` and
its fixed message — never the input, a matched value, a placeholder, or a
failing callback's own message.

```ts
import { initialize, scan, SecretScanError } from "@omiologic/secret-scan";
import type { SecretScanErrorCode } from "@omiologic/secret-scan";

try {
  await initialize();
  scan("API_KEY=SYNTHETIC_REVOKED_VALUE");
} catch (error) {
  if (error instanceof SecretScanError) {
    const code: SecretScanErrorCode = error.code;
    console.error(code);
  }
}
```

`NOT_INITIALIZED` and `INITIALIZATION_FAILED` come from the binding layer,
`INVALID_CHUNK` and `INVALID_UTF8` from the stream adapters, and
`INCREMENTAL_UNAVAILABLE` from the WebAssembly binding, which does not
implement incremental sanitization; every other code comes from the Rust
core.

## Public API

Runtime values: `initialize`, `scan`, `redact`, `scanAndRedact`,
`createIncrementalSanitizer`, `defaultPlaceholderFormatter`,
`typedPlaceholderFormatter`, `SecretScanError`, `RANGE_UNIT`, `VERSION`.

Types: `DetectedSecretFinding`, `SecretFinding`, `SecretAction`,
`SecretConfidence`, `SecretPolicy`, `PolicyContext`, `PlaceholderFormatter`,
`PlaceholderContext`, `ScanOptions`, `RedactOptions`, `ScanAndRedactOptions`,
`ScanResult`, `IncrementalSanitizer`, `IncrementalSanitizerOptions`,
`IncrementalSanitizerResult`, `IncrementalSanitizerState`,
`IncrementalLimits`, `IncrementalSecretPolicy`, `IncrementalPolicyContext`,
`RangeUnit`, `SecretScanErrorCode`.

Stream subpaths: `@omiologic/secret-scan/node-stream` exports
`createNodeStreamSanitizer`, `NodeStreamSanitizer`, and `SecretScanError`;
`@omiologic/secret-scan/web-stream` exports `createWebStreamSanitizer`,
`WebStreamSanitizer`, and `SecretScanError`.

The root export and those two subpaths are the whole public API. There are no
other public subpaths, and internal modules are unreachable through the
`exports` map. `VERSION` is
the shared product version; the Rust crate, this package, the Python package,
and the CLI are released in lockstep
(`decision-release-bindings-in-lockstep`), and `initialize()` refuses an
artifact that reports a different one.

## Security

Client-side scanning is preventive UX; server-side scanning is the
authoritative enforcement boundary. See
[SECURITY.md](https://github.com/omiologic/secret-scan/blob/main/SECURITY.md)
for the security model and private vulnerability reporting.

## License

[MIT](https://github.com/omiologic/secret-scan/blob/main/LICENSE)
