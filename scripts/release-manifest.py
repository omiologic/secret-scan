#!/usr/bin/env python3
"""Build the durable release manifest `release.yml` records for every run.

`decision-release-bindings-in-lockstep` and `ARCHITECTURE.md`'s "Versioning,
qualification, and release" section both require the release process to
record a manifest carrying the source commit, conformance revision, product
version, required artifacts, and the observed publication state of each
registry -- so a partial publication is visible and repairable instead of
assumed atomic. `.github/workflows/release.yml` calls this script as its last
step, with `if: always()`, so the manifest is emitted even when an earlier
step in the same run failed; the workflow then uploads the result as a
`release-manifest-<version>` artifact. `reconcile-release.yml` downloads that
artifact and hands it to `reconcile-guard.py`.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

FIELDS = (
    "source_revision",
    "conformance_identity",
    "version",
    "artifact_set",
    "registry_state",
)


def build_manifest(
    *,
    source_revision: str,
    conformance_identity: str,
    version: str,
    artifact_set: list[str],
    registry_state: dict[str, str],
) -> dict:
    """Assemble the five-field release manifest.

    Raises ValueError when any field is empty, so a run that could not
    determine one of them fails loudly instead of recording a manifest that
    looks complete but is missing what reconcile would need.
    """
    manifest = {
        "source_revision": source_revision,
        "conformance_identity": conformance_identity,
        "version": version,
        "artifact_set": sorted(artifact_set),
        "registry_state": dict(sorted(registry_state.items())),
    }
    missing = [field for field in FIELDS if not manifest[field]]
    if missing:
        raise ValueError(f"release manifest is missing required field(s): {', '.join(missing)}")
    return manifest


def _parse_registry_state(pairs: list[str]) -> dict[str, str]:
    state: dict[str, str] = {}
    for pair in pairs:
        name, sep, value = pair.partition("=")
        if not sep or not name or not value:
            raise ValueError(f"--registry-state expects name=state, got {pair!r}")
        state[name] = value
    return state


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source-revision", required=True)
    parser.add_argument("--conformance-identity", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument(
        "--artifact",
        dest="artifacts",
        action="append",
        default=[],
        help="repeatable: an artifact this release qualifies, e.g. npm:@redact-secret/core",
    )
    parser.add_argument(
        "--registry-state",
        dest="registry_states",
        action="append",
        default=[],
        help="repeatable: registry=state, e.g. npm=published",
    )
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)

    try:
        manifest = build_manifest(
            source_revision=args.source_revision,
            conformance_identity=args.conformance_identity,
            version=args.version,
            artifact_set=args.artifacts,
            registry_state=_parse_registry_state(args.registry_states),
        )
    except ValueError as error:
        print(f"ERROR {error}", file=sys.stderr)
        return 1

    args.out.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Recorded release manifest for {manifest['version']} at {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
