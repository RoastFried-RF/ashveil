#!/usr/bin/env python3
"""Create an explicit plan for this checkout, without relying on /workspace/ashveil."""
import argparse
import json
from pathlib import Path
import sys


def make_plan(root, pnpm="pnpm", chromium=None, profile="authoring", locale=False, gameplay_locale=False, status_locale=False, item_locale=False, checkpoint_locale=False, item_details_locale=False, schema=False, item_supplies_locale=False, ash_cake=False, balance=False, ash_cake_course=False, ash_supply=False):
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
    focused = gameplay_locale or status_locale or item_locale or checkpoint_locale or item_details_locale or item_supplies_locale or ash_cake or ash_cake_course or ash_supply
    if focused:
        add("locale-focused", "light", "focused-test", "read-only", ["node", "node_modules/vitest/vitest.mjs", "run", "tests/locale.test.ts", "tests/locale-gameplay.test.ts", "tests/speech.test.ts", "--maxWorkers=2"], ["typecheck", "lint"])
        if status_locale:
            tasks[-1]["argv"][3:3] = ["tests/locale-status.test.ts", "tests/thermal-guidance.test.ts"]
    if item_locale:
        tasks[-1]["argv"][3:3] = ["tests/locale-items.test.ts", "tests/inventory-filter.test.ts", "tests/quickbar-items.test.ts"]
    if checkpoint_locale:
        tasks[-1]["argv"][3:3] = ["tests/checkpoint-start.test.ts", "tests/content-change-review.test.ts", "tests/content-compatibility.test.ts", "tests/live-content-reload.test.ts"]
    if item_details_locale:
        tasks[-1]["argv"][3:3] = ["tests/locale-item-details.test.ts", "tests/locale-items.test.ts", "tests/node-content-loader.test.ts"]
    if item_supplies_locale:
        tasks[-1]["argv"][3:3] = ["tests/locale-item-complete.test.ts", "tests/water.test.ts", "tests/pill-aging.test.ts"]
    if ash_cake or ash_cake_course:
        tasks[-1]["argv"][3:3] = ["tests/food-training.test.ts", "tests/food-training-defs.test.ts", "tests/save-json-key-validation.test.ts", "tests/air.test.ts", "tests/boiled-meal.test.ts", "tests/status-renames.test.ts", "tests/missing-statuses.test.ts", "tests/locale-item-complete.test.ts"]
    if ash_supply:
        tasks[-1]["argv"][3:3] = ["tests/ash-deposits.test.ts", "tests/ash-workshop.test.ts", "tests/resident-cooking.test.ts", "tests/food-training.test.ts"]
    add("preview-helper", "heavy", "native", "output-only", ["node", "tools/verify-native-preview.mjs", "{task_out}/helper"], ["typecheck", "lint"])
    if profile == "release":
        add("defs", "light", "audit", "read-only", ["node", "--import", "tsx", "tools/validate-defs.ts"], ["typecheck", "lint"])
        add("sprites", "light", "audit", "read-only", ["node", "--import", "tsx", "tools/validate-sprites.ts"], ["typecheck", "lint"])
        if schema:
            add("schema", "light", "audit", "read-only", [sys.executable, "tools/validate-schema.py"], ["typecheck", "lint"])
        add("full", "heavy", "full", "read-only", ["node", "node_modules/vitest/vitest.mjs", "run", "--maxWorkers=2"], ["defs", "sprites"] + (["schema"] if schema else []) + (["locale-focused"] if focused else []))
        build_deps = ["full", "preview-helper"]
    else:
        build_deps = ["typecheck", "lint", "preview-helper"]
        if focused:
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
    if checkpoint_locale:
        add("locale-checkpoints", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/inspect-checkpoints-v404.ts", "{task_out}/locale-checkpoints"], ["locale-items" if item_locale else "locale-status" if status_locale else "locale-gameplay" if gameplay_locale else "locale" if locale else "smoke"])
    if item_details_locale:
        add("locale-item-details", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/inspect-item-details-v405.ts", "{task_out}/locale-item-details"], ["locale-checkpoints" if checkpoint_locale else "locale-items" if item_locale else "locale-status" if status_locale else "locale-gameplay" if gameplay_locale else "locale" if locale else "smoke"])
    if item_supplies_locale:
        add("locale-item-supplies", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/inspect-item-supplies-v406.ts", "{task_out}/locale-item-supplies"], ["locale-item-details" if item_details_locale else "locale-checkpoints" if checkpoint_locale else "locale-items" if item_locale else "locale-status" if status_locale else "locale-gameplay" if gameplay_locale else "locale" if locale else "smoke"])
    if ash_cake:
        add("ash-cake", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/inspect-ash-cake-v407.ts", "{task_out}/ash-cake"], ["locale-item-supplies" if item_supplies_locale else "locale-item-details" if item_details_locale else "locale-checkpoints" if checkpoint_locale else "locale-items" if item_locale else "locale-status" if status_locale else "locale-gameplay" if gameplay_locale else "locale" if locale else "smoke"])
    if ash_supply:
        add("ash-supply", "heavy", "native", "output-only", ["node", "--import", "tsx", "tools/inspect-ash-supply-v408.ts", "{task_out}/ash-supply"], [tasks[-1]["id"]])
        add("ash-supply-course", "heavy", "world", "output-only", ["node", "--import", "tsx", "tools/sim-ash-supply-v408.ts", "{task_out}/course"], ["ash-supply"])
    if ash_cake_course:
        add("ash-cake-course", "heavy", "world", "output-only", ["node", "--import", "tsx", "tools/sim-ash-cake-course-v407.ts", "{task_out}/course"], [tasks[-1]["id"]])
    if balance:
        dependency = tasks[-1]["id"]
        add("sim30", "heavy", "world", "output-only", ["node", "--import", "tsx", "tools/sim.ts", "30", "3", "0", "--json", "{task_out}/results.json", "--state-dir", "{task_out}/states"], [dependency])
        add("world30", "heavy", "world", "output-only", ["node", "--import", "tsx", "tools/sim.ts", "30", "3", "0", "--world", "--json", "{task_out}/results.json", "--state-dir", "{task_out}/states"], ["sim30"])
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
    parser.add_argument("--checkpoint-locale", action="store_true", help="Include translated checkpoint review/cancel/restore and content selection inputs")
    parser.add_argument("--item-details-locale", action="store_true", help="Include actual detail hover/keyboard, knowledge boundaries, drop and save/continue")
    parser.add_argument("--item-supplies-locale", action="store_true", help="Include real meal/drink/read/firearm inputs, public observations, original UIDs and save/continue")
    parser.add_argument("--ash-cake", action="store_true", help="Include actual pilgrim trade, finite food crafting, monthly exposure and body/save UI")
    parser.add_argument("--balance", action="store_true", help="After Native, run separate default and overworld 30-seed/3-day simulations with original state captures")
    parser.add_argument("--ash-cake-course", action="store_true", help="Run an actual 30-day finite-stock controlled dietary cohort, with daily original-world saves")
    parser.add_argument("--ash-supply", action="store_true", help="Include actual drift harvesting/material trade/fire/crafting and NPC workshop supply in three viewports")
    parser.add_argument("--schema", action="store_true", help="Add independent JSON Schema validation to release (installed Python requirements needed)")
    parser.add_argument("--out", type=Path, required=True, help="New JSON file; never overwrites evidence")
    args = parser.parse_args()
    if not args.root.is_dir():
        parser.error("Checkout does not exist")
    result = make_plan(args.root, args.pnpm, args.chromium, args.profile, args.locale, args.gameplay_locale, args.status_locale, args.item_locale, args.checkpoint_locale, args.item_details_locale, args.schema, args.item_supplies_locale, args.ash_cake, args.balance, args.ash_cake_course, args.ash_supply)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("x", encoding="utf-8") as output:
        output.write(json.dumps(result, indent=2) + "\n")
    print(args.out)


if __name__ == "__main__":
    main()
