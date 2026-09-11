from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import unittest
import unittest.mock
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "record-artifact-inventory.py"
SPEC = importlib.util.spec_from_file_location("record_artifact_inventory", SCRIPT)
assert SPEC and SPEC.loader
RECORD = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = RECORD
SPEC.loader.exec_module(RECORD)

MATRIX = {
    "node-addon-targets": ["aarch64-apple-darwin", "x86_64-unknown-linux-musl"],
    "cli-release-targets": ["aarch64-apple-darwin", "x86_64-pc-windows-msvc"],
    "python-wheel-targets": ["aarch64-apple-darwin"],
}


class Artifacts:
    """Builds a downloaded-artifact tree that satisfies `require_matrix`, so
    each test can remove or add exactly one thing."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.files: dict[str, list[str]] = {
            "node-addon-aarch64-apple-darwin": [
                "redact-secret.darwin-arm64.node",
                "index.js",
            ],
            "node-addon-x86_64-unknown-linux-musl": [
                "redact-secret.linux-x64-musl.node",
                "index.js",
            ],
            "cli-aarch64-apple-darwin": ["redact-secret"],
            "cli-x86_64-pc-windows-msvc": ["redact-secret.exe"],
            "python-wheel-aarch64-apple-darwin": ["package-cp310-abi3-macosx.whl"],
            "python-sdist": ["package-0.1.0.tar.gz"],
            "wasm-web": ["redact_secret_wasm.js", "redact_secret_wasm_bg.wasm"],
        }

    def build(self) -> Path:
        for artifact, names in self.files.items():
            directory = self.root / artifact
            directory.mkdir(parents=True, exist_ok=True)
            for name in names:
                (directory / name).write_bytes(name.encode("utf-8"))
        return self.root


class InventoryTests(unittest.TestCase):
    def collect(self, configure=None) -> list[dict]:
        with tempfile.TemporaryDirectory() as directory:
            artifacts = Artifacts(Path(directory))
            if configure is not None:
                configure(artifacts)
            return RECORD.collect(artifacts.build())

    def errors(self, configure=None) -> list[str]:
        return RECORD.require_matrix(MATRIX, self.collect(configure))

    def test_a_complete_matrix_passes(self) -> None:
        self.assertEqual(self.errors(), [])

    def test_every_file_is_recorded_with_a_family_size_and_digest(self) -> None:
        collected = self.collect()
        entry = next(
            item for item in collected if item["file"] == "redact-secret.darwin-arm64.node"
        )
        self.assertEqual(entry["family"], "node-addon")
        self.assertEqual(entry["target"], "aarch64-apple-darwin")
        self.assertEqual(entry["bytes"], len(b"redact-secret.darwin-arm64.node"))
        self.assertEqual(len(entry["sha256"]), 64)

    def test_a_missing_addon_target_fails(self) -> None:
        def configure(artifacts: Artifacts) -> None:
            del artifacts.files["node-addon-x86_64-unknown-linux-musl"]

        self.assertEqual(
            self.errors(configure),
            ["node-addon: no artifact for x86_64-unknown-linux-musl"],
        )

    def test_a_missing_cli_target_fails(self) -> None:
        def configure(artifacts: Artifacts) -> None:
            del artifacts.files["cli-x86_64-pc-windows-msvc"]

        self.assertEqual(
            self.errors(configure), ["cli: no artifact for x86_64-pc-windows-msvc"]
        )

    def test_a_missing_wheel_fails(self) -> None:
        def configure(artifacts: Artifacts) -> None:
            del artifacts.files["python-wheel-aarch64-apple-darwin"]

        self.assertEqual(
            self.errors(configure), ["python-wheel: no artifact for aarch64-apple-darwin"]
        )

    def test_a_missing_sdist_fails(self) -> None:
        def configure(artifacts: Artifacts) -> None:
            del artifacts.files["python-sdist"]

        self.assertEqual(self.errors(configure), ["python-sdist: no artifact was produced"])

    def test_a_missing_browser_artifact_fails(self) -> None:
        def configure(artifacts: Artifacts) -> None:
            del artifacts.files["wasm-web"]

        self.assertEqual(self.errors(configure), ["browser: no artifact was produced"])

    def test_an_undeclared_target_fails(self) -> None:
        def configure(artifacts: Artifacts) -> None:
            artifacts.files["cli-aarch64-unknown-linux-gnu"] = ["redact-secret"]

        self.assertEqual(
            self.errors(configure),
            ["cli: built aarch64-unknown-linux-gnu, which Cargo.toml does not declare"],
        )

    def test_an_unrecognized_artifact_fails(self) -> None:
        def configure(artifacts: Artifacts) -> None:
            artifacts.files["something-else"] = ["file"]

        self.assertEqual(
            self.errors(configure), ["unrecognized artifact(s): something-else"]
        )

    def test_an_addon_without_a_compiled_library_fails(self) -> None:
        def configure(artifacts: Artifacts) -> None:
            artifacts.files["node-addon-aarch64-apple-darwin"] = ["index.js"]

        self.assertEqual(
            self.errors(configure),
            ["node-addon aarch64-apple-darwin: carries no compiled .node library"],
        )

    def test_a_cli_artifact_without_an_executable_fails(self) -> None:
        def configure(artifacts: Artifacts) -> None:
            artifacts.files["cli-aarch64-apple-darwin"] = ["README.md"]

        self.assertEqual(
            self.errors(configure),
            ["cli aarch64-apple-darwin: carries no executable"],
        )

    def test_the_source_commit_prefers_the_real_head_over_a_merge_ref(self) -> None:
        """On a pull request `GITHUB_SHA` is the synthesized merge commit,
        which no clone can resolve; `SOURCE_COMMIT` carries the head."""
        head, merge = "a" * 40, "b" * 40
        with unittest.mock.patch.dict(
            os.environ, {"SOURCE_COMMIT": head, "GITHUB_SHA": merge}, clear=False
        ):
            self.assertEqual(RECORD.source_commit(), head)
        with unittest.mock.patch.dict(
            os.environ, {"SOURCE_COMMIT": "", "GITHUB_SHA": merge}, clear=False
        ):
            self.assertEqual(RECORD.source_commit(), merge)

    def test_the_source_commit_falls_back_to_the_checked_out_head(self) -> None:
        with unittest.mock.patch.dict(
            os.environ, {"SOURCE_COMMIT": "", "GITHUB_SHA": ""}, clear=False
        ):
            commit = RECORD.source_commit()
        self.assertRegex(commit, r"^[0-9a-f]{40}$")

    def test_the_summary_records_the_commit_and_never_claims_publication(self) -> None:
        inventory = {
            "sourceCommit": "0" * 40,
            "productVersion": "0.1.0-beta.1",
            "artifacts": self.collect(),
            "packageContents": {"@redact-secret/core": ["dist/index.js"]},
        }
        summary = RECORD.render_summary(inventory)
        self.assertIn("0" * 40, summary)
        self.assertIn("Published: no", summary)
        self.assertIn("dist/index.js", summary)


if __name__ == "__main__":
    unittest.main()
