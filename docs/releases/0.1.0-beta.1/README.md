# 0.1.0-beta.1 release evidence

Published on 2026-09-11 from `rc/0.1.0-beta.1`, using original qualified source
`7bbd345be0604b8c3d50335985e0bfbbbe3703c9`. All eight npm packages, both Rust
crates, and the Python distribution are published. Python spells this version
`0.1.0b1`; npm and Cargo use `0.1.0-beta.1`.

[Release run 34628543780](https://github.com/redact-secret/redact-secret/actions/runs/34628543780)
passed all 60 qualification jobs before publication.
[Final recovery run 34631854605](https://github.com/redact-secret/redact-secret/actions/runs/34631854605)
verified existing registry checksums, skipped all existing publications, and
passed clean registry installs on all six Node platforms and Chromium. After
those checks passed, the annotated `v0.1.0-beta.1` tag was created on that
original source using the authorized operator’s Git credentials: the Actions
token received HTTP 403 when creating the tag reference. No repository rules
were bypassed. The tag job was retried to verify the existing tag’s type and
exact target.

## Recovery history

The first attempt published all nine Python distribution files. After the user
verified the crates.io account email and requested retry, the core crate also
published. npm initially rejected package creation with the old token, and the
CLI was skipped because the core's HTTP verification used an unidentified curl
User-Agent, which crates.io rejected with HTTP 403.

The workflow also wrote multiline JSON to `GITHUB_OUTPUT`, causing successful
publication to be reported as a job failure and breaking the manifest job.
[manifest.json](manifest.json) reconstructs the registry state and records every
recovery run; it is explicitly marked as reconstructed, not an artifact that the
failed manifest job created. [artifact-inventory.json](artifact-inventory.json)
is the original run's inventory. All nine published Python file hashes match it
exactly, and every recovered native/Wasm artifact was checked against that
inventory before publication. Both crates were packed from a clean worktree at
the original source; the npm facade was built and packed from that same source.

[Dry run 34630571596](https://github.com/redact-secret/redact-secret/actions/runs/34630571596)
passed. After replacing the npm token,
[run 34630772391](https://github.com/redact-secret/redact-secret/actions/runs/34630772391)
published the first native dependency but encountered delayed aggregate npm
metadata. The exact-version endpoint already exposed its matching checksum.
The registry reader now uses that endpoint and fails closed on non-404 errors,
wrong identities, or missing checksums.

[Run 34631336326](https://github.com/redact-secret/redact-secret/actions/runs/34631336326)
completed publication of all remaining packages. Initial registry installs
encountered delayed optional-dependency metadata on Linux/macOS x64, and the
Windows verification script could not execute `npm.cmd` directly. The final
run used the corrected verification script with the original source fixtures;
all seven install lanes passed once metadata was available.

Tooling repairs did not change the source revision or replace already published
artifacts. Release changes return to `main` through a reviewed PR, following the
[contribution graph](../../../CONTRIBUTION.md#branching-strategy).
