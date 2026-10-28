# ASHVEIL 원본 낡은 문

외부 이미지 없이 정수 좌표를 직접 작성해 그린 새 픽셀 아트다. 외부 팩을 추출·재색칠하거나 기존 문 그림을 변형하지 않았다. 제작 도구는 표준 라이브러리만 사용하며 PNG와 SVG를 동일한 픽셀 좌표에서 출력한다. 원본 좌표와 팔레트는 이 묶음의 `draw-rusted-door.py`에 있다. 프로젝트를 위해 제작했으며 프로젝트와 같은 사용 조건으로 제공한다.

- `rusted_door_closed`: 투명 RGBA 16×32. 풍화된 회녹색 목재, 갈라진 결, 녹슨 철제 경첩과 띠, 작은 열쇠구멍·잠금쇠. 닫힘 상태가 잠김을 단정하지 않도록 부착 자물쇠는 그리지 않았다.
- `rusted_door_open`: 투명 RGBA 16×16. 왼쪽 경첩을 중심으로 문짝을 비스듬히 열어 아래쪽으로 축약한 표현이며 위쪽·오른쪽 통행 영역은 투명하다. 닫힘과 같은 목재·철물·문턱을 사용한다.
- `rusted-door-review.png`: 어두운/밝은 바탕의 8배 확대, 같은 바닥선의 3배 표시, 1배 실크기, 팔레트 검토 시트다. 실제 게임 화면을 촬영한 자료는 아니다.

기존 계약을 읽은 경로는 `/workspace/ashveil/src/client/sprites.json`, `src/client/render/MapRenderer.ts`, `src/content/core/defs/terrain.json`이다. 기존 닫힘은 16×32, 열림은 16×16이며 렌더러는 타일 16, anchor(0,1), position(px,py+16), zIndex py+15.5를 사용한다. 새 두 프레임은 마지막 행의 문턱을 같은 바닥선에 맞춘다. CANON D13의 처음부터 낡고 음습한 석조 폐사원 재질을 따르되, 지형을 밝게 덮거나 전역 색을 수정하지 않는다.

`rusted-door-frames.fragment.json`은 향후 수동 통합을 위한 sheets/frames 조각이며 실제 게임 manifest를 수정하지 않는다. 이미지 경로는 제안 경로 `public/sprites/original/terrain/` 기준이다. 기존 문을 고르는 렌더러 분기는 현재 `door_closed`/`door_open`을 직접 선택하므로 새 프레임의 실제 사용 여부는 Root의 별도 통합 작업에서 결정한다.

```sh
python3 draw-rusted-door.py
python3 draw-rusted-door.py --check
```

`--check`는 이미 생성된 파일의 바이트를 다시 계산해 대조하고 파일을 수정하지 않는다. `rusted-door-integrity.json`에 제작 도구 SHA256, 산출물 SHA256, 프레임 치수, RGBA/알파 검사가 들어 있다. 제작·검토 범위는 이 격리 폴더뿐이며 게임 소스/Git/Def/실제 manifest/브라우저/GPU는 변경하거나 실행하지 않았다.

## v0.285 통합

Root가 전체 검토 시트를 직접 열어 낡은 목재/철물·닫힘32/열림16·지면 기준을 확인했다. 원본 준비 묶음은 tools/art/rusted-door 아래 그대로 보존하고, PNG/SVG/검토 자료와 manifest 조각은 public/sprites/original/terrain에 연결했다. 재현 명령은 python3 tools/art/rusted-door/draw-rusted-door.py --check다. public 사본은 원본과 별도로 전 바이트를 대조한다. 새 두 Terrain의 sprites 필드를 사용하도록 실제 문 렌더러를 연결했으며 보통 문은 원래 Def 스프라이트를 사용한다. 실제 게임 화면 검증은 아직 진행 전이다.
