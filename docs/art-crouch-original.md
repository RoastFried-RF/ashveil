# ASHVEIL 원본 웅크림 자세 아이콘 — 284용 준비 패키지

2026-10-20에 웅크림 자세 버튼을 위한 새 픽셀 도형을 직접 그렸다. 현재 상태는 **원본 준비 완료, 게임 미등록**이며 실제 UI와 자세 기능 연결은 통합 담당자가 진행한다.

모든 새 파일은 `/workspace/ashveil-crouch-art` 안에만 작성했다. MAIN 소스·Def·아틀라스·CREDITS·기존 문서·git은 변경하지 않았다.

## 디자인과 연결 제안

`public/sprites/original/items/ashveil-crouch.png`는 32 × 32 px 투명 RGBA PNG다. 같은 경로의 `ashveil-crouch.svg`는 동일한 픽셀을 편집 가능한 정수 사각형으로 보존한다.

한 인물의 낮은 옆모습을 중심으로 청록색 상체, 재색 바지의 접힌 무릎, 땅에 닿은 갈색 부츠를 구분했다. 몸과 머리를 낮추고 상체를 앞으로 기울였으며 앞다리 아래에 작은 투명 여백을 두어 무릎이 굽은 형태가 16px에서도 유지되도록 했다. 팔은 같은 몸의 앞무릎 가까이에 두었다. 다른 사람의 다리·발걸기 궤적·무기·문자·브랜드·선택 표시는 없다.

| 항목 | 권장 값 |
| --- | --- |
| frame | `crouch` |
| sheet | `original_crouch` |
| 이미지 | `public/sprites/original/items/ashveil-crouch.png` |
| 영역 | `[0, 0, 32, 32]` |

외부 팩이나 기존 그림을 입력·추출·크롭·재색칠·트레이싱하지 않았다. 기존 자체 Canvas/PNG/SVG 렌더 구조와 낡은 청록·재색·황동·목재 계열의 19색 팔레트만 재사용했고, 신체·포즈·얼굴·재질 픽셀은 새 좌표로 직접 작성했다.

## 재현과 파일

`tools/art/draw-crouch.py`가 모든 좌표·도형·재질 클러스터·팔레트의 제작 원본이다. Python 표준 라이브러리만 사용하며 자신의 새 아트 파일 5개만 생성한다. 이미지 파일 입력·외부 라이브러리·다운로드·게임 등록 기능은 없다.

```sh
python3 tools/art/draw-crouch.py
python3 tools/art/draw-crouch.py --check
```

첫 명령은 원본을 재생성한다. 두 번째는 저장된 파일과 재생성 바이트가 같은지 확인하고 파일을 쓰지 않는 선택 기능이며 이번 격리 제작 단계에서는 실행하지 않았다.

- `ashveil-crouch-contact.png`: 192 × 248 px 검토 시트. 위는 2배(64px), 중간은 어두운/밝은 배경에서 실제 1배(32px), 아래는 어두운/밝은 배경에서 16px 미리보기다.
- `ashveil-crouch-palette.json`: 기존 자체 19색 재질 팔레트.
- `ashveil-crouch-source.json`: 제작 방법·원본 도구 해시·연결 제안·각 파일의 해시.

검토 시트는 새 도형의 좌표 배열을 직접 렌더한다. 16px 미리보기는 홀수 좌표를 최근접 표본으로 표시하며 저장된 PNG를 편집하지 않는다. PNG는 불투명 픽셀과 완전 투명 배경으로 구성하고 보간·블러·반투명 테두리를 적용하지 않았다.

## 직접 확인

실제 32 × 32 PNG와 2배/1배/16px 검토 시트를 각각 `view_image`로 열어 한 인물의 낮은 몸·굽힌 무릎·바닥의 부츠를 확인했다. PNG 헤더에서 아이콘과 검토 시트 크기를 읽었다.

프로젝트 테스트·타입 검사·GPU·브라우저·무거운 검사·git은 실행하지 않았다.

## SHA-256

제작 도구: `2fb0b6c8e3de5897745bfa40ada32aebe6d7bad5745c0922ab0d02aa93e08c77`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `ashveil-crouch.png` | 388 | `d1ce16afe09ceddf517e129ee211632459dc06149e902e4dd25ce2c00706fd65` |
| `ashveil-crouch.svg` | 9858 | `d68dcd3ed10810419e1f6de9e398986b8729e1ae8a687af35012960662b82f5f` |
| `ashveil-crouch-contact.png` | 1902 | `73bd1f259e695e4a4df18fa335c1d58231c62e5ecf983adef88c9063eed2235e` |
| `ashveil-crouch-palette.json` | 345 | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |


통합 담당자가 검토 시트를 실제 열어 확인한 뒤284에서 crouch 프레임/시트와 HUD 자세 버튼에 연결했다. 실제 브라우저 검증은 별도다.
