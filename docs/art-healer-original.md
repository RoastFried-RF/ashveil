# ASHVEIL 원본 의원·간병인 외형 resident_healer — 준비 패키지

2026-10-21에 실제 의사 계열 Def·진료소 재고·간병 설정을 읽고, 낡은 생활복과 앞치마를 입은 살아 있는 성인 외형을 직접 그렸다. 현재 상태는 **아트와 신규 char 병합 조각 준비 완료, 게임 미등록**이다. 이 작업은 `/workspace/ashveil-healer-art` 안의 새 파일만 작성했다.

## 실제 의사 계열과 소유 물품

| 실제 Creature | 표시 이름 | 부모 | 조사 시 해석된 char |
| --- | --- | --- | --- |
| `Creature.SettlementDoctor` | 의사 | `Creature.Settler` | `hero` |
| `Creature.SignalistHealer` | 신호회 간병인 | `Creature.SettlementDoctor` | `hero` |
| `Creature.LanternHealer` | 형제단 간병인 | `Creature.SettlementDoctor` | `hero` |

`src/content/core/defs/clinic.json`의 실제 의사는 `Clinic.Hearth`, `Trait.Neat`, `skills.medicine: 50`을 쓴다. `field-devices.json`과 `saltrim-coast.json`의 두 간병인은 의사를 상속한다. 의사 본체가 `char`나 `loadout`을 직접 다시 지정하지 않아 조사 시 셋 모두 일반 Settler의 hero 외형과 생활 물품을 상속했다. `tools/art/healer-usage-survey.json`에 실제 Def와 상속 결과, 원래 hero의 렌더 계약을 스냅샷으로 보존했다.

상속 생활 물품은 `RagShirt`, `LeatherCoat`, `Boots`, `Hood`, `Hardtack` 3개와 `WaterBottle` 2개다. 실제 의원의 의료 가방·실·바늘·지혈대·부목·약초차·주정·약제 등은 `Clinic.Hearth`의 별도 실물 재고다. 이 원본은 약품, 의료 가방, 칼, 도구를 몸에 고정하지 않는다. 앞치마는 외형을 구분하는 소박한 생활복 도형이며 새 장비 Item이나 의료 효과를 추가하지 않는다.

CANON과 `docs/lore/factions.md`의 촌락 산파·약초할멈, 검역 초막 간병, 순례회 약초·간호 봉사 설정을 읽었다. 낡은 저채도 일상복·접어 올린 소매·거친 리넨 앞치마는 해당 생활 맥락에 맞춘 시각 해석이다. 새로운 직업·세력·의료 능력이나 정본에 없는 현대 병원 제복을 설정으로 만들지 않았다.

## 새로 그린 외형

묶은 짙은 머리와 작은 뒤통수 머리 매듭, 따뜻한 피부면·작은 동공·코·입이 남은 성인 얼굴, 낡은 청록 생활복, 회베이지 앞치마의 접힘·비대칭 기운 단, 걷어 올린 소매와 평범한 신발을 사용했다. 공용 `resident_worker`의 짧은 머리·작업 조끼와 구분되도록 얼굴·머리·상의·앞치마·소매·팔 경로를 새로운 정수 좌표로 작성했다. 의료 십자·간호 모자·가면·현대 가운·세력 문양·발광 효과는 없다.

방향별 정면/왼쪽/오른쪽/뒤를 별도 도형으로 그렸고, 12개 보행은 다리와 팔이 함께 변한다. 16개 공격은 준비·팔 올리기·뻗기·회복의 일반 어깨/손 동작이다. 실제 장비 선택과 소유는 기존 게임 상태가 담당하며 특정 무기나 치료 동작을 아트에 고정하지 않는다.

외부 이미지·팩·기존 시트·생성 이미지를 입력, 크롭, 트레이싱, 재색칠하지 않았다. 자체 resident 도구의 캔버스·픽셀 선·PNG/SVG 인코더·평범한 신발 관절 좌표를 재사용했으며, 간병인 얼굴·묶은 머리·앞치마·생활복·소매·새 팔 동작은 이 패키지에 직접 작성했다. 원본의 수정은 PNG 후처리가 아니라 좌표 소스에서 수행한다.

## 신규 렌더 조각

`resident_healer`는 외형용 새 char 이름이다. 기존의 healer 전용 프레임이 이미 있었다고 표시하지 않는다. 이 패키지는 **새 보행 12개와 새 공격 16개**를 제공하며, 조사 시 사용하던 hero의 방향별 이름 구조·idle 위치·지면 계약을 따른다.

| 항목 | 값 |
| --- | --- |
| 신규 char | `resident_healer` |
| 신규 sheets | `resident_healer`, `resident_healer_atk` |
| 보행 PNG | `ashveil-healer-walk.png`, 72 × 128 px |
| 보행 셀 / 키 | 24 × 32 px / `resident_healer_w_{방향}0`, `1`, `2` |
| idle | 각 방향 `resident_healer_w_{방향}1` |
| 공격 PNG | `ashveil-healer-attack.png`, 128 × 160 px |
| 공격 셀 / 키 | 32 × 40 px / `resident_healer_a_{방향}0`, `1`, `2`, `3` |
| 방향 행 순서 | `down`, `left`, `right`, `up` |
| 보행 anchor / 발 밑면 | `[0.5, 31/32]` / y=31 |
| 공격 anchor / 발 밑면 | `[0.5, 39/40]` / y=39 |
| 공격 셀 내부 몸 오프셋 | `[4, 8]` — `39 − 8 = 31` |
| native 배율 / headOffset | `renderScale: 1` / `headOffset: 28` |
| 실측 보행 몸 높이 | 12개 모두 y=3~30의 28px |

