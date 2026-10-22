# v0.303 — 먹색 철·해진 양피지 UI 26개 원본

`docs/art-direction-v303.md`와 `tools/art/direction-v303/baseline-registry.json`의 UI 등록 26개를 기준으로 전부 새로 그렸다. 청록 카드, 중앙의 규칙적인 점, 원형 선택 점을 제거했다. 구조를 새로 설계한 닳은 철 레일·작은 황동 고정구·어둡게 들어간 슬롯·가장자리가 해진 기록지를 사용한다. 기존 도형의 팔레트만 바꾼 작업이 아니다.

## 실제 참고 검토와 적용

`test-results/references-v303/`의 **공식 Steam 이미지 12개 전부**를 `view_image`로 직접 열었다: `fear-hunger-0/1/2.jpg`, `stoneshard-0/1/2.jpg`, `darkwood-0/1/2.jpg`, `darkest-dungeon-0/1/2.jpg`. 공식 URL·SHA는 [references.json](../tools/art/direction-v303/references.json)에 있다. 참조 파일은 분석용이며 생성기는 참조 이미지를 열지 않는다. 이미지의 픽셀·배치·테두리 문양·고유 표장을 복제하거나 추적하지 않았다.

| 실제 관찰 | 이번 원화에 적용한 원리 |
| --- | --- |
| F&H의 전투 화면은 검은 명령창과 밝은 문자, 얇게 끊긴 회색 선으로 수치가 읽힌다. | 패널 중앙을 먹색 평면으로 두고 짧고 마른 철 반사선만 둘레에 배치. |
| Stoneshard의 하단 HUD는 어두운 슬롯 중앙과 명확한 금속 틀·붉은색/파랑 막대를 구분한다. | 슬롯 안을 깊게 비우고 상태 프레임과 실제 비율 채움을 별도 레이어로 유지. |
| Darkwood의 대화는 어두운 여백과 작은 밝은 글자로 읽히고 도구 슬롯도 단순하다. | 큰 중앙 장식·녹색 코팅을 없애고 글자와 물품이 차지할 면적을 확보. |
| Darkest Dungeon의 인물창은 검은 칸, 메마른 선, 부분적으로 강조한 황동으로 정보를 묶는다. | 큰 금색 프레임 대신 고정구와 선택 모서리에만 황동·골백색 사용. |

## 원본 파일과 재현

- 생성기: [draw-ui.py](../tools/art/direction-v303/draw-ui.py).
- 연결: [ui.fragment.json](../tools/art/direction-v303/ui.fragment.json). 최상위 `ui` 객체는 **기존 26개 key → 새 상대 URL**이며 새 frame/sheet 키가 없다.
- 게임 PNG: [`public/sprites/original/direction-v303/ui/`](../public/sprites/original/direction-v303/ui/), `{기존key}.png` 26개.
- 편집 가능한 좌표 원본: 같은 폴더의 `source/{기존key}.svg` 26개. PNG와 같은 직접 저작 정수 사각형 연산을 SVG `<rect>`로 기록했다. 내장 래스터·폰트·이미지·필터·외부 링크가 없다.
- 감사표: [review/ui-audit.json](../public/sprites/original/direction-v303/ui/review/ui-audit.json). 각 파일의 전체 SHA-256, 기존 SHA, 치수, source SVG SHA, slice, 투명 중앙, SVG/PNG 일치를 기록했다.

```sh
python3 tools/art/direction-v303/draw-ui.py
python3 tools/art/direction-v303/draw-ui.py --check
```

생성기는 표준 Python만 사용한다. 새 Canvas에 직접 지정한 정수 좌표의 사각형과 선을 그린다. 기존 PNG 바이트는 SHA와 IHDR 치수 대조에만 읽고 픽셀을 디코딩하거나 재사용하지 않는다. 새 source SVG와 PNG를 각기 작성하고, 별도 XML 파서로 SVG 사각형을 다시 채운 픽셀과 새 PNG의 IDAT 해제 픽셀이 같은지 검사했다.

## 26개 전체 기하·슬라이스 계약

기존 모든 캔버스 크기·UI 키·slice를 유지한다. `olive`와 `celtic`은 기존 호환키 이름이다. 새 `olive` 계열은 녹색이 아니라 그을린 갈색 가죽·먹색 철이다.

