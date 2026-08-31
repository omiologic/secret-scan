---
convention_id: convention-synthetic-secret-regressions
status: accepted
scope: workspace
strength: default
---

# Convention

Convert every confirmed secret-detection false positive or false negative into
a permanent, unmistakably synthetic regression fixture. Preserve only the
minimum grammar and host context needed to reproduce the defect; never retain,
quote, encode, hash, snapshot, or derive fixture material from a submitted
credential.

Before adding the fixture, record its stable corpus identity and expected safe
metadata, then verify the assertion and failure paths name only that identity
and metadata. If a report cannot be reproduced without retaining submitted
secret material, document the unsupported shape without adding the material.

## Rationale

Permanent fixtures keep repaired detector boundaries reviewable while the
synthetic-only transformation prevents a report from turning the repository or
test diagnostics into another credential exposure path.

## Guidance

The executable intake contract and qualification tiers are documented in the
[conformance corpus](../test/conformance/README.md#regression-intake).