원래 hero의 headOffset은 30이며 이 패키지에서 변경하지 않는다. 새 얼굴/머리에 맞춰 신규 char의 표시 높이만 28로 정했다.

`tools/art/healer-manifest.fragment.json`에는 새 두 sheet, 새 28 frame, 새 char 하나만 있다. 기존 hero·resident_worker·공용 시트 키는 포함하지 않는다. 통합 권장 대상은 **`Creature.SettlementDoctor`의 char만 `resident_healer`로 지정하는 범위**이며, 해당 두 간병인 자손이 이를 상속한다. 일반 주민·플레이어·다른 직업을 바꾸는 제안은 아니다. Def PATCH는 이 아트 패키지에서 실행하지 않았다.

기존 저장 월드의 `Creature.sprite`는 생성 때 선택한 문자열이므로 Def만 연결하면 새 NPC부터 적용될 수 있다. 기존 NPC 표시 갱신이 필요하면 통합 담당자가 실제 Doctor 자손만 확인해 별도 처리한다.

## 도구·편집 원본·검토

Python 표준 라이브러리만 사용하는 `tools/art/draw-healer.py`가 자신의 PNG 3개, SVG 2개, 21색 팔레트, 병합 조각, 조사 스냅샷, 제작 출처의 9개 파일을 결정적으로 생성한다. MAIN을 읽거나 수정하는 설치 단계가 없다. 같은 이름 SVG는 PNG와 같은 정수 픽셀을 보존한 편집 원본이다.

```sh
python3 tools/art/draw-healer.py
python3 tools/art/draw-healer.py --check
python3 tools/art/check-healer.py
```

`--check`는 저장 파일과 재생성 바이트를 대조하고 파일을 쓰지 않는다. 별도 `check-healer.py`는 생성 도구를 import하지 않고 PNG를 직접 디코딩하고 SVG 정수 rect를 독립 래스터화해 비교한다. 외부 패키지·게임 실행·GPU가 필요 없다.

보행·공격 PNG와 640 × 1304 px 4배 검토 시트 `ashveil-healer-contact.png`를 모두 `view_image`로 직접 열었다. 검토 시트 위는 보행 12개, 아래는 공격 16개이며 방향 행은 D/L/R/U다. 묶은 머리, 앞쪽 앞치마와 뒤쪽 끈, 접힌 소매, 양 방향 얼굴, 지면과 프레임 경계를 확인했다.

실행 완료한 저비용 검사는 다음과 같다.

- 9개 생성 파일의 결정적 바이트 재현 `PASS`.
- PNG 크기·RGBA·CRC·알파 0/255와 SVG 모든 픽셀 일치 `PASS`.
- 신규 28개 frame의 경계·투명 여백·방향별 서로 다른 포즈 `PASS`.
- 보행 12개 실측 높이 28px·앵커·배율·공격 몸 오프셋 `PASS`.
- prefix를 바꾸면 원래 hero와 동일한 보행/idle/공격 목록 계약 `PASS`.
- 신규 healer 키만 포함, 실제 Doctor 계열 3종 조사, 제작 소스와 출력 SHA 대조 `PASS`.

실제 게임 등록·Def 변경·기존 저장 NPC 표시 변경·게임 실행 검증은 하지 않았다. MAIN/Core/Def/실제 매니페스트/공용 시트/기존 문서/git을 변경하지 않았고 GPU·브라우저·프로젝트 검사·무거운 검사는 실행하지 않았다.

## SHA-256

- `tools/art/draw-healer.py`: `d07d473412a5f3a2726e8383b3dfcfd875d4aa5af17c59a111e89ed3707ed86e`
- `tools/art/check-healer.py`: `fb0e31d3be27c12c8934701d074ca803730b2234ebc88044d411288ead2c01da`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/ashveil-healer-walk.png` | 1520 | `e501d421560b27051bc0b39d50ae93da548886afeff3143f390e752005557d57` |
| `public/sprites/original/ashveil-healer-attack.png` | 1946 | `1b8384d498ac8dd41102b5bdd7213d8bd285e0997ce1187b5698fdaa6e8a3142` |
| `public/sprites/original/ashveil-healer-walk.svg` | 131435 | `286631628f8193d367ee59c8948d7d01e035359ec3d6dce028bea9f41ff146b8` |
| `public/sprites/original/ashveil-healer-attack.svg` | 191391 | `10a52fda34f11670afe78d74c81060bab691da35e9669474a4d683c3a972e6db` |
| `public/sprites/original/ashveil-healer-contact.png` | 15876 | `7312de95891c10e96c0073c86bfd46188cbe099bda480a2211395e2cea3abe05` |
| `public/sprites/original/ashveil-healer-palette.json` | 381 | `7fc7f760624a253c769b833116266a84bcd28050cf90bd6fb8421d9be2cc204b` |
| `tools/art/healer-manifest.fragment.json` | 4932 | `9e5d9577b8111ffc4c04d29bcf29a2583e84135905adfd742a3826cd7f0a866c` |
| `tools/art/healer-usage-survey.json` | 6074 | `03ff93386e8b6d02065e9fbd9f933158dd37848cf726b692c0b55f1e6b876dfa` |
| `public/sprites/original/ashveil-healer-source.json` | 2737 | `497aaf62f2d075be987a8eac934e1871df732ca1afc13a73c69041bb79ffd2a9` |

## v0.288 실제 적용

Root가 contact를 직접 열고 원본9파일·도구/조각/출처를 그대로 복사했다. 통합은 raw char를 바꾸는 제안 대신 현재 Def의 characterAliases에서 저장된 hero를 주민/의원 전용 char로 한 단계 표시한다. 기존/newNPC의 실제 sprite선택/몸/장비는 그대로이며 플레이어·옛은퇴인의hero는 보존한다. 실제게임/저장/전체 검사는 별도로 남아 있다.