| 등록키 | 크기 | source slice | 중앙 및 구성 |
| --- | --- | --- | --- |
| frame | 96×96 | 6px | L자 철 고정구·작은 황동 못, 먹색 중앙 |
| parchment | 96×96 | 6px | 접힘과 짧은 섬유 찢김, 낡은 종이 중앙 |
| celtic | 72×72 | 6px | 무딘 절단 철 모서리, 먹색 중앙 |
| celtic2 | 72×72 | 6px | 가죽 밑띠·짧은 철 고정구, 따뜻한 먹색 중앙 |
| btn, btn_olive, btn_sel | 64×32 | 4px | 철판 / 가죽띠 / 골백 선택선 |
| slot, slot_olive, slot_sel | 32×32 | 4px | 깊은 슬롯, 선택 시 서로 마주 보는 모서리 걸쇠 |
| tab, tab_olive, tab_sel | 32×32 | 4px | 잘린 상단 rail, 선택 시 상단 골백선 |
| bar_frame, bar_frame2 | 96×16 | 3px | 철 rail 2종, **중앙 완전 투명** |
| bar_frame_gold | 96×24 | 4px | 작은 황동 고정구, **중앙 완전 투명** |
| bar_blue, bar_red, bar_green | 96×8 | 없음 | 모든 열 동일, 8px 색띠, 임의 비율 폭에 안전 |
| warn | 32×32 | 없음 | 검은 철 경고 태그와 느낌표 |
| xmark | 32×32 | 없음 | 두 개의 닳은 대각선, 실제 획은 약 14px |
| diamond, diamond_dim | 32×32 | 없음 | 속이 빈 못 고정 마름모, 활성 시 작은 종이 조각 |
| ornament | 64×32 | 없음 | 구부러진 고정 철사와 기록철 못 |
| divider | 96×16 | 없음 | 부분적으로 마모된 철 구분선 |
| parchment_small | 64×32 | 4px | 작게 해진 기록지 |

패널·컨트롤·종이는 `border-image-slice: <slice> fill; border-image-width: <slice>px; border-image-repeat: repeat` 계약이다. source 중앙은 **균일한 한 색**이며 어떤 폭·높이로 반복해도 점무늬·내부 격자·장식 이음이 생기지 않는다. 마모와 고정구는 각 source slice 안에 있다. CSS의 기존 border-width·padding·요소 크기와 닫기 hitbox를 바꾸지 않아도 연결할 수 있다.

막대 프레임은 `fill`을 사용하지 않는다. `Bar.vue`의 자식 채움 위에서 `::after`로 프레임만 그리며 `pointer-events: none`을 유지한다. 실제 value/max/ghost/cap와 색약 팔레트의 inline fill은 그대로 유지한다. 새 red/blue/green PNG는 호환 등록 원본이며 필요하면 기본 팔레트에서만 선택적으로 사용할 수 있다. 색약 사용자 지정색을 이미지로 덮지 않는다. 녹색은 녹색 정보 막대에만 있으며 일반 UI 바탕에는 없다.

닫기 원본은 32px 그림을 현재 28px `window-close-mark`에 표시하는 기존 계약에 맞는다. 그림은 hit target이 아니며 버튼의 기존 접근 가능한 이름과 28px 클릭 영역을 유지한다. 프레임의 중앙과 얇은 구분선도 클릭을 가로채지 않는다.

## Root의 CSS 적용에 맞춘 색상 제안

공용 CSS·HUD·Title·App·manifest는 이 담당자가 수정하지 않았다. 현재 CSS의 `--ui-*` URL 주입 방식과 6/4/3px 슬라이스 규칙을 그대로 쓰고 fragment의 URL만 통합할 수 있다. CSS 배경이 원화 밖에서 드러나는 곳은 아래 중성색을 권장한다.

| 용도 | 색상 |
| --- | --- |
| 바깥 먹 / ash950 | `#0d0d0f` |
| 패널 먹 / ash900 / ui-surface | `#19191b` |
| 그늘 / ash800 | `#29282a` |
| 철 rail / ash700 | `#363536` |
| 흙빛 선 / ash600 | `#49413b` |
| 돌 / ash500 | `#68645c` |
| 닳은 글자 / ash400 | `#969080` |
| 천 / ash300 | `#a69a7b` |
| 본문 골백 / ash100 | `#ded3b5` |
| UI 철선 / ui-line | `#414143` |
| 절제 황동 / ui-bronze | `#88714a` |
| 양피지 / 종이 본문 | `#c7b796` / `#292623` |

