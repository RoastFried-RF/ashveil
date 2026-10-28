# ASHVEIL 원본 주민 경비 외형 resident_guard — 준비 패키지

2026-10-21에 실제 정착지 경비 계열과 loadout·관련 생활 설정을 조사하고, 짧은 천 외투를 입은 살아 있는 성인 외형을 직접 그렸다. **아트와 신규 char 조각 준비 완료, 게임 미등록** 상태이며 이 패키지는 `/workspace/ashveil-guard-art`의 새 파일만 작성했다.

## 조사 대상과 작업본 구분

| 실제 Creature | 표시 이름 | 부모 |
| --- | --- | --- |
| `Creature.SettlementGuard` | 정착지 경비 | `Creature.Settler` |
| `Creature.SignalistGuard` | 신호회 파수꾼 | `Creature.SettlementGuard` |
| `Creature.LanternGuard` | 해안 등대 파수꾼 | `Creature.SettlementGuard` |
| `Creature.ZeroVaultWarden` | 제3 초소 금고 문지기 | `Creature.SettlementGuard` |

실제 Def는 `src/content/core/defs/society.json`, `field-devices.json`, `saltrim-coast.json`, `zero-vault.json`에서 읽었다. 네 경비 모두 현재 `char: hero` 선택을 상속한다. `SettlementGuard`는 `ai: guard`이고 창·방한 겉옷·신발·후드·식수·식량을 실제 loadout으로 지정한다.

**이번 조사에서 읽은 주민 외형 별칭은 게시된 Git main이 아닌 Root의 후속 288 작업본이다.** 이 작업본의 `src/content/core/patches/resident-appearance.json`은 Settler에 `characterAliases: {hero: resident_worker}`를 추가한다. 따라서 조사 당시 네 경비의 저장 외형 선택은 hero이며 표시 별칭은 resident_worker다. 같은 작업본의 의사 별칭은 resident_healer이며 경비에는 상속되지 않는다. 이 조사 기록은 main 또는 배포 사이트가 이미 해당 외형을 쓴다는 뜻이 아니다.

`tools/art/guard-usage-survey.json`에 실제 네 Def의 부모·소스·char·상속 loadout·현재 별칭, 원래 hero 렌더 계약, Root288 별칭 스냅샷과 문맥을 보존했다. 도구는 조사된 정적 스냅샷을 포함하므로 재생성 때 MAIN을 읽거나 변경하지 않는다.

## 실제 장비와 구분한 평상복 도형

정착지 경비의 실제 loadout은 `RebarSpear`, `PaddedJacket`, `LeatherCoat`, `Boots`, `Hood`, `Hardtack` 3개와 `WaterBottle` 2개다. 창·후드·방어구는 소유와 선택이 있는 실물이며, 이번 원본에 고정 무기·갑옷·방패·헬멧으로 그리지 않았다. 짧은 천 외투는 기본 생활복을 구분하는 도형이며 방어 수치·새 Item·직업·AI·장비 효과를 추가하지 않는다.

CANON의 잔존 경비대, `docs/lore/factions.md`의 촌락 자경·경비 순찰과 §5의 초소·방어·방수 외투, `zero-vault.json`의 음식·물·잠이 필요한 인간 문지기 설정을 읽었다. 이 패키지는 여러 세력에서 쓰는 공용 주민 경비 외형이므로 특정 세력 문양·계급장·명찰·현대 군복을 새로 만들지 않았다. 기록에 등장하는 특수 화기·철모·방탄판도 실제 아이템 선택과 분리했다.

공용 worker의 조끼와 healer의 앞치마에 비해 넓은 어깨, 짧고 갈라진 외투 단, 회녹색 천의 접힘·목깃·등 솔기·묶은 소매, 짧은 머리와 넓은 인간 턱으로 실루엣을 구분했다. 피부면·작은 동공·코·입·맨손을 남겨 살아 있는 성인으로 그렸다. 앞/뒤와 좌/우는 별도 좌표로 그렸고, 목깃·단·주름은 금속 방어판처럼 반사시키지 않았다.

