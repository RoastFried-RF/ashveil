# ASHVEIL 원본 지상 수목 2종 — 침엽수·마른나무 준비 패키지

2026-10-21에 실제 Terrain·공유 sprite 소비자와 renderer 크기·앵커·변형 계약을 읽고, 살아 있는 소나무와 말라 죽은 나무 두 종류를 직접 그렸다. **새 원본과 병합 조각 준비 완료, 게임 미등록** 상태이며 `/workspace/ashveil-forest-art`의 새 파일만 작성했다.

## 선택한 실제 대상과 공유 소비자

| 실제 소비자 | 현재 sprite 경로 | 실제 표시 계약 / 처리 |
| --- | --- | --- |
| `Terrain.Tree` 말라 죽은 나무 | Def sprites는 `tree_dead`; 정적 renderer는 hash에 따라 `tree` 또는 `tree_dead`를 선택 | 두 원본 프레임 모두 80×96; anchor `[0.5,0.96]`; x배율 ±0.42 / y배율 0.42; tint `0x9a9a92` |
| `Terrain.PineTree` 살아 있는 소나무 | dynamic visual의 `tree_dead` | 원본 80×96; anchor `[0.5,0.96]`; 현재 visual.scale 1; tint `0x75a36a` |
| `Terrain.BlackwoodTree` 검은 잎 나무 | dynamic visual의 `tree` | scale 0.4; 이번 새 수목의 직접 적용 대상에서 제외 |
| `Item.Wood` 목재 | 외부 타일 아이콘 `stump` | 그대로 보존; 이번 지상 수목에 포함하지 않음 |
| `Item.PegLeg` 막대 의족 | `stump` | 그대로 보존 |
| `Item.CampfireKit` 모닥불 꾸러미 | `stump` | 그대로 보존 |
| `Item.WhitecapCulture` 흰갓 배양목 | `stump` | 그대로 보존 |

실제 직접 sprite 소비자는 위7개다. `tools/art/forest-usage-survey.json`에 각 Def의 원문·JSON 경로, 기존 프레임/시트, renderer 계약, 읽은 코드와 문서의 SHA를 보존했다. 이는 현재 Root 작업본의 읽기 전용 소스 조사이며 공개 main이나 저장 월드에 실제로 몇 그루가 있는지 센 자료가 아니다.

현재 `sprites.json`에는 그루터기용 지상 frame·animation·Terrain visual 계약이 없다. stump는 위4개 서로 다른 물품이 공유하는 타일 아이콘이다. 따라서 최대2종 범위에서 **침엽수와 마른나무**를 선택했고, 그루터기·목재·배양목·의족을 하나의 새 지상 그림으로 덮어쓰지 않았다.

`tree`는 `dw_env` 시트의 80×96 영역이고 그 시트는 `rock`, `mushrooms` 프레임도 공유한다. `tree_dead`는 별도 `dw_tree_dead` 시트의 80×96 영역이다. 기존 시트 전체 URL 교체는 이 패키지의 제안이 아니며 실제 공유 시트나 외부 픽셀을 입력·열기·복사하지 않았다.

## 실제 선택·크기·지면 계약

`MapRenderer.staticObject()`의 Terrain.Tree 분기는 `h % 4 === 0 ? tree : tree_dead`로 두 키를 선택하고, `h % 2`에 따라 좌우 반전한다. 별도 indexed variant나 애니메이션 프레임은 없다. 이번 두 종류도 각각 정적 원본 1프레임을 제공하며 좌우 반전해도 읽히는 비대칭 가지로 그렸다.

PineTree는 `terr.visual`을 통해 동적 경로에서 그린다. 현재 코드에서는 같은 기존 tree_dead를 사용해도 scale1이므로 일반 Tree의 ±0.42와 크기가 다르다. 새 원본은 실제 native80×96을 유지한다. PineTree의 현재 배율·tint를 임의로 바꾸거나 이 패키지에서 같은 월드 크기라고 주장하지 않는다. Root 통합 시 실제 장면에서 그 차이를 확인해야 한다.

| 항목 | 새 소나무 | 새 마른나무 |
| --- | --- | --- |
| 제안 frame | `original_pine_tree` | `original_dead_tree` |
| 제안 sheet | `original_forest_pine` | `original_forest_dead` |
| 원본 PNG / SVG | `ashveil-pine-tree` | `ashveil-dead-tree` |
| native frame | 80×96 | 80×96 |
| 실제 불투명 경계 x/y | `[6,6,72,91]` | `[6,4,74,91]` |
| 실제 실루엣 높이 | 86px | 88px |
| 마지막 뿌리 픽셀 / 지면 경계 | y91 / y92 | y91 / y92 |
| 기존 renderer anchor | `[0.5,0.96]` | `[0.5,0.96]` |
| anchor의 native 좌표 | `[40,92.16]` | `[40,92.16]` |
| 지면 경계와 anchor 차 | 0.16 native px | 0.16 native px |

