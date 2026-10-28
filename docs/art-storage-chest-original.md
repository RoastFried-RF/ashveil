# ASHVEIL 원본 목제 보관함 — 설치 닫힘·열림과 소지품 아이콘

2026-10-21에 실제 `Item.StorageChest`, `Terrain.Stash`, 상자 renderer와 공유 소비자를 읽고 새 원본을 직접 그렸다. **새 아트와 키 조각 준비 완료, 게임 미등록** 상태다. 작업은 `/workspace/ashveil-storage-chest-art`의 새 파일에만 한정했다.

## 실제 물품·설치·화재 계약

`base-camp.json`의 실제 목제 보관함은 `size:[3,2]`, 무게8, `material:Material.Wood`, `place:Terrain.Stash`다. 제작법은 Wood4와 Cloth1을 사용한다. 나무판과 거친 천 결합부로 그렸으며 새로운 금속 자물쇠·강화 장식·추가 재질 규칙을 발명하지 않았다. 판자나 결합부의 시각적 개수는 재료 단위·수량·내구 값을 나타내지 않는다.

`Terrain.Stash`는 `Terrain.Chest`를 상속하고 `Loot.Empty`, 실제 보관 격자12×8, openTurns0/openNoise0을 지정한다. 물품의 휴대 점유3×2, 설치된 보관함의 내부12×8, 지도에서 그리는16×16은 서로 다른 실제 계약이며 아트가 값을 바꾸지 않는다.

현재 Root 작업본의 `storage-fire.json`은 Stash에 wood-stash combustion과 소진 뒤 원래 물품이 같은 자리에 남는 설명을 추가한다. 이번 그림에 불꽃·그을린 단계·불에 탄 전리품·내용물 정답을 넣지 않았다. 실제 연소·물·물품 보존·UID·소유 상태는 기존 코드가 담당하며 아트에서 실행하거나 변경하지 않았다.

`tools/art/storage-chest-usage-survey.json`에는 실제 Item·Recipe·Material·Stash/부모 Def·화재 패치·기존 프레임/애니메이션·기존 소지품 아이콘의 헤더 크기/파일 SHA와 renderer/UI 계약을 보존했다. 기존 이미지의 픽셀은 그리기 입력으로 읽거나 참조하지 않았다. 조사 문맥은 현재 Root 작업본이며 게시 main이나 게임 실행 결과라고 주장하지 않는다.

## 기존 공유 소비자와 보존 범위

현재 직접 chest/chest0를 참조하는 Def는5개다. Terrain 상속까지 확인하면 chest0 표시를 공유하는 지형은 아래5종이며, 별도 빨간 제단도 Chest 계열이다.

| 실제 소비자 | 현재 표시 키 / 처리 |
| --- | --- |
| `Terrain.Chest` 일반 궤짝 | `chest0` → searched면 `chest2` |
| `Terrain.GuardChest` 경비실 상자 | `chest0` → `chest2` |
| `Terrain.Stash` 야영지 보관함 | `chest0` → `chest2`; **이번 전용 새 키 대상** |
| `Terrain.BoatHold` 배 화물함 | Chest의 `chest0` 상속 |
| `Terrain.ZeroVaultChest` 금고 보관함 | Chest의 `chest0` 상속 |
| `Terrain.Altar` 제단 | Chest를 상속하되 `chest_red0`를 직접 지정; 빨간 기존 표현 보존 |
| `Item.StorageChest` 목제 보관함 | 기존 소지품 `chest` 타일; **이번 별도 아이콘 대상** |
| `Item.CoracleKit` 접은 통가죽배 | 같은 소지품 `chest` 타일; 이번 대상에서 제외 |

기존 objects 시트의 chest0/1/2, chest_red0/1/2와 `chest_open` 애니메이션은 보존한다. objects 시트에는 상자 외 다른 프레임도 있으므로 전체 URL을 새 상자 그림으로 바꾸는 제안은 아니다. 기존 `public/tiles/chest.png`도 CoracleKit 등의 기존 표현을 위해 그대로 보존한다.

## 지도 닫힘/열림의 실제 규칙

`MapRenderer.buildDynamic()`은 실제 container 지형의 첫 sprites를 base로 사용한다. `opened = !!tile.searched`이고, `base.replace(/0$/, '2')`가 등록된 프레임이면 그 키로 바꾼다. 이번 이름의0/2 suffix는 이 계약을 그대로 따른다. 새 중간1프레임이나 별도 애니메이션은 추가하지 않았다.

