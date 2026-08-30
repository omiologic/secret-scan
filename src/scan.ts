import { defaultSecretPolicy } from "./policy.js";
import { createDetectorRegistry } from "./registry.js";
import type { DetectorRegistry } from "./registry.js";
import { redact } from "./redact.js";
import type {
  DetectedSecretFinding,
  ScanAndRedactOptions,
  ScanOptions,
  ScanResult,
  SecretAction,
  SecretCandidate,
  SecretCandidateSpecificity,
  SecretConfidence,
  SecretDetector,
  SecretFinding,
  SecretPolicy,
} from "./types.js";

export type SecretScanErrorCode =
  | "INVALID_INPUT"
  | "INVALID_OPTIONS"
  | "DETECTOR_FAILURE"
  | "INVALID_CANDIDATE"
  | "POLICY_FAILURE"
  | "INVALID_POLICY_ACTION";

const ERROR_MESSAGES: Readonly<Record<SecretScanErrorCode, string>> = {
  INVALID_INPUT: "Secret scan input must be a string.",
  INVALID_OPTIONS: "Secret scan options are invalid.",
  DETECTOR_FAILURE: "A secret detector failed.",
  INVALID_CANDIDATE: "A secret detector returned an invalid candidate.",
  POLICY_FAILURE: "The secret policy failed.",
  INVALID_POLICY_ACTION: "The secret policy returned an invalid action.",
};

const SPECIFICITY_RANK: Readonly<
  Record<SecretCandidateSpecificity, number>
> = {
  "private-key": 5,
  provider: 4,
  structural: 3,
  contextual: 2,
  entropy: 1,
};

const CONFIDENCE_RANK: Readonly<Record<SecretConfidence, number>> = {
  high: 3,
  medium: 2,
  low: 1,
};

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const MAX_IDENTIFIER_LENGTH = 64;

export class SecretScanError extends Error {
  readonly code: SecretScanErrorCode;

  constructor(code: SecretScanErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "SecretScanError";
    this.code = code;
  }
}

export interface ResolvedSecretCandidate extends DetectedSecretFinding {}

interface RankedCandidate extends Omit<ResolvedSecretCandidate, "id"> {
  readonly specificityRank: number;
  readonly confidenceRank: number;
  readonly detectorOrder: number;
  readonly candidateOrder: number;
}

interface IntervalNode {
  readonly candidate: RankedCandidate;
  left: IntervalNode | undefined;
  right: IntervalNode | undefined;
  height: number;
}

interface IntervalInsertion {
  inserted: boolean;
}

function isSafeIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    IDENTIFIER_PATTERN.test(value)
  );
}

function isConfidence(value: unknown): value is SecretConfidence {
  return value === "high" || value === "medium" || value === "low";
}

function isSpecificity(value: unknown): value is SecretCandidateSpecificity {
  return (
    value === "private-key" ||
    value === "provider" ||
    value === "structural" ||
    value === "contextual" ||
    value === "entropy"
  );
}

function rangeEquals(
  input: string,
  start: number,
  end: number,
  value: string,
): boolean {
  if (end - start !== value.length) return false;
  for (let offset = 0; offset < value.length; offset += 1) {
    if (input.charCodeAt(start + offset) !== value.charCodeAt(offset)) {
      return false;
    }
  }
  return true;
}

function normalizeCandidate(
  input: string,
  detector: SecretDetector,
  candidate: SecretCandidate,
  detectorOrder: number,
  candidateOrder: number,
): RankedCandidate {
  if (typeof candidate !== "object" || candidate === null) {
    throw new SecretScanError("INVALID_CANDIDATE");
  }

  const { type, start, end, confidence } = candidate;
  const specificity = candidate.specificity ?? "entropy";

  if (
    !isSafeIdentifier(type) ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > input.length ||
    !isConfidence(confidence) ||
    !isSpecificity(specificity)
  ) {
    throw new SecretScanError("INVALID_CANDIDATE");
  }

  if (
    rangeEquals(input, start, end, type) ||
    rangeEquals(input, start, end, detector.id)
  ) {
    throw new SecretScanError("INVALID_CANDIDATE");
  }

  return {
    type,
    detector: detector.id,
    confidence,
    start,
    end,
    specificityRank: SPECIFICITY_RANK[specificity],
    confidenceRank: CONFIDENCE_RANK[confidence],
    detectorOrder,
    candidateOrder,
  };
}

