#!/usr/bin/env python3
"""Record the artifact inventory a qualification run produced.

The last job of ``.github/workflows/artifact-qualification.yml``: it proves the whole
declared matrix was actually built from one revision, and writes down what
was built. Publication is not part of it and never happens here
(``decision-release-bindings-in-lockstep``).

Three things are recorded, all tied to one source commit:

1. **Every artifact** the run produced - family, target, file name, size, and
   SHA-256 - required to cover ``node-addon-targets``,
   ``cli-release-targets``, and ``python-wheel-targets`` exactly, plus the
   source distribution and the browser artifact. A missing or unexpected
   artifact fails the run.
2. **The contents of every package a release would publish** - the npm
   package and the public Rust crate, each listed file by file, so "inspect
   all package contents" is a recorded fact rather than a claim.
3. **The conformance corpus identity** - the SHA-256 of each canonical
   fixture file, because the artifact set only means something alongside the
   behavioral contract it was qualified against
   (``decision-govern-cross-language-conformance``).

    python3 -B scripts/record-artifact-inventory.py \\
        --artifacts qualification-artifacts --out artifact-inventory.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "conformance" / "fixtures"

NPM_PACKAGE = Path("packages") / "javascript"
CRATE = "redact-secret"


def declared_matrix() -> dict:
    with (ROOT / "Cargo.toml").open("rb") as handle:
        manifest = tomllib.load(handle)
    return manifest["workspace"]["metadata"]["redact-secret"]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_commit() -> str:
    """The revision every artifact in this run was built from.

    ``GITHUB_SHA`` is not that revision on a ``pull_request`` event: it names
    the ephemeral ``refs/pull/N/merge`` commit GitHub synthesizes, which no
    clone of this repository can resolve. The workflow therefore passes the
    real head commit as ``SOURCE_COMMIT``, and an inventory that recorded an
    unresolvable id would defeat its own purpose
    (``decision-release-bindings-in-lockstep``).
    """
    for name in ("SOURCE_COMMIT", "GITHUB_SHA"):
        commit = os.environ.get(name, "").strip()
        if commit:
            return commit
    return subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def collect(artifacts: Path) -> list[dict]:
    """One entry per file, with the artifact directory naming its family and
    target the way the workflow uploaded it."""
    collected: list[dict] = []
    for directory in sorted(p for p in artifacts.iterdir() if p.is_dir()):
        name = directory.name
        if name.startswith("node-addon-"):
            family, target = "node-addon", name.removeprefix("node-addon-")
        elif name.startswith("cli-"):
            family, target = "cli", name.removeprefix("cli-")
        elif name.startswith("python-wheel-"):
            family, target = "python-wheel", name.removeprefix("python-wheel-")
        elif name == "python-sdist":
            family, target = "python-sdist", None
        elif name == "wasm-web":
            family, target = "browser", None
        else:
            family, target = "unknown", None
        for path in sorted(p for p in directory.rglob("*") if p.is_file()):
            collected.append(
                {
                    "family": family,
                    "target": target,
                    "artifact": name,
                    "file": path.relative_to(directory).as_posix(),
                    "bytes": path.stat().st_size,
                    "sha256": digest(path),
                }
            )
    return collected


def require_matrix(matrix: dict, collected: list[dict]) -> list[str]:
    errors: list[str] = []
    families = {
        "node-addon": set(matrix["node-addon-targets"]),
        "cli": set(matrix["cli-release-targets"]),
        "python-wheel": set(matrix["python-wheel-targets"]),
    }
    for family, declared in families.items():
        built = {entry["target"] for entry in collected if entry["family"] == family}
        for missing in sorted(declared - built):
            errors.append(f"{family}: no artifact for {missing}")
        for extra in sorted(built - declared):
            errors.append(f"{family}: built {extra}, which Cargo.toml does not declare")

    for family in ("python-sdist", "browser"):
        if not any(entry["family"] == family for entry in collected):
            errors.append(f"{family}: no artifact was produced")

    unknown = sorted({entry["artifact"] for entry in collected if entry["family"] == "unknown"})
    if unknown:
        errors.append(f"unrecognized artifact(s): {', '.join(unknown)}")

    # An addon that is only a loader with no compiled library is not an
    # artifact; the same for a CLI directory with no executable.
    for family, predicate, description in (
        ("node-addon", lambda f: f.endswith(".node"), "compiled .node library"),
        ("cli", lambda f: f in ("redact-secret", "redact-secret.exe"), "executable"),
    ):
        for target in sorted(families[family]):
            files = [
                entry["file"]
                for entry in collected
                if entry["family"] == family and entry["target"] == target
            ]
            # A target with no artifact at all is already reported above.
            if files and not any(predicate(name) for name in files):
                errors.append(f"{family} {target}: carries no {description}")
    return errors


def npm_package_contents() -> list[str]:
    """Packs `packages/javascript` itself, the way `packages/javascript/test/
    package-contents.test.ts` does: `LICENSE` is a tracked file there, so
    nothing needs to be staged in from elsewhere."""
    result = subprocess.run(
        ["npm", "pack", "--dry-run", "--json", str(ROOT / NPM_PACKAGE)],
        check=True,
        capture_output=True,
        text=True,
        shell=os.name == "nt",
    )
    return sorted(entry["path"] for entry in json.loads(result.stdout)[0]["files"])


def crate_contents() -> list[str]:
    # `--allow-dirty` only affects the refusal to list an uncommitted tree;
    # the listing itself is still the exact file set the crate would carry,
    # and a qualification run is always on a committed revision anyway.
    result = subprocess.run(
        ["cargo", "package", "--list", "--locked", "--allow-dirty", "-p", CRATE],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(line for line in result.stdout.splitlines() if line)


def corpus_identity() -> dict[str, str]:
    return {
        path.name: digest(path)
        for path in sorted(FIXTURES.glob("*.json"))
    }


def render_summary(inventory: dict) -> str:
    lines = [
        "## Qualification matrix",
        "",
        f"- Source commit: `{inventory['sourceCommit']}`",
        f"- Product version: `{inventory['productVersion']}`",
        f"- Artifacts: {len(inventory['artifacts'])} file(s)",
        "- Published: no",
        "",
        "| Family | Target | File | Bytes | SHA-256 |",
        "| --- | --- | --- | ---: | --- |",
    ]
    for entry in inventory["artifacts"]:
        lines.append(
            f"| {entry['family']} | {entry['target'] or '-'} | `{entry['file']}` | "
            f"{entry['bytes']} | `{entry['sha256'][:16]}…` |"
        )
    lines.append("")
    for package, files in inventory["packageContents"].items():
        lines.append(f"<details><summary>{package} — {len(files)} file(s)</summary>")
        lines.append("")
        lines.extend(f"- `{name}`" for name in files)
        lines.append("")
        lines.append("</details>")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--artifacts", type=Path, required=True, help="directory of downloaded artifacts"
    )
    parser.add_argument("--out", type=Path, required=True, help="inventory JSON to write")
    parser.add_argument("--summary", type=Path, help="markdown summary to append to")
    arguments = parser.parse_args()

    if not arguments.artifacts.is_dir():
        print(f"{arguments.artifacts}: missing", file=sys.stderr)
        return 1

    matrix = declared_matrix()
    collected = collect(arguments.artifacts)
    errors = require_matrix(matrix, collected)

    with (ROOT / NPM_PACKAGE / "package.json").open(encoding="utf-8") as handle:
        product_version = json.load(handle)["version"]

    inventory = {
        "sourceCommit": source_commit(),
        "sourceRef": os.environ.get("GITHUB_REF", ""),
        "workflowRun": os.environ.get("GITHUB_RUN_ID", ""),
        "workflowRunAttempt": os.environ.get("GITHUB_RUN_ATTEMPT", ""),
        "productVersion": product_version,
        "published": False,
        "conformanceFixtures": corpus_identity(),
        "declaredMatrix": {
            "nodeAddonTargets": matrix["node-addon-targets"],
            "nodePublishTargets": matrix["node-publish-targets"],
            "cliReleaseTargets": matrix["cli-release-targets"],
            "pythonWheelTargets": matrix["python-wheel-targets"],
            "browserEngines": matrix["browser-engines"],
            "nodeSupportMajors": matrix["node-support-majors"],
        },
        "packageContents": {
            "@redact-secret/core": npm_package_contents(),
            f"{CRATE} (crate)": crate_contents(),
        },
        "artifacts": collected,
    }

    arguments.out.write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {arguments.out} ({len(collected)} artifact file(s))")

    if arguments.summary is not None:
        with arguments.summary.open("a", encoding="utf-8") as handle:
            handle.write(render_summary(inventory) + "\n")

    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        print(f"\n{len(errors)} error(s); the declared matrix is incomplete", file=sys.stderr)
        return 1
    print("every declared artifact is present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
