#!/usr/bin/env python3
"""Enforce the cross-platform qualification matrix declared in Cargo.toml.

``[workspace.metadata.secret-scan]`` states, once, every platform and engine
the product is qualified on. This script fails when any of the places that
have to agree with it drifts, so a supported platform cannot be added or
dropped in one file alone.

Checks, in order:

1. Node addon targets: ``node-addon-targets`` equals ``napi.targets`` in
   ``bindings/node/package.json``, equals the ``addon-target`` matrix in the
   qualification workflow, and every target maps to a platform file name
   ``scripts/qualify-node-addon.mjs`` knows how to verify.
2. CLI targets: ``cli-release-targets`` equals the ``cli-target`` matrix in
   the qualification workflow and the target list in
   ``scripts/qualify-cli-binary.mjs``.
3. Browser engines: ``browser-engines`` equals the ``engine`` matrix in the
   qualification workflow and the engine list in
   ``scripts/qualify-browser-artifact.mjs``.
4. Node.js support: ``node-support-majors`` equals the ``node-version``
   matrix in ``ci.yml`` and the majors the qualification workflow smoke-tests
   the addon on, and every manifest declaring ``engines.node`` claims exactly
   ``>={lowest major}``. A claim CI does not exercise is a claim that drifts.
5. Least privilege: every workflow declares a top-level ``permissions`` and
   every job declares its own, and no job takes a write scope outside the
   recorded allowlist.
6. Pinning: every ``uses:`` reference to an action outside this repository is
   pinned to a full 40-character commit SHA. A moving tag is a supply-chain
   dependency on whoever can move it.

    python3 -B scripts/check-qualification-matrix.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from pathlib import Path

WORKFLOWS = Path(".github") / "workflows"
QUALIFICATION = WORKFLOWS / "qualification.yml"
CI = WORKFLOWS / "ci.yml"
ADDON_MANIFEST = Path("bindings") / "node" / "package.json"
ADDON_QUALIFIER = Path("scripts") / "qualify-node-addon.mjs"
CLI_QUALIFIER = Path("scripts") / "qualify-cli-binary.mjs"
BROWSER_QUALIFIER = Path("scripts") / "qualify-browser-artifact.mjs"

# Manifests that declare `engines.node`, all of which must claim the same
# range the Node matrix exercises.
ENGINE_MANIFESTS = (
    Path("package.json"),
    Path("packages") / "javascript" / "package.json",
    ADDON_MANIFEST,
)

# The only write scopes any job in this repository is allowed to take, and
# the job that may take each. `Release` needs `contents: write` to create the
# annotated tag its own workflow documents.
WRITE_SCOPE_ALLOWLIST = {
    (Path("release.yml").name, "publish", "contents"),
    (Path("reconcile-release.yml").name, "reconcile", "contents"),
}

# A matrix key either carries its value inline, as `- addon-target: <triple>`
# in an `include:` entry, or introduces a block sequence of bare values.
MATRIX_INLINE = "^[ \t]*(?:-[ \t]+)?{key}:[ \t]*(\\S+)[ \t]*$"
MATRIX_BLOCK = "^[ \t]*{key}:[ \t]*(?:#.*)?$((?:\n[ \t]*(?:#.*)?$|\n[ \t]*-[ \t]*\\S+[ \t]*$)*)"
MATRIX_ITEM = re.compile(r"^[ \t]*-[ \t]*(\S+)[ \t]*$", re.M)
# A `uses:` value: either a local path (`./.github/...`) or `owner/repo@ref`.
USES = re.compile(r"^\s*(?:-\s+)?uses:\s*(\S+)\s*$", re.M)
PINNED = re.compile(r"^[^@\s]+@[0-9a-f]{40}$")
TOP_LEVEL_PERMISSIONS = re.compile(r"^permissions:(?P<inline>[^\n]*)$", re.M)
JOB = re.compile(r"^  (?P<name>[A-Za-z0-9_-]+):\s*$", re.M)
JOB_PERMISSION = re.compile(r"^\s{6}(?P<scope>[a-z-]+):\s*(?P<level>\S+)\s*$", re.M)


def matrix_values(text: str, key: str) -> list[str]:
    """Every value of a matrix key, in the order the workflow lists them,
    whether the key carries its value inline or introduces a sequence."""
    quoted = re.escape(key)
    values = re.findall(MATRIX_INLINE.format(key=quoted), text, re.M)
    for block in re.findall(MATRIX_BLOCK.format(key=quoted), text, re.M):
        values.extend(MATRIX_ITEM.findall(block))
    return values


def read_text(root: Path, path: Path) -> str | None:
    resolved = root / path
    return resolved.read_text(encoding="utf-8") if resolved.is_file() else None


def read_json(root: Path, path: Path) -> dict | None:
    text = read_text(root, path)
    return json.loads(text) if text is not None else None


def load_policy(root: Path) -> dict:
    with (root / "Cargo.toml").open("rb") as handle:
        manifest = tomllib.load(handle)
    return manifest.get("workspace", {}).get("metadata", {}).get("secret-scan", {})


def compare(label: str, declared: list[str], found: list[str], where: str) -> list[str]:
    """Both directions, so neither side can quietly gain or lose an entry."""
    errors = []
    missing = sorted(set(declared) - set(found))
    extra = sorted(set(found) - set(declared))
    if missing:
        errors.append(f"{where}: {label} omits {', '.join(missing)}")
    if extra:
        errors.append(
            f"{where}: {label} names {', '.join(extra)}, which Cargo.toml does not declare"
        )
    return errors


def check_addon_targets(root: Path, policy: dict, workflow: str) -> list[str]:
    declared = policy.get("node-addon-targets") or []
    if not declared:
        return ["Cargo.toml: node-addon-targets must declare the addon matrix"]

    errors: list[str] = []
    manifest = read_json(root, ADDON_MANIFEST)
    if manifest is None:
        errors.append(f"{ADDON_MANIFEST.as_posix()}: missing")
    else:
        errors.extend(
            compare(
                "napi.targets",
                declared,
                manifest.get("napi", {}).get("targets", []),
                ADDON_MANIFEST.as_posix(),
            )
        )

    errors.extend(
        compare(
            "the addon-target matrix",
            declared,
            matrix_values(workflow, "addon-target"),
            QUALIFICATION.as_posix(),
        )
    )

    qualifier = read_text(root, ADDON_QUALIFIER)
    if qualifier is None:
        errors.append(f"{ADDON_QUALIFIER.as_posix()}: missing")
    else:
        known = re.findall(r'^\s*"([a-z0-9_]+-[a-z0-9-]+)":\s*"', qualifier, re.M)
        for target in sorted(set(declared) - set(known)):
            errors.append(
                f"{ADDON_QUALIFIER.as_posix()}: no platform file name for {target}"
            )
    return errors


def check_cli_targets(root: Path, policy: dict, workflow: str) -> list[str]:
    declared = policy.get("cli-release-targets") or []
    if not declared:
        return ["Cargo.toml: cli-release-targets must declare the CLI matrix"]

    errors = compare(
        "the cli-target matrix",
        declared,
        matrix_values(workflow, "cli-target"),
        QUALIFICATION.as_posix(),
    )
    qualifier = read_text(root, CLI_QUALIFIER)
    if qualifier is None:
        errors.append(f"{CLI_QUALIFIER.as_posix()}: missing")
    else:
        known = re.findall(r'^\s*"([a-z0-9_]+-[a-z0-9-]+)":\s*"', qualifier, re.M)
        errors.extend(
            compare("its target list", declared, known, CLI_QUALIFIER.as_posix())
        )
    return errors


def check_browser_engines(root: Path, policy: dict, workflow: str) -> list[str]:
    declared = policy.get("browser-engines") or []
    if not declared:
        return ["Cargo.toml: browser-engines must declare the browser matrix"]

    errors = compare(
        "the engine matrix",
        declared,
        matrix_values(workflow, "engine"),
        QUALIFICATION.as_posix(),
    )
    qualifier = read_text(root, BROWSER_QUALIFIER)
    if qualifier is None:
        errors.append(f"{BROWSER_QUALIFIER.as_posix()}: missing")
    else:
        match = re.search(r"const ENGINES = \[(.*?)\];", qualifier, re.S)
        known = re.findall(r'"([a-z]+)"', match.group(1)) if match else []
        errors.extend(
            compare("ENGINES", declared, known, BROWSER_QUALIFIER.as_posix())
        )
    return errors


def check_node_support(root: Path, policy: dict, workflow: str) -> list[str]:
    declared = policy.get("node-support-majors") or []
    if not declared:
        return ["Cargo.toml: node-support-majors must declare the supported majors"]
    declared_strings = [str(major) for major in declared]

    errors: list[str] = []
    ci = read_text(root, CI)
    if ci is None:
        errors.append(f"{CI.as_posix()}: missing")
    else:
        errors.extend(
            compare(
                "the node-version matrix",
                declared_strings,
                matrix_values(ci, "node-version"),
                CI.as_posix(),
            )
        )

    # Every major the addon is smoke-tested on, from the per-major steps on a
    # host runner and from the musl loop that mirrors them.
    smoked = re.findall(r"^\s*- name: Qualify the addon on Node (\d+)\s*$", workflow, re.M)
    musl = re.search(r"^\s*for major in ([\d ]+); do\s*$", workflow, re.M)
    errors.extend(
        compare(
            "the addon smoke-test majors",
            declared_strings,
            smoked,
            QUALIFICATION.as_posix(),
        )
    )
    errors.extend(
        compare(
            "the musl smoke-test majors",
            declared_strings,
            musl.group(1).split() if musl else [],
            QUALIFICATION.as_posix(),
        )
    )

    expected = f">={min(declared)}"
    for path in ENGINE_MANIFESTS:
        manifest = read_json(root, path)
        if manifest is None:
            errors.append(f"{path.as_posix()}: missing")
            continue
        claimed = manifest.get("engines", {}).get("node")
        if claimed is None:
            errors.append(f"{path.as_posix()}: declares no engines.node")
        elif claimed != expected:
            errors.append(
                f"{path.as_posix()}: engines.node is {claimed!r}, but the matrix "
                f"exercises {expected!r}"
            )
    return errors


def jobs(text: str) -> list[tuple[str, str]]:
    """Each job's name and its body, split on two-space-indented keys under
    the single top-level `jobs:` mapping."""
    start = text.find("\njobs:\n")
    if start == -1:
        return []
    body = text[start + len("\njobs:\n") :]
    matches = list(JOB.finditer(body))
    return [
        (
            match.group("name"),
            body[match.end() : matches[index + 1].start() if index + 1 < len(matches) else len(body)],
        )
        for index, match in enumerate(matches)
    ]


def check_workflow_hygiene(root: Path) -> list[str]:
    errors: list[str] = []
    directory = root / WORKFLOWS
    if not directory.is_dir():
        return [f"{WORKFLOWS.as_posix()}: missing"]

    for path in sorted(directory.glob("*.yml")):
        name = path.name
        text = path.read_text(encoding="utf-8")
        relative = (WORKFLOWS / name).as_posix()

        top_level = TOP_LEVEL_PERMISSIONS.search(text)
        if top_level is None:
            errors.append(f"{relative}: declares no top-level permissions")
        elif top_level.group("inline").strip() == "write-all":
            errors.append(f"{relative}: grants write-all at the top level")

        for job_name, body in jobs(text):
            declaration = re.search(
                r"^    permissions:(?P<inline>[^\n]*)$(?P<scopes>(?:\n\s{6}\S.*)*)",
                body,
                re.M,
            )
            # A job that only calls a reusable workflow may also inherit the
            # caller's permissions, but this repository always states them.
            if declaration is None:
                errors.append(f"{relative}: job {job_name!r} declares no permissions")
                continue
            inline = declaration.group("inline").strip()
            if inline in ("write-all", "read-all") or inline.startswith("$"):
                errors.append(
                    f"{relative}: job {job_name!r} declares permissions as {inline!r}; "
                    "state each scope it needs instead"
                )
                continue
            for scope, level in JOB_PERMISSION.findall(declaration.group("scopes")):
                if level != "write":
                    continue
                if (name, job_name, scope) not in WRITE_SCOPE_ALLOWLIST:
                    errors.append(
                        f"{relative}: job {job_name!r} takes {scope}: write, "
                        "which the least-privilege allowlist does not permit"
                    )

        for reference in USES.findall(text):
            if reference.startswith("./"):
                continue
            if not PINNED.match(reference):
                errors.append(
                    f"{relative}: uses {reference}, which is not pinned to a commit SHA"
                )
    return errors


def validate(root: Path) -> list[str]:
    root = root.resolve()
    policy = load_policy(root)
    if not policy:
        return ["Cargo.toml: missing [workspace.metadata.secret-scan] policy"]

    workflow = read_text(root, QUALIFICATION)
    if workflow is None:
        return [f"{QUALIFICATION.as_posix()}: missing qualification workflow"]

    errors: list[str] = []
    errors.extend(check_addon_targets(root, policy, workflow))
    errors.extend(check_cli_targets(root, policy, workflow))
    errors.extend(check_browser_engines(root, policy, workflow))
    errors.extend(check_node_support(root, policy, workflow))
    errors.extend(check_workflow_hygiene(root))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parents[1]
    )
    arguments = parser.parse_args()

    errors = validate(arguments.root)
    for error in errors:
        print(f"error: {error}", file=sys.stderr)
    print(f"{len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
