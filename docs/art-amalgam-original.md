# ASHVEIL 융합체 원본 — 기존 6프레임 호환과 선택적 방향형

2026-10-21, 실제 `Creature.Amalgam`의 원본을 직접 그렸다. 산출물은 `/workspace/ashveil-amalgam-art`에만 있다. 게임 저장소·Core/Def·기존 문서·실제 manifest·Git·렌더러를 변경하지 않았다. 원본 팩에서 픽셀을 읽거나 추출·트레이싱·재색칠하지 않았다.

## 실제 설정과 디자인

기준은 `docs/CANON.md` §7.3·D26, `docs/lore/bestiary.md` §20, `docs/lore/world-bible.md` §1.4·§5.4·T11이다. 융합체는 회색열 치료를 시도하다 정체 환자 여러 명의 몸이 합쳐진 **살아 있는 육체**다. 약 400kg, 머리 셋과 팔 넷, 다리가 없는 기저 몸덩이를 가지며 바닥을 끌고 이동한다. 출혈하고 다치면 죽는다. 공포 장식보다 실패한 치료의 흔적과 사람의 형체를 표현했다.

실제 `creatures.json`은 `char: amalgam`, `scale:1`, `sizeClass:huge`, `Body.Amalgam`, 고정 HP 400이다. 자연 공격은 '촉수 후려치기', 타격 16·관통 10이고 휩쓸기·포자 분출·붙잡기 능력과 `noBack:true`를 갖는다. 실제 `Body.Amalgam`에도 몸덩이·머리 셋·팔 넷이 있다. 이 아트는 그 기본 상태를 그리며 공격 수치·사거리·신체 규칙을 변경하지 않는다.

피부와 눈꺼풀·코·입이 남은 성인 머리 셋을 서로 다른 높이와 방향에 놓았다. 작은 어두운 눈과 낮게 열린 입은 남은 사람의 형체를 보여 준다. 서로 이어진 피부, 회색열 재반점, 바랜 환자복 조각과 옷깃, 손목띠가 몸의 출처를 이어 준다. 머리 셋은 인물별로 성긴 머리·볼·목의 천을 달리 그렸다. 몸 아래는 발 대신 넓고 둔한 피부 기저가 지면을 받친다.

팔 넷은 피부로 덮인 긴 인간 유래 팔과 손바닥·짧은 손가락으로 그렸다. 아래 두 팔이 다리처럼 읽히지 않게 손목띠와 손가락을 구분했다. 새로운 공격 시트에서는 아래 두 팔이 준비·당기기·휩쓸기·거두기를 하고 위의 두 팔은 남아 있다. 몸통과 세 머리의 루트·지면은 그대로 유지된다.

드러난 장기·잘린 단면·뼈·피 분수·해골 눈구멍·발광 눈·초자연 오라는 그리지 않았다. 기괴함은 이어진 피부와 서로 다른 인간 얼굴·손·옷의 도트 형태로 표현했다. 포자 분출·출혈·피격 등 실제 상태 효과는 기존 게임 연출이 계속 담당한다. 장식의 환자 손목띠나 옷은 새 아이템·장비 수치를 추가하지 않는다.

모든 몸·머리·얼굴·팔·손가락·피부 기저·환자복·방향·포즈는 `tools/art/draw-amalgam.mjs`의 좌표·폴리곤·정수 타원·팔레트에서 작성했다. 이전 자체 제작 도구의 캔버스·PNG 인코더·SVG·검토 시트·검사 구조만 재사용했다. 외부 이미지나 기존 보스 PNG를 입력으로 읽지 않는다. 이미지 생성 도구 호출·생성 이미지 편집도 하지 않았다.

## 기존 계약은 방향 없는 6프레임 애니메이션

실제 `sprites.json`에는 `chars.amalgam`이 없다. 다음 여섯 프레임을 `anims.amalgam`으로 연결한다.

```text
amalgam0 .. amalgam5
['amalgam', 프레임번호×96, 0, 96, 64]
anims.amalgam = { frames: ['amalgam0', ... 'amalgam5'], fps: 6 }
```

