# ASHVEIL 원본 도기 그릇·덜 익은 귀리 혼합물·귀리죽

2026-10-21 제작. `/workspace/ashveil-oatmeal-art` 안에만 작성한 **3종 원본20파일** 인계 묶음이다. Root 제품과 Git, 현재 v299 불변본은 변경하지 않았다. 같은 낡은 무광 도기 그릇의 내용물3상태를 제공하며, 실제 조리·소비·물품 상태 변환은 구현하지 않는다.

## 실제 대상 원문

`src/content/core/defs/oatmeal.json`, `src/content/core/defs/unheated-meal.json`과 `ItemIcon.vue`를 읽고 다음 원문을 캡처했다. 원문/출처 SHA는 `tools/art/oatmeal-reference-contract.json`에 있다. 실제 Def DB나 모든 패치 엔진을 실행한 결과가 아니다.

| 실제 Item | 원래 own sprite | 제안 새 sheet/frame |
| --- | --- | --- |
| `Item.Bowl` | `pot0` | `original_hearth_bowl` |
| `Item.UnheatedOatmealBowl` | `pot0` | `original_hearth_raw_oatmeal` |
| `Item.OatmealBowl` | `pot1` | `original_hearth_oatmeal` |

셋은 원문상1×1, stackable=false, maxStack1이다. 덜 익은 혼합물은 `raw` 음식이며 기존400턴 가열 결과로 `Item.OatmealBowl`을 가리킨다. 덜 익은/익은 음식 모두 `emptyVessel: Item.Bowl`이다. 익은 죽의 기존 보온 규칙은 아트 상태와 별개다. 이 묶음은 원래 영양·물·신선도·온기·가격·400턴·빈 그릇 반환 규칙을 바꾸지 않으며 그림 자체로 그 동작이 완료됐다고 주장하지 않는다.

## 새 좌표의 공통 그릇과 내용물

그릇은 넓은 입구, 손잡이 없는 도기 벽, 무광 회갈색의 닳은 가장자리와 작은 받침을 가진 새 정수 도형이다. 기존 pot0/pot1, 다른 음식·그릇 도형, 타사 이미지나 생성 이미지를 입력·크롭·복사·추출·트레이싱·확대·재색칠하지 않았다. 그릇·음식 좌표와19색 팔레트를 이번에 새로 작성했다. 자체 CC0의 **일반 Canvas/선/다각형/PNG/SVG/최근접 I/O 유틸만** 재사용했으며, 이를 source·계약·라이선스에 공개했다.

- **빈 그릇:** 어두운 도기 내부와 낮은 바닥 선이 보인다. 음식·액체 색을 그리지 않았다.
- **덜 익은 혼합물:** 낮은 회청록색 수면과 모양이 남은 밝은 곡립을 그렸다. 그릇 바닥과 달리 묽고 분리된 내용물로 읽힌다.
- **익은 귀리죽:** 불투명한 저채도 상아/회베이지 표면에 부드러운 접힘과 작은 귀리 조각을 그려 걸쭉함을 표현했다. 물에 떠 있는 단단한 알곡과 질감·면적이 다르다.

시점은 정면에서 조금 위를 내려다보는 물품 아이콘 구도다. 모든 상태에서 그릇의 외곽·입술·앞면·받침·바닥은 같고, 내용물 창 **[4,8,28,18)** 밖의 **784픽셀은 RGBA까지 동일**하다. 전체 alpha 실루엣도 동일하므로 상태가 변해도 그릇의 크기나 외곽 위치가 바뀌지 않는다.

## 픽셀/프레임 규격

| key | 파일 stem | 불투명 경계(포함) | 불투명 가로×세로 | native32 / small16 불투명 픽셀 |
| --- | --- | --- | --- | --- |
| `original_hearth_bowl` | `ashveil-hearth-bowl` | [2,7,29,29] | 28×23 | 489 / 125 |
| `original_hearth_raw_oatmeal` | `ashveil-hearth-raw-oatmeal` | [2,7,29,29] | 28×23 | 489 / 125 |
| `original_hearth_oatmeal` | `ashveil-hearth-oatmeal` | [2,7,29,29] | 28×23 | 489 / 125 |

각 stem은 `public/sprites/original/items/` 안의 **32×32 PNG/SVG**와 **16×16 `-16.png`**를 갖는다. alpha는0/255, 팔레트는19색이며 외곽은 투명하다. 공통 바닥 끝은 **30**, 선택 아트 발점은 **[16,30]** / 정규화 anchor **[0.5,0.9375]**다. 실제 UI/월드 anchor를 수정한 것은 아니다.16px은 `(2x+1,2y+1)` 중심 최근접 샘플이며 흐림 처리하지 않았다.

