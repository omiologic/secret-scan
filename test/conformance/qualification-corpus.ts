import type {
  ConformanceCaseInput,
  ConformanceExpectation,
  ConformanceHostContext,
} from "./schema.js";

const githubValue = `ghp_${"SYNTHETICREVOKED".padEnd(36, "0")}`;
const awsValue = `AKIA${"SYNTHETICEXAMPLE"}`;

function one(
  input: string,
  matched: string,
  metadata: Omit<ConformanceExpectation, "start" | "end">,
): readonly ConformanceExpectation[] {
  const start = input.indexOf(matched);
  if (start < 0) throw new TypeError("Invalid qualification fixture construction.");
  return [{ ...metadata, start, end: start + matched.length }];
}

const githubExpectation = {
  detector: "github-token",
  type: "github_token",
  confidence: "high",
  specificity: "provider",
} as const;

const hostFormats: readonly [
  ConformanceHostContext,
  (value: string) => string,
][] = [
  ["dotenv", (value) => `API_KEY=${value}`],
  ["json", (value) => `{"api_key":"${value}"}`],
  ["yaml", (value) => `api_key: "${value}"`],
  ["toml", (value) => `api_key = "${value}"`],
  ["shell", (value) => `export API_KEY='${value}'`],
  ["powershell", (value) => `$env:API_KEY = '${value}'`],
  ["docker-compose", (value) => `services:\n  app:\n    environment:\n      API_KEY: ${value}`],
  ["github-actions", (value) => `env:\n  API_KEY: ${value}`],
  ["terraform", (value) => `variable "api_key" { default = "${value}" }`],
  ["kubernetes", (value) => `stringData:\n  api_key: ${value}`],
  ["javascript", (value) => `const apiKey = "${value}";`],
  ["typescript", (value) => `const apiKey: string = \`${value}\`;`],
  ["python", (value) => `api_key = '${value}'`],
  ["http", (value) => `Authorization: token ${value}`],
  ["curl", (value) => `curl -H 'X-API-Key: ${value}' https://example.test`],
  ["log", (value) => `level=debug api_key=${value} request_id=fixture-42`],
  ["terminal", (value) => `$ export API_KEY=${value}`],
  ["stack-trace", (value) => `Error: request failed\n  at fixture (${value}:1:1)`],
  ["chat", (value) => `Please revoke this synthetic example: ${value}`],
  ["markdown", (value) => `\`\`\`env\nAPI_KEY=${value}\n\`\`\``],
  ["xml", (value) => `<setting name="api_key" value="${value}" />`],
];

export const hostContextCorpus: readonly ConformanceCaseInput[] = hostFormats.map(
  ([context, render]) => {
    const input = render(githubValue);
    return {
      id: `host-${context}-github`,
      detector: "github-token",
      kind: "positive",
      support: "supported",
      tier: "contextual",
      contexts: [context],
      input,
      expected: one(input, githubValue, githubExpectation),
      note: "Host syntax is lexical context; the provider token retains exact original-input offsets.",
    };
  },
);