`Creature.Amalgam`의 char 값은 그대로 생물의 sprite 키가 되므로 현재 `MapRenderer.makeView`는 `AnimatedSprite` 경로를 선택한다. `animationSpeed=.1`, 배율 0.75, 앵커 `[.5,.92]`, 그림자 반지름 `[18,4]`, 머리 상태 기준 44px, HP 막대 폭 24px이다. 원래 방향별 걷기·대기·공격 프레임은 없다.

따라서 두 적용 조각을 분리했다. **기존 6개 이름·사각형·fps6 메타데이터는 두 조각 모두 보존**하며 새 방향 프레임 28개를 기존부터 있었다고 표시하지 않는다.

## A. 기존 동작 호환 조각

`ashveil-amalgam-legacy-fragment.json`은 새 원본 6프레임 PNG를 기존 `amalgam` 시트 키에 연결하고, 기존 프레임과 `anims.amalgam`만 제공한다. **`chars` 항목이 없다.** 이것만 적용하면 기존 AnimatedSprite·큰 그림자·HP 막대 경로를 유지한다.

같은 직접 작성한 원본을 96×64 셀의 `(8,-4)`에 놓았다. 이때 피부 기저의 빈 지면 경계는 y=59다. 기존 앵커는 64×0.92=58.88이므로 가장 가까운 정수 경계와 0.12 native px, 배율 0.75에서 0.09 world px 차이가 있다. 이를 수치상 정확히 같은 값이라고 표시하지 않는다. 기존 앵커를 변경하는 코드는 포함하지 않았다.

이 조각은 6개의 서로 다른 끌림·호흡 포즈를 재생한다. 방향별 공격 이미지는 사용하지 않는다. **방향형 조각과 동시에 적용해 `chars.amalgam`을 추가하면 이 애니메이션 경로가 선택되지 않는다.**

## B. 선택적 방향형 조각

`ashveil-amalgam-frames.json`은 기존 6개 프레임·애니메이션을 이름으로 보존하면서 새 시트 두 개와 `chars.amalgam`을 추가한다. 새 이름은 다음과 같다.

| 동작 | 이름 | 셀·배치 |
| --- | --- | --- |
| 새 방향별 끌림·대기 | `amalgam_w_{down,left,right,up}{0..2}` | 80×64, 3열×4행 |
| 새 방향별 휩쓸기 | `amalgam_a_{down,left,right,up}{0..3}` | 96×80, 4열×4행 |
| 보존된 기존 루프 | `amalgam0`..`amalgam5` | 96×64, 6열×1행 |

새 대기는 각 방향 보행 1번을 공유한다. 현재 CharDef 렌더러는 `idle[dir][0]`만 표시하고 기존 배율 호흡을 적용한다. 따라서 이 조각을 선택하면 기존 6프레임 루프가 같은 생물에서 계속 재생되는 것은 아니다. 기존 이름은 호환을 위해 보존된다.

| 값 | 새 방향형 규격 | 이유 |
| --- | --- | --- |
| 보행 셀·시트 | 80×64 / 240×256 | 큰 원본 보스 밀도를 유지 |
| 공격 셀·시트 | 96×80 / 384×320 | 피부 팔이 뻗는 여백 확보 |
| 보행 앵커 | `[.5,63/64]` = `[.5,.984375]` | 중심 x=40, 지면 y=63 |
| 공격 앵커 | `[.5,79/80]` = `[.5,.9875]` | 중심 x=48, 지면 y=79 |
| 공격 몸 오프셋 | `[8,16]` | `48−8=40`, `79−16=63`으로 같은 몸·지면 |
| 배율 | `1` | 원본 도트 밀도 유지, 인간형 크기로 축소하지 않음 |
| `headOffset` | `52` | 실제 정면/등 머리 상단 y=11부터 지면 y=63까지 |

실제 PNG의 불투명 픽셀을 측정한 방향별 최대 외곽은 다음과 같다. 해당 수치는 셀 크기를 그대로 보스 키라고 부른 값이 아니다.

| 방향 | x 범위 | y 범위 | 최대 불투명 외곽 |
| --- | --- | --- | --- |
| down·up | 3..77 | 11..62 | 75×52 px |
| left·right | 3..77 | 12..62 | 75×51 px |

