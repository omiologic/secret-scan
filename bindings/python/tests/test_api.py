"""General API behavior: immutable types, `scan`/`redact`/`scan_and_redact`
agreement, and determinism (`decision-define-runtime-bindings`:
"Identical input and configuration always produce identical findings.")."""

from __future__ import annotations

import pytest

import secret_scan

SYNTHETIC_INPUT = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000"


def test_finding_has_no_public_constructor() -> None:
    with pytest.raises(TypeError):
        secret_scan.Finding()  # type: ignore[call-arg]


def test_finding_attributes_are_read_only() -> None:
    finding = secret_scan.scan(SYNTHETIC_INPUT)[0]
    with pytest.raises(AttributeError):
        finding.action = "block"  # type: ignore[misc]
    with pytest.raises(AttributeError):
        finding.start = 0  # type: ignore[misc]


def test_scan_and_redact_agrees_with_separate_scan_and_redact_calls() -> None:
    findings = secret_scan.scan(SYNTHETIC_INPUT)
    redacted = secret_scan.redact(SYNTHETIC_INPUT, findings)

    result = secret_scan.scan_and_redact(SYNTHETIC_INPUT)

    assert result.text == redacted
    assert [(f.id, f.type, f.detector, f.confidence, f.action, f.start, f.end) for f in result.findings] == [
        (f.id, f.type, f.detector, f.confidence, f.action, f.start, f.end) for f in findings
    ]


@pytest.mark.parametrize(
    "text",
    [
        SYNTHETIC_INPUT,
        "no secrets here",
        "",
        "🔑 API_KEY=ghp_SYNTHETICREVOKED00000000000000000000",
    ],
)
def test_repeated_scan_and_redact_is_deterministic(text: str) -> None:
    def summary(findings: list[secret_scan.Finding]) -> list[tuple]:
        return [(f.id, f.type, f.detector, f.confidence, f.action, f.start, f.end) for f in findings]

    first = secret_scan.scan(text)
    second = secret_scan.scan(text)
    assert summary(first) == summary(second)

    assert secret_scan.redact(text, first) == secret_scan.redact(text, second)


def test_invalid_input_type_raises_invalid_input_error() -> None:
    with pytest.raises(secret_scan.InvalidInputError) as excinfo:
        secret_scan.scan(12345)  # type: ignore[arg-type]
    assert excinfo.value.code == "INVALID_INPUT"


def test_empty_input_produces_no_findings() -> None:
    assert secret_scan.scan("") == []
    assert secret_scan.redact("", []) == ""


def test_redact_rejects_overlapping_findings() -> None:
    """`scan` never returns overlapping findings for one text, so the only
    way to reach this through the public API is a caller-assembled list
    that repeats a finding - here, deliberately, to prove `redact` still
    validates its input rather than trusting whatever it is given."""
    findings = secret_scan.scan(SYNTHETIC_INPUT)
    assert findings
    with pytest.raises(secret_scan.InvalidFindingsError) as excinfo:
        secret_scan.redact(SYNTHETIC_INPUT, [findings[0], findings[0]])
    assert excinfo.value.code == "INVALID_FINDINGS"


def test_findings_are_returned_in_input_order() -> None:
    text = "Bearer SYNTHETIC_REVOKED_BEARER_VALUE\napi_key=SYNTHETIC_REVOKED_CONTEXT_VALUE"
    findings = secret_scan.scan(text)
    starts = [f.start for f in findings]
    assert starts == sorted(starts)
