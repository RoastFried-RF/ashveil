# ASHVEIL 말라붙은 자 원본 — 살아 있는 환자, 적용 전 제작본

2026-10-20, 실제 `Creature.Withered`의 `char: withered`에 맞는 원본을 직접 그렸다. 산출물은 `/workspace/ashveil-withered-art` 안에만 있다. 게임 저장소·Core/Def·기존 문서·실제 manifest·공용 시트·Git을 변경하지 않았다.

## 정본과 시각 디자인

`docs/CANON.md` §7.3·D32, `docs/lore/bestiary.md` §19, `docs/lore/world-bible.md` §5.4의 말라붙은 자는 **아직 살아 있는 회색열 말기 환자**다. 피부가 뼈에 붙을 만큼 수척하고 통증을 느끼지 못하지만 숨을 쉬고 피가 흐른다. `docs/design/12-ui-ux.md` §10.2·10.3도 눈의 빛·녹색 기운 같은 언데드 연출을 금지한다.

이에 맞춰 **살이 남은 얼굴·코·입·볼·귀, 성긴 갈색 머리, 따뜻한 잿빛 회갈색 피부와 재반점, 좁고 굽은 몸, 해진 옅은 환자복, 가는 피부의 팔다리**를 새 좌표로 작성했다. 눈은 작은 어두운 동공과 눈꺼풀로 표현하고 눈 아래 피부를 남겼다. 마른 손발에도 살색 면을 유지했다. 얼굴이나 몸에 뼈를 노출하거나 큰 검은 눈구멍·이빨 격자를 그리지 않았다. 빛·오라·연기·되살아남도 넣지 않았다.

환자복은 때가 묻은 회베이지 셔츠와 짙은 바지, 길이가 다른 해진 소매와 단, 한쪽 발목의 헝겊이다. 갈비뼈 대신 천의 주름과 얼룩이 보인다. 손목의 작은 천은 환자였던 흔적을 표현하는 외형 요소다. 새 아이템·진료 상태·방어 수치·실제 장비를 추가하지 않는다. lore의 환자복 묘사를 그림으로 표현했으며 Core의 현재 장착 상태를 변경하지 않는다.

네 방향에서 같은 살색·재반점·불규칙 소매를 유지한다. 옆에서는 머리를 어깨보다 앞에 놓아 목과 등이 굽은 성인 자세로 그렸다. 두 손 공격은 맨손 타격·붙잡기에 어울리는 **손 모으기·굽히기·뻗기·거두기** 포즈다. 그림이 기존 `Ab.Grab`의 규칙이나 두 팔의 기능 판정을 바꾸지는 않는다. 실제 행동과 렌더러의 기존 공격 이벤트를 따르는 선택적 이미지다.

캔버스·PNG 인코더·SVG·검토 시트·무결성 검사의 구조는 앞서 직접 만든 원본 도구에서 재사용했다. 환자의 머리·피부·옷·손발·자세·걸음·두 팔 동작 geometry는 새로 작성했다. 이전 해골 팩이나 다른 인물 PNG의 픽셀을 입력으로 읽거나 추출·트레이싱·재색칠하지 않는다. 생성 도구는 좌표와 팔레트만으로 원본을 만들며 이미지 생성 도구 호출이나 생성 이미지 편집도 하지 않는다.

## 실제 기존 계약

실제 `sprites.json`의 `chars.withered`에는 **걷기 12개와 공유 대기만 있고 공격 프레임은 없다**. 기존 시트 키는 `mon1_withered`, 보행 셀은 x=72·96·120, y=128·160·192·224, 크기 24×32다. 대기는 각 방향 보행 1번이다.

`withered_priest`도 같은 공용 시트를 읽는 별도 캐릭터다. `withered_` 접두사만 검사하면 사제 프레임까지 포함되므로 실제 계약 대조는 `^withered_[wa]_(down|left|right|up)[0-9]+$`로 한정했다. 사제·공용 시트를 바꾸지 않았다.

