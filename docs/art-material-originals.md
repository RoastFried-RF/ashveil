# ASHVEIL 원재료 원본5종 — 목재·고철·실·가죽·숯

2026-10-21 제작. `/workspace/ashveil-material-art`에만 작성한 **원본26파일** 인계 묶음이다. 별도 그릇/귀리죽3종 팩과 파일·키·문서가 분리돼 있다. Root 제품·Git·공용 manifest·Def·Core·UI는 변경하지 않았다.

## 실제 원문과 신규 키

`src/content/core/defs/crafting.json`의 실제5Item과 `ItemIcon.vue` 경로를 읽었다. 원문 전체 필드와 출처SHA는 `tools/art/material-reference-contract.json`에 캡처했다. 실제 Def DB·모든 패치를 실행한 결과가 아니라 제작 시점 읽기 스냅샷이다.

| 실제 Item | 원래 own sprite | 크기 / 최대 더미 | 새 sheet/frame |
| --- | --- | --- | --- |
| `Item.Wood` | `stump` | 1×3 / 3 | `original_hearth_wood` |
| `Item.IronScrap` | `pipe_club` | 1×2 / 5 | `original_hearth_iron_scrap` |
| `Item.Thread` | `cloth` | 1×1 / 5 | `original_hearth_thread` |
| `Item.Leather` | `leather_coat` | 2×2 / 3 | `original_hearth_leather` |
| `Item.Charcoal` | `bones` | 1×1 / 5 | `original_hearth_charcoal` |

원문상 모두 misc·stackable=true다. 실제 공간·더미·재료·가격·의료/제작 기능은 그대로다. 실 원문에는 기존 봉합 설명과 medical.kind=suture가 있지만, 그림에 바늘이나 새 의료 도구를 더하지 않았다. 전체 sprite 키를 갈아 끼우는 팩이 아니라 정확히5종에 쓸 새로운 원본 조각이다. 옛 stump/pipe_club/cloth/leather_coat/bones 그림과 다른 소비자는 이 격리 제작에서 건드리지 않았다.

## 새 좌표의 물성·형태

- **목재:** 벌목된 짧은 두 토막의 절단면·나이테·껍질·결을 그렸다. 뿌리내린 그루터기, 장착 손잡이, 날이나 금속 도구 부착은 없다.
- **고철:** 구멍 있는 부러진 판, 짧게 꺾인 철편, 끊긴 띠를 서로 다른 각도와 녹슨 면으로 그렸다. 완전한 파이프·곤봉·칼·작동 공구를 그리지 않았다.
- **실 꾸러미:** 여러 겹 감긴 실의 평행 결, 간단한 묶음, 풀린 한 가닥을 그렸다. 천 판·옷·바늘·의료 십자가·살균 포장과 구분한다.
- **무두질 가죽:** 두께가 있는 접힌 갈색 가죽, 둥글게 넘어간 윗면, 불규칙한 가장자리·작은 표면 결을 그렸다. 소매·깃·끈·장비 윤곽이 없고 새 옷을 추가하지 않는다.
- **숯:** 식은 탄흑 조각의 각진 절단면·균열·작은 잿빛 모서리를 그렸다. 뼈·해골 형태, 주황 불씨, 불꽃, 발광·열기 효과는 없다.

다섯 물품의 geometry와24색 재질 팔레트는 이번에 새로 작성했다. 기존 타일/음식/무기/가죽옷/도구 geometry를 복사해 색만 바꾸지 않았다. 외부 팩·생성 이미지를 입력·추출·크롭·트레이싱·재색칠하지 않았다. 자체 CC0 일반 Canvas·선·다각형·PNG/SVG·최근접 I/O 코드만 재사용했고 이를 source·계약·라이선스에 공개했다. 제작기는 표준 Python과 포함된 계약만 사용하며 게임/Root를 import하거나 다시 읽지 않는다.

## 픽셀 규격

| stem (`ashveil-hearth-` 다음) | 불투명 경계(포함) | 가로×세로 | native32 / small16 불투명 픽셀 |
| --- | --- | --- | --- |
| `wood` | [3,6,28,29] | 26×24 | 400 / 99 |
| `iron-scrap` | [3,5,26,29] | 24×25 | 376 / 94 |
| `thread` | [4,3,28,29] | 25×27 | 407 / 104 |
| `leather` | [3,5,28,29] | 26×25 | 521 / 129 |
| `charcoal` | [2,4,28,29] | 27×26 | 440 / 110 |

