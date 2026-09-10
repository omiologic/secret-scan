# Release approval and registry-publisher prerequisites — evidence

Evidence for issue #143, sub-issue of Feature #138 ("Complete first-release
operational readiness") and the direct successor to `RB-8` (issue #78).

- **Recorded on:** 2026-09-10, at `ce7f45e`.
- **Tracked by:** [#143](https://github.com/omiologic/secret-scan/issues/143).
- **Status:** two acceptance criteria are code, closed by this change; three
  are live repository-settings or registry-account state, which this change
  cannot deliver and instead records honestly as not yet in place.
- **Authority:** this document records evidence and adds verification
  tooling. It does not apply a GitHub branch-protection or
  environment-protection setting, publish a package, or configure a
  registry's Trusted Publisher. Nothing here authorizes a release; a release
  still requires the explicit approval `AGENTS.md`'s release authority
  section mandates.

## What this change closes

1. **`Release` and `Reconcile Release` share a protected environment.**
   Already true in code (`environment: name: release` in both), and already
   enforced by `scripts/check-release-environment.py`.
2. **Both workflows reject non-`main` refs.** True in code, but until now
   unenforced — nothing failed the build if a new publish job shipped
   without its `if: github.ref != 'refs/heads/main'` guard.
   `scripts/check-release-refs.py` (wired into `npm run ci` as
   `release-refs:check`) closes that gap statically, the same way
   `check-release-gate.py` pins the qualification `needs:` graph.
3. **A read-only evidence tool**, `scripts/verify-release-governance.py`,
   that reads live GitHub environment/branch protection (via the `gh` CLI)
   and public npm/crates.io/PyPI metadata, and prints only safe fields —
   setting names, identities, timestamps, API results — never a token or
   credential. It is deliberately **not** wired into `npm run ci`: the
   GitHub half needs an authenticated admin session and the registry halves
   need the actual publishing identities' credentials to mean anything
   beyond "does this name already exist", neither of which CI should hold.

## What this change cannot close

The remaining acceptance criteria are live repository-settings or
registry-account state. `RB-8` said this already for the GitHub half: "these
are repository-settings changes, not code, and no pull request can deliver
them; they need an account with admin on `omiologic/secret-scan`." The same
is true, for the same reason, of the registry half — publishing rights and
Trusted Publisher configuration live on npm, crates.io, and PyPI accounts,
not in this repository.

## Live evidence, `ce7f45e`, 2026-09-10T22:12:21Z

Produced by:

```bash
python3 -B scripts/verify-release-governance.py \
  --npm "@omiologic/secret-scan" \
  --crate secret-scan --crate secret-scan-cli \
  --pypi omiologic-secret-scan
```

| Check | Result |
|---|---|
| `github-environment release` | exists; `has_required_reviewers: false`; `can_admins_bypass: true`; `deployment_branch_policy: null` |
| `github-branch main` | `protected: false` |
| `npm @omiologic/secret-scan` | `exists: false` (nothing published yet) |
| `crate secret-scan` | `exists: false` |
| `crate secret-scan-cli` | `exists: false` |
| `pypi omiologic-secret-scan` | `exists: false`; Trusted Publisher configuration is not queryable via a public API |

No plaintext secret, token, or credential appears above or in the tool that
produced it — every field is a boolean, a name, or an identity.

## Required human action

Unchanged from `RB-8`'s own note on who can do this, extended to the
registry half issue #143 adds:

- **GitHub, an account with admin on `omiologic/secret-scan`:**
  - Add a required-reviewer protection rule to the `release` environment,
    set `can_admins_bypass` to `false` unless explicitly accepted otherwise,
    and set a deployment-branch policy limited to `main`.
  - Protect `main` with required pull-request review and the required status
    checks the release contract names (the qualification jobs
    `scripts/check-release-gate.py` already pins in `release.yml`'s
    `needs:` graph).
- **npm, an account with publish rights on the `@omiologic` org:** confirm
  the identity behind CI's `NPM_TOKEN` can publish
  `@omiologic/secret-scan` and any other required package, via
  `npm access ls-collaborators` or the npm website — this script cannot
  determine that without authenticating as that identity.
- **crates.io, an account holding `CARGO_REGISTRY_TOKEN`:** confirm that
  identity owns `secret-scan` and `secret-scan-cli` if they already exist,
  or that the names are free for a first publish (both report
  `exists: false` above, so today either is available).
- **PyPI, an account with admin on the `omiologic-secret-scan` project (or
  able to create it):** configure Trusted Publishing for this repository,
  the `release.yml` workflow, and the `release` environment, from the
  project's "Manage -> Publishing" page — no API can verify this from
  outside PyPI's account system.

Re-running `scripts/verify-release-governance.py` after each of the GitHub
and registry-existence changes above will show the change in this same safe
form; the PyPI Trusted Publisher and npm/crates.io authorization checks
still require an admin's own read of the account, as noted per-check above.