제공 조각은 기존 `withered_w_{방향}{0..2}` 12개 이름과 walk/idle 배열을 보존한다. `withered_a_{방향}{0..3}` 16개 이름과 `CharDef.attack`은 **신규 선택 항목**이다. 현재 렌더러는 이 필드를 이미 지원한다. 기존부터 28프레임이었다고 표시하지 않는다.

## 파일

| 파일 | 용도 | 크기 |
| --- | --- | --- |
| `public/sprites/original/ashveil-withered-walk.png` | 투명 RGBA 보행·공유 대기 | 72×128 px |
| `public/sprites/original/ashveil-withered-attack.png` | 투명 RGBA 새 공격 | 128×160 px |
| `public/sprites/original/ashveil-withered-walk.svg` | 보행 PNG와 같은 픽셀 편집 원본 | 72×128 좌표 |
| `public/sprites/original/ashveil-withered-attack.svg` | 공격 PNG와 같은 픽셀 편집 원본 | 128×160 좌표 |
| `public/sprites/original/ashveil-withered-contact.png` | 전 방향·포즈 이름·어두운 두 배경·지면선 검토 | 768×1584 px, 정수 4배 |
| `public/sprites/original/ashveil-withered-frames.json` | withered 한 종류의 manifest 조각과 기존/신규 계약 | 총 28프레임 |
| `public/sprites/original/ashveil-withered-palette.json` | 피부·재반점·머리·환자복과 검토 배경색 | 24색 |
| `public/sprites/original/ashveil-withered-integrity.json` | 크기·해시·도구 해시·개별 포즈 해시·검사 결과 | JSON |
| `tools/art/draw-withered.mjs` | 제작 좌표·재현·읽기 전용 검사 도구 | Node.js 내장 모듈만 사용 |
| `docs/art-withered-original.md` | 설정·출처·규격·검사 범위 | 이 문서 |

대기는 기존처럼 보행 1번을 공유한다. SVG는 PNG와 같은 색의 정수 픽셀 경로와 `crispEdges`를 사용한다. 보간·반투명 테두리·흐림은 없다. 제작 도구의 좌표가 재현 기준이므로 SVG만 직접 바꾸면 재생성에서 덮어쓴다. 변경한 디자인은 도구에도 반영한다.

## 발 위치·체격과 통합 범위

| 동작 | 행 순서 | 셀·열 | 사각형 |
| --- | --- | --- | --- |
| 보행·대기 | down·left·right·up | 24×32, 3열 | `['withered', 열×24, 행×32, 24, 32]` |
| 선택적 새 공격 | down·left·right·up | 32×40, 4열 | `['withered_atk', 열×32, 행×40, 32, 40]` |

| 설정 | 값 | 근거 |
| --- | --- | --- |
| 보행 앵커 | `[0.5,31/32]` | 셀 중심 x=12, 지면 경계 y=31 |
| 공격 앵커 | `[0.5,39/40]` | 셀 중심 x=16, 지면 경계 y=39 |
| 공격 몸 오프셋 | `[4,8]` | `16−4=12`, `39−8=31`로 보행과 같은 발 위치 |
| `renderScale` | `1` | 떠돌이·약탈자 원본과 같은 네이티브 픽셀 밀도 |
| `headOffset` | `25` | 정면/등 머리 상단 y=6부터 지면 y=31까지 약 25px |

실제 Def는 `sizeClass: medium`, `hpMult: 0.8`이다. 체격/HP 계수를 키의 선형 배율로 해석하지 않고 수척하고 굽은 성인의 시각적 실루엣을 약 25px로 설계했다. 그늘 사람의 약 22px보다는 크고 건강한 약탈자의 약 28px보다는 낮다. 옆으로 굽힌 머리의 상단은 y=7이므로 방향에 따라 자세가 자연스럽게 낮아진다. 체격·HP·속도·통증·갈증·기온 규칙은 변경하지 않는다.

모든 보행 포즈는 y=30에 발이 닿고 y=31은 투명하다. 공격 몸을 8px 내리므로 발은 y=38, 비어 있는 지면 경계는 y=39다. 두 손 공격일 때 기존의 두 대기 팔을 모두 생략해 팔·손이 중복되지 않는다.

