/**
 * Deterministic reproducer for the `github-classic` grammar-mutation family
 * declared in `synchronous-corpus.json` (`mutation.grammar ===
 * "github-classic"`, `mutation.seedId === GITHUB_CLASSIC_SEED_ID`).
 *
 * This module does not generate the corpus. `fixtures/synchronous-corpus.json`
 * remains the independently authored, hand-maintained canonical source (see
 * `conformance/README.md`). Its only job is to prove that the fixtures'
 * `mutation` provenance is not decorative: given the same seed, the same
 * bounded, ordered set of `(operation, ordinal)` pairs reproduces the exact
 * same `input` bytes every time, and that reproduction is checked against the
 * committed fixtures in `github-classic-mutations.test.ts`. A `mutation`
 * whose `operation` is not `"declared-boundary"` (a manually authored, fixed
 * boundary case whose own `seedId` is its stable identity, not a generator
 * input) must be backed by a reproducer like this one.
 *
 * The base literal is an unmistakably synthetic, revoked-shaped GitHub
 * classic token: never a real or real-looking credential.
 */

export const GITHUB_CLASSIC_SEED_ID = "github-classic-synthetic-seed";

const PREFIX = "ghp_";
/** The literal word portion of the synthetic body; index 8 (the `C`) is the
 * fixed byte the `invalid-alphabet` and `whitespace-insertion` operations
 * mutate. */
const WORD = "SYNTHETICREVOKED";
const PAD = "0".repeat(20);
/** `WORD` + `PAD`: the 36-byte body a real GitHub classic token's grammar
 * requires after its 4-byte prefix. */
const BODY = WORD + PAD;

export interface GithubClassicMutationCase {
  readonly operation: string;
  readonly ordinal: number;
  readonly input: string;
}

/**
 * The ordered, deterministic mutation set this seed produces. Order is
 * significant: `ordinal` is each case's index here, matching the corpus
 * fixtures' `mutation.ordinal`.
 */
export function generateGithubClassicMutations(): readonly GithubClassicMutationCase[] {
  const operations: readonly (readonly [string, string])[] = [
    ["identity", PREFIX + BODY],
    ["invalid-prefix", `ghq_${BODY}`],
    ["short-length", PREFIX + BODY.slice(0, -1)],
    ["invalid-alphabet", PREFIX + BODY.slice(0, 8) + "!" + BODY.slice(9)],
    ["whitespace-insertion", PREFIX + BODY.slice(0, 8) + " " + BODY.slice(8)],
    ["truncation", PREFIX + WORD],
    ["punctuation-boundary", PREFIX + BODY + "!"],
    ["quoted", `"${PREFIX}${BODY}"`],
    ["encoded-prefix", `ghp%5F${BODY}`],
    ["host-embedding", `https://example.test/?credential=${PREFIX}${BODY}`],
  ];

  return operations.map(([operation, input], ordinal) => ({
    operation,
    ordinal,
    input,
  }));
}
