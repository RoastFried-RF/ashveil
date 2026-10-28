# v0.302 — 전체 UI 26개 직접 제작 원본

2026-10-22. `CLAUDE.md`, 프로젝트 게임 개발 스킬, `CANON.md` D13, `12-ui-ux.md` §10, 사전 전수조사 `complete-catalog-v302-before.json`의 `registry.ui`, `App.vue`, 실제 공용 CSS인 `src/style.css`와 `Bar.vue`를 읽었다. 사용자 승인 범위에 따라 기존 UI 등록 26개 전체를 새 정수 좌표 Canvas 원화로 제작했다. 이전 타이틀·초상·BodySvg는 이 작업 범위에 포함하지 않는다.

새 원본은 청록 먹색, 재색 철, 낡은 황동 이음, 상아색 강조로 설계했다. 프레임은 1픽셀 재색 선과 작은 모서리 이음만 남겼다. 큰 중앙은 저대비 재질, 슬롯 중앙은 균일한 어두운 면으로 두어 물품과 글자가 먼저 보인다. `celtic`이라는 기존 등록키는 호환용으로 유지하며 그림은 새 석조 이음 디자인이다.

기존 PNG는 조사 때 PNG 시그니처와 IHDR의 크기 8바이트만 읽었다. 기존 픽셀 디코딩·입력, 외부 팩 입력, 크롭, 트레이스, 재색칠, 이미지 변환은 수행하지 않았다. 생성기는 기존 PNG를 전혀 열지 않으며, 직접 정의한 팔레트와 정수 좌표를 새 Canvas에 그려 표준 라이브러리로 RGBA PNG를 만든다. 검토 합성도 새 Canvas의 메모리 픽셀만 사용한다.

## 산출물과 연결 계약

- 생성기: [`tools/art/draw-complete-ui.py`](../tools/art/draw-complete-ui.py).
- 원화: [`public/sprites/original/complete/ui/`](../public/sprites/original/complete/ui/), 기존 등록키와 같은 이름의 PNG 26개.
- 연결 fragment: [`tools/art/complete-ui.fragment.json`](../tools/art/complete-ui.fragment.json). 최상위 `ui` 객체 안에 **기존 key → 새 상대 URL** 26개를 담는다. `sheets`·`frames`는 필요 없다. Root가 공용 manifest의 `ui` 객체에 병합한다.
- 크기·투명도·CRC·SHA-256·쓰기 경계·slice 기록: [`review/ui-audit.json`](../public/sprites/original/complete/ui/review/ui-audit.json).

| 등록키 | 유지한 PNG 크기 | 9분할 inset | 중앙/용도 |
| --- | --- | --- | --- |
| frame, parchment | 96×96 | 6px | 12px 주기의 이음 없는 중앙, `fill` |
| celtic, celtic2 | 72×72 | 6px | 12px 주기의 이음 없는 중앙, `fill` |
| btn, btn_olive, btn_sel | 64×32 | 4px | 버튼 중앙, `fill` |
| slot, slot_olive, slot_sel | 32×32 | 4px | 균일한 슬롯 중앙, `fill` |
| tab, tab_olive, tab_sel | 32×32 | 4px | 탭 중앙, `fill` |
| bar_frame, bar_frame2 | 96×16 | 3px | **중앙 투명, `fill` 금지** |
| bar_frame_gold | 96×24 | 4px | **중앙 투명, `fill` 금지** |
| bar_blue, bar_red, bar_green | 96×8 | 없음 | 모든 열이 같은 8px 수평 채움; 임의 % 폭에 안전 |
| warn, xmark, diamond, diamond_dim | 32×32 | 없음 | 투명 기호, 원래 정사각 캔버스 유지 |
| ornament | 64×32 | 없음 | 투명한 작은 봉인 장식 |
| divider | 96×16 | 없음 | 투명 구분선; 16px 높이 유지 |
| parchment_small | 64×32 | 4px | 밝은 작은 기록지, `fill` |

## 실제 소비 조사와 Root 적용 제안

조사 시점에 `src/client/render/atlas.ts`는 `manifest.ui`를 `uiUrls`로 노출하고 `App.vue`의 `onMounted`는 각 URL을 `--ui-${key}` CSS 변수로 주입했다. 등록된 이미지 변수를 `var(--ui-frame)` 등의 형태로 읽는 소스 소비자는 **0개**였다. 현재 프레임·버튼·슬롯·막대 모양은 `src/style.css`의 직접 색과 gradient였다. `--ui-bronze`, `--ui-line`, `--ui-surface`는 이미지 등록키와 다른 색상 변수다. 따라서 이 원화 26개가 처음부터 게임에서 사용 중이었다고 해석하면 안 된다.