새 방향형은 배율 1에서 약 75×52 world px로, 약 28px 높이의 약탈자보다 확실히 큰 보스다. 기존 동작 호환 조각의 같은 원본은 배율 0.75에서 약 56.25×39 world px로 표시된다. 기존 타사 그림의 실제 불투명 외곽을 측정해 동일 크기라고 주장하는 것은 아니다. 이미지 외곽은 Core의 충돌/차지 칸·공격 사거리와 같지 않다.

## 방향형 통합 시 확인할 렌더 차이

현재 `MapRenderer.makeView`, `drawBar`, `headY`를 읽어 아래 분기를 확인했다. 게임 렌더러 수정은 이 팩에 포함하지 않았다.

| 항목 | 현재 AnimatedSprite 보스 | 현재 CharDef 경로에 새 방향형을 넣으면 |
| --- | --- | --- |
| 바닥 그림자 반지름 | 18×4 | 기본 6×2 |
| HP 막대 폭 | 24 | 기본 14 |
| 상단 상태 기준 | 44 | 조각의 `headOffset:52` |
| 기본 이미지 배율 | 0.75 | 조각의 `renderScale:1` |
| 대기 그림 | 6프레임 루프 | 방향별 첫 idle + 기존 호흡 |

Root가 방향형 조각을 선택할 때는 **큰 보스의 그림자와 체력 막대를 실제 화면에서 함께 검토**해야 한다. 원본을 인간형 크기로 줄여 위 차이를 숨기지 않았다. 호환 조각만 선택하면 현재 큰 보스 분기가 유지된다. 두 조각은 선택지가 명시된 적용 산출물이며 이 폴더에서 실제 적용하지 않았다.

세 머리·네 팔이 온전한 기본 몸만 제공한다. 실제 머리·팔 파괴에 맞춰 그림에서 부위를 제거하는 전환이나 추가 손상 시트는 구현하지 않았다. 기존 `noBack`·사망·몸 상태·피격 규칙, 카메라·빛·시야는 바꾸지 않는다.

## 파일과 재현

| 파일 | 용도 | 크기 |
| --- | --- | --- |
| `public/sprites/original/ashveil-amalgam-walk.png` | 투명 RGBA 방향별 끌림·대기 | 240×256 px |
| `public/sprites/original/ashveil-amalgam-attack.png` | 투명 RGBA 방향별 공격 | 384×320 px |
| `public/sprites/original/ashveil-amalgam-legacy.png` | 투명 RGBA 기존 6프레임 호환 | 576×64 px |
| 같은 이름의 `walk.svg`, `attack.svg`, `legacy.svg` | 각 PNG와 픽셀이 같은 편집 원본 | 같은 좌표 크기 |
| `public/sprites/original/ashveil-amalgam-contact.png` | 모든 방향·공격·기존 6개 이름 검토 | 864×1800 px, 정수 2배 |
| `public/sprites/original/ashveil-amalgam-palette.json` | 피부·환자복·재반점·연결 조직과 검토색 | 22색 |
| `public/sprites/original/ashveil-amalgam-frames.json` | 선택적 방향형 전체 조각과 실제 외곽·분기 차이 | 기존6 + 새28 = 총34개 이름 |
| `public/sprites/original/ashveil-amalgam-legacy-fragment.json` | 기존 AnimatedSprite 호환 조각 | 6개 이름 |
| `public/sprites/original/ashveil-amalgam-integrity.json` | 파일·도구·포즈 해시와 외곽·검사 결과 | JSON |
| `tools/art/draw-amalgam.mjs` | 직접 작성한 원본·재현·읽기 전용 검사 | Node.js 내장 모듈만 사용 |
| `docs/art-amalgam-original.md` | 출처·실제 계약·두 적용 방식·확인 범위 | 이 문서 |

총 13파일이다. SVG는 정수 색 경로·`crispEdges`를 사용한다. 좌표가 재현 기준이며 SVG만 바꾸면 재생성에서 덮어쓰므로 디자인 변경을 도구에도 반영한다.

```sh
node tools/art/draw-amalgam.mjs
node tools/art/draw-amalgam.mjs --check
```

첫 명령은 아트 11파일만 생성한다. `--check`는 메모리에서 예상 바이트를 만들어 비교하고 파일을 쓰지 않는다. 다른 인자·`--install`은 거부한다. 다른 이미지·외부 패키지·네트워크·브라우저·GPU가 필요 없다.

