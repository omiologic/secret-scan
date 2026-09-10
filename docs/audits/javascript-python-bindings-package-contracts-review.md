# JavaScript and Python bindings and package contracts review

An independent review of the release candidate across the JavaScript runtime
adapters (`packages/javascript`, `bindings/node`, `bindings/wasm`), the Python
binding (`bindings/python`), and the npm and PyPI package contracts both
declare, required by issue #64 under Feature #61 and Epic #60.

- **Assessed revision:** `d6311c88368001087dfcd558f9c90152a8390225`
  (merge of PR #68, *Core, conformance, and CLI boundary review*).
- **Assessed on:** 2026-09-09.
- **Scope:** the four areas issue #64 names. The canonical core, the shared
  conformance contract, and the CLI belong to #63; CI, release automation,
  documentation, and supply-chain controls belong to #65.
- **Authority:** this review records evidence. It does not change behavior,
  authorize implementation changes, or authorize any release operation.
  Disposition of these findings belongs to #66.

## Method and cost policy

Every claim below is either a span in the tree at the assessed revision, the
output of a check that already exists in the repository, or a minimal
synthetic reproduction run for this review and recorded verbatim. Nothing is
inferred from a document alone.

What was run:

| Check | Result |
|---|---|
| `npm run ci` (decisions:validate + python:check + typecheck + test + js:typecheck + js:test) | pass — 778 root tests, 76 `packages/javascript` tests |
| `cargo test --workspace` | 388 passed, 16 suites, 14.33s (node 12, python 7, wasm 15) |
| `cargo clippy --workspace --all-targets` | no issues |
| `npm pack --dry-run` at the repository root and in `packages/javascript` | both recorded below |
| One temporary code-point-index memory probe (F-09), removed after measuring | recorded below |
| One temporary registry-construction cost probe (F-12), removed after measuring | recorded below |
| One binding double driving `packages/javascript/dist/runtime.js` with each binding's callback metadata shape (F-02, F-07) | recorded below |

`maturin` is not installed on the review host, so the Python wheel and the
`bindings/python/tests/` pytest suite were not built or run here; they run in
`.github/workflows/python-wheels.yml`. Every Python finding below therefore
rests on a span in the tree or on a native `cargo test` of the binding crate,
never on an unrun wheel.

No reproduction embeds a matched value, a fixture input, or a
credential-shaped string; the synthetic tokens below are unmistakably
synthetic and revoked-looking. Detector ids, finding types, error codes, and
offsets are safe metadata and are used freely.

## Classification vocabulary

This review reuses the vocabulary of
[the closed-issue acceptance evidence ledger](./closed-issue-acceptance-evidence-ledger.md)
and [the core, conformance, and CLI boundary review](./core-conformance-cli-boundary-review.md)
so #66 can consolidate all three without translation.

| Class | Meaning |
|---|---|
| `evidence-gap` | The behavior appears correct but no deterministic, recorded check binds it at the asserted scope. |
| `new-risk` | A risk no closed issue's criteria anticipated, surfaced while reviewing. |
| `stale-claim` | A statement the tree itself now contradicts. |

Severity is this review's reading of release impact. Epic #60 and issue #66
decide what blocks.

## Summary

Twelve findings. None is a detection, redaction, policy-separation, or
plaintext-safety defect: no binding reimplements a detector, no callback
receives the input or a matched value, and no error, exception, or `__repr__`
carries plaintext. The Python binding's contracts are the stronger of the
two — its no-fallback, typing, abi3, and wheel-matrix rules are enforced
deterministically by `scripts/check-python-package.py` inside `npm run ci`.

The blockers are all on the JavaScript side, and all in the same place: the
browser half of `packages/javascript` is wired to a WebAssembly binding that
does not implement what the adapter demands of it, and is not covered by any
test double that would have noticed.

| ID | Class | Severity | Area | One line |
|---|---|---|---|---|
| [F-01](#f-01--new-risk--the-browser-runtime-cannot-initialize) | `new-risk` | **blocking** | `packages/javascript` | `browser.ts` requires a `createIncrementalSanitizer` export that `bindings/wasm` does not have, so every browser `await initialize()` rejects. |
| [F-02](#f-02--new-risk--policy-and-formatter-callbacks-see-a-different-finding-shape-on-each-runtime) | `new-risk` | **blocking** | `packages/javascript` | Under the WebAssembly binding a callback's `finding.start`/`finding.end` are `undefined`; the published types declare them `number`. |
| [F-03](#f-03--new-risk--neither-native-artifact-is-installable-by-an-external-consumer) | `new-risk` | **blocking** | npm contract | `packages/javascript` declares no dependencies, and both native artifacts are marked unpublishable with no npm build job. |
| [F-04](#f-04--evidence-gap--the-published-package-carries-no-license-and-the-test-manufactures-one) | `evidence-gap` | medium | npm contract | `packages/javascript` has no `LICENSE`; the package-contents test copies one in before packing, so the gap cannot fail. |
| [F-05](#f-05--new-risk--redactinput-findings-means-three-different-things) | `new-risk` | medium | bindings | Node re-derives the span from the caller's offsets, the browser ignores them, Python ignores them. |
| [F-06](#f-06--evidence-gap--no-javascript-side-test-models-the-webassembly-binding) | `evidence-gap` | medium | `packages/javascript` | Both test doubles implement the flat Node shape, so the whole browser adapter is structurally untestable as written. |
| [F-07](#f-07--new-risk--the-policy-callbacks-finding-is-not-frozen-while-the-formatters-is) | `new-risk` | medium | `packages/javascript` | `toFormatterCallback` freezes; `toPolicyCallback` hands the raw binding object through. |
| [F-08](#f-08--new-risk--the-javascript-package-reimplements-the-cores-two-placeholder-formatters) | `new-risk` | medium | `packages/javascript` | `formatters.ts` re-declares behavior the core owns, against its own stated rule; Python delegates instead. |
| [F-09](#f-09--stale-claim--the-code-point-index-documents-a-bound-it-does-not-hold) | `stale-claim` | low | `bindings/python` | Measured 1.6 MB of index for a 300 kB chunk against a declared 16,512-byte buffer limit. |
| [F-10](#f-10--evidence-gap--nothing-binds-what-happens-to-an-unpaired-surrogate) | `evidence-gap` | low | bindings | The package's whole range contract is UTF-16, and no check covers a lone surrogate crossing either string boundary. |
| [F-11](#f-11--new-risk--the-two-manifests-share-one-version-string) | `new-risk` | low | npm contract | The documented pre-cutover collision extends to the version, which the release workflow's own guard would then refuse. |
| [F-12](#f-12--evidence-gap--the-python-binding-rebuilds-the-detector-registry-on-every-call) | `evidence-gap` | low | `bindings/python` | Measured at 3.6 µs against a 16.6 µs small-input scan — ~22% overhead at the smallest sizes, and no initialization hook to avoid it. |

## What was reviewed and found sound

Recorded so an absent finding is not read as an absent review. Each line names
the span checked and the evidence that settles it.

### Criterion 1 — UTF-16 and code-point conversions preserve the selected span

- **Three conversions, three units, one span.** `bindings/wasm/src/range.rs:21-45`
  and `bindings/node/src/offsets.rs:18-46` convert the core's UTF-8 byte
  offsets to UTF-16 code units; `bindings/python/src/lib.rs:298-316` converts
  them to Unicode code points. All three reject an offset that is out of
  bounds or splits a character's encoding, and each carries the same
  three-case astral corpus mirrored from
  `conformance/fixtures/unicode-conversion-corpus.json`
  (`bindings/node/src/offsets.rs:59-70`, `bindings/wasm/src/range.rs:58-73`,
  `bindings/python/src/lib.rs:903-922`) with the unit-correct expectations:
  the same byte span `(5, 34)` becomes `(3, 32)` in UTF-16 and `(2, 31)` in
  code points.
- **The round trip is closed on the Node side.** `utf16_to_byte`
  (`bindings/node/src/offsets.rs:31-46`) is the inverse of `byte_to_utf16`,
  and `bindings/node/src/lib.rs:408-420` asserts that `scan`'s findings
  survive a full trip out through `JsFinding` and back through
  `from_js_finding` as the identical native `Finding`.
- **A UTF-16 offset inside a surrogate pair is rejected, not rounded.**
  `bindings/node/src/offsets.rs:86-92` and `bindings/node/src/lib.rs:423-436`
  pin `INVALID_FINDINGS` for offset 1 of `"\u{1F511}key"`; the wasm side
  pins `None` for byte offsets 1-3 of the same input
  (`bindings/wasm/src/range.rs:76-82`), and Python pins an error for the same
  three (`bindings/python/src/lib.rs:925-931`).
- **The end-to-end selection is asserted, not just the arithmetic.**
  `bindings/wasm/src/lib.rs:223-233` slices the input's own UTF-16 code-unit
  array by the reported range and asserts it equals the synthetic match, with
  an astral character positioned before it.
- **Incremental offsets are absolute and stay convertible without retaining
  the input.** `CodePointIndex` (`bindings/python/src/incremental.rs:58-132`)
  records only *where* UTF-8 continuation bytes fall, never which characters
  they encode, and its tests check every char boundary of a three-chunk
  astral input against an independent `chars().count()` reference
  (`bindings/python/src/incremental.rs:709-763`). See F-09 for its memory
  claim, which is a documentation defect, not a correctness one.

### Criterion 2 — initialization, callbacks, immutability, lifecycle, streams

- **Initialization is idempotent and gates every synchronous operation.**
  `packages/javascript/src/runtime.ts:196-207` loads at most once, does not
  cache a failed attempt, and refuses every operation with `NOT_INITIALIZED`
  until one call has succeeded; it also refuses an artifact whose `version()`
  disagrees with `VERSION` (`:186-188`), which is
  `decision-release-bindings-in-lockstep` enforced at load time. The wasm
  binding gates independently on its own side
  (`bindings/wasm/src/lifecycle.rs:62-79`, tested at `:89-110`), and the Node
  addon caches the registry thread-locally
  (`bindings/node/src/lib.rs:105-126`, tested at `:359-366`).
- **No callback ever receives the input or a matched value.** The metadata
  handed across is assembled field by field from safe fields only —
  `bindings/wasm/src/metadata.rs:23-41`, `bindings/node/src/lib.rs:144-165`,
  `bindings/python/src/lib.rs:386-397`. The wasm tests assert positively that
  the object has no `input` property and that its key set is exactly
  `confidence,detector,id,range,type`
  (`bindings/wasm/src/callbacks.rs:112-128`).
- **A failing callback cannot leak its own error.** Every adapter collapses a
  thrown exception or an unusable return value to the core's payload-free
  `PolicyFailure`/`FormatterFailure` — `bindings/wasm/src/callbacks.rs:44-49`
  and `:78-82`, `bindings/node/src/lib.rs:213-217`,
  `bindings/python/src/lib.rs:610-618` and `:685-692` — and
  `packages/javascript/src/errors.ts:89-95` replaces any thrown value that
  carries no recognized code with a fixed fallback, so a host message cannot
  reach a caller.
- **Returned findings are immutable.**
  `packages/javascript/src/runtime.ts:43-63` copies the seven documented
  fields, attaches any binding handle as a non-enumerable symbol property, and
  freezes; `:255-258` and `:287-291` freeze the result objects too. On the
  Python side `PyDetectedFinding`, `PyFinding`, `PyPolicyContext`,
  `PyPlaceholderContext`, and `PyScanResult` expose `#[pyo3(get)]` only, with
  no setter and no `__dict__`. See F-07 for the one path that is not frozen.
- **The incremental lifecycle is terminal in all three end states, and every
  terminal transition discards retained plaintext.**
  `bindings/python/src/incremental.rs:430-436` clears the offset index on
  failure, `:607-613` on finalize, `:623-628` on abort, and `:639-651` on
  leaving a `with` block still accepting. `__repr__` carries the state and
  nothing else (`:655-657`).
- **Stream cancellation aborts before teardown, on both platforms.** The Web
  adapter wraps both sides so a reader's `cancel()` and a writer's `abort()`
  each abort the session first
  (`packages/javascript/src/adapters/web-stream.ts:67-70` and `:81-84`); the
  Node adapter aborts in `_destroy`, which Node runs for an explicit
  `destroy()`, a failed `pipeline`, and a downstream error alike
  (`packages/javascript/src/adapters/node-stream.ts:80-86`). The shared half
  aborts on a malformed-UTF-8 chunk, a non-`Uint8Array` chunk, and any failure
  during finalization (`.../adapters/shared.ts:48-59`, `:61-69`, `:82-88`),
  and `abort()` is idempotent and safe after the session has already ended
  (`:48-50`).
- **The decoder is fatal, so a truncated multibyte sequence fails rather than
  silently becoming `U+FFFD`** (`.../adapters/shared.ts:44`, `:78-79`), which
  matters because a replacement character would change the text a detector
  sees.
- **Backpressure is the platform's on both adapters.** The Node transform
  pushes and lets the stream machinery stall the producer
  (`node-stream.ts:56-68`); the Web transform's outer sink returns the inner
  writer's `write()` promise and its outer source pulls one chunk at a time
  (`web-stream.ts:57-85`), so the wrapping adds one chunk of queueing and does
  not break propagation.

### Criterion 3 — neither binding reimplements detection or retains plaintext

- **Detection is enforced to live in Rust on the Python side.**
  `scripts/check-python-package.py:214-256` parses
  `bindings/python/python/secret_scan/__init__.py` and fails the build if the
  package contains any `.py` beside `__init__.py`, imports anything but
  `secret_scan._native`, or defines a single function or class. It runs inside
  `npm run ci` and reported `0 error(s)` at this revision.
- **`packages/javascript/src/` contains no detector.** Its whole surface is
  the lifecycle, the two runtime loaders, the error normalizer, the stream
  adapters, and the type declarations; every scan, policy evaluation, and
  redaction is a call into a binding. F-08 records the one behavior it does
  re-declare, which is a formatter rather than a detector.
- **No error, exception, or representation carries plaintext.** The Python
  binding defines one exception per core code, each with the core's own fixed
  message (`bindings/python/src/lib.rs:47-152`, mapped at `:155-189`); the
  JavaScript package defines one class with a fixed message table
  (`packages/javascript/src/errors.ts:36-58`). `PyScanResult.__repr__`
  (`bindings/python/src/lib.rs:549-555`) prints the *redacted* text and a
  finding count, and `IncrementalSanitizer.__repr__` prints only the state.
- **The Python API cannot be handed a forged finding.** `PyFinding` carries
  `skip_from_py_object` (`bindings/python/src/lib.rs:453`), so a caller cannot
  construct one; `redact` takes `Vec<PyRef<'_, PyFinding>>` and reuses the
  core finding the binding itself produced (`:769-777`). See F-05 for the
  cross-runtime consequence.
- **Placeholder validation stays in the core.** Every binding passes a
  formatter's return value to `secret_scan::redact`, which rejects an empty,
  oversized, or matched-value-reproducing placeholder; none of them
  pre-approves one (`bindings/wasm/src/callbacks.rs:53-56` states this
  explicitly).

### Criterion 4 — npm and Python declarations, exports, contents, abi3

- **The Python packaging contract is declared once and enforced.**
  `[workspace.metadata.secret-scan]` in the root `Cargo.toml` fixes the
  distribution name (`omiologic-secret-scan`), the import name
  (`secret_scan`), the native module, the abi3 feature (`abi3-py310`), the
  `requires-python` floor (`>=3.10`), the wheel tag (`cp310-abi3`), and the
  eight-target wheel matrix; `scripts/check-python-package.py` fails when
  `bindings/python/pyproject.toml`, `bindings/python/Cargo.toml`, or
  `.github/workflows/python-wheels.yml` disagrees with any of them.
- **The abi3 identity is internally consistent.** The Cargo feature
  `pyo3 = { features = ["abi3-py310"] }`
  (`bindings/python/Cargo.toml:22`), `requires-python = ">=3.10"`, and the
  `cp310-abi3` tag are the same statement made three times, and
  `check_abi3` binds them together so they cannot drift.
- **The Python export surface has no phantom names.** Every name in
  `secret_scan.__all__` is declared in `_native.pyi` and added to the module in
  `bindings/python/src/lib.rs:867-890` / `incremental.rs:690-697`. `version`
  and `byte_offset_to_char_offset` exist on `_native` and in the stub but are
  deliberately not re-exported; `VERSION` is the public spelling.
- **PEP 561 typing markers are present and checked** (`py.typed` and
  `_native.pyi`, `scripts/check-python-package.py:258-268`), the runtime
  declares no Python dependencies, and `[tool.maturin] exclude` keeps the
  pytest suite out of both artifacts.
- **The npm export map is minimal and its internals are unreachable.** Three
  public subpaths plus `./package.json`, with `#native` as a subpath *import*
  rather than an export; `packages/javascript/test/package-contents.test.ts:107-158`
  pins the map and asserts the published declarations mention neither
  `#native`, `NATIVE_HANDLE`, `NativeBinding`, nor `createSecretScanRuntime`.
- **The Web adapter resolves no Node-only module**, asserted both in the
  emitted files (`package-contents.test.ts:125-139`) and in a real browser
  bundle (`package-import.browser.test.ts:65-86`).

## Findings

### F-01 · `new-risk` · The browser runtime cannot initialize

- **Area:** `packages/javascript`, `bindings/wasm`.
- **Evidence:** `packages/javascript/src/runtime/browser.ts:114-127` requires
  the loaded WebAssembly module to export seven functions, and throws
  `INITIALIZATION_FAILED` if any is missing:

  ```
  default, version, initialize, scan, redact, scanAndRedact,
  createIncrementalSanitizer
  ```

  `bindings/wasm/src/lib.rs` exports five, plus wasm-bindgen's generated
  `default`:

  ```console
  $ grep -nE '^pub fn |js_name = ' bindings/wasm/src/lib.rs
  48:pub fn version() -> String {
  61:pub fn initialize() -> Result<(), JsValue> {
  119:pub fn scan(input: &str, policy: Option<Function>) -> Result<Vec<FindingJs>, JsValue> {
  143:pub fn redact(
  161:#[wasm_bindgen(js_name = "scanAndRedact")]
  162:pub fn scan_and_redact(
  ```

  `createIncrementalSanitizer` does not exist in `bindings/wasm/src/` at all —
  a repository-wide search for it returns TypeScript, documentation, and test
  hits only, and `bindings/wasm/README.md:6-8` itself lists the five exports
  as the crate's whole surface.
- **Consequence:** `loadWasmModule()` throws before `wasm.default()` is even
  called, so `await initialize()` rejects with `INITIALIZATION_FAILED` on
  every browser and in every non-Node runtime the `imports` map's `default`
  condition reaches — not only for the incremental session, but for `scan`,
  `redact`, and `scanAndRedact` too. `packages/javascript/README.md:3`,
  `:179-186`, and `:252` document the browser build and the Web-stream
  sanitizer as working features, and nothing in the tree records the gap.
- **Why no check catches it:** `package-import.browser.test.ts:8-15` lists
  `@omiologic/secret-scan-wasm` as an esbuild `external`, so the artifact is
  never loaded; the one browser test that reaches the runtime asserts
  `NOT_INITIALIZED` *without* calling `initialize()` (`:88-116`). See F-06.
- **Exit condition:** either `bindings/wasm` gains a
  `createIncrementalSanitizer` export over `secret_scan::IncrementalSanitizer`
  with the same lifecycle the Node addon exposes, or `browser.ts` stops
  requiring it and `createIncrementalSanitizer` / `./web-stream` fail with a
  specific, documented code on the browser — with a test that actually
  instantiates the artifact either way.
- **Severity:** blocking. The package declares browser support in its
  description, its keywords, its README, and its `imports` map.

### F-02 · `new-risk` · Policy and formatter callbacks see a different finding shape on each runtime

- **Area:** `packages/javascript`, `bindings/wasm`.
- **Evidence:** the two bindings hand a callback different objects.
  `bindings/node/src/lib.rs:37-51` declares `JsDetectedFinding` with flat
  `start`/`end`; `bindings/wasm/src/metadata.rs:23-41` builds
  `{ id, type, detector, confidence, range: { start, end } }`.
  `browser.ts:76-88` normalizes findings *returned* from the binding — it
  flattens `finding.range` into `start`/`end` — but passes the `policy` and
  `formatter` callbacks straight through unchanged (`:138`, `:140`, `:142`),
  so the callback path is never normalized in either direction.
  `packages/javascript/src/runtime.ts:97-98` then hands that object to the
  user's policy as a `DetectedSecretFinding`, and `:115` builds the user's
  `SecretFinding` with `toSecretFinding`, which reads `finding.start` and
  `finding.end` (`:50-51`).
- **Reproduction:** a binding double driving the built
  `packages/javascript/dist/runtime.js`, calling the callbacks with each
  binding's own metadata shape and doing nothing else differently:

  ```console
  $ node callback-shape.mjs
  --- node addon (flat) ---
    policy saw start/end    : 6 31
    policy finding frozen   : false
    formatter finding frozen: true
    formatter output        : token=<GENERIC_TOKEN@6:31>
  --- wasm binding (nested range) ---
    policy saw start/end    : undefined undefined
    policy finding frozen   : false
    formatter finding frozen: true
    formatter output        : token=<GENERIC_TOKEN@undefined:undefined>
  ```

- **Consequence:** the same consumer code decides differently on the two
  runtimes. A policy that returns `"allow"` for a finding inside a known-safe
  prefix compares `undefined` in the browser; a formatter that embeds the
  offset emits `undefined`. `packages/javascript/src/types.ts:28-44` declares
  `start` and `end` as `readonly number` on both `DetectedSecretFinding` and
  `SecretFinding`, so TypeScript actively conceals this. This is the class of
  divergence `decision-govern-cross-language-conformance` exists to prevent,
  reached through the public API rather than through a detector.
- **Exit condition:** `browser.ts` wraps the `policy` and `formatter`
  callbacks the way it already wraps returned findings — flattening `range`
  into `start`/`end` before the user's function sees it — and a test drives a
  double that produces the wasm metadata shape (F-06) so the two paths are
  pinned to one contract. Fixing it in `metadata.rs` instead would also
  close it, at the cost of changing that crate's own documented shape.
- **Severity:** blocking, and independent of F-01: it survives any fix that
  makes the browser load.

### F-03 · `new-risk` · Neither native artifact is installable by an external consumer

- **Area:** npm contract.
- **Evidence:** `packages/javascript/package.json` declares no dependencies of
  any kind:

  ```console
  $ node -p "const m=require('./packages/javascript/package.json'); JSON.stringify({dependencies:m.dependencies, optionalDependencies:m.optionalDependencies, peerDependencies:m.peerDependencies})"
  {}
  ```

  Yet `runtime/node.ts:55-59` does `require("@omiologic/secret-scan-node")`
  and `runtime/browser.ts:111-113` does
  `import("@omiologic/secret-scan-wasm")`. Neither is publishable at this
  revision: `bindings/node/package.json` is `"private": true` and describes
  itself as "not published on its own", `bindings/node/Cargo.toml:12` and
  `bindings/wasm/Cargo.toml:12` both carry `publish = false`, no workflow runs
  `napi build` or `wasm-pack`, and `bindings/wasm/README.md` states the crate
  is "never published or imported directly".
- **Consequence:** an external consumer who installs the published
  `packages/javascript` tarball gets 28 files of JavaScript and declarations
  and no native code; `await initialize()` fails to resolve the specifier and
  rejects with `INITIALIZATION_FAILED` on both runtimes. This is the
  external-consumer behavior criterion 4 asks about, and it is the same
  failure mode as F-01 arriving one step earlier.
- **Relationship to the cutover:** `docs/rust-workspace.md:24-33` records that
  `packages/javascript` is not the released package today, so *not shipping*
  is expected. What is not recorded anywhere is the set of declarations it
  still needs before it can — which is precisely what this criterion asks to
  be established, so it is recorded here rather than deferred.
- **Exit condition:** the platform artifacts get a publishable identity and a
  build job, and `packages/javascript` declares them — the N-API convention is
  `optionalDependencies` for each platform triple plus a runtime fallback, and
  the WebAssembly glue is an ordinary dependency. A package-consumer test then
  installs the packed tarball into a clean directory and awaits `initialize()`
  on both runtimes.
- **Severity:** blocking for the cutover; not blocking the *current* release,
  which publishes the root package. Sequencing belongs to #65.

### F-04 · `evidence-gap` · The published package carries no LICENSE, and the test manufactures one

- **Area:** npm contract.
- **Evidence:** `packages/javascript/package.json` lists `"LICENSE"` in
  `files` and declares `"license": "MIT"`, but the file does not exist:

  ```console
  $ ls packages/javascript/LICENSE
  ls: LICENSE: No such file or directory

  $ cd packages/javascript && npm pack --dry-run
  npm notice 📦  @omiologic/secret-scan@0.1.0-beta.1
  npm notice 9.1kB README.md
  npm notice 1.4kB package.json
  npm notice total files: 2
  ```

  (Two files because `dist/` was not yet built; after `npm run js:build` it is
  28 files, still with no `LICENSE`.)
  `packages/javascript/test/package-contents.test.ts:27-54` packs a *temporary
  copy* of the package and copies `LICENSE` from the repository root into it
  at line 41 before packing, then asserts the tarball contains `LICENSE` at
  line 64. The assertion can therefore never fail, and its own comment says
  what it establishes: that the tarball *can* carry the file, not that any
  release path puts it there. Nothing in the repository performs that copy
  outside the test.
- **Consequence:** the tarball an external consumer would receive declares MIT
  and ships no license text. `bindings/python` carries its own `LICENSE` and
  names it in `license-files`, so the two package contracts disagree.
- **Exit condition:** `packages/javascript/LICENSE` exists in the tree (a copy
  or a checked-in file, not a publish-time step), and the packing test packs
  the real directory rather than a copy it has pre-populated.
- **Severity:** medium. It is a licensing defect in a published artifact, and
  the check that should catch it is the reason it is invisible.

### F-05 · `new-risk` · `redact(input, findings)` means three different things

- **Area:** `bindings/node`, `bindings/wasm`, `bindings/python`.
- **Evidence:** the same argument is interpreted three ways.
  - Node reads the caller's UTF-16 `start`/`end` and re-derives a byte range
    against the *supplied* input (`bindings/node/src/lib.rs:175-190`), so an
    edited offset is honored.
  - The browser ignores the caller's `start`/`end` entirely: `toWasmFinding`
    (`packages/javascript/src/runtime/browser.ts:91-95`) recovers the opaque
    handle and `bindings/wasm/src/lib.rs:149` unwraps the original byte range,
    so an edited offset is silently discarded and a hand-built finding is
    rejected with `INVALID_FINDINGS`.
  - Python also ignores the visible code-point `start`/`end` and clones the
    hidden core finding (`bindings/python/src/lib.rs:773-776`); `PyFinding`
    carries `skip_from_py_object` (`:453`) so a hand-built finding cannot be
    constructed at all.
- **Consequence:** the divergence is unobservable while a caller obeys the
  documented rule — `packages/javascript/src/index.ts:56` says `findings` must
  be what `scan` returned for the same input — and immediate when they do not.
  A caller who filters a findings list is fine everywhere; a caller who widens
  a span gets three different answers. It also means the Node binding will
  redact an arbitrary caller-chosen span, which the other two will not.
- **Exit condition:** one stated rule, pinned by a test on each runtime:
  either every binding treats the visible offsets as authoritative (and Node's
  behavior is the contract), or none does and Node stops re-deriving. The
  contract belongs in `packages/javascript/src/types.ts` alongside
  `SecretFinding`, not only in a doc comment on `redact`.
- **Severity:** medium.

### F-06 · `evidence-gap` · No JavaScript-side test models the WebAssembly binding

- **Area:** `packages/javascript`.
- **Evidence:** the package has exactly two binding doubles, and both
  implement `NativeBinding` — the flat shape `runtime/node.ts` passes through
  unchanged. `packages/javascript/test/fake-binding.ts:12-17` and
  `packages/javascript/test/sanitizing-binding.ts:19-26` both import
  `NativeFinding` from `../src/native.js` and return it directly. Nothing in
  `packages/javascript/test/` constructs the `{ range: { start, end } }` object
  `bindings/wasm/src/metadata.rs` builds, and nothing exercises
  `src/runtime/browser.ts` — `package-import.browser.test.ts:8-15` marks the
  artifact `external` and never loads it.
- **Consequence:** the browser adapter — the file that contains both F-01 and
  F-02 — is the one module in the package with no behavioral coverage. The 76
  tests that pass at this revision all run against the Node-shaped contract.
- **Exit condition:** a third double that produces exactly what
  `bindings/wasm/src/{lib,metadata,finding}.rs` produce (nested `range`, opaque
  handles, the generated `default` init), injected through
  `createSecretScanRuntime` the way the existing doubles are, running the same
  lifecycle, callback, and stream assertions the Node double already runs.
- **Severity:** medium as an evidence gap; it is the structural reason F-01 and
  F-02 reached this review rather than CI.

### F-07 · `new-risk` · The policy callback's finding is not frozen while the formatter's is

- **Area:** `packages/javascript`.
- **Evidence:** `packages/javascript/src/runtime.ts:106-116` builds the
  formatter callback as `formatter(toSecretFinding(finding), context)`, and
  `toSecretFinding` (`:43-63`) copies the documented fields and freezes.
  `:90-99` builds the policy callback as
  `policy.evaluate(finding as DetectedSecretFinding, context)` — the raw
  object the binding produced, uncopied and unfrozen. The incremental policy
  callback does the same (`:135-139`). The reproduction under F-02 records
  `policy finding frozen: false` / `formatter finding frozen: true` on both
  shapes.
- **Consequence:** no plaintext is at risk — the object carries safe metadata
  only — but the package's own contract is asymmetric.
  `packages/javascript/src/index.ts:23` states "every finding it returns is
  frozen"; a policy callback is the one place a caller holds a finding this
  package produced and can mutate it. The `as DetectedSecretFinding` cast at
  `:98` is also what lets F-02 through the type checker.
- **Exit condition:** `toPolicyCallback` routes through the same normalizing,
  freezing conversion the formatter path uses, which closes this and F-02 in
  one change, with `Object.isFrozen` asserted on the object a policy receives.
- **Severity:** medium.

### F-08 · `new-risk` · The JavaScript package reimplements the core's two placeholder formatters

- **Area:** `packages/javascript`.
- **Evidence:** `packages/javascript/src/formatters.ts:19-33` re-declares both
  formatters in TypeScript. The typed one is:

  ```ts
  `<${finding.type.toUpperCase().replace(/[.-]/g, "_")}_${context.placeholderIndex}>`
  ```

  against the core's `crates/secret-scan-core/src/redact.rs:44-53`:

  ```rust
  let normalized = finding.type_name().to_ascii_uppercase().replace(['.', '-'], "_");
  ```

  The Python binding instead delegates: `typed_placeholder_formatter`
  (`bindings/python/src/lib.rs:850-857`) is a wrapper over
  `core_typed_formatter`. Only `defaultPlaceholderFormatter` is routed back to
  the core, and only when it is passed by identity
  (`packages/javascript/src/runtime.ts:109-111`); a caller who *calls* either
  helper directly, or passes `typedPlaceholderFormatter`, gets the TypeScript
  one evaluated per placeholder.
- **Consequence:** a second source of truth for behavior the core owns — which
  is the rule `formatters.ts:10-13` states for itself, in refusing to
  re-declare the default *policy* for exactly this reason. `toUpperCase()` is
  full-Unicode and `to_ascii_uppercase()` is not, so the two disagree for any
  type name containing a non-ASCII lowercase letter. Every built-in type name
  is ASCII today, so nothing diverges at this revision; the divergence is
  latent, and no check would notice it appearing.
- **Exit condition:** either both helpers route to the binding's built-in the
  way `defaultPlaceholderFormatter` already does, or a test asserts the
  TypeScript and core formatters agree over every built-in type name — the
  same shape as F-04 in the core review, which found the built-in type names
  similarly unbound to the default policy.
- **Severity:** medium.

### F-09 · `stale-claim` · The code-point index documents a bound it does not hold

- **Area:** `bindings/python`.
- **Evidence:** `bindings/python/src/incremental.rs:52-57` states: "Memory is
  therefore bounded by the session's declared buffer limit rather than by its
  total input." `observe` (`:86-93`) records one `usize` per UTF-8
  continuation byte in the whole chunk *before* the call returns, and `prune`
  (`:97-104`) runs only afterward. A temporary probe, removed after measuring:

  ```console
  $ cargo test -p secret-scan-python peak_index_size_within_one_append -- --nocapture
  chunk_bytes=300000 max_buffered=16512 peak_entries=200000 peak_bytes=1600000 after_prune=11008
  ```

  A 300 kB chunk of three-byte characters against a declared 16,512-byte
  buffer limit costs 1.6 MB of index at the peak — about 97× the declared
  bound. After pruning it settles at 11,008 entries, which is 88 kB of
  bookkeeping for a 16,512-byte window: still ~5.3×, and not counted against
  `max_buffered_bytes`.
- **Consequence:** an operator sizing a session from its declared limits
  under-estimates its footprint, on non-ASCII input, by two orders of
  magnitude at the peak. Nothing is unbounded — `max_input_bytes` bounds the
  largest chunk — but that is the bound the sentence denies. Pure ASCII, which
  every credential format this project detects is made of, records nothing at
  all, so the claim holds for the intended workload and fails for the input
  around it.
- **Exit condition:** either the comment states the real bound (peak scales
  with the largest single chunk; steady state costs one `usize` per retained
  continuation byte), or `observe` prunes incrementally so the peak is
  genuinely bounded by `max_buffered_bytes`, with a test pinning whichever is
  chosen.
- **Severity:** low. It is a documentation defect about a memory bound, in a
  file whose whole purpose is bounding memory.

### F-10 · `evidence-gap` · Nothing binds what happens to an unpaired surrogate

- **Area:** `bindings/node`, `bindings/wasm`, `packages/javascript`.
- **Evidence:** every range this package reports is a UTF-16 code-unit offset
  into a JavaScript string, and a JavaScript string may contain an unpaired
  surrogate, which is not representable in UTF-8. Both bindings take the input
  as a Rust `&str`/`String`, so the host's string must be transcoded at the
  boundary. Searching the tree for surrogate coverage returns only *paired*
  astral cases — `conformance/fixtures/unicode-conversion-corpus.json`,
  `conformance/convert.ts:58-76` (which rejects an offset that splits a pair),
  `bindings/node/src/offsets.rs:86-92`, `bindings/wasm/src/range.rs:76-82`,
  and `bindings/node/smoke-test.mjs:47`. No fixture, test, or doc states what
  `scan("\uD800")` or `redact` over an input containing one does on either
  runtime.
- **Why it matters here:** if the boundary substitutes `U+FFFD`, then
  `redact` returns text that is not the caller's input with only findings
  replaced — a silently transcoded copy — which the package's contract
  ("`input.slice(start, end)` selects exactly the matched span",
  `packages/javascript/src/types.ts:4-6`) does not allow for. If it throws,
  the code it throws is unstated. Either answer is defensible; neither is
  written down or checked.
- **Exit condition:** a fixture in the shared corpus for an unpaired
  surrogate, with a stated expectation, asserted on both JavaScript runtimes —
  or, if the answer is "rejected", a fixed error code in
  `packages/javascript/src/errors.ts` and a test.
- **Severity:** low, on the strength of how rarely an unpaired surrogate
  reaches a scanner. It rises if this package is ever placed in front of
  arbitrary user-typed or clipboard input, which its own README describes as
  the client-side prevention use case.

### F-11 · `new-risk` · The two manifests share one version string

- **Area:** npm contract.
- **Evidence:** the repository root and `packages/javascript` both declare
  `"name": "@omiologic/secret-scan"` and `"version": "0.1.0-beta.1"`, and
  produce tarballs with the same filename:

  ```console
  $ npm pack --dry-run                       # repository root
  npm notice 📦  @omiologic/secret-scan@0.1.0-beta.1
  npm notice filename: omiologic-secret-scan-0.1.0-beta.1.tgz
  npm notice total files: 106
  $ cd packages/javascript && npm pack --dry-run
  npm notice 📦  @omiologic/secret-scan@0.1.0-beta.1
  npm notice filename: omiologic-secret-scan-0.1.0-beta.1.tgz
  ```

  Their public APIs are unrelated: the root exports `DetectorRegistry`,
  `createDetectorRegistry`, and twenty-two named detector factories
  (`dist/index.d.ts` line 1-2); `packages/javascript` exports `initialize`,
  `scan`, `redact`, `scanAndRedact`, `createIncrementalSanitizer`,
  `RANGE_UNIT`, `SecretScanError`, and `VERSION`.
- **Why record it:** the *name* collision is deliberate and documented
  (`docs/rust-workspace.md:24-33`: only the root is released today, and
  publishing the wrapper is part of the cutover). The shared *version* is not
  discussed anywhere. Once `0.1.0-beta.1` is published from the root, the
  release workflow's own guard — `npm view "$package_name@$package_version"`
  followed by "is already published" and `exit 1`
  (`.github/workflows/release.yml`) — refuses that version forever, so the
  cutover necessarily requires a version bump that no document states, and the
  two manifests silently drift out of the lockstep
  `decision-release-bindings-in-lockstep` asserts.
- **Exit condition:** `docs/rust-workspace.md` states which version the
  wrapper first publishes under and what happens to the root manifest at
  cutover, or the two manifests stop sharing a version until then.
- **Severity:** low, and its fix site is the release automation, so #66 may
  prefer to hand it to #65 rather than dispose of it here.

### F-12 · `evidence-gap` · The Python binding rebuilds the detector registry on every call

- **Area:** `bindings/python`.
- **Evidence:** `bindings/python/src/lib.rs:564-572` builds a fresh
  `DetectorRegistry` inside `detect`, which `scan` (`:742`) and
  `scan_and_redact` (`:795`) call once per invocation. Node caches it in a
  thread-local `OnceCell` (`bindings/node/src/lib.rs:105-126`) and the wasm
  binding in another (`bindings/wasm/src/lifecycle.rs:32-34`); the Python
  module exposes no `initialize` at all, so there is no hook a caller could
  use to pay the cost once. A temporary probe, removed after measuring:

  ```console
  $ cargo test -p secret-scan --release --test pipeline temporary_probe_64 -- --nocapture
  registry_build=3.587µs pipeline_scan=16.592µs ratio=0.2
  ```

- **Consequence:** about 22% overhead on the smallest inputs, falling toward
  nothing as input grows. That is small enough that it is recorded as a gap
  rather than a defect — the measurement is what settles the severity, and it
  is recorded so #66 disposes of it on the number rather than on the shape of
  the code. Separately, `PyScanResult.findings` and
  `PyIncrementalResult.findings` are `Vec<PyFinding>` behind `#[pyo3(get)]`
  (`bindings/python/src/lib.rs:543-544`, `incremental.rs:388-389`), so every
  attribute access rebuilds the whole list as fresh objects; a caller who
  loops over `result.findings` twice pays twice and sees non-identical
  objects.
- **Why it is a gap rather than a finding of fact:** no benchmark in the
  repository measures the Python surface at all, and the pytest suite does not
  run in `npm run ci`, so nothing would notice this growing.
- **Exit condition:** either the registry is cached the way both other
  bindings cache it (a thread-local `OnceCell`, since `Detector` is not
  `Sync`), or the cost is recorded as accepted in
  `docs/python-packaging.md` with this measurement attached.
- **Severity:** low.

## Appendix — reproducing this review

Every command below is read-only against the tree except the two the
repository already provides as its own gates.

```bash
# Gates
npm run ci
cargo test --workspace
cargo clippy --workspace --all-targets

# F-01: the exports the browser adapter demands versus the ones that exist
grep -nE '^pub fn |js_name = ' bindings/wasm/src/lib.rs
sed -n '114,127p' packages/javascript/src/runtime/browser.ts

# F-02, F-07: the callback shapes, through the built runtime
npm run js:build
node callback-shape.mjs                      # listed in full below

# F-03: what the package declares it needs
node -p "JSON.stringify(require('./packages/javascript/package.json').dependencies)"

# F-04, F-11: what each manifest would publish
npm pack --dry-run
( cd packages/javascript && npm pack --dry-run )
ls packages/javascript/LICENSE

# F-08: the two spellings of the typed formatter
grep -n 'toUpperCase' packages/javascript/src/formatters.ts
grep -n 'to_ascii_uppercase' crates/secret-scan-core/src/redact.rs
```

F-05, F-06, and F-10 are established by the spans quoted inline. F-09's and
F-12's probes are temporary tests that were removed; each finding's Evidence
block gives the test body's measurement and its exit condition specifies the
committed form.

### The F-02 / F-07 reproduction script

Kept here rather than committed, because it asserts nothing: it prints what a
consumer's callbacks receive under each binding's metadata shape. It drives
the real `packages/javascript/dist/runtime.js`; only the binding double is
synthetic, and it reproduces `bindings/node/src/lib.rs:37-51` and
`bindings/wasm/src/metadata.rs:23-41` field for field.

```js
import { createSecretScanRuntime } from "./packages/javascript/dist/runtime.js";

const INPUT = "token=SYNTHETIC_REVOKED_EXAMPLE";
const START = 6;
const END = INPUT.length;

const nodeShape = (action) => ({
  id: "finding-1", type: "generic_token", detector: "generic-token",
  confidence: "high", start: START, end: END, ...(action ? { action } : {}),
});
const wasmShape = (action) => ({
  id: "finding-1", type: "generic_token", detector: "generic-token",
  confidence: "high", range: { start: START, end: END },
  ...(action ? { action } : {}),
});

const binding = (shape) => ({
  version: () => "0.1.0-beta.1",
  initialize: () => {},
  scan: (_input, policy) => [
    { ...nodeShape(policy ? policy(shape(), { findingIndex: 0, findingCount: 1 }) : "redact") },
  ],
  redact: (input, _findings, formatter) =>
    input.slice(0, START) +
    (formatter ? formatter(shape("redact"), { placeholderIndex: 1 }) : "<SECRET_1>"),
  scanAndRedact: () => ({ text: "", findings: [] }),
  createIncrementalSanitizer: () => { throw new Error("unused"); },
});

for (const [name, shape] of [["node addon (flat)", nodeShape],
                             ["wasm binding (nested range)", wasmShape]]) {
  const rt = createSecretScanRuntime(async () => binding(shape));
  await rt.initialize();

  let seenByPolicy, formatterFrozen;
  rt.scan(INPUT, { policy: { evaluate(f) { seenByPolicy = f; return "redact"; } } });
  const out = rt.redact(INPUT, [nodeShape("redact")], {
    placeholderFormatter: (f) => {
      formatterFrozen = Object.isFrozen(f);
      return `<${f.type.toUpperCase()}@${f.start}:${f.end}>`;
    },
  });

  console.log(`--- ${name} ---`);
  console.log("  policy saw start/end    :", seenByPolicy.start, seenByPolicy.end);
  console.log("  policy finding frozen   :", Object.isFrozen(seenByPolicy));
  console.log("  formatter finding frozen:", formatterFrozen);
  console.log("  formatter output        :", out);
}
```
