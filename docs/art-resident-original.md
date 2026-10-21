# ASHVEIL 원본 공용 주민 외형 resident_worker — 준비 패키지

2026-10-21에 촌락 주민이 가장 널리 공유하는 실제 외형을 조사하고, 살아 있는 성인의 일상복 원본을 직접 그렸다. 현재 상태는 **아트와 신규 char 병합 조각 준비 완료, 게임 미등록**이다. 모든 파일은 `/workspace/ashveil-resident-art` 안에만 작성했다. 게임 소스·Core·Def·실제 매니페스트·공용 시트·기존 문서·git은 변경하지 않았다.

## 조사 결과: 실제 공용 키는 hero

작업 시작 시 `Creature.Settler`는 `char: hero`를 직접 지정하고, 경비·상인·의사 등은 이를 상속한다. `Creature.Human`도 hero를 기본으로 하며 플레이어 `Creature.Drifter`는 hero를 직접 지정한다. 따라서 주민용으로 기존 hero 시트를 교체하면 플레이어 외형도 함께 바뀐다.

`src/content/core/defs`의 Creature 부모 관계를 읽어 조사한 hero 공유 항목은 16개다. 이 중 추상 Human과 플레이어 Drifter를 제외한 Settler 계열 주민은 다음 14개다. 이는 소스 상속 조사이며 모든 저장 월드에서 살아 있는 NPC 수를 센 결과는 아니다.

| Creature | 표시 이름 | 직접 부모 |
| --- | --- | --- |
| `Creature.SettlementDoctor` | 의사 | `Creature.Settler` |
| `Creature.Signalist` | 신호회 정비공 | `Creature.Settler` |
| `Creature.SignalistMerchant` | 신호회 부품 교환원 | `Creature.SettlementTrader` |
| `Creature.SignalistHealer` | 신호회 간병인 | `Creature.SettlementDoctor` |
| `Creature.SignalistGuard` | 신호회 파수꾼 | `Creature.SettlementGuard` |
| `Creature.RetiredWanderer` | 정착한 옛 떠돌이 | `Creature.Settler` |
| `Creature.LanternResident` | 해안 염부 | `Creature.Settler` |
| `Creature.LanternMerchant` | 형제단 소금 장부지기 | `Creature.SettlementTrader` |
| `Creature.LanternHealer` | 형제단 간병인 | `Creature.SettlementDoctor` |
| `Creature.LanternGuard` | 해안 등대 파수꾼 | `Creature.SettlementGuard` |
| `Creature.Settler` | 정착민 | `Creature.Human` |
| `Creature.SettlementGuard` | 정착지 경비 | `Creature.Settler` |
| `Creature.SettlementTrader` | 상인 | `Creature.Settler` |
| `Creature.ZeroVaultWarden` | 제3 초소 금고 문지기 | `Creature.SettlementGuard` |

`src/core/creatures.ts`는 해석된 Def의 char에서 생성 시 `Creature.sprite`를 선택한다. `src/core/settlements.ts`는 상인·의사·경비를 해당 세력의 Def로 실체화한다. 일반 촌락연합·길드·순례회·경비대의 주민 계열과 해안/신호회 주민의 공용 기반이 Settler다. 약탈자 야영지의 Reaver 계열은 `reaver0/reaver1`를 쓰므로 이 패키지의 주민 공용 기반과 구분했다.

조사 스냅샷 `tools/art/resident-usage-survey.json`은 실제 char, 원본 hero 계약, 16개 공유 Creature와 소스 경로, 신규 키 제안을 보존한다.

## 선택: 주민 전용 신규 char, 기존 hero 보존

공용 주민 한 외형을 **`resident_worker`라는 새 렌더 키**로 준비했다. 이 이름은 외형 구분용이며 직업·AI 역할·새 Creature를 추가하지 않는다.

기존 hero·hero_atk 시트, hero 프레임과 char는 병합 조각에 포함하지 않았다. 플레이어·기존 hero의 키와 원본 아트를 보존한다. 새 주민은 현재 hero의 방향별 12보행·가운데 idle·16공격 구조와 지면 앵커를 따른다. 새 주민의 모든 프레임은 이번에 작성한 별도 원본이며 기존 hero 픽셀을 추출·복제·재색칠한 작업이 아니다.

