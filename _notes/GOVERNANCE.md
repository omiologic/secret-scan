---
schema_version: 3
project_key: secret-scan
canonical_ids_from: "2026-08-30T17:17:12Z"
last_work_item_sequence: 24
profile: minimal
git_governance:
  branch_strategy: feature-branch
  branch_lifecycle: short-lived
  branch_pattern: "{type}/{work_item_id}-{slug}"
  commit_style: conventional
  require_work_item_reference: true
  merge_strategy: squash
  review_required: true
  protected_branches:
    - main
version_governance:
  scheme: semver
  compatibility: semver
  compatibility_source: README.md
  release_channels:
    - stable
    - beta
  stable_channel: stable
  prerelease_channels:
    - beta
  tag_pattern: "v{version}"
  changelog: required
  release_authority: AGENTS.md
---

# Planning governance

## Rationale

Use dependency- and outcome-driven planning without additional methodology dimensions.

## Cadence

Planning is event-driven.

## Revisit when

Revisit this profile when repeated work requires an explicit phase, sprint, epic, or feature catalog.
