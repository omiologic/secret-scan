from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "release-manifest.py"
SPEC = importlib.util.spec_from_file_location("release_manifest", SCRIPT)
assert SPEC and SPEC.loader
RELEASE_MANIFEST = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = RELEASE_MANIFEST
SPEC.loader.exec_module(RELEASE_MANIFEST)


VALID_FIELDS = dict(
    source_revision="a" * 40,
    conformance_identity="b" * 40,
    version="0.1.0-beta.1",
    artifact_set=["npm:@redact-secret/core"],
    registry_state={"npm": "published"},
)


class BuildManifestTests(unittest.TestCase):
    def test_carries_all_five_fields(self) -> None:
        manifest = RELEASE_MANIFEST.build_manifest(**VALID_FIELDS)
        self.assertEqual(
            set(manifest),
            {
                "source_revision",
                "conformance_identity",
                "version",
                "artifact_set",
                "registry_state",
            },
        )
        self.assertEqual(manifest["source_revision"], VALID_FIELDS["source_revision"])
        self.assertEqual(manifest["artifact_set"], ["npm:@redact-secret/core"])
        self.assertEqual(manifest["registry_state"], {"npm": "published"})

    def test_rejects_each_missing_field(self) -> None:
        for field, empty in (
            ("source_revision", ""),
            ("conformance_identity", ""),
            ("version", ""),
            ("artifact_set", []),
            ("registry_state", {}),
        ):
            with self.subTest(field=field):
                fields = dict(VALID_FIELDS, **{field: empty})
                with self.assertRaises(ValueError):
                    RELEASE_MANIFEST.build_manifest(**fields)

    def test_artifact_set_and_registry_state_are_sorted(self) -> None:
        manifest = RELEASE_MANIFEST.build_manifest(
            **dict(
                VALID_FIELDS,
                artifact_set=["npm:b", "npm:a"],
                registry_state={"pypi": "unpublished", "npm": "published"},
            )
        )
        self.assertEqual(manifest["artifact_set"], ["npm:a", "npm:b"])
        self.assertEqual(list(manifest["registry_state"]), ["npm", "pypi"])


class CliTests(unittest.TestCase):
    def test_writes_the_manifest_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "manifest.json"
            status = RELEASE_MANIFEST.main(
                [
                    "--source-revision",
                    VALID_FIELDS["source_revision"],
                    "--conformance-identity",
                    VALID_FIELDS["conformance_identity"],
                    "--version",
                    VALID_FIELDS["version"],
                    "--artifact",
                    "npm:@redact-secret/core",
                    "--registry-state",
                    "npm=published",
                    "--out",
                    str(out),
                ]
            )
            self.assertEqual(status, 0)
            recorded = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(recorded["version"], VALID_FIELDS["version"])
            self.assertEqual(recorded["registry_state"], {"npm": "published"})

    def test_fails_without_writing_when_a_field_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "manifest.json"
            status = RELEASE_MANIFEST.main(
                [
                    "--source-revision",
                    "",
                    "--conformance-identity",
                    VALID_FIELDS["conformance_identity"],
                    "--version",
                    VALID_FIELDS["version"],
                    "--artifact",
                    "npm:@redact-secret/core",
                    "--registry-state",
                    "npm=published",
                    "--out",
                    str(out),
                ]
            )
            self.assertEqual(status, 1)
            self.assertFalse(out.exists())

    def test_registry_state_requires_name_equals_state(self) -> None:
        with self.assertRaises(ValueError):
            RELEASE_MANIFEST._parse_registry_state(["npm"])


if __name__ == "__main__":
    unittest.main()
