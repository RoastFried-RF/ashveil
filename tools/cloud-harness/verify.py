#!/usr/bin/env python3
"""Exercise real marker subprocesses; all artifacts remain alongside this helper."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
RUNNER = ROOT / "run.py"
PARSER = argparse.ArgumentParser(description=__doc__)
PARSER.add_argument("--out", type=Path, help="Entirely new verification directory")
PARSER.add_argument("--regressions", action="store_true", help="Only browserless/copy-location regressions")
ARGS = PARSER.parse_args()
OUT = (ARGS.out or Path("/workspace/.ashveil-tools/cloud-harness/verification") / ("run-" + str(time.time_ns()))).expanduser().resolve()
if OUT.exists():
    PARSER.error("Verification output already exists: " + str(OUT))
OUT.mkdir(parents=True, exist_ok=False)
RESULT = {"out": str(OUT), "checks": {}, "status": "running"}
ACTIVE = []
MARKER = """import json,os,sys,time
path,ident,lane,duration=sys.argv[1:]
def emit(event):
 fd=os.open(path,os.O_WRONLY|os.O_APPEND|os.O_CREAT,0o600)
 os.write(fd,(json.dumps(dict(id=ident,lane=lane,event=event,ns=time.monotonic_ns(),pid=os.getpid()))+'\\n').encode())
 os.close(fd)
