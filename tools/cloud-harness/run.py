#!/usr/bin/env python3
"""Workspace-local, cooperative scheduler. No shell, environment dump, or package install."""
from __future__ import annotations

import argparse
import concurrent.futures
import contextlib
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import threading
import time

if os.name == "nt":
    from windows import acquire_windows, WindowsProcess
else:
    import fcntl

ROOT = Path(__file__).resolve().parent
# Keep one lock namespace even if a reviewed copy later lives in the repository.
LOCKS = (Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local")) / "ASHVEIL/harness/locks"
         if os.name == "nt" else Path("/workspace/.ashveil-tools/cloud-harness/locks"))
HEAVY_KINDS = {"build", "full", "world", "expedition", "gpu", "native", "freeze", "source-mutation"}
KINDS = HEAVY_KINDS | {"command", "typecheck", "lint", "audit", "focused-test"}
EFFECTS = {"read-only", "output-only", "source-write"}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(path, value):
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def immutable_root(cwd):
    for candidate in (cwd, *cwd.parents):
        manifest = candidate.with_name(candidate.name + "-manifest.json") if candidate.name else None
        if manifest and manifest.is_file():
            return candidate, manifest
    if ".ashveil-checkpoints" in cwd.parts:
        raise ValueError("Checkpoint path has no adjacent immutable manifest: " + str(cwd))
    return None, None


def command_is_heavy(argv):
    low = [s.lower().replace("\\", "/") for s in argv]
    # This exact adapter returns before launching Chromium for these two flags.
    # The preview adapter and real game-harness inputs remain heavy.
    if len(low) > 2 and Path(low[0]).stem in {"node", "nodejs"} and (low[1].replace("\\", "/") == "tools/game-harness.mjs" or low[1].replace("\\", "/").endswith("/tools/game-harness.mjs")) and any(flag in low[2:] for flag in ("--check", "--list")):
        return False
    joined = " ".join(low)
    return any(x in joined for x in ("expedition-batch", "sim-batch", "game-harness", "inspect-", "tests/e2e/", "freeze-checkpoint")) or (
        any("vite" in x for x in low) and "build" in low
    ) or (Path(low[0]).stem in {"pnpm", "npm", "yarn"} and any(x in low for x in ("build", "test", "sim", "sim:batch", "sim:expedition", "game:preview-check")))


def command_can_mutate_source(argv):
    low = [s.lower().replace("\\", "/") for s in argv]
    if "freeze-checkpoint" in " ".join(low):
        return True
    if any("vite" in s for s in low) and "build" in low:
        return True
    if Path(low[0]).stem in {"pnpm", "npm", "yarn"} and any(x in low for x in ("build", "install", "add", "remove", "update", "game:freeze", "golden:update")):
        return True
    return Path(low[0]).stem in {"rm", "mv", "cp", "install", "touch", "chmod", "chown", "tee", "sed", "perl", "git", "apply_patch"}


