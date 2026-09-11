from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
import unittest.mock
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "run-sast.py"
SPEC = importlib.util.spec_from_file_location("run_sast", SCRIPT)
assert SPEC and SPEC.loader
RUN_SAST = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = RUN_SAST
SPEC.loader.exec_module(RUN_SAST)


def raw_result(check_id: str, path: str, start_line: int, end_line: int, severity: str = "WARNING") -> dict:
    return {
        "check_id": check_id,
        "path": path,
        "start": {"line": start_line, "col": 1},
        "end": {"line": end_line, "col": 1},
        "extra": {"severity": severity, "message": "example message"},
    }


class ComputeRulesDigestTest(unittest.TestCase):
    def test_digest_is_stable_for_the_same_content(self) -> None:
        with tempfile.TemporaryDirectory() as rules_dir:
            rules = Path(rules_dir)
            (rules / "a.yml").write_text("rules: []\n", encoding="utf-8")
            first = RUN_SAST.compute_rules_digest(rules)
            second = RUN_SAST.compute_rules_digest(rules)
            self.assertEqual(first, second)

    def test_digest_changes_when_a_rule_file_is_edited(self) -> None:
        with tempfile.TemporaryDirectory() as rules_dir:
            rules = Path(rules_dir)
            (rules / "a.yml").write_text("rules: []\n", encoding="utf-8")
            before = RUN_SAST.compute_rules_digest(rules)
            (rules / "a.yml").write_text("rules: [edited]\n", encoding="utf-8")
            after = RUN_SAST.compute_rules_digest(rules)
            self.assertNotEqual(before, after, "a tampered/edited vendored rule must change the pinned digest")

    def test_digest_ignores_license_upstream(self) -> None:
        with tempfile.TemporaryDirectory() as rules_dir:
            rules = Path(rules_dir)
            (rules / "a.yml").write_text("rules: []\n", encoding="utf-8")
            before = RUN_SAST.compute_rules_digest(rules)
            (rules / "LICENSE.upstream").write_text("some license text\n", encoding="utf-8")
            after = RUN_SAST.compute_rules_digest(rules)
            self.assertEqual(before, after)

    def test_digest_is_independent_of_file_system_iteration_order(self) -> None:
        with tempfile.TemporaryDirectory() as rules_dir:
            rules = Path(rules_dir)
            (rules / "z.yml").write_text("rules: [z]\n", encoding="utf-8")
            (rules / "a.yml").write_text("rules: [a]\n", encoding="utf-8")
            first = RUN_SAST.compute_rules_digest(rules)
            (rules / "z.yml").unlink()
            (rules / "z.yml").write_text("rules: [z]\n", encoding="utf-8")
            second = RUN_SAST.compute_rules_digest(rules)
            self.assertEqual(first, second)