추후 통합 시 **새 시트 키 `withered`·`withered_atk`, 프레임 28개, `chars.withered`**를 함께 반영한다. 기존 `mon1_withered` URL이나 사제 프레임을 덮어쓰지 않는다. `withered_priest`, 다른 생물, Core Def, 카메라·빛·시야는 조각에 없다. 사제 제작 담당에게는 같은 지면/오프셋과 살색 팔레트를 공유했다.

## 재현·검사와 한계

격리 폴더에서 실행한다.

```sh
node tools/art/draw-withered.mjs
node tools/art/draw-withered.mjs --check
```

첫 명령은 이 폴더의 아트 파일 8개만 쓴다. `--check`는 예상 파일을 메모리에서 만들어 기존 바이트와 비교하며 쓰기를 하지 않는다. `--install` 등 다른 인자는 거부한다. 외부 패키지·네트워크·브라우저·GPU가 필요 없다.

실제로 확인한 내용:

- `--check` 통과: 서로 다른 28포즈, 경계·방향별 수·idle 연결, 모든 발 기준, 앵커 일치, 팔레트 색·0/255 알파, PNG CRC·압축 데이터/스캔라인, 바이트 재현.
- 실제 manifest 읽기 전용 대조 통과: withered 고유 걷기 12개와 idle 보존, 신규 공격 이름 16개 충돌 없음, 사제·공용 `mon1_withered`가 조각에 없음.
- 원본 전체 걷기 PNG·공격 PNG와 접촉 시트를 `view_image`로 직접 확인. 옆의 뒤쪽 팔을 피부 면으로 보완한 뒤 최종 PNG를 다시 열었다.
- 피부가 남은 눈꺼풀·볼·코·입과 옷으로 덮인 몸통, 맨손 두 개와 발 위치를 확인.
- 문서의 8개 SHA-256과 실제 파일 일치 검사 통과.

게임 빌드·전체 회귀·전체 타입 검사·브라우저·GPU는 실행하지 않았다. 실제 이동·공격·사망·조명·시야 안 화면은 통합 담당자의 검증 범위다. 독립 아트 검토를 실제 게임 검증으로 표시하지 않는다.

## SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `ashveil-withered-walk.png` | `c3e74657bd067f4e1383fbd50e5928469244c8a3a33afdce57dafad3b3c877b6` |
| `ashveil-withered-attack.png` | `5a37f565e3dd3a4d9ac6d965faf6cd6dd26896c061bddc3fd582c3cc355ba872` |
| `ashveil-withered-walk.svg` | `8da9e5d7fffc286e7ee9cb38026a1d62a00469c29b3a1b1a813bcc4735e29ae1` |
| `ashveil-withered-attack.svg` | `fa1fae9b162cf717d64a9dcbfa09590ccae4bc70732a3150e371f7982bdd3587` |
| `ashveil-withered-contact.png` | `d1d1695b5bc174e480071a43ee30c6f193e3ff1ce8bf95df193eccf929d36bea` |
| `ashveil-withered-palette.json` | `95847a0169dd24a73dcb77f6e5ce7a97468d5163e8a82450eff6d7f4db618035` |
| `ashveil-withered-frames.json` | `5ed7a3980e7c6294bc4106c12f0decd76c20b746e161e0097e35377644491f57` |
| `draw-withered.mjs` | `b1f0f7e88a2197acbc3643ef6313752c4e97a1a3e5947240c3be96f24baab194` |

## v0.287 적용

Root가 원본 접촉 시트를 직접 열어 검토한 뒤 전용 두 시트·기존12보행/idle·신규16공격·char의 실제 배율/앵커를 함께 적용했다. 공용 시트와 다른 char는 바이트 보존했다. 게임 Root에서8개 산출물 --check 재현도 통과했다. 실제 게임 화면 검증은 아직 남아 있다. 위 준비 패키지 기록은 제작 당시 범위다.
