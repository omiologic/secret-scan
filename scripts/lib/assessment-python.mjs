import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { REPO_ROOT } from "./assessment-provenance.mjs";

const WORKER = join(REPO_ROOT, "scripts", "assessment-python-worker.py");

/** Run the narrow Python host adapter without echoing input-bearing failures. */
export function runPythonWorker(python, command, request = undefined) {
  const result = spawnSync(python, [WORKER, command], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    input: request === undefined ? undefined : JSON.stringify(request),
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`installed Python package worker failed during ${command}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`installed Python package worker returned invalid JSON during ${command}`);
  }
}
