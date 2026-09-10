from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "check-release-refs.py"
SPEC = importlib.util.spec_from_file_location("check_release_refs", SCRIPT)
assert SPEC and SPEC.loader
CHECK = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CHECK
SPEC.loader.exec_module(CHECK)

GUARD_STEP = (
    "      - name: Require the default branch\n"
    "        if: github.ref != 'refs/heads/main'\n"
    "        run: exit 1\n"
)


UNGUARDED_STEP = "      - run: publish\n"


def release_workflow(jobs: dict[str, bool]) -> str:
    """`jobs` maps job id -> whether it includes the ref guard."""
    body = "name: Release\njobs:\n"
    for job_name, guarded in jobs.items():
        body += (
            f"  {job_name}:\n"
            "    runs-on: ubuntu-latest\n"
            "    steps:\n"
            + (GUARD_STEP if guarded else UNGUARDED_STEP)
        )
    return body


def reconcile_workflow(*, guarded: bool = True, present: bool = True) -> str:
    if not present:
        return "name: Reconcile Release\njobs:\n  other:\n    runs-on: ubuntu-latest\n    steps:\n      - run: noop\n"
    return (
        "name: Reconcile Release\njobs:\n"
        "  reconcile:\n"
        "    runs-on: ubuntu-latest\n"
        "    steps:\n"
        + (GUARD_STEP if guarded else "      - run: reconcile\n")
    )


class Repository:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.release_jobs = {"publish": True, "publish-crates": True, "publish-pypi": True}
        self.reconcile_guarded = True
        self.release_present = True
        self.reconcile_present = True

    def write(self, relative: str, content: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def build(self) -> Path:
        if self.release_present:
            self.write(".github/workflows/release.yml", release_workflow(self.release_jobs))
        self.write(
            ".github/workflows/reconcile-release.yml",
            reconcile_workflow(guarded=self.reconcile_guarded, present=self.reconcile_present),
        )
        return self.root


class ValidateTests(unittest.TestCase):
    def run_validate(self, mutate=lambda repo: None) -> list[str]:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Repository(Path(tmp))
            mutate(repo)
            repo.build()
            return CHECK.validate(repo.root)

    def test_fully_guarded_workflows_pass(self) -> None:
        self.assertEqual(self.run_validate(), [])

    def test_publish_without_guard_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.release_jobs["publish"] = False

        errors = self.run_validate(mutate)
        self.assertTrue(
            any("publish" in error and "does not reject non-main refs" in error for error in errors)
        )

    def test_publish_crates_without_guard_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.release_jobs["publish-crates"] = False

        errors = self.run_validate(mutate)
        self.assertTrue(
            any("publish-crates" in error and "does not reject non-main refs" in error for error in errors)
        )

    def test_reconcile_without_guard_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.reconcile_guarded = False

        errors = self.run_validate(mutate)
        self.assertTrue(
            any("reconcile" in error and "does not reject non-main refs" in error for error in errors)
        )

    def test_missing_reconcile_job_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.reconcile_present = False

        errors = self.run_validate(mutate)
        self.assertTrue(any("missing job 'reconcile'" in error for error in errors))

    def test_missing_release_workflow_fails(self) -> None:
        def mutate(repo: Repository) -> None:
            repo.release_present = False

        errors = self.run_validate(mutate)
        self.assertTrue(any("release.yml" in error and "missing workflow" in error for error in errors))

    def test_double_quoted_guard_passes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Repository(Path(tmp))
            repo.release_jobs = {"publish": True, "publish-crates": True, "publish-pypi": True}
            repo.build()
            text = (repo.root / ".github/workflows/release.yml").read_text(encoding="utf-8")
            text = text.replace(
                "if: github.ref != 'refs/heads/main'",
                'if: github.ref != "refs/heads/main"',
            )
            (repo.root / ".github/workflows/release.yml").write_text(text, encoding="utf-8")
            self.assertEqual(CHECK.validate(repo.root), [])


if __name__ == "__main__":
    unittest.main()
