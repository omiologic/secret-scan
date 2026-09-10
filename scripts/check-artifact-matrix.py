#!/usr/bin/env python3
"""Enforce the Node addon and CLI release matrices declared for issue #74.

In the style of ``check-python-package.py``'s ``check_wheel_matrix``: a
declared target list and the workflow that builds it must name exactly the
same targets, in both directions, so a target cannot be dropped from one
without a reviewed change to the other.

Checks, in order:

1. Node addon matrix: ``bindings/node/package.json``'s ``napi.targets`` and
   the ``node-addon`` job in ``.github/workflows/artifact-qualification.yml``
   build exactly the same targets.
2. CLI release matrix: ``Cargo.toml``'s ``[workspace.metadata.secret-scan]``
   ``cli-release-targets`` and the ``cli`` job in the same workflow build
   exactly the same targets.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from pathlib import Path

WORKFLOW = Path(".github") / "workflows" / "artifact-qualification.yml"
NODE_PACKAGE = Path("bindings") / "node" / "package.json"

# A named top-level job block: `  <job-name>:` through the line before the
# next top-level job (or end of file). Workflow jobs are two-space indented
# directly under `jobs:`; everything inside a job is indented at least three
# spaces (or blank), so the body stops exactly at the next two-space job
# header instead of swallowing it.
JOB_BLOCK = re.compile(r"^  (?P<name>[A-Za-z][\w-]*):\n(?P<body>(?:[ \t]{3,}.*\n|[ \t]*\n)*)", re.M)

# Every `target:` key inside a job's matrix.
MATRIX_TARGET = re.compile(r"^\s*(?:-\s+)?target:\s*(\S+)\s*$", re.M)


def load_policy(root: Path) -> dict:
    with (root / "Cargo.toml").open("rb") as handle:
        manifest = tomllib.load(handle)
    return manifest.get("workspace", {}).get("metadata", {}).get("secret-scan", {})


def job_targets(workflow_text: str, job_name: str) -> set[str] | None:
    """The targets built by ``job_name``, or ``None`` if the job is missing."""
    for match in JOB_BLOCK.finditer(workflow_text):
        if match.group("name") == job_name:
            return set(MATRIX_TARGET.findall(match.group("body")))
    return None


def check_matrix(
    *,
    declared_source: str,
    declared: list[str] | None,
    workflow_path: Path,
    workflow_text: str | None,
    job_name: str,
) -> list[str]:
    errors: list[str] = []
    if not declared:
        return [f"{declared_source}: must declare at least one target"]
    if workflow_text is None:
        return [f"{workflow_path.as_posix()}: missing workflow"]

    built = job_targets(workflow_text, job_name)
    if built is None:
        return [f"{workflow_path.as_posix()}: missing job {job_name!r}"]

    missing = sorted(set(declared) - built)
    extra = sorted(built - set(declared))
    if missing:
        errors.append(
            f"{workflow_path.as_posix()}: job {job_name!r} builds no target for "
            f"{', '.join(missing)}, declared by {declared_source}"
        )
    if extra:
        errors.append(
            f"{workflow_path.as_posix()}: job {job_name!r} builds {', '.join(extra)}, "
            f"which {declared_source} does not declare"
        )
    return errors


def validate(root: Path) -> list[str]:
    root = root.resolve()
    policy = load_policy(root)
    if not policy:
        return ["Cargo.toml: missing [workspace.metadata.secret-scan] policy"]

    workflow_path = root / WORKFLOW
    workflow_text = workflow_path.read_text(encoding="utf-8") if workflow_path.is_file() else None

    node_package_path = root / NODE_PACKAGE
    if not node_package_path.is_file():
        return [f"{NODE_PACKAGE.as_posix()}: missing"]
    node_package = json.loads(node_package_path.read_text(encoding="utf-8"))
    napi_targets = node_package.get("napi", {}).get("targets")

    errors: list[str] = []
    errors.extend(
        check_matrix(
            declared_source=f"{NODE_PACKAGE.as_posix()} napi.targets",
            declared=napi_targets,
            workflow_path=WORKFLOW,
            workflow_text=workflow_text,
            job_name="node-addon",
        )
    )
    errors.extend(
        check_matrix(
            declared_source="Cargo.toml cli-release-targets",
            declared=policy.get("cli-release-targets"),
            workflow_path=WORKFLOW,
            workflow_text=workflow_text,
            job_name="cli",
        )
    )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("root", nargs="?", default=Path.cwd(), type=Path)
    args = parser.parse_args()

    errors = validate(args.root)
    for error in errors:
        print(f"ERROR {error}")
    print(f"Artifact matrix check complete: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
