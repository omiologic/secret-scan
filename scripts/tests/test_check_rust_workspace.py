from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "check-rust-workspace.py"
SPEC = importlib.util.spec_from_file_location("check_rust_workspace", SCRIPT)
assert SPEC and SPEC.loader
CHECK = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CHECK
SPEC.loader.exec_module(CHECK)

VERSION = "0.1.0-beta.1"
MSRV = "1.88"


def package(root: Path, name: str, relative: str, deps: list[str], rust_version: str | None = MSRV) -> dict:
    return {
        "id": name,
        "name": name,
        "version": VERSION,
        "rust_version": rust_version,
        "manifest_path": str(root / relative / "Cargo.toml"),
        "_deps": deps,
    }


class Workspace:
    """Builds a minimal repository plus matching ``cargo metadata`` output."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.packages: list[dict] = []
        self.members: list[str] = []
        self.dep_kinds: dict[tuple[str, str], list[dict]] = {}
        self.allowed: list[str] = []
        self.forbidden: list[str] = ["reqwest"]
        self.write(".github/workflows/ci.yml", f'name: CI\nenv:\n  MSRV: "{MSRV}"\n')
        self.write("package.json", json.dumps({"version": VERSION}))
        self.write("bindings/node/package.json", json.dumps({"version": VERSION}))
        self.add_member("secret-scan", "crates/secret-scan-core", "src/lib.rs", "#![forbid(unsafe_code)]\n")
        self.add_member("secret-scan-cli", "crates/secret-scan-cli", "src/main.rs", "#![forbid(unsafe_code)]\n", deps=["secret-scan"])

    def write(self, relative: str, content: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def add_member(self, name: str, relative: str, source: str, content: str, deps: list[str] | None = None, lints: str = "[lints]\nworkspace = true\n") -> None:
        self.write(f"{relative}/Cargo.toml", f'[package]\nname = "{name}"\n{lints}')
        self.write(f"{relative}/{source}", content)
        self.packages.append(package(self.root, name, relative, deps or []))
        self.members.append(name)

    def add_dependency(self, name: str, rust_version: str | None = None, deps: list[str] | None = None) -> None:
        self.packages.append(package(self.root, name, f"registry/{name}", deps or [], rust_version))

    def metadata(self) -> dict:
        nodes = []
        for entry in self.packages:
            deps = []
            for dep in entry["_deps"]:
                kinds = self.dep_kinds.get((entry["name"], dep), [{"kind": None}])
                deps.append({"name": dep, "pkg": dep, "dep_kinds": kinds})
            nodes.append({"id": entry["id"], "deps": deps})
        unsafe = 'unsafe_code = "deny"'
        self.write(
            "Cargo.toml",
            f'[workspace]\n[workspace.package]\nversion = "{VERSION}"\nrust-version = "{MSRV}"\n'
            f"[workspace.lints.rust]\n{unsafe}\n",
        )
        return {
            "packages": [{key: value for key, value in entry.items() if key != "_deps"} for entry in self.packages],
            "workspace_members": list(self.members),
            "resolve": {"nodes": nodes},
            "metadata": {
                "secret-scan": {
                    "core-package": "secret-scan",
                    "allowed-dependencies": self.allowed,
                    "forbidden-dependencies": self.forbidden,
                }
            },
        }


class RustWorkspaceCheckTests(unittest.TestCase):
    def run_check(self, configure=None) -> list[str]:
        with tempfile.TemporaryDirectory() as temp:
            workspace = Workspace(Path(temp))
            if configure is not None:
                configure(workspace)
            return CHECK.validate(workspace.root, workspace.metadata())

    def test_scaffold_passes(self) -> None:
        self.assertEqual(self.run_check(), [])

    def test_unlisted_core_dependency_is_rejected(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.packages[0]["_deps"].append("memchr")
            workspace.add_dependency("memchr")

        errors = self.run_check(configure)
        self.assertTrue(any("memchr is not in allowed-dependencies" in error for error in errors), errors)

    def test_allowed_core_dependency_is_checked_transitively(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.allowed.append("memchr")
            workspace.packages[0]["_deps"].append("memchr")
            workspace.add_dependency("memchr", deps=["libc"])
            workspace.add_dependency("libc")

        errors = self.run_check(configure)
        self.assertTrue(any("libc is not in allowed-dependencies" in error for error in errors), errors)

    def test_forbidden_dependency_is_rejected_even_when_allowed(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.allowed.append("reqwest")
            workspace.packages[0]["_deps"].append("reqwest")
            workspace.add_dependency("reqwest")

        errors = self.run_check(configure)
        self.assertTrue(any("forbidden dependency reqwest" in error for error in errors), errors)

    def test_core_dev_dependencies_are_outside_the_boundary(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.packages[0]["_deps"].append("proptest")
            workspace.dep_kinds[("secret-scan", "proptest")] = [{"kind": "dev"}]
            workspace.add_dependency("proptest")

        self.assertEqual(self.run_check(configure), [])

    def test_cli_may_depend_on_host_crates(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.packages[1]["_deps"].append("clap")
            workspace.add_dependency("clap", rust_version="1.85")

        self.assertEqual(self.run_check(configure), [])

    def test_missing_forbid_unsafe_in_core_is_rejected(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.write("crates/secret-scan-core/src/lib.rs", "pub const VERSION: &str = \"x\";\n")

        errors = self.run_check(configure)
        self.assertTrue(any("must contain #![forbid(unsafe_code)]" in error for error in errors), errors)

    def test_member_without_workspace_lints_is_rejected(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.add_member("secret-scan-wasm", "bindings/wasm", "src/lib.rs", "", lints="")

        errors = self.run_check(configure)
        self.assertTrue(any("must set [lints] workspace = true" in error for error in errors), errors)

    def test_version_lockstep_covers_npm_manifests(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.write("bindings/node/package.json", json.dumps({"version": "0.2.0"}))

        errors = self.run_check(configure)
        self.assertTrue(any("bindings/node/package.json: version 0.2.0" in error for error in errors), errors)

    def test_member_version_drift_is_rejected(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.packages[1]["version"] = "0.2.0"

        errors = self.run_check(configure)
        self.assertTrue(any("secret-scan-cli: version 0.2.0" in error for error in errors), errors)

    def test_dependency_requiring_newer_rust_is_rejected(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.packages[1]["_deps"].append("newer")
            workspace.add_dependency("newer", rust_version="1.90.0")

        errors = self.run_check(configure)
        self.assertTrue(any("MSRV 1.88 is below 1.90.0 required by newer" in error for error in errors), errors)

    def test_equal_dependency_msrv_with_patch_component_passes(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.packages[1]["_deps"].append("same")
            workspace.add_dependency("same", rust_version="1.88.0")

        self.assertEqual(self.run_check(configure), [])

    def test_ci_msrv_must_match_manifest(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.write(".github/workflows/ci.yml", 'name: CI\nenv:\n  MSRV: "1.85"\n')

        errors = self.run_check(configure)
        self.assertTrue(any("expected exactly one MSRV: 1.88" in error for error in errors), errors)

    def test_member_msrv_drift_is_rejected(self) -> None:
        def configure(workspace: Workspace) -> None:
            workspace.packages[1]["rust_version"] = "1.85"

        errors = self.run_check(configure)
        self.assertTrue(any("secret-scan-cli: rust-version 1.85" in error for error in errors), errors)


if __name__ == "__main__":
    unittest.main()
