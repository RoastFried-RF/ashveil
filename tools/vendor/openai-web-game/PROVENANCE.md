# Archived OpenAI web-game reference

Source: [openai/skills, commit 30444aed500c00c85294d12074f6e3ee794f808a](https://github.com/openai/skills/tree/30444aed500c00c85294d12074f6e3ee794f808a/skills/.curated/develop-web-game).
Retrieved for ASHVEIL on 2026-10-20. This is a pinned historical reference: `develop-web-game` was removed from the official catalog on 2026-04-23. It is not installed or represented as a currently maintained official skill.

The following files preserve the downloaded upstream bytes:

| Local file | Original path below `skills/.curated/develop-web-game/` | SHA-256 |
|---|---|---|
| `SKILL.upstream.md` | `SKILL.md` | `4586330e97c99581f37798c179a71c62030fc20befa6de3e3ccb96d1adead9c7` |
| `web_game_playwright_client.js` | `scripts/web_game_playwright_client.js` | `e95c3bcbdc0d15eb08fd3a6021283ec32f715b51f1e5847d3db20df526be5996` |
| `action_payloads.json` | `references/action_payloads.json` | `7c6915472781be9cc704bb12952577bd66ae4c073d294459d564a8d45f98671c` |
| `LICENSE.txt` | `LICENSE.txt` | `4dd13869245e356246a5b770723247bbb80a8f07a181d1d3d873a1734297cdb9` |

The original Apache 2.0 license is included in [LICENSE.txt](LICENSE.txt). No upstream files have been changed. The executable project adapter is [tools/game-harness.mjs](../../game-harness.mjs); it does not directly execute or import the archived script, whose top-level `main()` and `playwright` dependency are incompatible with this project's integration.

The adapter keeps the short action/observe/screenshot/error review workflow and accepts the original keyboard `buttons` aliases. Its ASHVEIL changes are explicit:

- Use installed `playwright-core`, `CHROMIUM_PATH` or the existing workspace Chromium shim. Never download a browser/package or alter global environment settings.
- Add strict, validated `press`, selector `fill`/`click`/`waitFor`, presentation-only `frames`, and named `snapshot` steps. Unknown actions/buttons/keys fail instead of being ignored. Legacy keyboard buttons produce one press per button, rather than a held key with browser-dependent repetition. The upstream `left_mouse_button`/`right_mouse_button` steps held the mouse at canvas-relative `mouse_x`/`mouse_y`; those legacy steps are rejected here. Use explicit selector clicks, including `button: "right"` for context menus.
- Capture the full DOM page, including Vue HUD, windows and title art. The original canvas-only image could omit all of that UI.
- Require `?debug` and save both the public observation JSON (`render_game_to_text`) and a read-only copy of the debug world state. The latter is local diagnostic evidence and may include undiscovered world details; it is not the player-facing observation API.
- Fail with exit code 1 on console, page, network or action errors; retain failure images/state and the run audit. Do not silently continue after a failed selector or report success after writing an error file.
- Use fresh browser contexts and preserve previous output directories. Each default output directory is unique.

The upstream `advanceTime` shim waits for presentation frames using real `requestAnimationFrame`; it does not know ASHVEIL's turn system. The adapter does not install that shim or call a simulation time hook. ASHVEIL turns come only from the actual key or mouse inputs in the payload. Its existing whole-world deterministic, save/restore and release suites remain authoritative.