class NormalizeReportTest(unittest.TestCase):
    def test_findings_never_carry_the_matched_source_snippet(self) -> None:
        raw = {"results": [raw_result("rule.id", "src/app.py", 10, 10)], "errors": []}
        report = RUN_SAST.normalize_report(
            raw=raw, tool_version="1.30.0", rules_digest="deadbeef", source_revision="abc123"
        )
        finding = report["findings"][0]
        self.assertEqual(set(finding), {"id", "rule_id", "path", "start_line", "end_line", "severity", "message"})
        self.assertNotIn("lines", finding)
        self.assertNotIn("extra", finding)

    def test_finding_id_is_stable_across_runs(self) -> None:
        raw = {"results": [raw_result("rule.id", "src/app.py", 10, 10)], "errors": []}
        first = RUN_SAST.normalize_report(raw=raw, tool_version="v", rules_digest="d", source_revision="r")
        second = RUN_SAST.normalize_report(raw=raw, tool_version="v", rules_digest="d", source_revision="r")
        self.assertEqual(first["findings"][0]["id"], second["findings"][0]["id"])

    def test_finding_id_changes_when_location_changes(self) -> None:
        raw_a = {"results": [raw_result("rule.id", "src/app.py", 10, 10)], "errors": []}
        raw_b = {"results": [raw_result("rule.id", "src/app.py", 11, 11)], "errors": []}
        a = RUN_SAST.normalize_report(raw=raw_a, tool_version="v", rules_digest="d", source_revision="r")
        b = RUN_SAST.normalize_report(raw=raw_b, tool_version="v", rules_digest="d", source_revision="r")
        self.assertNotEqual(a["findings"][0]["id"], b["findings"][0]["id"])

    def test_normalizes_bare_string_error_type(self) -> None:
        raw = {"results": [], "errors": [{"type": "Timeout", "path": "src/slow.py", "message": "rule timed out"}]}
        report = RUN_SAST.normalize_report(raw=raw, tool_version="v", rules_digest="d", source_revision="r")
        self.assertEqual(len(report["errors"]), 1)
        self.assertEqual(report["errors"][0]["type"], "Timeout")
        self.assertEqual(report["errors"][0]["path"], "src/slow.py")

    def test_normalizes_partial_parsing_pair_error_type(self) -> None:
        raw = {
            "results": [],
            "errors": [
                {
                    "type": ["PartialParsing", [{"path": "workflow.yml", "start": {"line": 42}}]],
                    "message": "Syntax error at line workflow.yml:42",
                }
            ],
        }
        report = RUN_SAST.normalize_report(raw=raw, tool_version="v", rules_digest="d", source_revision="r")
        error = report["errors"][0]
        self.assertEqual(error["type"], "PartialParsing")
        self.assertEqual(error["path"], "workflow.yml")
        self.assertEqual(error["line"], 42)

    def test_report_never_carries_a_raw_code_snippet_field(self) -> None:
        raw = {
            "results": [
                {
                    **raw_result("rule.id", "src/app.py", 10, 10),
                    "extra": {
                        "severity": "WARNING",
                        "message": "example message",
                        "lines": "sk_live_should_never_appear_in_a_report",
                    },
                }
            ],
            "errors": [],
        }
        report = RUN_SAST.normalize_report(raw=raw, tool_version="v", rules_digest="d", source_revision="r")
        rendered = str(report)
        self.assertNotIn("sk_live_should_never_appear_in_a_report", rendered)


class CheckBaselineTest(unittest.TestCase):
    def make_report(self, findings=(), errors=()) -> dict:
        return {"findings": list(findings), "errors": list(errors)}

    def test_unclassified_finding_fails(self) -> None:
        report = self.make_report(findings=[{"id": "f1", "rule_id": "r", "path": "p", "start_line": 1}])
        problems = RUN_SAST.check_baseline(report, {"findings": {}, "known_errors": {}})
        self.assertTrue(any("UNCLASSIFIED" in p for p in problems))

    def test_false_positive_and_hardening_pass(self) -> None:
        report = self.make_report(
            findings=[
                {"id": "f1", "rule_id": "r", "path": "p", "start_line": 1},
                {"id": "f2", "rule_id": "r", "path": "p", "start_line": 2},
            ]
        )
        baseline = {
            "findings": {
                "f1": {"classification": "false_positive", "rationale": "not exploitable"},
                "f2": {"classification": "hardening", "rationale": "nice to have"},
            },
            "known_errors": {},
        }
        self.assertEqual(RUN_SAST.check_baseline(report, baseline), [])

    def test_blocking_classification_still_fails_the_run(self) -> None:
        report = self.make_report(findings=[{"id": "f1", "rule_id": "r", "path": "p", "start_line": 1}])
        baseline = {
            "findings": {"f1": {"classification": "blocking", "rationale": "real bug, must fix"}},
            "known_errors": {},
        }
        problems = RUN_SAST.check_baseline(report, baseline)
        self.assertTrue(any("BLOCKING" in p for p in problems))

    def test_invalid_classification_fails(self) -> None:
        report = self.make_report(findings=[{"id": "f1", "rule_id": "r", "path": "p", "start_line": 1}])
        baseline = {"findings": {"f1": {"classification": "wontfix"}}, "known_errors": {}}
        problems = RUN_SAST.check_baseline(report, baseline)
        self.assertTrue(any("invalid classification" in p for p in problems))

    def test_unacknowledged_scan_error_fails(self) -> None:
        report = self.make_report(errors=[{"id": "e1", "type": "Timeout", "path": "p", "line": 1}])
        problems = RUN_SAST.check_baseline(report, {"findings": {}, "known_errors": {}})
        self.assertTrue(any("UNACKNOWLEDGED" in p for p in problems))

    def test_acknowledged_scan_error_passes(self) -> None:
        report = self.make_report(errors=[{"id": "e1", "type": "Timeout", "path": "p", "line": 1}])
        baseline = {"findings": {}, "known_errors": {"e1": {"rationale": "known slow file"}}}
        self.assertEqual(RUN_SAST.check_baseline(report, baseline), [])

    def test_missing_baseline_file_treats_every_finding_as_unclassified(self) -> None:
        baseline = RUN_SAST.load_baseline(Path("/nonexistent/sast/baseline.json"))
        report = self.make_report(findings=[{"id": "f1", "rule_id": "r", "path": "p", "start_line": 1}])
        problems = RUN_SAST.check_baseline(report, baseline)
        self.assertTrue(any("UNCLASSIFIED" in p for p in problems))


