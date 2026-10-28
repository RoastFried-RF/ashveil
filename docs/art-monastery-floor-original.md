# ASHVEIL 원본 수도원 일반 석판 바닥 — 격리 준비본

2026-10-21. `CANON.md` D13의 **처음부터 낡고 음습한 석조 폐사원**, `12-ui-ux.md` §8의 **16×16 원본·재질에 남은 마모·조명은 별도 처리**, `14-locations-and-dungeons.md` §3과 `lore/world-bible.md` §1.4의 잿빛 수도원을 읽고 일반 석판 바닥을 직접 그렸다.

현재 상태는 **원본 리소스·기존 계약을 보존하는 조각 준비 완료, 게임 미적용**이다. 모든 작성물은 `/workspace/ashveil-monastery-floor-art` 안에 있다. 게임 저장소·Def·공용 시트·원본 팩·Git·브라우저·GPU·프로젝트 검사를 변경하거나 실행하지 않았다.

## 실제 일반 바닥 계약

실제 `src/content/core/defs/terrain.json`에서 `Terrain.KtFloor`는 ‘석판 바닥’이며 `floor: kt`다. `src/core/mapgen.ts`는 지하1·2층 방 바닥과 지상 수도원에 이를 사용하고, 지하3층의 방 바닥에는 `Terrain.CdFloor`를 쓴다. 이번 선택은 소스상 일반 용도에 따른 것이며, 저장된 모든 월드에서 사용 빈도를 조사한 순위가 아니다.

`src/client/render/MapRenderer.ts`의 `floorSprite()`는 두 경로를 구분한다.

| 실제 대상 | 기존 계약 | 이번 범위 |
| --- | --- | --- |
| `Terrain.KtFloor`와 일반 던전 바닥의 KT fallback | `kt_floor_q0..3`, 각128×128, 8×8개의16×16 셀로 분할 샘플링 | **선택한 일반 석재1종** |
| `Terrain.CdFloor` | `cd_floor0..19`, 각16×16, `h % 20` | 오염된 최심부 전용이므로 제외 |

일반 바닥의 실제 계산은 다음과 같다.

```ts
const q = hash(x >> 3, y >> 3) % 4
sub(`kt_floor_q${q}`, (x & 7) * 16, (y & 7) * 16, 16, 16)
```

따라서 ‘기존 변종4개’는 16px 타일4개가 아니라 **128px 매크로4개**다. 각 매크로에는64개의 주소 가능한16px 샘플이 있어 전체는256개다. 이번 도형을 독립 측정한 결과 서로 다른 샘플 픽셀은241개다. 나머지는 작은 반복 재질에서 같아질 수 있으며256개의 고유 그림이라고 주장하지 않는다.

기존 renderer는 이 KT 바닥을 계단·물체 아래의 던전 기본 바탕 등에도 사용하고, `Terrain.Rubble`에는 기존 tint를 적용한다. 향후 통합 때는 해당 바탕 전체의 시각 범위를 확인해야 한다. 이 준비본은 renderer 분기·타일 상태·지형 기능·조명·시야·Tint를 바꾸지 않는다.

## 직접 그린 재질

회갈색·저채도 이끼빛이 섞인 석재11색을 사용했다. 네 매크로마다 다른 높이의 석판 줄, 서로 다른 폭의 석판, 둥글게 닳은 작은 모서리, 얕은 마모면, 누적된 재먼지, 짧고 가는 금, 작고 어두운 습기 얼룩을 새 정수 좌표로 그렸다. 같은 석재 한 종류의 오래된 배치 변형이다.

기본 원본의 RGB 성분 범위는52~123이다. 밝은 광택 띠·발광하는 틈·보라색 오염·물 반사·횃불 색·고정된 투사 그림자를 넣지 않았다. 어두운 덮개로 새 벽돌을 낡게 보이게 만드는 후처리가 아니라, 원본의 마모·줄눈·먼지 형태를 직접 작성했다. 기존 게임의 조명 처리는 별도다.

