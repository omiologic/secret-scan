# Python packaging

How the CPython artifacts are named, built, and qualified. The decisions behind
it are `decision-define-runtime-bindings` (PyO3 and maturin, abi3 wheels, an
sdist that needs Rust, and no pure-Python fallback) and
`decision-release-bindings-in-lockstep` (one product version, and a registry
name that may differ from the product name).

`bindings/python/README.md` is the consumer-facing document and becomes the
distribution's long description. This page is the contract behind it.

## One declaration, three places that must agree

`[workspace.metadata.secret-scan]` in the root `Cargo.toml` declares the
packaging contract once:

| Key | Value | What it fixes |
| --- | --- | --- |
| `python-distribution` | `omiologic-secret-scan` | The PyPI name |
| `python-import-name` | `secret_scan` | The import name, which is the product name |
| `python-native-module` | `secret_scan._native` | The extension maturin builds |
| `python-abi3-feature` | `abi3-py310` | The PyO3 feature that pins the abi3 floor |
| `python-requires` | `>=3.10` | The `Requires-Python` floor |
| `python-wheel-tag` | `cp310-abi3` | The interpreter and ABI tag every wheel carries |
| `python-wheel-targets` | eight triples | The matrix a release candidate must build |

`npm run python:check` (`scripts/check-python-package.py`, in `npm run ci`)
fails when `bindings/python/pyproject.toml`, `bindings/python/Cargo.toml`, or
`.github/workflows/python-wheels.yml` drifts from any of them. It needs no
network, no cargo, and no build.

The two floors are one statement said twice, so the check ties them together:
`abi3-py310` and `requires-python = ">=3.10"` must agree, and the wheel tag
must be the `cp310-abi3` that follows from them. A wheel that claims abi3
support it does not have is worse than no wheel.

## Names

The product name is `secret-scan` everywhere. On PyPI that name belongs to an
unrelated project — verified 2026-09-09 and again when this contract was
written — so the distribution takes the registry fallback that
`decision-release-bindings-in-lockstep` allows. The import name does not move
with it: consumers still write `import secret_scan`.

Recheck both before a publication:

```bash
python3 scripts/check-python-package.py --recheck-pypi-name
```

It fails if the selected name has been taken since, and it also fails if the
product name has become free — because that would mean the recorded reason for
the fallback no longer holds, and the name deserves a decision rather than a
default.

## abi3, and no pure-Python fallback

One `cp310-abi3` wheel per platform serves every CPython from 3.10 upward, so
the matrix has one wheel per target rather than one per interpreter, and a new
CPython release needs no rebuild.

The importable package is a re-export of the extension and nothing else. The
check parses `bindings/python/python/secret_scan/__init__.py` and fails if it
imports anything but `secret_scan._native`, if it defines a function or class,
or if a second `.py` file appears beside it. A pure-Python fallback would be a
second detector implementation, which is exactly what
`decision-define-runtime-bindings` rejects.

The wheel ships `py.typed` and `_native.pyi`, so the distribution is typed
under PEP 561 and a type checker resolves the API with no stub package.

## The wheel matrix

| Target | Runner | Wheel platform tag | Smoke tested on |
| --- | --- | --- | --- |
| `x86_64-unknown-linux-gnu` | `ubuntu-latest` | `manylinux_2_17_x86_64` | CPython 3.10 and 3.13 |
| `aarch64-unknown-linux-gnu` | `ubuntu-24.04-arm` | `manylinux_2_17_aarch64` | CPython 3.10 and 3.13 |
| `x86_64-unknown-linux-musl` | `ubuntu-latest` | `musllinux_1_2_x86_64` | `python:3.10-alpine`, `python:3.13-alpine` |
| `aarch64-unknown-linux-musl` | `ubuntu-24.04-arm` | `musllinux_1_2_aarch64` | `python:3.10-alpine`, `python:3.13-alpine` |
| `x86_64-apple-darwin` | `macos-13` | `macosx_*_x86_64` | CPython 3.10 and 3.13 |
| `aarch64-apple-darwin` | `macos-latest` | `macosx_*_arm64` | CPython 3.10 and 3.13 |
| `x86_64-pc-windows-msvc` | `windows-latest` | `win_amd64` | CPython 3.10 and 3.13 |
| `aarch64-pc-windows-msvc` | `windows-11-arm` | `win_arm64` | CPython 3.11 and 3.13 |

Every wheel is built and smoke-tested on the architecture it targets; nothing
is cross-qualified. Windows on Arm is the one place the floor interpreter is
not 3.10, because CPython for that platform starts at 3.11 — the wheel's abi3
floor is unchanged and the x64 job exercises it.

Each wheel is tested on two interpreters on purpose. A single `cp310-abi3`
wheel is only worth shipping if one build really does serve both ends of the
supported range, and testing only the interpreter that happens to be on the
runner would never catch a wheel that had quietly become interpreter-specific.

