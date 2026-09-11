# Getting started

[Documentation home](README.md)

## Choose a runtime

| Runtime | Package / entry point | Current scope |
| --- | --- | --- |
| Node.js 20, 22, 24 | `@redact-secret/core` (ESM) | Whole-input; glibc Linux, macOS, Windows; x64 and arm64 |
| Browser | `@redact-secret/core` with WebAssembly | Whole-input; Chromium, Firefox, WebKit qualification |
| CPython 3.10+ | `redact-secret`, imported as `redact_secret` | Whole-input and incremental; see [wheel matrix](python-packaging.md) |
| Rust 1.88+ | `redact-secret`, imported as `redact_secret` | Whole-input and incremental |
| CLI | `redact-secret` binary | File checking/redaction and streamed standard input |

Node npm packages and CLI release binaries do not include musl/Alpine builds.
Python has a separate musllinux wheel matrix. A built test artifact is not
necessarily a distributed package; [qualification](qualification.md) explains
that distinction.

## Install a published release

These commands apply after the release you intend to use has been published.
The version in a development manifest does not establish registry availability.
Use an explicitly selected version in your application's dependency lockfile.

```bash
npm install @redact-secret/core
python -m pip install redact-secret
cargo add redact-secret
cargo install redact-secret-cli --locked
```

Run only the command for your runtime. Rust library and CLI source installs
need a Rust toolchain; supported Python wheels and Node prebuilt addons do not.
Continue with [JavaScript](guides/javascript.md), [Python](guides/python.md),
[Rust](guides/rust.md), or [CLI](guides/cli.md).

## Try this checkout before publication

From the repository root, the CLI is the shortest path to the real Rust core:

```bash
cargo run --quiet --locked -p redact-secret-cli -- --help
printf '%s\n' 'API_KEY=SYNTHETIC_REVOKED_CONTEXT_VALUE' | cargo run --quiet --locked -p redact-secret-cli -- --redact
```

Expected sanitized output: `API_KEY=<SECRET_1>`.

For Python, create an isolated environment and build the local extension:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install maturin pytest
maturin develop --manifest-path bindings/python/Cargo.toml
python -m pytest bindings/python/tests
```

On Windows, activate with `.venv\Scripts\Activate.ps1` in PowerShell.
For Rust applications, use a path dependency on `crates/secret-scan-core` while
working locally. JavaScript `npm run js:build` builds the wrapper only; it does
not install a native addon or build WebAssembly. Follow the
[local artifact qualification steps](qualification.md#running-it-locally) to
exercise the real Node or browser runtime from this checkout.
