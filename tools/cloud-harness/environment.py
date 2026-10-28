#!/usr/bin/env python3
"""Read-only readiness check for a fresh ASHVEIL checkout (standard library only)."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys


def version(argv):
    try:
        result = subprocess.run(argv, capture_output=True, text=True, timeout=20, check=False)
        # Version commands only: never enumerate the environment or credentials.
        return result.returncode, result.stdout.strip().splitlines()[0] if result.stdout.strip() else ""
    except (OSError, subprocess.TimeoutExpired):
        return None, ""


def inspect(root, pnpm="pnpm", chromium=None):
    root = Path(root).resolve()
    checks = {}
    node_exit, node = version(["node", "--version"])
    checks["node24"] = {"ok": node_exit == 0 and bool(re.fullmatch(r"v24\.\d+\.\d+", node)), "version": node}
    pnpm_exit, pnpm_version = version([pnpm, "--version"])
    checks["pnpm9159"] = {"ok": pnpm_exit == 0 and pnpm_version == "9.15.9", "version": pnpm_version}
    lock = root / "pnpm-lock.yaml"
    lock_bytes = lock.read_bytes() if lock.is_file() else b""
    checks["lockfile"] = {"ok": bool(lock_bytes) and bool(re.search(rb"(?m)^lockfileVersion: ['\"]?9\.0['\"]?\s*$", lock_bytes)), "sha256": hashlib.sha256(lock_bytes).hexdigest() if lock_bytes else None}
    # Missing tools must block the queue instead of invoking npx or downloading replacements.
    tools = ["vue-tsc/bin/vue-tsc.js", "eslint/bin/eslint.js", "vite/bin/vite.js", "vitest/vitest.mjs", "tsx/dist/loader.mjs", "playwright-core/package.json"]
    missing = [name for name in tools if not (root / "node_modules" / name).is_file()]
    checks["dependencies"] = {"ok": not missing, "missing": missing}
    browser = chromium or shutil.which("chromium") or shutil.which("chromium-browser")
    if not browser and Path("/workspace/.ashveil-tools/chromium").is_file():
        browser = "/workspace/.ashveil-tools/chromium"
    browser_exit, browser_version = version([browser, "--version"]) if browser else (None, "")
    checks["chromium"] = {"ok": browser_exit == 0 and bool(re.match(r"(?:Chromium|Google Chrome|Chrome for Testing) \d+\.", browser_version)), "path": str(browser) if browser else None, "version": browser_version}
    head_exit, head = version(["git", "-C", str(root), "rev-parse", "HEAD"])
    checks["checkout"] = {"ok": head_exit == 0 and bool(re.fullmatch(r"[0-9a-f]{40}", head)), "head": head}
    limits = {}
    for name in ("cpu.max", "memory.max"):
        path = Path("/sys/fs/cgroup") / name
        if path.is_file():
            limits[name] = path.read_text().strip()
    return {"version": 1, "root": str(root), "ready": all(check["ok"] for check in checks.values()), "checks": checks, "cgroup": limits, "scope": "Tool presence/version only. Frozen install, compilation, Full/World, real inputs and publication require separate evidence."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--pnpm", default="pnpm", help="Installed pnpm executable; no automatic installer")
    parser.add_argument("--chromium", help="Installed Chromium executable")
    args = parser.parse_args()
    result = inspect(args.root, args.pnpm, args.chromium)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
