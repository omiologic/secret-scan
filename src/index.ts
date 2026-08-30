export { DetectorRegistry, createDetectorRegistry } from "./registry.js";
export {
  anthropicTokenDetector,
  awsAccessKeyDetector,
  bearerTokenDetector,
  builtInDetectors,
  connectionStringDetector,
  genericTokenDetector,
  githubTokenDetector,
  gitlabTokenDetector,
  jwtDetector,
  openAiTokenDetector,
  privateKeyDetector,
  shopifyTokenDetector,
  vaultTokenDetector,
} from "./detectors/index.js";
export { calculateShannonEntropy } from "./entropy.js";
export { defaultSecretPolicy } from "./policy.js";
export {
  defaultPlaceholderFormatter,
  redact,
  SecretRedactionError,
  typedPlaceholderFormatter,
} from "./redact.js";
export { scan, scanAndRedact, SecretScanError } from "./scan.js";
export type { SecretRedactionErrorCode } from "./redact.js";
export type { SecretScanErrorCode } from "./scan.js";

export type {
  DetectorContext,
  DetectedSecretFinding,
  PlaceholderContext,
  PlaceholderFormatter,
  PolicyContext,
  RedactOptions,
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