공용 manifest·App·CSS는 이 원화 담당자가 수정하지 않았다. Root가 실제 연결할 선택자 제안은 다음과 같다. 각 선택자의 기존 border-width, padding, width, height, min-height는 유지한다. `border-image-width`는 도색 영역을 정하므로 기존 박스 치수를 바꾸지 않는다.

| 기존 선택자 | 권장 원본 |
| --- | --- |
| `.df.df-gold` | `frame` |
| `.df.df-celtic`, 필요시 `.panel` | `celtic` |
| `.df.df-olive` | `celtic2` |
| `.df.df-parch` | `parchment` |
| `.df-slot`, `.df-slot-olive`, `.df-slot-sel` | 대응 slot 3종 |
| `.hud-slot.is-selected` | `slot_sel` |
| `.df-btn`, `.df-btn-olive`, `.df-btn-sel` | 대응 btn 3종 |
| `.dbtn`, `.dbtn-gold` | `btn`, `btn_sel` |
| `.df-tab`, `.df-tab-olive`, `.df-tab-sel` | 대응 tab 3종 |
| `.df-bar`, `.df-bar-gold` | `bar_frame`, `bar_frame_gold` |
| `.window-close` | `xmark` |

예시 CSS는 다음과 같다. 공용 CSS의 기존 선언 뒤에서 image 관련 속성만 더한다. 실제 스타일 충돌과 최종 화면 확인은 Root의 통합 담당 범위다.

```css
.df.df-celtic {
  border-image-source: var(--ui-celtic);
  border-image-slice: 6 fill;
  border-image-width: 6px;
  border-image-repeat: repeat;
}
.df-slot, .df-slot-olive, .df-slot-sel, .hud-slot.is-selected,
.dbtn, .dbtn-gold, .df-btn, .df-btn-olive, .df-btn-sel,
.df-tab, .df-tab-olive, .df-tab-sel {
  border-image-slice: 4 fill;
  border-image-width: 4px;
  border-image-repeat: repeat;
}
.df-slot { border-image-source: var(--ui-slot); }
.dbtn { border-image-source: var(--ui-btn); }
.df-tab { border-image-source: var(--ui-tab); }
.df-slot-sel, .hud-slot.is-selected {
  border-image-source: var(--ui-slot_sel);
}
/* Bar.vue의 inset-0 자식이 부모 테두리를 덮지 않도록 위에 도색한다. */
.df-bar::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 0 solid transparent;
  border-image-source: var(--ui-bar_frame);
  border-image-slice: 3;
  border-image-width: 3px;
  border-image-repeat: repeat;
}
.df-bar-gold::after {
  border-image-source: var(--ui-bar_frame_gold);
  border-image-slice: 4;
  border-image-width: 4px;
}
.window-close {
  background-image: var(--ui-xmark);
  background-position: center;
  background-size: 32px 32px;
  background-repeat: no-repeat;
  image-rendering: pixelated;
}
```

`border-image` 자체는 CSS `image-rendering`을 브라우저마다 같은 방식으로 취급한다고 보장할 수 없어 정수 source slice와 정수 도색 폭을 사용한다. 새 패널의 중앙 패턴은 source의 양쪽 inset을 제외한 폭·높이가 모두 12의 배수이며 실제 중앙 픽셀 주기를 검사했다. 4px 슬롯 slice 내부에 별도 테두리를 넣지 않아 큰 슬롯에서도 내부 격자선이 반복되지 않는다.

`Bar.vue`는 상처 회복 상한·ghost·실제 비율과 색약 팔레트를 표시한다. 채움 PNG를 선택적으로 연결할 때 기본 팔레트의 대응 색에만 사용하고 접근성의 `--state-health/energy` inline 색을 덮지 않는다. 채움은 `background-size: 96px 8px; background-repeat: repeat-x`로 8px 높이를 보존하거나, 기존 실제 막대 높이가 8px 이상일 때 가운데 배치할 수 있다. 값이 0%여도 끝장식이 남지 않도록 각 열은 동일한 색띠다. 프레임과 채움은 별도 레이어다. `xmark`는 32px 캔버스 안 약 14px 십자가라 기존 28px 닫기 버튼에서는 background-size 28~32px가 적당하다. 글자 `×`와 중복 표시하지 않되 기존 접근 가능한 버튼 이름을 유지한다.

