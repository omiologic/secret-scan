# bindings/wasm

`wasm-bindgen` build for browsers. Crate: `secret-scan-wasm`. Target:
`wasm32-unknown-unknown`.

- Owns WebAssembly instantiation glue and UTF-16 range conversion.
- Consumed by `packages/javascript`; never published or imported directly.
- CI checks this crate and the core on the wasm32 target so the core cannot
  grow a dependency that does not compile for browsers.
