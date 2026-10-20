# ASHVEIL 원본 투창 아이콘 — 격리 제작 패키지

2026-10-20에 한손 투척창을 나타내는 새 픽셀 원본을 직접 그렸다. 모든 파일은 `/workspace/ashveil-javelin-art` 안에만 작성했으며 MAIN 소스·Def·아틀라스·기존 문서·git은 변경하지 않았다.

## 제공 파일과 디자인

`public/sprites/original/items/ashveil-javelin.png`는 32 × 32 px 투명 RGBA PNG다. 같은 경로의 `ashveil-javelin.svg`는 동일한 픽셀을 정수 사각형으로 보존한 편집 원본이다.

깃 없는 긴 목재 자루와 짧고 좁은 낡은 금속 창끝을 대각선으로 배치했다. 목재의 밝은 마모와 어두운 결, 창끝의 차가운 금속 면, 소켓 아래의 불규칙한 섬유 묶음이 실제 1배에서도 구분되도록 명도를 나눴다. 외부 팩의 이미지 입력·추출·트레이싱·색 변경은 없다. 자체 산업 아이콘의 렌더 구조와 19색 팔레트만 재사용하고 새 실루엣·도형·픽셀을 좌표로 작성했다.

권장 아틀라스 연결:

| 항목 | 값 |
| --- | --- |
| frame | `javelin` |
| sheet | `original_javelin` |
| 이미지 | `public/sprites/original/items/ashveil-javelin.png` |
| 영역 | `[0, 0, 32, 32]` |

실제 Def의 1 × 4 소지품 크기·최대 수량 1·주무기/보조 한손 장착은 통합 담당자가 선등록한 설계와 함께 연결한다. 이 패키지는 게임 로직이나 등록 파일을 작성하지 않는다. 그림에는 수량·품질·투척 중 상태를 넣지 않았다.

## 재생성과 기록

`tools/art/draw-javelin.py`가 모든 픽셀 좌표·재질 클러스터·팔레트의 제작 원본이다. Python 표준 라이브러리만 사용하며 자신의 새 아트 파일 5개를 생성한다. 저장된 그림을 입력받거나 편집하지 않는다.

```sh
python3 tools/art/draw-javelin.py
```

도구와 제공 파일을 같은 상대 경로로 MAIN에 옮긴 뒤에도 재생성할 수 있다. `--check`는 저장된 결과와 재생성 바이트를 비교하는 선택 기능이며 이번 격리 제작에서는 실행하지 않았다.

- `ashveil-javelin-contact.png`: 192 × 248 px. 큰 그림은 4배 정수 렌더, 아래 둘은 어두운 배경/밝은 배경에서 실제 1배 표시.
- `ashveil-javelin-palette.json`: 기존 원본 산업 아이콘과 동일한 19색 계열.
- `ashveil-javelin-source.json`: 제작 방법·도구 해시·프레임/시트 제안·제공 파일별 해시.

## 직접 확인

실제 32 × 32 PNG와 4배/1배 검토 시트를 각각 `view_image`로 확인했다. PNG 헤더에서 아이콘과 검토 시트의 크기를 읽어 확인했다. 목재 자루·짧은 금속 창끝·섬유 묶음을 어두운 게임 배경과 밝은 배경에서 구분할 수 있다. PNG는 불투명 픽셀과 완전 투명 배경으로 구성하며 블러·보간·반투명 테두리가 없다.

프로젝트 테스트·타입 검사·브라우저·GPU·git은 실행하지 않았다.

## SHA-256

제작 도구: `49496d382bc13b1ffdfbd0f2c6b0116ccaf2f40c3efd929e944b8d3a15797e31`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `ashveil-javelin.png` | 277 | `8c6f25f0d5f0e1d59898603b5d5a4a7ce9598b4af646f0c995a841735adb4134` |
| `ashveil-javelin.svg` | 8789 | `b09adf1a5c3164e0dc4659ef6bddd4762402f819813fdd2aa113741889cdf877` |
| `ashveil-javelin-contact.png` | 1593 | `58a3c8fc53abdea60a6791fef71e0cb36c97853bce79ac1885adc5e29c3091ec` |
| `ashveil-javelin-palette.json` | 345 | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |


## Root 통합 진행

v0.282에서13 선등록 뒤 실제Def/독립프레임/크레딧에 연결했다. Root도4배·1배검토시트를 직접 열었고 재현도구 --check가5파일 바이트 일치를 확인했다. 게임브라우저/전체 검증은 별도 진행한다.
