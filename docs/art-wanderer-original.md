# ASHVEIL 떠돌이 원본 캐릭터 아트

2026-10-20에 플레이어 공용 기본 외형으로 제작했다. 세계관 인물·직업을 추가하는 설정 변경은 아니다. 변경의 재와 습기에 닳은 청록 후드, 상아색 목도리, 가죽 측량 가방, 작은 구리빛 브로치를 공통 요소로 삼았다. 어두운 석재 위에서 얼굴·어깨·손을 구분할 수 있도록 명도 차이를 자산 자체에 넣었다.

## 제공 파일과 출처

| 파일 | 제작·용도 | 크기 |
| --- | --- | --- |
| `public/art/ashveil-wanderer-portrait.png` | OpenAI image_gen으로 새로 생성한 동일 인물 초상. HUD·캐릭터 생성 화면용. | 1254 × 1254 px, 2,475,159 bytes |
| `public/sprites/original/ashveil-wanderer-walk.png` | 직접 설계한 픽셀 실루엣·재질·방향·보행. 런타임 원본 시트. | 72 × 128 px, RGBA |
| `public/sprites/original/ashveil-wanderer-attack.png` | 같은 인물의 어깨·팔·천 동작. 런타임 원본 시트. | 128 × 160 px, RGBA |
| `public/sprites/original/ashveil-wanderer-walk.svg` | 보행 PNG와 같은 픽셀을 경로로 보존한 편집 가능한 원본. | 72 × 128 좌표 |
| `public/sprites/original/ashveil-wanderer-attack.svg` | 공격 PNG와 같은 픽셀을 경로로 보존한 편집 가능한 원본. | 128 × 160 좌표 |
| `public/sprites/original/ashveil-wanderer-contact.png` | 보행 12개·공격 16개 포즈를 4배 정수 배율로 직접 렌더한 검토용 시트. | 576 × 1184 px |
| `public/sprites/original/ashveil-wanderer-palette.json` | 천·피부·가죽·구리·신발의 20색 팔레트. | JSON |
| `tools/art/draw-wanderer.mjs` | 픽셀 좌표·폴리곤·재질 클러스터·애니메이션 포즈의 직접 작성 원본. PNG/SVG 재생성과 아틀라스 적용 명령. | 의존성 없는 Node.js |

초상 생성 원본은 `/workspace/generated_images/exec-6c2c3c10-65af-4f3d-9209-bc027305518d.png`이다. 제공 초상은 원본 바이트를 그대로 복사했다. 크롭·재색칠·보간·축소 등 후처리를 하지 않았으며 원본과 제공 파일의 SHA-256이 같다. 생성 참조 이미지로 다른 게임 자산을 제공하지 않았다.

맵 시트는 생성 초상에서 색이나 픽셀을 추출하지 않고 같은 디자인을 작은 화면에 맞춰 직접 새로 그린 별도 원본이다. 기존 캐릭터 시트 역시 샘플링·트레이싱·재색칠하지 않았다. PNG는 직접 작성한 색/좌표 배열에서 RGBA로 인코딩하며, SVG는 동일한 배열의 픽셀 경로를 보존한다. 팔레트의 적은 구리색과 밝은 천이 얼굴과 장비의 초점을 만든다. 측량 가방은 인물의 왼쪽 허리에 두며 반대쪽을 볼 때는 가장자리만 보인다.

## 프레임과 실제 적용

`src/client/sprites.json`의 기존 `hero`·`hero_atk` 시트 URL을 원본 PNG로 연결했다. Core Def의 `sprite: 'hero'`와 `hero_w_down1` 등의 기존 프레임 이름은 유지한다.

| 동작 | 셀 | 열 | 행 순서 | 앵커 |
| --- | --- | --- | --- | --- |
| 걷기·대기 | 24 × 32 px | 왼발·대기·오른발 3개 | 아래·왼쪽·오른쪽·위 | `[0.5, 31/32]` |
| 공격 | 32 × 40 px | 준비·들기·뻗기·회복 4개 | 아래·왼쪽·오른쪽·위 | `[0.5, 39/40]` |

공격 프레임은 같은 몸을 `(4, 8)`에 놓는다. 따라서 `39 − 8 = 31`로 보행과 공격의 발바닥 기준이 정확히 같다. 원본 픽셀의 `renderScale: 1`을 적용해 기본 카메라 3배에서 픽셀을 또렷하게 표시한다. 캐릭터 상단 상태 표시는 `headOffset: 30`을 읽는다. 타일 크기·카메라·시야·어둠·지형 기억은 바꾸지 않는다.

