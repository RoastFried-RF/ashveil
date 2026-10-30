#!/usr/bin/env python3
"""Short sequential Native recovery phases; reuse the exact workflow build, never Full."""
import argparse
import json
from pathlib import Path
from plan import make_plan


def phase_plan(root, phase, pnpm="pnpm", chromium=None):
    if phase not in ("build", "common", "1440x1080", "1366x768", "390x844"):
        raise ValueError("Unsupported Native phase")
    result = make_plan(root, pnpm=pnpm, chromium=chromium, profile="authoring", locale=True, checkpoint_locale=True)
    selected = {"environment", "typecheck", "lint", "locale-focused", "preview-helper", "build"} if phase == "build" else {"environment", "smoke", "locale"} if phase == "common" else {"environment", "locale-checkpoints"}
    result["tasks"] = [t for t in result["tasks"] if t["id"] in selected]
    for task in result["tasks"]:
        task["deps"] = [d for d in task["deps"] if d in selected]
        if task["id"] in ("smoke", "locale-checkpoints"):
            task["deps"] = ["environment"]
        if task["id"] == "locale-checkpoints":
            task["argv"].append(phase)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--phase", choices=["build", "common", "1440x1080", "1366x768", "390x844"], required=True)
    parser.add_argument("--pnpm", default="pnpm")
    parser.add_argument("--chromium", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    result = phase_plan(args.root, args.phase, args.pnpm, args.chromium)
    if args.phase != "build" and not (args.root / "dist/index.html").is_file():
        parser.error("Native phases require the same workflow's downloaded build")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("x", encoding="utf-8") as output:
        output.write(json.dumps(result, indent=2) + "\n")
    print(args.out)


if __name__ == "__main__":
    main()