통합 시 권장하는 Def 연결은 `Creature.Settler`의 char를 `resident_worker`로 바꾸는 범위다. 현재 직접 char를 다시 지정하지 않은 위의 주민 자손들이 같은 새 외형을 상속한다. 이 패키지는 Def PATCH를 적용하지 않는다. `Creature.Human`과 `Creature.Drifter`는 제안 대상에 포함하지 않았다.

기존 저장본의 `Creature.sprite`는 이미 선택된 문자열로 남는다. 따라서 Def 연결만 바꾸면 새로 생성되는 주민부터 적용되며, 기존 주민의 표시 갱신이 필요하면 통합 담당자가 Settler 계열에만 한정해 별도 처리한다. 플레이어의 저장된 hero 키는 유지한다.

## 일상복과 살아 있는 성인

CANON의 회색 고원과 촌락연합, `docs/lore/factions.md` §1의 농업·목축·거친 모직물 생활, `docs/lore/world-bible.md`의 재때·의복·겨울 기후를 읽고 해진 저채도 양모 조끼·린넨 셔츠·작업 바지·낡은 신발을 기본 생활복 도형으로 그렸다.

노출된 따뜻한 얼굴·코·작은 동공·입과 짧은 머리, 자연스러운 성인 어깨·손·다리 비율을 사용했다. 일상복은 이끼빛 회색·회베이지·짙은 바지와 작은 황동빛 솔기를 쓴다. 고정된 무기·방패·도구·여행 가방·등불·갑옷·세력 문양은 없다. 실제 장비의 선택·소유·효과는 기존 게임 상태가 담당한다.

공격 원본은 준비·팔 올리기·뻗기·회복의 일반 어깨/손 동작이다. 일반 정착민의 인간 기본 주먹 공격과 실제 무기를 선택하는 경비 등에서 공통으로 쓸 수 있도록 특정 실물 무기를 그려 넣지 않았다. 통합 시 attack 조각을 선택적으로 사용할 수 있다.

외부 팩·기존 캐릭터 시트·생성 이미지를 입력·추출·크롭·트레이싱·재색칠하지 않았다. 자체 캔버스·관절 선·PNG/SVG 인코더 구조를 재사용했고 얼굴·몸·옷·방향·발·동작은 새 정수 좌표로 직접 작성했다.

## 프레임·시트·원본 픽셀 규격

| 항목 | 값 |
| --- | --- |
| 실제 현재 공용 char | `hero` — 이 패키지에서 수정하지 않음 |
| 신규 주민 char | `resident_worker` |
| 신규 sheets | `resident_worker`, `resident_worker_atk` |
| 보행 PNG | `ashveil-resident-walk.png`, 72 × 128 px |
| 보행 셀·이름 | 24 × 32 px, 방향별 `resident_worker_w_{방향}0`, `1`, `2` |
| idle | 방향별 `resident_worker_w_{방향}1` |
| 선택적 공격 PNG | `ashveil-resident-attack.png`, 128 × 160 px |
| 공격 셀·이름 | 32 × 40 px, 방향별 `resident_worker_a_{방향}0`, `1`, `2`, `3` |
| 방향 행 순서 | `down`, `left`, `right`, `up` |
| 보행 anchor | `[0.5, 31/32]` |
| 공격 anchor | `[0.5, 39/40]` |
| 공격 셀 안의 몸 오프셋 | `[4, 8]` |
| 표시 | `renderScale: 1`, `headOffset: 28` |

새 주민의 모든 보행 실루엣은 native y=3~30으로 높이 28px, 발 밑면은 y=31이다. 공격의 `39 − 8 = 31`로 지면이 같다. 기존 hero의 앵커·셀·배율과 같은 계약이며, 새 원본의 얼굴 높이에 맞춰 상태 표시 높이만 28로 명시했다. 원래 hero의 headOffset은 30이며 이를 변경하지 않았다.

`tools/art/resident-manifest.fragment.json`은 신규 resident_worker 시트/프레임/char만 있는 병합 조각이다. hero 키나 실제 Def·기존 세계 인스턴스를 수정하는 기능은 없다.

## 재현과 검토 파일

