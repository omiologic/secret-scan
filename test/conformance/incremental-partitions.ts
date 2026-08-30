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
const adjacentInput = `${aws} ${gitlab}`;

/**
 * Contract fixtures for the future incremental core. All values are synthetic,
 * and expectations contain only the same plaintext-free metadata as public
 * findings. The generator deliberately lives outside runtime source.
 */
export const incrementalPartitionCorpus: readonly IncrementalPartitionCase[] = [
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
