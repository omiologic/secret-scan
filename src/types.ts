export type SecretConfidence = "high" | "medium" | "low";

export type SecretAction = "redact" | "block" | "warn" | "allow";

export type SecretCandidateSpecificity =
  | "private-key"
  | "provider"
  | "structural"
  | "contextual"
  | "entropy";

export interface DetectorContext {
  readonly inputLength: number;
}

export interface SecretCandidate {
  readonly type: string;
  readonly detector: string;
  readonly start: number;
  readonly end: number;
  readonly confidence: SecretConfidence;
  readonly specificity?: SecretCandidateSpecificity;
  readonly signals?: readonly string[];
}

export interface SecretDetector {
  readonly id: string;
  detect(input: string, context: DetectorContext): readonly SecretCandidate[];
}

export interface DetectedSecretFinding {
  readonly id: string;
  readonly type: string;
  readonly detector: string;
  readonly confidence: SecretConfidence;
  readonly start: number;
  readonly end: number;
}

export interface SecretFinding extends DetectedSecretFinding {
  readonly action: SecretAction;
}

export interface PolicyContext {
  /** Zero-based position in the finalized detection list. */
  readonly findingIndex: number;
  readonly findingCount: number;
}

export interface SecretPolicy {
  evaluate(
    finding: DetectedSecretFinding,
    context: PolicyContext,
  ): SecretAction;
}

export interface ScanOptions {
  readonly detectors?: readonly SecretDetector[];
  readonly policy?: SecretPolicy;
}

export interface PlaceholderContext {
  /** One-based position among findings that are actually replaced. */
  readonly placeholderIndex: number;
}

export type PlaceholderFormatter = (
  finding: SecretFinding,
  context: PlaceholderContext,
) => string;

export interface RedactOptions {
  readonly placeholderFormatter?: PlaceholderFormatter;
}

export interface ScanAndRedactOptions extends ScanOptions, RedactOptions {}

export interface ScanResult {
  readonly text: string;
  readonly findings: readonly SecretFinding[];
}
