"""Real Windows lock/process-tree checks, including parent-exited descendants."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import importlib.util

if sys.platform != "win32":
    raise SystemExit("This verification requires Windows; use verify.py on POSIX.")

from windows import acquire_windows, WindowsProcess, kernel
import ctypes
from ctypes import wintypes

HERE = Path(__file__).resolve().parent
kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel.OpenProcess.restype = wintypes.HANDLE
kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
kernel.WaitForSingleObject.restype = wintypes.DWORD


def alive(pid):
    handle = kernel.OpenProcess(0x100000, False, pid)  # SYNCHRONIZE; no signal sent
    if not handle:
        return False
    try:
        return kernel.WaitForSingleObject(handle, 0) == 258  # WAIT_TIMEOUT
    finally:
        kernel.CloseHandle(handle)


def until(predicate):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.02)
    raise AssertionError("Timed out waiting for subprocess marker/state")


if len(sys.argv) > 1 and sys.argv[1] == "--lock-child":
    root, lane, name = Path(sys.argv[2]), sys.argv[3], sys.argv[4]
    with acquire_windows(root, lane, threading.Event()):
        (root / (name + ".started")).touch()
        until(lambda: (root / (name + ".release")).exists())
    raise SystemExit(0)


class WindowsContracts(unittest.TestCase):
    def test_native_path_spellings_keep_lane_and_checkpoint_contracts(self):
        spec=importlib.util.spec_from_file_location("ashveil_runner",HERE / "run.py")
        runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
        self.assertTrue(runner.command_is_heavy([r"C:\tools\node.exe",r"tests\e2e\smoke.ts"]))
        self.assertTrue(runner.command_is_heavy([r"C:\tools\pnpm.cmd","test"]))
        self.assertFalse(runner.command_is_heavy([r"C:\tools\node.exe",r"tools\game-harness.mjs","--check"]))
        self.assertTrue(runner.command_can_mutate_source([r"C:\tools\git.exe","restore","."]))

    def test_two_light_slots_and_exclusive_heavy_across_processes(self):
        with tempfile.TemporaryDirectory(prefix="ashveil lock with spaces ") as folder:
            root = Path(folder)
            children = []
            def launch(lane, name):
                child = WindowsProcess([sys.executable, __file__, "--lock-child", folder, lane, name])
                children.append(child)
                return child
            try:
                a, b = launch("light", "a"), launch("light", "b")
                until(lambda: (root / "a.started").exists() and (root / "b.started").exists())
                c = launch("light", "c")
                heavy = launch("heavy", "heavy")
                time.sleep(0.3)
                self.assertFalse((root / "c.started").exists())
                self.assertFalse((root / "heavy.started").exists())
                (root / "a.release").touch()
                self.assertEqual(a.wait(timeout=10), 0)
                until(lambda: (root / "c.started").exists())
                self.assertFalse((root / "heavy.started").exists())
                for name in ("b", "c"):
                    (root / (name + ".release")).touch()
                self.assertEqual(b.wait(timeout=10), 0)
                self.assertEqual(c.wait(timeout=10), 0)
                until(lambda: (root / "heavy.started").exists())
                d = launch("light", "d")
                time.sleep(0.3)
                self.assertFalse((root / "d.started").exists())
                (root / "heavy.release").touch()
                self.assertEqual(heavy.wait(timeout=10), 0)
                until(lambda: (root / "d.started").exists())
                (root / "d.release").touch()
                self.assertEqual(d.wait(timeout=10), 0)
            finally:
                for child in children:
                    child.stop_tree()
                    child.wait(timeout=10)

    def test_job_cleans_live_and_parent_exited_trees_preserving_unrelated_process(self):
        unrelated = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
        try:
            for parent_exits in (False, True):
                with tempfile.TemporaryDirectory(prefix="ashveil job ") as folder:
                    marker = Path(folder) / "child.json"
                    source = ("import subprocess,sys,time,json,pathlib; "
                              "child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)']); "
                              "pathlib.Path(sys.argv[1]).write_text(json.dumps(child.pid)); "
                              + ("" if parent_exits else "time.sleep(30)"))
                    job = WindowsProcess([sys.executable, "-c", source, str(marker)])
                    try:
                        until(marker.exists)
                        pid = json.loads(marker.read_text())
                        self.assertTrue(alive(pid))
                        if parent_exits:
                            self.assertEqual(job.wait(timeout=10), 0)
                        job.stop_tree()
                        job.wait(timeout=10)
                        until(lambda: not alive(pid))
                        self.assertIsNone(unrelated.poll())
                    finally:
                        job.stop_tree()
                        job.wait(timeout=10)
        finally:
            unrelated.terminate()
            unrelated.wait(timeout=10)

    def test_runner_preserves_literal_args_failure_blocking_and_nonoverwrite(self):
        with tempfile.TemporaryDirectory(prefix="ashveil runner ") as folder:
            root = Path(folder)
            plan, out = root / "plan.json", root / "run"
            literal = "a space & literal $() `quotes` 한글"
            def task(name, argv, deps=()):
                return dict(id=name,lane="light",kind="command",effect="output-only",cwd=folder,argv=argv,deps=list(deps))
            plan.write_text(json.dumps({"version":1,"tasks":[
                task("literal", [sys.executable,"-c","import sys;print(sys.argv[1])",literal]),
                task("fail", [sys.executable,"-c","raise SystemExit(7)"]),
                task("blocked", [sys.executable,"-c","raise SystemExit(99)"], ["fail"])
            ]}), encoding="utf-8")
            argv = [sys.executable,str(HERE / "run.py"),str(plan),"--out",str(out)]
            env = {**os.environ, "PYTHONUTF8": "1"}
            check = subprocess.run(argv + ["--check"], capture_output=True, timeout=20, env=env)
            self.assertEqual(check.returncode, 0, check.stderr)
            self.assertFalse(out.exists())
            run = subprocess.run(argv, capture_output=True, timeout=30, env=env)
            self.assertEqual(run.returncode, 7, run.stderr)
            report = json.loads((out / "run.json").read_text(encoding="utf-8"))
            self.assertEqual(report["tasks"]["blocked"]["status"], "blocked")
            self.assertEqual(report["tasks"]["fail"]["exitCode"], 7)
            self.assertEqual((out / "tasks/literal/stdout.log").read_text(encoding="utf-8").strip(), literal)
            before = (out / "run.json").read_bytes()
            self.assertEqual(subprocess.run(argv,capture_output=True,timeout=20).returncode, 2)
            self.assertEqual((out / "run.json").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
