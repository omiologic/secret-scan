# Repository transfer runbook (prepared, not applied)

`decision-adopt-redact-secret-naming-contract` and issue #152 prepare this
repository's source, manifests, and tooling for the `Redact Secret` identity
while deliberately leaving `repository`/`homepage`/`bugs` fields, and every
GitHub URL in current documentation, pointed at `github.com/omiologic/secret-scan`.
That is not an oversight: the transfer to `redact-secret/redact-secret` is a
separately authorized action issue #157 alone owns, and pointing manifest
metadata at a path that is not yet live would publish a dead link.

This document only prepares the checklist for that transfer. It does not
transfer the repository, mutate the placeholder at
`redact-secret/redact-secret`, or change any manifest URL. Performing the
transfer is a separate, explicitly authorized action, just as a release is
(`AGENTS.md`, "Release authority"). Nothing here performs it.

## Pre-transfer checklist

- **Registry names are finalized and available.** `decision-adopt-redact-secret-naming-contract`
  records the accepted matrix and dated availability evidence.
  `scripts/verify-release-governance.py --check-repo --npm ... --crate ...
  --pypi ...` (wired as `npm run registry-preflight:check`, part of
  `npm run release:check`) rechecks all of it — npm, crates.io, PyPI, and the
  GitHub placeholder — immediately before a release candidate's sign-off, so
  any conflict found since 2026-09-10 blocks readiness rather than reusing
  stale evidence.
- **The placeholder repository is confirmed, not assumed.** Issue #151's
  evidence records that `redact-secret/redact-secret` is an empty public
  repository the project operator already owns. This secures the target
  path; it is not the canonical source repository, and this runbook does not
  change that.
- **Every manifest URL that still says `omiologic/secret-scan` is accounted
  for, not just left behind.** `Cargo.toml`'s `repository`/`homepage`, every
  `package.json`'s `repository`/`homepage`/`bugs`, `bindings/python/pyproject.toml`'s
  `[project.urls]`, and `conformance/schema.json`'s `$id` all still name the
  current path — deliberately, per the naming contract's own scope boundary.
  The post-transfer checklist below is what actually moves them.
- **`.codex/rules/git.rules` and `.agents/skills/review-pr/SKILL.md`** name a
  `secret-scan.wiki` sibling checkout tied to the current repository name.
  `scripts/check-legacy-identifiers.py` allowlists that reference for the
  same reason: it moves only when the transfer below actually happens.

## The transfer itself (out of scope here; issue #157's own action)

Performed by a repository administrator, not by any script or workflow in
this repository:

1. GitHub → repository **Settings** → **General** → **Transfer ownership** →
   destination `redact-secret/redact-secret`.
2. Confirm the destination path's existing empty placeholder is overwritten
   by the transfer, not left as a separate repository the transferred one
   must then be merged into.
3. Confirm matching organization issue types, branch protection rules,
   environments (`release`), and repository secrets survive the transfer or
   are recreated at the destination before any release workflow runs there.
4. Confirm npm's and PyPI's Trusted Publisher configurations (OIDC), which
   are typically bound to a specific `owner/repo` and workflow path, are
   re-pointed at the new repository coordinates — a transfer alone does not
   update a registry's side of that binding.

## Post-transfer follow-up (a separate, later change)

Once the transfer above has actually happened:

- Update `repository`/`homepage`/`bugs` in every manifest listed above, and
  `conformance/schema.json`'s `$id`, from `github.com/omiologic/secret-scan`
  to `github.com/redact-secret/redact-secret`.
- Update `scripts/verify-release-governance.py`'s `--repo` default and every
  current-documentation GitHub link (`README.md`, `ARCHITECTURE.md`,
  `SECURITY.md`, `docs/rust-workspace.md`, package READMEs) to the new path.
  GitHub's own redirect keeps old issue/PR/commit links working, so links
  inside `docs/audits/` and other allowlisted historical records do not need
  rewriting.
- Update `.codex/rules/git.rules` and `.agents/skills/review-pr/SKILL.md`'s
  `secret-scan.wiki` sibling-checkout references to whatever the transferred
  repository's own wiki path becomes, and remove the now-stale allowlist
  entry from `scripts/check-legacy-identifiers.py`.
- Apply the prepared redirect in
  [docs/python-repository-redirect.md](./python-repository-redirect.md) for
  the separate `secret-scan-python` repository, if that has not already
  happened — it is independent of this transfer and follows its own
  authorization.

No release, tag, publication, deployment, or archival is authorized by this
document. Performing the transfer, and every change listed under
"Post-transfer follow-up," requires the separate approval repository
governance defines.
