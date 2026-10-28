# 철판 마체테·무열매 잿딸기 가시관목 원본

2026-10-21 제작. `/workspace/ashveil-brush-art`에만 만든 격리 아트다. 새 정수 좌표의32×32 PNG/SVG 두 종류와16px검토형을 제공하며 **게임 미등록** 상태다. Root의 Core·Def·기존 자산·공용 manifest·Git은 변경하지 않았다. 정본 design/13의 실제 마체테/덤불 후속 작업을 위한 그림 준비이며, 덤불 베기 기능이나 드롭·생태·전투 규칙을 구현한 결과가 아니다.

## 실제 대상과 새 키

| 실제 대상 | 기존 실제 표시 | 새 sheet/frame | 규격 |
| --- | --- | --- | --- |
| `Item.Machete` 철판 마체테 | 자체 sprite=`machete`; 실제 재질 `Material.Steel` | `original_sheet_machete` |32×32,물품점유1×3 |
| `Terrain.AshBerryBush` 잿딸기 덤불 | `visual.sprite=mushrooms`,scale.35,tint0xb76e82 | `original_ashberry_bush` |32×32,월드물체용 |

마체테는 실제 "개척기 농기구를 갈아 만든 칼" 설명에 맞춰 넓고 납작한 강철 날·닳은 단날 가장자리·짧은 어두운 손잡이를 새 다각형/선으로 그렸다. 기존 좁은 녹슨 칼이나 타사 칼의 도안을 추출·재색칠하지 않았다. 손잡이 색/작은 고정점은 시각 해석이며 새 재질·성능·내구도·독·품질을 등록하지 않는다. 피·발광·마법·업적 문양은 없다. 실제1×3의 배낭 사각형은 현 UI CELL38에서36×112px이며 아이콘은32px라 정적으로 들어간다. 장착/베기/회전의 실제 UI 검증은 하지 않았다.

관목은 작은 잎이 남은 여러 줄기의 가시와 회갈색 가지·뿌리를 직접 그렸다. **열매와 꽃을 그리지 않았다.** 분홍/빨강 열매 알갱이·수확 수량·성숙 도장·잘린 그루터기·바닥 드롭을 넣지 않았다. 이 단일 정지 실루엣을 겨울/미성숙에도 사용할 수 있지만, 겨울에 반드시 잎이 남는다는 생태 설정이나 여름 열매가 실제로 존재/성숙했다는 표시가 아니다. 상태 판단은 기존 Core/UI에 남긴다. 가시와 작은 잎의 수 역시 물품/드롭 수량이 아니다.

기존 자체 원본의 일반 Canvas·PNG/SVG·작은 폰트·검토 시트 출력 도우미와19색 재질 팔레트를 재사용하고, 잿빛 잎의 낮은 채도3색을 더해22색으로 구성했다. 새 두 그림의 도형은 모두 새 좌표다. 외부/기존 PNG 입력·추출·크롭·트레이싱·재색칠이 없으며 기존 `mushrooms`나 `machete` 타일을 수정하지 않았다.

## 실제 관목 renderer 계약과 권고

원문 Def와 현재 renderer의 읽기 전용 조사/출처SHA는 `tools/art/brush-reference-contract.json`, 권고만 담은 메타데이터는 `tools/art/brush-render-recommendation.json`에 있다. 이 두 파일은 **실행할 Def/패치가 아니다.** Root가 최종 코드/JSON 패치와 실제 화면 검증을 담당한다.

현재 `MapRenderer`의 `terr.visual` 분기는 다음 표시 규칙을 사용한다.

- 월드타일16px, anchor=`[.5,.96]`, position=`[tile.x×16+8,tile.y×16+16]`.
- 기본 배율은 `terr.visual.scale`이며, gather대상이 `cultivation.growth < regrowTurns` 또는 `gatherAt > 현재턴`일 때 기존×.6이 추가된다.
- **겨울이라는 이유만으로 ×.6을 고르는 규칙은 아니다.** 계절 가능 여부와 남은 재생 시간은 다르다.
- `visual.tint`가 있으면 그대로 곱한다. zIndex는 `tile.y×16+16−.5`다.
- 바닥은 surface의 기존 grass/dirt 선택을 쓰며 이 새 그림에 바닥/그림자를 굽지 않았다. 시야·이동·물리 충돌·수확 판정은 바꾸지 않았다.

