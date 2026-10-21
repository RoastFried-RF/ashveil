---
name: ashveil-game-development
description: ASHVEIL의 게임 기능·UI·아트를 수정할 때 실제 키/마우스 입력, 화면과 공개 상태 관찰, 기존 결정론 검증을 함께 사용하는 프로젝트 개발 절차.
---

# ASHVEIL game development

이 스킬은 저장소에서 관리하는 프로젝트 절차다. 공식 카탈로그에서 삭제된 `develop-web-game`의 역사적 action → observe 반복 절차를 참고했으며, 현재 유지보수되는 공식 스킬로 취급하지 않는다. 원본·버전·라이선스는 [provenance](../../../tools/vendor/openai-web-game/PROVENANCE.md)에 기록되어 있다. 아래 명령은 저장소 루트에서 실행한다.

1. `CLAUDE.md`, `docs/CANON.md`, 수정 대상 시스템 문서와 현재 구현 기록을 읽고 한 번에 검토할 동작을 정한다. 사용자 지시와 현재 담당 파일 범위를 우선한다.
2. 코어는 순수 TypeScript와 JSON Def로 유지한다. UI·브라우저·이미지 리소스를 코어에 넣지 않는다. 기존 Def 변경 절차와 저장/로드·결정론 규약을 따른다.
3. 기존 로컬 도구를 사용한다. `playwright-core`, Vite, 프로젝트 하네스가 준비되어 있다. 전역 설치나 `npx`의 자동 패키지 다운로드, 엔진 교체, 전역 환경 변수 변경을 하네스 설정 단계에 끼워 넣지 않는다.
4. `node tools/game-harness.mjs --list`로 시나리오를 확인하고 `--scenario smoke --check`로 브라우저 없이 입력을 검사한다. 한 기능에 필요한 최소한의 실제 입력을 `tools/game-actions/` JSON으로 추가할 수 있다. API로 코어 행동을 직접 호출하거나 세계 상태를 주입하여 UI 성공처럼 보이게 하지 않는다.
5. 이미 실행 중인 Vite 서버 또는 검증할 빌드의 preview URL에 `?debug`를 붙여 실행한다. 서버 실행과 빌드는 기존 프로젝트 명령을 사용한다. Full/World/GPU 검증이 다른 작업에서 돌고 있다면 담당자와 실행 순서를 조율한다. 느린 검사를 중복 실행해 타임아웃을 만들지 않는다.

   빌드의 두 화면 크기를 한 번에 검사하려면 `pnpm build` 뒤 `pnpm game:preview-check test-results/새접두사`를 사용한다. 자신의 preview가 실제 시작됐는지 확인한 뒤 기존 smoke를 순서대로 실행하고 자기 서버 그룹을 정리한다. 점유된 포트의 다른 빌드를 대신 검사하지 않으며 기존 결과는 덮어쓰지 않는다.

   ```sh
   node tools/game-harness.mjs --url 'http://localhost:4317/?debug' --scenario smoke --width 1440 --height 1080
   node tools/game-harness.mjs --url 'http://localhost:4317/?debug' --scenario smoke --width 1366 --height 768
   ```

6. 출력 경로의 PNG를 실제로 열어 타이틀·맵·캐릭터·HUD·창이 의도대로 보이는지 확인한다. `*-state.json`의 공개 관찰 정보와 화면이 맞는지, `errors.json`이 비었는지 확인한다. 새 문제가 있으면 가장 먼저 고치고 해당 짧은 시나리오를 다시 실행한다.

   리소스를 바꿨으면 먼저 `pnpm validate-sprites`로 실제 PNG 파일·CRC·프레임 범위·애니메이션/캐릭터 참조·해석된 물품/능력 아이콘을 검사한다. 새 패치가 상속 필드에 값을 넣는 경우 원문에 필드가 없으면 `replace` 대신 `add`를 사용하고 `pnpm validate-defs`로 실제 로드를 확인한다. 이 파일 검사는 픽셀 외형·원본 재현·실제 브라우저 장면 검토를 대체하지 않는다.
7. `Period`는 실제 한 턴 대기, `Control+ArrowDown`은 실제 남쪽 회전, `i`는 소지품 창 열기다. `Space`는 열린 루팅/소지품 문맥에서 다른 행동이 될 수 있다. `frames`는 표현 대기이며 게임 턴을 만들지 않는다. 시간 대기만으로 생존/전투 결과가 진행됐다고 주장하지 않는다. 대기·관찰·촬영 중 원본 세계 수치·난수·각인을 바꾸지 않는다. 정상 렌더러의 표현 FX 소비와 실제 게임 행동을 구분한다.
8. 변경에 맞는 기존 코어/저장/전체 상태 비교 테스트를 실행한다. 이 하네스의 JSON은 진단 자료이며 독립적인 기대 세계와의 whole 비교나 저장 복원을 대체하지 않는다. 배포는 기존 검증·게시 절차를 따른다.
9. 변경점·실제 실행한 검사·PNG/JSON 결과·남은 제약을 프로젝트 문서와 최종 보고에 정확히 남긴다. 기존 기록을 유지하고 검토하지 않은 화면이나 실행하지 않은 검사를 통과로 적지 않는다.

검사할 빌드를 고정할 때는 `pnpm game:freeze --output /workspace/.ashveil-checkpoints/새이름 --reuse /workspace/.ashveil-checkpoints/이전불변본`을 쓸 수 있다. 동일 파일만 **이전 불변본**에서 hardlink하며 작업본과는 연결하지 않는다. 불변본은 이후 편집하지 않고, 검사와 게시의 cwd를 그 경로로 지정한다. 실제 골든의 전체 초기/최종/오류를 캡처하려면 `pnpm golden:capture test-results/새이름.json`을 쓴다. 기존 출력과 기대값을 덮어쓰지 않으며, 변경 감사와 기대값 갱신은 별도다.

명령·액션 형식·산출물은 [하네스 문서](../../../docs/game-development-harness.md)를 참고한다. `window.render_game_to_text`는 `?debug`에서만 제공되는 읽기 전용 관찰 API다. 숨겨진 적, 미발견 지형, 닫힌 용기의 내용물을 공개 관찰 JSON에 추가하지 않는다. 전체 디버그 세계 JSON은 로컬 검증 자료로만 취급한다.

저장 호환·특수 몸/전투 상태의 기존 Native 검사는 유한한 초기 각인 fixture를 사용할 수 있다. 원래 재료/수량/UID·몸 상태·원문을 기록하고 실제 타이틀 불러오기 뒤 실제 입력과 독립 Node 전체 상태 비교로 검증한다. 불러오기 뒤 브라우저 세계 교체/수치·난수·시각 조작으로 결과를 맞추지 않는다. 초기 fixture와 정상 플레이에서 얻은 결과를 보고서에서 구분한다.
