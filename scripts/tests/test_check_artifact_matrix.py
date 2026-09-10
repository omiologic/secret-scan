from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "check-artifact-matrix.py"
SPEC = importlib.util.spec_from_file_location("check_artifact_matrix", SCRIPT)
assert SPEC and SPEC.loader
CHECK = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CHECK
SPEC.loader.exec_module(CHECK)

NAPI_TARGETS = ["aarch64-apple-darwin", "x86_64-unknown-linux-gnu"]
CLI_TARGETS = ["aarch64-apple-darwin", "x86_64-unknown-linux-gnu"]


def workflow_text(node_targets: list[str], cli_targets: list[str]) -> str:
    def job(name: str, targets: list[str]) -> str:
        matrix = "".join(f"          - target: {target}\n" for target in targets)
        return (
            f"  {name}:\n"
            "    strategy:\n"
            "      matrix:\n"
            "        include:\n"
            f"{matrix}"
            "    steps:\n"
            "      - run: build\n"
        )

    return "name: Artifact qualification\njobs:\n" + job("node-addon", node_targets) + job("cli", cli_targets)


class Repository:
    """Builds a minimal repository that satisfies both checks."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.napi_targets = list(NAPI_TARGETS)
        self.cli_targets = list(CLI_TARGETS)
        self.workflow_node_targets = list(NAPI_TARGETS)
        self.workflow_cli_targets = list(CLI_TARGETS)
        self.workflow_present = True

    def write(self, relative: str, content: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def build(self) -> Path:
        cli_targets_toml = json.dumps(self.cli_targets)
        self.write(
            "Cargo.toml",
            "[workspace]\n[workspace.metadata.secret-scan]\n"
            'product-name = "secret-scan"\n'
            f"cli-release-targets = {cli_targets_toml}\n",
        )
        self.write(
            "bindings/node/package.json",
            json.dumps({"name": "@omiologic/secret-scan-node", "napi": {"targets": self.napi_targets}}),
        )
        if self.workflow_present:
            self.write(
                ".github/workflows/artifact-qualification.yml",
                workflow_text(self.workflow_node_targets, self.workflow_cli_targets),
            )
        return self.root


class ValidateTests(unittest.TestCase):
    def run_validate(self, mutate=lambda repo: None) -> list[str]:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Repository(Path(tmp))
            mutate(repo)
            repo.build()
            return CHECK.validate(repo.root)

    def test_matching_matrices_pass(self) -> None:
        self.assertEqual(self.run_validate(), [])

    def test_node_addon_job_missing_a_declared_target_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.workflow_node_targets = [NAPI_TARGETS[0]]

        errors = self.run_validate(mutate)
        self.assertTrue(any("node-addon" in error and NAPI_TARGETS[1] in error for error in errors))

    def test_node_addon_job_building_an_undeclared_target_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.workflow_node_targets = [*NAPI_TARGETS, "x86_64-unknown-linux-musl"]

        errors = self.run_validate(mutate)
        self.assertTrue(any("node-addon" in error and "musl" in error for error in errors))

    def test_cli_job_missing_a_declared_target_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.workflow_cli_targets = [CLI_TARGETS[0]]

        errors = self.run_validate(mutate)
        self.assertTrue(any("cli" in error and CLI_TARGETS[1] in error for error in errors))

    def test_cli_job_building_an_undeclared_target_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.workflow_cli_targets = [*CLI_TARGETS, "aarch64-unknown-linux-gnu"]

        errors = self.run_validate(mutate)
        self.assertTrue(any("cli" in error and "aarch64-unknown-linux-gnu" in error for error in errors))

    def test_empty_declared_targets_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.napi_targets = []

        errors = self.run_validate(mutate)
        self.assertTrue(any("napi.targets" in error for error in errors))

    def test_missing_workflow_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.workflow_present = False

        errors = self.run_validate(mutate)
        self.assertTrue(any("missing workflow" in error for error in errors))

    def test_missing_policy_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "Cargo.toml").write_text("[workspace]\n", encoding="utf-8")
            errors = CHECK.validate(root)
        self.assertEqual(errors, ["Cargo.toml: missing [workspace.metadata.secret-scan] policy"])


if __name__ == "__main__":
    unittest.main()