기존에 대응 소비자가 없는 `warn/diamond/diamond_dim/ornament/divider/parchment_small`와 일부 상태별 변형도 등록 누락 없이 제작했다. 이를 보이게 하려고 새 장식·상태·게임 기능을 추가하지 않는다. Root의 통합 후 실제 소비 목록은 별도로 확인해야 한다.

## 직접 연 검토 이미지와 수정

최종 버전 아래 **5개 파일을 모두 `view_image`로 직접 열었다**. 4개 연락판에 26개 원본을 3배 최근접으로 빠짐없이 배치했다. 모의 창은 새 프레임·탭·32칸 격자·선택 상태·체력/기력/녹색 막대·닫기·기록지·기호·구분선을 1배 원본 중심으로 합성했다.

- [패널 4개](../public/sprites/original/complete/ui/review/contact-panels.png)
- [버튼·슬롯·탭 9개](../public/sprites/original/complete/ui/review/contact-controls.png)
- [프레임·채움 막대 6개](../public/sprites/original/complete/ui/review/contact-bars.png)
- [기호·작은 기록지 7개](../public/sprites/original/complete/ui/review/contact-symbols.png)
- [실제 9분할 모의 패널 조합](../public/sprites/original/complete/ui/review/mock-panels.png)

첫 모의 조합에서 선택 슬롯의 source 중앙에 내부 선이 포함되어 확대 반복 시 십자 격자선이 생기는 것을 발견했다. 원화의 슬롯 중앙 전체를 균일하게 고쳐 재생성·검사 후 최종 5장을 다시 열었다. 패널 재질도 source 중앙에 정확히 맞는 12px 주기로 정리했다. 최종 모의 조합에서 글자와 슬롯 내용이 프레임보다 먼저 보이고, 선택 슬롯은 황동과 상아 표시로 구분되며, 밝은 기록지의 어두운 글자가 읽힌다.

모의 글자는 검토용으로 직접 정의한 3×5 영문 비트맵이다. 실제 한국어 글꼴·웹 레이아웃·입력·게임 상태를 재현한 스크린샷은 아니다. 원본 색 조합의 계산상 명암비는 상아 `#dcd4b8` / 먹색 `#101b1e` **11.82:1**, 재색 `#7d897a` / 먹색 **4.79:1**, 기록지 글자 `#303832` / 종이 `#ccc3a6` **6.86:1**이다. 이 수치는 실제 브라우저의 반투명·합성·설정 화면 접근성 검사를 대신하지 않는다.

## 실행한 검사와 SHA 기록

```sh
python3 tools/art/draw-complete-ui.py
python3 tools/art/draw-complete-ui.py --check
```

등록키 **26/26 정확히 일치**, 원래 크기 보존 **26/26**, 고유 원화 SHA **26개**, 원화 합계 **5,203 bytes**. PNG **31개**(원화 26 + 검토 5)의 signature·각 chunk CRC·IHDR RGBA8 규격·해제된 scanline 길이·필터·파일 끝을 확인했다. `--check`는 디스크 파일과 재생성한 바이트를 비교해 전부 일치했다. 별도 표준 라이브러리 검사에서도 디스크의 31개 SHA-256과 모든 chunk CRC가 감사표와 일치했다. 모든 Canvas.point는 정수 좌표·팔레트키·캔버스 경계를 단언하고 범위 밖 쓰기 **0개**다. 슬롯 중앙 균일·패널 중앙 반복 경계·막대 프레임 중앙 투명·채움 막대 열 동일을 각각 검사했다.

개별 원화 26개와 검토 5개의 **전체 SHA-256**은 `review/ui-audit.json`의 `files` 배열에 기록했다. 핵심 도구·계약 해시는 다음과 같다.

| 파일 | SHA-256 |
| --- | --- |
| draw-complete-ui.py | `98b0823ed7d8ed3a3eee1275cedce30731d52f3c87b9c1036d4a767d8176c145` |
| complete-ui.fragment.json | `861810a618d2425972f89340f4e273261610b4d05f656a49628eb5b3069e0603` |
| ui-audit.json | `7bc2cad7024f6b34a568669b014e62a706cc2286b5f91dcb6b5241fb13551a49` |

이 담당 작업에서는 GPU·브라우저·Full·World·Type·pnpm 프로젝트 검사를 실행하지 않았다. 원화 자체의 정적 검사·직접 시각 검토만 완료했으며, 공용 manifest/CSS 연결 뒤의 실제 입력→화면·공개 상태 관찰과 프로젝트 통합 검증은 Root가 수행한다.
