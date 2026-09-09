//! `secret-scan` command-line interface.
//!
//! The CLI is a host adapter: it owns process arguments, standard streams,
//! exit codes, and file access, and delegates all detection, policy, and
//! redaction behavior to the `secret_scan` core
//! (`decision-adopt-rust-core-monorepo`). It reports the same product version
//! as every other artifact in the workspace
//! (`decision-release-bindings-in-lockstep`).
//!
//! Two modes:
//!
//! - **check** (the default) scans standard input, or every path it is given,
//!   and reports safe file identity and finding metadata. It never reports
//!   matched plaintext, in either the line format or the JSON format.
//! - **redact** (`--redact`) sanitizes standard input, or exactly one path,
//!   and writes the result to standard output. It never modifies its input.
//!
//! Exit codes are the contract a pre-commit hook or CI job keys off: `0` when
//! nothing was found, `1` when anything was, and `2` for a usage, decoding, or
//! processing failure. A failure outranks a finding, so a run that could not
//! read part of its input never reports success.

#![forbid(unsafe_code)]

mod args;
mod failure;
mod input;
mod limits;
mod modes;
mod report;

use std::env;
use std::io::{self, BufWriter, Write};
use std::process::ExitCode;

use secret_scan::{RANGE_UNIT, VERSION};

use args::{Command, Format};
use failure::Failure;
use limits::{MAX_BUFFERED_BYTES, MAX_INPUT_BYTES, MAX_MULTILINE_BYTES, MAX_TOKEN_BYTES};

/// The short usage block printed with a rejected command line.
const USAGE: &str = "\
usage: secret-scan [--json] [--] [<path>...]
       secret-scan --redact [--] [<path>]
       secret-scan --version | -V
       secret-scan --help | -h";

/// What the run proved, before it is turned into an exit code.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Outcome {
    /// Every source was scanned and nothing was found.
    Clean,
    /// Every source was scanned and at least one finding exists.
    Findings,
    /// At least one source could not be scanned. The diagnostics are already
    /// written; the caller only has to choose the exit code.
    Failed,
}

fn main() -> ExitCode {
    let mut stdin = io::stdin().lock();
    let mut stdout = BufWriter::new(io::stdout().lock());
    let mut stderr = io::stderr().lock();

    let mut outcome = run(env::args_os().skip(1), &mut stdin, &mut stdout, &mut stderr);
    // A buffered write that only fails at flush time must still fail the run:
    // a redaction whose tail never reached the pipe is not a redaction.
    if stdout.flush().is_err() {
        outcome = Err(Failure::WriteFailed);
    }

    match outcome {
        Ok(Outcome::Clean) => ExitCode::SUCCESS,
        Ok(Outcome::Findings) => ExitCode::from(1),
        Ok(Outcome::Failed) => ExitCode::from(2),
        Err(failure) => {
            report_failure(&mut stderr, failure);
            ExitCode::from(2)
        }
    }
}

/// Runs one invocation.
///
/// # Errors
///
/// Returns the single failure that stopped the run. Check mode reports a
/// per-source failure inside its report instead and returns
/// [`Outcome::Failed`], so a multi-file run describes every source it could
/// not scan rather than only the first.
fn run<I>(
    args: I,
    stdin: &mut dyn io::Read,
    stdout: &mut dyn Write,
    stderr: &mut dyn Write,
) -> Result<Outcome, Failure>
where
    I: IntoIterator<Item = std::ffi::OsString>,
{
    match args::parse(args)? {
        Command::Help => {
            write_line(stdout, &help())?;
            Ok(Outcome::Clean)
        }
        Command::Version => {
            write_line(stdout, &format!("secret-scan {VERSION}"))?;
            Ok(Outcome::Clean)
        }
        Command::Check { sources, format } => {
            let report = modes::check(&sources, stdin);
            match format {
                Format::Text => report.write_text(stdout, stderr)?,
                Format::Json => report.write_json(stdout)?,
            }
            report.write_diagnostics(stderr)?;

            if report.has_failures() {
                Ok(Outcome::Failed)
            } else if report.finding_count() > 0 {
                Ok(Outcome::Findings)
            } else {
                Ok(Outcome::Clean)
            }
        }
        Command::Redact { source } => {
            modes::redact(&source, stdin, stdout)?;
            Ok(Outcome::Clean)
        }
    }
}

fn write_line(out: &mut dyn Write, text: &str) -> Result<(), Failure> {
    writeln!(out, "{text}").map_err(|_| Failure::WriteFailed)
}

/// Writes the one fatal failure to `stderr`, best effort.
///
/// Reporting a failure cannot itself fail the run any further: the exit code
/// is already 2, and there is no other channel left to complain on.
fn report_failure(stderr: &mut dyn Write, failure: Failure) {
    let _ = writeln!(
        stderr,
        "secret-scan: {}: {}",
        failure.code(),
        failure.message()
    );
    if matches!(failure, Failure::Usage(_)) {
        let _ = writeln!(stderr, "{USAGE}");
    }
}