기존 anchor0.96을 정수 픽셀용 값으로 바꾸지 않았다. 물체의 실제 지면은 y92이며 그 아래4행은 투명하다. anchor와의 작은0.16px 차이도 실측 기록에 남긴다. 현재 일반 Tree 배율0.42에서는 native frame 전체가 33.6×40.32 월드 px이고, PineTree scale1에서는 80×96이다. 원본 자체에 지면 그림자·빛·재료 보상이나 수량은 없다.

## 잿빛 침엽림의 원본 도형

CANON의 회색 고원, `Biome.Conifer`의 잿빛 침엽림, world-bible의 테라포밍 침엽수림과 현재 추운 고원, 14의 나무 군락 지상 지형을 읽었다. 검은 숲 실험종을 새로 발광하는 종으로 해석하지 않았다.

소나무는 낮은 채도의 회녹색 바늘잎 덩어리, 고르지 않은 처진 가지 층, 작은 재빛 표면 결, 갈색 줄기와 뿌리를 새 polygon/선 좌표로 작성했다. 매끈한 대칭 원뿔 대신 비대칭 가지 끝과 빈 틈으로 자연스러운 실루엣을 만들었다. 잎 개수·가지 수는 채집 횟수나 자원 수량이 아니다.

마른나무는 가늘어지는 갈래와 비대칭 가지, 회갈색 껍질·미세한 나무 결·작은 지의류 결로 표현했다. 불탄 상태나 새로 베어진 상태를 뜻하는 숯·불꽃·절단 자원 더미를 넣지 않았다. 나무가 죽었다는 실제 Terrain 이름에 맞는 잎 없는 외형이다.

땅에 고정된 타원 그림자·외부 광원·판타지 발광·열매/둥지/버섯 보상·채집 정답 표식·잔량 표시·재성장/소진 상태를 넣지 않았다. 기존 gather/needles/fire/resource 데이터는 아트에서 변경하거나 정답처럼 시각화하지 않는다. 내부 짙은 색은 잎·껍질 재질이며 땅의 조명 효과가 아니다.

외부 에셋·기존 나무 그림·생성 이미지를 입력·크롭·추출·트레이싱·재색칠하지 않았다. 자체 표준 라이브러리 캔버스·PNG/SVG·문자 출력 소프트웨어만 재사용하고 나무 몸체·뿌리·가지·바늘잎 군집과 15색 재질 팔레트는 새로 설계했다. 프로젝트용 자체 원본이며 프로젝트와 같은 사용 조건으로 제공한다.

## 파일과 재현

```sh
python3 tools/art/draw-forest.py
python3 tools/art/draw-forest.py --check
python3 tools/art/check-forest.py
```

제작 도구는 MAIN을 import하거나 다시 읽지 않고 내장된 좌표·조사 snapshot으로 자신의11파일을 생성한다. 같은 이름 SVG는 PNG와 같은 정수 rect 픽셀의 편집 원본이다. PNG는 RGBA이며 알파는 0/255다.

`ashveil-forest-contact.png`는 768×472 검토 시트다. 종류별 2배 확대, native80×96, native 좌우 반전, 작은 배율 검토를 제공한다. `*-map-review.png`는 0.42배를 반올림한34×40 크기에서 source 중심을 최근접 샘플링한 자료다. 실제 GPU 렌더링·tint·조명·정렬 결과의 스크린샷이 아니며 현재 PineTree가0.42배라는 뜻도 아니다.

원본 PNG2개·축소 검토 PNG2개·최종 contact 총5 PNG를 각각 `view_image`로 실제 열었다. 두 실루엣의 구분, 가지의 연결, 뿌리와 투명 여백, mirror와 작은 크기 가독성을 확인했다.

실제 실행 결과는 `docs/art-forest-verification.json`에 있다.

- 생성11파일의 결정적 바이트 재현 `PASS`.
- PNG/SVG2쌍의 전 RGBA 픽셀·CRC·알파·15색 팔레트 `PASS`.
- 실제 native 경계·86/88px 높이·지면 y92·기존 anchor92.16 실측 `PASS`.
- 34×40 최근접 배율 검토의 source 중심 샘플 일치 `PASS`.
- contact의 native/mirror/2배/축소4배 패널이 원본 픽셀과 정확히 일치 `PASS`.
- 실제7공유 소비자·새sheet/frame2개만 포함·제작/출력 SHA `PASS`.