class BuildSarifTest(unittest.TestCase):
    def make_report(self, findings=()) -> dict:
        return {"tool_version": "1.30.0", "findings": list(findings), "errors": []}

    def test_sarif_has_required_top_level_shape(self) -> None:
        sarif = RUN_SAST.build_sarif(report=self.make_report(), baseline={})
        self.assertEqual(sarif["version"], "2.1.0")
        self.assertIn("$schema", sarif)
        run = sarif["runs"][0]
        self.assertEqual(run["tool"]["driver"]["name"], "OpenGrep")
        self.assertEqual(run["tool"]["driver"]["version"], "1.30.0")
        self.assertEqual(run["results"], [])

    def test_blocking_finding_is_not_suppressed(self) -> None:
        report = self.make_report(
            findings=[
                {
                    "id": "f1",
                    "rule_id": "r.id",
                    "path": "src/app.py",
                    "start_line": 10,
                    "end_line": 10,
                    "severity": "ERROR",
                    "message": "example message",
                }
            ]
        )
        baseline = {"findings": {"f1": {"classification": "blocking", "rationale": "real bug"}}}
        sarif = RUN_SAST.build_sarif(report=report, baseline=baseline)
        result = sarif["runs"][0]["results"][0]
        self.assertEqual(result["ruleId"], "r.id")
        self.assertEqual(result["level"], "error")
        self.assertNotIn("suppressions", result)

    def test_unclassified_finding_is_not_suppressed(self) -> None:
        report = self.make_report(
            findings=[
                {
                    "id": "f1",
                    "rule_id": "r.id",
                    "path": "src/app.py",
                    "start_line": 10,
                    "end_line": 10,
                    "severity": "WARNING",
                    "message": "example message",
                }
            ]
        )
        sarif = RUN_SAST.build_sarif(report=report, baseline={"findings": {}})
        self.assertNotIn("suppressions", sarif["runs"][0]["results"][0])

    def test_false_positive_and_hardening_are_suppressed_with_rationale(self) -> None:
        report = self.make_report(
            findings=[
                {
                    "id": "f1",
                    "rule_id": "r.id",
                    "path": "src/app.py",
                    "start_line": 10,
                    "end_line": 10,
                    "severity": "WARNING",
                    "message": "m1",
                },
                {
                    "id": "f2",
                    "rule_id": "r.id",
                    "path": "src/app.py",
                    "start_line": 20,
                    "end_line": 20,
                    "severity": "INFO",
                    "message": "m2",
                },
            ]
        )
        baseline = {
            "findings": {
                "f1": {"classification": "false_positive", "rationale": "not exploitable here"},
                "f2": {"classification": "hardening", "rationale": "nice to have"},
            }
        }
        sarif = RUN_SAST.build_sarif(report=report, baseline=baseline)
        results = sarif["runs"][0]["results"]
        self.assertEqual(results[0]["suppressions"][0]["justification"], "not exploitable here")
        self.assertEqual(results[0]["suppressions"][0]["kind"], "external")
        self.assertEqual(results[1]["suppressions"][0]["justification"], "nice to have")

    def test_sarif_never_carries_the_matched_source_snippet(self) -> None:
        report = self.make_report(
            findings=[
                {
                    "id": "f1",
                    "rule_id": "r.id",
                    "path": "src/app.py",
                    "start_line": 10,
                    "end_line": 10,
                    "severity": "WARNING",
                    "message": "the rule's own message, no matched text",
                }
            ]
        )
        sarif = RUN_SAST.build_sarif(report=report, baseline={"findings": {}})
        rendered = json.dumps(sarif)
        self.assertNotIn("sk_live_should_never_appear_in_a_report", rendered)
        self.assertIn("the rule's own message", rendered)

    def test_unknown_severity_falls_back_to_warning_rather_than_dropping_the_result(self) -> None:
        report = self.make_report(
            findings=[
                {
                    "id": "f1",
                    "rule_id": "r.id",
                    "path": "src/app.py",
                    "start_line": 10,
                    "end_line": 10,
                    "severity": "UNKNOWN",
                    "message": "m",
                }
            ]
        )
        sarif = RUN_SAST.build_sarif(report=report, baseline={"findings": {}})
        self.assertEqual(sarif["runs"][0]["results"][0]["level"], "warning")


