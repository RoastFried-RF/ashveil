# ASHVEIL 원본 정밀 잠금 도구

장력쇠와 가는 곡선 갈고리를 정수 좌표로 직접 그린 원본 픽셀 아트다. 외부 이미지를 입력으로 사용하지 않았고 외부 팩 추출·재색칠·기존 그림 변형을 하지 않았다. 프로젝트 자체 아이템의 낡은 강철/갈색 가죽/청록 윤곽 팔레트 일부만 재사용한다. 제작 도구의 PNG/SVG 출력 방식은 앞서 직접 작성한 원본 문 제작 도구와 같은 표준 라이브러리 패턴이다. 프로젝트를 위해 제작했으며 프로젝트와 같은 사용 조건으로 제공한다.

`docs/design/13-inventory.md`의 정밀 잠금 도구 등록을 읽고 맞췄다. 물리 격자 크기 **1×2**와 아이콘 프레임 **32×32**는 다른 계약이다. 프레임 이름은 `lockpick`이다. 작은 가죽 손잡이에서 이어지는 가는 강철 훅과, 별도로 분리된 L자 장력쇠를 그렸다. 훅은 끝이 열린 곡선이며 열쇠의 원형 손잡이/톱니/장식 보석은 없다.

- `lockpick.png`: 32×32 RGBA 투명 원본.
- `lockpick.svg`: 같은 정수 픽셀 좌표의 SVG.
- `lockpick-preview-16.png`: 실제 16px 크기의 최근접 중심 샘플 검토본. 게임 manifest에는 32×32 원본만 제안한다.
- `lockpick-review.png`: 어두운/밝은 배경의 원본·16px 확대 및 실제 32px/16px 표시, 팔레트. 실제 게임 화면이 아닌 원본 검토 시트다.
- `lockpick-frames.fragment.json`: 향후 Root 통합용 sheets/frames 조각. 제안 경로는 `public/sprites/original/items/lockpick.png`다.
- `lockpick-palette.json`, `lockpick-integrity.json`: 팔레트, 원본/제작 도구/산출물 SHA256과 프레임·알파 정보.

```sh
python3 draw-lockpick.py
python3 draw-lockpick.py --check
```

표준 라이브러리만 사용하는 제작 도구는 이 격리 폴더에만 파일을 생성한다. `--check`는 모든 생성 파일의 정확한 바이트를 계산해 읽기 전용으로 대조한다. 이 제작 작업에서는 게임 제품 저장소/Git/Core/Def/실제 manifest/브라우저/GPU를 수정하거나 실행하지 않는다. 잠금 해제 기능의 비용·확률·실제 성공 여부는 Root의 별도 구현·통합 검증 범위다.
