from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "check-sast-workflow.py"
SPEC = importlib.util.spec_from_file_location("check_sast_workflow", SCRIPT)
assert SPEC and SPEC.loader
CHECK = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CHECK
SPEC.loader.exec_module(CHECK)

REPO_ROOT = Path(__file__).resolve().parents[2]

GOOD_WORKFLOW = """\
name: SAST

on:
  pull_request:
  push:
    branches:
      - main

permissions: {}

jobs:
  opengrep:
    name: OpenGrep (pinned baseline)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      security-events: write

    steps:
      - name: Check out repository
        uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0

      - name: Run the pinned, provenance-verified OpenGrep scan
        id: scan
        continue-on-error: true
        run: python3 -B scripts/run-sast.py --out out.json --sarif-out out.sarif

      - name: Upload SARIF to code scanning
        if: always()
        continue-on-error: true
        uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
        with:
          sarif_file: out.sarif

      - name: Enforce scan result
        if: always()
        run: |
          if [ "${{ steps.scan.outcome }}" != "success" ]; then
            exit 1
          fi
"""


def write(tmp: Path, text: str) -> Path:
    workflows = tmp / ".github" / "workflows"
    workflows.mkdir(parents=True)
    path = workflows / "sast.yml"
    path.write_text(text, encoding="utf-8")
    return tmp


class SastWorkflowCheckTest(unittest.TestCase):
    def test_this_repository_satisfies_every_check(self) -> None:
        self.assertEqual(CHECK.validate(REPO_ROOT), [])

    def test_missing_workflow_fails(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            errors = CHECK.validate(Path(root))
            self.assertTrue(any("missing workflow" in error for error in errors))

    def test_well_formed_workflow_passes(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            root = write(Path(root_dir), GOOD_WORKFLOW)
            self.assertEqual(CHECK.validate(root), [])

    def test_missing_pull_request_trigger_fails(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            broken = GOOD_WORKFLOW.replace("  pull_request:\n", "")
            root = write(Path(root_dir), broken)
            errors = CHECK.validate(root)
            self.assertTrue(any("pull_request" in error for error in errors))

    def test_missing_timeout_minutes_fails(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            broken = GOOD_WORKFLOW.replace("    timeout-minutes: 20\n", "")
            root = write(Path(root_dir), broken)
            errors = CHECK.validate(root)
            self.assertTrue(any("timeout-minutes" in error for error in errors))

    def test_scan_step_without_continue_on_error_fails(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            broken = GOOD_WORKFLOW.replace("        continue-on-error: true\n        run: python3", "        run: python3")
            root = write(Path(root_dir), broken)
            errors = CHECK.validate(root)
            self.assertTrue(any("id: scan) must declare continue-on-error" in error for error in errors))

    def test_enforce_step_checking_conclusion_instead_of_outcome_fails(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            broken = GOOD_WORKFLOW.replace("steps.scan.outcome", "steps.scan.conclusion")
            root = write(Path(root_dir), broken)
            errors = CHECK.validate(root)
            self.assertTrue(any("checks steps.scan.conclusion" in error for error in errors))
            self.assertTrue(any("no step checks steps.scan.outcome" in error for error in errors))

    def test_sarif_upload_without_continue_on_error_fails(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            broken = GOOD_WORKFLOW.replace(
                "        if: always()\n        continue-on-error: true\n        uses: github/codeql-action",
                "        if: always()\n        uses: github/codeql-action",
            )
            root = write(Path(root_dir), broken)
            errors = CHECK.validate(root)
            self.assertTrue(
                any("uploads SARIF but lacks continue-on-error" in error for error in errors)
            )

    def test_sarif_upload_without_always_fails(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            broken = GOOD_WORKFLOW.replace(
                "      - name: Upload SARIF to code scanning\n        if: always()\n",
                "      - name: Upload SARIF to code scanning\n",
            )
            root = write(Path(root_dir), broken)
            errors = CHECK.validate(root)
            self.assertTrue(any("lacks if: always()" in error for error in errors))

    def test_missing_sarif_upload_step_fails(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            broken = GOOD_WORKFLOW.split("      - name: Upload SARIF to code scanning")[0] + (
                "      - name: Enforce scan result\n"
                "        if: always()\n"
                '        run: echo "${{ steps.scan.outcome }}"\n'
            )
            root = write(Path(root_dir), broken)
            errors = CHECK.validate(root)
            self.assertTrue(any("no step uploads SARIF" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
