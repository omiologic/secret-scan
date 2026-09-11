#!/usr/bin/env python3
"""Enforce RC-only publication, matching candidate identity, and final tag gates.

Every release-capable job rejects non-RC refs and validates rc/<version> against
its product or requested version before mutation. The tag job depends on all
publishers and clean registry-install verification. Uses dependency-free text
parsing, consistent with the other workflow policy checks.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

RELEASE_WORKFLOW = Path(".github") / "workflows" / "release.yml"
RELEASE_JOBS = ("publish", "publish-crates", "publish-pypi", "publish-native-dependencies", "publish-wasm-dependency", "tag-release")

RECONCILE_WORKFLOW = Path(".github") / "workflows" / "reconcile-release.yml"
RECONCILE_JOBS = ("reconcile", "tag-reconciled-release")

# A named top-level job block: `  <job-name>:` through the line before the
# next top-level job (or end of file). Workflow jobs are two-space indented
# directly under `jobs:`; everything inside a job is indented at least three
# spaces (or blank), so the body stops exactly at the next two-space job
# header instead of swallowing it.
JOB_BLOCK = re.compile(r"^  (?P<name>[A-Za-z][\w-]*):\n(?P<body>(?:[ \t]{3,}.*\n|[ \t]*\n)*)", re.M)

# Match the explicit GitHub expression wrapper: a leading ! is YAML syntax.
REF_GUARD = re.compile(r"if:\s*\$\{\{\s*!startsWith\(github\.ref, 'refs/heads/rc/'\)\s*\}\}")
CANDIDATE_CHECK = 'python3 -B scripts/check-release-refs.py --candidate-ref "$GITHUB_REF"'
VERSION = re.compile(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-beta\.(?:0|[1-9][0-9]*))?")
TAG_NEEDS = ("publish", "publish-crates", "publish-pypi", "verify-registry-install", "verify-registry-install-browser")


def validate_candidate_ref(ref: str, version: str) -> list[str]:
    if not VERSION.fullmatch(version) or ref != f"refs/heads/rc/{version}":
        return ["release requires the rc/<version> branch matching the stable or beta product version"]
    return []


def job_body(workflow_text: str, job_name: str) -> str | None:
    for match in JOB_BLOCK.finditer(workflow_text):
        if match.group("name") == job_name:
            return match.group("body")
    return None


def rejects_non_rc(job_text: str) -> bool:
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
        if not rejects_non_rc(body):
            errors.append(
                f"{workflow.as_posix()}: job {job_name!r} does not reject non-RC refs"
            )
        if CANDIDATE_CHECK not in body:
            errors.append(f"{workflow.as_posix()}: job {job_name!r} lacks candidate version validation")
    return errors


def validate(root: Path) -> list[str]:
    root = root.resolve()
    errors: list[str] = []
    errors += _check_workflow(root, RELEASE_WORKFLOW, RELEASE_JOBS)
    errors += _check_workflow(root, RECONCILE_WORKFLOW, RECONCILE_JOBS)
    release = root / RELEASE_WORKFLOW
    if release.is_file():
        text = release.read_text(encoding="utf-8")
        tag = job_body(text, "tag-release") or ""
        for dependency in TAG_NEEDS:
            if f"      - {dependency}\n" not in tag:
                errors.append(f"tag-release must depend on {dependency}")
        for match in JOB_BLOCK.finditer(text):
            if match.group("name") != "tag-release" and "/git/tags" in match.group("body"):
                errors.append("annotated tags must only be created by tag-release after registry installs")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("root", nargs="?", default=Path.cwd(), type=Path)
    parser.add_argument("--candidate-ref", help="validate a runtime publication ref")
    parser.add_argument("--version", help="requested reconcile version; defaults to the product manifest")
    args = parser.parse_args()

    if args.candidate_ref is not None:
        version = args.version
        if version is None:
            version = json.loads((args.root / "packages/javascript/package.json").read_text())["version"]
        errors = validate_candidate_ref(args.candidate_ref, version)
    else:
        errors = validate(args.root)
    for error in errors:
        print(f"ERROR {error}")
    print(f"Release ref-guard check complete: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