## 통합 범위 제안

`tools/art/forest-manifest.fragment.json`에는 새sheet2개와 새frame2개만 있다. 기존 tree/tree_dead/stump/dw_env/dw_tree_dead는 없다. 실제 game Def·renderer·매니페스트는 이 패키지에서 수정하지 않았다.

PineTree는 새 `original_pine_tree`를 전용 visual.sprite로 연결할 수 있다. 일반 Terrain.Tree의 경우 현재 정적 renderer가 hardcoded tree/tree_dead를 선택하므로 **Def의 sprites만 바꿔서는 실제 표시가 바뀌지 않는다**. Root가 해당 선택 분기를 명확히 한정해 새 `original_dead_tree`를 사용할지 결정한다. 기존25% tree 대체도 같은 마른나무의 반전/선택으로 바꿀지 여부는 별도의 renderer 통합 사항이다.

BlackwoodTree의 명시된 tree visual과4종 stump 물품은 그대로 보존해야 한다. 이 아트는 어떤 나무에서도 목재/솔잎 고정량을 보장하거나, 화재 후 그루터기 규칙·자원 보존·시야·통행을 추가하지 않는다. 실제 게임 적용과 화면·조명·소멸/재성장 검증은 Root 담당이다.

Root/Core/Def/실제 공용 manifest/Git·기존 파일은 변경하지 않았다. GPU·브라우저·프로젝트 검사·무거운 검사는 실행하지 않았다.

## SHA-256

- `tools/art/draw-forest.py`: `cabf3a090809e94130c37a3f3c27c6ddd43f5f720e5408a0d92d44cb918b583c`
- `tools/art/check-forest.py`: `22afd8384f4879a852963a6d593507739884eabf12883a4d656495881c73bdff`
- `docs/art-forest-verification.json`: `cb4f777cea9c9db27361bcd20d2a92f1e5775cb12a2735286c8fef41380567d9`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/ashveil-pine-tree.png` | 973 | `f43c5bc9c52c69b751a05b4f6022565795ae4c2094bb84af8e1aa70d45b97075` |
| `public/sprites/original/ashveil-pine-tree.svg` | 39176 | `0ad9cf2398e253b69050554fe9902635fc4d76050a0c3e5b177c06fb61987f47` |
| `public/sprites/original/ashveil-pine-tree-map-review.png` | 408 | `6c7253ae2e9be84a8b57df7b0ec819739f5bb5ebdcb8ea70355513b64590f3bc` |
| `public/sprites/original/ashveil-dead-tree.png` | 948 | `8e29343544d00ba38ef52cd47ea838c277b9f1466bca446d65b8141ee4c86551` |
| `public/sprites/original/ashveil-dead-tree.svg` | 59795 | `cece0f4a84113453b3642fa1f54f9c107735eb78b449fe58fcdabf0e10faf4b4` |
| `public/sprites/original/ashveil-dead-tree-map-review.png` | 403 | `a6398ab844248e3da4bd04e1c6feb507303f63dff992534231edce974c0cba99` |
| `public/sprites/original/ashveil-forest-contact.png` | 11321 | `9fb74002da5c3293a20e11db4f11e2b147626fc73375e2f496258f368fc28da2` |
| `public/sprites/original/ashveil-forest-palette.json` | 273 | `fc979a6dd12d20134fd7c46f70b2564e6c15f68f10867318546a8b2279853ec8` |
| `tools/art/forest-manifest.fragment.json` | 383 | `bc983e7d0fb79718ea59ff6d5eef7a97ce7f0bbfe0451eadd79bd01cabb0bf4b` |
| `tools/art/forest-usage-survey.json` | 8792 | `ec10665b11f0db7a514578097224571be9248f8b00ca33459c405ca3192970d5` |
| `public/sprites/original/ashveil-forest-source.json` | 3486 | `44c0f195ea8b593c1bed8ab784a48b4ffd7630d06c80237ebfc9e9aad31195e5` |

## v0.290 적용

Root가 contact를 직접 열고 새2시트/2frame만 적용했다. PineTree의 실제visual.sprite와 Tree의sprites를 별도patch로 연결했다. Tree렌더러는 기존 tree_dead 기본키를 쓰는 역사적혼합표현은 보존하며 별도로 지정한sprite를 읽는다. 기존±.42배·anchor(.5,.96)/tint 및Pine배율1을 유지한다. Blackwood·stump공유물품과옛프레임/파일은 바꾸지 않는다. 실제게임·원본독립검토·전체검증은별도진행한다.
