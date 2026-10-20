# 게임 개발용 빠른 하네스

`tools/game-harness.mjs`는 실행 중인 ASHVEIL에 실제 키·마우스 입력을 보내고 전체 화면과 상태를 저장하는 작은 Playwright 어댑터다. 게임을 짧게 조작하며 UI·캐릭터·아트·기능을 확인할 때 쓴다. 코어의 독립적인 기대 세계 비교, 저장 복원, Full/World 검증은 기존 테스트가 계속 담당한다.

OpenAI의 삭제 전 `develop-web-game`을 검토한 뒤 기존 `playwright-core`와 프로젝트 구조에 맞게 구성했다. 공식 최신 카탈로그에는 그 스킬이 없으며, 보관한 원본을 유지보수 중인 공식 기능으로 표시하지 않는다. [원본 출처·수정 경계·SHA-256](../tools/vendor/openai-web-game/PROVENANCE.md)과 Apache 2.0 라이선스를 함께 보관한다. 프로젝트 스킬은 [.agents/skills/ashveil-game-development/SKILL.md](../.agents/skills/ashveil-game-development/SKILL.md)다.

## 실행

새 패키지·엔진·브라우저 설치가 필요하지 않다. 이미 설치한 `playwright-core`를 사용한다. 브라우저는 `--executable-path`, `CHROMIUM_PATH`, `/workspace/.ashveil-tools/chromium`, Playwright의 기존 설치 경로 순으로 찾는다. 명시한 경로가 없으면 실패하며 자동 다운로드하지 않는다. 현재 workspace shim은 기존 Chromium 실행 환경을 제공한다.

```sh
node tools/game-harness.mjs --list
node tools/game-harness.mjs --scenario smoke --check
```

이 두 명령은 브라우저를 띄우지 않는다. 실제 실행 전에는 기존 서버를 준비한다. 개발 중에는 `npm run dev -- --port 4317 --strictPort`, 빌드를 확인할 때는 기존 빌드 후 `npm run preview -- --port 4317 --strictPort`를 별도 터미널에서 사용한다. 다른 Full/World/GPU 검사가 실행 중이면 실행 순서를 조율한다. 하네스 자체는 서버나 빌드를 자동으로 만들지 않는다.

```sh
node tools/game-harness.mjs --url 'http://localhost:4317/?debug' --scenario smoke --width 1440 --height 1080
node tools/game-harness.mjs --url 'http://localhost:4317/?debug' --scenario smoke --width 1366 --height 768
```

기본 산출물은 `test-results/game-harness/<scenario>-<width>-<고유 접미사>/`에 저장된다. `--out`으로 경로를 지정할 수 있지만 이미 파일이 들어 있으면 실패한다. 이전 실패 자료를 덮어쓰지 않는다. 브라우저는 매번 새 컨텍스트를 만들므로 기존 사용자 각인을 읽거나 바꾸지 않는다.

기본 `smoke`는 실제 타이틀에서 시드를 입력하고 시작한 뒤 `Period`로 한 턴 대기, `Control+ArrowDown`으로 남쪽 회전, `i`로 소지품을 연다. 타이틀·게임·소지품을 각각 기록한다. `Space`는 열린 루팅 문맥에서 모두 가져오기일 수 있으므로 일반 대기 입력으로 쓰지 않는다.

## 액션

`--scenario <이름>`은 `tools/game-actions/<이름>.json`을 읽는다. 임시 입력은 `--actions-file <경로>` 또는 `--actions-json '<JSON>'`으로 전달한다. 셋 중 하나만 사용할 수 있다.

```json
{
  "steps": [
    {"action": "fill", "selector": "[data-testid=seed]", "value": "ashveil-harness-smoke"},
    {"action": "click", "selector": "[data-testid=start]"},
    {"action": "waitFor", "selector": "[data-testid=map] canvas"},
    {"action": "press", "key": "Period"},
    {"action": "frames", "frames": 2},
    {"action": "snapshot", "name": "after-wait"}
  ]
}
```

