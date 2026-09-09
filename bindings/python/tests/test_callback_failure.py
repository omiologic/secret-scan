"""Callback failure tests.

A `policy` or `formatter` callback only ever receives safe metadata
(`test_typing.py::test_finding_and_context_types_expose_documented_attributes`
and the parameter names asserted below cover what it receives). This file
asserts the other half of the contract: whatever a callback does wrong -
raising, returning a bad type, or returning a value the core rejects -
never lets the callback's own error, message, or the scanned input escape.
Every raised exception is a fixed, documented `SecretScanError` subclass.
"""

from __future__ import annotations

import pytest

import secret_scan

SYNTHETIC_INPUT = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000"


@pytest.fixture
def findings() -> list[secret_scan.Finding]:
    return secret_scan.scan(SYNTHETIC_INPUT)


def test_policy_exception_becomes_policy_failure_error(
    findings: list[secret_scan.Finding],
) -> None:
    def raising_policy(
        finding: secret_scan.DetectedFinding, context: secret_scan.PolicyContext
    ) -> str:
        raise ValueError(f"leak: {SYNTHETIC_INPUT}")

    with pytest.raises(secret_scan.PolicyFailureError) as excinfo:
        secret_scan.scan(SYNTHETIC_INPUT, policy=raising_policy)

    assert excinfo.value.code == "POLICY_FAILURE"
    assert SYNTHETIC_INPUT not in str(excinfo.value)
    assert "leak" not in str(excinfo.value)


def test_policy_non_string_return_becomes_invalid_policy_action_error() -> None:
    def bad_return_type(
        finding: secret_scan.DetectedFinding, context: secret_scan.PolicyContext
    ) -> int:
        return 1

    with pytest.raises(secret_scan.InvalidPolicyActionError) as excinfo:
        secret_scan.scan(SYNTHETIC_INPUT, policy=bad_return_type)  # type: ignore[arg-type]
    assert excinfo.value.code == "INVALID_POLICY_ACTION"


@pytest.mark.parametrize("action", ["delete", "", "REDACT", " redact"])
def test_policy_unrecognized_action_becomes_invalid_policy_action_error(
    action: str,
) -> None:
    def unrecognized_action(
        finding: secret_scan.DetectedFinding, context: secret_scan.PolicyContext
    ) -> str:
        return action

    with pytest.raises(secret_scan.InvalidPolicyActionError):
        secret_scan.scan(SYNTHETIC_INPUT, policy=unrecognized_action)


def test_policy_callback_only_receives_safe_metadata(
    findings: list[secret_scan.Finding],
) -> None:
    seen: dict = {}

    def inspecting_policy(
        finding: secret_scan.DetectedFinding, context: secret_scan.PolicyContext
    ) -> str:
        seen["finding"] = finding
        seen["context"] = context
        return "warn"

    secret_scan.scan(SYNTHETIC_INPUT, policy=inspecting_policy)

    finding = seen["finding"]
    assert not hasattr(finding, "action")
    assert not hasattr(finding, "value")
    assert not hasattr(finding, "text")
    assert isinstance(finding.id, str)
    assert isinstance(seen["context"].finding_index, int)
    assert isinstance(seen["context"].finding_count, int)


def test_policy_can_delegate_to_default_policy(
    findings: list[secret_scan.Finding],
) -> None:
    def wraps_default(
        finding: secret_scan.DetectedFinding, context: secret_scan.PolicyContext
    ) -> str:
        return secret_scan.default_policy(finding, context)

    delegated = secret_scan.scan(SYNTHETIC_INPUT, policy=wraps_default)
    default = secret_scan.scan(SYNTHETIC_INPUT)
    assert [f.action for f in delegated] == [f.action for f in default]


def test_formatter_exception_becomes_placeholder_failure_error(
    findings: list[secret_scan.Finding],
) -> None:
    def raising_formatter(
        finding: secret_scan.Finding, context: secret_scan.PlaceholderContext
    ) -> str:
        raise ValueError(f"leak: {SYNTHETIC_INPUT}")

    with pytest.raises(secret_scan.PlaceholderFailureError) as excinfo:
        secret_scan.redact(SYNTHETIC_INPUT, findings, formatter=raising_formatter)

    assert excinfo.value.code == "PLACEHOLDER_FAILURE"
    assert SYNTHETIC_INPUT not in str(excinfo.value)
    assert "leak" not in str(excinfo.value)


def test_formatter_non_string_return_becomes_placeholder_failure_error(
    findings: list[secret_scan.Finding],
) -> None:
    def bad_return_type(
        finding: secret_scan.Finding, context: secret_scan.PlaceholderContext
    ) -> int:
        return 42

    with pytest.raises(secret_scan.PlaceholderFailureError):
        secret_scan.redact(
            SYNTHETIC_INPUT, findings, formatter=bad_return_type  # type: ignore[arg-type]
        )


def test_formatter_callback_only_receives_safe_metadata(
    findings: list[secret_scan.Finding],
) -> None:
    seen: dict = {}

    def inspecting_formatter(
        finding: secret_scan.Finding, context: secret_scan.PlaceholderContext
    ) -> str:
        seen["finding"] = finding
        seen["context"] = context
        return "<REDACTED>"

    secret_scan.redact(SYNTHETIC_INPUT, findings, formatter=inspecting_formatter)

    finding = seen["finding"]
    assert not hasattr(finding, "value")
    assert not hasattr(finding, "text")
    assert isinstance(finding.action, str)
    assert isinstance(seen["context"].placeholder_index, int)


def test_formatter_can_delegate_to_default_formatters(
    findings: list[secret_scan.Finding],
) -> None:
    def wraps_typed(
        finding: secret_scan.Finding, context: secret_scan.PlaceholderContext
    ) -> str:
        return secret_scan.typed_placeholder_formatter(finding, context)

    delegated = secret_scan.redact(SYNTHETIC_INPUT, findings, formatter=wraps_typed)
    direct = secret_scan.redact(
        SYNTHETIC_INPUT, findings, formatter=secret_scan.typed_placeholder_formatter
    )
    assert delegated == direct
