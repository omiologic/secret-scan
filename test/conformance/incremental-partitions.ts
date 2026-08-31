import type { SecretFinding } from "../../src/types.js";

export interface IncrementalPartitionExpectation {
  readonly text: string;
  readonly findings: readonly SecretFinding[];
}

export interface IncrementalPartitionCase {
  readonly id: string;
  readonly input: string;
  readonly expected: IncrementalPartitionExpectation;
  readonly note: string;
}

const privateKey = [
  "-----BEGIN PRIVATE KEY-----",
  "U1lOVEhFVElDX1JFVk9LRURfSU5DUkVNRU5UQUw=",
  "-----END PRIVATE KEY-----",
].join("\n");
const aws = `AKIA${"SYNTHETICEXAMPLE"}`;
const gitlab = "glpat-SYNTHETIC_REVOKED_INCREMENTAL";
const githubInstallation =
  "ghs_SYNTHETIC_APP_ID.eyJTWU5USEVUSUNfUkVWT0tFRF9IRUFERVI.SYNTHETIC_REVOKED_SIGNATURE";
const jwt = [
  "eyJTWU5USEVUSUNfSEVBREVS",
  "eyJTWU5USEVUSUNfUEFZTE9BRA",
  "SYNTHETIC_REVOKED_SIGNATURE",
].join(".");
const contextual = "SYNTHETIC_REVOKED_INCREMENTAL_VALUE";
const connectionPassword = "SYNTHETIC%40REVOKED%3AINCREMENTAL";

function finding(
  id: string,
  input: string,
  value: string,
  metadata: Omit<SecretFinding, "id" | "start" | "end">,
): SecretFinding {
  const start = input.indexOf(value);
  if (start < 0) throw new TypeError("Invalid incremental fixture construction.");
  return { id, ...metadata, start, end: start + value.length };
}

const unicodeInput = `before 🧪 ${aws} after`;
const overlapInput = `Authorization: Bearer ${jwt}`;
const contextualInput = `api_key=${contextual}`;
const connectionInput =
  `postgres://fixture:${connectionPassword}@localhost:5432/db`;
const mongoSeedInput =
  `mongodb://fixture:${connectionPassword}@db0.example.test:27017,db1.example.test:27018/db`;
const redisPasswordOnlyInput =
  `redis://:${connectionPassword}@cache.example.test:6379/0`;
const awsContextualInput = `AWS_SESSION_TOKEN=${contextual}`;
const adjacentInput = `${aws} ${gitlab}`;
const additionalProviderValues = [
  ["stripe_credential", "stripe-token", `sk_live_${"SYNTHETICREVOKED".repeat(2)}`],
  ["slack_token", "slack-token", `xoxb-${"SYNTHETIC-REVOKED-".repeat(2)}`],
  ["pypi_api_token", "pypi-token", `pypi-${"SYNTHETIC_REVOKED_".repeat(5)}`],
  ["huggingface_token", "huggingface-token", `hf_${"SYNTHETIC_REVOKED_".repeat(2)}`],
  ["docker_token", "docker-token", `dckr_pat_${"SYNTHETIC_REVOKED_".repeat(2)}`],
  ["cloudflare_api_token", "cloudflare-token", `cfut_${"SYNTHETIC_REVOKED_".repeat(2)}`],
  ["digitalocean_token", "digitalocean-token", `dop_v1_${"SYNTHETIC_REVOKED_".repeat(2)}`],
  ["linear_token", "linear-token", `lin_api_${"SYNTHETIC_REVOKED_".repeat(2)}`],
  ["supabase_secret_key", "supabase-token", `sb_secret_${"SYNTHETIC_REVOKED_".repeat(2)}`],
  ["vercel_token", "vercel-token", `vcp_${"SYNTHETIC_REVOKED_".repeat(2)}`],
] as const;
const additionalProviderInput = additionalProviderValues
  .map(([, , value]) => value)
  .join("\n");
const legacyVariableValues = [
  ["openai_api_key", "openai-token", "sk-proj-SYNTHETIC_REVOKED_INCREMENTAL_KEY"],
  ["anthropic_api_key", "anthropic-token", "sk-ant-api03-SYNTHETIC_REVOKED_INCREMENTAL_KEY"],
  ["shopify_access_token", "shopify-token", "shpat_SYNTHETIC_REVOKED_INCREMENTAL_TOKEN"],
  ["vault_token", "vault-token", "hvs.SYNTHETIC_REVOKED_INCREMENTAL_TOKEN"],
  ["bearer_token", "bearer-token", "SYNTHETIC_REVOKED_INCREMENTAL_BEARER"],
] as const;
const legacyVariableInput = legacyVariableValues
  .map(([type, , value]) => type === "bearer_token" ? `Bearer ${value}` : value)
  .join("\n");

