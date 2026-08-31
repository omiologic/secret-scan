# Feature notes

`secret-scan` is a deterministic, runtime-neutral JavaScript/TypeScript library for detecting and redacting likely credentials before untrusted text crosses a trust boundary.

## Features

- [Known-format credential detection](./known-format-detection/) — **current**
- [Contextual credential detection](./contextual-detection/) — **current**
- [Deterministic scanning and detector extensions](./detector-pipeline/) — **current**
- [Policy controls](./policy-controls/) — **current**
- [Safe redaction](./safe-redaction/) — **current**
- [Browser and Node runtime support](./runtime-support/) — **current** in the repository; the package is still pre-release

## How the features fit together

Built-in and consumer-supplied detectors emit candidates. The detector pipeline validates them, resolves overlaps, and produces safe metadata. Policy assigns an action to each finding, and redaction replaces findings marked `redact` or `block`. The same side-effect-free core runs in browser and server environments, but server-side scanning remains the authoritative enforcement boundary.

See the [processing pipeline](../../ARCHITECTURE.md#processing-pipeline) and [client/server model](../../ARCHITECTURE.md#clientserver-model) for the authoritative system view.
