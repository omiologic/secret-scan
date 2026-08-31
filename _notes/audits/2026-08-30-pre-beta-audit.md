# Executive verdict

**NOT READY FOR BETA**

The audited `00012` snapshot was stable: initial and final content hashes matched, no active work item was present, and all 253 existing tests passed on Node 22. However, five findings should block beta:

- escaped quoted values can be only partially redacted while leaving credential material behind and corrupting JSON;
- adversarial inputs trigger quadratic CPU behavior;
- incremental success depends on transport chunk partitioning;
- current and standard credential forms bypass advertised detector families;
- public API and documentation claims are not yet internally coherent.

No Critical findings were identified. No repository files were modified. Temporary audit artifacts were removed.

## Findings

| ID | Severity | Area | Evidence | Exploit or failure scenario | Recommended remediation | Beta blocker | Confidence |
|---|---|---|---|---|---|---|---|
| SS-AUD-001 | **High** | Contextual detection / redaction | The quoted-value regex stops at the first quote without interpreting escapes: [generic-token.ts:8](/Users/minhokang/Work/ops/utilities/secret-scan/src/detectors/generic-token.ts:8). Adversarial evaluation produced one partial finding, preserved the suffix, and returned invalid JSON after redaction. Existing JSON tests cover only unescaped values: [contextual.test.ts:29](/Users/minhokang/Work/ops/utilities/secret-scan/test/detectors/contextual.test.ts:29). | A valid JSON password or token containing an escaped quote is partially replaced. The remaining suffix crosses the trust boundary and the output is syntactically corrupted. | Parse or correctly lex quoted JSON/string escapes; otherwise reject ambiguous quoted values rather than producing a partial finding. Add odd/even backslash, escaped quote, escaped slash, Unicode escape, and valid-output tests. | **Yes** | High |
| SS-AUD-002 | **High** | Performance / resource safety | Candidate resolution performs `accepted.some(...)` for every candidate: [scan.ts:223](/Users/minhokang/Work/ops/utilities/secret-scan/src/scan.ts:223). Placeholder validation compares every placeholder against every matched value: [redact.ts:186](/Users/minhokang/Work/ops/utilities/secret-scan/src/redact.ts:186). Each PEM header independently searches the remaining input for a footer: [private-key.ts:16](/Users/minhokang/Work/ops/utilities/secret-scan/src/detectors/private-key.ts:16). The regex suite tests a single long fragment, not repeated delimiters or many findings: [regex-safety.test.ts:7](/Users/minhokang/Work/ops/utilities/secret-scan/test/detectors/regex-safety.test.ts:7). | On Node 22, approximately 1 MiB with 50,000 findings took **5.94–6.34 s** and about **36 MiB heap / 45 MiB RSS** above baseline. Repeated unmatched PEM headers took **5.9–6.5 s**. This blocks an authoritative server’s event loop using ordinary request-sized input. | Replace overlap resolution with an interval-aware algorithm; parse PEM delimiters in one pass; avoid the all-findings placeholder cross-product for trusted formatters or use a multi-pattern matcher. Add scaling assertions, not only generous absolute thresholds. | **Yes** | High |
| SS-AUD-003 | **High** | Incremental sanitizer limits | One `append()` cumulatively counts already-finalized line lengths against `maxBufferedCodeUnits`: [incremental.ts:294](/Users/minhokang/Work/ops/utilities/secret-scan/src/incremental.ts:294). This conflicts with “plaintext retained but not yet emitted” and chunk-invariance claims: [ARCHITECTURE.md:348](/Users/minhokang/Work/ops/utilities/secret-scan/ARCHITECTURE.md:348), [ARCHITECTURE.md:387](/Users/minhokang/Work/ops/utilities/secret-scan/ARCHITECTURE.md:387). The existing test codifies the failure: [incremental-semantics.test.ts:178](/Users/minhokang/Work/ops/utilities/secret-scan/test/integration/incremental-semantics.test.ts:178). | The same 400-code-unit logical input and limits failed with `BUFFER_LIMIT_EXCEEDED` as one chunk but succeeded when split into 20 chunks. Network chunking therefore changes success versus failure. | Bound unresolved plaintext, not cumulative finalized units. If returned safe output needs a separate cap, define it explicitly and independently. Add identical-input/all-partition acceptance tests, including large chunks containing many short lines. | **Yes** | High |
| SS-AUD-004 | **High** | Detection recall / misleading coverage | GitHub accepts only legacy fixed lengths: [github.ts:3](/Users/minhokang/Work/ops/utilities/secret-scan/src/detectors/github.ts:3); GitLab’s catalog omits currently documented prefixes: [gitlab.ts:3](/Users/minhokang/Work/ops/utilities/secret-scan/src/detectors/gitlab.ts:3). MongoDB host validation rejects comma-separated seed lists and Redis requires a nonempty username: [connection-string.ts:120](/Users/minhokang/Work/ops/utilities/secret-scan/src/detectors/connection-string.ts:120). Standard AWS secret/session variable names are absent from the contextual name catalog: [generic-token.ts:13](/Users/minhokang/Work/ops/utilities/secret-scan/src/detectors/generic-token.ts:13). Yet README claims current GitHub/GitLab and MongoDB/Redis coverage: [README.md:266](/Users/minhokang/Work/ops/utilities/secret-scan/README.md:266). | Adversarial tests returned zero findings for GitHub’s current stateless installation token structure, two currently documented GitLab token prefixes, a standard multi-host MongoDB URI, a password-only Redis URI, and an AWS secret-access-key assignment. GitHub documents its 2026 stateless rollout; GitLab now lists the omitted prefixes; MongoDB explicitly permits host lists; AWS documents its credential variables. [GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats), [GitLab](https://docs.gitlab.com/security/tokens/#token-prefixes), [MongoDB](https://www.mongodb.com/docs/manual/reference/connection-string-formats/#standard-connection-string-format), [AWS](https://docs.aws.amazon.com/sdkref/latest/guide/feature-static-credentials.html), [Redis](https://redis.io/docs/latest/develop/tools/cli/#host-port-password-and-database). | Refresh provider qualification against current primary documentation. Add supported forms with conservative boundaries, or explicitly narrow claims. At minimum, support current GitHub installation tokens and standard MongoDB seed lists before claiming those families. Decide and prominently document treatment of AWS secret/session variables and password-only Redis forms. | **Yes** | High |
| SS-AUD-005 | **Medium** | PEM overlap handling | Every header pairs with the first later matching footer: [private-key.ts:16](/Users/minhokang/Work/ops/utilities/secret-scan/src/detectors/private-key.ts:16). Equal-tier conflict resolution then prefers the narrower span: [scan.ts:181](/Users/minhokang/Work/ops/utilities/secret-scan/src/scan.ts:181). | A malformed nested private-key header produced one inner finding while the earlier header and body remained in sanitized output. | Define malformed/nested PEM behavior. Prefer a fail-closed outer span, reject the construct under an explicit policy, or document nested PEM as unsupported with a deterministic regression test. | No | High |
| SS-AUD-006 | **Medium** | Adapter test evidence | Node and Web tests exercise functional streaming, but “backpressure” assertions primarily compare final output: [node-stream.test.ts:59](/Users/minhokang/Work/ops/utilities/secret-scan/test/adapters/node-stream.test.ts:59), [web-stream.test.ts:60](/Users/minhokang/Work/ops/utilities/secret-scan/test/adapters/web-stream.test.ts:60). Writable abort, explicit Web abort, downstream pipeline failure, decoder failure after prior safe output, and multiple terminal races lack permanent tests. | Regressions in native state transitions could pass the current corpus while failing under downstream errors or competing terminal events. Temporary adversarial checks passed these exercised cases, but the evidence is not durable. | Add deterministic adapter state-machine tests measuring actual backpressure and covering every terminal transition and error ordering. | No | Medium |
| SS-AUD-007 | **Low** | Placeholder safety | Reproduction is checked only for matched values at least four code units long: [redact.ts:135](/Users/minhokang/Work/ops/utilities/secret-scan/src/redact.ts:135). README says a formatter “must not reproduce a detected value” without that qualification: [README.md:104](/Users/minhokang/Work/ops/utilities/secret-scan/README.md:104). | A custom three-code-unit finding was reproduced unchanged by its formatter. Built-ins are not this short, but public `redact()` accepts caller-supplied findings. | Either reject reproduction at every length with an appropriate safe strategy, establish a minimum redactable range, or narrow the documentation and mark custom findings/formatters as trusted. | No | High |
| SS-AUD-008 | **Low** | Documentation / public API | A feature note still says byte-stream adapters do not exist: [detector-pipeline/README.md:35](/Users/minhokang/Work/ops/utilities/secret-scan/_notes/features/detector-pipeline/README.md:35). The implementation-only lookaround constant is exported publicly: [index.ts:19](/Users/minhokang/Work/ops/utilities/secret-scan/src/index.ts:19), but is not explained as public API. | The beta creates an accidental SemVer obligation for an internal tuning constant and ships contradictory documentation. | Update all feature notes and either remove the constant from root exports before the first version or deliberately document and support it. | **Yes**—public API review gate | High |
| SS-AUD-009 | **Low** | Supply chain | Runtime dependencies are empty and the lockfile is complete, but CI uses mutable action major tags: [ci.yml:23](/Users/minhokang/Work/ops/utilities/secret-scan/.github/workflows/ci.yml:23). The lockfile includes install scripts for esbuild and optional fsevents packages. | A compromised or retargeted action tag affects CI. Install scripts expand build-time supply-chain exposure, although integrity hashes constrain package contents. | Pin actions to reviewed commit SHAs and periodically refresh them. Keep lockfile integrity review and minimized CI permissions. | No | High |

## Coverage matrix

| Requirement or promise | Existing evidence | Missing evidence | Status |
|---|---|---|---|
| Deterministic ordering, IDs, specificity and offsets | Candidate-pipeline tests; repeated scans; UTF-16 offset tests | Malformed nested PEM semantics | **Partial** |
| Public findings and fixed errors contain no detected plaintext | Error/finding tests; manual failure checks passed | Trusted-extension boundary is not clearly specified; short placeholder exception | **Partial** |
| Redaction handles repeated, adjacent, warn/allow and formatter failures | Strong unit coverage at [policy-redaction.test.ts:141](/Users/minhokang/Work/ops/utilities/secret-scan/test/integration/policy-redaction.test.ts:141) | Escaped quoted values and syntax-preserving structured output | **Partial** |
| Incremental output equals `scanAndRedact` independent of chunking | Existing conformance partitions plus 2,500 additional randomized CR/LF/CRLF/Unicode partitions passed | Acceptance itself changes with partition size | **Partial** |
| Incremental lifecycle and failure cleanup | Abort, finalize, limits, policy and formatter tests passed | Broader terminal-race and custom-policy failure ordering | **Partial** |
| Retention hints match implemented detectors | Cross-line contextual/Bearer and PEM tests passed | Provider drift changes the detector inventory; exact limit edges remain sparse | **Partial** |
| Node adapter is thin, fatal-stateful and failure-safe | Source delegates to shared incremental runtime; every valid UTF-8 boundary passes; manual downstream/decode checks passed | Durable backpressure and multiple-terminal tests | **Partial** |
| Web adapter cancellation/abort and failure safety | Existing cancellation/failure tests; manual writable and explicit abort checks passed | Multiple terminal races and measured backpressure | **Partial** |
| Root/Web graphs contain no Node-only modules | Source inspection and browser bundles; only Node subpath resolved `node:stream` | None identified | **Proven** |
| Package exports, declarations and contents | Synthetic inspection tarball had 101 intended files; root/Node/Web tarball imports and declaration consumers passed | Actual release pack cannot exist until a version is approved | **Proven for inspection snapshot** |
| Node 20 and 22 compatibility | CI matrix declares both; completion record reports prior Node 20/22 success; Node 22 audit passed | No Node 20 executable was available for this audit | **Partial** |
| Modern-browser ES2022 bundling | Root and Web tarball bundles passed with no Node graph | Cross-browser execution is not tested | **Partial** |
| Runtime core has no I/O, storage, telemetry, DOM or Node dependencies | Source and emitted-graph inspection found none | None identified | **Proven** |
| Regex and algorithmic resource safety | Long single near-matches and ordinary 1 MiB input pass | Repeated delimiters and many findings fail practical resource-safety expectations | **Unproven / failed adversarially** |
| Current provider and connection coverage | Conformance corpus covers declared fixtures | Current GitHub/GitLab forms, MongoDB host lists, common AWS credentials and Redis variants | **Partial** |
| Documentation matches behavior | README examples execute correctly | Stale adapter note, overbroad coverage and placeholder claims | **Partial** |
| Dependency integrity | Lockfile v3; all 145 external packages had registry URLs and integrity; `npm audit` found zero advisories | Mutable CI action tags; advisory status is time-sensitive | **Partial** |

## Optimization opportunities

| Opportunity | Expected benefit | Security/correctness tradeoff | Complexity | Before beta |
|---|---|---|---|---|
| Interval-aware overlap resolution | Removes many-finding quadratic scan behavior | Must preserve exact specificity/confidence/registration precedence | Medium | **Yes** |
| Single-pass PEM delimiter parser | Removes repeated-footer-search quadratic behavior | Malformed/nested semantics must be explicitly chosen and tested | Medium | **Yes** |
| Efficient placeholder exclusion | Removes the all-placeholders × all-values comparison and plaintext slice array | Must not weaken the no-reproduction invariant for custom formatters | Medium–High | **Yes** |
| Emit/account finalized units independently of unresolved plaintext | Restores chunk-partition invariance and accepts large chunks of short lines | Separate output/resource limits must be explicit and fail safely | Medium | **Yes** |
| Incremental PEM state instead of rescanning the whole buffer on each append | Improves highly fragmented long-line behavior; 200k one-unit appends currently took about 2.28 s | Stateful logic must exactly match synchronous behavior | Medium | Recommended |
| Explicit `maxFindings` fail-safe | Bounds metadata, policy, and placeholder work under hostile inputs | Must fail before returning unsafe partial output; new public option | Low–Medium | Consider before beta |
| Avoid plaintext slice collection for built-in formatters | Reduces peak memory and lifetime of temporary matched-string references | Only safe if built-in formatters cannot reflect input-derived metadata | Low | Recommended |

## Release gates

### Must fix before beta

- SS-AUD-001 structured quoted-value partial redaction.
- SS-AUD-002 quadratic many-finding and repeated-PEM behavior.
- SS-AUD-003 chunk-partition-dependent buffer failures.
- SS-AUD-004 current/standard credential coverage or corresponding advertised-coverage claims.
- Complete the public export review, including the lookaround constant.
- Add deterministic regression tests for every remediation.

### Must document before beta

- Exact provider formats and update cadence.
- Intentional exclusions: valid-but-differently-encoded JWTs, truncated/malformed PEM, legacy Vault formats, unsupported URI forms, and contextual values that default to `warn` and therefore remain unchanged.
- Whether AWS secret/session variables and password-only Redis URIs are supported.
- Trust assumptions for custom detectors, policies, findings, and placeholder formatters.
- Input, finding-count, and resource limits expected at the authoritative server boundary.

### Safe to defer

- CommonJS output.
- Web Worker or framework middleware.
- Cross-browser matrix beyond the stated modern-browser baseline.
- Pinning CI actions, though it is worthwhile.
- Further memory micro-optimizations after the quadratic paths are removed.

### Exact verification after remediation

1. Run clean `npm ci` and `npm run ci` on Node 20 and 22.
2. Add escaped-string regressions proving full-span replacement, valid structured output, and no retained suffix.
3. Compare identical logical inputs across every relevant partition, including one large transport chunk versus many small chunks.
4. Add current official GitHub/GitLab, MongoDB seed-list, AWS contextual, and chosen Redis fixtures with primary-source qualification.
5. Add repeated-PEM and 50,000-finding benchmarks with scaling assertions and memory bounds.
6. Exercise Node/Web downstream errors, writable/readable cancellation, explicit abort, malformed UTF-8 after safe output, and competing terminal events.
7. Reinspect emitted `.d.ts`, root/Web browser bundles, and all package subpath graphs.
8. Create an inspection tarball and run root/Node/Web runtime and type-consumer imports.
9. Run lockfile audit and both governance validators.
10. Review the final public API and changelog; only then may the user explicitly approve a version or release.

## Commands executed and outcomes

Key commands, all read-only against the repository unless explicitly noted as temporary:

- `git status --short --branch`, `git diff --check`, `git diff --stat` — dirty `00012` snapshot identified; no whitespace errors.
- `git diff --binary | shasum -a 256` plus selected untracked-file hashes — identical before and after audit; snapshot stable.
- `npm run typecheck` — passed in the repository.
- `npm run ci` in the corrected isolated copy — **17 files, 253 tests passed** on Node 22.16.0.
- An initial isolated `npm run ci` attempt was invalid because the copy excluded dependency-internal `dist` folders; it was corrected and is not counted as a repository failure.
- `python3 .agents/skills/context-governance/scripts/validate_governance.py .` — 0 errors, 0 warnings.
- `python3 .agents/skills/context-governance/scripts/validate_plans.py .` — 0 errors, 0 warnings.
- `npm ls --all --json` and `npm ls --all --package-lock-only --json` — no dependency problems.
- `npm audit --package-lock-only --json` — zero known vulnerabilities.
- `npm pack --dry-run --json` on the unversioned manifest — failed as expected because no version is selected.
- Temporary `0.0.0-inspection` package: pack, contents, root/Node/Web imports and three declaration-consumer typechecks — passed.
- Browser bundles of the packed root and Web subpaths — passed; no `node:` or Node-adapter inputs.
- Temporary adversarial harnesses — 2,500 randomized incremental partitions passed; adapter failure/abort cleanup passed; confirmed findings SS-AUD-001 through SS-AUD-005 and SS-AUD-007.
- Performance evaluation:
  - ordinary 1 KiB / 100 KiB / 1 MiB: approximately 0.02 / 0.51 / 5 ms;
  - long provider suffix, large complete PEM, and long ordinary line near 1 MiB: approximately 4–9 ms;
  - 50,000 findings near 1 MiB: approximately 5.9–6.3 s;
  - repeated unmatched PEM headers near 1 MiB: approximately 5.9–6.5 s;
  - 200,000 one-code-unit appends on one open line: approximately 2.28 s.
- Node 20 was not rerun because no Node 20 executable was installed and installing one was prohibited.
- `npm ci` was not run because the audit explicitly prohibited dependency installation; the existing installed tree matched the lockfile.
- All temporary files and the npm diagnostic log produced by the intentionally failed unversioned pack check were removed.

No version, branch, commit, tag, changelog, package publication, deployment, or release action was performed. Release authority remains with the user after remediation and renewed verification.
