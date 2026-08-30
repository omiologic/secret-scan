import type {
  IncrementalSanitizer,
  IncrementalSanitizerOptions,
  ScanOptions,
  ScanResult,
  SecretCandidate,
  SecretCandidateSpecificity,
  SecretDetector,
  SecretFinding,
  SecretPolicy,
} from "../src/index.js";
import { createIncrementalSanitizer } from "../src/index.js";

const detector: SecretDetector = {
  id: "synthetic-detector",
  detect(_input, context) {
    return context.inputLength === 0
      ? []
      : [
          {
            type: "synthetic_credential",
            detector: this.id,
            start: 0,
            end: context.inputLength,
            confidence: "high",
          },
        ];
  },
};

const policy: SecretPolicy = {
  evaluate(_finding, _context) {
    return "redact";
  },
};

const options: ScanOptions = { detectors: [detector], policy };

const finding: SecretFinding = {
  id: "finding-1",
  type: "synthetic_credential",
  detector: detector.id,
  confidence: "high",
  action: "redact",
  start: 0,
  end: 1,
};

const result: ScanResult = { text: "<SECRET_1>", findings: [finding] };
const specificity: SecretCandidateSpecificity = "provider";
const candidate: SecretCandidate = {
  type: "synthetic_credential",
  detector: detector.id,
  confidence: "high",
  specificity,
  start: 0,
  end: 1,
};

type FindingHasNoPlaintextValue = "value" extends keyof SecretFinding
  ? never
  : true;

const findingHasNoPlaintextValue: FindingHasNoPlaintextValue = true;

const incrementalOptions: IncrementalSanitizerOptions = {
  limits: {
    maxInputCodeUnits: 4_096,
    maxBufferedCodeUnits: 2_176,
    maxTokenCodeUnits: 1_024,
    maxMultilineCodeUnits: 2_048,
  },
  policy: {
    evaluate(_finding, context) {
      return context.findingIndex === 0 ? "redact" : "warn";
    },
  },
};
const incremental: IncrementalSanitizer = createIncrementalSanitizer(incrementalOptions);

void options;
void result;
void candidate;
void findingHasNoPlaintextValue;
void incremental;