## 실제 확인 범위

- 원본 보행·공격·호환 PNG 전체와 접촉 시트를 `view_image`로 직접 열었다. 세 얼굴·네 팔·살로 덮인 몸·옷 조각·팔 끝의 손·지면을 확인하고 손가락/손목띠를 보완한 뒤 다시 열었다.
- `--check` 통과: 34개 사각형 경계, 서로 다른 방향 포즈 28개와 호환 포즈 6개, 방향별 머리3/팔4 제작 규격, 지면·몸 앵커, 팔레트·0/255 알파, PNG CRC·압축 데이터/스캔라인, 바이트 재현.
- 실제 manifest 읽기 전용 대조 통과: 기존 6개 이름·사각형·`anims.amalgam`의 fps6 일치, 새28개 이름 충돌 없음, 호환 조각에 `chars` 없음.
- 독립 PNG/SVG 대조 통과: SVG 색 경로를 RGBA로 재구성해 원본 PNG 3개와 모든 픽셀이 동일함을 확인.
- 문서의 11개 SHA-256과 실제 파일 일치 검사 통과.

게임 저장소·렌더러·Core·Def·Git·기존 문서는 변경하지 않았다. 게임 빌드·전체 회귀·전체 타입 검사·브라우저·GPU는 실행하지 않았다. 실제 보스 표시·그림자·HP 막대·대기·공격·사망·빛/시야 안 화면은 통합 담당자가 검증한다. 독립 아트 검토를 실제 게임 검증으로 표시하지 않는다.

## SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `ashveil-amalgam-walk.png` | `586660d98501d1849b7f4cad9f3484556fefb39ec152d4ed61dabd8f235ad3d2` |
| `ashveil-amalgam-attack.png` | `0ac2ab1536f935b5297eedd532d6d20ef46b9d9fb7db561bfe08c57a55e5bf74` |
| `ashveil-amalgam-legacy.png` | `e8edce31165fcc6eb53e595604d7aa49b338d2cb28d4203d0c1161e3e4a4d21f` |
| `ashveil-amalgam-walk.svg` | `e1da3e52098466a20f08a9ce1d85c26e28c89658536b01ce14890bba3d659859` |
| `ashveil-amalgam-attack.svg` | `c46fa03d93a2a8b97a236ed2346ea91b4c2f9a0b16019d1274e3ce2909306463` |
| `ashveil-amalgam-legacy.svg` | `2c43f45082680a71dcca926555c23967512f324e3d1daf2aedc012ce558bba1a` |
| `ashveil-amalgam-contact.png` | `6cf6e1fd217802b1fe4790a22a0c19655e73571b92c923ee704d0b2588d0fab1` |
| `ashveil-amalgam-palette.json` | `b59e32557e6d873bfb00de559246f58e87c44a00710f61fe9426a1e0b109a25b` |
| `ashveil-amalgam-frames.json` | `2740fe78e013337c61ca2eb26b272d40af35d85d91b7e30c6f56a138529c8833` |
| `ashveil-amalgam-legacy-fragment.json` | `dc68e6367bed8e59dbad36f534eaf2775a1e75193c3bdccec774f5ea90ff7191` |
| `draw-amalgam.mjs` | `80b11c548ee8743264a1a3f5c9d47e45cf6ded5eb857cb16a7b6a8c427ee05bd` |

## v0.287 실제 적용

Root가 전체 원본 접촉 시트를 직접 열고 제작 산출물을 그대로 복사했다. 실제 시트/프레임/char를 함께 병합하고 기존 다른char/anims를 보존했다. 융합체는 새 방향형을 선택하면서 기존6키/anims도 보존했고, manifest의 shadow18×4/healthBarWidth24와 renderer의 선택적 표시 크기를 연결해 원래 대형 표시를 유지한다. 피해 숫자도 실제 headOffset을 읽는다. 드론은 기존 두 정적 키를 alias로 유지하고 실제 활성/정지 char를 함께 반영했다. 실제 게임/복원/전체 검사는 아직 남아 있다. 위 준비 패키지 설명은 제작 당시 범위다.
