# bindings/node

N-API native addon (`napi-rs`) for Node.js. Crate: `secret-scan-node`.

- Owns Node-specific loading, buffer handling, and UTF-16 range conversion.
- Consumed by `packages/javascript`; never published or imported directly.
- `package.json` is `private` and only carries the `napi` build configuration.
- The `@napi-rs/cli` toolchain is not yet part of the root lockfile; adding it
  belongs to the binding implementation, not this scaffold.
