"""Shared fixtures for the secret_scan test suite.

Loads canonical fixtures from the top-level, language-neutral `conformance/`
corpus (`decision-govern-cross-language-conformance`) rather than
duplicating them, so this suite always exercises the same behavioral
contract as the Rust core and every other binding.
"""

from __future__ import annotations

import json
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
