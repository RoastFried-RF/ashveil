# ASHVEIL 원본 귀리밭

2026-10-21 제작. `/workspace/ashveil-oat-plot-art` 안에만 작성한 **1프레임 지형 아트14파일**이다. 앞서 완성한 `/workspace/ashveil-oat-art`의17파일 귀리 물품 팩과 별개이며 그 팩과 Root는 수정하지 않았다.

## 대상과 새 도형

대상은 `Terrain.OatPlot`의 현재 임시 `mushrooms` 표시다. 새 키는 **`original_hearth_oat_plot`**. CLAUDE/CANON의 낡은 저채도 재질 기조를 읽고, 불규칙한 흙고랑 위에 **뿌리내린 세 줄기와 가지마다 처진 귀리 이삭**을 새 정수 좌표로 그렸다. 세 줄기의 밑부분이 흙덩이에 이어지고 회록색의 가는 잎과 바랜 짚빛 곡립이 성숙한 작물로 읽히도록 했다. 버섯 갓·굵은 나무줄기·나무 수관·독립된 곡물 pile은 없다.

자체 CC0 일반 Canvas/PNG/SVG/최근접 샘플 코드와 귀리 물품 팩의18색 재질 팔레트는 재사용했다. **기존 알곡/주머니/이삭 도형이나 이미지 픽셀을 복사·확대·재색칠하지 않았고**, 땅에 자란 작물·흙·잎·이삭의 좌표는 이번에 새로 작성했다. 외부 이미지 입력, 추출, 트레이싱, 생성 이미지 편집은 없다. 제작기는 표준 Python과 포함된 계약만 사용하며 Root나 게임 코드를 import하지 않는다.

## 규격과 실제 렌더러 맥락

| 항목 | 값 |
| --- | --- |
| 새 sheet/frame | `original_hearth_oat_plot` |
| 원본 PNG/SVG | 32×32 |
| 작은 검토 PNG | 16×16, 중심 최근접 `(2x+1,2y+1)` |
| 불투명 경계(포함) | [2,2,28,29] |
| 불투명 가로×세로 | 27×28 |
| 불투명 픽셀 | native427 / small102 |
| 팔레트·알파 | 18색, RGBA8, alpha0/255, 외곽 투명 |
| 바닥 끝 / 선택 아트 발점 | 30 / [16,30] |

파일 stem은 `public/sprites/original/terrain/ashveil-hearth-oat-plot`이다. `tools/art/oat-plot-manifest.fragment.json`은 새 sheet1개·전체32px frame1개만 제공한다. 캐릭터·애니메이션·Def 패치·성장 단계 필드·UI 함수는 없다.

읽기 시점의 `MapRenderer.ts` visual 경로는 anchor **[0.5,0.96]**, 타일 기준 위치 **[8,16]**이고, `terr.visual.scale`에 성숙1 / 성장 중0.6을 곱해 **전체 그림**을 그린다. 성장 중은 cultivation이 있으면 `growth < regrowTurns`, 없으면 `gatherAt > turnOf(w)`로 판정한다. tint가 있으면 전체 아트에 적용한다. 실제 OatPlot 원문은 `mushrooms`, scale0.3, tint11704912를 쓴다. 원문과 렌더러 SHA는 로컬 계약에 캡처했다. 모든 모드/패치를 적용한 실제 Def DB 실행 결과는 아니다.

**Root 적용용 권고만:** 새32px을 그대로 scale0.3으로 쓰면 전체9.6px로 작아진다. base scale0.65는 전체20.8×20.8px, 실제 불투명17.55×18.2px로16px 옆 타일에 약간 걸치는 작물 폭이다. 성장 중 배율0.6 적용 시 scale0.39, 전체12.48×12.48px / 불투명10.53×10.92px가 된다. 원본 재질색을 쓰려면 이전 버섯 tint를 제거하거나 흰색으로 둔다. 이는 계약의 `recommendationOnly` 기록으로 **실제 Def 패치가 아니다**. Root가 최종 장면에서 간격과 대비를 검토해야 한다.

선택 발점 [16,30]과 기존 renderer의32px anchorY30.72에는0.72px 차이가 있다. 기존 anchor를 유지하면 그림의 바닥 끝은 위치보다0.72native px 위, 권고 scale0.65에서0.468world px 위에 놓인다. 앵커를 임의로 바꾸지 않았다. 큰 tile/grid·Core·클릭 규칙도 그대로다.

## 직접 보기와 재현 검사

실제 native32,16small,384×352 접촉 시트의 **PNG3장**을 직접 열었다. 세 가닥의 얇은 줄기·처진 곡립과 흙고랑이 확인되고 잘린 도형은 없다. 접촉 시트 왼쪽은 native32, 오른쪽은19×19 축소 검토본이다.19px은32×0.6=19.2의 **근사**이며 실제 렌더러의 소수 배율 raster/월드광원/합성 결과가 아니다. 둘 다 어두운/밝은 배경과16px을 함께 보여 준다. 두 축소 크기에서도 밝은 이삭과 회록색 줄기·뿌리의 군집이 남는다. 문자·숫자·로고·상태 뱃지를 렌더하지 않았다.

```sh
python3 tools/art/draw-oat-plot.py --check
python3 tools/art/check-oat-plot.py
```

재현7출력 바이트 비교와 별도 독립 픽셀 검사 모두 통과했다. 독립 도구는 제작기를 import하지 않고 PNG3개의 CRC·단일 종료 IEND·RGBA8·알파·18색·투명 여백·경계, SVG와 native 전 픽셀 일치,16px 중심 최근접,19px 근사 검토본, 접촉 시트 **전체 픽셀**, 생성 참조6파일 및 제작기·계약 SHA를 확인했다. 결과는 `docs/art-oat-plot-original-verification.json`이다.

## 권리·인계 범위

새 아트·좌표·팔레트·도구·문서는 **CC0-1.0**이다. 상업 이용·수정·재배포·게임/모드/에셋 팩 포함을 허용하고 별도 허가나 저작자 표기를 요구하지 않는다. 기존 프로젝트 자료의 권리는 그대로다. `LICENSE.txt`는 통합 시 **`tools/art/oat-plot-LICENSE.txt`**로 복사하면 원래 저장소 라이선스를 보존할 수 있고 검사기도 이를 지원한다.

`docs/art-oat-plot-original-integrity.json`은 다른13파일의 정확한 경로·바이트·SHA와 복사 목적지를 기록한다. 목록 자신을 포함해14파일이다. 구성은 PNG/SVG/small/contact/palette/source6개, manifest조각, 제작기, 검사기, 계약, CC0, 한글문서, 검사결과, 해시목록이다. 별도 귀리17파일 팩과 경로·키가 충돌하지 않는다.

Root/public/manifest/Def/Core/Git, 기존17파일 팩, 게임 엔진·성장 필드·수확/파종/생산/균형은 변경하지 않았다. 세 줄기와 일곱 이삭은 그림 구성이며 실제 개체수·수확량·성장 완료·품질·발아율을 보장하지 않는다. 기존 단일 그림이 성장 중 작아지는 경로에 쓸 자료일 뿐 별도 어린 작물 단계를 구현하지 않았다. 게임·GPU·브라우저·Full/World·Type·빌드 검사는 실행하지 않았고 실제 플레이 결과는 아직 검토하지 않았다.
