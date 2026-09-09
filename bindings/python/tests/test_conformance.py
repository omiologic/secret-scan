"""Synchronous conformance and Unicode range tests.

Runs the full canonical corpus (`decision-govern-cross-language-
conformance`) through `secret_scan.scan`, converting each expectation's
canonical UTF-8 byte offsets to Python code point offsets with an
independent reference conversion (not the binding under test), and asserts
`scan`'s detector/type/confidence/span output matches exactly.

Every fixture input is synthetic or explicitly revoked
(`conformance/README.md`); none embeds a live credential.
"""

from __future__ import annotations

import pytest

import secret_scan

from .conftest import byte_offset_to_char_offset_reference, load_corpus


def _expected_tuples(text: str, expected: list[dict]) -> list[tuple]:
    tuples = []
    for item in expected:
        start = byte_offset_to_char_offset_reference(text, item["start"])
        end = byte_offset_to_char_offset_reference(text, item["end"])
        tuples.append((item["detector"], item["type"], item["confidence"], start, end))
    return tuples


def _actual_tuples(findings: list[secret_scan.Finding]) -> list[tuple]:
    return [(f.detector, f.type, f.confidence, f.start, f.end) for f in findings]


def _synchronous_fixtures() -> list[dict]:
    corpus = load_corpus("synchronous-corpus.json")
    assert corpus["offsetUnit"] == "utf8-byte"
    # "not-yet-evaluated" fixtures carry no `expected` value (`null`) and
    # document a future gap, not a current behavioral contract.
    return [f for f in corpus["fixtures"] if f["support"] != "not-yet-evaluated"]


@pytest.mark.parametrize(
    "fixture",
    _synchronous_fixtures(),
    ids=lambda fixture: fixture["id"],
)
def test_scan_matches_the_canonical_synchronous_corpus(fixture: dict) -> None:
    text = fixture["input"]
    findings = secret_scan.scan(text)
    assert _actual_tuples(findings) == _expected_tuples(text, fixture["expected"])


def test_synchronous_corpus_is_not_vacuous() -> None:
    """Guards against every fixture being skipped by accident, which would
    make the parametrized test above pass without checking anything."""
    fixtures = _synchronous_fixtures()
    assert len(fixtures) >= 100
    assert any(f["expected"] for f in fixtures)
    assert any(not f["expected"] for f in fixtures)


def _unicode_fixtures() -> list[dict]:
    corpus = load_corpus("unicode-conversion-corpus.json")
    assert corpus["offsetUnit"] == "utf8-byte"
    return corpus["fixtures"]


@pytest.mark.parametrize(
    "fixture",
    _unicode_fixtures(),
    ids=lambda fixture: fixture["id"],
)
def test_unicode_astral_ranges_convert_to_exact_code_point_offsets(
    fixture: dict,
) -> None:
    """An astral (supplementary-plane) character positioned before, within,
    and after a finding must not perturb the selected code point span:
    every code point counts as one unit regardless of plane."""
    text = fixture["input"]
    expected = fixture["expected"][0]
    start = byte_offset_to_char_offset_reference(text, expected["start"])
    end = byte_offset_to_char_offset_reference(text, expected["end"])

    assert secret_scan._native.byte_offset_to_char_offset(text, expected["start"]) == start
    assert secret_scan._native.byte_offset_to_char_offset(text, expected["end"]) == end
