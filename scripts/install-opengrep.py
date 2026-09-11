#!/usr/bin/env python3
"""Install the pinned OpenGrep binary, verifying it closed against
`sast/opengrep.lock.json` before it is ever executed (issue #155).

Every install downloads exactly the release asset, `.sig`, and `.cert`
named for the host platform in the lock file, and requires **both**:

- the downloaded binary's SHA-256 matches the pinned digest, and
- `cosign verify-blob` accepts the `.sig`/`.cert` pair against the pinned
  Sigstore identity (a GitHub Actions OIDC workflow identity belonging to
  `opengrep/opengrep`, not a long-lived key -- OpenGrep releases are signed
  keylessly through Sigstore's Fulcio/Rekor, so there is no static public key
  to pin instead).

Either check failing raises `VerificationFailed` and leaves no binary at its
final cache path: a half-verified binary is the same risk as an unverified
one, so this never lets one through. If `cosign` itself is not on `PATH`,
that is also a verification failure -- there is no fallback that skips
provenance checking, because a checksum alone only proves the bytes match
*something*, not that the something was OpenGrep's own release process.

A binary already present in the cache at its expected path is reused only
after its SHA-256 is rechecked against the lock file; a tampered or stale
cache entry is deleted and re-fetched rather than trusted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import stat
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Callable

DEFAULT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOCK = DEFAULT_ROOT / "sast" / "opengrep.lock.json"
DEFAULT_CACHE_DIR = DEFAULT_ROOT / ".cache" / "opengrep"

Downloader = Callable[[str], bytes]
CosignRunner = Callable[[list[str]], "subprocess.CompletedProcess[str]"]


class VerificationFailed(Exception):
    """An artifact failed an integrity or provenance check. Fail closed: never install."""


def load_lock(path: Path = DEFAULT_LOCK) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def detect_platform_key() -> str:
    """Map the running host to a key in the lock file's `binaries` map.

    Linux glibc vs musl is distinguished with `os.confstr("CS_GNU_LIBC_VERSION")`,
    which only glibc defines; its absence (or this function raising at all,
    which musl's libc does) means musl.
    """
    system = platform.system()
    machine = platform.machine().lower()
    if system == "Darwin" and machine in ("arm64", "aarch64"):
        return "macos-arm64"
    if system == "Linux" and machine in ("x86_64", "amd64"):
        try:
            is_glibc = os.confstr("CS_GNU_LIBC_VERSION") is not None
        except (OSError, ValueError, AttributeError):
            is_glibc = False
        return "linux-x86_64-gnu" if is_glibc else "linux-x86_64-musl"
    raise VerificationFailed(
        f"no pinned OpenGrep binary for platform {system}/{machine}; "
        "add a reviewed entry to sast/opengrep.lock.json before scanning on this host"
    )


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def urllib_downloader(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310 -- fixed GitHub release host
        return response.read()


def real_cosign_runner(args: list[str]) -> "subprocess.CompletedProcess[str]":
    return subprocess.run(args, capture_output=True, text=True, timeout=60)


def verify_signature(
    *,
    binary_path: Path,
    cert_path: Path,
    sig_path: Path,
    signing: dict,
    cosign_bin: str,
    runner: CosignRunner,
) -> None:
    try:
        result = runner(
            [
                cosign_bin,
                "verify-blob",
                "--certificate",
                str(cert_path),
                "--signature",
                str(sig_path),
                "--certificate-identity-regexp",
                signing["certificate_identity_regexp"],
                "--certificate-oidc-issuer",
                signing["oidc_issuer"],
                str(binary_path),
            ]
        )
    except FileNotFoundError as error:
        raise VerificationFailed(
            f"'{cosign_bin}' is not installed; cannot verify OpenGrep's provenance, "
            "refusing to install an unverified binary"
        ) from error
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise VerificationFailed(f"cosign rejected the OpenGrep binary's signature/provenance: {detail}")


def install(
    *,
    lock: dict,
    platform_key: str,
    cache_dir: Path,
    downloader: Downloader,
    cosign_runner: CosignRunner,
    cosign_bin: str = "cosign",
) -> Path:
    """Download, verify, and cache the pinned OpenGrep binary for `platform_key`.

    Returns the path to a verified, executable binary. Raises
    `VerificationFailed` -- and leaves nothing usable at the final path --
    on any checksum or signature mismatch.
    """
    entry = lock["binaries"].get(platform_key)
    if entry is None:
        raise VerificationFailed(f"sast/opengrep.lock.json has no pinned binary for platform '{platform_key}'")

    version = lock["opengrep_version"]
    asset = entry["asset"]
    base_url = f"https://github.com/opengrep/opengrep/releases/download/v{version}"

    dest_dir = cache_dir / version / platform_key
    dest_dir.mkdir(parents=True, exist_ok=True)
    final_path = dest_dir / "opengrep"

    if final_path.is_file():
        if sha256_hex(final_path.read_bytes()) == entry["sha256"]:
            return final_path
        final_path.unlink()

    binary_bytes = downloader(f"{base_url}/{asset}")
    actual_sha = sha256_hex(binary_bytes)
    if actual_sha != entry["sha256"]:
        raise VerificationFailed(
            f"{asset}: sha256 mismatch (pinned {entry['sha256']}, downloaded {actual_sha}); refusing to install"
        )

    cert_bytes = downloader(f"{base_url}/{asset}.cert")
    sig_bytes = downloader(f"{base_url}/{asset}.sig")

    tmp_path = dest_dir / f".{asset}.tmp"
    cert_path = dest_dir / f"{asset}.cert"
    sig_path = dest_dir / f"{asset}.sig"
    tmp_path.write_bytes(binary_bytes)
    cert_path.write_bytes(cert_bytes)
    sig_path.write_bytes(sig_bytes)
    try:
        verify_signature(
            binary_path=tmp_path,
            cert_path=cert_path,
            sig_path=sig_path,
            signing=lock["signing"],
            cosign_bin=cosign_bin,
            runner=cosign_runner,
        )
    except VerificationFailed:
        tmp_path.unlink(missing_ok=True)
        raise
    finally:
        cert_path.unlink(missing_ok=True)
        sig_path.unlink(missing_ok=True)

    tmp_path.chmod(tmp_path.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    tmp_path.replace(final_path)
    return final_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else "")
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument("--platform", default=None, help="override the auto-detected platform key")
    parser.add_argument("--cosign-bin", default="cosign")
    args = parser.parse_args(argv)

    lock = load_lock(args.lock)
    platform_key = args.platform or detect_platform_key()
    try:
        path = install(
            lock=lock,
            platform_key=platform_key,
            cache_dir=args.cache_dir,
            downloader=urllib_downloader,
            cosign_runner=real_cosign_runner,
            cosign_bin=args.cosign_bin,
        )
    except VerificationFailed as error:
        print(f"FAIL-CLOSED: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"platform": platform_key, "version": lock["opengrep_version"], "path": str(path)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
