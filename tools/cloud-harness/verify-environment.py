#!/usr/bin/env python3
"""Readiness failures and portable release plans; no package or browser downloads."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


environment, plan = load("environment"), load("plan")


class FreshEnvironment(unittest.TestCase):
    def test_missing_executable_is_not_downloaded(self):
        self.assertEqual(environment.version(["/ashveil/definitely-missing-tool", "--version"]), (None, ""))

    def test_versions_are_exact_and_missing_dependencies_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
            def versions(argv):
                return (0, {"node": "v24.22.1", "pnpm": "9.15.9", "chromium": "Chromium 154.0.0.0", "git": "a" * 40}[argv[0]])
            with patch.object(environment, "version", side_effect=versions):
                result = environment.inspect(root, chromium="chromium")
                self.assertFalse(result["ready"])
                self.assertTrue(result["checks"]["node24"]["ok"])
                self.assertTrue(result["checks"]["pnpm9159"]["ok"])
                self.assertEqual(len(result["checks"]["dependencies"]["missing"]), 6)
                for name in result["checks"]["dependencies"]["missing"]:
                    tool = root / "node_modules" / name
                    tool.parent.mkdir(parents=True, exist_ok=True)
                    tool.touch()
                self.assertTrue(environment.inspect(root, chromium="chromium")["ready"])
            with patch.object(environment, "version", return_value=(0, "11.25.0")):
                self.assertFalse(environment.inspect(root, chromium="chromium")["checks"]["pnpm9159"]["ok"])

    def test_partial_checkout_and_absent_chromium_are_not_ready(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(environment, "version", return_value=(None, "")), patch.object(environment.shutil, "which", return_value=None):
            result = environment.inspect(folder)
            self.assertFalse(result["ready"])
            for check in result["checks"].values():
                self.assertFalse(check["ok"])

    def test_release_plan_keeps_exact_root_and_lane_contract(self):
        root = "/tmp/ASHVEIL checkout with spaces"
        result = plan.make_plan(root, profile="release", chromium="/tmp/installed chromium")
        tasks = {task["id"]: task for task in result["tasks"]}
        self.assertEqual(len(tasks), 9)
        self.assertTrue(all(task["cwd"] == root for task in tasks.values()))
        self.assertEqual(tasks["environment"]["argv"][-1], "/tmp/installed chromium")
        self.assertEqual(tasks["full"]["lane"], "heavy")
        self.assertIn("--maxWorkers=2", tasks["full"]["argv"])
        self.assertEqual(tasks["build"]["deps"], ["full", "preview-helper"])
        self.assertEqual(tasks["preview-helper"]["lane"], "heavy")
        self.assertEqual(tasks["smoke"]["deps"], ["build"])
        self.assertTrue(all(tasks[name]["deps"] == ["environment"] for name in ("typecheck", "lint")))
        locale = plan.make_plan(root, profile="release", locale=True)["tasks"][-1]
        self.assertEqual((locale["id"], locale["lane"], locale["kind"], locale["deps"]), ("locale", "heavy", "native", ["smoke"]))

    def test_plan_refuses_existing_evidence_and_check_creates_nothing(self):
        with tempfile.TemporaryDirectory(prefix="ashveil plan ") as folder:
            output = Path(folder) / "plan.json"
            argv = [sys.executable, str(HERE / "plan.py"), "--root", folder, "--out", str(output)]
            self.assertEqual(subprocess.run(argv, capture_output=True).returncode, 0)
            original = output.read_bytes()
            self.assertNotEqual(subprocess.run(argv, capture_output=True).returncode, 0)
            self.assertEqual(output.read_bytes(), original)
            result = subprocess.run([sys.executable, str(HERE / "run.py"), str(output), "--out", str(Path(folder) / "run"), "--check"], capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["tasks"], 6)
            self.assertFalse((Path(folder) / "run").exists())


if __name__ == "__main__":
    unittest.main()