| 액션 | 동작 |
|---|---|
| `press` | Playwright 키 또는 `Control+ArrowDown` 같은 조합을 한 번 누르고 놓는다. |
| `fill` | `selector` 입력에 문자열 `value`를 실제 입력한다. 빈 문자열도 허용한다. |
| `click` | `selector`를 클릭한다. `button`은 `left`/`right`/`middle`, 기본 `left`다. |
| `waitFor` | 선택자의 `visible` 상태를 기다린다. `state`로 `attached`/`detached`/`hidden`도 가능하다. |
| `frames` | 1~120개의 `requestAnimationFrame` 표현 프레임만 기다린다. 게임 행동을 호출하지 않는다. |
| `snapshot` | 이름에 해당하는 PNG·공개 상태·디버그 세계 JSON을 저장한다. 이름은 중복될 수 없고 `final`/`failure`는 예약되어 있다. |

알 수 없는 액션·키·레거시 버튼은 실패한다. 원본 `buttons` 키보드 예제의 `up/down/left/right/enter/space/a/b`도 받아들이지만 버튼마다 정확히 한 번 누른다. 원본의 hold/브라우저 자동 반복과 다르다. 레거시 마우스 버튼 대신 명시적인 selector 클릭을 쓴다. 선택자 실패를 무시하거나 입력을 조용히 건너뛰지 않는다.

맵의 `data-ready="true"`(실제 atlas/Pixi 초기화 완료), 시뮬레이션/활동/표현 FX가 정리될 때까지 읽기 전용으로 관찰하고 다음 입력을 보낸다. 표현 프레임과 PNG 대기는 실제 게임 턴과 별개다. 원본의 `advanceTime` shim을 설치하거나 코어를 직접 호출하지 않는다. 대기·관찰·촬영 중 원본 `world.s`의 수치·난수·시각·각인 내용을 바꾸지 않는다. 기존 렌더러가 정상적으로 소비하는 표현 FX 이외의 변화는 실제 입력에서만 발생해야 한다. 상태를 주입하거나 봇으로 행동을 대체하지 않는다.

## 산출물과 실패

- `<name>.png`: Vue 타이틀·HUD·창을 포함한 전체 DOM 페이지 이미지. 캔버스만 잘라내지 않는다.
- `<name>-state.json`: `?debug`의 `render_game_to_text()` 공개 관찰 JSON. 좌표·실제 플레이어 상태·보이는 세계를 확인한다.
- `<name>-world.json`: 디버그 훅에서 읽기만 한 전체 `world.s`. 타이틀에서는 `null`이다. 진단용 원본 상태이며, 독립 기대값 비교를 통과했다는 뜻이 아니다. 숨겨진 세계 정보가 들어 있을 수 있다.
- `actions.json`, `run.json`, `errors.json`: 정규화한 실제 입력, 완료 단계/화면 크기/실행 결과, 브라우저 오류 기록.
- 실패 시 `failure.png`, 가능하면 `failure-state.json`과 `failure-world.json`도 보존한다.

PNG를 찍기 전에 이미지와 글꼴 로딩을 기다리며 실패한 이미지는 오류로 처리한다. 콘솔 오류·페이지 예외·실패한 요청·HTTP 오류·액션 실패는 종료 코드 1이다. 성공이면 마지막 `final` 스냅샷과 `passed` audit를 남긴다. 출력 파일을 만들었다는 이유만으로 화면/게임 구현이 검증된 것은 아니다. PNG를 직접 열고 JSON과 동작을 함께 확인한다.

`--headless false`로 설치된 브라우저를 창 모드로 열 수 있고, `--timeout-ms`는 개별 대기 제한(기본 20초), `--width`/`--height`는 뷰포트다. 한 번에 빠른 시나리오 하나를 실행하며 긴 결정론 검사는 기존 도구를 사용한다.

