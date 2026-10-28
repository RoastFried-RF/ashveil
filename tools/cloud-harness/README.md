# ASHVEIL cloud harness

Python standard-library runner for trusted internal task plans. It uses argv arrays with `shell=False`, inherits the current environment without changing it, and never reads or records credentials/environment values. The runner is versioned here so it can be recovered with the repository. No additional package installation is required.

```sh
python3 tools/cloud-harness/run.py tools/cloud-harness/example.authoring.json --out test-results/cloud-runs/UNIQUE_NAME --check
python3 tools/cloud-harness/run.py PLAN.json --out NEW_OUTPUT_DIRECTORY
python3 tools/cloud-harness/verify.py --out test-results/cloud-runs/UNIQUE_SELF_CHECK
python3 tools/cloud-harness/verify.py --regressions --out test-results/cloud-runs/UNIQUE_REGRESSION_CHECK
```

`--check` creates nothing. Every actual run requires an entirely new output directory, even when an old directory is empty. Never point it at existing evidence. `example.authoring.json` runs typecheck/lint in parallel, then build and two-screen smoke. It is an example rather than an automatic setup action. `example.snapshot.json` requires replacing both checkpoint paths with one real, already-built immutable checkpoint. Outputs must be outside checkpoints.

The lint example uses the existing `pnpm lint` rule contract. Warnings remain in the log; the scheduler does not silently promote them to errors or redefine the repository's lint threshold. The restored v399 baseline has one unused-helper warning in a historical art generator whose source hash is recorded with its provenance.

## Fresh checkouts and hosted verification

`environment.py` checks Node 24, pnpm **9.15.9**, the v9 lockfile SHA, required installed tool entry points, the installed Chromium executable, actual HEAD and cgroup limits. It installs nothing, does not inspect secrets, and returns 1 when any prerequisite is missing. Tool presence is not proof of a successful frozen install or game checks.

The historical examples above use `/workspace/ashveil`. For a new location, generate explicit paths instead:

```sh
python3 tools/cloud-harness/plan.py --root "$PWD" --profile release \
  --chromium /absolute/path/to/installed/chromium --out test-results/NEW_PLAN.json
python3 tools/cloud-harness/run.py test-results/NEW_PLAN.json --out test-results/cloud-runs/NEW_RUN --check
python3 tools/cloud-harness/run.py test-results/NEW_PLAN.json --out test-results/cloud-runs/NEW_RUN
```

Use `--pnpm /absolute/path/to/pnpm` when the default command is another version. `--profile authoring` keeps the type/lint → build → smoke example; `release` adds Def/sprite checks and Full with two workers before building. An environment failure blocks every game task. A plan never overwrites an existing file. Set `CHROMIUM_PATH` for the actual game harness to the same installed executable supplied to the plan; the preflight argument alone does not change a child process's environment.

`.github/workflows/cloud-development.yml` provisions an independent, fresh GitHub-hosted runner on `cloud/ashveil-*` pushes or explicit dispatch. Pushes default to release (Full included) for application changes; manual dispatch can select authoring. It installs the frozen dependencies and Chromium with the repository's pinned Playwright CLI, then uses this same shared queue. It retains logs and the two-screen smoke PNGs. This is a separate Actions verification environment, **not** a claim that a Codex environment has been registered or published. Main's existing Pages workflow runs Full and remains the publication path. Verify application changes with Full before main; an unchanged application need not repeat Full merely for a dependency-free preview-helper correction. Preserve the separate commit/run scopes in the receipt. World/expedition/balance gates remain separate and are not implied by either profile.

Run `python3 tools/cloud-harness/verify-environment.py` for missing-tool, exact-version, partial-install, portable-path, lane and non-overwrite regression checks without installing packages.

Each task has an explicit `id`, `lane` (`light` or `heavy`), `kind`, `effect`, `cwd`, `argv` and optional `deps`. Effects are `read-only`, `output-only` (write only assigned output), or `source-write`. Kinds include `audit`, `lint`, `typecheck`, `focused-test`, `command`, `build`, `full`, `world`, `expedition`, `gpu`, `native`, `freeze`, `source-mutation`. Build/source-write, Full, World, expedition, GPU and Native must use heavy. The plan is a contract: declare command kind/effect honestly and keep file ownership separate between editors.

The constant `/workspace/.ashveil-tools/cloud-harness/locks/` directory is shared by every instance, including a future copy of the runner in another directory: at most two light tasks may execute together, and one heavy task excludes all other heavy and light tasks. Dependency failures block downstream tasks; unrelated tasks continue. These are cooperative locks: pre-existing jobs or direct commands outside this runner are not automatically covered. Coordinate those before using the queue. Source edits and image generation may continue outside this execution queue with disjoint ownership; pause writers while freezing a checkpoint. Browserless `node tools/game-harness.mjs --check` and `--list` may use light; real inputs and the preview adapter must use heavy.

Tokens `{out}`, `{task_out}` and `{python}` are replaced literally inside individual argv strings. No shell expansion occurs. A task must put all explicit generated output under `{task_out}`. Commands that inherently write cache files may need their existing tool-specific cache/output options. The runner does not alter command environment or install tools.

