# ASHVEIL (애쉬베일)

> 규칙은 투명하게, 세계는 끝없이 낯설게.

재의 장막에 덮인 변경 행성 **하스**를 탐험하는 턴제 RPG와 세계 시뮬레이션이다. 테라포밍 기계망이 침묵한 지70년, 떠돌이는 폐허와 다른 지역을 오가며 자기 몸·물품·시간으로 살아남는다. 독자적인 세계관과 무료2D 도트 그래픽을 사용한다.

**현재 상태: 프로토타입 v0.283 검증 중** · 각인191. 전체5,792개와 실제15장 검증 완료·월드30판 검사 중. 전체 후속 구현은 계속 진행한다. [진행 상황](docs/progress.md) · [구현 현황](docs/prototype.md) · [전체 로드맵](docs/expansion-roadmap.md).

## 현재 플레이할 수 있는 것

- 수도원 앞뜰/지하3층,128×96월드와 다른 지상 지역·정착지, 지역/해상 이동.
- 상처·출혈·감염·체온·영양·수면·정신, 실제 같은 몸과 자원을 사용하는 처치/생존 행동.
- 격자 배낭·루팅·장비/착탈·유한 재료의 제작/수리·조리/정수·불과 실제 물 소화.
- 주민/상인과 실제 거래·동료/포로·거점 작업, 개인 지식·당시 지도·정찰 원본/계약.
- 새 주민의 개인 이름·실제 직접 소개, 주민 사이 대화·직접 들은 이웃 관계.
- 원래 의뢰인과 함께 걷는 호송·공동 도착 확인, 봉인 보관함의 실제 도구 작업·원본 납품.
- 실제 이웃의 자기 의료 물품·다턴 처치와 플레이어가 목격한 돌봄.
- 동료가 실제 관찰한 방/계단과 자기 종이·잉크의 지도 작성/중단·재개·원본 전달.
- 귀환한 동료의 방/계단 구두 보고·원래 관찰 시각과 출처·서로 다른 지도 주장의 충돌 표시.
- 현지 주민에게 아는 소식 게시·실제 육로의 지연/왜곡·도착 후 대화와 의심 표시.
- 실제 새 봉쇄/해제 공고·현장 목격 이름 소식과 도착한 마을의 첫 만남 반응.
- 비고용NPC의 자기 기록/재료 지도 작성·상인 자기 재고의 준비·원본 유료 구매/독서.
- 직접 본 물 지형의 당시 지도와 약탈단의 거짓 시설 주장·자기 관찰과의 대조.
- 월드 지형의 당시 기록/시각·실제 주변 갱신과 기록에 따른 육로 예상.
- 직접 관찰한 월드 종이 지도 작성/독서·주장 충돌과 미탐색 경로 예상.
- 새 월드 정찰 원본 계약·실제 예치/납품/환급과 원본 지도 시장 거래.
- 상인의 자기 시장 지도 독서·동료의 실제 월드 관찰과 출처/시각이 있는 구두 보고.
- 동료의 자기 월드 원본 작성/중단·재개·전달과 비고용NPC의 독립 제작/개인 현금 거래.
- 그늘 작물의 실제 햇빛·기온·유한 관수/성장·수확과 거점 동료의 직접 관리·납품.
- 선택한 사건 성향/유한 예산·긴장과 원래 야영지 인원 순찰 강화·실제 승리 명성.
- 실제 안전한 수면의 긴장 회복과 추가 순찰 인원의 실제 단가/지출 기록.

기본 **각인** 모드는 단일 슬롯으로 자동 저장하며 사망하면 저장을 삭제한다. 전체 생태·경제·전파망과 X1~X4의 모든 기능이 완성된 상태는 아니다.

## 화면 미리보기

통합 검증을 마친 원본 아트/UI 웹 빌드에서 실제 새 게임을 시작해 촬영한 화면이다.

![실제 새 게임 화면](docs/previews/v277-world.png)

[소지품 화면](docs/previews/v271-inventory.png) · [웹 배포 상태와 Pages 설정](docs/web-preview.md). 자동 빌드는 성공했으며 공개 주소는 Pages 활성화 후 확인한다.

## 실행

검증 환경은 Node.js24와 pnpm9다.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

방향키/숫자패드로 이동·공격하고 맵 클릭으로 자동 이동한다. `1~0` 빠른 슬롯, `C` 캐릭터, `I` 소지품, `N` 주민/동료, `M` 지도, `Shift+K/B/J` 능력/신체/일지, `F2` 제작/정비, `F3` 설정, `.` 대기, `r` 휴식, `z` 수면, `?` 도움말. 키 설정은 게임 안에서 바꿀 수 있다.

