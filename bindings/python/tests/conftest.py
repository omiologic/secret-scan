"""Shared fixtures for the secret_scan test suite.

Loads canonical fixtures from the top-level, language-neutral `conformance/`
corpus (`decision-govern-cross-language-conformance`) rather than
duplicating them, so this suite always exercises the same behavioral
contract as the Rust core and every other binding.

Also holds the incremental-session helpers the lifecycle and partition
suites share: a generous limit set, a one-append-per-chunk session driver,
and the Python-native (code point) partitions of a string.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
CONFORMANCE_DIR = REPO_ROOT / "conformance" / "fixtures"


def load_corpus(name: str) -> dict[str, Any]:
    """Loads a canonical fixture file by name (e.g. "synchronous-corpus.json")."""
    path = CONFORMANCE_DIR / name
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def byte_offset_to_char_offset_reference(text: str, byte_offset: int) -> int:
    """Independently converts a canonical UTF-8 byte offset to a Python
    Unicode code point offset, without using the extension under test, so
    conformance assertions do not validate the binding against itself."""
    encoded = text.encode("utf-8")
    return len(encoded[:byte_offset].decode("utf-8"))


# ---------------------------------------------------------------------
# Incremental session helpers
# ---------------------------------------------------------------------

# Limits generous enough that no canonical incremental fixture reaches one,
# so a partition difference can never be masked by a limit failure. Mirrors
# `crates/secret-scan-core/tests/support::generous_limits`.
GENEROUS_LIMITS = {
    "max_input_bytes": 1_000_000,
    "max_buffered_bytes": 16_512,
    "max_token_bytes": 8_192,
    "max_multiline_bytes": 16_384,
}


def generous_limits() -> Any:
    """A fresh `IncrementalLimits` no corpus fixture can reach."""
    import secret_scan

    return secret_scan.IncrementalLimits(**GENEROUS_LIMITS)


def run_session(chunks: Sequence[str], limits: Any | None = None) -> tuple[str, list[Any]]:
    """Runs `chunks` through one session - one `append` each, then one
    `finalize` - and returns the concatenated text and findings."""
    import secret_scan

    session = secret_scan.IncrementalSanitizer(limits or generous_limits())
    text = ""
    findings: list[Any] = []
    for chunk in chunks:
        result = session.append(chunk)
        text += result.text
        findings.extend(result.findings)
    result = session.finalize()
    text += result.text
    findings.extend(result.findings)
    return text, findings


def code_point_partitions(text: str) -> list[list[str]]:
    """Every two-piece split of `text` at a Python code point boundary,
    which is the only partition a `str` can be cut at."""
    return [[text[:index], text[index:]] for index in range(len(text) + 1)]


def single_code_point_partition(text: str) -> list[str]:
    """`text` split into one chunk per code point: the finest partition a
    Python caller can produce."""
    return list(text)
