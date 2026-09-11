# Contributing to Redact Secret

Redact Secret provides deterministic secret detection and redaction through one
Rust core shared by JavaScript, Python, Rust, and CLI consumers. The first beta
is a prerelease; describe current support and limitations without claiming v1
stability.

## Before opening a change

- Use GitHub Issues for reproducible bugs, compatibility evidence, and focused
  proposals. Public support is best-effort; the project makes no response-time or
  long-term-support commitment.
- Report suspected vulnerabilities privately as described in
  [SECURITY.md](SECURITY.md), not in a public issue.
- Read [ARCHITECTURE.md](ARCHITECTURE.md), [CONVENTIONS.md](CONVENTIONS.md), and the
  [decision router](docs/decisions/DECISIONS.md). A material boundary change needs
  an ADR rather than an undocumented convention.

Keep fixtures to the smallest synthetic input that measures one contract behavior.
Never include active credentials or matched plaintext in diagnostics. Keep the
Rust core side-effect free, detection separate from enforcement, and host I/O in
adapters. Behavior changes need deterministic regressions in the shared
[conformance corpus](conformance/README.md) and explicit false-positive and
false-negative tradeoffs.

## Development checks

For environment setup and a complete local check sequence, see
[developer onboarding](docs/onboarding.md). Public user guides start at
the [documentation home](docs/README.md).

The authoritative commands and pinned tool versions live in
[workspace policy](docs/rust-workspace.md#verification) and
[artifact qualification](docs/qualification.md). Run the checks for every
package you change. Changes to packaging, compatibility, or release behavior also
require artifact inspection and clean-install smoke tests.

Pull requests should explain the observable change, its verification, and any
compatibility impact. By contributing, you agree that your contribution is licensed
under the repository's [MIT License](LICENSE).

## Branching strategy

`rc` stands for release candidate. `main` is the integration branch. Merge normal
development from working branches through pull requests. When a release is ready
for stabilization, create `rc/<version>` from the reviewed main commit, for
example `rc/0.1.0-beta.1`.

```mermaid
flowchart TD
    work["Working branch"] -->|Pull request| main["main"]
    main -->|Create stabilization branch| candidate["rc/0.1.0-beta.1"]
    fix["Release-fix branch"] -->|Pull request targeting RC branch| candidate
    candidate --> checks["Freeze candidate; pass checks and dry-runs"]
    checks --> preparation["release/v0-1-0-beta-1"]
    preparation -->|Reviewed pull request| main
    main --> qualified["Qualify the resulting main commit; review API and changelog"]
    qualified --> approval["Explicit release approval"]
    approval --> publish["Manually dispatch Release from main"]
    publish --> verify["Verify published packages with clean installs"]
    verify --> tag["Workflow creates annotated v0.1.0-beta.1 tag"]
```

- Keep candidate fixes and release notes on `rc/<version>`. Target release-fix
  PRs at that branch; keep unrelated development on `main`.
- Once the candidate is stabilized and its version is approved, create
  `release/v{version-slug}` from the candidate, for example
  `release/v0-1-0-beta-1`, and merge its preparation changes into `main` through
  a reviewed PR. Retain the RC branch as the stabilization record.
- Publication and recovery run from `main`, as required by
  [release authority](AGENTS.md#release-authority), workflow guards, and the
  protected release environment. RC branches do not publish directly.
- A merge changes the source revision. Qualify the resulting `main` commit
  before final release approval; RC checks do not qualify a later merge commit.
  Freeze the approved source through publication. Any source change requires
  fresh qualification and review.
- PR merges do not publish packages or create tags. After explicit release
  approval, manually dispatch [Release](.github/workflows/release.yml) from
  `main`. It qualifies that revision, publishes the product, verifies registry
  installs, and creates the annotated version tag only after verification.

## Releases

The Rust crates, npm packages, Python distribution, and CLI share one SemVer
version, source revision, and eventual `v{version}` tag. Follow the
[release authority](AGENTS.md#release-authority),
[lockstep decision](docs/decisions/2026-09-09-release-bindings-in-lockstep.md), and
[artifact qualification guide](docs/qualification.md). Publishing one artifact
does not establish that the whole product has been released. Partial publication
requires separately authorized [Reconcile Release](.github/workflows/reconcile-release.yml)
using the durable release manifest and matching qualified artifacts.

### First beta candidate

The preparation branch is `rc/0.1.0-beta.1`. The existing manifests already
agree on `0.1.0-beta.1` (Python distribution metadata: `0.1.0b1`). The
[candidate changelog](CHANGELOG.md) records the public contract; this is not
a publication record or permission to publish.

Before requesting final release approval:

- Complete RC stabilization and the reviewed `release/v0-1-0-beta-1` PR into
  `main` using the branch path above.
- Resolve or explicitly disposition the residual findings in the
  [latest readiness audit](docs/audits/repeated-release-readiness-audit.md#blocking-residual-findings-and-exact-exits):
  partial-publication recovery, complete failed-run manifests, review and
  qualification protection, publisher prerequisites, and SAST ownership.
  Closed tracking issues and green CI alone do not resolve these findings.
- Review the candidate version, public API, and changelog; run CI, Python
  wheels, artifact qualification, and SAST against the final source revision.
  Any further commit needs fresh qualification for that revision.
- Obtain explicit release approval after those checks. Publish through the
  approved workflow, verify registry installs, and retain the release manifest.
  Use reconciliation only with separate authorization.