const negativeIdentifiers = [
  ["sha256", "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"],
  ["checksum", "checksum=9e107d9d372bb6826bd81d3542a419d6"],
  ["uuid", "550e8400-e29b-41d4-a716-446655440000"],
  ["ulid", "01ARZ3NDEKTSV4RRFFQ69G5FAV"],
  ["generated-id", "request_01_SYNTHETIC_GENERATED_IDENTIFIER_987654321"],
  ["css-hash", "styles.module.css?hash=7f3a9c2d1e"],
  ["source-map", "//# sourceMappingURL=app.7f3a9c2d1e.js.map"],
  ["base64-asset", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"],
  ["jwt-like", "header.payload.signature"],
  ["package-integrity", "sha512-SYNTHETICPACKAGEINTEGRITYBASE64VALUE=="],
  ["model-id", "model=gpt-5.6-codex-2026-08-31"],
] as const;

export const negativeQualificationCorpus: readonly ConformanceCaseInput[] =
  negativeIdentifiers.map(([name, input]) => ({
    id: `negative-${name}`,
    detector: "generic-token",
    kind: "negative",
    support: "supported",
    tier: "negative",
    contexts: [name === "source-map" ? "javascript" : "plain-text"],
    input,
    expected: [],
    note: "A common high-entropy or identifier-like value remains unchanged under default scanning.",
  }));

interface MutationDefinition {
  readonly operation: string;
  readonly render: (value: string) => string;
  readonly matched: boolean;
  readonly kind: "positive" | "boundary";
  readonly support: "supported" | "intentionally-unsupported";
}

const githubMutations: readonly MutationDefinition[] = [
  { operation: "identity", render: (value) => value, matched: true, kind: "positive", support: "supported" },
  { operation: "invalid-prefix", render: (value) => `ghq_${value.slice(4)}`, matched: false, kind: "boundary", support: "intentionally-unsupported" },
  { operation: "short-length", render: (value) => value.slice(0, -1), matched: false, kind: "boundary", support: "intentionally-unsupported" },
  { operation: "invalid-alphabet", render: (value) => `${value.slice(0, 12)}!${value.slice(13)}`, matched: false, kind: "boundary", support: "intentionally-unsupported" },
  { operation: "whitespace-insertion", render: (value) => `${value.slice(0, 12)} ${value.slice(12)}`, matched: false, kind: "boundary", support: "intentionally-unsupported" },
  { operation: "truncation", render: (value) => value.slice(0, 20), matched: false, kind: "boundary", support: "intentionally-unsupported" },
  { operation: "punctuation-boundary", render: (value) => `${value}!`, matched: true, kind: "positive", support: "supported" },
  { operation: "quoted", render: (value) => `"${value}"`, matched: true, kind: "positive", support: "supported" },
  { operation: "encoded-prefix", render: (value) => `ghp%5F${value.slice(4)}`, matched: false, kind: "boundary", support: "intentionally-unsupported" },
  { operation: "host-embedding", render: (value) => `https://example.test/?credential=${value}`, matched: true, kind: "positive", support: "supported" },
];

export function generateGrammarMutations(): readonly ConformanceCaseInput[] {
  return Object.freeze(githubMutations.map((mutation, ordinal) => {
    const input = mutation.render(githubValue);
    return Object.freeze({
      id: `mutation-github-${String(ordinal).padStart(2, "0")}-${mutation.operation}`,
      detector: "github-token",
      kind: mutation.kind,
      support: mutation.support,
      tier: mutation.matched ? "canonical" : "malformed",
      contexts: [mutation.operation === "host-embedding" ? "curl" : "plain-text"],
      mutation: {
        grammar: "github-classic",
        seedId: "github-classic-synthetic-seed",
        operation: mutation.operation,
        ordinal,
      },
      input,
      expected: mutation.matched
        ? one(input, githubValue, githubExpectation)
        : [],
      note: "A fixed grammar mutation records the accepted boundary or neighboring rejected form.",
    } satisfies ConformanceCaseInput);
  }));
}

const repeatedInput = `${awsValue}\r\n${awsValue}`;
const firstAwsEnd = awsValue.length;
const heredocInput = `API_KEY=$(cat <<'EOF'\n${githubValue}\nEOF\n)`;

export const compoundAndRegressionCorpus: readonly ConformanceCaseInput[] = [
  {
    id: "host-shell-heredoc-github",
    detector: "github-token",
    kind: "positive",
    support: "supported",
    tier: "contextual",
    contexts: ["shell"],
    input: heredocInput,
    expected: one(heredocInput, githubValue, githubExpectation),
    note: "A provider token retains its exact span inside a multiline heredoc body.",
  },
  {
    id: "compound-repeated-crlf-aws",
    detector: "aws-access-key",
    kind: "overlap",
    support: "supported",
    tier: "contextual",
    contexts: ["dotenv", "plain-text"],
    input: repeatedInput,
    expected: [
      { detector: "aws-access-key", type: "aws_access_key_id", confidence: "high", specificity: "provider", start: 0, end: firstAwsEnd },
      { detector: "aws-access-key", type: "aws_access_key_id", confidence: "high", specificity: "provider", start: firstAwsEnd + 2, end: repeatedInput.length },
    ],
    note: "Repeated findings separated by CRLF retain distinct exact offsets and ordering.",
  },
  {
    id: "regression-malformed-percent-authority",
    detector: "connection-string",
    kind: "boundary",
    support: "supported",
    tier: "regression",
    contexts: ["log"],
    input: "postgres://fixture:SYNTHETIC%GGREVOKED@example.test/db",
    expected: [],
    note: "Permanent synthetic regression: malformed percent escapes never yield a partial password finding.",
  },
  {
    id: "adversarial-dense-aws-findings",
    detector: "aws-access-key",
    kind: "adversarial",
    support: "supported",
    tier: "adversarial",
    contexts: ["log"],
    input: Array.from({ length: 250 }, () => awsValue).join(" "),
    expected: Array.from({ length: 250 }, (_, index) => {
      const start = index * (awsValue.length + 1);
      return { ...githubExpectation, detector: "aws-access-key", type: "aws_access_key_id", start, end: start + awsValue.length };
    }),
    resource: { maxInputCodeUnits: 5_249, maxFindings: 250, maxRuntimeMs: 250 },
    note: "A dense but bounded finding set preserves ordering and safe metadata without quadratic resolution.",
  },
];