/// The full usage document.
fn help() -> String {
    format!(
        "\
secret-scan {VERSION} — deterministic secret detection and redaction

{USAGE}

check mode (the default)
  Reads standard input when no path is given, and otherwise reads every path
  in the order it was given. Reports safe file identity and finding metadata
  only: a range names a span in the input, never the bytes in that span.

  --json  Write one JSON object instead of one line per finding. The object
          carries \"version\", \"rangeUnit\", \"findingCount\", a \"sources\" array
          of {{\"source\", \"findings\"}}, and a \"failures\" array of
          {{\"source\", \"code\", \"message\"}}. Every field is safe metadata.

  Line format:
    <source>:<start>-<end> <type> detector=<id> confidence=<level> \
action=<action> id=<finding>

redact mode
  Reads standard input, or exactly one path, and writes the sanitized text to
  standard output. The input is never modified in place, and no path is ever
  opened for writing.

exit codes
  0  every source was scanned and nothing was found
  1  every source was scanned and at least one finding exists
  2  usage, decoding, or processing failure — including input that is not
     valid UTF-8, which fails closed rather than being scanned in part

limits
  Standard input is streamed through the incremental core, because a
  credential may straddle any chunk boundary; a path is read whole. Both are
  bounded explicitly:

    max input      {MAX_INPUT_BYTES} bytes per source
    max buffered   {MAX_BUFFERED_BYTES} bytes of unresolved plaintext
    max token      {MAX_TOKEN_BYTES} bytes per open single-line construct
    max multiline  {MAX_MULTILINE_BYTES} bytes per open private-key block

  Ranges are UTF-8 byte offsets into the original input, reported as
  \"{RANGE_UNIT}\"."
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;

    /// A synthetic, revoked-shaped token that authenticates nothing.
    const SYNTHETIC_TOKEN: &str = "ghp_SYNTHETICREVOKED00000000000000000000";

    struct Run {
        outcome: Result<Outcome, Failure>,
        stdout: String,
        stderr: String,
    }

    fn invoke(args: &[&str], stdin: &str) -> Run {
        let mut input = stdin.as_bytes();
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let outcome = run(
            args.iter().map(OsString::from),
            &mut input,
            &mut stdout,
            &mut stderr,
        );
        Run {
            outcome,
            stdout: String::from_utf8(stdout).unwrap(),
            stderr: String::from_utf8(stderr).unwrap(),
        }
    }

    #[test]
    fn version_output_is_unchanged() {
        let run = invoke(&["--version"], "");
        assert_eq!(run.outcome, Ok(Outcome::Clean));
        assert_eq!(run.stdout, format!("secret-scan {VERSION}\n"));
    }

    #[test]
    fn help_documents_both_modes_the_exit_codes_and_the_limits() {
        let run = invoke(&["--help"], "");
        assert_eq!(run.outcome, Ok(Outcome::Clean));
        for expected in [
            "check mode",
            "redact mode",
            "--json",
            "exit codes",
            "limits",
            "utf8-bytes",
            &MAX_INPUT_BYTES.to_string(),
            &MAX_TOKEN_BYTES.to_string(),
            &MAX_MULTILINE_BYTES.to_string(),
            &MAX_BUFFERED_BYTES.to_string(),
        ] {
            assert!(run.stdout.contains(expected), "help omits {expected}");
        }
    }

    #[test]
    fn a_clean_standard_input_check_exits_clean() {
        let run = invoke(&[], "nothing interesting here\n");
        assert_eq!(run.outcome, Ok(Outcome::Clean));
        assert_eq!(run.stdout, "");
    }

    #[test]
    fn a_finding_on_standard_input_reports_metadata_only() {
        let run = invoke(&[], &format!("API_KEY={SYNTHETIC_TOKEN}\n"));
        assert_eq!(run.outcome, Ok(Outcome::Findings));
        assert!(run.stdout.starts_with("<stdin>:8-48 github_token"));
        assert!(!run.stdout.contains(SYNTHETIC_TOKEN));
        assert!(!run.stderr.contains(SYNTHETIC_TOKEN));
    }

    #[test]
    fn the_json_report_is_parseable_and_carries_no_matched_text() {
        let run = invoke(&["--json"], &format!("API_KEY={SYNTHETIC_TOKEN}\n"));
        assert_eq!(run.outcome, Ok(Outcome::Findings));
        assert!(run.stdout.contains("\"findingCount\": 1"));
        assert!(run.stdout.contains("\"type\": \"github_token\""));
        assert!(run.stdout.contains("\"start\": 8"));
        assert!(!run.stdout.contains(SYNTHETIC_TOKEN));
    }

    #[test]
    fn malformed_standard_input_fails_closed_without_quoting_it() {
        let mut input: &[u8] = &[0xff, 0xfe, 0x00];
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let outcome = run(
            std::iter::empty::<OsString>(),
            &mut input,
            &mut stdout,
            &mut stderr,
        );

        assert_eq!(outcome, Ok(Outcome::Failed));
        let stderr = String::from_utf8(stderr).unwrap();
        assert!(stderr.contains("NOT_UTF8"));
        assert!(stderr.contains("Input is not valid UTF-8."));
    }

    #[test]
    fn redaction_writes_sanitized_text_and_nothing_else() {
        let run = invoke(&["--redact"], &format!("API_KEY={SYNTHETIC_TOKEN}\n"));
        assert_eq!(run.outcome, Ok(Outcome::Clean));
        assert_eq!(run.stdout, "API_KEY=<SECRET_1>\n");
        assert!(!run.stdout.contains(SYNTHETIC_TOKEN));
    }

    #[test]
    fn a_rejected_command_line_names_the_rule_not_the_argument() {
        let run = invoke(&["--redact", "--json"], "");
        assert_eq!(run.outcome, Err(Failure::Usage(failure::JSON_WITH_REDACT)));

        let mut stderr = Vec::new();
        report_failure(&mut stderr, Failure::Usage(failure::UNKNOWN_OPTION));
        let stderr = String::from_utf8(stderr).unwrap();
        assert!(stderr.contains("USAGE: unrecognized option"));
        assert!(stderr.contains("secret-scan --redact"));
    }
}
