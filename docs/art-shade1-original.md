# ASHVEIL 원본 그늘 사람 두 번째 외형 shade1 — 준비 패키지

2026-10-20에 `shade1`의 보행·대기용 원본과 새로운 공격 포즈를 직접 그렸다. 현재 상태는 **아트와 매니페스트 병합 조각 준비 완료, 게임 미등록**이다. 모든 파일은 `/workspace/ashveil-shade1-art` 안에만 작성했다. MAIN 게임 저장소·Core·Def·공용 `mon1.png`·기존 문서·git은 변경하지 않았다.

## 설정과 시각 디자인

정전의 CANON §7.4 D32, `docs/lore/world-bible.md` T10, `docs/lore/factions.md` §8.1, `docs/lore/bestiary.md` §17을 읽고 지하 관로 정비공 가족 후손인 성인 인간형으로 제작했다. 작고 창백하며 동공이 넓다는 기존 설정만 반영한다. 고블린·언데드·해골·새 종족·새 직업이나 이야기를 추가하지 않았다.

얼굴을 드러낸 짧은 회갈색 머리와 바랜 천 머리띠, 창백하지만 살색 면이 남은 얼굴, 한 픽셀 검은 동공, 회갈색 누더기 셔츠와 비대칭 청록 수선을 새 좌표로 그렸다. 눈은 빛나지 않으며 눈 아래·코·턱의 피부 면을 남겨 해골 구멍처럼 보이지 않게 했다. 뾰족한 귀·송곳니·노출된 뼈는 없다. 상대 방향에서는 같은 수선과 허리 천의 다른 면이 보이도록 좌우 옆모습을 각각 그렸다.

병렬 제작한 shade0의 회색·올리브 누더기/가슴 갈색 패치와 구분하도록 천 머리띠, 청록 어깨·허리 수선, 작은 비대칭 허리 천을 사용했다. 보행 셀의 머리 시작은 약 y=9, 신발 밑면은 y=31로 작은 성인 인간 체격을 유지한다. 캐릭터 아트 담당자와 지면·셀·원본 배율·머리 상태 표시 높이를 맞췄다.

외부 자산·이미지 생성 결과·기존 시트의 픽셀을 입력·추출·트레이싱·재색칠하지 않았다. 기존 자체 도구의 Canvas/PNG/SVG 인코더 구조와 재질 팔레트에 피부 명암 두 색을 더했으며, 신체·포즈·방향·수선·동작의 모든 픽셀은 새 좌표로 작성했다.

## 실제 기존 계약과 새 공격의 구분

작업 시작 시 실제 `src/client/sprites.json`의 `chars.shade1`에는 방향별 보행 3개·가운데 대기 1개만 있었고 **attack 항목은 없었다**. 기존 보행은 `mon1`의 x=144/168/192, 방향 행 y=0/32/64/96에 있는 24 × 32 셀을 사용했다.

본 패키지는 기존 12개 `shade1_w_*` 이름과 네 방향 idle 목록을 그대로 보존한다. **새 `shade1_a_*` 16개는 이번에 처음 작성한 공격 포즈**다. 기존 공격을 교체했다거나 원래 28개 동작이 있었다고 해석하지 않는다.

| 항목 | 크기·순서·이름 |
| --- | --- |
| 보행 시트 | `ashveil-shade1-walk.png`, 72 × 128 px, 셀 24 × 32, 3열 × 4행 |
| 보행 행 | `down`, `left`, `right`, `up` |
| 보행 프레임 | 방향마다 `shade1_w_{방향}0`, `1`, `2` |
| 대기 | 방향마다 `shade1_w_{방향}1` |
| 신규 공격 시트 | `ashveil-shade1-attack.png`, 128 × 160 px, 셀 32 × 40, 4열 × 4행 |
| 신규 공격 행 | 보행과 같은 `down`, `left`, `right`, `up` |
| 신규 공격 프레임 | 방향마다 `shade1_a_{방향}0`, `1`, `2`, `3` |
| 공격 포즈 | 준비·올리기·뻗기·회복. 고정 무기를 그려 넣지 않은 어깨·팔·손 동작 |

## 제공 병합 조각과 지면

`tools/art/shade1-manifest.fragment.json`은 `sheets`, `frames`, `chars` 조각이다. 게임 매니페스트를 직접 읽거나 수정하는 설치 기능은 없다. 통합 시 각 최상위 객체의 항목을 병합하고, 실제 게임 표시 검증은 별도 진행한다.

