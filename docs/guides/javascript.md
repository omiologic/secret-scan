# JavaScript and TypeScript

[Documentation home](../README.md) · [Installation](../getting-started.md)

The package is ESM and exposes the same whole-input API on Node and browsers.
Initialize once before synchronous operations. Initialization is idempotent;
a failed attempt may be retried. It also checks that the binding version
matches the wrapper version.

```ts
import { initialize, scanAndRedact } from "@redact-secret/core";

await initialize();
const result = scanAndRedact("API_KEY=SYNTHETIC_REVOKED_CONTEXT_VALUE");
console.log(result.text); // API_KEY=<SECRET_1>
console.log(result.findings.length); // 1
```

`scan(input)` returns findings. `redact(input, findings)` uses findings from
that same original input. Prefer `scanAndRedact` when you need both. Findings
and result metadata are frozen and contain no matched plaintext. Their
half-open `start`/`end` offsets count UTF-16 code units in the original input.
Never log `input.slice(finding.start, finding.end)`.

## Choose a policy

```ts
import { initialize, scanAndRedact, typedPlaceholderFormatter } from "@redact-secret/core";
import type { SecretPolicy } from "@redact-secret/core";

await initialize();
const policy: SecretPolicy = { evaluate: () => "redact" };
const result = scanAndRedact("API_KEY=SYNTHETIC_REVOKED_CONTEXT_VALUE", {
  policy,
  placeholderFormatter: typedPlaceholderFormatter,
});
console.log(result.text); // API_KEY=<CONTEXTUAL_SECRET_1>
```

This policy replaces every detected finding; it cannot detect additional
formats. To reject a request, choose `block` and check the returned actions
before any downstream use. [Safe integration](safe-integration.md) explains
that distinction and failure handling.

## Browser loading

The package's conditions select the browser loader and its `@redact-secret/wasm`
dependency. Use a bundler that honors browser conditions and preserves the
WebAssembly asset referenced by the generated glue. Serve that asset over HTTP
with the correct URL and `application/wasm` content type. Check asset requests
if `initialize()` fails. There is no public custom-Wasm-URL initialization option.

Loading the artifact may fetch a local/site asset; secret detection itself
performs no network lookup. Scan on the device before constructing the request
body, and scan again at the authoritative server boundary.

## Current limitations

Node support is 20, 22, and 24 on the six published non-musl targets. Retain npm
optional dependencies so the matching native addon can be installed. Both the
Node artifact and the browser (WebAssembly) artifact support
`createIncrementalSanitizer` and their respective stream factories
(`createNodeStreamSanitizer`, `createWebStreamSanitizer`); do not scan
independent chunks — a credential may cross a chunk boundary, which is why
this API exists instead. JavaScript strings containing an unpaired surrogate
fail with `UNPAIRED_SURROGATE` before reaching the binding.

See [API concepts](../reference/api-contract.md), [streaming](streaming.md),
[troubleshooting](../troubleshooting.md), and the
[package API inventory](../../packages/javascript/README.md#public-api).
