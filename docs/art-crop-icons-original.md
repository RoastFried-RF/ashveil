# ASHVEIL 원본 재배 물품 아이콘 — 그늘 종자·그늘뿌리·흰갓

2026-10-21에 실제 Item ID와 기존 전용/공유 아트를 조사하고, 정확히3종의 새 소지품 원본을 직접 그렸다. **아트와 신규 키 조각 준비 완료, 게임 미등록** 상태다. 파일은 `/workspace/ashveil-crop-art` 안에만 작성했다. 이 기록은 X2 재배 확장 기능 전체의 완료 주장이 아니다.

## 실제 ID와 전용 아트 중복 조사

| 실제 Item | 실제 설명 / 기존 표시 | 신규 제안 frame / sheet |
| --- | --- | --- |
| `Item.ShadeSeeds` | 봉인된 그늘 작물 종자. 종자 금고에 보관된 실제 재배용 종자 **봉지**, place=`Terrain.ShadePlot`; 기존 `cloth` | `original_shade_seeds` |
| `Item.ShadeRoot` | 저조도에서 자라는 검은 잎 식물의 **둥근 뿌리**. `Item.Hardtack`를 상속하고 자체 sprite가 없어 기존 `hardtack` 표시 | `original_shade_root` |
| `Item.Whitecap` | 관로 입구와 어두운 배양목에서 기르는 **흰갓버섯**; 기존 `ash_cap` | `original_whitecap` |

원문은 `blackwood.json`, `whitecap.json`, 부모 `items-consumables.json`에서 확인했다. 셋 모두 해석된 실제 소지품 size1×1이고 stackable/maxStack은 true/5다. 새32px 원본은 실제 칸·스택·내용물 수량을 바꾸지 않는다.

과거 자체 CC0 원본 **`tools/art/ashcap.py`와 `public/tiles/ash_cap.png`가 존재한다**. 이 원본은 잿빛 갓버섯용16×16 도안을32×32로 늘린 두 버섯 구도이며, Whitecap 전용 키는 아니다. 새 Whitecap 전용 원본/키는 조사 시 없었다. 기존 ash_cap 원본을 복제·재색칠하거나 같은 원본을 다시 등록하지 않고, **단일 흰갓버섯의 별도 native32 도형 하나**를 새 좌표로 작성했다. 과거 ash_cap의 코드·파일·키·CC0 표기는 그대로 보존한다.

`tools/art/crop-usage-survey.json`에는 실제3종의 원문/부모 상속, sprite 필드 패치를 반영한 표시 조사, 기존 ashcap 도구/타일 SHA, 기존 전용 키 부재와 판단 이유를 담았다. 실제 DB·월드 실행 없이 현재 Root core 작업본의 단순 부모 필드와 top-level `/sprite` 패치를 읽은 정적 조사다. 미래 게시본의 상태를 주장하지 않는다.

## 공유 소비자와 바인딩 범위

기존 own sprite 원문만 보면 ash_cap 소비자가18종이지만, 현재 core의 sprite 필드 패치를 반영한 소비자는16종이다. 같은 방식의 기존 `cloth` 소비자는17종, `hardtack` 소비자는2종이다. 전체 실제 ID와 각 소스 경로를 조사 JSON에 보존했다.

- `cloth`에는 종자 외에도 천·기록/책·여러 생활 물품이 있다. 새 봉지로 전역 교체하지 않는다.
- `hardtack`는 원래 건빵과 그늘뿌리가 공유한다. 부모 `Item.Hardtack.sprite` 대신 **그늘뿌리 자신의 sprite만** 연결한다.
- `ash_cap`에는 흰갓·잿빛 갓버섯뿐 아니라 잎·이끼·채소·작물 종자 등이 있다. 원래 타일과 다른 소비자를 보존한다.
- `Item.WhitecapCulture`, `Terrain.WhitecapPlot`, `Terrain.ShadePlot`의 배양목/밭 그림은 이번 범위가 아니다. 기존 지상 `mushrooms` 프레임도 바꾸지 않는다.

Root의 적용 대상은 표의 정확히3종 `Item.sprite`뿐이다. 이 패키지는 Def 패치나 설치 명령을 실행하지 않는다.

## 새로운 물성·실루엣