/**
 * Contract fixtures for the future incremental core. All values are synthetic,
 * and expectations contain only the same plaintext-free metadata as public
 * findings. The generator deliberately lives outside runtime source.
 */
export const incrementalPartitionCorpus: readonly IncrementalPartitionCase[] = [
  {
    id: "synthetic-regression-malformed-authority",
    input: "postgres://fixture:SYNTHETIC%GGREVOKED@example.test/db",
    expected: {
      text: "postgres://fixture:SYNTHETIC%GGREVOKED@example.test/db",
      findings: [],
    },
    note: "The permanent malformed-percent regression remains unchanged through core and stream partitions.",
  },
  {
    id: "legacy-variable-detector-families",
    input: legacyVariableInput,
    expected: {
      text: legacyVariableValues
        .map(([type], index) => type === "bearer_token"
          ? `Bearer <SECRET_${index + 1}>`
          : `<SECRET_${index + 1}>`)
        .join("\n"),
      findings: legacyVariableValues.map(([type, detector, value], index) =>
        finding(`finding-${index + 1}`, legacyVariableInput, value, {
          type,
          detector,
          confidence: "high",
          action: "redact",
        })
      ),
    },
    note: "Every pre-expansion variable-length detector family remains whole across UTF-16 and UTF-8 partitions.",
  },
  {
    id: "additional-provider-families",
    input: additionalProviderInput,
    expected: {
      text: additionalProviderValues
        .map((_, index) => `<SECRET_${index + 1}>`)
        .join("\n"),
      findings: additionalProviderValues.map(([type, detector, value], index) =>
        finding(`finding-${index + 1}`, additionalProviderInput, value, {
          type,
          detector,
          confidence: "high",
          action: "redact",
        })
      ),
    },
    note: "Every newly qualified variable-length provider family remains whole across partitions.",
  },
  {
    id: "fixed-width-unicode",
    input: unicodeInput,
    expected: {
      text: "before 🧪 <SECRET_1> after",
      findings: [finding("finding-1", unicodeInput, aws, {
        type: "aws_access_key_id", detector: "aws-access-key",
        confidence: "high", action: "redact",
      })],
    },
    note: "Covers fixed-width detection and a surrogate pair outside the match.",
  },
  {
    id: "variable-provider",
    input: gitlab,
    expected: {
      text: "<SECRET_1>",
      findings: [finding("finding-1", gitlab, gitlab, {
        type: "gitlab_token", detector: "gitlab-token",
        confidence: "high", action: "redact",
      })],
    },
    note: "A delimiter or finalization closes an open-ended provider suffix.",
  },
  {
    id: "github-installation-stateless",
    input: githubInstallation,
    expected: {
      text: "<SECRET_1>",
      findings: [finding("finding-1", githubInstallation, githubInstallation, {
        type: "github_token", detector: "github-token",
        confidence: "high", action: "redact",
      })],
    },
    note: "The variable-length GitHub installation shape remains whole across partitions.",
  },
  {
    id: "structural-overlap",
    input: overlapInput,
    expected: {
      text: "Authorization: Bearer <SECRET_1>",
      findings: [finding("finding-1", overlapInput, jwt, {
        type: "jwt", detector: "jwt", confidence: "high", action: "redact",
      })],
    },
    note: "JWT specificity and offsets remain stable across Bearer overlap.",
  },
  {
    id: "contextual-assignment",
    input: contextualInput,
    expected: {
      text: "api_key=<SECRET_1>",
      findings: [finding("finding-1", contextualInput, contextual, {
        type: "contextual_secret", detector: "generic-token",
        confidence: "high", action: "redact",
      })],
    },
    note: "Finalization closes an assignment that ends with the input.",
  },
  {
    id: "encoded-connection",
    input: connectionInput,
    expected: {
      text: "postgres://fixture:<SECRET_1>@localhost:5432/db",
      findings: [finding("finding-1", connectionInput, connectionPassword, {
        type: "connection_string_password", detector: "connection-string",
        confidence: "high", action: "redact",
      })],
    },
    note: "Encoded userinfo and the complete authority may span chunks.",
  },
  {
    id: "mongodb-seed-list-connection",
    input: mongoSeedInput,
    expected: {
      text: `mongodb://fixture:<SECRET_1>@db0.example.test:27017,db1.example.test:27018/db`,
      findings: [finding("finding-1", mongoSeedInput, connectionPassword, {
        type: "connection_string_password", detector: "connection-string",
        confidence: "high", action: "redact",
      })],
    },
    note: "A comma-separated MongoDB authority may be divided at every boundary.",
  },
  {
    id: "redis-password-only-connection",
    input: redisPasswordOnlyInput,
    expected: {
      text: `redis://:<SECRET_1>@cache.example.test:6379/0`,
      findings: [finding("finding-1", redisPasswordOnlyInput, connectionPassword, {
        type: "connection_string_password", detector: "connection-string",
        confidence: "high", action: "redact",
      })],
    },
    note: "Password-only Redis userinfo remains unresolved until the authority closes.",
  },
  {
    id: "aws-contextual-assignment",
    input: awsContextualInput,
    expected: {
      text: "AWS_SESSION_TOKEN=<SECRET_1>",
      findings: [finding("finding-1", awsContextualInput, contextual, {
        type: "contextual_secret", detector: "generic-token",
        confidence: "high", action: "redact",
      })],
    },
    note: "An AWS-specific high-signal name remains open across assignment partitions.",
  },
  {
    id: "multiline-private-key",
    input: privateKey,
    expected: {
      text: "<SECRET_1>",
      findings: [finding("finding-1", privateKey, privateKey, {
        type: "private_key", detector: "private-key",
        confidence: "high", action: "block",
      })],
    },
    note: "No part of an open PEM block becomes emit-safe before its footer.",
  },
  {
    id: "adjacent-findings",
    input: adjacentInput,
    expected: {
      text: "<SECRET_1> <SECRET_2>",
      findings: [
        finding("finding-1", adjacentInput, aws, {
          type: "aws_access_key_id", detector: "aws-access-key",
          confidence: "high", action: "redact",
        }),
        finding("finding-2", adjacentInput, gitlab, {
          type: "gitlab_token", detector: "gitlab-token",
          confidence: "high", action: "redact",
        }),
      ],
    },
    note: "Finding order and placeholder numbering follow absolute offsets.",
  },
  {
    id: "negative-end-of-stream",
    input: "api_key=SHORT7",
    expected: { text: "api_key=SHORT7", findings: [] },
    note: "Finalization resolves an incomplete-looking negative without redaction.",
  },
  {
    id: "truncated-private-key",
    input: "-----BEGIN PRIVATE KEY-----\nSYNTHETIC_TRUNCATED",
    expected: {
      text: "-----BEGIN PRIVATE KEY-----\nSYNTHETIC_TRUNCATED",
      findings: [],
    },
    note: "A bounded incomplete block is released only by explicit finalization.",
  },
] as const;