function collectCandidates(
  input: string,
  detectors: readonly SecretDetector[],
): RankedCandidate[] {
  const candidates: RankedCandidate[] = [];
  const context = Object.freeze({ inputLength: input.length });

  for (const [detectorOrder, detector] of detectors.entries()) {
    let detected: readonly SecretCandidate[];

    try {
      detected = detector.detect(input, context);
    } catch {
      throw new SecretScanError("DETECTOR_FAILURE");
    }

    if (!Array.isArray(detected)) {
      throw new SecretScanError("INVALID_CANDIDATE");
    }

    for (const [candidateOrder, candidate] of detected.entries()) {
      try {
        candidates.push(
          normalizeCandidate(
            input,
            detector,
            candidate,
            detectorOrder,
            candidateOrder,
          ),
        );
      } catch {
        throw new SecretScanError("INVALID_CANDIDATE");
      }
    }
  }

  return candidates;
}

function compareCandidatePriority(
  left: RankedCandidate,
  right: RankedCandidate,
): number {
  return (
    right.specificityRank - left.specificityRank ||
    right.confidenceRank - left.confidenceRank ||
    left.end - left.start - (right.end - right.start) ||
    left.detectorOrder - right.detectorOrder ||
    left.candidateOrder - right.candidateOrder ||
    left.start - right.start ||
    left.end - right.end ||
    left.type.localeCompare(right.type) ||
    left.detector.localeCompare(right.detector)
  );
}

/**
 * Conflict precedence is specificity, confidence, narrower span, registry
 * order, then detector emission order. This favors precise known formats over
 * broad context while keeping custom-detector ties reproducible.
 */
function prioritizeCandidates(candidates: RankedCandidate[]): RankedCandidate[] {
  return candidates.sort(compareCandidatePriority);
}

function intervalHeight(node: IntervalNode | undefined): number {
  return node?.height ?? 0;
}

function refreshIntervalHeight(node: IntervalNode): void {
  node.height =
    Math.max(intervalHeight(node.left), intervalHeight(node.right)) + 1;
}

function rotateIntervalLeft(node: IntervalNode): IntervalNode {
  const pivot = node.right;
  if (pivot === undefined) return node;

  node.right = pivot.left;
  pivot.left = node;
  refreshIntervalHeight(node);
  refreshIntervalHeight(pivot);
  return pivot;
}

function rotateIntervalRight(node: IntervalNode): IntervalNode {
  const pivot = node.left;
  if (pivot === undefined) return node;

  node.left = pivot.right;
  pivot.right = node;
  refreshIntervalHeight(node);
  refreshIntervalHeight(pivot);
  return pivot;
}

function rebalanceInterval(node: IntervalNode): IntervalNode {
  refreshIntervalHeight(node);
  const balance = intervalHeight(node.left) - intervalHeight(node.right);

  if (balance > 1) {
    if (
      node.left !== undefined &&
      intervalHeight(node.left.left) < intervalHeight(node.left.right)
    ) {
      node.left = rotateIntervalLeft(node.left);
    }
    return rotateIntervalRight(node);
  }

  if (balance < -1) {
    if (
      node.right !== undefined &&
      intervalHeight(node.right.right) < intervalHeight(node.right.left)
    ) {
      node.right = rotateIntervalRight(node.right);
    }
    return rotateIntervalLeft(node);
  }

  return node;
}

