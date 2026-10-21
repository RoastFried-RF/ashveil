# 사냥 활·여분 활시위 원본

2026-10-21 제작. 실제 기본 물품 두 종류에만 제안하는 격리 원본 아트다. 게임/모드에 등록하지 않았으며 Root의 src·mods·public·Core·Def·공용 manifest·Git은 변경하지 않았다. 프로젝트 검사·Type·Full·GPU·브라우저는 실행하지 않았다.

## 실제 품목 선정

| 대상 | 실제 Def | 기존 최종 sprite | 인벤토리 크기 | 새 sheet / frame |
| --- | --- | --- | --- | --- |
| 사냥 활 | `Item.Bow` (`items-weapons.json`) | `bow` | 2×3 | `original_hunting_bow` |
| 여분 활시위 | `Item.BowString` (`gear-care.json`) | `bones` | 1×1 | `original_bow_string` |

현재 Core에는 `Item.Shortbow`, `Item.ShortBow`, `Item.Longbow`, `Item.LongBow`가 없다. 사냥 활은 `Item.Weapon`을 상속하는 양손 원거리 무기이며 `Item.Arrow`를 탄약으로 사용한다. 목재 3/실 3의 실제 `Recipe.Bow`, 목재 수리/분해 근거를 따라 단순한 휜 나무 몸체·작은 감은 손잡이·밝은 시위만 그렸다. 현대식 조준기·풀리·복합재·새 재질·장전된 화살은 추가하지 않았다. 기본 Def에 별도 `Material.Wood` 필드를 새로 넣는 제안이 아니다.

여분 활시위는 `Recipe.BowString`에서 실 2로 만드는 실제 정비 재료다. `src/core/gear-care.ts`는 끊어진 시위를 다시 걸 때 `Item.BowString` 하나를 실제 소모한다. 새 원본은 밝고 낡은 섬유 줄을 접어 감은 고리와 작은 자유 끝으로 표현했다. 섬유 질감은 실제 재질 Def 변경이나 특정 동물의 힘줄이라는 설정을 뜻하지 않는다. 코일의 감김 횟수는 stack 수량이 아니다.

그림의 시위 선은 정적인 물품 종류를 식별하는 표현이다. 실제 `bowUnstrung`/`bowBroken`·습기·탄성·내구도·품질·사거리·숫자·효능을 그림으로 확정하지 않았다. 실제 수치·제조법·사거리·탄약·정비 규칙은 변경하지 않았다.

## 공유·상속 보존

조사는 현재 Root 작업본의 Core JSON을 읽기만 하여 수행했다. 원문 상속에서 부모 `id`/`abstract` 제외 및 모든 최상위 `/sprite` 패치를 반영한 sprite 필드 조사다. 실제 Def DB/월드/활성 모드를 실행하지 않았으며 전체 패치 엔진을 재현한 것으로 주장하지 않는다. 원문·정적 문맥·패치·출처 파일 SHA는 `tools/art/bow-usage-survey.json`에 기록했다.

현재 두 신규 대상에는 직접 자손이나 추가 후손이 없다. `bow` 공유자는 `Item.Bow`, `Item.LightCrossbow` 두 종류다. `bones` 공유자는 `Item.BoneCharm`, `Item.Bones`, `Item.BowString`, `Item.Charcoal`, `Item.GardenerLimb`, `Item.Lute` 여섯 종류다. 따라서 기존 `bow`/`bones` 키나 이미지 바이트를 바꾸지 않고 해당 두 Item의 sprite만 새 키로 연결한다.

기존 원본 화살과 화살통을 보존하기 위해 세 번째 품목을 억지로 추가하지 않았다.

| 보존 품목 | 실제 기존 상태 | 이번 제안 |
| --- | --- | --- |
| `Item.Arrow` | 원문 `arrow`, 기존 원본 패치 후 `ashveil_arrow_bundle` | 원본·바인딩 유지 |
| `Item.Bolt` | `Item.Arrow` 자손, 자체 raw sprite 없음; 최종 `ashveil_arrow_bundle` | 기존 표시 유지 |
| `Item.Quiver` | 최종 `ashveil_quiver` 전용 원본 | 기존 표시 유지 |
| `Item.LightCrossbow` | 자체 raw sprite `bow`; 사냥 활의 자손 아님 | 기존 표시 유지 |

