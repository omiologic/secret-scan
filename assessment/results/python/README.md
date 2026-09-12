# Installed Python baseline

This directory records the first bounded assessment of an installed Python
candidate package for issue #196. It is inspectable evidence, not a release
gate or release authorization.

## Identity

- Source revision: `404e33a7d82921bec19e21ef28692fa07d660ab5`
- Distribution: `redact-secret==0.1.0b1`
- Wheel: `redact_secret-0.1.0b1-cp310-abi3-macosx_11_0_arm64.whl`
- Wheel SHA-256: `30184a72ebc7f4f358ecca383e024072d140a4b7dae91f107464f5540d5fe88a`
- Host: macOS 26.5.2 (`darwin-25.5.0`), arm64
- Runtime: CPython 3.14.7
- Accuracy corpus: version 1; its exact SHA-256 is in
  [`accuracy-corpus.json`](./accuracy-corpus.json)
- Workload profiles: version 1; their exact SHA-256 is in
  [`scale-logs-small-whole.json`](./scale-logs-small-whole.json)

## Exact commands

```bash
uvx maturin build --release -m bindings/python/Cargo.toml -o dist
python3 -m venv .venv
.venv/bin/python -m pip install --no-index --no-deps --only-binary :all: --disable-pip-version-check dist/redact_secret-0.1.0b1-cp310-abi3-macosx_11_0_arm64.whl
.venv/bin/python scripts/assessment-python-worker.py self-test
npm run assessment:python -- --python .venv/bin/python --json-out assessment/results/python/accuracy-corpus.json --markdown-out assessment/results/python/accuracy-corpus.md --mismatches-out assessment/results/python/accuracy-corpus-mismatches.json
npm run assessment:python:performance -- --python .venv/bin/python --profile scale-logs-small-whole --runs 2 --json-out assessment/results/python/scale-logs-small-whole.json --markdown-out assessment/results/python/scale-logs-small-whole.md
```

The installation uses no index, dependencies, or source fallback. The adapter
also checks that `redact_secret` resolves to the installed distribution instead
of a source checkout.

## Result and limits

The accuracy run completed all 9 fixtures through both `scan_and_redact` and a
code-point-chunked `IncrementalSanitizer`. It normalized each Python range to a
UTF-8 byte range and verified that both representations select the same source
span before common scoring. The raw result and safe mismatch metadata are in
[`accuracy-corpus.json`](./accuracy-corpus.json) and
[`accuracy-corpus-mismatches.json`](./accuracy-corpus-mismatches.json).

The performance baseline is the inspected 64 KiB
`scale-logs-small-whole` profile with two fresh-process repetitions. Raw import,
processing, throughput, `pythonHeap`, and `processRss` samples are in
[`scale-logs-small-whole.json`](./scale-logs-small-whole.json).

- Import timing includes loading the installed Python facade and native
  extension, but excludes process startup and request transport.
- Processing timing covers only a warmed public operation. Input generation,
  partitioning, warmup, memory collection, aggregation, and rendering are
  excluded.
- `pythonHeap` is a separate untimed `tracemalloc` pass. It excludes the
  interpreter's pre-existing heap and native Rust allocations.
- `processRss` is a Unix process-lifetime `ru_maxrss` high-water mark. It
  includes the interpreter, native extension, allocator, and earlier activity,
  so it cannot isolate Rust-only memory or an operation-local peak.
- Retained incremental plaintext bytes are unavailable because the public API
  intentionally exposes no buffer-size instrumentation. Node, browser, and
  Wasm categories are unavailable on this surface. Categories overlap and must
  not be summed.