12보행은 팔·다리가 함께 움직이며, 새 16공격은 준비·팔 올리기·뻗기·회복의 어깨/맨손 동작이다. 공격 애니메이션 자체에 특정 무기·방패·치료 효과를 박지 않았다. 실제 장비와 전투 결과는 기존 게임 상태가 담당한다.

외부 이미지·팩·기존 시트·생성 이미지를 입력·크롭·트레이싱·재색칠하지 않았다. 자체 resident/healer 도구의 캔버스·픽셀 선·PNG/SVG 인코더·평상 신발 관절 구조는 재사용했다. 경비의 얼굴·짧은 머리·넓은 외투·묶은 소매·목깃·방향·팔 경로는 새 정수 좌표로 직접 작성했다.

## 신규 프레임 계약

| 항목 | 값 |
| --- | --- |
| 신규 char | `resident_guard` |
| 신규 sheets | `resident_guard`, `resident_guard_atk` |
| 보행 PNG | `ashveil-guard-walk.png`, 72 × 128 px |
| 보행 셀 / 새 이름 | 24 × 32 px / `resident_guard_w_{방향}0`, `1`, `2` |
| idle | 각 방향 `resident_guard_w_{방향}1` |
| 공격 PNG | `ashveil-guard-attack.png`, 128 × 160 px |
| 공격 셀 / 새 이름 | 32 × 40 px / `resident_guard_a_{방향}0`, `1`, `2`, `3` |
| 방향 행 | `down`, `left`, `right`, `up` |
| 보행 anchor / 발 밑면 | `[0.5, 31/32]` / y=31 |
| 공격 anchor / 발 밑면 | `[0.5, 39/40]` / y=39 |
| 공격 안의 몸 오프셋 | `[4, 8]` — `39 − 8 = 31` |
| native 표시 배율 / headOffset | `renderScale: 1` / `headOffset: 28` |
| 실측 보행 높이 | 12개 모두 y=3~30의 28px |

이번 12보행·16공격은 모두 신규 경비 프레임이다. 조사 당시 hero의 방향·가운데 idle·공격 목록 형식과 지면 계약을 유지하며 기존 hero 키 자체를 바꾸지 않는다. 원래 hero의 headOffset30은 보존하고 신규 경비의 실측 머리 높이를 28로 명시했다.

`tools/art/guard-manifest.fragment.json`에는 새 두 sheet·28frame·char 하나만 있다. hero, worker, healer, 기존 공용 시트 키는 없다. 실제 Def나 실제 게임 매니페스트를 변경하는 설치 명령도 없다.

## 권장 통합 범위

Root288 작업본의 저장값 보존 방식을 따라 `Creature.SettlementGuard`에 **`characterAliases: {hero: resident_guard}`**를 추가하는 범위를 권장한다. 세 경비 자손은 이를 상속한다. `src/client/render/creature-sprite.ts`의 별칭은 저장된 sprite 문자열에 한 번만 적용하므로 중간 표시값 resident_worker가 아닌 저장 선택 hero를 키로 사용한다.

이는 경비 인스턴스의 저장된 `Creature.sprite`를 다시 쓰거나 주민·플레이어를 일괄 치환하는 제안이 아니다. 실제 적용 및 게임 검증은 통합 담당자가 진행하며 이 격리 패키지에서는 시행하지 않았다.

## 재현과 실제 검사

```sh
python3 tools/art/draw-guard.py
python3 tools/art/draw-guard.py --check
python3 tools/art/check-guard.py
```

제작 도구는 표준 라이브러리만 사용해 자신의 PNG 3개·SVG 2개·21색 팔레트·병합 조각·조사·출처의 총9파일을 결정적으로 생성한다. `--check`는 파일을 쓰지 않고 재생성 바이트를 비교한다. 별도 독립 검사 도구는 제작 도구를 import하지 않고 PNG 디코딩과 SVG 정수 rect 래스터화를 수행한다.

