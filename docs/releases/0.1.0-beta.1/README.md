# 0.1.0-beta.1 publication recovery

Original source: `7bbd345be0604b8c3d50335985e0bfbbbe3703c9` on
`rc/0.1.0-beta.1`. [Release run 34628543780](https://github.com/redact-secret/redact-secret/actions/runs/34628543780)
passed all 60 qualification jobs before publication.

The first attempt published all nine Python distribution files. After the user
verified the crates.io account email and requested retry, the core crate also
published. npm publication was rejected before any package was uploaded, and the
CLI was skipped because the core's HTTP verification used an unidentified curl
User-Agent, which crates.io rejected with HTTP 403.

The workflow also wrote multiline JSON to `GITHUB_OUTPUT`, causing successful
publication to be reported as a job failure and breaking the manifest job.
[manifest.json](manifest.json) reconstructs the observed partial registry state;
it is explicitly marked as reconstructed, not an artifact the failed job created.
[artifact-inventory.json](artifact-inventory.json) is the original run's inventory.
All nine published Python file hashes match it exactly.

Recovery must use that original source and run, verify existing publications,
and publish only missing artifacts. The workflow repair commit is tooling only;
it must not replace the source revision of the already published Python package
or Rust core. The corrected Reconcile Release flow takes `source_run` when the
original manifest upload failed, verifies the source/run/inventory relationship,
and gates its final tag on all registry-install lanes.
