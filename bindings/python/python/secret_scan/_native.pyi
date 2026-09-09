"""Type stubs for the compiled ``secret_scan._native`` extension module.

Import from :mod:`secret_scan`, not this module directly; the names here
are re-exported there.
"""

from __future__ import annotations

from typing import Callable

# ---------------------------------------------------------------------
# Module constants
# ---------------------------------------------------------------------

VERSION: str
"""The shared product version, identical across every core, CLI, and binding."""

RANGE_UNIT: str
"""The Unicode string-index unit every range in this module reports:
``"unicode-code-points"``."""

# ---------------------------------------------------------------------
# Sanitized exceptions
# ---------------------------------------------------------------------

class SecretScanError(Exception):
    """Base class for every sanitized secret-scan error."""

class InvalidInputError(SecretScanError):
    code: str

class InvalidOptionsError(SecretScanError):
    code: str

class InvalidDetectorError(SecretScanError):
    code: str

class DetectorFailureError(SecretScanError):
    code: str

class InvalidCandidateError(SecretScanError):
    code: str

class PolicyFailureError(SecretScanError):
    code: str

class InvalidPolicyActionError(SecretScanError):
    code: str

class InvalidFindingsError(SecretScanError):
    code: str

class PlaceholderFailureError(SecretScanError):
    code: str

class InvalidPlaceholderError(SecretScanError):
    code: str

# ---------------------------------------------------------------------
# Safe metadata types
#
# None of these types can be constructed from Python; they are only ever
# produced by scan(), redact(), and scan_and_redact() and passed to a
# policy or formatter callback.
# ---------------------------------------------------------------------

class DetectedFinding:
    """Pre-policy, immutable finding metadata passed to a policy callback."""

    id: str
    type: str
    detector: str
    confidence: str
    start: int
    end: int

class PolicyContext:
    """Position of a finding, passed to a policy callback."""

    finding_index: int
    finding_count: int

class Finding:
    """Immutable, policy-evaluated finding: safe metadata plus the action."""

    id: str
    type: str
    detector: str
    confidence: str
    action: str
    start: int
    end: int

class PlaceholderContext:
    """Position of a replaced finding, passed to a formatter callback."""

    placeholder_index: int

class ScanResult:
    """The result of scan_and_redact(): redacted text and its findings."""

    text: str
    findings: list[Finding]

# ---------------------------------------------------------------------
# Callback protocols
# ---------------------------------------------------------------------

Policy = Callable[[DetectedFinding, PolicyContext], str]
Formatter = Callable[[Finding, PlaceholderContext], str]

# ---------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------

def version() -> str: ...
def byte_offset_to_char_offset(text: str, byte_offset: int) -> int: ...
def scan(text: str, policy: Policy | None = None) -> list[Finding]: ...
def redact(
    text: str, findings: list[Finding], formatter: Formatter | None = None
) -> str: ...
def scan_and_redact(
    text: str,
    policy: Policy | None = None,
    formatter: Formatter | None = None,
) -> ScanResult: ...
def default_policy(finding: DetectedFinding, context: PolicyContext) -> str: ...
def default_placeholder_formatter(
    finding: Finding, context: PlaceholderContext
) -> str: ...
def typed_placeholder_formatter(
    finding: Finding, context: PlaceholderContext
) -> str: ...