| 항목 | 값 |
| --- | --- |
| 새 닫힘 frame / sheet | `original_storage_chest0` |
| 새 열림 frame / sheet | `original_storage_chest2` |
| 닫힘/열림 native | 각각16×16 RGBA |
| 닫힘 불투명 경계 | `[1,5,14,15]` |
| 열림 불투명 경계 | `[1,1,14,15]` |
| 지도 anchor / native anchor 좌표 | `[0.5,1]` / `[8,16]` |
| 배율 / 위치 | 1 / 타일 원점 + `[8,16]` |
| 마지막 밑면 픽셀 / 지면 경계 | y15 / y16 |
| 두 상태의 같은 밑면 | y11~15 전 RGBA 픽셀 동일 |
| 기존 열린 지형 tint | renderer가 `0x8a8478` 적용 |

열린 뚜껑과 어두운 입구는 물체의 열림 형태다. 실제 잠금 여부·빈 상자·내용물 존재·수색 성공·소유권을 보장하지 않는다. PNG 자체에 열린 tint나 품질 감소 효과를 미리 입히지 않아 기존 renderer의 tint가 그대로 적용될 수 있다. 지면 그림자·빛·내용물·고정 전리품·열쇠구멍·잠금/해제 표시·불꽃은 없다.

## 별도 소지품 아이콘과 실제 UI 크기

새 소지품 frame/sheet는 **`original_storage_chest_item`**이며 native32×32다. 지도16px 그림을 늘린 파일이 아니라 더 큰 좌표로 따로 작성한 목제 상자다. 불투명 경계는 `[3,7,28,28]`이며 천 결합부·나무판·옆면을 원본 픽셀로 그렸다.

현재 `InventoryWindow.vue`의 CELL은38px이고3×2 물품의 표시 영역은112×74px다. `iconSize()`는 두 축이 모두2 이상이면64px이므로 이 물품은64px 아이콘으로 보인다. 검토 시트의 UI 패널은 native32 그림을2배로 그려 해당112×74 영역에 가운데 배치한 원본 검토 자료다. 실제 브라우저 스크린샷이 아니며 원래 인벤토리 격자나 회전·수량 뱃지를 새로 만들지 않는다.

`ashveil-storage-chest-item-16.png`는 작은 목록 크기를 확인하기 위한 중심 최근접 샘플이다. 인벤토리 점유를1칸으로 바꾸거나 게임 원본을16px로 등록하는 파일이 아니다.

## 원본 제작·재현·검사

외부 에셋이나 기존 상자 이미지를 입력·추출·크롭·트레이싱·재색칠하지 않았다. 자체 캔버스·선·PNG/SVG·문자 출력 코드와 19색 재질 팔레트를 재사용하고, 상자 본체·뚜껑·천 결합부·지도 두 상태와 별도 큰 소지품 아이콘은 새 정수 좌표로 작성했다. 프로젝트용 자체 원본이며 프로젝트와 같은 사용 조건으로 제공한다.

```sh
python3 tools/art/draw-storage-chest.py
python3 tools/art/draw-storage-chest.py --check
python3 tools/art/check-storage-chest.py
```

제작 도구는 포함된 실제 조사 snapshot과 좌표로 자신의12파일을 결정적으로 생성한다. MAIN을 읽거나 import하지 않는다. PNG와 같은 이름 SVG는 동일한 rect 픽셀을 보존한 편집 원본이다. `--check`는 파일을 쓰지 않고 바이트를 대조하며 독립 검사 도구는 제작기를 import하지 않는다.

`ashveil-storage-chest-contact.png`는832×432 px이며 지도 두 상태8배, 소지품4배, 밝고 어두운 배경의 native, 작은16px와 실제 UI 크기 예시를 제공한다. 최종 contact와 닫힘·열림·소지품·소지품16px의 총5 PNG를 `view_image`로 각각 직접 열었다.

실행 결과는 `docs/art-storage-chest-verification.json`에 있다.

