"""Placeholder safety tests: `redact`'s formatter output is validated the
same way regardless of whether the formatter is the built-in default, the
built-in typed formatter, or a custom Python callable - an empty, oversized,
or matched-value-reproducing placeholder is always rejected before it can
reach the output."""

from __future__ import annotations

import pytest

import secret_scan


def test_default_formatter_never_reproduces_input_and_is_deterministic() -> None:
    text = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000"
    findings = secret_scan.scan(text)
    redacted = secret_scan.redact(text, findings)
    assert "ghp_SYNTHETICREVOKED00000000000000000000" not in redacted
    assert redacted == secret_scan.redact(text, findings)


def test_typed_formatter_names_the_finding_type() -> None:
    text = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000"
    findings = secret_scan.scan(text)
    redacted = secret_scan.redact(
        text, findings, formatter=secret_scan.typed_placeholder_formatter
    )
    assert "<GITHUB_TOKEN_1>" in redacted


def test_custom_formatter_reproducing_a_matched_value_is_rejected() -> None:
    text = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000"
    findings = secret_scan.scan(text)

    def reproducing(
        finding: secret_scan.Finding, context: secret_scan.PlaceholderContext
    ) -> str:
        return text[finding.start : finding.end]

    with pytest.raises(secret_scan.InvalidPlaceholderError) as excinfo:
        secret_scan.redact(text, findings, formatter=reproducing)
    assert excinfo.value.code == "INVALID_PLACEHOLDER"


def test_custom_formatter_empty_placeholder_is_rejected() -> None:
    text = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000"
    findings = secret_scan.scan(text)

    def empty(
        finding: secret_scan.Finding, context: secret_scan.PlaceholderContext
    ) -> str:
        return ""

    with pytest.raises(secret_scan.InvalidPlaceholderError):
        secret_scan.redact(text, findings, formatter=empty)


def test_custom_formatter_oversized_placeholder_is_rejected() -> None:
    text = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000"
    findings = secret_scan.scan(text)

    def oversized(
        finding: secret_scan.Finding, context: secret_scan.PlaceholderContext
    ) -> str:
        return "x" * 257

    with pytest.raises(secret_scan.InvalidPlaceholderError):
        secret_scan.redact(text, findings, formatter=oversized)


def test_repeated_findings_redact_deterministically() -> None:
    text = "API_KEY=ghp_SYNTHETICREVOKED00000000000000000000\nAKIASYNTHETICEXAMPLE"
    findings = secret_scan.scan(text)
    assert [f.action for f in findings] == ["redact", "redact"]
    first = secret_scan.redact(text, findings)
    second = secret_scan.redact(text, findings)
    assert first == second
    assert "ghp_SYNTHETICREVOKED00000000000000000000" not in first
    assert "AKIASYNTHETICEXAMPLE" not in first


def test_warn_and_allow_findings_pass_through_unredacted() -> None:
    text = "possible_id=deadbeef"
    findings = secret_scan.scan(text)
    for finding in findings:
        assert finding.action in {"warn", "allow", "redact", "block"}
    redacted = secret_scan.redact(text, findings)
    kept = [f for f in findings if f.action in {"warn", "allow"}]
    for finding in kept:
        assert text[finding.start : finding.end] in redacted
