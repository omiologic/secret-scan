# bindings/node

N-API native addon (`napi-rs`) for Node.js. Crate: `secret-scan-node`.

- Owns Node-specific loading, buffer handling, and UTF-16 range conversion.
- Exports `version`, `initialize`, `scan`, `redact`, and `scanAndRedact`.
- Consumed by `packages/javascript`; never published or imported directly.
- `package.json` is `private` and only carries the `napi` build configuration.
- Does not yet export `createIncrementalSanitizer` over the core's
  `IncrementalSanitizer`, unlike `bindings/python`. `packages/javascript`'s
  Node adapter (`src/runtime/node.ts`) treats this the way it treats
  `bindings/wasm`'s documented non-support: `INCREMENTAL_UNAVAILABLE` at call
  time, not a load-time failure.