## 이 환경에 연결한 검사 계약

`pnpm game:check`도 같은 하네스를 실행한다. `src/client/game-observation.ts`의 공개 관찰을 `?debug`에서만 연결했고, 타이틀에서는 남은 세계를 읽지 않는다. 실제 화면과 같은 지식/시야 규칙으로 지형·생물을 제한하고 닫힌 상자 내용물은 읽지 않는다. 미발견 지형/숨은 생물/닫힌 상자의 getter가 실제로 호출되면 실패하는 검사와 반복 조회의 전체 상태 불변 검사를 추가했다. 순수 코어/저장·이미 존재하는216개 브라우저 장면은 유지한다.

첫 관련3파일27개는 통과했다. 타입 검사에서는 신체 SVG 접근성 문구의 중첩 Vue 템플릿 추론과 닫힌 상자 getter 시험의 반환형 두 곳이 실패했다. 문구를 computed로 옮기고 예외 getter에 never를 명시했다. 원본 결과를 보존하며 수정한 빌드의 실제 실행과 최종 검사 결과는 아래에 추가한다.

## 278 실제 실행 결과

동결278 빌드에서1440×1080·1366×768의 smoke를 각각11단계 실행해8개 PNG를 모두 열어 확인했다. 두 실행의 콘솔/페이지/네트워크 오류는0이다. 각 실행의 실제 대기/회전 입력만200TU를 진행했고 소지품 관찰→최종 관찰 사이의 전체 WorldState와 공개 관찰 JSON은 그대로였다. 두 해상도의 초기 게임·소지품·최종 단계도 각각 전체 WorldState가 같았다. 브라우저가 보고한 콘텐츠 해시는 동결278의 전체 골든에 기록한 해시와 같았다.

같은 제품 코드로 실제 화살 선택/재비/사격/소진·187복원2회의 별도15단계 전체 대조를 통과했다.6개 PNG를 모두 확인했고 새 자루/화살통/허리띠/화살 아이콘과 상태7행·신체 SVG를 실제 게임에 적용했다. 이 하네스를 설치했다는 이유로 해당 독립 전체 상태 비교를 생략하지 않았다. 전체 회귀는278 동결본에서 별도로 진행 중이다.

278 원본 전체 검사는312파일5645개 중5644통과/1실패였다. 자루 제거를 재현하는 기존 fixture가 Item.Sack 정의만 지우고 새 그림 패치는 남겨 로더가 올바르게 대상 없음으로 거절했다. fixture에서 제거 대상 정의의 패치도 함께 제외하도록 수정했다. 제품/로더의 검증을 완화하지 않았으며 원본 실패를 보존한다. 후속 돌 투척과 함께279에서 통합 전체 검증한다.278 전체 통과로 표시하지 않는다.

## 281 화면 배치 관찰

타이틀 snapshot은 시작 버튼의 실제 getBoundingClientRect·화면 안 포함 여부·가운데 hit-test와 스크롤된 요소를 별도 *-layout.json에 기록한다. 게임/관찰 상태를 바꾸지 않는 DOM 조회이며, 작은 화면 시작 버튼의 위치를 실제 빌드에서 검증하는 자료다. 아직281 브라우저 실행 전이며 결과는 별도로 기록한다.

281 실제 실행: 두 화면 크기 각11입력/4PNG/오류0과200TU·관찰 전체 상태 불변/두 화면 크기 전체 동일을 통과했다. 시작 버튼 하단은1440에서880.28125,1366에서714.28125이며 둘 다 스크롤0·전체 화면 안·중앙 hit-test 통과다. 산업 화기는 별도7장/전체189복원3/13단계 전체 대조/실제8,000TU를 통과했다. 최초 Native 시간 가정 실패와 실제 수정은 [산업 화기 기록](industrial-firearms-implementation.md)에 보존했다.