**종자 봉지**는 낡은 저채도 리넨빛의 평평한 작은 봉지와 접어 닫은 입구·간단한 결합끈·옆 솔기로 그렸다. 실제 설명에 있는 봉지 형태를 따른다. 씨앗을 밖에 펼쳐 정확한 알 수를 암시하거나, 성장하는 새싹·발아율·등급 도장·문자·금고 문양을 추가하지 않았다. 닫힌 접힘은 기본 물품 이름의 시각 해석이며 seed lot의 품질/오염/보증 상태를 나타내지 않는다.

**그늘뿌리**는 둥근 회갈색 뿌리와 가는 뿌리 끝, 짧은 검은 잎 줄기/잎의 재질로 그렸다. 검은 잎 식물이라는 실제 설명을 따르며 단순 건빵·감자 타일로 읽히지 않도록 구분했다. 뿌리 껍질의 작은 결은 음식 상태·병반·오염 판정이 아니다. 잎의 형태·빛깔은 수확량이나 성장 단계 표시가 아니다.

**흰갓**은 넓고 밝은 상아색 갓·짧은 줄기·자연스러운 아래 주름을 가진 하나의 버섯으로 그렸다. 옛 ash_cap의 큰 버섯+작은 버섯 구도를 추출/변형하지 않았다. 적색 독표식·발광·효능 십자·안전 보증 표시는 없다. 실제 날것/식중독·영양·신선도·오염 규칙은 기존 상태와 코드가 담당한다.

CANON과 world-bible의 어둠 재배 흰갓, 검은 숲 그늘 농사, factions의 종자 금고/지상 은둔 지파 생활을 읽었다. 기존 물 용기·목제 보관함 계열과 같은 자체19색 저채도 재질 팔레트를 사용했다. 봉지 재질과 껍질·갓의 세부 곡선/색은 시각 해석이며 새 재질/품종/효과 설정이 아니다.

외부 에셋·기존 공유 타일·생성 이미지를 입력·추출·크롭·트레이싱·재색칠하지 않았다. 자체 표준 라이브러리 캔버스·PNG/SVG·문자 출력 코드를 재사용했고 세 물품의 모든 새 도형은 직접 정수 좌표로 작성했다. 프로젝트용 자체 원본이며 프로젝트와 같은 사용 조건으로 제공한다.

## 파일·픽셀 규격

| 제안 키 | PNG / SVG 이름 | 원본 불투명 경계 |
| --- | --- | --- |
| `original_shade_seeds` | `ashveil-shade-seeds` | `[5,5,25,28]` |
| `original_shade_root` | `ashveil-shade-root` | `[4,3,27,29]` |
| `original_whitecap` | `ashveil-whitecap` | `[3,6,28,28]` |

원본은 각각32×32 RGBA이며 알파0/255와 투명 여백을 갖는다. 같은 이름 SVG는 동일한 정수 rect 픽셀의 편집 원본이다. `*-16.png`는 `(2x+1,2y+1)` 중심 최근접 샘플을 사용한 작은 아이콘 검토 자료다. 실제 Item.size나 sprite 등록 크기를 바꾸지 않는다.

`ashveil-crop-contact.png`는576×376 px 검토 시트다. 각 물품의 원본4배, 밝고 어두운 배경의 native32/16, 작은16px의4배를 제공한다. 품질·효능·역가·발아율·성장률·오염 정답·청결·신선도·스택 수량 뱃지는 없다.

## 재현과 실제 검사

```sh
python3 tools/art/draw-crop-icons.py
python3 tools/art/draw-crop-icons.py --check
python3 tools/art/check-crop-icons.py
```

제작기는 MAIN을 import하거나 다시 읽지 않고 포함된 조사 snapshot과 좌표로 자신의14파일을 생성한다. `--check`는 저장 바이트를 비교하고 파일을 쓰지 않는다. 별도 독립 검사기는 제작기를 import하지 않고 PNG CRC·RGBA를 직접 디코딩한 뒤 SVG rect를 독립 래스터화한다.

최종 native32 PNG3개·16px PNG3개·contact 총7개를 `view_image`로 각각 실제 열었다. 닫힌 봉지, 둥근 뿌리와 짧은 잎, 흰갓의 서로 다른 실루엣과 작은 크기 가독성을 확인했다.

결과는 `docs/art-crop-icons-verification.json`에 있다.

