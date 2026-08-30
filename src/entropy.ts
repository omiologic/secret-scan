/**
 * Returns Shannon entropy in bits per Unicode code point. Entropy is a
 * supporting classification signal only; callers must not treat it as proof
 * that an otherwise unstructured value is a secret.
 */
export function calculateShannonEntropy(input: string): number {
  if (input.length === 0) return 0;

  const frequencies = new Map<string, number>();
  let symbolCount = 0;
  for (const symbol of input) {
    frequencies.set(symbol, (frequencies.get(symbol) ?? 0) + 1);
    symbolCount += 1;
  }

  let entropy = 0;
  for (const frequency of frequencies.values()) {
    const probability = frequency / symbolCount;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}
