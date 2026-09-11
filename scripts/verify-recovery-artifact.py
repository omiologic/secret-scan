#!/usr/bin/env python3
"""Verify original qualified artifacts before a partial release is resumed."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen


def verify_files(inventory: dict, artifact: str, directory: Path) -> None:
    expected = {item["file"]: item for item in inventory["artifacts"] if item["artifact"] == artifact}
    if not expected:
        raise ValueError("artifact is absent from the original qualification inventory")
    paths = [path for path in directory.rglob("*") if path.is_file()]
    if any(path.is_symlink() for path in directory.rglob("*")):
        raise ValueError("recovery artifact contains a symlink")
    actual = {path.relative_to(directory).as_posix(): path for path in paths}
    if set(actual) != set(expected):
        raise ValueError("recovery artifact file set differs from the qualified inventory")
    for name, path in actual.items():
        if path.stat().st_size != expected[name]["bytes"] or hashlib.sha256(path.read_bytes()).hexdigest() != expected[name]["sha256"]:
            raise ValueError("recovery artifact content differs from the qualified inventory")


def verify_pypi(inventory: dict, metadata: dict) -> None:
    expected = {item["file"]: item["sha256"] for item in inventory["artifacts"] if item["file"].endswith((".whl", ".tar.gz"))}
    actual = {item["filename"]: item["digests"]["sha256"] for item in metadata["urls"]}
    if not expected or actual != expected:
        raise ValueError("PyPI file set or content differs from the qualified inventory; do not skip or overwrite it")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", required=True, type=Path)
    parser.add_argument("--artifact")
    parser.add_argument("--directory", type=Path)
    parser.add_argument("--pypi")
    parser.add_argument("--version")
    args = parser.parse_args()
    inventory = json.loads(args.inventory.read_text())
    if args.pypi:
        # Registry host is fixed; project/version come from the approved source.
        request = Request(f"https://pypi.org/pypi/{args.pypi}/{args.version}/json",
                          headers={"User-Agent": "redact-secret-release-verification"})
        with urlopen(request, timeout=30) as response:
            verify_pypi(inventory, json.load(response))
    else:
        if not args.artifact or not args.directory:
            parser.error("--artifact and --directory are required for local artifacts")
        verify_files(inventory, args.artifact, args.directory)
    print("Original qualified artifact verified.")


if __name__ == "__main__":
    main()