function insertDisjointInterval(
  node: IntervalNode | undefined,
  candidate: RankedCandidate,
  insertion: IntervalInsertion,
): IntervalNode {
  if (node === undefined) {
    insertion.inserted = true;
    return {
      candidate,
      left: undefined,
      right: undefined,
      height: 1,
    };
  }

  if (candidate.end <= node.candidate.start) {
    node.left = insertDisjointInterval(node.left, candidate, insertion);
  } else if (candidate.start >= node.candidate.end) {
    node.right = insertDisjointInterval(node.right, candidate, insertion);
  } else {
    return node;
  }

  return insertion.inserted ? rebalanceInterval(node) : node;
}

export function runDetectorPipeline(
  input: string,
  registry: DetectorRegistry,
): readonly ResolvedSecretCandidate[] {
  if (typeof input !== "string") {
    throw new SecretScanError("INVALID_INPUT");
  }

  if (input.length === 0) {
    return Object.freeze([]);
  }

  const accepted: RankedCandidate[] = [];
  let intervalRoot: IntervalNode | undefined;
  const prioritized = prioritizeCandidates(
    collectCandidates(input, registry.detectors),
  );

  for (const candidate of prioritized) {
    const insertion: IntervalInsertion = { inserted: false };
    intervalRoot = insertDisjointInterval(intervalRoot, candidate, insertion);
    if (insertion.inserted) {
      accepted.push(candidate);
    }
  }

  accepted.sort(
    (left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.type.localeCompare(right.type) ||
      left.detector.localeCompare(right.detector),
  );

  return Object.freeze(
    accepted.map((candidate, index) =>
      Object.freeze({
        id: `finding-${index + 1}`,
        type: candidate.type,
        detector: candidate.detector,
        confidence: candidate.confidence,
        start: candidate.start,
        end: candidate.end,
      }),
    ),
  );
}

function isAction(value: unknown): value is SecretAction {
  return (
    value === "redact" ||
    value === "block" ||
    value === "warn" ||
    value === "allow"
  );
}

function resolveScanOptions(options: ScanOptions): {
  readonly registry: DetectorRegistry;
  readonly policy: SecretPolicy;
} {
  if (typeof options !== "object" || options === null) {
    throw new SecretScanError("INVALID_OPTIONS");
  }

  try {
    const detectors = options.detectors;
    if (detectors !== undefined && !Array.isArray(detectors)) {
      throw new TypeError();
    }
    const policy = options.policy ?? defaultSecretPolicy;
    if (
      typeof policy !== "object" ||
      policy === null ||
      typeof policy.evaluate !== "function"
    ) {
      throw new TypeError();
    }
    return {
      registry: createDetectorRegistry(detectors ?? []),
      policy,
    };
  } catch {
    throw new SecretScanError("INVALID_OPTIONS");
  }
}

/** Runs built-in and custom detectors, then applies policy to safe metadata. */
export function scan(
  input: string,
  options: ScanOptions = {},
): readonly SecretFinding[] {
  if (typeof input !== "string") {
    throw new SecretScanError("INVALID_INPUT");
  }
  const { registry, policy } = resolveScanOptions(options);
  const detected = runDetectorPipeline(input, registry);

  return Object.freeze(
    detected.map((finding, findingIndex) => {
      let action: unknown;
      try {
        action = policy.evaluate(
          finding,
          Object.freeze({ findingIndex, findingCount: detected.length }),
        );
      } catch {
        throw new SecretScanError("POLICY_FAILURE");
      }
      if (!isAction(action)) {
        throw new SecretScanError("INVALID_POLICY_ACTION");
      }
      return Object.freeze({ ...finding, action });
    }),
  );
}

/** Scans once, evaluates policy once, and redacts the finalized findings. */
export function scanAndRedact(
  input: string,
  options: ScanAndRedactOptions = {},
): ScanResult {
  const findings = scan(input, options);
  const text = redact(input, findings, options);
  return Object.freeze({ text, findings });
}
