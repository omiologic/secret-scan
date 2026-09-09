# secret-scan-cli

Binary name: `secret-scan`. Path: `crates/secret-scan-cli`.

The CLI is a host adapter over the `secret-scan` core crate. It may use the
process environment, standard streams, and the filesystem; the core may not.
Scanning subcommands are added after library and binding parity. Today the
binary only supports `--version`, which the native-host smoke check runs.
