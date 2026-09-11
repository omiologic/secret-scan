#!/usr/bin/env python3
"""Enforce issue #156's CI-enforcement shape for `.github/workflows/sast.yml`.

A workflow file can look right and still let the wrong thing gate the
build -- e.g. an edit that drops `continue-on-error` from the SARIF upload
step would make code-scanning availability able to fail (or, checked the
other way, mask) the job, exactly what issue #156 forbids: "SARIF is
uploaded ... without making upload availability the only enforcement
signal." This script checks the properties a reviewer would otherwise have
to re-derive by reading the workflow every time:

1. The scan step (`id: scan`) declares `continue-on-error: true`, so its
   real result is deferred rather than stopping later steps.
2. The final enforcement step reads `steps.scan.outcome` -- the step's real
   result, unmasked by `continue-on-error` -- never `steps.scan.conclusion`,
   which `continue-on-error` overrides to `success`.
3. The SARIF-to-code-scanning upload step also declares
   `continue-on-error: true` and `if: always()`, so it runs regardless of
   the scan's outcome and never itself fails the job.
4. The job declares a bounded `timeout-minutes`.
5. The workflow triggers on both `pull_request` and `push` to `main`, so
   the same gate applies before and after merge.

This intentionally parses the workflow YAML with plain text and regular
expressions, matching `check-release-refs.py` and `check-release-gate.py`:
no third-party dependency is declared for the scripts in this directory.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

SAST_WORKFLOW = Path(".github") / "workflows" / "sast.yml"
JOB_NAME = "opengrep"

# A named top-level job block: `  <job-name>:` through the line before the
# next top-level job (or end of file).
JOB_BLOCK = re.compile(r"^  (?P<name>[A-Za-z][\w-]*):\n(?P<body>(?:[ \t]{3,}.*\n|[ \t]*\n)*)", re.M)

# A named step within a job body: `- name: <name>` through the line before
# the next step (or end of the job body). Steps are three-space indented
# list items directly under `steps:`.
STEP_BLOCK = re.compile(r"^ {6}- name:\s*(?P<name>.+)\n(?P<body>(?:(?! {6}- name:).*\n?)*)", re.M)


def job_body(workflow_text: str, job_name: str) -> str | None:
    for match in JOB_BLOCK.finditer(workflow_text):
        if match.group("name") == job_name:
            return match.group("body")
    return None


def step_bodies(job_text: str) -> dict[str, str]:
    return {match.group("name").strip(): match.group("body") for match in STEP_BLOCK.finditer(job_text)}


def declares_continue_on_error(step_text: str) -> bool:
    return bool(re.search(r"^ {8}continue-on-error:\s*true\s*$", step_text, re.M))


def declares_always(step_text: str) -> bool:
    return bool(re.search(r"^ {8}if:\s*always\(\)\s*$", step_text, re.M))


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    path = root / SAST_WORKFLOW
    if not path.is_file():
        return [f"{SAST_WORKFLOW.as_posix()}: missing workflow"]
    text = path.read_text(encoding="utf-8")
    relative = SAST_WORKFLOW.as_posix()

    if "on:" not in text or "pull_request" not in text:
        errors.append(f"{relative}: does not trigger on pull_request")
    if "push:" not in text or not re.search(r"branches:\s*\n\s*-\s*main", text):
        errors.append(f"{relative}: does not trigger on push to main")

    body = job_body(text, JOB_NAME)
    if body is None:
        return errors + [f"{relative}: missing job {JOB_NAME!r}"]

    if not re.search(r"^ {4}timeout-minutes:\s*\d+\s*$", body, re.M):
        errors.append(f"{relative}: job {JOB_NAME!r} declares no timeout-minutes")

    steps = step_bodies(body)

    scan_steps = [(name, step) for name, step in steps.items() if re.search(r"^ {8}id:\s*scan\s*$", step, re.M)]
    if not scan_steps:
        errors.append(f"{relative}: no step declares id: scan")
    else:
        for name, step in scan_steps:
            if not declares_continue_on_error(step):
                errors.append(f"{relative}: step {name!r} (id: scan) must declare continue-on-error: true")

    enforce_steps = [(name, step) for name, step in steps.items() if "steps.scan.outcome" in step]
    if not enforce_steps:
        errors.append(f"{relative}: no step checks steps.scan.outcome")
    for name, step in steps.items():
        if "steps.scan.conclusion" in step:
            errors.append(
                f"{relative}: step {name!r} checks steps.scan.conclusion, which continue-on-error masks to "
                "'success' -- check steps.scan.outcome instead"
            )

    sarif_upload_steps = [
        (name, step) for name, step in steps.items() if "codeql-action/upload-sarif" in step
    ]
    if not sarif_upload_steps:
        errors.append(f"{relative}: no step uploads SARIF via github/codeql-action/upload-sarif")
    for name, step in sarif_upload_steps:
        if not declares_continue_on_error(step):
            errors.append(
                f"{relative}: step {name!r} uploads SARIF but lacks continue-on-error: true -- "
                "code-scanning availability must never be the only enforcement signal"
            )
        if not declares_always(step):
            errors.append(f"{relative}: step {name!r} uploads SARIF but lacks if: always()")

    return errors


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    errors = validate(root.resolve())
    for error in errors:
        print(f"ERROR {error}")
    print(f"SAST workflow check complete: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
