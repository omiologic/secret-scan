# Performance assessment — rust-core

- Profile: `scale-logs-small-whole`
- Schema version: `2`
- Artifact: `redact-secret@0.1.0-beta.1`
- Commit: `f221571e862e57dde3278255ba85fe7c9be053eb`
- Host: macos-25.5.0 / aarch64 / rustc-1.98.1 (48a229cea 2026-09-01)
- Command: `cargo run -p redact-secret --example assessment_adapter -- performance --profile scale-logs-small-whole --runs 2 --json-out assessment/results/rust-core/scale-logs-small-whole.json --markdown-out assessment/results/rust-core/scale-logs-small-whole.md`

## Timing and throughput distributions

| Measurement | Unit | Runs | Min | Median | p95 | Max | Mean | Population std dev |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Initialization | milliseconds | 2 | 0.023458 | 0.26056250000000003 | 0.497667 | 0.497667 | 0.26056250000000003 | 0.2371045 |
| Steady-state processing | milliseconds | 2 | 96.63545900000001 | 132.867667 | 169.099875 | 169.099875 | 132.867667 | 36.23220799999999 |
| Throughput | bytes-per-second | 2 | 387664.39064487774 | 533014.1099030898 | 678363.829161302 | 678363.829161302 | 533014.1099030898 | 145349.7192582121 |

Raw samples are preserved in the JSON result under each distribution's `samples` field.

## Memory observations

Memory categories are reported separately and must not be summed.

| Category | Samples | Baseline bytes (min) | Maximum observed bytes (max) | Availability / sampling limit |
| --- | ---: | ---: | ---: | --- |
| browserJsHeap | 0 | — | — | The Rust library does not run inside a browser JavaScript heap.; No samples were available. |
| nodeExternal | 0 | — | — | The Rust library has no Node external-memory category.; No samples were available. |
| nodeHeap | 0 | — | — | The Rust library does not run inside a Node.js heap.; No samples were available. |
| nodeRss | 2 | 3899392 | 3981312 | available; Sampled immediately before and after processing; short-lived peaks between those boundaries may be missed, so maxima are observed samples, not guaranteed true peaks. |
| streamingBuffer | 0 | — | — | The public incremental session exposes lifecycle state but intentionally does not expose retained plaintext buffer size.; No samples were available. |
| wasmLinearMemory | 0 | — | — | The Rust library surface does not use WebAssembly linear memory.; No samples were available. |

Observed maxima are sampled observations, not guaranteed true peaks.
