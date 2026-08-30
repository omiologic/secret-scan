# secret-scan agent instructions

## Required context

1. Read `README.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, and `_notes/GOVERNANCE.md` before making material changes.
2. Use `.agents/skills/context-governance/SKILL.md` for governed planning, Decisions, Conventions, Constraints, Git policy, and Version policy.
3. Keep changes within the deterministic secret-detection and redaction boundary described by the architecture.

## Security boundary

- Never place real credentials in source, fixtures, logs, errors, snapshots, documentation, or agent context. Use unmistakably synthetic or revoked examples.
- Findings and diagnostics must not expose plaintext secret values.
- Keep the core side-effect free: no runtime network access, telemetry, secret storage, or environment-dependent behavior.
- Treat client-side scanning as preventive UX and server-side scanning as the authoritative enforcement boundary.

## Change rules

- Preserve browser and Node.js compatibility and keep the public API runtime-neutral.
- Keep detection separate from policy enforcement; additions should state their false-positive and false-negative tradeoffs.
- Add deterministic tests for detector, redaction, overlap-resolution, or policy behavior changes.
- Follow `_notes/GOVERNANCE.md` for branch, commit, review, merge, version, and changelog policy. Governance declarations do not authorize Git or release operations.

## Release authority

A release requires explicit user approval after tests pass and the public API and changelog have been reviewed. Do not choose a version, create a tag or release, publish a package, or deploy without that approval.