- 생성14파일 결정적 바이트 재현 `PASS`.
- PNG/SVG3쌍 전 RGBA 픽셀·CRC·알파0/255·19색 범위 `PASS`.
- 서로 다른 이미지3개·불투명 경계·투명 외곽 `PASS`.
- 16px 중심 최근접 샘플의 원본 대응 `PASS`.
- 실제3개 ID·해석 size1×1·기존 전용 키 부재·새키3개만 포함·출처 SHA `PASS`.
- 기존 ash_cap 원본 존재와 전역 공유 영향, 현재 core sprite 패치 후 소비자17/2/16종 조사 `PASS`.

`tools/art/crop-manifest.fragment.json`에는 새 sheet/frame3개씩만 있고 기존 키·char·animation은 없다. Root/Core/공용 manifest/Def/Git·기존 코드·원본 타일은 변경하지 않았다. 브라우저·GPU·프로젝트/무거운 검사는 실행하지 않았다. 이 아트만으로 전체 X2 재배·오염·수확·저장 기능이 검증됐다고 표시하지 않는다.

## SHA-256

- `tools/art/draw-crop-icons.py`: `881319fb9098c83bed670f7a63fd2e181c3549adee70b135684dfbf04e4007b5`
- `tools/art/check-crop-icons.py`: `7cb0d837ac32d1330edc50c4d514868be9e94588c0d3b8132c6618c8c1b0fdd1`
- `docs/art-crop-icons-verification.json`: `5d1ebf313dcd35ff2dd4cf5e41a173c29a461f003e65d6817a2f0d8cca7bfca3`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/items/ashveil-shade-seeds.png` | 271 | `17d6827248e17b93f3e2f554def2fde7fab7fb8f29a8744ce6b878e5ee141629` |
| `public/sprites/original/items/ashveil-shade-seeds.svg` | 9366 | `2007955edb444ee2621eb7d661f39fdef91a3363b97940da8a6271711a4ee87d` |
| `public/sprites/original/items/ashveil-shade-seeds-16.png` | 166 | `43e1ad24ab2de3609abe29b2850878a07758e2f2d474060806442be790f418c3` |
| `public/sprites/original/items/ashveil-shade-root.png` | 316 | `918b86cfc7fec4afc29f4e5d16a6577a7901dc0813ebd946b185d407f8e87e89` |
| `public/sprites/original/items/ashveil-shade-root.svg` | 9075 | `cef64c28d09831c48eaa3f21930f79a6680144170e9ee56141f4794c6d4a9214` |
| `public/sprites/original/items/ashveil-shade-root-16.png` | 175 | `9836736018d4d5a208e19a4b562c323b6d265748c268fb4826f8035f74e3528c` |
| `public/sprites/original/items/ashveil-whitecap.png` | 254 | `01f2ab067826e477221e3f4915f34e2e39cc6b1bf4efa93d981e7ce70ed7f8aa` |
| `public/sprites/original/items/ashveil-whitecap.svg` | 6701 | `1bb17d7c044368facc1565f156cefb107890868661ffe22648e3403b3cfcef05` |
| `public/sprites/original/items/ashveil-whitecap-16.png` | 156 | `de38917b4544f0e6dddb5b8e03802e99d6ce00b88bfc13a66c9fdc61e9fc6f65` |
| `public/sprites/original/items/ashveil-crop-contact.png` | 7117 | `4de9b21146c4555793b716ea29a97af0a13c68a107d68577d01214bfaf541c7f` |
| `public/sprites/original/items/ashveil-crop-palette.json` | 345 | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |
| `tools/art/crop-manifest.fragment.json` | 569 | `53a2e3dc2803bef4f15ae6c55fbf922f283108d5b2c7ec20db990083964558bf` |
| `tools/art/crop-usage-survey.json` | 14431 | `a411a15a54295f10289976471d3308cef8bd4bbd43c950684ea9ab21ae3018f0` |
| `public/sprites/original/items/ashveil-crop-source.json` | 3986 | `dbb0781ec87df738d1275affac9c2b331521fda5b974943b1e7ae98535875b5f` |

## Root 통합 기록

2026-10-21 Root에서 격리 원본을 바이트 그대로 복사하고 세 신규 키만 등록했다. crop-icons-original.json은 Item.ShadeSeeds/Item.ShadeRoot/Item.Whitecap의 sprite만 바꾼다. 기존 cloth/hardtack/ash_cap 공유 원본과 다른 소비자는 보존한다. 위 미등록 표현은 제작 단계의 기록이며 실제 게임 검증은 별도291 기록에 남긴다.
