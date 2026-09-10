# Cross-platform qualification

How every supported artifact of the product is built and proved from one
commit, and what that run does not yet cover.

`decision-release-bindings-in-lockstep` makes the Rust crate, the npm package,
the Python package, and the CLI one product with one version: a release
candidate must build and qualify *every* required artifact from the same
revision before any registry publication begins.
`decision-govern-cross-language-conformance` makes the top-level `conformance`
corpus the single behavioral contract each of those artifacts is measured
against. This document describes the workflow that carries both out.

Nothing here publishes anything. Publication requires the separate release
approval `AGENTS.md` defines.

## The declaration

`[workspace.metadata.secret-scan]` in the root `Cargo.toml` states the whole
supported surface once:

| Key | What it declares |
| --- | --- |
| `node-addon-targets` | Every triple the N-API addon is built and smoke-tested for |
| `cli-release-targets` | Every triple the CLI binary is built and smoke-tested for |
| `python-wheel-targets` | Every triple an abi3 wheel is built and smoke-tested for |
| `browser-engines` | Every engine the WebAssembly artifact is initialized and scanned in |
| `node-support-majors` | Every Node.js major `engines.node` claims, and CI therefore exercises |

All five lists are the same platform story: Linux glibc and musl on x64 and
arm64, macOS on x64 and arm64, and Windows on x64 and arm64 — eight triples
per native family — plus Chromium, Firefox, and WebKit for the browser, and
Node.js 20, 22, and 24.

`scripts/check-qualification-matrix.py` (run by `npm run matrix:check`, and by
the `Matrix declaration` job every other job waits on) fails when any of the
places that must agree with those lists drifts:

- `bindings/node/package.json` `napi.targets` against `node-addon-targets`;
- the `addon-target`, `cli-target`, and `engine` matrices in
  `.github/workflows/qualification.yml` against their declarations, in both
  directions, so a target cannot be added to one file alone;
- `scripts/qualify-node-addon.mjs`, `scripts/qualify-cli-binary.mjs`, and
  `scripts/qualify-browser-artifact.mjs`, each of which must know every
  target or engine it may be asked to verify;
- the `node-version` matrix in `.github/workflows/ci.yml` and the per-major
  addon smoke steps against `node-support-majors`; and
- `engines.node` in every manifest that declares one — the root package, the
  published JavaScript package, and the addon — against the lowest major the
  matrix exercises. A supported-runtime claim CI does not run is a claim that
  drifts.

The same script enforces the two CI controls the release decision depends on:
every workflow declares a top-level `permissions` and every job declares its
own, with `write` only where `WRITE_SCOPE_ALLOWLIST` names it; and every
`uses:` outside this repository is pinned to a full 40-character commit SHA.

`scripts/tests/test_check_qualification_matrix.py` covers each of those
failures in both directions against a synthetic repository.

## The workflow

`.github/workflows/qualification.yml` runs on `workflow_dispatch`, on every
push to `main`, and on a pull request that changes the matrix's own machinery.
It is also `workflow_call`-able, so release automation can require it rather
than re-implement it. The full fan-out is expensive, which is why an ordinary
pull request does not trigger it.

| Job | What it proves |
| --- | --- |
| `declaration` | Every list above agrees with every file that consumes it |
| `rust` | Calls `CI`: format, lint, dependency policy, workspace tests on three hosts, MSRV, rustdoc, crate package contents, and the `wasm32-unknown-unknown` target and its `wasm-bindgen` tests |
| `python` | Calls `Python wheels`: the abi3 wheel matrix and source distribution, each smoke-tested on the abi3 floor and a current interpreter |
| `node-addon` | Builds the addon for each triple and qualifies it on Node 20, 22, and 24 |
| `browser` | Builds the WebAssembly artifact and qualifies it in each engine |
| `cli` | Builds the CLI for each triple and qualifies the binary |
| `inventory` | Requires the whole declared matrix and records what was built |

Because `rust` and `python` are called workflows rather than copies, their
jobs run in the same workflow run, at the same revision, and their artifacts
land in the same artifact store the `inventory` job reads.

### Native targets and where they run

Each family uses the same runner map, and every artifact is smoke-tested on
the architecture it targets — none is "built only":

| Target | Runner | Smoke |
| --- | --- | --- |
| `x86_64-unknown-linux-gnu` | `ubuntu-latest` | host |
| `aarch64-unknown-linux-gnu` | `ubuntu-24.04-arm` | host |
| `x86_64-unknown-linux-musl` | `ubuntu-latest` | `*-alpine` container |
| `aarch64-unknown-linux-musl` | `ubuntu-24.04-arm` | `*-alpine` container |
| `x86_64-apple-darwin` | `macos-15-intel` | host |
| `aarch64-apple-darwin` | `macos-latest` | host |
| `x86_64-pc-windows-msvc` | `windows-latest` | host |
| `aarch64-pc-windows-msvc` | `windows-11-arm` | host |