기존 `mushrooms`는80×64프레임이며 불투명 경계는 양끝 제외 `[12,12,69,52]`다. scale.35에서 전체프레임은28×22.4월드px, 실제 불투명 부분은약19.95×14월드px다. 새32px에 .35를 무작정 남기면 전체가11.2×11.2월드px로 작아진다.

아트 메타데이터의 **권고 기본 배율은 .7**이다.32×.7=22.4로 이전 전체프레임의 세로 크기를 유지하며, 실제 새관목의 불투명30×30영역은21×21월드px가 된다. 따라서 실제 가지는 이전 버섯 장식보다 세로로 크고 땅 가까이에 보일 수 있다. 같은 크기라고 단정하지 않는다. 기존×.6재생 축소를 유지하면 유효배율.42, 전체13.44×13.44월드px·불투명12.6×12.6월드px다. 이는 미성숙 상태를 새로 정의하거나 성장 속도를 바꾸는 제안이 아니다.

새 관목은 마지막 불투명 행30, 뿌리 아래 모서리31이다. 고정 `.96×32=30.72` 앵커보다 아래 모서리가 native.28px 내려온다. 권고.7에서 차이는약.196월드px다. 기존 anchor/position을 바꾸지 않고 뿌리를 지면 근처에 놓기 위한 아트 배치이며 후속 실제 화면에서 검증해야 한다. 별도 충돌/히트박스 메타데이터는 없다.

기존 분홍 tint0xb76e82는 새 잿빛 가지/잎을 위해 **삭제하거나0xffffff로 중립화하는 것을 권고**한다. 새 그림에 저채도 재질색이 이미 있으므로 분홍색을 유지한 결과까지 원본과 같다고 하지 않는다. Root는 최종 배율/tint를 선택할 수 있으며 이 묶음은 실제 Def 변경을 하지 않는다.

수확량·재생시간·계절생산·덤불 생성률·베기 시간/공격력·도구 소모·드롭 확률·추가 NPC/종/생태 수치는 만들지 않았다. 실제 여름 한정/수확 물품 등은 기존 원문 조사 근거일 뿐 변경 대상이 아니다.

## 파일·픽셀 계약

| 파일 | 내용 |
| --- | --- |
| `public/sprites/original/items/ashveil-sheet-machete.png` / `.svg` | 철판 마체테32×32 원본 |
| `public/sprites/original/items/ashveil-ashberry-bush.png` / `.svg` | 무열매 가시관목32×32 원본 |
| 각 `*-16.png` | `(2x+1,2y+1)` 중심 최근접16px검토형;게임 등록용 별도frame아님 |
| `ashveil-brush-contact.png` |384×376,4배/32·16px/밝고어두운배경 비교 |
| `ashveil-brush-palette.json` |22색팔레트,알파0/255 |
| `ashveil-brush-source.json` |제작소스/조사·권고/산출물SHA·경계·권리 |
| `tools/art/brush-manifest.fragment.json` |새sheet2개/frame2개뿐;chars/anims/Def/patch없음 |
| `tools/art/draw-brush-originals.py` |직접새좌표제작과읽기전용`--check` |
| `tools/art/check-brush-originals.py` |제작기를import하지않는독립PNG/SVG/계약검사 |
| `tools/art/brush-reference-contract.json` |원문/renderer계약·출처SHA스냅샷 |
| `tools/art/brush-render-recommendation.json` |표시권고만담은메타데이터 |
| `docs/art-brush-originals-verification.json` |실행한독립검사PASS기록 |
| `docs/art-brush-originals-integrity.json` |문서/도구/권리를포함한최종파일해시 |
| `LICENSE.txt` |CC0-1.0선언 |

