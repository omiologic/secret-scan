# Performance assessment — python

- Profile: `scale-logs-small-whole`
- Schema version: `3`
- Artifact: `redact-secret==0.1.0b1`
- Commit: `404e33a7d82921bec19e21ef28692fa07d660ab5`
- Host: darwin-25.5.0 / arm64 / cpython-3.14.7
- Command: `node scripts/assessment-python-performance.mjs --python .venv/bin/python --profile scale-logs-small-whole --runs 2 --json-out assessment/results/python/scale-logs-small-whole.json --markdown-out assessment/results/python/scale-logs-small-whole.md`

## Timing and throughput distributions

| Measurement | Unit | Runs | Min | Median | p95 | Max | Mean | Population std dev |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Initialization | milliseconds | 2 | 0.93525 | 0.9615 | 0.98775 | 0.98775 | 0.9615 | 0.026249999999999996 |
| Steady-state processing | milliseconds | 2 | 10.590167 | 10.8361045 | 11.082042 | 11.082042 | 10.8361045 | 0.24593750000000014 |
| Throughput | bytes-per-second | 2 | 5915335.8198786825 | 6052708.809672084 | 6190081.799465486 | 6190081.799465486 | 6052708.809672084 | 137372.98979340168 |

Raw samples are preserved in the JSON result under each distribution's `samples` field.

## Memory observations

Memory categories are reported separately and must not be summed.

| Category | Samples | Baseline bytes (min) | Maximum observed bytes (max) | Availability / sampling limit |
| --- | ---: | ---: | ---: | --- |
| nodeHeap | 0 | — | — | The Python process does not run inside a Node.js heap.; No samples were available. |
| nodeRss | 0 | — | — | The Python process is not a Node.js process; its whole-process RSS is reported as processRss.; No samples were available. |
| nodeExternal | 0 | — | — | The Python process has no Node external-memory category.; No samples were available. |
| browserJsHeap | 0 | — | — | The Python process does not run inside a browser JavaScript heap.; No samples were available. |
| wasmLinearMemory | 0 | — | — | The Python package uses a native extension, not WebAssembly linear memory.; No samples were available. |
| pythonHeap | 2 | 0 | 74188 | available; Measured by tracemalloc during a separate untimed processing pass; it observes Python allocations made after tracing starts, not the interpreter's pre-existing heap or native Rust allocations. |
| processRss | 2 | 25542656 | 26132480 | available; Unix ru_maxrss high-water marks sampled immediately before and after a separate untimed processing pass; the value includes the Python interpreter, native extension, allocator, and earlier process activity and cannot isolate Rust-only memory. |
| streamingBuffer | 0 | — | — | The public incremental session exposes lifecycle state but intentionally does not expose retained plaintext buffer size.; No samples were available. |

Observed maxima are sampled observations, not guaranteed true peaks.
