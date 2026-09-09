/**
 * Ambient declaration for the browser artifact.
 *
 * `@omiologic/secret-scan-wasm` is the `wasm-bindgen` build published in
 * lockstep with this package (`decision-release-bindings-in-lockstep`); it is
 * generated, so it is absent from a source checkout. Declaring it here keeps
 * the specifier a literal, which is what lets a bundler resolve the glue and
 * the `.wasm` binary it references. `runtime/browser.ts` validates the shape
 * it actually loaded before using it.
 */
declare module "@omiologic/secret-scan-wasm" {
  const generated: unknown;
  export default generated;
}
