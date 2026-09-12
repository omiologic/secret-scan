# Performance assessment — rust-core

- Profile: `scale-logs-small-whole`
- Schema version: `2`
- Artifact: `redact-secret@0.1.0-beta.1`
- Commit: `3f6bd022952f59cac260fb177313752ca1428650`
- Host: macos-25.5.0 / aarch64 / rustc-1.98.1 (48a229cea 2026-09-01)
- Command: `cargo run -p redact-secret --example assessment_adapter -- performance --profile scale-logs-small-whole --runs 2 --json-out assessment/results/rust-core/scale-logs-small-whole.json --markdown-out assessment/results/rust-core/scale-logs-small-whole.md`

## Timing and throughput distributions

| Measurement | Unit | Runs | Min | Median | p95 | Max | Mean | Population std dev |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Initialization | milliseconds | 2 | 0.009333000000000001 | 0.108771 | 0.208209 | 0.208209 | 0.108771 | 0.099438 |
| Steady-state processing | milliseconds | 2 | 89.719958 | 89.777125 | 89.83429199999999 | 89.83429199999999 | 89.777125 | 0.05716699999999264 |
| Throughput | bytes-per-second | 2 | 729721.3407102936 | 730186.2983497564 | 730651.2559892192 | 730651.2559892192 | 730186.2983497564 | 464.9576394627802 |

Raw samples are preserved in the JSON result under each distribution's `samples` field.

## Memory observations

Memory categories are reported separately and must not be summed.

| Category | Samples | Baseline bytes (min) | Maximum observed bytes (max) | Availability / sampling limit |
| --- | ---: | ---: | ---: | --- |
| browserJsHeap | 0 | — | — | The Rust library does not run inside a browser JavaScript heap.; No samples were available. |
| nodeExternal | 0 | — | — | The Rust library has no Node external-memory category.; No samples were available. |
| nodeHeap | 0 | — | — | The Rust library does not run inside a Node.js heap.; No samples were available. |
| nodeRss | 2 | 3325952 | 3391488 | available; Sampled immediately before and after processing; short-lived peaks between those boundaries may be missed, so maxima are observed samples, not guaranteed true peaks. |
| streamingBuffer | 0 | — | — | The public incremental session exposes lifecycle state but intentionally does not expose retained plaintext buffer size.; No samples were available. |
| wasmLinearMemory | 0 | — | — | The Rust library surface does not use WebAssembly linear memory.; No samples were available. |

Observed maxima are sampled observations, not guaranteed true peaks.
