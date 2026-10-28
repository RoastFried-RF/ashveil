# ASHVEIL 그늘 사람 shade2 원본 — 적용 전 제작본

2026-10-20, 일반 그늘 사람의 세 번째 외형 `shade2`를 직접 작성했다. 산출물은 `/workspace/ashveil-shade2-art` 안에만 있다. 게임 저장소·Core/Def·기존 문서·실제 manifest·공용 시트·Git을 변경하지 않았다.

## 대상과 새 디자인

실제 `Creature.Shade`의 외형 후보는 `shade0`·`shade1`·`shade2`·`shade3`이다. 기존 `shade2`는 `sprites.json`에서 공용 `mon1` 시트의 x=216·240·264, y=0·32·64·96인 24×32 걷기 셀 12개를 읽는다. idle은 각 방향 걷기 1번이며 공격 프레임은 없다. 별도 우두머리 `shade_chief`는 이 제작본의 대상이 아니다.

설정 근거는 `docs/CANON.md` §7.3·D26·D32, `docs/lore/bestiary.md` §17, `docs/lore/factions.md` §8.1, `docs/lore/world-bible.md` T10이다. 관로 정비공 가족의 후손인 작은 창백한 인간이며, 넓은 동공과 누더기 셔츠를 가진다. 같은 신체 규칙을 쓰는 사람이라는 점을 유지했다.

`shade0`와 구분되도록 **넓게 드러난 이마와 성긴 옆머리, 조금 긴 턱, 바랜 회청색 셔츠, 한쪽 어깨의 황토색 수선 천, 비대칭 바짓단과 손목 천**을 새 좌표로 그렸다. `shade1`의 머리띠·청록 수선도 쓰지 않았다. 왼쪽 어깨의 수선 천은 정면에서 화면 오른쪽, 뒤에서는 왼쪽에 보이며 반대 옆모습에는 솔기가 보인다. 작은 허리끈 매듭은 외형 요소이며 아이템을 추가하지 않는다. 고정 무기를 그리지 않아 실제 칼·맨손 등의 상태와 중복되지 않는다.

원본 제작 도구의 캔버스·PNG/SVG·무결성 검사 구조는 앞서 직접 작성한 도구에서 재사용했다. 머리·얼굴·몸통·수선 천·바짓단·손목 천·걸음·공격 팔의 픽셀 geometry는 새로 작성했다. 외부 팩 PNG 또는 이전 캐릭터 이미지의 추출·트레이싱·재색칠은 하지 않았다. 생성 도구는 다른 이미지 파일을 입력으로 읽지 않고 좌표와 팔레트에서 원본을 만든다. 이미지 생성 도구 호출이나 생성 이미지 편집도 하지 않았다.

제작 후 별도 읽기 전용 비교로, 자체 원본 `shade0`와 **28포즈 모두 알파 실루엣이 다름**을 확인했다. 포즈마다 투명/불투명 위치가 12~50픽셀 다르다. 색만 다른 복제본을 만들지 않았음을 확인하는 보조 검사이며, 생성 도구의 외부 이미지 의존성을 추가하지 않는다.

## 제공 파일

| 파일 | 용도 | 크기 |
| --- | --- | --- |
| `public/sprites/original/ashveil-shade2-walk.png` | 투명 RGBA 보행·공유 대기 | 72×128 px |
| `public/sprites/original/ashveil-shade2-attack.png` | 투명 RGBA 선택적 새 공격 | 128×160 px |
| `public/sprites/original/ashveil-shade2-walk.svg` | PNG와 같은 보행 픽셀 편집 원본 | 72×128 좌표 |
| `public/sprites/original/ashveil-shade2-attack.svg` | PNG와 같은 공격 픽셀 편집 원본 | 128×160 좌표 |
| `public/sprites/original/ashveil-shade2-contact.png` | 방향·포즈 이름, 두 어두운 배경, 지면선 검토 | 768×1584 px, 정수 4배 |
| `public/sprites/original/ashveil-shade2-frames.json` | 대상 한 종류의 sheets/frames/chars 조각과 기존·신규 계약 | 28프레임 |
| `public/sprites/original/ashveil-shade2-palette.json` | 피부·회청색 천·수선·끈과 검토 배경색 | 22색 |
| `public/sprites/original/ashveil-shade2-integrity.json` | 파일 크기·SHA-256, 도구 해시, 개별 포즈 해시·검사 결과 | JSON |
| `tools/art/draw-shade2.mjs` | 직접 작성한 geometry·재현·읽기 전용 검사 도구 | Node.js 내장 모듈만 사용 |
| `docs/art-shade2-original.md` | 출처·계약·확인 범위 | 이 문서 |

대기는 기존처럼 보행 1번을 공유한다. SVG는 PNG와 같은 색·정수 픽셀 경로와 `crispEdges`를 사용한다. 재현의 기준은 도구 좌표이므로 SVG만 직접 수정하면 재생성에서 덮어쓴다. 변경한 디자인을 도구에도 반영한다.

## 프레임·발 위치·적용 범위

기존 `shade2_w_{down,left,right,up}{0..2}` **12개 이름과 walk/idle 배열을 보존**한다. 현재 렌더러의 선택적 `CharDef.attack`에 연결할 `shade2_a_{down,left,right,up}{0..3}` **16개 이름은 신규**다. 기존부터 28개였던 것은 아니다. Core 행동·전투·애니메이션 시간은 변경하지 않는다.

