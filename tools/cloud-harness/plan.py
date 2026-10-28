#!/usr/bin/env python3
"""Create an explicit plan for this checkout, without relying on /workspace/ashveil."""
import argparse
import json
from pathlib import Path
import sys


def make_plan(root, pnpm="pnpm", chromium=None, profile="authoring", locale=False, gameplay_locale=False, status_locale=False, item_locale=False):
    root = str(Path(root).resolve())
    tasks = []

    def add(ident, lane, kind, effect, argv, deps=()):
        tasks.append(dict(id=ident, lane=lane, kind=kind, effect=effect, cwd=root, argv=argv, deps=list(deps)))

    argv = [sys.executable, "tools/cloud-harness/environment.py", "--root", root, "--pnpm", pnpm]
    if chromium:
        argv += ["--chromium", chromium]
    add("environment", "light", "audit", "read-only", argv)
    add("typecheck", "light", "typecheck", "read-only", ["node", "node_modules/vue-tsc/bin/vue-tsc.js", "--noEmit"], ["environment"])
    add("lint", "light", "lint", "read-only", ["node", "node_modules/eslint/bin/eslint.js", "."], ["environment"])
    if gameplay_locale or status_locale or item_locale:
        add("locale-focused", "light", "focused-test", "read-only", ["node", "node_modules/vitest/vitest.mjs", "run", "tests/locale.test.ts", "tests/locale-gameplay.test.ts", "tests/speech.test.ts", "--maxWorkers=2"], ["typecheck", "lint"])
        if status_locale:
            tasks[-1]["argv"][3:3] = ["tests/locale-status.test.ts", "tests/thermal-guidance.test.ts"]
    if item_locale:
        tasks[-1]["argv"][3:3] = ["tests/locale-items.test.ts", "tests/inventory-filter.test.ts", "tests/quickbar-items.test.ts"]
    add("preview-helper", "heavy", "native", "output-only", ["node", "tools/verify-native-preview.mjs", "{task_out}/helper"], ["typecheck", "lint"])
    if profile == "release":
        add("defs", "light", "audit", "read-only", ["node", "--import", "tsx", "tools/validate-defs.ts"], ["typecheck", "lint"])
        add("sprites", "light", "audit", "read-only", ["node", "--import", "tsx", "tools/validate-sprites.ts"], ["typecheck", "lint"])
        add("full", "heavy", "full", "read-only", ["node", "node_modules/vitest/vitest.mjs", "run", "--maxWorkers=2"], ["defs", "sprites"] + (["locale-focused"] if gameplay_locale or status_locale or item_locale else []))
        build_deps = ["full", "preview-helper"]
    else:
        build_deps = ["typecheck", "lint", "preview-helper"]
        if gameplay_locale or status_locale or item_locale:
            build_deps.append("locale-focused")
    add("build", "heavy", "build", "source-write", ["node", "node_modules/vite/bin/vite.js", "build"], build_deps)
    add("smoke", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/game-harness-preview.ts", "{task_out}/smoke"], ["build"])
    if locale:
        add("locale", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/inspect-locale-v400.ts", "{task_out}/locale"], ["smoke"])
    if gameplay_locale:
        add("locale-gameplay", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/inspect-locale-v401.ts", "{task_out}/locale-gameplay"], ["locale" if locale else "smoke"])
    if status_locale:
        add("locale-status", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/inspect-status-v402.ts", "{task_out}/locale-status"], ["locale-gameplay" if gameplay_locale else "locale" if locale else "smoke"])
    if item_locale:
        add("locale-items", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/inspect-items-v403.ts", "{task_out}/locale-items"], ["locale-status" if status_locale else "locale-gameplay" if gameplay_locale else "locale" if locale else "smoke"])
    return {"version": 1, "tasks": tasks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--pnpm", default="pnpm")
    parser.add_argument("--chromium")
    parser.add_argument("--profile", choices=["authoring", "release"], default="authoring")
    parser.add_argument("--locale", action="store_true", help="Include real locale inputs after the common smoke")
    parser.add_argument("--gameplay-locale", action="store_true", help="Include gameplay language/learning/save inputs in three viewports")
    parser.add_argument("--status-locale", action="store_true", help="Include status language and actual fatal-warning acknowledgment inputs")
    parser.add_argument("--item-locale", action="store_true", help="Include public inventory names, search, menus, checkpoint save and continuation inputs")
    parser.add_argument("--out", type=Path, required=True, help="New JSON file; never overwrites evidence")
    args = parser.parse_args()
    if not args.root.is_dir():
        parser.error("Checkout does not exist")
    result = make_plan(args.root, args.pnpm, args.chromium, args.profile, args.locale, args.gameplay_locale, args.status_locale, args.item_locale)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("x", encoding="utf-8") as output:
        output.write(json.dumps(result, indent=2) + "\n")
    print(args.out)


if __name__ == "__main__":
    main()