Core 조사 범위에서 별도 장궁/고급 활 Def는 발견하지 않았다. 경석궁·볼트 및 향후 모드의 전용 고급 물품까지 새 그림으로 치환하는 제안은 아니다. 과거 raw `arrow`의 공유 소비자가 있어도 전역 타일을 교체하지 않는다. 현재 패치 후 `arrow` 소비자는 바늘 한 종류, `ashveil_arrow_bundle`은 화살/볼트 두 종류, `ashveil_quiver`는 화살통 한 종류다. Root는 통합 후 실제 DB에서 두 대상만 바뀌는지 별도로 확인해야 한다.

## 제작 계약과 권리

외부 이미지 입력·추출·크롭·추적·재색칠 없이 새로운 정수 좌표 다각형/선으로 직접 그렸다. 기존 자체 원본 도구에서 일반 Canvas·PNG/SVG 출력 도우미와 청록·낡은 목재·상아색 섬유 계열 19색 팔레트만 재사용했다. 기존 화살이나 타사 활의 픽셀 도형을 입력하지 않았다. 이 폴더의 원본·도구·문서는 **CC0-1.0**이며 상업 이용·수정·재배포·2차 에셋 패키지 제작을 허용한다. 출처 표기는 필수가 아니다. 선언은 루트 `LICENSE.txt`에 있다.

- `public/sprites/original/items/ashveil-hunting-bow.png`, `ashveil-bow-string.png`: 각각 32×32 RGBA8 투명 PNG, 알파 0/255.
- 같은 이름의 `.svg`: 정수 좌표 rect로 편집 가능하며 PNG 전 픽셀과 동일하다.
- 같은 이름의 `-16.png`: `(2x+1,2y+1)` 중심 최근접 16×16 축소 검토본.
- `ashveil-bow-contact.png`: 384×376, 4배 확대·실제 1배·16px·밝고 어두운 배경 검토.
- `ashveil-bow-palette.json`, `ashveil-bow-source.json`: 팔레트 및 생성기/산출물 SHA·크기·경계·권리 기록.
- `tools/art/bow-manifest.fragment.json`: 새 sheet/frame 두 개만 포함. 각 frame은 `[새 sheet,0,0,32,32]`. Def 패치 없음.
- `tools/art/bow-usage-survey.json`: 조사 기록. 생성기는 정적 스냅샷을 내장하여 재현 시 MAIN을 읽지 않는다.
- `tools/art/draw-bow-items.py`: 외부 의존성 없는 결정적 새 좌표 소스.
- `tools/art/check-bow-items.py`: 생성기를 import하지 않는 독립 픽셀 검사.

불투명 경계는 양끝 포함 0 기반으로 활 `[7,2,24,29]`, 활시위 `[3,3,25,29]`다. 접촉 시트와 32px/16px 네 장을 실제로 열어 활의 넓은 빈 공간·휜 나무·직선 시위, 여분 줄의 빈 고리·감은 섬유·끝 고리를 확인했다.

## 재현·검증

격리 폴더 루트에서 실행한다.

```sh
python3 tools/art/draw-bow-items.py --check
python3 tools/art/check-bow-items.py
```

`--check` 11개 결정적 파일 비교 PASS. `docs/art-bow-verification.json`의 독립 검증 PASS는 PNG CRC/단일 종료 IEND·PNG/SVG 전 픽셀 두 쌍·투명 알파/19색·경계/여백·16px 축소·두 고유 실루엣·대상 자손0·공유 소비자 수·원본 화살/석궁 보존 제안·10파일 SHA와 생성기 SHA를 확인했다. 게임 내 표시나 실제 규칙 실행의 검증 결과는 아니다.

| 파일 | SHA-256 |
| --- | --- |
| 사냥 활 PNG | `defddeb7c4d264ae0cd78fcfeda1ff0dd1de86e75bf3ac0747056ba8db86ed33` |
| 여분 활시위 PNG | `a916102460cbb65a05b85ae650bf58f558ca11217fdc5d136b2b6deee3eb2645` |
| 접촉 시트 | `cd787c26f17e0af0b5bc200b44e131adecb34102213230fb040ccb1b6cc307fb` |



Root294통합: 기존32프레임/이미지/공유소비자는보존하고 두새시트·프레임과 실제두Item의 own sprite replace만추가했다. LightCrossbow/Arrow/Bolt/Quiver와bones의다른소비자는그대로다. 계절식량생산은별도기능이며그림변경으로활/시위/탄약규칙을바꾸지않았다. 화면검증은별도로기록한다.