| 동작 | 행 | 셀·열 | 사각형 |
| --- | --- | --- | --- |
| 걷기·대기 | down·left·right·up | 24×32, 3열 | `['shade2', 열×24, 행×32, 24, 32]` |
| 선택적 새 공격 | down·left·right·up | 32×40, 4열 | `['shade2_atk', 열×32, 행×40, 32, 40]` |

| 값 | 적용용 조각 | 근거 |
| --- | --- | --- |
| 보행 앵커 | `[0.5,31/32]` | 중심 x=12, 지면 경계 y=31 |
| 공격 앵커 | `[0.5,39/40]` | 중심 x=16, 지면 경계 y=39 |
| 공격 몸 오프셋 | `[4,8]` | `16−4=12`, `39−8=31`로 보행과 같은 발 위치 |
| 렌더 배율 | `1` | 그림 자체를 작은 성인 체격으로 설계 |
| `headOffset` | `22` | 머리 상단 y=9부터 지면 y=31까지 약 22px |

전체 보행 프레임은 y=30에 지면을 짚은 발 픽셀이 있고 y=31은 투명하다. 공격은 같은 몸을 8px 내리므로 발 픽셀은 y=38, 지면 경계는 y=39다. 팔을 새로 그릴 때 움직이는 팔의 대기 그림은 생략해 손이 중복되지 않는다. 머리·셔츠·발은 인물의 성인 체격을 유지한다. 체격 0.7을 키의 정확한 선형 배율로 해석하거나 Core 수치를 바꾼 것은 아니다.

기존 `shade2`의 앵커는 `[0.5,0.92]`, 기본 배율은 0.72다. 추후 적용할 때 새 시트 키 **`shade2`·`shade2_atk`**, 프레임 28개, `chars.shade2`를 함께 반영한다. **공용 `mon1`은 교체하지 않는다.** 다른 그늘 사람·우두머리·플레이어·약탈자·Core Def는 조각에 없다. 아직 게임에 연결하지 않은 제작본이다.

## 재현과 실제 검사

격리 폴더에서 실행한다.

```sh
node tools/art/draw-shade2.mjs
node tools/art/draw-shade2.mjs --check
```

첫 명령은 이 폴더의 아트 파일 8개만 쓴다. `--check`는 메모리에서 예상 바이트를 재생성해 비교하고 어떤 파일도 쓰지 않는다. `--install` 등 다른 인자는 거부한다. 외부 패키지·네트워크·브라우저·GPU는 필요 없다.

실제로 확인한 범위:

- `--check` 통과: 서로 다른 28포즈, 프레임 경계·방향별 수·idle 연결, 모든 포즈의 발 기준, 앵커 일치, 팔레트 색·0/255 알파, PNG CRC·압축 데이터·스캔라인, 바이트 재현.
- 실제 manifest와 읽기 전용 대조 통과: 기존 12개 이름·walk/idle 순서 보존, 신규 16개 이름 충돌 없음, 조각에 `shade2`·`shade2_atk`만 존재.
- 원본 전체 보행 PNG·공격 PNG와 접촉 시트를 `view_image`로 직접 열어 방향·얼굴·수선 천·팔·지면을 확인.
- 자체 제작 `shade0`와 전 포즈의 알파 실루엣 차이 확인.
- 문서의 8개 SHA-256과 실제 파일 일치 확인.

게임 빌드·전체 회귀·전체 타입 검사·브라우저·GPU는 실행하지 않았다. 실제 게임의 이동·공격·사망·빛·시야 안 화면은 통합 담당자의 검증 범위다. 독립 시트 확인을 실제 게임 검증으로 표시하지 않는다.

## SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `ashveil-shade2-walk.png` | `48ce4146784ea294b7c83bf880d3ae4acb65872afc7c66ac93e763fdcb387a3b` |
| `ashveil-shade2-attack.png` | `ce9aff74c1b5d370aa1b2b0dd5f32e079663ebbd8ce374f04a019076e3fb8764` |
| `ashveil-shade2-walk.svg` | `03a71259882e66845f270da14396994041df38fbc24d188c09838b2945797333` |
| `ashveil-shade2-attack.svg` | `859d4154ecfc35bb34c0f4ca02678264ea67f2b11a26e5a9fe54c8f5f60f8119` |
| `ashveil-shade2-contact.png` | `fbe9e3cc0b8f3f001aeeb70b9b698a43e70dd5a79cd2f0f63116cb676c0211a6` |
| `ashveil-shade2-palette.json` | `45b6f8babc86b53e24ebbe73226040b6147d6f060d0bfe611858221cbe4f0b4f` |
| `ashveil-shade2-frames.json` | `3e801fe50e07b45af367cb5cf31ee67d75940404f7b1baa50fa2569b2959d3c2` |
| `draw-shade2.mjs` | `fc2c61753b18cb859d2923f82a7159a38f776e4b25b546e402924f8af3d57bef` |

## v0.285–286 통합 작업

Root가 전체 검토 시트를 직접 열고 새 시트2개/기존12+새16프레임/chars.shade2을 실제 manifest에 연결했다. 공용mon1/정상 종·외형 선택 확률은 유지한다. 실제 게임 검증은 아직 진행 전이다.