외부 팩이나 기존 KT/CD 바닥 이미지를 열거나 입력·추출·트레이싱·재색칠하지 않았다. 기존 자체 제작 주민 도구의 Canvas·선·PNG/SVG 인코더·접촉 시트 글자 출력 구조를 재사용했으며, 바닥의 석판 배치·윤곽·먼지·금·습기 좌표는 이 패키지에 새로 썼다. PNG를 후처리한 편집물이 아니라 좌표 소스에서 재현되는 원본이다. 프로젝트를 위해 제작했으며 프로젝트와 같은 사용 조건으로 제공한다.

## 픽셀·프레임·이음새

| 항목 | 값 |
| --- | --- |
| 원본 PNG/SVG | `ashveil-monastery-floor.png` / `.svg`, 256×256 |
| native 월드 타일 |16×16, 기존 카메라 정수 배율 사용 |
| 매크로 변종 |4개, 각128×128 |
| `kt_floor_q0` | `['kt_floor', 0, 0, 128, 128]` |
| `kt_floor_q1` | `['kt_floor', 128, 0, 128, 128]` |
| `kt_floor_q2` | `['kt_floor', 0, 128, 128, 128]` |
| `kt_floor_q3` | `['kt_floor', 128, 128, 128, 128]` |
| 불투명도 | 모든 바닥 픽셀 alpha255, 투명 구멍 없음 |
| 타일 앵커/표시 크기 | 기존 바닥 Sprite의 왼쪽 위·native16px 유지 |
| 외곽 | 공유한1px 줄눈 프로필, 별도 UV gutter 없음 |

모든4×4 방향 있는 이웃 조합에서 좌우 경계와 상하 경계의 RGBA가 일치한다. 총32개 축별 접합 검사다. 선택된 매크로가 바뀌어도 빈 픽셀·투명 틈·다른 경계 색이 나타나지 않는다. 각 매크로를 실제64개의16px sub 영역으로 잘라 다시 합치면 원본 픽셀과 같다.

`tools/art/monastery-floor-manifest.fragment.json`은 **기존 `kt_floor` 시트의 URL만 새 원본 경로로 바꾸고4개 기존 프레임의 이름·좌표·크기는 보존하는 조각**이다. 새 Terrain·새 tile 크기·autotile 알고리즘·새 renderer 계약은 필요하지 않다. 실제 게임에 이 조각을 적용하지 않았다. `cd_tiles`, 벽·문·장식 시트와 Def는 조각에 포함하지 않았다.

## 산출물과 재현

- `tools/art/draw-monastery-floor.py`: 직접 그린 정수 좌표·11색 팔레트·PNG/SVG/검토본 작성 원문. 표준 라이브러리만 사용한다.
- `tools/art/check-monastery-floor.py`: 제작 도구를 import하지 않고 PNG를 직접 디코딩하고 SVG를 다시 래스터화하는 독립 검사 원문.
- `tools/art/monastery-floor-contract.json`: 실제 바닥 종류·4매크로/256샘플·renderer 선택식·제외한 CD20프레임 계약을 보존한 조사 기록.
- `public/sprites/original/ashveil-monastery-floor-source.json`: 원본 출처·입력 없음·생성 도구 SHA·8개 생성 파일 중 자신을 제외한7개 해시.
- `ashveil-monastery-floor-sampler.png`: 실제 renderer의 정수 좌표·hash 선택·16px sub 규칙으로 조합한32×20칸, 512×320 픽셀의 **독립 아트 예시**. 실제 게임 화면은 아니다.
- `ashveil-monastery-floor-contact.png`: 1056×1060, 네 변종2배 확대와 위 예시2배 확대·native16px 조각을 보여 주는 검토 시트.

```sh
python3 tools/art/draw-monastery-floor.py
python3 tools/art/draw-monastery-floor.py --check
python3 tools/art/check-monastery-floor.py --report docs/art-monastery-floor-verification.json
```