class MainFailClosedTest(unittest.TestCase):
    def test_run_scan_fails_closed_on_empty_stdout(self) -> None:
        completed = unittest.mock.Mock(stdout="", stderr="opengrep crashed", returncode=2)
        with unittest.mock.patch.object(RUN_SAST.subprocess, "run", return_value=completed):
            with self.assertRaises(RuntimeError):
                RUN_SAST.run_scan(
                    opengrep_binary=Path("/usr/bin/opengrep"),
                    rules_dir=Path("/tmp/rules"),
                    repo_root=Path("/tmp/repo"),
                    timeout=30,
                    targets=[],
                )

    def test_run_scan_propagates_a_subprocess_timeout(self) -> None:
        timeout_error = RUN_SAST.subprocess.TimeoutExpired(cmd=["opengrep"], timeout=30)
        with unittest.mock.patch.object(RUN_SAST.subprocess, "run", side_effect=timeout_error):
            with self.assertRaises(RUN_SAST.subprocess.TimeoutExpired):
                RUN_SAST.run_scan(
                    opengrep_binary=Path("/usr/bin/opengrep"),
                    rules_dir=Path("/tmp/rules"),
                    repo_root=Path("/tmp/repo"),
                    timeout=30,
                    targets=[],
                )

    def test_run_scan_fails_closed_on_malformed_json_output(self) -> None:
        completed = unittest.mock.Mock(stdout="not valid json{{{", stderr="", returncode=0)
        with unittest.mock.patch.object(RUN_SAST.subprocess, "run", return_value=completed):
            with self.assertRaises(json.JSONDecodeError):
                RUN_SAST.run_scan(
                    opengrep_binary=Path("/usr/bin/opengrep"),
                    rules_dir=Path("/tmp/rules"),
                    repo_root=Path("/tmp/repo"),
                    timeout=30,
                    targets=[],
                )

    def test_main_fails_closed_when_rules_digest_does_not_match_the_pinned_lock(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            root = Path(root_dir)
            rules = root / "rules"
            rules.mkdir()
            (rules / "a.yml").write_text("rules: []\n", encoding="utf-8")
            lock = root / "opengrep.lock.json"
            lock.write_text(
                RUN_SAST.json.dumps({"opengrep_version": "1.30.0", "rules": {"digest": "not-the-real-digest"}}),
                encoding="utf-8",
            )
            baseline = root / "baseline.json"
            baseline.write_text("{}", encoding="utf-8")
            exit_code = RUN_SAST.main(
                [
                    "--repo-root",
                    str(root),
                    "--lock",
                    str(lock),
                    "--rules",
                    str(rules),
                    "--baseline",
                    str(baseline),
                ]
            )
            self.assertEqual(exit_code, 1)


if __name__ == "__main__":
    unittest.main()