원본 보행 PNG·공격 PNG·640 × 1304 px 4배 contact를 모두 `view_image`로 직접 열었다. contact 위는 12보행, 아래는 16공격이며 D/L/R/U 방향을 비교한다. 외투의 짧은 단과 등 솔기, 넓은 어깨·묶은 소매, 사람 얼굴, 포즈별 팔/다리, 지면과 투명 여백을 확인했다.

실제 실행 결과:

- 9파일 결정적 바이트 재현 `PASS`.
- 원본 PNG 크기·RGBA·CRC·알파 0/255 및 SVG 모든 픽셀 일치 `PASS`.
- 28frame 경계·투명 여백과 방향별 포즈 차이 `PASS`.
- 보행12개 모두 성인28px, 지면·배율·공격 오프셋 `PASS`.
- prefix 변경 시 기존 hero의 walk/idle/attack 목록과 같은 계약 `PASS`.
- 새 guard 키만 포함, 실제 경비 계열4종과 Root288 별칭 스냅샷, 제작/출력 SHA 대조 `PASS`.

MAIN·Core·Def·실제 매니페스트·공용 시트·기존 문서·Git은 수정하지 않았다. 브라우저·GPU·프로젝트 검사·무거운 검사는 실행하지 않았으며 게임에 적용됐다고 표시하지 않는다.

## SHA-256

- `tools/art/draw-guard.py`: `8ebff150f5f3e812d35ef39f6ff649d2210a7c6ff174919cf335634294086947`
- `tools/art/check-guard.py`: `a019abbfec572532dde8f78caa89a604e808ae97d9f9a149ca30111b932d9c7f`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/ashveil-guard-walk.png` | 1469 | `f9b58cd1482a009b59ee268417aa161164a6ddd440bd2edcab5c7cea2cce63b3` |
| `public/sprites/original/ashveil-guard-attack.png` | 1914 | `935acdf9b07a40ffc6406614debf69aa1cbeb5ee9090913cc4e7a0dfe20abb2f` |
| `public/sprites/original/ashveil-guard-walk.svg` | 135592 | `71498e5c5ffa9d8bdf92c88c86b6fa23f148c60024e752ada36a8270aa0fa8e3` |
| `public/sprites/original/ashveil-guard-attack.svg` | 190640 | `3754b014a458ebb97dc61772b83ecb47997da1e6b48596d6e29ea092349a383c` |
| `public/sprites/original/ashveil-guard-contact.png` | 16112 | `3e63c149a24cd0520b575c68be1eb66da346a5dcc33653d1a182f72428ecf45e` |
| `public/sprites/original/ashveil-guard-palette.json` | 381 | `942b22f190a31a16cab468691b958d959860a89fc72c21258183ae0d6533e240` |
| `tools/art/guard-manifest.fragment.json` | 4839 | `38c1eea351a75963cd496f6920eb0c67fdc141acfac5f2003d8846f875c61525` |
| `tools/art/guard-usage-survey.json` | 9832 | `e2ca84a399e46982244a425eb35682725c7ea72edc8eb583ee1bf3ee3108c397` |
| `public/sprites/original/ashveil-guard-source.json` | 2863 | `21ae3bf3d3d05763c6d0c5afba73f62fe81bc29c56d53fd47131d6a902d788bb` |

## v0.288 적용

Root가 contact를 직접 열고 전용2시트/28프레임/char와 원본 산출물을 복사했다. 실제 연결은 SettlementGuard의 hero→resident_guard 표시 별칭이며 세 자손이 상속한다. 저장된 sprite/장비/몸은 바꾸지 않는다.9파일 재현은 아래통합과 별도로 확인했으며 실제게임/전체검증은 아직 남아 있다.