def load_plan(path, out):
    raw = path.read_bytes()
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError("Plan is too large")
    plan = json.loads(raw)
    if not isinstance(plan, dict) or plan.get("version") != 1 or not isinstance(plan.get("tasks"), list) or not 1 <= len(plan["tasks"]) <= 256:
        raise ValueError("Expected version=1 and 1..256 tasks")
    tasks, ids = [], set()
    for source in plan["tasks"]:
        if not isinstance(source, dict):
            raise ValueError("Each task must be an object")
        task = dict(source)
        ident = task.get("id")
        if not isinstance(ident, str) or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}", ident) or ident in ids:
            raise ValueError("Invalid or duplicate task id")
        ids.add(ident)
        if task.get("lane") not in {"light", "heavy"}:
            raise ValueError(ident + ": lane must be light or heavy")
        kind, effect = task.get("kind", "command"), task.get("effect")
        if kind not in KINDS or effect not in EFFECTS:
            raise ValueError(ident + ": invalid kind or missing effect")
        argv = task.get("argv")
        if not isinstance(argv, list) or not argv or any(not isinstance(s, str) or "\0" in s for s in argv) or not argv[0]:
            raise ValueError(ident + ": argv must be a nonempty string array")
        if not isinstance(task.get("cwd"), str):
            raise ValueError(ident + ": cwd must be explicit")
        cwd = Path(task["cwd"]).expanduser().resolve()
        if not cwd.is_dir():
            raise ValueError(ident + ": cwd does not exist")
        task_dir = out / "tasks" / ident
        replacements = {"{out}": str(out), "{task_out}": str(task_dir), "{python}": sys.executable}
        for before, after in replacements.items():
            argv = [s.replace(before, after) for s in argv]
        if task["lane"] != "heavy" and (kind in HEAVY_KINDS or effect == "source-write" or command_is_heavy(argv)):
            raise ValueError(ident + ": heavy work/source writes require the heavy lane")
        if kind in {"build", "source-mutation"} and effect != "source-write":
            raise ValueError(ident + ": build/source-mutation requires source-write effect")
        deps = task.get("deps", [])
        if not isinstance(deps, list) or any(not isinstance(d, str) for d in deps) or len(set(deps)) != len(deps):
            raise ValueError(ident + ": deps must be a unique id array")
        checkpoint, manifest = immutable_root(cwd)
        requested = task.get("snapshotManifest")
        if requested:
            if not isinstance(requested, str):
                raise ValueError(ident + ": snapshotManifest must be a path")
            requested = Path(requested).expanduser().resolve()
            if not requested.is_file() or manifest and requested != manifest:
                raise ValueError(ident + ": invalid/mismatched snapshotManifest")
            manifest = requested
            if not checkpoint:
                suffix = "-manifest.json"
                if not manifest.name.endswith(suffix):
                    raise ValueError(ident + ": snapshot manifest must be adjacent to its checkpoint")
                checkpoint = manifest.with_name(manifest.name[:-len(suffix)])
                if not checkpoint.is_dir() or not cwd.is_relative_to(checkpoint):
                    raise ValueError(ident + ": cwd must be inside the declared checkpoint")
        if checkpoint and (effect == "source-write" or kind in {"build", "freeze", "source-mutation"} or command_can_mutate_source(argv)):
            raise ValueError(ident + ": source mutation/build/freeze is forbidden inside immutable checkpoints")
        task.update(kind=kind, effect=effect, argv=argv, cwd=str(cwd), deps=deps, taskOut=str(task_dir), snapshotRoot=str(checkpoint) if checkpoint else None, snapshotManifest=str(manifest) if manifest else None)
        tasks.append(task)
    by_id = {t["id"]: t for t in tasks}
    for task in tasks:
        if any(d not in ids or d == task["id"] for d in task["deps"]):
            raise ValueError(task["id"] + ": unknown/self dependency")
    visited = set()
    while len(visited) < len(tasks):
        ready = {t["id"] for t in tasks if t["id"] not in visited and all(d in visited for d in t["deps"])}
        if not ready:
            raise ValueError("Dependency cycle")
        visited.update(ready)
    return {"version": 1, "tasks": tasks}, hashlib.sha256(raw).hexdigest()


def snapshot_state(task):
    """Check all manifested bytes before/after. Outputs must stay outside this tree."""
    if not task["snapshotManifest"]:
        return None
    path, root = Path(task["snapshotManifest"]), Path(task["snapshotRoot"])
    original_hash = sha(path)
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or not manifest:
        raise ValueError("Immutable manifest must contain tracked file SHA-256 entries")
    for relative, digest in manifest.items():
        if not isinstance(relative, str) or not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ValueError("Invalid immutable manifest entry")
        file = root / relative
        if Path(relative).is_absolute() or ".." in Path(relative).parts or file.is_symlink() or not file.is_file() or sha(file) != digest:
            raise ValueError("Immutable file mismatch: " + relative)
        if not file.resolve().is_relative_to(root):
            raise ValueError("Immutable file escapes checkpoint: " + relative)
    return {"path": str(path), "sha256": original_hash, "filesVerified": len(manifest)}