`tools/art/draw-resident.py`에 모든 픽셀 좌표·방향·포즈·21색 팔레트와 조사 스냅샷이 있다. Python 표준 라이브러리만 사용하며 이미지 입력·다운로드 없이 자신의 아트·팔레트·병합 조각·조사·출처 파일 9개만 생성한다.

```sh
python3 tools/art/draw-resident.py
python3 tools/art/draw-resident.py --check
```

첫 명령은 원본을 재생성하고 두 번째는 저장된 파일과 재생성 바이트가 같은지 확인하며 파일을 쓰지 않는다. MAIN을 읽거나 등록하는 설치 명령은 없다.

PNG와 같은 이름의 SVG는 동일한 정수 픽셀을 보존하는 편집 원본이다. `ashveil-resident-palette.json`은 21색 팔레트, `ashveil-resident-source.json`은 실제 공용 키/신규 키 구분·픽셀 규격·Def 연결 제안·해시를 기록한다.

`ashveil-resident-contact.png`는 640 × 1304 px 4배 검토 시트다. 위는 새 주민 보행 12개, 아래는 선택적 공격 16개이며 방향 행은 D/L/R/U다.

## 실제 확인과 검사

보행 PNG·공격 PNG·전체 검토 시트를 각각 `view_image`로 실제 열어 확인했다. 다음 저비용 아트 검사도 통과했다.

- `--check`의 9개 파일 결정적 바이트 재현.
- PNG 크기·RGBA 형식·알파 값 0/255 및 SVG 전 픽셀 일치.
- 28개 frame 경계·외곽 여백과 방향별 포즈 차이.
- prefix만 바꾸면 기존 hero와 같은 walk/idle/attack 목록 구조.
- 기존 hero 키가 병합 조각에 없고 신규 resident_worker 키만 포함됨.
- 실제 보행 12개 모두 28px 높이, 기존과 같은 지면·배율.
- 소스상 hero 공유 16개와 그 안의 Settler 주민 계열 14개 조사.

게임 등록·Def 연결·기존 NPC 저장 인스턴스 변경·게임 실행 검증은 아직 수행하지 않았다. MAIN/Def/Core/공용 시트/실제 매니페스트/git을 변경하지 않았으며 GPU·브라우저·프로젝트 검사·무거운 검사는 실행하지 않았다.

## SHA-256

제작 도구: `b44f78820fa79a9e0a405302ca37dc32722dbe404f7ae049d7c2cb61a4230bb6`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/ashveil-resident-walk.png` | 1385 | `7db1c3a1ed3e426554bac21a61b636a6f28ed5e437c035272ef15a997c4f3ab5` |
| `public/sprites/original/ashveil-resident-attack.png` | 1845 | `61e7a7daaab99c959fe52b74213442c1b12f3f619d91a3af49943c4bb03ebb03` |
| `public/sprites/original/ashveil-resident-walk.svg` | 123440 | `ed516eda7fb0e848ffe073a83a36b86e808934ea0f24c4fcf86c6b70f070f628` |
| `public/sprites/original/ashveil-resident-attack.svg` | 174029 | `9b2a33846489ce83c609456d11c2909cdbdb396597bc7851afd29aff68c319cf` |
| `public/sprites/original/ashveil-resident-contact.png` | 15610 | `b382d84e920386ace64ab6739439a0984bb3023b1c22609fe757a7beeda837ef` |
| `public/sprites/original/ashveil-resident-palette.json` | 381 | `f5f449d615c81b70c763af5c44d52ac7f5e564ccb23a7c1efdc4e1d784561724` |
| `tools/art/resident-manifest.fragment.json` | 4936 | `e75ab0bb3a31d15a2db91d65f280022a2ae77a821788b65c4a9596a7d1bce1c7` |
| `tools/art/resident-usage-survey.json` | 5657 | `811ec587d4ce39d1831fb06d12e4fcc372e48fbfe87c5d22bf75f9247d0f8954` |


## v0.288 실제 적용

Root가 contact를 직접 열고 원본9파일·도구/조각/출처를 그대로 복사했다. 통합은 raw char를 바꾸는 제안 대신 현재 Def의 characterAliases에서 저장된 hero를 주민/의원 전용 char로 한 단계 표시한다. 기존/newNPC의 실제 sprite선택/몸/장비는 그대로이며 플레이어·옛은퇴인의hero는 보존한다. 실제게임/저장/전체 검사는 별도로 남아 있다.
