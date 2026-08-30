import { builtInDetectors } from "./detectors/index.js";
import type {
  DetectorContext,
  SecretCandidate,
  SecretDetector,
} from "./types.js";

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const MAX_IDENTIFIER_LENGTH = 64;

function normalizeDetector(detector: SecretDetector): SecretDetector {
  try {
    if (typeof detector !== "object" || detector === null) {
      throw new TypeError();
    }

    const { id, detect } = detector;
    if (
      typeof id !== "string" ||
      id.length > MAX_IDENTIFIER_LENGTH ||
      !IDENTIFIER_PATTERN.test(id) ||
      typeof detect !== "function"
    ) {
      throw new TypeError();
    }

    return Object.freeze({
      id,
      detect(
        input: string,
        context: DetectorContext,
      ): readonly SecretCandidate[] {
        return detect.call(detector, input, context);
      },
    });
  } catch {
    throw new TypeError("Invalid detector registration.");
  }
}

export class DetectorRegistry {
  readonly #detectors: SecretDetector[] = [];
  readonly #ids = new Set<string>();

  constructor(detectors: readonly SecretDetector[] = []) {
    for (const detector of detectors) {
      this.register(detector);
    }
  }

  register(detector: SecretDetector): this {
    const normalized = normalizeDetector(detector);
    if (this.#ids.has(normalized.id)) {
      throw new TypeError("Invalid detector registration.");
    }

    this.#ids.add(normalized.id);
    this.#detectors.push(normalized);
    return this;
  }

  get detectors(): readonly SecretDetector[] {
    return Object.freeze([...this.#detectors]);
  }
}

export function createDetectorRegistry(
  customDetectors: readonly SecretDetector[] = [],
): DetectorRegistry {
  return new DetectorRegistry([...builtInDetectors, ...customDetectors]);
}