@contextlib.contextmanager
def acquire(lane, stop):
    """One global reader/writer gate + two shared light slots, across runners."""
    LOCKS.mkdir(parents=True, exist_ok=True)
    if os.name == "nt":
        with acquire_windows(LOCKS, lane, stop):
            yield
        return
    held = []
    try:
        gate = os.open(LOCKS / "heavy-gate.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        held.append(gate)
        while not stop.is_set():
            if lane == "heavy":
                try:
                    fcntl.flock(gate, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    pass
                else:
                    yield
                    return
            else:
                for index in range(2):
                    slot = os.open(LOCKS / f"light-{index}.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
                    try:
                        fcntl.flock(slot, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        fcntl.flock(gate, fcntl.LOCK_SH | fcntl.LOCK_NB)
                    except BlockingIOError:
                        os.close(slot)
                        continue
                    held.append(slot)
                    yield
                    return
            stop.wait(0.05)
        raise InterruptedError("Runner cancelled before acquiring resource lock")
    finally:
        for fd in reversed(held):
            os.close(fd)


def stop_group(process):
    """Only the process group created by this Popen(start_new_session=True)."""
    if os.name == "nt":
        process.stop_tree()
        return
    def send(sig):
        try:
            os.killpg(process.pid, sig)
            return True
        except ProcessLookupError:
            return False
    if not send(signal.SIGTERM):
        return
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        process.poll()
        try:
            os.killpg(process.pid, 0)
        except ProcessLookupError:
            return
        time.sleep(0.03)
    send(signal.SIGKILL)


def execute(task, stop):
    out = Path(task["taskOut"])
    out.mkdir(parents=True, exist_ok=False)
    result = {**task, "status": "waiting", "queuedAt": now(), "exitCode": None}
    write_json(out / "task.json", result)
    process = None
    before = None
    cleanup_done = False
    try:
        with acquire(task["lane"], stop):
            result["lockAcquiredAt"] = now()
            if stop.is_set():
                raise InterruptedError("Runner cancelled")
            if task["snapshotRoot"] and out.is_relative_to(Path(task["snapshotRoot"])):
                raise ValueError("Task output cannot be inside an immutable checkpoint")
            before = snapshot_state(task)
            result["snapshotBefore"] = before
            result.update(status="running", startedAt=now())
            write_json(out / "task.json", result)
            print(json.dumps({"task": task["id"], "lane": task["lane"], "status": "running"}), flush=True)
            with (out / "stdout.log").open("wb") as stdout, (out / "stderr.log").open("wb") as stderr:
                options = dict(cwd=task["cwd"], stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, shell=False, close_fds=True)
                process = WindowsProcess(task["argv"], **options) if os.name == "nt" else subprocess.Popen(task["argv"], start_new_session=True, **options)
                result.update(pid=process.pid, processGroup=process.pid)
                write_json(out / "task.json", result)
                next_progress = time.monotonic() + 30
                while process.poll() is None:
                    if stop.wait(0.05):
                        stop_group(process)
                        cleanup_done = True
                        break
                    if time.monotonic() >= next_progress:
                        print(json.dumps({"task": task["id"], "lane": task["lane"], "status": "running"}), flush=True)
                        next_progress = time.monotonic() + 30
                result["exitCode"] = process.wait()
                if not cleanup_done:
                    stop_group(process)
                    cleanup_done = True
            after = snapshot_state(task)
            result["snapshotAfter"] = after
            if before != after:
                raise ValueError("Immutable manifest changed during task")
            result["status"] = "cancelled" if stop.is_set() else "passed" if result["exitCode"] == 0 else "failed"
    except InterruptedError as error:
        result.update(status="cancelled", error=str(error))
    except Exception as error:
        result.update(status="failed", error=f"{type(error).__name__}: {error}")
        # Preserve the exact child exit, including 0 followed by an integrity error.
        # Infrastructure failure is a separate result, never a fictitious child exit.
        result["failureCode"] = 127 if isinstance(error, FileNotFoundError) else 126
    finally:
        if process is not None:
            if not cleanup_done:
                stop_group(process)
            if process.poll() is None:
                process.wait()
        result["endedAt"] = now()
        write_json(out / "task.json", result)
        print(json.dumps({"task": task["id"], "status": result["status"], "exitCode": result["exitCode"]}), flush=True)
    return result


def run(plan, plan_path, plan_sha, out):
    # mkdir without exist_ok is the sole authority for refusing reused output, even empty.
    out.mkdir(parents=True, exist_ok=False)
    stop, received = threading.Event(), []
    previous = {}
    def signal_handler(signum, frame):
        received.append(signum)
        stop.set()
    for sig in (signal.SIGINT, signal.SIGTERM):
        previous[sig] = signal.signal(sig, signal_handler)
    summary = {"version": 1, "plan": str(plan_path), "planSha256": plan_sha, "out": str(out), "lockRoot": str(LOCKS), "startedAt": now(), "status": "running", "tasks": {}}
    write_json(out / "plan.json", plan)
    write_json(out / "run.json", summary)
    pending = {t["id"]: t for t in plan["tasks"]}
    running, results = {}, summary["tasks"]
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, len(pending)), thread_name_prefix="cloud-harness") as pool:
            while pending or running:
                for ident, task in list(pending.items()):
                    deps = task["deps"]
                    if stop.is_set() or any(d in results and results[d]["status"] != "passed" for d in deps):
                        result = {**task, "status": "cancelled" if stop.is_set() else "blocked", "exitCode": None, "endedAt": now(), "blockedBy": [d for d in deps if d in results and results[d]["status"] != "passed"]}
                        task_out = Path(task["taskOut"])
                        task_out.mkdir(parents=True, exist_ok=False)
                        write_json(task_out / "task.json", result)
                        results[ident] = result
                        del pending[ident]
                    elif all(d in results for d in deps):
                        running[pool.submit(execute, task, stop)] = ident
                        del pending[ident]
                if not running:
                    continue
                done, _ = concurrent.futures.wait(running, timeout=0.1, return_when=concurrent.futures.FIRST_COMPLETED)
                for future in done:
                    ident = running.pop(future)
                    results[ident] = future.result()
                if done:
                    write_json(out / "run.json", summary)
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)
    failed = [results[t["id"]] for t in plan["tasks"] if results[t["id"]]["status"] == "failed"]
    code = 128 + received[0] if received else (failed[0].get("failureCode") or failed[0]["exitCode"] or 1) if failed else 0
    if code < 0:
        code = 128 - code
    summary.update(endedAt=now(), status="cancelled" if received else "failed" if failed else "passed", exitCode=code)
    write_json(out / "run.json", summary)
    print(json.dumps({"out": str(out), "status": summary["status"], "exitCode": code}, ensure_ascii=False))
    return min(code, 255)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path)
    parser.add_argument("--out", type=Path, required=True, help="Must not already exist")
    parser.add_argument("--check", action="store_true", help="Validate only, do not create output or run commands")
    args = parser.parse_args()
    try:
        out, path = args.out.expanduser().resolve(), args.plan.expanduser().resolve()
        if out.exists():
            raise ValueError("Output path already exists: " + str(out))
        plan, plan_sha = load_plan(path, out)
        # Reject the run directory itself before even mkdir touches immutable content.
        checkpoint, _ = immutable_root(out.parent)
        if checkpoint:
            raise ValueError("Run output must be outside immutable checkpoints")
        if args.check:
            print(json.dumps({"valid": True, "tasks": len(plan["tasks"]), "planSha256": plan_sha, "out": str(out)}))
            return 0
        return run(plan, path, plan_sha, out)
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f"cloud-harness: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