`CharDef`와 `MapRenderer`는 선택적인 `renderScale`, `headOffset`, `attackAnchor`를 읽는다. 미지정 캐릭터는 기존 배율·높이를 사용한다. 기존 두 약탈자 시트의 `attackAnchor`는 과거 런타임 하드코딩과 같은 `0.78`로 정규화하여 실제 표시 위치를 유지했다.

원본 캐릭터에 고정 검·활을 그려 넣지 않았다. 비무장·원거리·근접 장비에 공통으로 맞는 팔 동작만 그리며 실제 장비·발사체·타격 효과는 기존 게임 상태와 연출이 계속 담당한다.

초상 URL은 GitHub Pages 하위 경로를 지원하도록 다음과 같이 만든다.

```ts
const portrait = `${import.meta.env.BASE_URL}art/ashveil-wanderer-portrait.png`
```

정사각형 원본의 비율을 보존한다. 기존 UI 픽셀 미리보기에는 `frameCss('hero_w_down1', 1)`을 그대로 쓸 수 있다.

## 재생성

```sh
node tools/art/draw-wanderer.mjs --install
```

외부 다운로드나 이미지 라이브러리 없이 원본 픽셀 PNG/SVG·팔레트·검토 시트를 재생성하고 플레이어 아틀라스 항목만 연결한다. `--install`을 생략하면 아트 파일만 생성한다. 기존 외부 자산 빌더로 전체 `sprites.json`을 새로 만든 뒤에는 위 명령을 다시 실행한다. image_gen 초상은 이 명령으로 변경하지 않는다.

## 확인

- 네이티브 PNG 헤더의 크기와 28개 프레임의 시트 경계를 검증했다.
- 보행·공격의 지면 앵커가 같은 좌표임을 수치로 검증했다.
- 4배 검토 시트에서 네 방향·발·팔·천·가방의 포즈를 확인했다.
- 변경 렌더 파일과 원본 제작 스크립트의 ESLint 검사 통과.
- 전체 게임·브라우저 검증은 병렬 구현을 통합한 뒤 수행한다.

## SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `ashveil-wanderer-portrait.png` | `2073ac3942d4e92c1f21e246fd1b25ad8614be9e2de019dc28e032436f877d99` |
| `ashveil-wanderer-walk.png` | `ed2ccb1de8d24ccca3a3325665695bb8e3f7af2fa76af88a10e6cc6375e8801f` |
| `ashveil-wanderer-attack.png` | `43c32a9b0f25c8f01559ca578cf950c20fbff56795bde3e76e51228480a908e9` |
| `ashveil-wanderer-walk.svg` | `9925c557d1dc4ce0627f104b79e2ec2a70e303ee53c9a598034f554ee520a0a9` |
| `ashveil-wanderer-attack.svg` | `0cdc62cd46c6286911341bf459ad9dd9c96290880b9abbb756223271944fd44e` |
| `ashveil-wanderer-contact.png` | `11f02e5f347b129374416b34f680cfc6a1c53f32b94d689751c1f1c5b87d32cc` |
| `ashveil-wanderer-palette.json` | `bcef521bb62111f8787553f80507a0881b2c85630e2551eaf1d814bac309f709` |
| `draw-wanderer.mjs` | `47442a44cdd502d2dc411e8df5e00ca7e344de3d7b0932eb6ec5a4785feddd59` |

## 초상 생성 명세

아래는 image_gen에 전달한 원문이다. `transparent_background: false`이며 참조 이미지는 제공하지 않았다.

```text
Create an ORIGINAL square character portrait for ASHVEIL, a dark survival RPG set on a damp ash-covered frontier. This will be a real game HUD portrait, readable at 60-120px and also beautiful at full size. Original person and design, no imitation of any existing game characters. A lean adult human ash-frontier wanderer, practical weathered faded dark teal hood with asymmetric stitched ash-gray cloth mantle, dark brown leather shoulder straps and compact satchel, bone-white wrapped neck scarf, one subtle warm ember-bronze clasp at the upper chest. Scar across left eyebrow, weather-beaten olive-gray skin, short uneven dark hair partly hidden by hood, gray-green watchful eyes, tired but composed and determined. Three-quarter frontal bust, face unobscured, strong recognizable silhouette. The hood forms an angular pointed crown and broad ragged shoulders; a tiny folded brass survey map hangs from a strap, no large held weapon. Detailed high-quality PIXEL ART portrait, carefully placed clustered pixels, limited restrained palette of charcoal, cold slate, desaturated teal, old parchment, rusty copper and very few amber highlights, dramatic readable value hierarchy; sharp edges and intentional pixel dithering instead of blurred digital painting. Face is brighter than the clothing and background. Background is quiet smoky slate with a very subtle stone arch shape, no border, no UI, no text, no letters, no watermark. Fill most of the square with head and upper chest with a little breathing room around silhouette. Make the pixels crisp and the character convincing, sober and distinctive, not chibi or cute.
```
