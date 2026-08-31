export { DetectorRegistry, createDetectorRegistry } from "./registry.js";
export {
  anthropicTokenDetector,
  awsAccessKeyDetector,
  bearerTokenDetector,
  builtInDetectors,
  cloudflareTokenDetector,
  connectionStringDetector,
  digitalOceanTokenDetector,
  dockerTokenDetector,
  genericTokenDetector,
  githubTokenDetector,
  gitlabTokenDetector,
  huggingFaceTokenDetector,
  jwtDetector,
  linearTokenDetector,
  openAiTokenDetector,
  privateKeyDetector,
  pypiTokenDetector,
  shopifyTokenDetector,
  slackTokenDetector,
  stripeTokenDetector,
  supabaseTokenDetector,
  vaultTokenDetector,
  vercelTokenDetector,
} from "./detectors/index.js";
export { calculateShannonEntropy } from "./entropy.js";
export { defaultIncrementalSecretPolicy, defaultSecretPolicy } from "./policy.js";
export {
  createIncrementalSanitizer,
  IncrementalSanitizerError,
} from "./incremental.js";
export type { IncrementalSanitizerErrorCode } from "./incremental.js";
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
  IncrementalLimits,
  IncrementalPolicyContext,
  IncrementalSanitizer,
  IncrementalSanitizerOptions,
  IncrementalSanitizerResult,
  IncrementalSanitizerState,
  IncrementalSecretPolicy,
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
