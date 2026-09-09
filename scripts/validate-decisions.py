#!/usr/bin/env python3
"""Validate project-wide ADRs stored under docs/decisions."""

from __future__ import annotations

import re
import sys
from pathlib import Path


DECISION_ID = re.compile(r"^decision-[a-z0-9]+(?:-[a-z0-9]+)*$")
DECISION_HEADING = re.compile(r"(?im)^#{1,6}\s+Decision(?:\s*:.*)?\s*$")
LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
VALID_STATUSES = {"proposed", "accepted", "rejected", "superseded"}


def parse_frontmatter(path: Path) -> tuple[dict[str, str], str, list[str]]:
    errors: list[str] = []
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        return {}, text, [f"{path}: missing YAML frontmatter"]
    try:
        end = lines.index("---", 1)
    except ValueError:
        return {}, text, [f"{path}: missing YAML frontmatter closer"]

    fields: dict[str, str] = {}
    for number, line in enumerate(lines[1:end], 2):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = re.fullmatch(r"([a-z][a-z0-9_]*):\s*(.+)", line)
        if match is None:
            errors.append(f"{path}:{number}: unsupported frontmatter syntax")
            continue
        key, value = match.groups()
        if key in fields:
            errors.append(f"{path}:{number}: duplicate field {key}")
        fields[key] = value.strip().strip('"\'')
    return fields, "\n".join(lines[end + 1 :]), errors


def validate(root: Path) -> list[str]:
    root = root.resolve()
    decision_dir = root / "docs" / "decisions"
    legacy_workspace_dir = root / "_notes" / "decisions"
    errors: list[str] = []

    if legacy_workspace_dir.is_dir() and decision_dir.is_dir():
        errors.append(
            "multiple workspace decision locations exist; use docs/decisions only"
        )
    if not decision_dir.is_dir():
        return errors

    index = decision_dir / "DECISIONS.md"
    records = sorted(
        path for path in decision_dir.glob("*.md") if path.name != "DECISIONS.md"
    )
    if records and not index.is_file():
        errors.append(f"{index}: missing decision index")
        return errors

    identities: dict[str, Path] = {}
    for record in records:
        fields, body, record_errors = parse_frontmatter(record)
        errors.extend(record_errors)
        for required in ("decision_id", "status", "scope"):
            if required not in fields:
                errors.append(f"{record}: missing required field {required}")
        identity = fields.get("decision_id", "")
        if not DECISION_ID.fullmatch(identity):
            errors.append(f"{record}: invalid decision_id")
        elif identity in identities:
            errors.append(f"{record}: duplicate decision_id {identity}")
        else:
            identities[identity] = record
        status = fields.get("status")
        if status not in VALID_STATUSES:
            errors.append(f"{record}: invalid status")
        if fields.get("scope") != "workspace":
            errors.append(f"{record}: docs/decisions records must use workspace scope")
        if status == "accepted" and not DECISION_HEADING.search(body):
            errors.append(f"{record}: accepted decision requires a Decision heading")

    if not index.is_file():
        return errors
    resolved: list[Path] = []
    for target in LINK.findall(index.read_text(encoding="utf-8")):
        if re.match(r"^[a-z]+://", target) or target.startswith("#"):
            continue
        resolved_target = (index.parent / target.split("#", 1)[0]).resolve()
        resolved.append(resolved_target)
        if not resolved_target.exists():
            errors.append(f"{index}: broken decision link {target}")
        elif resolved_target.parent != decision_dir:
            errors.append(f"{index}: decision link leaves docs/decisions: {target}")

    for record in records:
        count = resolved.count(record.resolve())
        if count != 1:
            errors.append(f"{index}: {record.name} is indexed {count} times")
    return errors


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    errors = validate(root)
    for error in errors:
        print(f"ERROR {error}")
    print(f"Decision validation complete: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