The musl builds cross-link with `musl-tools` on the glibc runner of the same
architecture — the addon is a cdylib that resolves its N-API symbols at load
time and the CLI links musl statically, so neither needs a musl build host —
and are then qualified inside a musl container, which is where they are meant
to run.

## What each qualifier proves

### `scripts/qualify-node-addon.mjs`

1. The addon directory holds the generated loader, its declarations, and
   exactly one compiled `.node` whose name matches the requested target.
   Everything present is printed.
2. `bindings/node/smoke-test.mjs` runs against the real artifact, not a
   double.
3. Every canonical synchronous fixture goes through the addon's `scan`, with
   each expectation's UTF-8 byte offsets converted to UTF-16 code units by a
   reference conversion independent of the binding.
4. The published JavaScript package resolves the addon under
   `@omiologic/secret-scan-node` from `packages/javascript/node_modules`, the
   way an installed consumer resolves it. See the gap below.

### `scripts/qualify-browser-artifact.mjs`

`npm run wasm:build` (`scripts/build-browser-artifact.mjs`) compiles the
`wasm32-unknown-unknown` cdylib and generates the `web`-target glue with a
`wasm-bindgen` CLI whose version must match the crate's exactly. The qualifier
serves that directory over HTTP — with `application/wasm` on the binary, which
streaming instantiation requires — and runs `scripts/browser-harness.mjs`
inside a real page in each engine:

- a synchronous call before `initialize()` fails with `NOT_INITIALIZED`;
- `initialize()` is idempotent and `version()` reports the product version;
- every canonical synchronous fixture matches, converted as above;
- the corpus's astral fixture is present, and prefixing or suffixing any
  positive fixture with an astral character shifts its reported span by
  UTF-16 code units rather than UTF-8 bytes;
- `scanAndRedact` equals `scan` then `redact` and no redacted span survives;
- a throwing policy surfaces `POLICY_FAILURE` carrying no input, and custom
  policy and formatter callbacks take effect.

The "astral character *within* a finding" case is not observable end to end,
because no built-in detector matches a span containing one; it is asserted at
the unit level by `bindings/wasm/src/range.rs` under the `Rust wasm32 target`
job.

### `scripts/qualify-cli-binary.mjs`

The artifact is an executable with the expected name, and its size and SHA-256
are printed; `--version` and `--help` report the product identity; the
documented exit codes hold (0 clean, 1 findings, 2 usage error, with the usage
block on stderr and nothing on stdout); every canonical fixture matches through
one multi-source `--json` run — the CLI reports UTF-8 byte ranges, the corpus's
own unit, so no conversion is involved; and `--redact` over every positive
fixture produces exactly the text its own findings and the documented default
placeholder imply, with no match surviving.

## The inventory

`scripts/record-artifact-inventory.py` closes the run. It requires every
declared target to have produced an artifact and nothing else to have appeared,
then writes `artifact-inventory.json` and a job summary carrying:

- the source commit, ref, and workflow run;
- the product version, and `"published": false`;
- the SHA-256 of every canonical fixture file, because an artifact set only
  means something alongside the contract it was qualified against;
- the declared matrices as they stood at that revision; and
- every artifact file with its family, target, size, and SHA-256, plus the
  file-by-file contents of the npm package and the public Rust crate.

## Known gap: the JavaScript package cannot initialize on a real artifact

Neither built artifact carries `createIncrementalSanitizer`, which
`packages/javascript/src/native.ts` makes part of the internal binding
contract. `runtime/node.js` and `runtime/browser.ts` both refuse a binding
missing a contract member, so `initialize()` rejects with
`INITIALIZATION_FAILED` on a real addon and on the real browser artifact
alike.

That is why the qualification above is of the *artifacts* — the addon through
its own consumer surface, the WebAssembly module through its own exports —
rather than of the published package driven end to end on top of them.
`scripts/qualify-node-addon.mjs` pins the gap rather than skipping it: it
asserts that `createIncrementalSanitizer` is the single outstanding member and
that `initialize()` rejects for that reason, so the check fails the moment the
bindings gain the incremental surface and must then be replaced by the positive
public-API pass.

Issue #73 owns the browser runtime's side of that contract and issue #74 the
package-level integration. Until they land, browser and Node support is
qualified at the artifact boundary and unqualified through
`@omiologic/secret-scan` itself.

## Running it locally

```bash
npm run matrix:check                    # the declaration and CI controls

npm --prefix bindings/node ci
npm --prefix bindings/node run build    # this host's triple
npm run js:build
npm run addon:qualify -- --target <triple>

npm run wasm:build
npx playwright install --with-deps chromium firefox webkit
npm run browser:qualify                 # or --engine chromium

cargo build --release --locked -p secret-scan-cli
npm run cli:qualify -- --binary target/release/secret-scan
```

Only the host's own triple can be qualified locally; the fan-out across the
other seven is what the workflow is for.