`tools/art/oatmeal-manifest.fragment.json`은 신규 sheets3개와 `[sheet,0,0,32,32]` frames3개만 포함한다. char·animation·alias·Def 패치·UI 함수·상태 선택기는 없다. native32가 실제 fragment의 대상이며 small16은 검토/향후 대체 자료다. 현재 ItemIcon은 `size / max(frame.w,frame.h)`로 요청 크기에 맞춰 가운데 정렬하므로 기존1×1 아이콘 경로에서 쓸 수 있는 정사각형 프레임이다. 실제 호출 크기/배율은 Root 통합에서 결정한다.

SVG는 도형마다 정수 rect이며 폰트·filter·script·외부 참조·삽입 raster가 없다. 실제 편집 마스터는 Python 좌표 소스이고 같은 결과를 SVG/PNG로 내보낸다. 이미지 안이나 검토 시트에는 문자·숫자·로고·상태 뱃지가 없다.

## 안전·온도와 그림의 의미

**증기, 불, 거품 열기, 온도 아이콘, 안전 표시, 오염 색/반점, 부패 보증 표시는 없다.** 익은 귀리죽은 식은 뒤에도 같은 그림을 사용하기 위한 고정 외형이다. 회청록 수면은 물이 있는 묽은 혼합물의 질감이고 청결/병원체/염도/정수 여부를 나타내지 않는다. 걸쭉한 밝은 죽도 무오염·안전·따뜻함·신선함을 보장하지 않는다.

보이는 곡립/조각 수는 실제 투입량·물220ml·회분·더미·영양의 측정값이 아니다. 같은 그릇 geometry가 UID·품질·내구·원래 재료 보존을 코드로 구현하는 것도 아니다. 실제 상태·안내 텍스트와 기존 Core가 이 정보를 제공해야 한다. 이 팩은 새 아이콘3종만 담당하며 조리·소비·병원체/재·보온·저장 결과는 Root가 별도 실제 입력으로 검증한다.

## 실제 PNG 열기와 독립 정적 검사

native3장,16px3장,576×352 접촉 시트의 **실제 PNG7장**을 각각 직접 열었다. 빈 내부/묽은 물+곡립/걸쭉한 죽이16px에서도 구분되고, 공통 그릇이 잘리지 않으며 고정된 받침을 유지함을 확인했다. 접촉 시트는 왼쪽부터 빈 상태·덜 익은 상태·익은 상태로,4배 native와 어두운/밝은 배경의32/16px·확대16px를 보여 준다. 실제 게임 캡처가 아니다.

```sh
python3 tools/art/draw-oatmeal-icons.py --check
python3 tools/art/check-oatmeal-icons.py
```

두 검사 모두 통과했다. 재현기는 **13개 출력**을 파일 쓰기 없이 바이트 비교했다. 별도 검사기는 제작기를 import하지 않고 PNG7개의 CRC·단일 종료 IEND·RGBA8·알파·19색·투명 여백·경계를 직접 읽고 SVG3쌍 전 픽셀을 독립 비교했다. alpha 실루엣·그릇 외곽784픽셀의 동일성, native/16px3상태의 서로 다른 내용물,16px 최근접 대응, 접촉 시트의 **모든 픽셀과 무문자 배경**, 생성 참조12파일과 제작기·계약 SHA도 확인했다. 결과는 `docs/art-oatmeal-originals-verification.json`에 보존했다.

프로젝트 게임 개발 절차의 실제 입력→화면/상태 검증은 Root가 통합한 뒤 별도로 해야 한다. 여기서는 게임·GPU·브라우저·Type·Full/World·빌드·프로젝트 테스트를 실행하지 않았고 실제 행동 완료나 회귀 통과를 주장하지 않는다.

## CC0와 정확한20파일 인계

새 그림·좌표·팔레트·도구·문서는 **CC0-1.0**이며 상업 이용·수정·재배포·게임/모드/에셋 팩 포함을 허용하고 추가 허가/표기를 요구하지 않는다. 다른 프로젝트 자산·코드의 권리는 그대로다. 포함된 `LICENSE.txt`는 Root의 **`tools/art/oatmeal-LICENSE.txt`**로 무삭제 복사하면 원래 저장소 라이선스를 덮어쓰지 않으며 독립 검사기가 해당 경로를 지원한다.

`docs/art-oatmeal-originals-integrity.json`은 다른19파일의 정확한 경로·복사 목적지·바이트·SHA-256을 담는다. 목록 자신을 포함하면20파일이다. 구성은9개 상태 assets(PNG/SVG/small), contact/palette/source, manifest fragment, generator/checker, reference contract, license, 한글 설명, verification, integrity다. Root가 원하면 설명에 별도 통합 이력을 덧붙일 수 있지만 원본 아트 바이트는 그대로 인계한다.

Root/public/공용 manifest/Def/Core/UI/Git/v299 고정본은 수정하지 않았다. 기존 pot0/pot1와 다른 소비자도 이 격리 작업에서 바꾸지 않았다. 새3키의 등록·실제3Item 바인딩은 후속 통합 범위다.
