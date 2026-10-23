# ASHVEIL (애쉬베일)

현재 개발 미리보기는 **v0.327-dev·저장212**이다. 모드의 명시적 제작법 ID 이행을 배운 지식·원래 착수 진행·거점 지시/대기열에 연결하고, 재료·출력·노동 규칙이 달라진 작업은 검토에서 막는다. 동료 진찰/투약·의료 보급/최소 재고 협업을 유지한다. [구현·제약](docs/recipe-renames-v327.md) · [자율 구현 추적](docs/autonomous-implementation.md) · [게임 실행](https://roastfried-rf.github.io/ashveil/).

v319/320의 무기·의복·도구 등 물품80종은 유지한다. [물품 원화](docs/equipment-art-v320.md) · [이전 위키 조사](docs/wiki-resource-study-v319.md). 거점 최소 재고와 동료 응급 처치도 구현했으며 통합 검증은 대기 중이다. [최소 재고](docs/base-craft-stock-v318.md) · [동료 처치](docs/companion-care-v317.md). [이동·광원 변경](docs/movement-people-v316.md). 전체 회귀는 후속 단계이며 마지막 전체 회귀 검증본은 v0.312·저장206이다. [밭 관리](docs/crop-management-v315.md) · [실마리](docs/conclusions-research-v314.md) · [작물 원화·UI](docs/feature-ui-v313.md).

> 규칙은 투명하게, 세계는 끝없이 낯설게.

재의 장막에 덮인 변경 행성 **하스**를 탐험하는 턴제 RPG와 세계 시뮬레이션이다. 테라포밍 기계망이 침묵한 지70년, 떠돌이는 폐허와 다른 지역을 오가며 자기 몸·물품·시간으로 살아남는다. 독자적인 세계관과 무료2D 도트 그래픽을 사용한다.

**현재 상태: 프로토타입 v0.312** · 저장206(205호환). 지상 밭의 실제 이탈 날씨·관수/증발·토양 정산을 연결했다. 전체348파일6,267개·월드30판·두 화면 실제16PNG/전체28쌍·복원10회 확인. 시야12/어둠6칸·각인/표석/탐구·울림 특성과 현재 원화를 지원한다. **v1.0.0까지 후속 확장 포함 개발 중**이다. [게임 실행](https://roastfried-rf.github.io/ashveil/) · [재배/검증](docs/surface-cultivation-v312.md) · [검사 화면](docs/previews/v312-field-harvest.png) · [출시 기준](docs/v1-execution.md).

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

v0.321의 실제 게임 렌더러에서 원화 비교용 유한 초기 장면을 불러온 화면이다. 자연 탐험이나 전체 회귀 완료 화면과 구분한다.

![v0.321 실제 야외 원화 검토 화면](public/artbook/comparison/after-field-1440.png)

[이전 통합 검증의 자연 새 게임 화면](docs/previews/v311-ground-day.png) · [현재 공개 게임](https://roastfried-rf.github.io/ashveil/) · [실제 배포 기록](docs/web-preview.md).

## 실행

검증 환경은 Node.js24와 pnpm9다.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

방향키/숫자패드로 이동·공격하고 맵 클릭으로 자동 이동한다. `1~0` 빠른 슬롯, `C` 캐릭터, `I` 소지품, `N` 남동 이동, `Shift+N` 주민/동료, `M` 지도, `Shift+K/B/J` 능력/신체/일지, `F2` 제작/정비, `F3` 설정, `.` 대기, `r` 휴식, `z` 수면, `?` 도움말. 키 설정은 게임 안에서 바꿀 수 있다.

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

수도원 자연 원정의 최대 도달 층/레벨·사인 집계는 불변 검증본에서
`pnpm sim:expedition /절대경로/새결과 1000 3`으로 실행한다.
[고정·측정 조건](docs/performance-v309.md)을 따른다.

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

## 기본 전투 행동·양손 대도 (v0.283 통합 검증 완료)

실제 무장해제로 떨어뜨린 원래 총의 장전탄·걸림·품질을 회수 후에도 보존한다. [검증 근거](docs/release-v283-proof.json).

![실제 무장해제 조준](docs/previews/v283-1369-native-actual-disarm-aim-chance-and-cost.png)
![양손 대도와 작은 화면](docs/previews/v283-1373-native-small-screen-greatsword-and-both-maneuver-buttons.png)

## 실제 웅크림·두 번째 약탈자 (v0.284 통합 검증 완료)

HUD나 Alt+C로 낮은 자세를 취한다. 실제 이동·발소리·명중률과 저장 후 자세까지 같은 상태를 사용한다. [검증 근거](docs/release-v284-proof.json).

![실제 웅크림](docs/previews/v284-1375-native-actual-zero-tu-crouch-body-hud-status.png)
![작은 화면의 자세와 투창 회수](docs/previews/v284-1380-native-small-screen-posture-and-recovered-original-javelin.png)

## 실제 문 잠금·정밀 도구 (v0.286 통합 검증 완료)

F2에서 실제 도구·성공률·시간/마모/소음을 보고 잠금을 푼다. 실패도 같은 작업 비용을 낸다. 기존 필수 통로·열쇠/기계 봉인은 보호한다. [검증 근거](docs/release-v286-proof.json).

![정밀 도구의 실제 실패 비용](docs/previews/v286-1382-native-actual-failed-pick-original-lock-remains-after-ten-turns.png)
![원본 문이 별도 행동으로 열린 상태](docs/previews/v286-1385-native-actual-original-door-open-frame-after-separate-one-turn.png)
![작은 화면의 원본 도구와 문](docs/previews/v286-1388-native-small-screen-original-lockpick-tools-and-restored-doors.png)

## 발굴 정제 노화·살아 있는 원본 (v0.287 통합 검증 완료)

같은 약 외형이라도 더미 보존 상태는 다를 수 있다. 실제 분량·효력과 관찰 가능한 단서를 사용하며 과거 정제는 소급 약화하지 않는다. [검증 근거](docs/release-v287-proof.json).

![실제 살아 있는 환자·포자·융합체·드론 원본](docs/previews/v287-1389-native-original-living-patients-spores-boss-and-active-inert-drones.png)
![실제 부분 시음과 남은 정제](docs/previews/v287-1391-native-actual-half-potency-quarter-sample-and-same-batch-remainder.png)

## 주민 외형·정제·석판 (v0.288)

주민·의원·경비·상인 네 역할을 원본112자세로 구분하고, 저장된 사람의 외형 선택·몸·장비를 유지한다. [검증 근거](docs/release-v288-proof.json).

![실제 주민 네 역할과 원본 석판](docs/previews/v288-1396-native-original-player-and-retiree-preserved-resident-healer-displays.png)
![실제 정제 원본과 부분 시음](docs/previews/v288-1398-native-original-tablet-quarter-sample-and-three-quarter-remainder.png)

## 실제 육로 영향권·지도 확대·원본7물품 (v0.289)

새월드에서 바다·도로·고도를 따라 초기영향권을 계산하고 당시 기록만 지도에 남긴다. 확대/내위치복귀와 원래 좌표 클릭을 지원한다. [검증 근거](docs/release-v289-proof.json).

![실제 확대지도와 당시 영향권](docs/previews/v289-1402-native-actual-boundary-shows-only-dated-old-territory-record.png)
![실제 물 용기·소금·의안·전원셀·약품 원본](docs/previews/v289-1404-native-seven-real-vessel-salt-eye-cell-draught-and-ampoule-icons.png)

## 목제 보관함 화재·원본5종 (v0.290)

실제500ml로불을끄면부분연료와내용물을보존한다. 소진되면원래물품은같은UID로원래바닥에남는다. [검증 근거](docs/release-v290-proof.json).

![실제 보관함 발화와 수목 원본](docs/previews/v290-1411-native-default002-spark-original-wood-chest-burns-with-original-forest.png)
![실제 소지품 원본과 열린 보관함](docs/previews/v290-1419-native-original-portable-chest64-and-restored-open-chest.png)

## 인접 밭의 남은 물·작물 원본 (v0.291)

맞닿은 따뜻한 지상 밭이 남은 물을 천천히 나눈다. 기존 작물의 오염은 복제하지 않고 남겨 둔다. [검증 근거](docs/release-v291-proof.json).

![실제 물1000ml의990/10 분배](docs/previews/v291-1421-native-original1000ml-now990and10-no-created-water.png)
![원본 종자 봉지·그늘뿌리·흰갓](docs/previews/v291-1424-native-three-original-crop-item-icons-and-original-empty-bottle.png)

## 리소스 검사·기본 무기 원본 (v0.292)

개발 하네스가 PNG·프레임·아이콘 참조를 빌드 전에 검사한다. 녹슨 칼·손도끼·철근 창을 새 원본으로 표시한다. [검증 근거](docs/release-v292-proof.json).

![실제 원본 무기3](docs/previews/v292-1427-native-original-knife32-hatchet64-and-rebar-spear32-in-actual-bag.png)

## 모드의 원본16×16 PNG (v0.293)

PNG를 포함한 모드 폴더·ZIP·tar.gz를 같은 원본/해시로 가져온다. 설치 검토에서 손상된 픽셀을 거절하며, 플레이 중 승인한 구성 변경은 실제 소지품과 지도에 반영한다. [검증 근거](docs/release-v293-proof.json).

![실제 모드 소금 원본](docs/previews/v293-1436-native-actual-mod-png-inventory-original-three-salt-preserved.png)

## 계절 식량 생산·플레이어 원본·거래 우선 UI (v0.295)

촌락 생산이 계절에 따라 실제 저장고/상점 가격에 반영된다. 새 활/시위와 플레이어28포즈를 직접 제작했으며, 주민 창에서 상인 물품을 먼저 보고 도움·의뢰로 이동할 수 있다. [검증 근거](docs/release-v295-proof.json).

![거래 목록과 새 플레이어 원본](docs/previews/v295-1455-native-trade-stock-before-resident-services.png)

## 마체테 덤불 제거·마체테/가시관목 원본 (v0.296)

손에 든 실제 마체테로 야생 가시덤불을 영구 제거하고 빈 흙에 원래 종자를 심을 수 있다. 덤불 밑의 기존 물품은 보존되며 추가 열매나 목재를 지급하지 않는다. 새 마체테와 가시관목을 직접 제작해 물품·능력·지도에 적용했다. [검증 근거](docs/release-v296-proof.json).

![덤불 제거 후 원래 종자 파종](docs/previews/v296-1465-native-actual-original-seed-now-planted-in-same-cleared-earth.png)

## 정착지 식량 수급 장부·꾸러미 원본 (v0.297)

실제창고곁에서지난하루의생산·공동소비·충당하지못한식량과주민직접소비를확인한다. 인·일분과생존주민전체의일수를구분하고, 상점의마을배급환산식량과다른먹거리도구분한다. 꾸러미3상태를직접제작했다. 동일불변파일재사용과전체골든캡처도구로검증환경의디스크낭비를줄였다. [검증 근거](docs/release-v297-proof.json).

![실제 식량 부족 장부와 원본 빈 바구니](docs/previews/v297-1471-native-actual-empty-food-and-recorded-unmet-demand.png)

## 식량 소식·실제 귀리 농사와 새 원본 (v0.298–299)

마을의 지난하루 식량부족/재충당 공고를 현지 대화로 듣고 출처·날짜를 확인한다. 새로 심은 귀리는 실제 햇빛·기온·물로 자라며, 관수 오염은 원래 수확곡물과 귀리죽으로 이어진다. 실제 가열은 병원체를 없애지만 재 오염은 남긴다. 달걀2종·귀리/씨앗·귀리밭의 원본5종도 직접 제작했다. [통합 검증 근거](docs/release-v299-proof.json).

![실제 마지막 성장턴을 거친 원본 귀리밭](docs/previews/v299-1494-native-real-three-final-growth-turns-original-mature-oat-plant.png)

## 생활재료·생존도구와 같은 그릇의 원본 (v0.300)

장작·고철·실·가죽·숯·천·붕대·횃불·모닥불 키트·돌과 빈 그릇/덜 익은 귀리죽/익은 귀리죽13종을 직접 제작했다. 창·활 능력8종도 기존 원본 아이콘에 연결하고, 조리창에는 실제 현재 그릇을 표시한다. 기존 수량·연료·영양·능력 규칙은 보존했다. [통합 검증 근거](docs/release-v300-proof.json).

![실제 조리 중인 원본 귀리죽 그릇](docs/previews/v300-1497-native-four-hundred-real-hot-turns-keep-grain-ash-and-original-bowl.png)

## 주민의 실제 곡물 조리와 개인 조달 (v0.301)

주민이 가진 귀리와 개인 돈·유한 상점 재고·원래 물병·같은 그릇·직접 피운 장작불을 연결했다. 실제 끓이고 먹은 양과 소비한 장작만 마을 장부에 반영한다. 바로 곁에서 주민이 올린 음식은 볼 수 있으며 타인 음식과 불의 조작은 제공하지 않는다. [통합 검증 근거](docs/release-v301-proof.json).

![주민이 실제 올린 귀리죽과 타인 물품 관리 경계](docs/previews/v301-1512-native-original-raw-bowl-on-actual-resident-fire-with-no-steal-button.png)

## 전체 리소스 원화 적용 (v0.302)

게임 정의352개와 UI26종을 조사해 실제 로딩 경로를 자체 원본으로 연결했다. 물품206개·능력28개는 각각 고유한 아이콘을 쓰고, 동물4종과 두목·궁수는 새4방향 동작을 사용한다. 우물·침구·작업대·장치·작물도 용도별 그림으로 표시한다. [통합 검증](docs/release-v302-proof.json).

[이미지가 포함된 원화 도감](docs/previews/v302-art-catalog.html)을 다운로드해 원본을 살펴볼 수 있다. 공개 게임 사이트 배포와 별개이며 전체 후속 기능 완료를 뜻하지 않는다.

![새 동물과 두목·궁수](docs/previews/v302-art-1601-creatures-actual-original-art.png)

![새 지하 소품과 지형](docs/previews/v302-art-1601-props-actual-original-art.png)

## 벤치마킹에 따른 미술 전면 재설계 (v0.303)

낮은 대비의 낡은 지면, 성인 체형과 역할별 장비, 실제 구조가 읽히는 생활 도구, 먹색 철·양피지 UI로 통일했다. 참고작 그림을 복제하지 않고 새 정수 좌표 원본을 제작했다. 신체 창은 여섯 부위의 해부 스케치를 사용한다. [방향·출처·검증](docs/art-direction-v303.md).

![새 지형·인물·HUD](docs/previews/v303-1440-01-world.png)

![새 신체 스케치와 상태 표시](docs/previews/v303-art-direction-1705-small-original-anatomy-and-six-states.png)

개발 미리보기 v0.313-dev: 작물 성장 원화31프레임·채소 물리 재배·제작/지도/계약/소지품 탐색·원정 준비 수첩을 큰 묶음으로 구현했다. [새 기능과 검증 대기 범위](docs/feature-ui-v313.md). 기존312의 통합 검증과 구분하며, 사용자 지시에 따라 회귀/실제 화면 테스트는 후속 묶음으로 진행한다.

개발 미리보기 v0.314-dev: 실제 기록에 따른3갈래 마무리·4실마리 묶음의11개 연결·생애 보고서 전체 열람과 복사/파일 저장을 추가했다. [내용과 후속 검증](docs/conclusions-research-v314.md). 기능 구현을 우선하며 통합 회귀/실제 화면 확인은 뒤로 모은다.

개발 미리보기 v0.315-dev: 새 밭의 원래 바닥 기록·자기 밭 정리·미수확 오염 잔재의 재파종 인계·잔재 원화를 구현했다. [범위와 검증 대기](docs/crop-management-v315.md). 저장207이며 과거 밭의 바닥/오염은 추정하지 않는다.

개발 미리보기 v0.316-dev: 먼 클릭·대각선 보간의 임계 거리 순간 이동 제거, 자동 이동의 걸음 대기·문 통과, 카메라/휴대 광원 동기화와 인간형19종의 고밀도 원화·실제 양손 물품 표시를 구현했다. [원인·변경·제한된 실제 입력 확인](docs/movement-people-v316.md). 저장207/기존 Core·콘텐츠 유지, 전체 회귀는 후속이다.

개발 미리보기 v0.317-dev: 곁의 유급 동료에게 자기 실제 물품으로 붕대·상처 세척·부목을 부탁하고, 원래 다턴 의료와 환자 대기·중단/부분 부목을 이용한다. [정확한 범위와 검증 대기](docs/companion-care-v317.md). 새 저장 필드 없이207을 유지한다.

## v0.318 거점 완성품 최소 재고 개발

동료의 원래 제작·실제 재료 인출/완성품 납품을 사용하고 현재 창고+해당 작업자 배낭의 개수를 기준으로 부족하면 다시 생산한다. 기존 유한 제작은 유지하고 새 목표만 기록한다. [범위와 통합 검증 대기](docs/base-craft-stock-v318.md). 저장208,207→208은 헤더만 이행한다. 전체 회귀/실제 UI/새 저장 경로는 후속이며 v1.0.0 전체 완료는 아니다.

## v0.319 위키 조사와 자체 원화

위키3,937파일/4,372본문/288분류 목록과 사용/본문 분류를 모두 결합하고,601이미지를 시각 검토했다.33생물/206물품/85지형/28능력/26UI의 사용처를 대조하고 몸체26디자인·초상19종·무기/탄약30종을 새 자체 원본으로 연결했다. 가방의 실제 칸 비율, 불투명 몸체 선택, 타이틀/HUD/곁의 주민 초상과 공개 원화 도감을 추가했다. 저장208·Core/콘텐츠는318과 같으며 전체 회귀/새 저장 비교는 후속이다. [기록](docs/wiki-resource-study-v319.md) · [도감](https://roastfried-rf.github.io/ashveil/artbook/).

## v0.320 옷·장신구·생활 도구 원화

의복23/도구25/장신구2의50프레임을 실제 가방 크기로 직접 그리고 연결했다. 사슬/천/양모/가죽의 재질·봉제와 개별 생활 도구를 구분하고 실제 PNG 크기로 CSS/SVG 도감을 표시한다.170시트의 크기도 파일 검사에 포함했다. Core/콘텐츠/모드는319와 같고 저장208·통합 검증 대기를 유지한다. [기록](docs/equipment-art-v320.md).
