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

REPO_ROOT = Path(__file__).resolve().parents[2]

ADDON_TARGETS = ["aarch64-apple-darwin", "x86_64-unknown-linux-musl"]
CLI_TARGETS = ["aarch64-apple-darwin", "x86_64-unknown-linux-musl"]
ENGINES = ["chromium", "webkit"]
MAJORS = [20, 22]


class Repository:
    """Builds a minimal repository that satisfies every check, so each test
    can break exactly one thing and see exactly one error."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.addon_targets = list(ADDON_TARGETS)
        self.napi_targets = list(ADDON_TARGETS)
        self.workflow_addon_targets = list(ADDON_TARGETS)
        self.qualifier_addon_targets = list(ADDON_TARGETS)
        # The non-musl target in ADDON_TARGETS; npm ships glibc only.
        self.publish_targets = ["aarch64-apple-darwin"]
        # `None` means "derive from publish_targets through the same
        # target-to-platform-name mapping `build()` writes into the
        # qualifier"; set explicitly to break exactly one file at a time.
        self.npm_dirs: list[str] | None = None
        self.npm_manifest_name_overrides: dict[str, str] = {}
        self.js_optional_deps: list[str] | None = None
        self.runtime_node_packages: list[str] | None = None
        self.cli_targets = list(CLI_TARGETS)
        self.workflow_cli_targets = list(CLI_TARGETS)
        self.qualifier_cli_targets = list(CLI_TARGETS)
        self.engines = list(ENGINES)
        self.workflow_engines = list(ENGINES)
        self.qualifier_engines = list(ENGINES)
        self.majors = list(MAJORS)
        self.ci_majors = list(MAJORS)
        self.smoke_majors = list(MAJORS)
        self.musl_majors = list(MAJORS)
        self.engines_node = ">=20"
        self.qualification_permissions = "    permissions:\n      contents: read\n"
        self.checkout = (
            "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0"
        )

    def write(self, relative: str, content: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def _toml_list(self, values: list) -> str:
        return "[" + ", ".join(json.dumps(value) for value in values) + "]"

    def build(self) -> Path:
        self.write(
            "Cargo.toml",
            "[workspace]\n[workspace.metadata.secret-scan]\n"
            f"node-addon-targets = {self._toml_list(self.addon_targets)}\n"
            f"node-publish-targets = {self._toml_list(self.publish_targets)}\n"
            f"cli-release-targets = {self._toml_list(self.cli_targets)}\n"
            f"browser-engines = {self._toml_list(self.engines)}\n"
            f"node-support-majors = {self._toml_list(self.majors)}\n",
        )
        self.write(
            "package.json",
            json.dumps({"engines": {"node": self.engines_node}}, indent=2) + "\n",
        )

        platform_map = {
            target: f"platform-{index}" for index, target in enumerate(self.qualifier_addon_targets)
        }
        publish_platforms = [platform_map[target] for target in self.publish_targets if target in platform_map]
        default_packages = [f"@omiologic/secret-scan-{platform}" for platform in publish_platforms]
        optional_deps = self.js_optional_deps if self.js_optional_deps is not None else default_packages
        runtime_packages = (
            self.runtime_node_packages if self.runtime_node_packages is not None else default_packages
        )

        self.write(
            "packages/javascript/package.json",
            json.dumps(
                {
                    "engines": {"node": self.engines_node},
                    "optionalDependencies": {name: "0.0.0" for name in optional_deps},
                },
                indent=2,
            )
            + "\n",
        )
        self.write(
            "packages/javascript/src/runtime/node.ts",
            "".join(f'  {index}: "{name}",\n' for index, name in enumerate(runtime_packages)),
        )
        self.write(
            "bindings/node/package.json",
            json.dumps(
                {
                    "napi": {"binaryName": "secret-scan", "targets": self.napi_targets},
                    "engines": {"node": self.engines_node},
                },
                indent=2,
            )
            + "\n",
        )

        platform_names = "".join(
            f'  "{target}": "platform-{index}",\n'
            for index, target in enumerate(self.qualifier_addon_targets)
        )
        self.write(
            "scripts/qualify-node-addon.mjs",
            f"const TARGET_PLATFORM_NAMES = {{\n{platform_names}}};\n",
        )

        npm_dirs = self.npm_dirs if self.npm_dirs is not None else publish_platforms
        for platform in npm_dirs:
            name = self.npm_manifest_name_overrides.get(platform, f"@omiologic/secret-scan-{platform}")
            self.write(
                f"bindings/node/npm/{platform}/package.json",
                json.dumps({"name": name, "version": "0.0.0"}, indent=2) + "\n",
            )
        suffixes = "".join(
            f'    "{target}": "",\n' for target in self.qualifier_cli_targets
        )
        self.write(
            "scripts/qualify-cli-binary.mjs",
            f"TARGET_SUFFIXES = {{\n{suffixes}}}\n",
        )
        listed = ", ".join(f'"{engine}"' for engine in self.qualifier_engines)
        self.write(
            "scripts/qualify-browser-artifact.mjs",
            f"const ENGINES = [{listed}];\n",
        )

        self.write(
            ".github/workflows/ci.yml",
            "name: CI\non:\n  pull_request:\npermissions: {}\njobs:\n"
            "  test:\n    runs-on: ubuntu-latest\n    permissions:\n"
            "      contents: read\n    strategy:\n      matrix:\n"
            "        node-version:\n"
            + "".join(f"          - {major}\n" for major in self.ci_majors)
            + "    steps:\n"
            f"      - uses: {self.checkout}\n",
        )
        self.write(
            ".github/workflows/artifact-qualification.yml",
            self._qualification(),
        )
        return self.root

    def _qualification(self) -> str:
        addon = "".join(
            f"          - target: {target}\n            runner: ubuntu-latest\n"
            for target in self.workflow_addon_targets
        )
        cli = "".join(
            f"          - target: {target}\n            runner: ubuntu-latest\n"
            for target in self.workflow_cli_targets
        )
        engines = "".join(f"          - {engine}\n" for engine in self.workflow_engines)
        smoke = "".join(
            f"      - name: Qualify the addon on Node {major}\n"
            f"        run: node scripts/qualify-node-addon.mjs\n"
            for major in self.smoke_majors
        )
        musl = " ".join(str(major) for major in self.musl_majors)
        return (
            "name: Artifact qualification\non:\n  workflow_dispatch:\n"
            "permissions: {}\njobs:\n"
            "  node-addon:\n    runs-on: ubuntu-latest\n"
            f"{self.qualification_permissions}"
            "    strategy:\n      matrix:\n        include:\n"
            f"{addon}"
            "    steps:\n"
            f"      - uses: {self.checkout}\n"
            f"{smoke}"
            "      - name: Qualify the addon on musl\n"
            "        run: |\n"
            f"          for major in {musl}; do\n"
            "            echo qualify\n"
            "          done\n"
            "  browser:\n    runs-on: ubuntu-latest\n"
            "    permissions:\n      contents: read\n"
            "    strategy:\n      matrix:\n        engine:\n"
            f"{engines}"
            "    steps:\n"
            f"      - uses: {self.checkout}\n"
            "  cli:\n    runs-on: ubuntu-latest\n"
            "    permissions:\n      contents: read\n"
            "    strategy:\n      matrix:\n        include:\n"
            f"{cli}"
            "    steps:\n"
            f"      - uses: {self.checkout}\n"
        )


class MatrixTests(unittest.TestCase):
    def validate(self, configure=None) -> list[str]:
        with tempfile.TemporaryDirectory() as directory:
            repository = Repository(Path(directory))
            if configure is not None:
                configure(repository)
            return CHECK.validate(repository.build())

    def assertOneError(self, configure, fragment: str) -> None:
        errors = self.validate(configure)
        self.assertEqual(len(errors), 1, errors)
        self.assertIn(fragment, errors[0])

    def test_a_consistent_repository_passes(self) -> None:
        self.assertEqual(self.validate(), [])

    # --- Node addon targets -------------------------------------------

    def test_a_target_declared_but_not_built_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.workflow_addon_targets.pop()

        self.assertOneError(configure, "job 'node-addon''s target matrix omits")

    def test_a_target_built_but_not_declared_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.workflow_addon_targets.append("x86_64-pc-windows-msvc")

        self.assertOneError(configure, "which Cargo.toml does not declare")

    def test_napi_targets_missing_a_declared_target_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.napi_targets.pop()

        self.assertOneError(configure, "napi.targets omits")

    def test_napi_targets_naming_an_undeclared_target_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.napi_targets.append("aarch64-pc-windows-msvc")

        self.assertOneError(configure, "napi.targets names aarch64-pc-windows-msvc")

    def test_a_target_the_addon_qualifier_cannot_name_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.addon_targets.append("aarch64-unknown-linux-gnu")
            repository.napi_targets.append("aarch64-unknown-linux-gnu")
            repository.workflow_addon_targets.append("aarch64-unknown-linux-gnu")

        self.assertOneError(configure, "no platform file name for")

    # --- CLI targets ---------------------------------------------------

    def test_a_cli_target_declared_but_not_built_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.workflow_cli_targets.pop()

        self.assertOneError(configure, "job 'cli''s target matrix omits")

    def test_a_cli_target_built_but_not_declared_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.workflow_cli_targets.append("x86_64-apple-darwin")

        self.assertOneError(configure, "job 'cli''s target matrix names x86_64-apple-darwin")

    def test_a_cli_target_the_qualifier_does_not_know_fails(self) -> None:
        def configure(repository: Repository) -> None:
            for targets in (
                repository.cli_targets,
                repository.workflow_cli_targets,
                repository.addon_targets,
                repository.napi_targets,
                repository.workflow_addon_targets,
                repository.qualifier_addon_targets,
            ):
                targets.append("x86_64-apple-darwin")

        self.assertOneError(configure, "its target list omits x86_64-apple-darwin")

    def test_a_cli_target_the_addon_does_not_build_fails(self) -> None:
        """The CLI ships no musl variant, so its matrix is a subset of the
        addon's; a CLI-only target is a mistake, not a supported platform."""

        def configure(repository: Repository) -> None:
            repository.cli_targets.append("x86_64-apple-darwin")
            repository.workflow_cli_targets.append("x86_64-apple-darwin")
            repository.qualifier_cli_targets.append("x86_64-apple-darwin")

        self.assertOneError(
            configure,
            "cli-release-targets names x86_64-apple-darwin, which node-addon-targets does not",
        )

    def test_the_cli_matrix_may_be_a_strict_subset_of_the_addon_matrix(self) -> None:
        """The real repository's shape: eight addon targets, six CLI ones."""

        def configure(repository: Repository) -> None:
            repository.cli_targets.pop()
            repository.workflow_cli_targets.pop()
            repository.qualifier_cli_targets.pop()

        self.assertEqual(self.validate(configure), [])

    # --- Node publish targets (glibc/musl publication boundary) --------

    def test_a_publish_target_the_addon_does_not_build_fails(self) -> None:
        def configure(repository: Repository) -> None:
            # Known to the qualifier (so only the addon-membership check
            # fires) but never added to `node-addon-targets` itself.
            repository.qualifier_addon_targets = repository.qualifier_addon_targets + [
                "x86_64-pc-windows-msvc"
            ]
            repository.publish_targets.append("x86_64-pc-windows-msvc")

        self.assertOneError(
            configure,
            "node-publish-targets names x86_64-pc-windows-msvc, which node-addon-targets does not",
        )

    def test_a_publish_target_with_no_native_npm_directory_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.npm_dirs = []

        self.assertOneError(configure, "published platform packages omits platform-0")

    def test_a_native_npm_directory_not_in_node_publish_targets_fails(self) -> None:
        """The musl target has no publish entry, so it must not gain an npm
        directory without also being added to `node-publish-targets` — the
        other half of the glibc/musl boundary staying explicit."""

        def configure(repository: Repository) -> None:
            repository.npm_dirs = ["platform-0", "platform-1"]

        self.assertOneError(
            configure, "published platform packages names platform-1, which Cargo.toml does not declare"
        )

    def test_a_native_manifest_with_the_wrong_package_name_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.npm_manifest_name_overrides["platform-0"] = "@omiologic/secret-scan-wrong"

        self.assertOneError(
            configure,
            "name '@omiologic/secret-scan-wrong' must be '@omiologic/secret-scan-platform-0'",
        )

    def test_a_missing_optional_dependency_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.js_optional_deps = []

        self.assertOneError(configure, "optionalDependencies omits @omiologic/secret-scan-platform-0")

    def test_an_extra_optional_dependency_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.js_optional_deps = [
                "@omiologic/secret-scan-platform-0",
                "@omiologic/secret-scan-platform-1",
            ]

        self.assertOneError(
            configure,
            "optionalDependencies names @omiologic/secret-scan-platform-1, which Cargo.toml does not declare",
        )

    def test_the_runtime_resolver_missing_a_published_package_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.runtime_node_packages = []

        self.assertOneError(
            configure, "the platform-package mapping omits @omiologic/secret-scan-platform-0"
        )

    def test_the_runtime_resolver_naming_an_unpublished_package_fails(self) -> None:
        """`runtime/node.ts` mapping a host to a package with no publication
        path (e.g. accidentally wiring in a musl package) is exactly the
        drift this check exists to catch."""

        def configure(repository: Repository) -> None:
            repository.runtime_node_packages = [
                "@omiologic/secret-scan-platform-0",
                "@omiologic/secret-scan-platform-1",
            ]

        self.assertOneError(
            configure,
            "the platform-package mapping names @omiologic/secret-scan-platform-1, "
            "which Cargo.toml does not declare",
        )

    def test_node_publish_targets_missing_declaration_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.publish_targets = []
            repository.npm_dirs = []
            repository.js_optional_deps = []
            repository.runtime_node_packages = []

        self.assertOneError(
            configure, "node-publish-targets must declare the published platform-package matrix"
        )

    # --- Browser engines -----------------------------------------------

    def test_an_engine_declared_but_not_exercised_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.workflow_engines.pop()

        self.assertOneError(configure, "job 'browser''s engine matrix omits webkit")

    def test_an_engine_exercised_but_not_declared_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.workflow_engines.append("firefox")

        self.assertOneError(configure, "job 'browser''s engine matrix names firefox")

    def test_an_engine_the_browser_qualifier_rejects_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.engines.append("firefox")
            repository.workflow_engines.append("firefox")

        self.assertOneError(configure, "ENGINES omits firefox")

    # --- Node.js support -------------------------------------------------

    def test_a_major_ci_does_not_run_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.ci_majors.pop()

        self.assertOneError(configure, "the node-version matrix omits 22")

    def test_a_major_the_addon_is_not_smoke_tested_on_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.smoke_majors.pop()

        self.assertOneError(configure, "the addon smoke-test majors omits 22")

    def test_a_major_musl_does_not_cover_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.musl_majors.pop()

        self.assertOneError(configure, "the musl smoke-test majors omits 22")

    # `engines.node` itself is `check-rust-workspace.py`'s rule: it derives
    # the exact majors from `ci.yml` and requires every lockstep manifest to
    # enumerate them. `test_check_rust_workspace.py` covers that; this script
    # deliberately does not check it a second, contradictory way.

    # --- Workflow hygiene -------------------------------------------------

    def test_a_job_without_permissions_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.qualification_permissions = ""

        self.assertOneError(configure, "job 'node-addon' declares no permissions")

    def test_a_job_taking_an_unlisted_write_scope_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.qualification_permissions = (
                "    permissions:\n      contents: write\n"
            )

        self.assertOneError(configure, "takes contents: write")

    def test_a_job_declaring_write_all_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.qualification_permissions = "    permissions: write-all\n"

        self.assertOneError(configure, "declares permissions as 'write-all'")

    def test_an_empty_permissions_mapping_is_accepted(self) -> None:
        def configure(repository: Repository) -> None:
            repository.qualification_permissions = "    permissions: {}\n"

        self.assertEqual(self.validate(configure), [])

    def test_a_workflow_without_top_level_permissions_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository = Repository(Path(directory))
            root = repository.build()
            path = root / ".github" / "workflows" / "ci.yml"
            path.write_text(
                path.read_text(encoding="utf-8").replace("permissions: {}\n", "", 1),
                encoding="utf-8",
            )
            errors = CHECK.validate(root)
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("declares no top-level permissions", errors[0])

    def test_an_action_pinned_to_a_tag_fails(self) -> None:
        def configure(repository: Repository) -> None:
            repository.checkout = "actions/checkout@v6"

        errors = self.validate(configure)
        self.assertEqual(len(errors), 4, errors)
        for error in errors:
            self.assertIn("is not pinned to a commit SHA", error)

    def test_a_local_reusable_workflow_needs_no_pin(self) -> None:
        def configure(repository: Repository) -> None:
            repository.checkout = "./.github/workflows/ci.yml"

        self.assertEqual(self.validate(configure), [])

    # --- The real repository ---------------------------------------------

    def test_this_repository_satisfies_every_check(self) -> None:
        self.assertEqual(CHECK.validate(REPO_ROOT), [])


if __name__ == "__main__":
    unittest.main()
