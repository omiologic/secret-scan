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

For input that arrives in pieces, :class:`IncrementalSanitizer` sanitizes a
bounded session chunk by chunk::

    limits = secret_scan.IncrementalLimits(
        max_input_bytes=1_000_000,
        max_buffered_bytes=16_512,
        max_token_bytes=8_192,
        max_multiline_bytes=16_384,
    )
    with secret_scan.IncrementalSanitizer(limits) as session:
        for chunk in chunks:
            print(session.append(chunk).text, end="")
        print(session.finalize().text, end="")

Its findings carry absolute code point offsets into the logical
whole-session input, so they index ``"".join(chunks)`` exactly as the
synchronous API's findings index the same joined string. Limits are
mandatory: a session declares its own bounds and there are no defaults.

``policy`` and ``formatter`` callbacks only ever receive the safe metadata
types below, never the input or a matched value. A callback that raises, or
that returns something other than the documented protocol, never
propagates its own error: it becomes one of the fixed exceptions below.
"""

from __future__ import annotations

from secret_scan._native import (
    INCREMENTAL_LOOKAROUND_BYTES,
    RANGE_UNIT,
    VERSION,
    BufferLimitExceededError,
    DetectedFinding,
    DetectorFailureError,
    Finding,
    IncrementalLimits,
    IncrementalPolicyContext,
    IncrementalResult,
    IncrementalSanitizer,
    InputLimitExceededError,
    InvalidCandidateError,
    InvalidDetectorError,
    InvalidFindingsError,
    InvalidInputError,
    InvalidLimitsError,
    InvalidOptionsError,
    InvalidPlaceholderError,
    InvalidPolicyActionError,
    InvalidStateError,
    MultilineLimitExceededError,
    PlaceholderContext,
    PlaceholderFailureError,
    PolicyContext,
    PolicyFailureError,
    ScanResult,
    SecretScanError,
    TokenLimitExceededError,
    default_incremental_policy,
    default_placeholder_formatter,
    default_policy,
    redact,
    scan,
    scan_and_redact,
    typed_placeholder_formatter,
)

__version__ = VERSION

__all__ = [
    "INCREMENTAL_LOOKAROUND_BYTES",
    "RANGE_UNIT",
    "VERSION",
    "BufferLimitExceededError",
    "DetectedFinding",
    "DetectorFailureError",
    "Finding",
    "IncrementalLimits",
    "IncrementalPolicyContext",
    "IncrementalResult",
    "IncrementalSanitizer",
    "InputLimitExceededError",
    "InvalidCandidateError",
    "InvalidDetectorError",
    "InvalidFindingsError",
    "InvalidInputError",
    "InvalidLimitsError",
    "InvalidOptionsError",
    "InvalidPlaceholderError",
    "InvalidPolicyActionError",
    "InvalidStateError",
    "MultilineLimitExceededError",
    "PlaceholderContext",
    "PlaceholderFailureError",
    "PolicyContext",
    "PolicyFailureError",
    "ScanResult",
    "SecretScanError",
    "TokenLimitExceededError",
    "default_incremental_policy",
    "default_placeholder_formatter",
    "default_policy",
    "redact",
    "scan",
    "scan_and_redact",
    "typed_placeholder_formatter",
]