/** Every two-chunk partition at a JavaScript UTF-16 code-unit boundary. */
export function codeUnitPartitions(input: string): readonly (readonly string[])[] {
  return Array.from({ length: input.length + 1 }, (_, boundary) =>
    Object.freeze([input.slice(0, boundary), input.slice(boundary)]),
  );
}

/**
 * Every two-chunk partition at a UTF-8 byte boundary, decoded as adapters must
 * decode it: with streaming state retained between byte chunks.
 */
export function utf8BytePartitions(input: string): readonly (readonly string[])[] {
  const bytes = new TextEncoder().encode(input);
  return Array.from({ length: bytes.length + 1 }, (_, boundary) => {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const first = decoder.decode(bytes.slice(0, boundary), { stream: true });
    const second = decoder.decode(bytes.slice(boundary), { stream: true });
    const final = decoder.decode();
    return Object.freeze([first, second, final]);
  });
}

/** A high-fragmentation partition that splits at every UTF-16 code unit. */
export function singleCodeUnitPartition(input: string): readonly string[] {
  return Object.freeze(
    Array.from({ length: input.length }, (_, index) => input.slice(index, index + 1)),
  );
}

/** Consecutive chunks of one fixed UTF-16 code-unit size. */
export function fixedCodeUnitPartition(
  input: string,
  chunkCodeUnits: number,
): readonly string[] {
  if (!Number.isSafeInteger(chunkCodeUnits) || chunkCodeUnits <= 0) {
    throw new TypeError("Invalid incremental partition size.");
  }
  const chunks: string[] = [];
  for (let cursor = 0; cursor < input.length; cursor += chunkCodeUnits) {
    chunks.push(input.slice(cursor, cursor + chunkCodeUnits));
  }
  return Object.freeze(chunks);
}
