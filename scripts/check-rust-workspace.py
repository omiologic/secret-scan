#!/usr/bin/env python3
"""Enforce the Rust workspace policies declared in the root Cargo.toml.

Checks, in order:

1. Core dependency boundary: the core crate's transitive normal and build
   dependency graph contains only packages listed in
   ``[workspace.metadata.secret-scan] allowed-dependencies`` and never a
   package listed in ``forbidden-dependencies``.
2. Unsafe-code policy: every member inherits workspace lints, the workspace
   denies ``unsafe_code``, and the core and CLI crate roots forbid it.
3. Version lockstep: the workspace version, every member, ``package.json``,
   and ``bindings/node/package.json`` share one product version.
4. MSRV: the declared ``rust-version`` is inherited by every member, is at
   least the highest ``rust-version`` required by any resolved dependency, and
   matches the ``MSRV`` value exercised by the CI workflow.

Run ``--recheck-crate-name`` to also query crates.io for the preferred crate
name; that is the only check that uses the network and it is off by default.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tomllib
import urllib.error
import urllib.request
from pathlib import Path


CI_WORKFLOW = Path(".github") / "workflows" / "ci.yml"
CI_MSRV = re.compile(r"^\s*MSRV:\s*[\"']?(\d+\.\d+(?:\.\d+)?)[\"']?\s*$", re.M)
FORBID_UNSAFE = re.compile(r"^\s*#!\[forbid\(unsafe_code\)\]\s*$", re.M)
FORBID_UNSAFE_ROOTS = {"secret-scan": "src/lib.rs", "secret-scan-cli": "src/main.rs"}
LOCKSTEP_MANIFESTS = ("package.json", "bindings/node/package.json")
USER_AGENT = "secret-scan workspace check (https://github.com/omiologic/secret-scan)"


def version_key(version: str) -> tuple[int, int, int]:
    """Normalize ``1.88`` and ``1.88.0`` to the same comparable key."""
    parts = [int(part) for part in version.split(".")]
    while len(parts) < 3:
        parts.append(0)
    return parts[0], parts[1], parts[2]


def load_metadata(root: Path) -> dict:
    output = subprocess.run(
        ["cargo", "metadata", "--format-version", "1", "--locked"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(output)


def workspace_members(metadata: dict) -> dict[str, dict]:
    members = set(metadata["workspace_members"])
    return {package["id"]: package for package in metadata["packages"] if package["id"] in members}


def transitive_dependencies(metadata: dict, package_id: str, kinds: frozenset[str | None]) -> set[str]:
    """Return the package ids reachable from ``package_id`` through ``kinds``."""
    nodes = {node["id"]: node for node in metadata["resolve"]["nodes"]}
    seen: set[str] = set()
    pending = [package_id]
    while pending:
        current = pending.pop()
        for dep in nodes[current]["deps"]:
            if not any(kind["kind"] in kinds for kind in dep["dep_kinds"]):
                continue
            if dep["pkg"] not in seen:
                seen.add(dep["pkg"])
                pending.append(dep["pkg"])
    return seen


def check_core_boundary(metadata: dict, policy: dict) -> list[str]:
    errors: list[str] = []
    core_name = policy["core-package"]
    packages = {package["id"]: package for package in metadata["packages"]}
    core = next((p for p in workspace_members(metadata).values() if p["name"] == core_name), None)
    if core is None:
        return [f"core package {core_name} is not a workspace member"]

    allowed = set(policy.get("allowed-dependencies", []))
    forbidden = set(policy.get("forbidden-dependencies", []))
    for dep_id in sorted(transitive_dependencies(metadata, core["id"], frozenset({None, "build"}))):
        name = packages[dep_id]["name"]
        if name in forbidden:
            errors.append(f"{core_name}: forbidden dependency {name} is in the core dependency graph")
        elif name not in allowed:
            errors.append(f"{core_name}: dependency {name} is not in allowed-dependencies")
    return errors


def check_unsafe_policy(root: Path, metadata: dict, root_manifest: dict) -> list[str]:
    errors: list[str] = []
    lints = root_manifest.get("workspace", {}).get("lints", {}).get("rust", {})
    level = lints.get("unsafe_code")
    if isinstance(level, dict):
        level = level.get("level")
    if level not in {"deny", "forbid"}:
        errors.append("Cargo.toml: [workspace.lints.rust] must set unsafe_code to deny or forbid")

    for package in workspace_members(metadata).values():
        manifest_path = Path(package["manifest_path"]).resolve()
        with manifest_path.open("rb") as handle:
            manifest = tomllib.load(handle)
        if manifest.get("lints", {}).get("workspace") is not True:
            errors.append(f"{manifest_path.relative_to(root)}: must set [lints] workspace = true")
        source = FORBID_UNSAFE_ROOTS.get(package["name"])
        if source is None:
            continue
        source_path = manifest_path.parent / source
        if not source_path.is_file() or not FORBID_UNSAFE.search(source_path.read_text(encoding="utf-8")):
            errors.append(f"{source_path.relative_to(root)}: must contain #![forbid(unsafe_code)]")
    return errors


def check_version_lockstep(root: Path, metadata: dict, root_manifest: dict) -> list[str]:
    errors: list[str] = []
    version = root_manifest.get("workspace", {}).get("package", {}).get("version")
    if not version:
        return ["Cargo.toml: [workspace.package] must declare version"]
    for package in workspace_members(metadata).values():
        if package["version"] != version:
            errors.append(f"{package['name']}: version {package['version']} differs from workspace version {version}")
    for relative in LOCKSTEP_MANIFESTS:
        path = root / relative
        if not path.is_file():
            errors.append(f"{relative}: missing lockstep manifest")
            continue
        found = json.loads(path.read_text(encoding="utf-8")).get("version")
        if found != version:
            errors.append(f"{relative}: version {found} differs from workspace version {version}")
    return errors


def derived_msrv(metadata: dict) -> tuple[str | None, list[tuple[str, str, str]]]:
    """Return the highest dependency rust-version and the packages that set it."""
    members = set(metadata["workspace_members"])
    requirements = [
        (package["rust_version"], package["name"], package["version"])
        for package in metadata["packages"]
        if package["id"] not in members and package.get("rust_version")
    ]
    if not requirements:
        return None, []
    highest = max(version_key(requirement[0]) for requirement in requirements)
    culprits = sorted(
        (name, version, rust_version)
        for rust_version, name, version in requirements
        if version_key(rust_version) == highest
    )
    return culprits[0][2], culprits


def check_msrv(root: Path, metadata: dict, root_manifest: dict) -> list[str]:
    errors: list[str] = []
    declared = root_manifest.get("workspace", {}).get("package", {}).get("rust-version")
    if not declared:
        return ["Cargo.toml: [workspace.package] must declare rust-version"]
    for package in workspace_members(metadata).values():
        if package.get("rust_version") != declared:
            errors.append(f"{package['name']}: rust-version {package.get('rust_version')} differs from workspace MSRV {declared}")

    derived, culprits = derived_msrv(metadata)
    if derived is not None and version_key(derived) > version_key(declared):
        names = ", ".join(f"{name} {version}" for name, version, _ in culprits)
        errors.append(f"MSRV {declared} is below {derived} required by {names}")

    workflow = root / CI_WORKFLOW
    if not workflow.is_file():
        errors.append(f"{CI_WORKFLOW}: missing CI workflow")
    else:
        found = CI_MSRV.findall(workflow.read_text(encoding="utf-8"))
        if found != [declared]:
            errors.append(f"{CI_WORKFLOW}: expected exactly one MSRV: {declared}, found {found or 'none'}")
    return errors


def validate(root: Path, metadata: dict) -> list[str]:
    root = root.resolve()
    with (root / "Cargo.toml").open("rb") as handle:
        root_manifest = tomllib.load(handle)
    policy = metadata.get("metadata") or {}
    policy = policy.get("secret-scan")
    if not policy:
        return ["Cargo.toml: missing [workspace.metadata.secret-scan] policy"]
    errors: list[str] = []
    errors.extend(check_core_boundary(metadata, policy))
    errors.extend(check_unsafe_policy(root, metadata, root_manifest))
    errors.extend(check_version_lockstep(root, metadata, root_manifest))
    errors.extend(check_msrv(root, metadata, root_manifest))
    return errors


def crate_exists(name: str) -> bool:
    request = urllib.request.Request(
        f"https://crates.io/api/v1/crates/{name}", headers={"User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(request, timeout=30):
            return True
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return False
        raise


def recheck_crate_name(policy: dict) -> list[str]:
    """Report whether the preferred registry name is still free on crates.io."""
    name = policy["core-package"]
    # crates.io treats `-` and `_` as the same name.
    variants = sorted({name, name.replace("-", "_")})
    taken = [variant for variant in variants if crate_exists(variant)]
    if taken:
        return [f"crates.io: {', '.join(taken)} already exist; use the documented fallback name"]
    print(f"crates.io: {' and '.join(variants)} are available")
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("root", nargs="?", default=Path.cwd(), type=Path)
    parser.add_argument("--recheck-crate-name", action="store_true", help="query crates.io for the preferred crate name")
    args = parser.parse_args()

    metadata = load_metadata(args.root)
    errors = validate(args.root, metadata)
    derived, culprits = derived_msrv(metadata)
    if derived is not None:
        print(f"Derived MSRV {derived} from " + ", ".join(f"{name} {version}" for name, version, _ in culprits))
    if args.recheck_crate_name and not errors:
        errors.extend(recheck_crate_name(metadata["metadata"]["secret-scan"]))
    for error in errors:
        print(f"ERROR {error}")
    print(f"Rust workspace check complete: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