원본 색의 명암비는 본문 골백/먹색 **11.78:1**, 닳은 재색/먹색 **5.52:1**, 종이 본문/양피지 **7.62:1**이다. 실제 한국어 글꼴·반투명 레이어·초점/hover·색약 설정은 Root의 실제 화면 통합 검토 대상이다.

## 직접 연 연락판과 모의 조합

최종 PNG를 아래 **5개 모두 직접 `view_image`로 열어** 새 먹색 기조, 정보 대비, 얇은 슬롯 선, 종이 테두리, 선택 걸쇠를 확인했다. 4개 연락판은 전체 26개를 3배 정수 확대하고 이름과 치수를 표시한다.

- [패널 4개](../public/sprites/original/direction-v303/ui/review/contact-panels.png)
- [버튼·슬롯·탭 9개](../public/sprites/original/direction-v303/ui/review/contact-controls.png)
- [막대 프레임·채움 6개](../public/sprites/original/direction-v303/ui/review/contact-bars.png)
- [기호·기록지 7개](../public/sprites/original/direction-v303/ui/review/contact-signs.png)
- [9분할 실제 모의 조합](../public/sprites/original/direction-v303/ui/review/mock-panels.png)

모의 조합에는 철 패널, 36칸 소지품, 선택 슬롯, 3종 탭/버튼, 실제 퍼센트 폭의 붉은/파랑/녹색 채움, 프레임, 양피지 문단, 닫기, 기호, 하단 10칸과 키 힌트를 배치했다. 중앙에 v302의 반복 점이나 선택 슬롯 내부 교차선이 생기지 않는다. 검토용 영문 비트맵 글자와 물품 자리표시자는 생성기의 자체 좌표이며 게임 원화·상태로 등록하지 않는다. 이 이미지는 브라우저나 실제 게임 입력 결과라고 주장하지 않는다.

## 결과와 적용 범위

등록키 **26/26**, 기존 치수 일치 **26/26**, baseline 대비 PNG 해시 변경 **26/26**, 서로 다른 새 PNG 해시 **26개**, PNG 원화 합계 **4,950 bytes**. source SVG **26/26**의 좌표 경계와 새 PNG 픽셀 일치를 검사했다. 원화·연락판·모의 합계 PNG **31개**의 signature, IHDR RGBA8, chunk CRC, scanline 크기·필터, 파일 끝과 byte-for-byte 재현 검사가 통과했다. 모든 저작 쓰기는 정수·팔레트·경계를 단언하며 범위 밖 쓰기 **0개**다. 별도 디스크 SHA 검사도 PNG+SVG **52개**와 일치했다. 26개 fragment 대상이 모두 실제 존재한다.

통합 작업 중 읽은 `src/style.css`에서 등록 이미지 변수 소비는 **17개**였다: frame/parchment/celtic/celtic2, btn 3종, slot 3종, tab 3종, bar_frame/bar_frame_gold, xmark, diamond. `bar_frame2`, 채움 3종, diamond_dim/divider/ornament/parchment_small/warn **9개**는 이 CSS에서 아직 소비하지 않는 호환 등록이다. 26개 모두 새 원본을 제공했지만 모두 현재 화면에 노출된다고 주장하지 않는다. Root가 병행하는 실제 연결 후 최종 소비는 다시 확인해야 한다.

| 파일 | SHA-256 |
| --- | --- |
| draw-ui.py | `df4c41518bf1d4effe7c4341f0519632680cf2f72dc0df25e8001c4c4fb5229c` |
| ui.fragment.json | `5f24ffbe3c79b60b65eb6d2d4ac9a7802e0bc57fb4d0c99ecc162ecd9e53c2dd` |
| ui-audit.json | `72eec1153387f79bf970fcc1e1f156eb6e8822ed556472b5459f413afa6b32ee` |

이 담당 작업에서 Core·Def·저장·난수·시야·공용 manifest·CSS·HUD·Title·Git은 변경하지 않았다. GPU·브라우저·Full·World·Type·pnpm 프로젝트 검사는 실행하지 않았다. 프로젝트 게임 개발 스킬의 실제 입력→화면/상태 관찰은 Root의 통합본에서 수행하며 이 정적 원화 검토로 대신하지 않는다.
