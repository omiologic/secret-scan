#!/usr/bin/env python3
"""Enforce that `release.yml` cannot publish without the qualification set.

Issue #77 (`RB-7`) requires that the `publish` job in
`.github/workflows/release.yml` is unreachable unless every job in the
required qualification set has succeeded for the exact commit being
released. This script fails when that graph drifts: a required reusable
workflow call job is removed, its `uses:` target is repointed, or `publish`
stops declaring it in `needs:`.

`REQUIRED_GATES` is the qualification set this repository can currently
enforce. The Node/browser/CLI qualification workflow issue #74 (`RB-4`) adds
is not in it yet, because that workflow does not exist -- RB-7 names RB-4 as
a dependency for exactly that reason. Add its job id here once it lands.

This intentionally parses the workflow YAML with plain text and regular
expressions rather than a YAML library, matching
`check-python-package.py`'s wheel-matrix check: no third-party dependency is
declared for the scripts in this directory.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

RELEASE_WORKFLOW = Path(".github") / "workflows" / "release.yml"

# job id -> the reusable workflow it must call.
REQUIRED_GATES = {
    "ci": "./.github/workflows/ci.yml",
    "python-wheels": "./.github/workflows/python-wheels.yml",
}

JOB_HEADER_PREFIX = "  "
ATTRIBUTE_PREFIX = "    "
LIST_ITEM_PREFIX = "      - "


def jobs_section(text: str) -> str:
    """Return the text of the `jobs:` mapping, excluding everything above it.

    Restricting to this slice keeps job-id detection from matching unrelated
    two-space-indented keys, such as `on:`'s `workflow_dispatch:`.
    """
    for line_start, line in _line_starts(text):
        if line == "jobs:":
            return text[line_start + len(line) + 1 :]
    raise ValueError(f"{RELEASE_WORKFLOW.as_posix()}: no jobs: section found")


def _line_starts(text: str) -> list[tuple[int, str]]:
    starts = []
    offset = 0
    for line in text.splitlines():
        starts.append((offset, line))
        offset += len(line) + 1
    return starts


def job_blocks(text: str) -> dict[str, str]:
    """Map each top-level job id in a `jobs:` slice to its body text."""
    lines = _line_starts(text)
    headers = [
        (offset, line[len(JOB_HEADER_PREFIX) : -1])
        for offset, line in lines
        if line.startswith(JOB_HEADER_PREFIX)
        and not line.startswith(ATTRIBUTE_PREFIX)
        and line.endswith(":")
    ]
    blocks: dict[str, str] = {}
    for index, (offset, job_id) in enumerate(headers):
        start = offset + len(JOB_HEADER_PREFIX) + len(job_id) + 1
        end = headers[index + 1][0] if index + 1 < len(headers) else len(text)
        blocks[job_id] = text[start:end]
    return blocks


def extract_uses(job_body: str) -> str | None:
    for line in job_body.splitlines():
        if line.startswith(ATTRIBUTE_PREFIX + "uses:"):
            return line[len(ATTRIBUTE_PREFIX + "uses:") :].strip()
    return None


def extract_needs(job_body: str) -> list[str]:
    lines = job_body.splitlines()
    for index, line in enumerate(lines):
        if not line.startswith(ATTRIBUTE_PREFIX + "needs:"):
            continue
        inline = line[len(ATTRIBUTE_PREFIX + "needs:") :].strip()
        if inline:
            return [item.strip() for item in inline.strip("[]").split(",") if item.strip()]
        items = []
        for later in lines[index + 1 :]:
            if not later.startswith(LIST_ITEM_PREFIX):
                break
            items.append(later[len(LIST_ITEM_PREFIX) :].strip())
        return items
    return []


def has_workflow_call_trigger(text: str) -> bool:
    return any(line.strip() == "workflow_call:" for line in text.splitlines())


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    release_path = root / RELEASE_WORKFLOW
    if not release_path.is_file():
        return [f"{RELEASE_WORKFLOW.as_posix()}: missing release workflow"]

    jobs = job_blocks(jobs_section(release_path.read_text(encoding="utf-8")))

    for gate, expected_uses in REQUIRED_GATES.items():
        body = jobs.get(gate)
        if body is None:
            errors.append(f"{RELEASE_WORKFLOW.as_posix()}: missing required gate job '{gate}'")
            continue
        actual_uses = extract_uses(body)
        if actual_uses != expected_uses:
            errors.append(
                f"{RELEASE_WORKFLOW.as_posix()}: job '{gate}' must call {expected_uses}, found {actual_uses!r}"
            )
        called_workflow = root / Path(expected_uses.removeprefix("./"))
        if called_workflow.is_file() and not has_workflow_call_trigger(
            called_workflow.read_text(encoding="utf-8")
        ):
            errors.append(f"{called_workflow.as_posix()}: does not expose workflow_call")

    publish = jobs.get("publish")
    if publish is None:
        errors.append(f"{RELEASE_WORKFLOW.as_posix()}: missing publish job")
    else:
        needs = set(extract_needs(publish))
        missing = sorted(set(REQUIRED_GATES) - needs)
        if missing:
            errors.append(
                f"{RELEASE_WORKFLOW.as_posix()}: publish job does not need {', '.join(missing)}"
            )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("root", nargs="?", default=Path.cwd(), type=Path)
    args = parser.parse_args()

    errors = validate(Path(args.root).resolve())
    for error in errors:
        print(f"ERROR {error}")
    print(f"Release gate check complete: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
