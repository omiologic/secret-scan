"""Deterministic secret detection and redaction, synchronously.

``secret_scan`` wraps the ``secret_scan._native`` PyO3 extension built from
the Rust core (``decision-define-runtime-bindings``). Every built-in
detector runs; there is no custom detector callback surface. Ranges on
every :class:`DetectedFinding` and :class:`Finding` are Unicode code point
offsets (``RANGE_UNIT``), matching Python's own ``str`` indexing and
slicing.

Typical usage::

    import secret_scan

    findings = secret_scan.scan(text)
    redacted = secret_scan.redact(text, findings)

    # or, to guarantee the findings and the redacted text agree:
    result = secret_scan.scan_and_redact(text)
    result.text, result.findings

``policy`` and ``formatter`` callbacks only ever receive the safe metadata
types below, never the input or a matched value. A callback that raises, or
that returns something other than the documented protocol, never
propagates its own error: it becomes one of the fixed exceptions below.
"""

from __future__ import annotations

from secret_scan._native import (
    RANGE_UNIT,
    VERSION,
    DetectedFinding,
    DetectorFailureError,
    Finding,
    InvalidCandidateError,
    InvalidDetectorError,
    InvalidFindingsError,
    InvalidInputError,
    InvalidOptionsError,
    InvalidPlaceholderError,
    InvalidPolicyActionError,
    PlaceholderContext,
    PlaceholderFailureError,
    PolicyContext,
    PolicyFailureError,
    ScanResult,
    SecretScanError,
    default_placeholder_formatter,
    default_policy,
    redact,
    scan,
    scan_and_redact,
    typed_placeholder_formatter,
)

__version__ = VERSION

__all__ = [
    "RANGE_UNIT",
    "VERSION",
    "DetectedFinding",
    "DetectorFailureError",
    "Finding",
    "InvalidCandidateError",
    "InvalidDetectorError",
    "InvalidFindingsError",
    "InvalidInputError",
    "InvalidOptionsError",
    "InvalidPlaceholderError",
    "InvalidPolicyActionError",
    "PlaceholderContext",
    "PlaceholderFailureError",
    "PolicyContext",
    "PolicyFailureError",
    "ScanResult",
    "SecretScanError",
    "default_placeholder_formatter",
    "default_policy",
    "redact",
    "scan",
    "scan_and_redact",
    "typed_placeholder_formatter",
]