## 검증

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm validate-defs
pnpm validate-schema
pnpm build
pnpm sim:batch 30 3 test-results/sim --world
```

Schema 검사는 Python3와 [검사 의존성](tools/requirements-schema.txt)이 필요하다.

고정 명령의 전체 상태와 오류, 중간 저장/복원, 실제 브라우저 입력을 검증한다. 월드 회귀는 같은 시드30판의 전체 결과 행을 비교하며 사람의 플레이 평가와 구분한다. 최신 검증 수치와 원문 비교는 [구현 현황](docs/prototype.md)과 [월드 결과](docs/sim-latest.json)에 있다. 예전 README의 상세 버전 기록은 [보관 문서](docs/readme-history-v162.md)에 남겼다.

브라우저 검사는 빌드 후 실행한다. Chromium이 기본 클라우드 경로에 없으면 실행 파일을 지정한다.

```bash
CHROMIUM_PATH=/path/to/chromium pnpm exec tsx tests/e2e/scout-room-rumors.ts test-results/browser
```

## 구조와 기획

- `src/core`: DOM·Vue·Pixi와 분리한 결정론 규칙/스케줄러/각인.
- `src/client`: Vue UI와 Pixi 월드 화면.
- `src/content/core`: JSON Def와 기존 콘텐츠를 바꾸는 PATCH.
- `tests`, `tools`: 규칙/속성/골든·브라우저 검사, 시뮬레이션과 콘텐츠 검증.
- `docs`: 정본 기획, 구현 기록과 검증 근거.

기획 우선순위는 [CANON](docs/CANON.md) → `docs/design` → `docs/GDD.md` → `docs/lore`다. 구현 차이는 [체크리스트](docs/implementation-checklist.md), 현 엔진을 유지하는 근거는 [엔진 평가](docs/engine-evaluation.md), 작업 규칙은 [CLAUDE.md](CLAUDE.md)를 따른다.

## 크레딧

그래픽: [Knowledge Temple](https://pingupollas.itch.io/knowledge-temple)·[Crawling Depths](https://pingupollas.itch.io/crawling-depths) by [pingupollas](https://pingupollas.itch.io/), [Damp Dungeons](https://arex-v.itch.io/damp-dungeons) by arex-v, [Dark World](https://kaishido.itch.io/dark-world) by kaishido (CC0), [Dungeon Tileset II](https://0x72.itch.io/dungeontileset-ii) by 0x72 (CC0), [Dark Ages UI](https://hypnobius.itch.io/dark-ages-ui) by hypnobius, [DCSS 32×32](https://opengameart.org/content/dungeon-crawl-32x32-tiles) (CC0). 라이선스와 재배포 조건은 [CREDITS.md](CREDITS.md).

## 원본 아트·UI와 깃 상태 구현 (v0.277 통합 검증 완료)

원본 타이틀 풍경·초상·4방향28프레임 캐릭터와 얇은 재색/황동 UI를 적용했다. 아래는 실제 타이틀→새 게임에서 촬영한 화면이다.1440×1080과1366×768에서 화면6장·실제 탄약 선택/사격/저장 복원6장(전체187 복원2회)을 확인했다. 깃 손상·명시적 탄약 선택/소진·회수 상한을 구현했고 전체311파일5,641개와 월드30판을 통과했으며30개 전체 결과 행은275와 같다. 각인187을 사용한다. 추가 아이콘/UI·개발 하네스와 나머지 장기 확장은 다음 작업으로 계속 진행한다.

![원본 타이틀과 생성 화면](docs/previews/v277-title.png)
![새 캐릭터와 HUD 실제 플레이](docs/previews/v277-world.png)
![새 소지품 창](docs/previews/v277-inventory.png)

## 게임 개발 스킬·하네스와 추가 원본 UI (v0.278 실제 화면 검증·전체 검사 후속)

[프로젝트 스킬](.agents/skills/ashveil-game-development/SKILL.md)과 [공통 게임 하네스](docs/game-development-harness.md)를 설정했다. 기존 Playwright/Chromium으로 `pnpm game:check --scenario smoke --check`로 입력을 확인하고, 실행 중인 게임 URL을 전달해 실제 조작·전체 화면·읽기 전용 상태를 기록한다. 공식 과거 클라이언트의 출처/라이선스를 보존했으며 새 엔진·브라우저 패키지를 추가하지 않았다.

1440×1080/1366×768 실제11단계씩·화면8장/콘솔0, 실제 탄약/187복원2·화면6장/15단계 전체 대조를 통과했다. 관찰·촬영 중 전체 게임 상태가 바뀌지 않는 것과 두 화면 크기의 전체 상태가 같은 것도 확인했다. 원본278 전체는5,644통과/1개 정의 제거 fixture 실패였다. 자루 정의만 지우고 새 그림 패치를 남긴 테스트 설정을 수정해279에서 통합 검증한다. 이 실패는279 통합 전체5,668개/월드30판에서 수정·검증했다.

![생존 상태 행과 원본 신체 SVG](docs/previews/v278-world.png)
![직접 그린 자루·화살통·허리띠·화살 아이콘](docs/previews/v278-inventory.png)

## 돌의 실제 투척 공격 (v0.279 통합 검증 완료)

돌 한 개를 실제로 던져 맞히고 같은 돌을 바닥에서 회수한다. 조준/취소·왼손 기능·빠른 슬롯·실물 쌓임/저장 보존을 연결했다. 기존 유인 투척은 유지한다. 전체313파일5,668개와 실제 화면5장/전체187복원2회를 통과했고 공통 하네스 두 화면 크기의8장도 확인했다.30시드 장기 검사도 완료했으며 전체 결과 행은277과 같다. [검증 근거](docs/release-v279-proof.json) · [구현 기록](docs/stone-throwing-implementation.md).

![실제 왼손 돌 조준](docs/previews/v279-stone-aim.png)
![원래 두 돌 회수](docs/previews/v279-stone-recovered.png)

## 실제 단발 화기 (v0.280 통합 검증 완료)

납탄과 흑색화약을 실제7턴에 장전하고 총기 기름을6턴 청소에 쓴다. 불발/걸림·총상·저장 상태와 직접 그린4아이콘을 연결했다. 전체314파일5,706개/실제 화면5장·전체188복원2회를 통과했고 월드30판도 통과했고279와30개 전체 결과 행·평균·사인이 같다. [검증 근거](docs/release-v280-proof.json).

![원본 장총·납탄·화약·기름](docs/previews/v280-1347-native-original-musket-ball-powder-oil-icons-and-actual-counts.png)
![실제 총상 사격](docs/previews/v280-1350-native-actual-gunshot-and-original-one-round-consumed.png)

## 실제 탄창·탄피 재장전 (v0.281 통합 검증 완료)

권총6발을 한 발2턴씩 채우고 소총은5발 클립을3턴에 장전한다. 공장/재생 실탄, 발사 후 같은 빈 탄피 회수와 장인 재장전, 직접 그린6아이콘을 추가했다. 실제 화면7장/전체189복원3·13단계 대조와 두 해상도8장을 통과했다. 작은 화면에서도 시작 버튼이 스크롤 없이 보인다. 전체315파일5,738개와 월드30판을 통과했고280과30개 전체 결과 행·평균·사인이 같다. [검증 근거](docs/release-v281-proof.json).

![원본 권총·소총·실탄](docs/previews/v281-1352-native-original-revolver-rifle-ammunition-and-primer-icons.png)
![실제 소총5발 클립과 남아 있는 권총](docs/previews/v281-1356-native-real-five-round-rifle-three-turn-clip-and-loaded-revolver.png)
![작은 화면의 실제 시작 버튼](docs/previews/v281-1366-00-title.png)

## 투창 회수·실제 잔탄 HUD (v0.282 통합 검증 완료)

직접 그린 투창을 실제 손에서 던지고 같은 무기를 회수한다. 총기 잔탄·빈 총·걸림은 실제 탄창 상태를 읽어 HUD와 아이콘에 표시한다. 전체316파일5,764개650.2222172851563초(작업자2)와 월드30판433.258881501초를 통과했다.281과30개 전체 결과 행·평균·사인이 같다. 실제 화면23장도 통과했다. [검증 근거](docs/release-v282-proof.json).

![실제 투창 회수](docs/previews/v282-1364-native-actual-same-javelin-recovered-and-held-one-round-gun-preserved.png)
![작은 화면의 실제 잔탄](docs/previews/v282-1366-native-small-screen-rifle-four-rounds-and-original-loaded-revolver.png)

## 기본 전투 행동·양손 대도 (v0.283 검증 중)

실제 무장해제로 떨어뜨린 원래 총의 장전탄·걸림·품질을 회수 후에도 보존한다. [검증 근거](docs/release-v283-proof.json).

![실제 무장해제 조준](docs/previews/v283-1369-native-actual-disarm-aim-chance-and-cost.png)
![양손 대도와 작은 화면](docs/previews/v283-1373-native-small-screen-greatsword-and-both-maneuver-buttons.png)
