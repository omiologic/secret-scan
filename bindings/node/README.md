# bindings/node

N-API native addon (`napi-rs`) for Node.js. Crate: `redact-secret-node`.

- Owns Node-specific loading, buffer handling, and UTF-16 range conversion.
- Exports `version`, `initialize`, `scan`, `redact`, and `scanAndRedact`.
- This directory's own `package.json` is `private` and only carries the
  `napi` build configuration; it is never published itself. `npm/` holds one
  tiny published package per `napi.targets` platform triple
  (`@redact-secret/node-<platform>`), each carrying only that platform's
  built `.node` file. `packages/javascript` depends on all of them through
  `optionalDependencies`, and npm's `os`/`cpu`/`libc` fields skip the ones
  that do not match a given install.
- Does not yet export `createIncrementalSanitizer` over the core's
  `IncrementalSanitizer`, unlike `bindings/python`. `packages/javascript`'s
  Node adapter (`src/runtime/node.ts`) treats this the way it treats
  `bindings/wasm`'s documented non-support: `INCREMENTAL_UNAVAILABLE` at call
  time, not a load-time failure.