각 stem은 `public/sprites/original/items/`의32×32 PNG/SVG와16×16 `-16.png`를 갖는다. 전체 alpha는0/255, native 외곽은 투명이며 모든 그림의 바닥 끝은30이다. 선택 아트 발점[16,30] / anchor[0.5,0.9375]는 인계 메타데이터일 뿐 런타임 anchor를 바꾸지 않는다.16px은 `(2x+1,2y+1)` 중심 최근접 샘플이다. 각 물품의 실제 칸 크기나 공간 제약을32px frame 크기로 바꾸는 것이 아니다.

`tools/art/material-manifest.fragment.json`은 새 sheets5개와 `[sheet,0,0,32,32]` frames5개만 담는다. 기존키·char·animation·Def patch·별칭·장비 슬롯 변경은 없다. ItemIcon의 기존 `size / max(frame.w,frame.h)` 정사각형 표시 경로에서 쓸 수 있는 원본이며 실제 UI 크기/격자 배치는 Root가 통합 후 검토해야 한다. SVG는 경계 안의 정수 rect이며 폰트·필터·스크립트·외부 참조·삽입 raster가 없다.

## 의미의 한계

보이는 목재 토막·철편·숯의 개수와 감긴 실의 줄 수는 대표 그림 구성이며 실제 더미·투입량·생산량·회수 확률을 뜻하지 않는다. 재료 수량 숫자는 제품 UI가 따로 표시해야 한다. 녹·마모·가죽 결·짙은 숯색은 고정 재질 표현이지 품질·내구·청결·안전·수분량·소독·부패·가열 상태의 정답이 아니다.

원재료를 완성 무기/장착품/의료 도구로 바꾸지 않는다. 새 생산품이나 장비를 등록하지 않으며, 기존 제조·재고·경제·수리·의료·분해·연료·소비·각인 규칙을 구현하거나 검증하지 않았다. 숯이 항상 타는 상태처럼 보이지 않게 열색을 제외했으며 실제 열/연소 판정은 Core가 담당한다.

## 직접 보기·재현·독립 검사

native5장과16px5장,960×352 접촉 시트의 **실제 PNG11장**을 각각 직접 열었다. 잘린 도형이 없고 작은 크기에서도 목재 절단면·녹슨 철편·감은 실·접힌 가죽·탄흑 조각의 구분이 남음을 확인했다. 접촉 시트는 위 표 순서의5열이며 각 native4배, 어두운/밝은 matte 배경의 native32·16, 확대16을 보여 준다. 이미지에 문자·숫자·로고·상태 배지를 넣지 않았다. 실제 게임 화면은 아니다.

```sh
python3 tools/art/draw-material-icons.py --check
python3 tools/art/check-material-icons.py
```

두 검사 모두 통과했다. 재현기는 **19출력 파일**을 쓰지 않고 바이트 비교했다. 독립 검사기는 제작기를 import하지 않고 PNG11개의 CRC·단일 종료 IEND·RGBA8·알파·팔레트·투명여백·경계를 직접 해석하고 SVG5쌍의 모든 픽셀을 비교했다. native/small5종의 서로 다른 이미지,16px 정확 최근접과 재질 색군 유지, 숯의 온색 불씨 없음, 접촉 시트의 **모든 배경/샘플 픽셀**, 생성 참조18파일·제작기·계약 해시도 확인했다. 결과는 `docs/art-material-originals-verification.json`에 있다.

게임 개발 절차의 실제 입력→화면/상태 확인은 Root 통합 후의 별도 작업이다. 여기서는 게임·GPU·브라우저·Type·Full/World·빌드·프로젝트 테스트를 실행하지 않았고 실제 기능 검증을 대체하지 않는다.

## 권리와26파일 인계

새 그림·좌표·팔레트·도구·문서는 **CC0-1.0**으로 상업 이용·수정·재배포·게임/모드/에셋 묶음 포함을 허용하고 추가 허가/표기를 요구하지 않는다. 기존 다른 자산·코드의 권리는 그대로다. 포함된 `LICENSE.txt`를 Root의 **`tools/art/material-LICENSE.txt`**로 복사하면 기존 저장소 라이선스를 삭제·덮어쓰지 않으며 독립 검사기가 그 위치를 지원한다.

`docs/art-material-originals-integrity.json`은 자기 자신을 뺀25파일의 정확경로·바이트·SHA-256·Root복사목적지를 담는다. 목록 자신까지26파일이다. 구성은 native/SVG/small15개, contact/palette/source3개, manifestfragment, generator/checker, referencecontract, license, 한글문서, verification, integrity다. 그릇20파일 팩과 같은 파일/키를 덮어쓰지 않는다. Root/public/manifest/Def/Core/UI/Git·고정299제품은 수정하지 않았다.
