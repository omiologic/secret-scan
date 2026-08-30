import { describe, expect, it } from "vitest";

import { scanAndRedact } from "../../src/index.js";
import {
  codeUnitPartitions,
  incrementalPartitionCorpus,
  singleCodeUnitPartition,
  utf8BytePartitions,
} from "../conformance/incremental-partitions.js";

describe("incremental contract corpus", () => {
  it.each(incrementalPartitionCorpus.map((fixture) => [fixture.id, fixture] as const))(
    "%s has an exact whole-input reference result",
    (_id, fixture) => {
      expect(scanAndRedact(fixture.input)).toEqual(fixture.expected);
    },
  );

  it.each(incrementalPartitionCorpus.map((fixture) => [fixture.id, fixture] as const))(
    "%s covers every UTF-16 code-unit boundary",
    (_id, fixture) => {
      const partitions = codeUnitPartitions(fixture.input);
      expect(partitions).toHaveLength(fixture.input.length + 1);
      for (const chunks of partitions) expect(chunks.join("")).toBe(fixture.input);
      expect(singleCodeUnitPartition(fixture.input).join("")).toBe(fixture.input);
    },
  );

  it.each(incrementalPartitionCorpus.map((fixture) => [fixture.id, fixture] as const))(
    "%s covers every UTF-8 byte boundary with streaming decoding",
    (_id, fixture) => {
      const byteLength = new TextEncoder().encode(fixture.input).length;
      const partitions = utf8BytePartitions(fixture.input);
      expect(partitions).toHaveLength(byteLength + 1);
      for (const chunks of partitions) expect(chunks.join("")).toBe(fixture.input);
    },
  );

  it("contains positives, negatives, overlaps, Unicode, and finalization cases", () => {
    const ids = new Set(incrementalPartitionCorpus.map(({ id }) => id));
    expect(ids).toEqual(new Set([
      "fixed-width-unicode",
      "variable-provider",
      "structural-overlap",
      "contextual-assignment",
      "encoded-connection",
      "multiline-private-key",
      "adjacent-findings",
      "negative-end-of-stream",
      "truncated-private-key",
    ]));
  });
});
