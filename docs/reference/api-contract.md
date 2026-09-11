# API concepts and contracts

[Documentation home](../README.md)

| Operation | JavaScript | Python / Rust | Result |
| --- | --- | --- | --- |
| Detect and apply policy | `scan` | `scan` | Findings |
| Replace supplied ranges | `redact` | `redact` | Text |
| Both together | `scanAndRedact` | `scan_and_redact` | Text and findings |

Bindings adapt arguments and results; they do not copy detector logic. Rust
additionally takes a registry, policy, and formatter. Python uses optional
`policy` and `formatter`; JavaScript uses an options object with `policy` and
`placeholderFormatter`.

## Findings and coordinates

Each finding has `id`, `type`, `detector`, `confidence`, `action`, `start`, and
`end` (Rust exposes methods and a range object). No matched value is included.
Ranges are half-open: `start` is included and `end` excluded.

| Surface | Unit | Exported `RANGE_UNIT` |
| --- | --- | --- |
| JavaScript | UTF-16 code units | `utf16-code-units` |
| Python | Unicode code points | `unicode-code-points` |
| Rust and CLI | UTF-8 bytes | `utf8-bytes` |

All offsets refer to original input. For example, `🔑 ` before a finding adds
3 JavaScript units, 2 Python code points, or 5 UTF-8 bytes. Do not copy numeric
positions between runtimes without converting against the same input. The
conformance corpus's schema label `utf8-byte` names the same byte coordinate
system; it is a separate field from runtime `rangeUnit`.

Within a scan, findings are sorted by position and numbered from `finding-1`.
Incremental sessions use absolute positions and continuous numbering. CLI
multi-file reports renumber findings across the run. IDs are not persistent
identities across changed inputs or separate scans.

## Overlap and replacement

Candidate precedence is specificity, confidence, narrower span, detector order,
then emission order. The pipeline greedily chooses non-overlapping candidates.
A policy runs on the selected findings afterward.

Direct `redact` accepts unsorted findings, sorts them, and rejects overlaps,
invalid bounds, and ranges off character boundaries. It does not resolve
conflicting caller-supplied findings. Use the same original input that was
scanned; validation cannot establish that a finding belongs to that input.

Only `redact` and `block` consume placeholders. Default labels are `<SECRET_1>`,
`<SECRET_2>`, etc.; `warn` and `allow` preserve input. Placeholders are not an
encoding of the removed text and cannot be used to recover it.

## Errors and extensions

Failures use fixed codes and input-free messages. JavaScript exposes
`SecretScanError`; Python has subclasses of the same name; Rust returns
`SecretScanError` in `Result`. [Troubleshooting](../troubleshooting.md) covers
common causes. Policy and formatter callbacks are supported across languages;
custom detector callbacks are a direct Rust surface only.
