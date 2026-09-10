#!/usr/bin/env python3
"""Enforce that every release-capable job rejects non-`main` refs.

Issue #78 (`RB-8`) and issue #143 both require `Release` and
`Reconcile Release` to "reject non-`main` refs", not just to share a
protected environment (`check-release-environment.py` already covers the
environment-name half). Today that guard is a `run: exit 1` step each job
author has to remember to add; nothing failed the build if a new publish job
shipped without one. This script closes that gap statically, the same way
`check-release-gate.py` pins the qualification `needs:` graph.

Checks, in order:

1. Every job in `RELEASE_JOBS` (`.github/workflows/release.yml`) contains a
   step whose `if:` rejects `github.ref != 'refs/heads/main'`.
2. Every job in `RECONCILE_JOBS` (`.github/workflows/reconcile-release.yml`)
   does the same.

This intentionally parses the workflow YAML with plain text and regular
expressions, matching `check-release-environment.py` and
`check-release-gate.py`: no third-party dependency is declared for the
scripts in this directory.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

RELEASE_WORKFLOW = Path(".github") / "workflows" / "release.yml"
RELEASE_JOBS = ("publish", "publish-crates", "publish-pypi")

RECONCILE_WORKFLOW = Path(".github") / "workflows" / "reconcile-release.yml"
RECONCILE_JOBS = ("reconcile",)

# A named top-level job block: `  <job-name>:` through the line before the
# next top-level job (or end of file). Workflow jobs are two-space indented
# directly under `jobs:`; everything inside a job is indented at least three
# spaces (or blank), so the body stops exactly at the next two-space job
# header instead of swallowing it.
JOB_BLOCK = re.compile(r"^  (?P<name>[A-Za-z][\w-]*):\n(?P<body>(?:[ \t]{3,}.*\n|[ \t]*\n)*)", re.M)

# A step condition that rejects any ref other than `refs/heads/main`, e.g.
# `if: github.ref != 'refs/heads/main'`. Whitespace and quote style are
# tolerated; the comparison operands and operator are not.
REF_GUARD = re.compile(r"""if:\s*github\.ref\s*!=\s*['"]refs/heads/main['"]""")


def job_body(workflow_text: str, job_name: str) -> str | None:
    for match in JOB_BLOCK.finditer(workflow_text):
        if match.group("name") == job_name:
            return match.group("body")
    return None


def rejects_non_main(job_text: str) -> bool:
    return bool(REF_GUARD.search(job_text))


def _check_workflow(root: Path, workflow: Path, jobs: tuple[str, ...]) -> list[str]:
    errors: list[str] = []
    path = root / workflow
    if not path.is_file():
        return [f"{workflow.as_posix()}: missing workflow"]
    text = path.read_text(encoding="utf-8")
    for job_name in jobs:
        body = job_body(text, job_name)
        if body is None:
            errors.append(f"{workflow.as_posix()}: missing job {job_name!r}")
            continue
        if not rejects_non_main(body):
            errors.append(
                f"{workflow.as_posix()}: job {job_name!r} does not reject non-main refs"
            )
    return errors


def validate(root: Path) -> list[str]:
    root = root.resolve()
    errors: list[str] = []
    errors += _check_workflow(root, RELEASE_WORKFLOW, RELEASE_JOBS)
    errors += _check_workflow(root, RECONCILE_WORKFLOW, RECONCILE_JOBS)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("root", nargs="?", default=Path.cwd(), type=Path)
    args = parser.parse_args()

    errors = validate(args.root)
    for error in errors:
        print(f"ERROR {error}")
    print(f"Release ref-guard check complete: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