- 생성12파일 결정적 바이트 재현 `PASS`.
- PNG/SVG3쌍 전 RGBA 픽셀·CRC·알파0/255·19색 범위 `PASS`.
- 지도16×16·바닥y16·anchor[8,16]·0→2 이름 선택과 동일 밑면5행 `PASS`.
- 소지품32px 별도 원본·실제3×2·UI64px·112×74 영역 `PASS`.
- 소지품16px 중심 최근접 샘플과 contact10개 패널 전 픽셀 `PASS`.
- 직접5소비자 및 Chest계열6지형 상속 조사·새 키3개만 포함·source SHA `PASS`.

## 연결 제안과 미수행 범위

`tools/art/storage-chest-manifest.fragment.json`에는 새 sheet/frame3개씩만 있으며 기존 키나 char/animation은 없다. Root가 **`Terrain.Stash.sprites[0]`만 `original_storage_chest0`**, **`Item.StorageChest.sprite`만 `original_storage_chest_item`**으로 연결하는 범위를 권장한다. 나머지 상자/화물함/금고/제단/통가죽배와 기존 상자 파일은 보존한다.

실제 게임 등록·Def·Root/Core/Git/공용 manifest·기존 파일은 변경하지 않았다. GPU·브라우저·프로젝트/무거운 검사는 실행하지 않았으며 실제 화재·잠금·수색·저장·게임 화면이 검증됐다고 표시하지 않는다.

## SHA-256

- `tools/art/draw-storage-chest.py`: `bcafbf97720afce009e7f0aedc6ada992cc5a8c81e45d3f48658c75696ac69d4`
- `tools/art/check-storage-chest.py`: `225c8e09664578b6ee50092aef76153cdf591290b24ee48e4b3d06a556a608b7`
- `docs/art-storage-chest-verification.json`: `de46224c826c105595f3c48d082e5eeea2c9488afeebc4af0335cde708ee5c62`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/ashveil-storage-chest-closed.png` | 192 | `147ea2fa3823259254a40b5a1abf6325063316ae63f822ac9cc815fc53455dc1` |
| `public/sprites/original/ashveil-storage-chest-closed.svg` | 4815 | `dda8f9028ccac4669e0505515f005602b2fd3761c539cd26d07b11bd1330710f` |
| `public/sprites/original/ashveil-storage-chest-open.png` | 206 | `3cfd9b00f618ef68eba736171231ac1dbdb19265f4bb59a4b19da1885a33942c` |
| `public/sprites/original/ashveil-storage-chest-open.svg` | 5748 | `81f85f9ba2b07dfc82c748dbb22bc945df07bf5a873dfdabc677c7c9e1a66844` |
| `public/sprites/original/ashveil-storage-chest-item.png` | 305 | `3cf9fe6fc334539425fa75bf591a69fd82b79491bf7616dd1f5d7a94e0746465` |
| `public/sprites/original/ashveil-storage-chest-item.svg` | 12551 | `7776f2af710eb8b76df00453d755f52bce57f681593ac69bacce396f284f8e4e` |
| `public/sprites/original/ashveil-storage-chest-item-16.png` | 201 | `8b02da3aa231b92690b2c1dbe583db6a82966c36e6e781f0b97f4e60753b3d07` |
| `public/sprites/original/ashveil-storage-chest-contact.png` | 7322 | `21c67f28e285bdcd3f659538403cda655c1608ab3ec2d1897e6fdfa2e919708d` |
| `public/sprites/original/ashveil-storage-chest-palette.json` | 345 | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |
| `tools/art/storage-chest-manifest.fragment.json` | 629 | `8cec16cb7754e2f5d51ec72c8be263a84bdd9d8581e9048520e5748b48e0ee6c` |
| `tools/art/storage-chest-usage-survey.json` | 14688 | `e3defd17930a812bd52c2ec36ef868878b7efd5b5a6a9a7707082be36f25294d` |
| `public/sprites/original/ashveil-storage-chest-source.json` | 3479 | `7b2c3ee879ec4c81e8ef15bab3ad580f08e1fec69f70720fefd65d962cdc4494` |

## Root 통합 기록

2026-10-21 Root에서 위 고립 원본 파일을 바이트 그대로 복사하고 신규3키만 등록했다. `storage-chest-original.json`의 두 sprite 패치로 Stash와 StorageChest에만 연결했다. 기존 Chest·GuardChest·BoatHold·ZeroVaultChest·Altar·CoracleKit와 기존 공유 시트는 보존했다. 위 미등록·미수행 표현은 원본 제작 단계의 기록이며 통합 후 실제 화면·저장 검증은 별도 실행 기록으로 남긴다.
