from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "validate-decisions.py"
SPEC = importlib.util.spec_from_file_location("validate_decisions", SCRIPT)
assert SPEC and SPEC.loader
VALIDATOR = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = VALIDATOR
SPEC.loader.exec_module(VALIDATOR)


def record(decision_id: str = "decision-use-rust") -> str:
    return f"""---
decision_id: {decision_id}
status: accepted
scope: workspace
---

# Use Rust

## Decision

Use a Rust core.
"""


class DecisionValidationTests(unittest.TestCase):
    def add_record(self, root: Path, name: str, content: str) -> None:
        decision_dir = root / "docs" / "decisions"
        decision_dir.mkdir(parents=True, exist_ok=True)
        (decision_dir / name).write_text(content, encoding="utf-8")
        index = decision_dir / "DECISIONS.md"
        existing = index.read_text(encoding="utf-8") if index.exists() else "# Decisions\n\n"
        index.write_text(existing + f"- [{name}]({name})\n", encoding="utf-8")

    def test_public_workspace_decision_is_valid(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.add_record(root, "2026-09-09-use-rust.md", record())
            self.assertEqual(VALIDATOR.validate(root), [])

    def test_multiple_workspace_locations_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.add_record(root, "2026-09-09-use-rust.md", record())
            (root / "_notes" / "decisions").mkdir(parents=True)
            self.assertTrue(any(
                "multiple workspace decision locations" in error
                for error in VALIDATOR.validate(root)
            ))

    def test_record_must_be_indexed_once(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.add_record(root, "2026-09-09-use-rust.md", record())
            index = root / "docs" / "decisions" / "DECISIONS.md"
            index.write_text("# Decisions\n", encoding="utf-8")
            self.assertTrue(any(
                "is indexed 0 times" in error for error in VALIDATOR.validate(root)
            ))


if __name__ == "__main__":
    unittest.main()