첫 명령은 이 패키지 소유의8개 파일만 생성한다. `--check`는8개 파일의 결정적 바이트를 읽기 전용으로 재생성·대조한다. 마지막 명령은 실제 PNG/SVG/프레임/이음새/예시를 독립 확인하고 지정된 격리 JSON만 작성한다. 외부 패키지·입력 이미지·네트워크·프로젝트 import가 필요 없다.

## 실제 완료한 확인

원본 전체 PNG, 전체 접촉 시트,512×320 샘플링 예시 PNG를 각각 `view_image`로 직접 열었다. 네 변종에서 다른 석판 배치, 작은 금·재먼지·습기, 반복 예시의 줄눈과 native 밀도를 확인했다. 어떤 결과도 실제 게임 화면·입력·빛 아래 검증으로 표시하지 않는다.

- 8개 생성 파일 바이트 재현 `PASS`.
- PNG CRC·RGBA·전체 alpha255·11색 팔레트 `PASS`.
- SVG의 모든 정수 rect를 독립 래스터화한 전 RGBA 픽셀 일치 `PASS`.
- 기존4프레임 이름/좌표/크기·서로 다른4매크로 `PASS`.
- 256개16px sub 영역 경계·원본 재조립 `PASS`, 고유 샘플241개.
- 4×4 이웃×상하/좌우32개 경계 RGBA 일치 `PASS`.
- 현재 renderer JS hash에서 별도 산출한4×6 블록 표와 선택식 `PASS`.
- 실제16px sub 조합 예시640칸 전 픽셀 대조 `PASS`.

향후 게임 통합 시에는 실제 벽·문·기존 오염 바닥과의 경계, 조명 단계와 캐릭터 대비, 계단·잔해·장식 아래 바탕, 저장된 지형과 바닥 기억의 표시를 실제 입력으로 검증해야 한다. 이 격리 작업에서는 게임 실행·빌드·전체 검사·배포를 하지 않았다.

## SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `tools/art/draw-monastery-floor.py` | `011b9e59ffe3fbdbe47f8fafdae388676933fd4ef12bcbb2c3dbe0e797cb0faf` |
| `tools/art/check-monastery-floor.py` | `fd3897c43c0ea9d754c7e0d71484158c3dc71378760a1a987a1d264941d57ac8` |
| `ashveil-monastery-floor.png` | `bf5013c830e807ab529cce411da955191e5cb28b1a6b6d9de9ee5a30e5caf457` |
| `ashveil-monastery-floor.svg` | `890a364117b2b549274474bd875e8587a3ae95d6c772b697ea36fc79a1a455f7` |
| `ashveil-monastery-floor-sampler.png` | `c9bbfd49d5e35d61628d0f3826affa020781072038744639fd90083ddf034db6` |
| `ashveil-monastery-floor-contact.png` | `43a2e0fcfdc6effcb59b4f18afe4e7a90331443ae8fd2c6c41de4b1cf962d9df` |
| `ashveil-monastery-floor-palette.json` | `9dd354e06cc9e0b801f0c9d6ce5574d73a7db40bb8e7f719808ffe08a6e0ce1e` |
| `ashveil-monastery-floor-source.json` | `e4e4789952d8bf3c107835b43aabbbdbcfa83598342569492a229cee27ab5f69` |
| `tools/art/monastery-floor-contract.json` | `790eb29e9fd374db1753c07a56cdc3e8704a3ed07f5ac97cba8426b3a87def5f` |
| `tools/art/monastery-floor-manifest.fragment.json` | `dd5ac30985ec28276bc9331c6b739026e5e9f67bdbddb2fab7bb8c97c51a1009` |
| `docs/art-monastery-floor-verification.json` | `1519aa024062947e2e66934340a52a95600d7e084508ee421fd815502659272c` |

## v0.288 통합

Root가 contact를 직접 확인하고 이번 화면 개선 묶음에 함께 적용했다. 기존 kt_floor의 URL만 원본으로 교체하고 모든 기존 frame좌표·Terrain·CdFloor·원래 타일 파일은 보존했다. 실제 조명·캐릭터·경계는 Native 입력 화면으로 별도 검증한다.