emit('start');time.sleep(float(duration));emit('end')
"""


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def task(ident, lane, marker, deps=None):
    return {"id": ident, "lane": lane, "kind": "audit" if lane == "light" else "native", "effect": "output-only", "cwd": str(ROOT), "argv": [sys.executable, "-c", MARKER, str(marker), ident, lane, "0.25"], "deps": deps or []}


def plan(name, tasks):
    path = OUT / (name + ".json")
    save(path, {"version": 1, "tasks": tasks})
    return path


def start(name, plan_path, runner=RUNNER):
    log = (OUT / (name + "-invocation-" + str(time.time_ns()) + ".log")).open("xb")
    process = subprocess.Popen([sys.executable, str(runner), str(plan_path), "--out", str(OUT / name)], stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    pair = (process, log)
    ACTIVE.append(pair)
    return pair


def wait(pair):
    process, log = pair
    try:
        return process.wait(timeout=30)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        raise
    finally:
        log.close()
        if process.poll() is not None and pair in ACTIVE:
            ACTIVE.remove(pair)


def cleanup_active():
    # A failed assertion or first runner timeout must not abandon a second runner.
    for pair in list(ACTIVE):
        process, log = pair
        if process.poll() is None:
            process.terminate()
        try:
            wait(pair)
        finally:
            log.close()


def concurrency(path, expected, require_light_two=False):
    events = [json.loads(row) for row in path.read_text().splitlines()]
    active = {"light": 0, "heavy": 0}
    maximum = dict(active)
    seen = set()
    for row in sorted(events, key=lambda e: e["ns"]):
        if row["event"] == "start":
            assert row["id"] not in seen
            seen.add(row["id"])
            active[row["lane"]] += 1
            maximum[row["lane"]] = max(maximum[row["lane"]], active[row["lane"]])
            assert active["light"] <= 2 and active["heavy"] <= 1, active
            assert not (active["light"] and active["heavy"]), active
        else:
            active[row["lane"]] -= 1
            assert active[row["lane"]] >= 0
    assert len(seen) == expected and active == {"light": 0, "heavy": 0}
    if require_light_two:
        assert maximum["light"] == 2
    return {"tasks": len(seen), "events": len(events), "maxConcurrent": maximum, "heavyLightOverlap": False}


def live(pid):
    try:
        state = Path(f"/proc/{pid}/stat").read_text().split(")", 1)[1].split()[0]
        return state not in {"Z", "X"}
    except FileNotFoundError:
        return False


def regressions():
    checks = {}
    for name, argv, expected in [
        ("browserless-check", ["node", "tools/game-harness.mjs", "--scenario", "smoke", "--check"], 0),
        ("browserless-list", ["node", "tools/game-harness.mjs", "--list"], 0),
        ("browser-input-stays-heavy", ["node", "tools/game-harness.mjs", "--scenario", "smoke"], 2),
        ("preview-stays-heavy", ["node", "tools/game-harness-preview.ts", "--check"], 2),
    ]:
        source = {"id": name, "lane": "light", "kind": "audit", "effect": "read-only", "cwd": str(ROOT), "argv": argv}
        path = plan(name + "-plan", [source])
        output = OUT / name
        process = subprocess.run([sys.executable, str(RUNNER), str(path), "--out", str(output), "--check"], capture_output=True, text=True, timeout=10)
        save(OUT / (name + "-result.json"), {"exit": process.returncode, "stdout": process.stdout, "stderr": process.stderr})
        assert process.returncode == expected and not output.exists(), name
        checks[name] = {"exit": process.returncode, "outputNotCreated": True}
    # A copied script must still join the original external lock namespace.
    copy = OUT / "copied-helper" / "run.py"
    copy.parent.mkdir()
    copy.write_bytes(RUNNER.read_bytes())
    marker = OUT / "copied-runner-events.ndjson"
    original_plan = plan("original-instance-plan", [task("original-light", "light", marker), task("original-heavy", "heavy", marker, ["original-light"])])
    a = start("original-instance", original_plan)
    first_log = Path(a[1].name)
    b = start("copied-instance", plan("copied-instance-plan", [task("copied-light", "light", marker), task("copied-heavy", "heavy", marker, ["copied-light"])]), copy)
    assert wait(a) == wait(b) == 0
    proof = concurrency(marker, 4)
    roots = [json.loads((OUT / name / "run.json").read_text())["lockRoot"] for name in ["original-instance", "copied-instance"]]
    assert roots[0] == roots[1] == "/workspace/.ashveil-tools/cloud-harness/locks"
    checks["copiedLocationUsesSharedLocks"] = {**proof, "lockRoots": roots}
    first_sha = hashlib.sha256(first_log.read_bytes()).hexdigest()
    assert wait(start("original-instance", original_plan)) == 2
    assert hashlib.sha256(first_log.read_bytes()).hexdigest() == first_sha
    assert len(list(OUT.glob("original-instance-invocation-*.log"))) == 2
    checks["reusedOutputKeepsOriginalInvocationLog"] = {"exit": 2, "originalLogUnchanged": True, "invocationLogs": 2}
    return checks


if ARGS.regressions:
    try:
        RESULT.update(checks=regressions(), status="passed")
    except BaseException as error:
        RESULT.update(status="failed", error=f"{type(error).__name__}: {error}")
        raise
    finally:
        cleanup_active()
        save(OUT / "verification.json", RESULT)
        print(json.dumps(RESULT, indent=2))
    raise SystemExit(0)


try:
    # Two independently running schedulers must share both light slots.
    marker = OUT / "light-events.ndjson"
    a = start("light-a", plan("light-plan-a", [task(f"a{i}", "light", marker) for i in range(4)]))
    b = start("light-b", plan("light-plan-b", [task(f"b{i}", "light", marker) for i in range(4)]))
    assert wait(a) == wait(b) == 0
    RESULT["checks"]["crossRunnerLightLimit"] = concurrency(marker, 8, True)

    marker = OUT / "mixed-events.ndjson"
    a = start("mixed-a", plan("mixed-plan-a", [task("heavy-a1", "heavy", marker), task("light-a1", "light", marker), task("heavy-a2", "heavy", marker, ["light-a1"]), task("light-a2", "light", marker)]))
    b = start("mixed-b", plan("mixed-plan-b", [task("heavy-b1", "heavy", marker), task("light-b1", "light", marker), task("heavy-b2", "heavy", marker, ["light-b1"]), task("light-b2", "light", marker)]))
    assert wait(a) == wait(b) == 0
    RESULT["checks"]["crossRunnerHeavyExclusion"] = concurrency(marker, 8)

    marker = OUT / "failure-events.ndjson"
    bad = task("fails-seven", "light", marker)
    bad["argv"] = [sys.executable, "-c", "import sys;sys.exit(7)"]
    failure_plan = plan("failure-plan", [bad, task("must-not-run", "light", marker, ["fails-seven"]), task("independent", "light", marker)])
    assert wait(start("failure", failure_plan)) == 7
    report = json.loads((OUT / "failure/run.json").read_text())
    assert report["tasks"]["fails-seven"]["exitCode"] == 7
    assert report["tasks"]["must-not-run"]["status"] == "blocked"
    assert "must-not-run" not in marker.read_text()
    assert report["tasks"]["independent"]["status"] == "passed"
    RESULT["checks"]["failurePropagation"] = {"runnerExit": 7, "taskExit": 7, "dependent": "blocked", "independent": "passed"}

    report_path = OUT / "failure/run.json"
    before = hashlib.sha256(report_path.read_bytes()).hexdigest()
    assert wait(start("failure", failure_plan)) == 2
    assert hashlib.sha256(report_path.read_bytes()).hexdigest() == before
    RESULT["checks"]["existingOutputRejected"] = {"exit": 2, "originalRunJsonUnchanged": True}

    empty_out = OUT / "already-empty"
    empty_out.mkdir()
    assert wait(start("already-empty", failure_plan)) == 2
    assert not list(empty_out.iterdir())
    RESULT["checks"]["existingEmptyOutputRejected"] = {"exit": 2, "directoryStillEmpty": True}

    snapshot = OUT / "checkpoint"
    snapshot.mkdir()
    (snapshot / "tracked.txt").write_text("immutable\n")
    manifest = snapshot.with_name("checkpoint-manifest.json")
    save(manifest, {"tracked.txt": hashlib.sha256((snapshot / "tracked.txt").read_bytes()).hexdigest()})
    protected = {"id": "forbidden-build", "lane": "heavy", "kind": "build", "effect": "source-write", "cwd": str(snapshot), "argv": [sys.executable, "-c", "raise Exception('must never execute')"]}
    assert wait(start("forbidden", plan("forbidden-plan", [protected]))) == 2
    assert not (OUT / "forbidden").exists()
    readable = {**protected, "id": "readonly", "lane": "light", "kind": "audit", "effect": "read-only", "argv": [sys.executable, "-c", "print('snapshot audit')"]}
    assert wait(start("snapshot-audit", plan("snapshot-audit-plan", [readable]))) == 0
    report = json.loads((OUT / "snapshot-audit/run.json").read_text())
    row = report["tasks"]["readonly"]
    assert row["snapshotBefore"] == row["snapshotAfter"]
    assert row["snapshotBefore"]["sha256"] == hashlib.sha256(manifest.read_bytes()).hexdigest()
    RESULT["checks"]["snapshotPolicy"] = {"buildRejectedBeforeOutput": True, "manifestShaRecorded": True, "trackedBytesVerifiedBeforeAfter": 1}

    literal = ["literal $HOME", "$(must-not-execute)", "`must-not-execute`", "spaces and \nnewlines"]
    argv_task = {"id": "literal-argv", "lane": "light", "kind": "audit", "effect": "output-only", "cwd": str(ROOT), "argv": [sys.executable, "-c", "import json,sys;from pathlib import Path;Path(sys.argv[1]).write_text(json.dumps(sys.argv[2:]))", "{task_out}/args.json", *literal]}
    assert wait(start("argv", plan("argv-plan", [argv_task]))) == 0
    assert json.loads((OUT / "argv/tasks/literal-argv/args.json").read_text()) == literal
    RESULT["checks"]["argvWithoutShell"] = {"literalArgumentsPreserved": len(literal)}

    missing = {**argv_task, "id": "missing-executable", "argv": [str(OUT / "does-not-exist")]}
    assert wait(start("missing", plan("missing-plan", [missing]))) == 127
    report = json.loads((OUT / "missing/run.json").read_text())
    assert report["tasks"]["missing-executable"]["exitCode"] is None
    assert report["tasks"]["missing-executable"]["failureCode"] == 127
    RESULT["checks"]["missingExecutable"] = {"runnerExit": 127, "childExit": None, "failureCode": 127}

    # Cancellation must terminate its own inherited subprocess group, preserving an outsider.
    child_pid = OUT / "owned-child.pid"
    outsider = subprocess.Popen([sys.executable, "-c", "import time;time.sleep(30)"], start_new_session=True)
    cancellation_pair = None
    try:
        code = "import subprocess,sys,time;from pathlib import Path;p=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)']);Path(sys.argv[1]).write_text(str(p.pid));time.sleep(30)"
        cancellation = {"id": "owned-group", "lane": "light", "kind": "audit", "effect": "output-only", "cwd": str(ROOT), "argv": [sys.executable, "-c", code, str(child_pid)]}
        cancellation_pair = start("cancel", plan("cancel-plan", [cancellation]))
        deadline = time.monotonic() + 8
        while not child_pid.exists() and time.monotonic() < deadline:
            time.sleep(0.03)
        assert child_pid.exists()
        owned = int(child_pid.read_text())
        cancellation_pair[0].terminate()
        assert wait(cancellation_pair) == 143
        assert not live(owned)
        assert outsider.poll() is None
        report = json.loads((OUT / "cancel/run.json").read_text())
        assert report["tasks"]["owned-group"]["exitCode"] == -signal.SIGTERM
        RESULT["checks"]["ownedProcessGroupCleanup"] = {"runnerExit": 143, "taskExit": -signal.SIGTERM, "ownedChildStopped": True, "outsiderStillAlive": True}
    finally:
        if cancellation_pair and cancellation_pair[0].poll() is None:
            cancellation_pair[0].terminate()
            wait(cancellation_pair)
        os.killpg(outsider.pid, signal.SIGTERM)
        outsider.wait(timeout=5)

    RESULT["status"] = "passed"
except BaseException as error:
    RESULT.update(status="failed", error=f"{type(error).__name__}: {error}")
    raise
finally:
    cleanup_active()
    save(OUT / "verification.json", RESULT)
    print(json.dumps(RESULT, indent=2))
