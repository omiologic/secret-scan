//! `secret-scan` command-line interface.
//!
//! The CLI is a host adapter: it owns process arguments, standard streams,
//! exit codes, and file access, and delegates all detection behavior to the
//! `secret_scan` core. Scanning commands arrive after library and binding
//! parity (`decision-adopt-rust-core-monorepo`); this scaffold only reports the
//! product version so native-host smoke checks can exercise the binary.

#![forbid(unsafe_code)]

use std::io::Write as _;
use std::process::ExitCode;

const USAGE: &str = "usage: secret-scan --version";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let ["--version" | "-V"] = args
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>()
        .as_slice()
    {
        let mut stdout = std::io::stdout().lock();
        if writeln!(stdout, "secret-scan {}", secret_scan::VERSION).is_err() {
            return ExitCode::FAILURE;
        }
        return ExitCode::SUCCESS;
    }
    let mut stderr = std::io::stderr().lock();
    let _ = writeln!(stderr, "{USAGE}");
    ExitCode::from(2)
}
