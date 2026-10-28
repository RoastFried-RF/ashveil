# ASHVEIL 원본 기본 전투 행동 아이콘 — 준비 패키지

2026-10-20에 넘어뜨리기와 무장해제 버튼용 새 픽셀 도형을 직접 그렸다. 상태는 **원본 준비 완료, 게임 미등록**이다. UI 적용은 통합 담당자가 진행한다. 모든 파일은 `/workspace/ashveil-maneuver-art` 안에만 작성했으며 MAIN 소스·기존 문서·아틀라스·Def·git은 변경하지 않았다.

## 디자인과 권장 매핑

두 아이콘은 32 × 32 px 투명 RGBA PNG이며 같은 이름의 SVG가 편집 가능한 정수 좌표 원본을 보존한다. 각 도형·실루엣·재질 클러스터는 새로 작성했다. 외부 이미지 입력·추출·크롭·재색칠·트레이싱 없이 자체 렌더 구조와 기존 낡은 청록·재색·황동의 19색 팔레트만 재사용했다.

| 행동 | 이미지 | frame / sheet | 도상 |
| --- | --- | --- | --- |
| 넘어뜨리기 | `public/sprites/original/items/ashveil-trip.png` | `trip` / `original_trip` | 회색 상대 정강이에 걸리는 청록 다리와 갈색 부츠, 지면 가까이 도는 짧은 황동빛 궤적 |
| 무장해제 | `public/sprites/original/items/ashveil-disarm.png` | `disarm` / `original_disarm` | 청록 소매에서 나온 펼쳐진 밝은 장갑, 손에서 분리되어 위로 벗어나는 작은 칼 |

모든 프레임 영역은 `[0, 0, 32, 32]`이다. 넘기는 부츠는 낮고 넓게, 손과 이탈하는 칼은 위쪽으로 세워 두 행동의 외곽선·방향·밝은 영역을 구분했다. 문자·브랜드·피해 수치·선택 상태는 그림에 포함하지 않았다. 16px 표시에는 선명한 픽셀 렌더링과 충분한 배경 대비를 권장한다.

## 재현 도구

`tools/art/draw-maneuvers.py`에 직접 작성한 도형·좌표·색과 PNG/SVG 인코더가 있다. Python 표준 라이브러리만 사용하며 자신의 원본 아트 파일 7개만 출력한다. 외부 이미지·라이브러리·다운로드와 게임 등록 기능은 없다.

```sh
python3 tools/art/draw-maneuvers.py
python3 tools/art/draw-maneuvers.py --check
```

첫 명령은 원본을 재생성하며 두 번째는 저장된 결과와 재생성 바이트를 비교하고 파일을 쓰지 않는다. 이번 격리 제작에서는 생성과 실제 이미지 검토만 진행했고 `--check`와 프로젝트 검사는 실행하지 않았다.

## 검토 시트와 직접 확인

`public/sprites/original/items/ashveil-maneuvers-contact.png`는 384 × 248 px다. 왼쪽은 넘어뜨리기, 오른쪽은 무장해제다.

- 맨 위 큰 도형: 2배(64px) 정수 렌더.
- 중간 두 도형: 어두운 배경/밝은 배경에서 실제 1배(32px).
- 아래 두 도형: 어두운 배경/밝은 배경에서 16px 표시를 확인하는 작은 미리보기.

검토 시트는 저장된 그림을 입력하거나 편집하지 않고 새 도형의 좌표 배열에서 직접 렌더했다. 16px 미리보기는 배열의 홀수 좌표를 최근접 표본으로 표시한다. 실제 PNG 두 개와 검토 시트를 각각 `view_image`로 열어 펼친 손·이탈한 칼과 정강이·걸린 부츠의 구별을 확인했다. PNG 헤더에서 두 아이콘의 32 × 32 크기와 검토 시트 크기를 읽었다.

팔레트는 `ashveil-maneuvers-palette.json`, 제작 방법·프레임/시트 제안·파일 해시는 `ashveil-maneuvers-source.json`에 있다. PNG는 불투명 픽셀과 완전 투명 배경으로 구성하며 블러·보간·반투명 테두리는 없다.

GPU·브라우저·프로젝트 테스트·타입 검사·git은 실행하지 않았다.

## SHA-256

제작 도구: `bf491ca5e2e61004d7118546bc9c387de22337a0726a3f74dabbe921390721a1`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `ashveil-trip.png` | 385 | `04c7ed429941bdf30f0826bfbedd82003ef6c7354ecf8ea7cd1ece922762a28e` |
| `ashveil-trip.svg` | 11243 | `dd4b0e3b20220f45c7cfbc595f1f34fbdc16a459002d275b8dc9439d227287e9` |
| `ashveil-disarm.png` | 385 | `19cf2c3340a80f9528c3486e7f4dface67788fa5783b30efc84729ca9f3d7c0f` |
| `ashveil-disarm.svg` | 12830 | `7e6325cedaf54768f0627f8355834c11e33c1dcdf388da8f0532d86fabfd171e` |
| `ashveil-maneuvers-contact.png` | 3954 | `6f137ff5563b2aabf65eb0a9d80a40ce2ee1714c841dfc4f8228735664fc8689` |
| `ashveil-maneuvers-palette.json` | 345 | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |


통합 담당자가 실제 검토 시트를 열고283 HUD의 두 행동 버튼에 trip/disarm 프레임을 연결했다. 게임 화면 검증은 별도 진행한다.

283의 실제 Native7장/전체191복원2/16단계/700TU와 공통8장/두 화면 크기 입력을 통과했다. 통합 담당자는 Native7장과 두 타이틀을, 독립 UI 검토자는15장 모두를 실제 열어 확인했다. 색/포즈의 원본 검토 시트와 실제 조명·시야의 게임 장면을 구분하며 조명/시야 규칙을 아트 검토를 위해 바꾸지 않았다.
