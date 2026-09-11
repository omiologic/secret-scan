from __future__ import annotations

import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "verify-recovery-artifact.py"
SPEC = importlib.util.spec_from_file_location("verify_recovery_artifact", SCRIPT)
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


class RecoveryArtifactTests(unittest.TestCase):
    def test_missing_extra_and_changed_bytes_are_rejected(self):
        payload = b"synthetic qualified artifact"
        inventory = {"artifacts": [{"artifact": "addon", "file": "addon.node", "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}]}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with self.assertRaises(ValueError):
                CHECK.verify_files(inventory, "addon", root)
            (root / "addon.node").write_bytes(payload)
            CHECK.verify_files(inventory, "addon", root)
            (root / "extra.txt").write_text("extra")
            with self.assertRaises(ValueError):
                CHECK.verify_files(inventory, "addon", root)
            (root / "extra.txt").unlink()
            (root / "addon.node").write_bytes(payload.upper())
            with self.assertRaises(ValueError):
                CHECK.verify_files(inventory, "addon", root)

    def test_pypi_requires_exact_file_set_and_checksums(self):
        inventory = {"artifacts": [{"file": "synthetic.whl", "sha256": "a" * 64}, {"file": "synthetic.tar.gz", "sha256": "b" * 64}]}
        files = [{"filename": item["file"], "digests": {"sha256": item["sha256"]}} for item in inventory["artifacts"]]
        CHECK.verify_pypi(inventory, {"urls": files})
        for bad in ([], files[:1], files + [{"filename": "extra.whl", "digests": {"sha256": "c" * 64}}], [{"filename": "synthetic.whl", "digests": {"sha256": "d" * 64}}, files[1]]):
            with self.subTest(files=bad), self.assertRaises(ValueError):
                CHECK.verify_pypi(inventory, {"urls": bad})