- 독립 시트 키는 `shade1`, `shade1_atk` 두 개뿐이다.
- 캐릭터 키는 `shade1` 하나뿐이며 프레임도 `shade1_` 접두사만 사용한다.
- `shade0`·다른 그늘 외형·`mon1`·공용 몬스터 항목을 포함하거나 덮어쓰지 않는다.
- 보행 `anchor: [0.5, 31/32]`, 신규 공격 `attackAnchor: [0.5, 39/40]`를 명시했다.
- 공격 셀 안의 같은 몸은 `[4, 8]`에 놓는다. `39 − 8 = 31`이므로 보행과 공격의 신발 밑면이 같은 지면에 맞는다.
- `renderScale: 1`, `headOffset: 22`는 새 원본의 작은 성인 체격 및 병렬 shade0와 맞춘 값이다. 기존 암묵 배율 0.72와 anchor y=0.92를 그대로 사용했다고 주장하지 않는다.

## 제작 원본과 재현

`tools/art/draw-shade1.py`가 모든 좌표·신체·옷·수선·방향·걷기·공격 포즈를 정의하는 원본이다. Python 표준 라이브러리만 사용하며 이미지 파일을 입력하지 않는다.

```sh
python3 tools/art/draw-shade1.py
python3 tools/art/draw-shade1.py --check
```

첫 명령은 자신이 소유하는 아트·팔레트·병합 조각·출처 파일 8개만 생성한다. 두 번째는 같은 결과를 메모리에서 다시 만들고 저장된 바이트와 비교하며 파일을 쓰지 않는다. 원본 도구 SHA-256도 출처 JSON에 기록한다.

- PNG와 같은 이름의 SVG는 동일한 픽셀을 정수 사각형으로 보존한 편집 원본이다.
- `ashveil-shade1-palette.json`은 21색 재질·피부 팔레트다.
- `ashveil-shade1-contact.png`는 640 × 1304 px 4배 정수 검토 시트다. 위는 12개 보행, 아래는 새 16개 공격이며 방향 행은 D/L/R/U다.
- `ashveil-shade1-source.json`은 기존 계약·새 동작 수·제작 방법·도구와 제공 파일 해시를 보존한다.

## 직접 확인과 검증

보행 PNG·공격 PNG·4배 검토 시트를 각각 `view_image`로 실제 열어 확인했다. 재현 명령 `--check`를 실행해 **8개 파일의 결정적 바이트 재현**을 확인했다.

별도의 가벼운 아트 검사로 PNG 헤더의 크기·RGBA 형식·알파 값 0/255, SVG의 모든 사각형과 PNG 픽셀의 일치, 28개 프레임 경계, 방향별 포즈 차이와 외곽 여백, 기존 매니페스트와 보행 이름·대기 목록의 정확한 일치를 확인했다. 신규 공격이 기존 계약에 없었다는 점과 병합 조각이 shade1 키만 포함하는 점도 확인했다.

실제 게임 저장소 등록·게임 실행 검증은 아직 수행하지 않았다. 프로젝트 테스트·타입 검사·브라우저·GPU·무거운 검사·git은 실행하지 않았다.

## SHA-256

제작 도구: `6c5cd27e227afeabe601e9bd601a90ac4dad179096bc878976a944f687e1d57c`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/ashveil-shade1-walk.png` | 1265 | `5707ab701f799bab7b0c24a937a7c53995d977ec9932373b5e334eca7946e728` |
| `public/sprites/original/ashveil-shade1-attack.png` | 1624 | `22f374042f268ac56c894648aeeee9fa79c1af73c9fc889a50dc522c87fe1343` |
| `public/sprites/original/ashveil-shade1-walk.svg` | 95296 | `038c3280e9dae62bc3a718f72ca0ef1684c5c86fe64c2caa08d450ad9cc6dd74` |
| `public/sprites/original/ashveil-shade1-attack.svg` | 135264 | `dcd7de79c84024ce28ef4ce7deca84ca96551478372c9fe3658172a22e2c376d` |
| `public/sprites/original/ashveil-shade1-contact.png` | 13835 | `105af1b4a9babee96d07d8546d0bb29d0f3183a081a8b6658c2edfc3d15ca76d` |
| `public/sprites/original/ashveil-shade1-palette.json` | 381 | `a9326554f9d37fdc4ca0db6c1e4ffd8cb797cebe769eb057ac03daed04491e50` |
| `tools/art/shade1-manifest.fragment.json` | 4113 | `24e1b94ac5c1b47a3e3aef032623081d781ffdcc8b37bec8fc30e8bc96751ff1` |


## v0.285 통합 작업

Root가 전체 검토 시트를 직접 확인한 뒤 새 시트2개/기존12+새16프레임/chars.shade1을 실제 manifest에 연결했다. 실제 게임 검증은 아직 진행 전이다.
