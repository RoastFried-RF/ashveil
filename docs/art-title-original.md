# ASHVEIL 타이틀 원본 아트

- 제공 파일: `public/art/ashveil-title.png`
- 용도: 타이틀 화면의 분위기·세계관을 소개하는 배경 키 아트
- 생성일: 2026-10-20
- 제작 도구: OpenAI image_gen
- 크기: 1672 × 941 px (약 16:9), 불투명 PNG
- 파일 크기: 2,274,775 bytes
- SHA-256: `5d309a4f7a9cf106f9bb95185baecdeedf1a049dbc5532455895e25be05d1f38`
- 생성 원본: `/workspace/generated_images/exec-fe0b2aff-893b-468f-9a66-efb3493b77a7.png`
- 후처리: 없음. 생성 원본의 바이트를 그대로 복사했다. 원본과 제공 파일의 해시가 같다.
- 확인: 제공 파일을 `view_image`로 확인했고, PNG 헤더에서 크기를 검증했다.

## 세계관과 구성

`docs/CANON.md`, `docs/design/12-ui-ux.md`, 정원사망의 침묵과 잿빛 수도원의 설정을 바탕으로 새로 생성했다. 재에 가려진 변경 행성, 침묵한 테라포밍 시설의 원경, 낡은 구리 배관이 이어진 석조 수도원, 작은 등불을 든 떠돌이를 담았다. 기존 게임의 캐릭터·문양·상표·배경 자산을 참조 이미지로 제공하지 않았다.

왼쪽 약 45%는 짙고 차분한 명암으로 비워 제목과 메뉴의 대비를 확보한다. 오른쪽에는 수도원의 문과 종루가 있으며, 떠돌이와 등불은 가로 약 80%·세로 약 70% 지점에 있다. 저채도 돌·재·이끼·구리색에 등불의 작은 호박빛만 강조한다. 문자·로고·UI는 그림에 포함하지 않았다.

## 적용 시 유의점

- GitHub Pages의 저장소 하위 경로에서도 동작하도록 `import.meta.env.BASE_URL`에 `art/ashveil-title.png`를 이어서 사용한다.
- 기본 화면은 가로 배경 전체를 보여 주고, 메뉴 영역의 추가 대비가 필요하면 CSS 그라디언트를 사용한다.
- 좁은 화면에서 `cover`를 사용할 때는 오른쪽 약 78%를 중심으로 배치하면 등불·떠돌이·수도원의 문이 함께 보인다. 제목·폼은 아트 밖이나 충분한 불투명 배경 위에 둔다.
- 원본의 비율을 보존한다. 별도 크롭·색 보정·축소 파일을 만든 경우 이 원본 파일과 구별해 기록한다.

## 생성 명세

아래는 도구에 전달한 원문이다.

```text
Create an original, exceptionally polished title-screen key illustration for the survival role-playing game ASHVEIL. IMPORTANT: DO NOT write any title, letters, words, logo, watermark, caption, interface, border or ornamental frame anywhere in the image. WIDE LANDSCAPE 16:9 composition, opaque background.

Art direction: sophisticated atmospheric hand-crafted pixel-art key illustration. Beautiful deliberate pixel clusters, crisp stepped silhouettes, rich material texture, controlled limited colors and sophisticated composition. A large detailed illustrated landscape with subtle visible pixel structure, not tiny icons, not crude blocks, not vector art, not a 3D render, not photography, no smeared brushwork. Quiet, mournful, dangerous, tangible and old. Desaturated ash-grey, slate, brown, moss, aged copper and very dark blue-green. One small restrained warm amber light. No bright cyan, purple, red or candy colors. Materials should already look weathered.

World: a remote cold frontier planet beneath a permanent ash veil after a terraforming network fell silent generations ago. This is a lived-in primitive survival world among old technological ruins, not a magical fantasy or a modern futuristic city. Through the grey rain and drifting ash, a ruined stone monastery clings to a rough ridge on the RIGHT side. Its age-worn archway and partially fallen bell structure show cracks, damp streaks, old moss and soot. Some corroded copper pipes have long ago been embedded in its ancient masonry. Far beyond it, nearly lost in ash fog, a dormant slender terraforming tower and broken industrial lattice remain as distant silhouettes, with a faint plume of ash. The horizon has layered desolate hills and ravines.

Foreground focal point: a single SMALL lone human wanderer seen from behind and three-quarters, standing in the LOWER RIGHT QUADRANT at approximately 72 percent across the image. Modest natural human proportions, face unseen under a plain worn hood, layered patched cloth, rough leather travel pack, simple walking staff. No recognizable franchise costume, no recognizable symbol, no sword silhouette dominating the scene. A little iron lantern hangs from one hand and glows muted amber onto nearby wet rough stone and the edge of the cloak. This small human gives scale to the spacious landscape. The scene must not become a portrait. Do not add monsters or other people.

Composition for a professional game title interface: keep the LEFT 45 PERCENT deliberately very dark, low contrast and calm, with sparse ash haze and only barely visible receding ground. This is generous clean negative space where interface text will be placed later. Absolutely no bright objects, recognizable large foreground subjects, or busy branches on this left area. The right side contains all visual storytelling and highlights. A clear uneven path leads from lower middle towards the monastery arch at right. Soft layered depth, sloping silhouettes, delicate ash in air, subtle cold light through the high clouds. The traveler, lantern and best part of the arch must remain legible together when the image is cropped to the center-right portion on narrow screens. Avoid a strong central light source. Upper edge and lower edge are calm enough for safe cropping.

Make this a completely original, restrained, art-directed game illustration, composed beautifully rather than a collage. Wide 16:9 landscape. No writing anywhere.
```