## Qualification

`scripts/qualify-python-wheel.py` reads built artifacts and runs them.

```bash
# Contents and metadata only.
python3 scripts/qualify-python-wheel.py --inspect-only dist/*.whl dist/*.tar.gz

# Install each wheel and run it, on two interpreters.
python3 scripts/qualify-python-wheel.py --python python3.10 --python python3.13 dist/*.whl

# ... and run the repository's Python suite against the installed wheel.
python3 scripts/qualify-python-wheel.py --conformance dist/*.whl

# Both source-distribution branches.
python3 scripts/qualify-python-wheel.py --build-sdist dist/*.tar.gz

# Every declared target produced exactly one wheel.
python3 scripts/qualify-python-wheel.py --inspect-only --require-matrix dist/*
```

For a wheel it checks the filename tag, the `WHEEL` and `METADATA` records, and
the exact file list — one abi3 extension, the two typing markers, the
`__init__.py`, a license file, no runtime dependency, and no test files — then
installs it with:

```
pip install --no-index --no-deps --only-binary :all: <wheel>
```

Those three flags are the acceptance criterion, not a convenience: an install
that succeeds under them cannot have reached an index, resolved a dependency,
or fallen back to building from source, so it cannot have used a Rust
toolchain. The smoke test then runs from a directory outside the repository, so
nothing resolves from the source tree. It asserts the version, the range unit,
that findings index the original string in Unicode code points (its input
starts with non-ASCII characters, so a byte offset would land in the wrong
place), that `scan_and_redact` agrees with `scan` plus `redact`, that an
incremental session split inside the credential produces the same text, that a
finding's representation never carries the matched value, and that a bad call
raises the sanitized `SecretScanError` hierarchy.

`--conformance` then runs `bindings/python/tests` against that installed wheel.
Those tests read the shared `conformance/` corpus, so this is the artifact
meeting the same cross-language contract as every other binding; they import
`secret_scan` like any consumer, so they exercise the wheel and not the
sources.

## The source distribution

The sdist carries the whole buildable workspace: the binding, the vendored core
crate its path dependency points at, and `Cargo.lock`. It does not carry
`bindings/python/tests`, which read the repository's `conformance/` corpus and
could not run from the archive.

With a Rust toolchain at or above the workspace MSRV (1.88), it builds like any
source install. Without one, maturin's build backend requests `puccinialin` and
downloads a toolchain into a local cache rather than failing. That is
convenient and it is also a network fetch of a compiler, so the opt-out is part
of the contract:

```sh
MATURIN_NO_INSTALL_RUST=1 pip install --no-binary omiologic-secret-scan omiologic-secret-scan
```

With that set and no `cargo` on `PATH`, the build fails with
`Cargo metadata failed. Do you have cargo in your PATH?`.

`scripts/qualify-python-wheel.py` checks both branches. The failing branch runs
with `MATURIN_NO_INSTALL_RUST=1`, with every `PATH` entry that contains cargo
removed, and with `HOME`, `CARGO_HOME`, and the rustup variables pointed
elsewhere — cargo is reachable through more than `PATH`, and a check that only
emptied `PATH` would pass on a host that has rustup installed. It requires a
non-zero exit whose output names cargo, so an obscure failure is a failure.

It installs the archive with `--no-binary <distribution>` and not
`--no-binary :all:`. `:all:` would also force maturin itself to build from
source, and maturin's own source build bootstraps a Rust toolchain — which
would make the assertion pass for a reason that has nothing to do with the
artifact under test.

The building branch installs the archive with the host's toolchain and runs the
same smoke test, which is what proves the vendoring is complete.

## Versions

`pyproject.toml` declares `dynamic = ["version"]`, so maturin takes the version
from the Cargo workspace and the Python distribution cannot drift from the
other artifacts (`decision-release-bindings-in-lockstep`). PyPI normalizes it:
the workspace's `0.1.0-beta.1` is the wheel's `0.1.0b1`, while
`secret_scan.VERSION` reports the Cargo spelling. Qualification checks both,
in both directions.

## Verification

```bash
npm run python:check
uvx maturin build --release -m bindings/python/Cargo.toml -o dist
uvx maturin sdist -m bindings/python/Cargo.toml -o dist
python3 scripts/qualify-python-wheel.py --conformance dist/*.whl
python3 scripts/qualify-python-wheel.py --build-sdist dist/*.tar.gz
```

`.github/workflows/python-wheels.yml` runs the same commands: a `policy` job,
a `sdist` job, one `wheels` job per target, and a `qualify-matrix` job that
collects every artifact and requires one wheel per declared target plus a
source distribution. It also exposes `workflow_call`, so release qualification
can reuse it without restating the matrix.

No release is authorized by any of this. Publishing requires the separate
approval defined by repository governance.
