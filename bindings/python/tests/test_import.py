"""Import tests: the package imports cleanly and exposes the documented
public surface, with no custom detector callback surface."""

from __future__ import annotations

import inspect

import secret_scan


def test_module_imports_and_declares_all() -> None:
    assert secret_scan.__all__
    for name in secret_scan.__all__:
        assert hasattr(secret_scan, name), name


def test_version_and_range_unit_are_documented_strings() -> None:
    assert isinstance(secret_scan.VERSION, str) and secret_scan.VERSION
    assert secret_scan.RANGE_UNIT == "unicode-code-points"
    assert secret_scan.__version__ == secret_scan.VERSION


def test_exception_hierarchy_is_importable_and_rooted() -> None:
    subclasses = [
        secret_scan.InvalidInputError,
        secret_scan.InvalidOptionsError,
        secret_scan.InvalidDetectorError,
        secret_scan.DetectorFailureError,
        secret_scan.InvalidCandidateError,
        secret_scan.PolicyFailureError,
        secret_scan.InvalidPolicyActionError,
        secret_scan.InvalidFindingsError,
        secret_scan.PlaceholderFailureError,
        secret_scan.InvalidPlaceholderError,
    ]
    for exc_type in subclasses:
        assert issubclass(exc_type, secret_scan.SecretScanError)
        assert issubclass(exc_type, Exception)


def test_no_custom_detector_callback_surface() -> None:
    """`decision-define-runtime-bindings`: the first stable API excludes a
    custom detector callback surface. `scan` only accepts `text` and
    `policy`; nothing named after a detector or registry is exported."""
    scan_params = set(inspect.signature(secret_scan.scan).parameters)
    assert scan_params <= {"text", "policy"}
    for name in secret_scan.__all__:
        assert "detector" not in name.lower() or name in {
            "DetectorFailureError",
            "InvalidDetectorError",
        }
