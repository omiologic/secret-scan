import { calculateShannonEntropy } from "../entropy.js";
import type {
  SecretCandidate,
  SecretConfidence,
  SecretDetector,
} from "../types.js";

const ASSIGNMENT_PATTERN =
  /(?:^|[\s{,;])["']?([A-Za-z][A-Za-z0-9_.-]*)["']?\s*(?:=|:)\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s,;}\]"'\r\n]+))/gm;
const AUTHORIZATION_PATTERN =
  /(?:^|[\r\n])[ \t]*authorization[ \t]*:[ \t]*(basic|token)[ \t]+([A-Za-z0-9+/=_-]{12,})/gim;

const HIGH_SIGNAL_NAMES = new Set([
  "api_key",
  "apikey",
  "secret",
  "secret_key",
  "access_token",
  "refresh_token",
  "session_token",
  "password",
  "passwd",
  "private_key",
  "client_secret",
  "webhook_secret",
]);

const AMBIGUOUS_NAMES = new Set([
  "auth",
  "auth_token",
  "credential",
  "credentials",
  "signing_key",
]);

const MIN_CONTEXT_VALUE_LENGTH = 8;
const MIN_HIGH_ENTROPY_LENGTH = 16;
const HIGH_ENTROPY_THRESHOLD = 3;
const AMBIGUOUS_ENTROPY_THRESHOLD = 3.5;
const MAX_CONTEXT_VALUE_LENGTH = 4_096;

/** Internal retention hint for the built-in incremental scanner. */
export function hasOpenContextualAssignment(input: string): boolean {
  const match =
    /(?:^|[\s{,;])["']?([A-Za-z][A-Za-z0-9_.-]*)["']?\s*(?:(?:=|:)\s*)?$/.exec(
      input,
    );
  const name = match?.[1];
  if (name === undefined) return false;
  const normalized = normalizeName(name);
  return HIGH_SIGNAL_NAMES.has(normalized) || AMBIGUOUS_NAMES.has(normalized);
}

function normalizeName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[.-]/g, "_");
}

function isNonSecretReference(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    /^(?:example|sample|placeholder|redacted|changeme|password|secret|replace[_-]?me)$/.test(
      normalized,
    ) ||
    /^(?:true|false|null|undefined|\d+)$/.test(normalized) ||
    /^(?:\$\{|\$[a-z_]|process\.env\.|import\.meta\.env\.)/i.test(value) ||
    /^(?:<[^>]+>|\.{0,2}\/)/.test(value) ||
    /\.(?:key|pem)$/i.test(value)
  );
}

function assignmentConfidence(
  name: string,
  value: string,
): SecretConfidence | undefined {
  if (
    value.length < MIN_CONTEXT_VALUE_LENGTH ||
    value.length > MAX_CONTEXT_VALUE_LENGTH ||
    isNonSecretReference(value)
  ) {
    return undefined;
  }

  const entropy = calculateShannonEntropy(value);
  if (HIGH_SIGNAL_NAMES.has(name)) {
    return value.length >= MIN_HIGH_ENTROPY_LENGTH &&
      entropy >= HIGH_ENTROPY_THRESHOLD
      ? "high"
      : "medium";
  }

  if (
    AMBIGUOUS_NAMES.has(name) &&
    value.length >= MIN_HIGH_ENTROPY_LENGTH &&
    entropy >= AMBIGUOUS_ENTROPY_THRESHOLD
  ) {
    return "medium";
  }

  return undefined;
}

function assignmentCandidates(input: string): SecretCandidate[] {
  const candidates: SecretCandidate[] = [];
  for (const match of input.matchAll(ASSIGNMENT_PATTERN)) {
    const nameValue = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    const whole = match[0];
    const matchStart = match.index;
    if (
      nameValue === undefined ||
      value === undefined ||
      whole === undefined ||
      matchStart === undefined
    ) {
      continue;
    }

    const name = normalizeName(nameValue);
    const confidence = assignmentConfidence(name, value);
    if (confidence === undefined) continue;

    const relativeStart = whole.lastIndexOf(value);
    const start = matchStart + relativeStart;
    candidates.push({
      type: "contextual_secret",
      detector: "generic-token",
      confidence,
      specificity: "contextual",
      signals: [
        HIGH_SIGNAL_NAMES.has(name) ? "high-signal-name" : "ambiguous-name",
        confidence === "high" ? "bounded-entropy" : "context-only",
      ],
      start,
      end: start + value.length,
    });
  }
  return candidates;
}

function authorizationCandidates(input: string): SecretCandidate[] {
  const candidates: SecretCandidate[] = [];
  for (const match of input.matchAll(AUTHORIZATION_PATTERN)) {
    const scheme = match[1];
    const value = match[2];
    const whole = match[0];
    const matchStart = match.index;
    if (
      scheme === undefined ||
      value === undefined ||
      whole === undefined ||
      matchStart === undefined ||
      isNonSecretReference(value)
    ) {
      continue;
    }

    const relativeStart = whole.lastIndexOf(value);
    const start = matchStart + relativeStart;
    const confidence =
      value.length >= MIN_HIGH_ENTROPY_LENGTH &&
      calculateShannonEntropy(value) >= HIGH_ENTROPY_THRESHOLD
        ? "high"
        : "medium";
    candidates.push({
      type: "authorization_credential",
      detector: "generic-token",
      confidence,
      specificity: "structural",
      signals: [`authorization-${scheme.toLowerCase()}-scheme`],
      start,
      end: start + value.length,
    });
  }
  return candidates;
}

/**
 * Combines explicit credential names or authorization syntax with bounded
 * entropy. A plain `token` name and entropy-only text intentionally produce no
 * candidates. Values above 4 KiB are left to more specific detectors.
 */
export const genericTokenDetector: SecretDetector = Object.freeze({
  id: "generic-token",
  detect(input: string): readonly SecretCandidate[] {
    return [...assignmentCandidates(input), ...authorizationCandidates(input)];
  },
});
