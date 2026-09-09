# secret-scan-cli

Binary name: `secret-scan`. Path: `crates/secret-scan-cli`.

The CLI is a host adapter over the `secret-scan` core crate. It may use the
process environment, standard streams, and the filesystem; the core may not.
Every detection, policy, and redaction decision comes from the core, so the
CLI, the library, and every binding agree on the same input.

```text
usage: secret-scan [--json] [--] [<path>...]
       secret-scan --redact [--] [<path>]
       secret-scan --version | -V
       secret-scan --help | -h
```

## Check mode

The default. Reads standard input when no path is given, and otherwise reads
every path in the order it was given.

```bash
secret-scan src/config.ts src/client.ts   # scan files
git diff --cached | secret-scan           # scan a staged diff
secret-scan --json .env.example           # machine-consumable report
```

Output carries safe file identity and finding metadata only. A range names a
span in the input; it never carries the bytes in that span, and no renderer
has the input available to resolve one.

```text
<source>:<start>-<end> <type> detector=<id> confidence=<level> action=<action> id=<finding>
```

`--json` writes one object with `version`, `rangeUnit`, `findingCount`, a
`sources` array of `{source, findings}`, and a `failures` array of
`{source, code, message}`. Ranges are UTF-8 byte offsets into the original
input, the unit `secret_scan::RANGE_UNIT` names.

## Redact mode

`--redact` reads standard input, or exactly one path, and writes the sanitized
text to standard output. The input is never modified in place, and no path is
ever opened for writing.

```bash
secret-scan --redact log.txt > log.redacted.txt
kubectl logs pod | secret-scan --redact
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Every source was scanned and nothing was found. |
| `1` | Every source was scanned and at least one finding exists. |
| `2` | Usage, decoding, or processing failure. |

A failure outranks a finding: a run that could not read or decode part of its
input has not proved that part clean, so it exits `2` even when another source
produced findings. Input that is not valid UTF-8 fails closed rather than being
scanned in part, and the diagnostic names the source and a fixed code, never
the bytes that failed.

## Streaming, limits, and retention

Standard input is streamed through the core's incremental sanitizer, because a
credential may straddle any chunk boundary; a path is read whole. Both are
bounded by the explicit limits `--help` prints: total input per source,
retained unresolved plaintext, an open single-line construct, and an open
PEM-style block.

Every failure path leaves the session holding nothing. A partial read, a
decoding failure, a limit failure, and a closed downstream pipe each either
propagate a core error the core has already discarded behind, or abort the
session, which discards what it was holding.