두PNG는RGBA8/알파0·255이며 외곽 한 줄이 투명하다. 불투명 경계는 양끝 포함 마체테 `[3,2,28,29]`/265px, 관목 `[1,1,30,30]`/443px다.16px에는 각각68/113불투명px가 남는다. 원본32와16은 실제 게임 scale.7나 조명·시야·tint를 재현한 스크린샷이 아니라 독립 원본 검토 자료다.

## 실행한 아트 검사와 한계

```sh
cd /workspace/ashveil-brush-art
python3 tools/art/draw-brush-originals.py --check
python3 tools/art/check-brush-originals.py
```

- 생성10파일 정확 재현 PASS.
- PNGCRC·단일종료IEND/32×32RGBA·SVG전픽셀2쌍·알파0/255·22색범위·외곽투명/경계 PASS.
- 두 원본의 RGBA가 서로 다름·16px중심최근접대조 PASS.
- contact의모든그림4배/native32/16px및밝고어두운배경 픽셀대조 PASS.
- source가담은9파일 해시·제작소스SHA와조사/권고메타데이터SHA PASS.
- 실제 contact와32px2장/16px2장, 총5PNG를 `view_image`로 각각 직접 열어 넓은 농기구날과 열매 없는 다중 줄기/작은잎 실루엣을 확인했다.

과거그림·MAIN·Def·공용manifest·Git변경이나 GPU/브라우저/Full/type/Root빌드·게임실행은 하지 않았다. 이 그림만으로 실제베기 기능/수확/재생/계절/드롭/현재월드가 검증되었다고 주장하지 않는다.

## CC0와 대표 SHA-256

새 원본·좌표·팔레트·출력/검사 도구·문서는 **CC0-1.0**이다. 상업 이용·수정·재배포·2차 게임/모드/에셋 패키지 포함을 허용하고 허가/출처표시를 요구하지 않는다. 기존 외부 게임 코드/이미지는 이 권리 선언 대상이 아니다. Root에 복사할 때는 기존 루트 라이선스를 덮어쓰지 않고 이 선언을 `tools/art/brush-LICENSE.txt`로 정확히 보존할 수 있다. 검사기는 그 파일이 있으면 우선 읽고 격리본에서는 루트 `LICENSE.txt`를 읽는다.

| 파일 | SHA-256 |
| --- | --- |
| 마체테PNG | `d6de79b2f34e76e6b22c4287073f3961c1bc6032e1eeb87cd3c2167b3681a6e1` |
| 관목PNG | `110c1c88a48466c6cbc1ee514cf578d2267f1b44f05b27fb9e56514a31b23414` |
| 접촉시트 | `bca36e8b8276e0c4ddc2b423ff10dbdec16ba01f6386ec16d3a86c9f6cf92d85` |
| 조각JSON | `61f4fe98788ea3b2a32502539e46655124821ec9d7582fc5caa23c4ae0064680` |
| 제작소스 | `76f58704005e5d911453e0b3fad22ca145049ddd9b013604da4f8d9b969a97aa` |
| 독립검사기 | `18aae48805df1b824dfdc4a9fad9a1d9a123e62ec7fad3bb00ef65aeb6fd7fe2` |
| 권리선언 | `e317eaccda376cb7cb0c8b3845310eeb25042e6dc3fd0fcdc8772aeb149f0c07` |

## v0.296 Root 통합 작업 중

격리18파일을 정확 복사했고 권리 선언만 tools/art/brush-LICENSE.txt로 옮겼다. 새sheet2/frame2를 기존 manifest에 추가했다. 실제원문 Item.Machete.sprite와 Ab.Blade.DeepCut.icon, AshBerryBush의 ownsprites/ownvisual만4패치로바꾸었다. visual.scale.7/분홍tint삭제로원본잿빛가지와잎을읽는다. 기존몸/전투/수확/재생/계절을아트패치에서바꾸지않는다. 별도 brush-clearing 규칙과 실제화면/골든/전체검증은진행중이다.
