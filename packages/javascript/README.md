# packages/javascript

Future home of the `@omiologic/secret-scan` npm package: the single JavaScript
API that loads `bindings/node` on Node.js and `bindings/wasm` in browsers and
exposes `initialize`, `scan`, `redact`, `scanAndRedact`, the incremental
sanitizer, and the stream adapters (`decision-define-runtime-bindings`).

The package is not moved yet. The TypeScript implementation in the repository
root (`src/`, `test/`, `package.json`) remains the behavioral oracle until the
Rust core passes the shared conformance corpus
(`decision-govern-cross-language-conformance`). Until then this directory only
records the ownership boundary:

- owns the public JavaScript API, runtime loaders, and stream adapters;
- may depend on the Node and WebAssembly bindings;
- must not reimplement detector behavior.