Checkpoint detection uses an adjacent `CHECKPOINT-manifest.json` found while walking cwd ancestors; paths under `.ashveil-checkpoints` without a manifest fail. Optional `snapshotManifest` must match the adjacent checkpoint manifest. Inside such checkpoints, source-write/build/freeze/source-mutation and known mutating commands are rejected before execution. Every manifested file is checked before and after a permitted command, and manifest SHA-256 is recorded. This is an integrity guard for trusted plans, not an operating-system sandbox against intentionally misdeclared Python/Node commands; never schedule arbitrary or unreviewed code as read-only. An integrity violation fails the job and blocks dependents; the runner does not repair evidence or restore source. Build the authoring checkout first, then freeze, then inspect the immutable copy. Do not build inside an immutable checkpoint.

`run.json` and per-task `task.json` preserve resolved argv/cwd, kind/effect, dependencies, queued/lock-acquired/start/end times, process/group IDs, exact subprocess `exitCode`, manifest SHA and integrity results. An infrastructure/integrity `failureCode` is separate: a child that exits 0 before an integrity failure is still recorded as child exit 0; an executable that never starts has child exit null. Each executed task gets separate `stdout.log`/`stderr.log`. Task negative exit codes retain POSIX signals. The runner returns the first failing task's failure/exit code in plan order, maps a signal to `128+signal`, returns `128+signal` when interrupted itself, and returns 2 for invalid plans/reused output. A successful run returns 0. These files may contain tool output; keep raw Worlds local and publish only reviewed summaries.

On normal completion, failure or SIGINT/SIGTERM the runner terminates only process groups created by its own `Popen(start_new_session=True)`, using TERM then KILL when needed. Unrelated processes are untouched. A process that deliberately creates another session escapes this group contract and must own its own lifecycle. Ports and source roots are recorded by each command; the existing Native preview helper still enforces strict port ownership. Do not run multiple port-4317 commands outside the shared queue.

`verify.py` defaults to `/workspace/.ashveil-tools/cloud-harness/verification/run-TIMESTAMP/verification.json` plus full plans/logs even when copied elsewhere. `--out` selects an entirely new verification directory; an existing directory is refused. Each runner invocation uses a new log name, including negative retries, preserving earlier logs. It uses actual subprocess markers to test cross-runner light parallelism, heavy exclusion, failure propagation, reused/empty output refusal, checkpoint policy/SHA checks, literal argv preservation and owned process-group cancellation while an unrelated process remains alive. Only these tiny marker programs are run; no game suite, browser, build or installation is started by the verification.

`--regressions` checks the narrow browserless-light exception and uses two real marker runners at different filesystem locations to confirm they share the constant lock namespace.

Run self-verification while the heavy queue is free. Its 30-second subprocess deadline includes waiting for cooperative locks, so an unrelated long game check can yield a timeout rather than an assertion failure. All selfcheck-owned runner processes are cancelled and their logs retained on a failed assertion or timeout; never terminate someone else's game check to make the selfcheck finish.

`plan.py --locale` adds the real two-viewport language/settings/save-load scenario after the common smoke. It uses a heavy Native slot and compares the complete observed world with an independently created Node world. It does not assert that all game content has been translated.

Both profiles first test the dependency-free preview helper with real owned HTTP subprocesses: plain/colored and split readiness output, occupied port and a missing Vite entry. Native readiness strips terminal color codes before checking the owned strict-port process's URL. It does not accept another server that happens to occupy the port.

`--gameplay-locale` adds v401 gameplay inputs and independent full-world comparisons at 1440×1080, 1366×768 and 390×844. With `--locale`, it follows the existing v400 scenario. Both use heavy Native lanes; neither claims full-game translation.

`--status-locale` adds the v402 declared low-HP fixture and actual fatal-warning acknowledgment/language/movement/save inputs in three viewports. Korean warning identity remains independent of display language. Its focused locale/thermal suites precede Full, and Native remains heavy and sequential.

`--item-locale`는 공개 물품 이름/검색·실제 메뉴/버리기·탐구 저장/계속하기를 세 화면에서 검사한다. v403 묶음은 이전 상태 표시를 다시 작성하지 않으므로 공통 스모크/타이틀 언어와 이 Native를 실행한다. `--gameplay-locale`/`--status-locale`은 독립 옵션으로 유지한다. 대상 검사와 기존 소지품/빠른 슬롯 경계는 Full 전에 실행하고 Native는 heavy 단독이다.

`--checkpoint-locale`는 탐구/표석의 실제 저장·복원 검토/취소/모드 선택·타이틀 복원을 heavy 단독으로 실행한다. 관련 저장/콘텐츠 계약 검사는 Full을 선행 차단한다. 원시 초기/실제/기대 세계는 아티팩트에서 제외한다.

`cloud/ashveil-native-*` 브랜치는 기존 authoring 프로필로 도구/Native만 재검한다. 앱 원문이 같은 선행 Full 성공의 SHA를 별도로 기록해야 하며 새 Full 성공으로 합산하지 않는다. 일반 클라우드 release와 main Pages Full은 유지한다.
