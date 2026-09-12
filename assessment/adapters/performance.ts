import type {
  AssessmentDistribution,
  AssessmentMemoryMetric,
  AssessmentMemorySample,
} from "../schema.js";

export function measureOperation<T>(
  now: () => number,
  operation: () => T,
): { readonly elapsedMs: number; readonly value: T } {
  const start = now();
  const value = operation();
  return { elapsedMs: now() - start, value };
}

export async function measureAsyncOperation<T>(
  now: () => number,
  operation: () => Promise<T>,
): Promise<{ readonly elapsedMs: number; readonly value: T }> {
  const start = now();
  const value = await operation();
  return { elapsedMs: now() - start, value };
}

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.ceil(fraction * sorted.length) - 1] ?? 0;
}

/** Preserve raw samples and derive a deterministic population distribution. */
export function summarizeDistribution(
  samples: readonly number[],
  unit: AssessmentDistribution["unit"],
): AssessmentDistribution {
  if (samples.length === 0 || samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
    throw new TypeError("performance samples must be finite, non-negative, and non-empty");
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const variance = samples.reduce((sum, sample) => sum + (sample - mean) ** 2, 0) /
    samples.length;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
  return {
    unit,
    samples: [...samples],
    minimum: sorted[0] ?? 0,
    median,
    p95: percentile(sorted, 0.95),
    maximum: sorted.at(-1) ?? 0,
    mean,
    standardDeviation: Math.sqrt(variance),
  };
}

export function availableMemory(
  samples: readonly AssessmentMemorySample[],
  samplingLimit: string,
): AssessmentMemoryMetric {
  if (samples.length === 0) throw new TypeError("available memory needs samples");
  return { unit: "bytes", samples: [...samples], samplingLimit };
}

export function unavailableMemory(
  unavailableReason: string,
  samplingLimit: string,
): AssessmentMemoryMetric {
  if (unavailableReason.length === 0 || samplingLimit.length === 0) {
    throw new TypeError("unavailable memory needs a reason and sampling limit");
  }
  return { unit: "bytes", samples: [], unavailableReason, samplingLimit };
}
