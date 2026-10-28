# ASHVEIL 원본 비알약 물품 아이콘 5종 — 준비 패키지

2026-10-21에 기존 pill 외형을 공유하던 실제 비알약 물품 5종을 조사하고, 각 물성에 맞는 새 정수 좌표 아이콘을 직접 그렸다. 현재는 **신규 원본과 병합 조각 준비 완료, 게임 미등록** 상태다. 이 작업은 `/workspace/ashveil-nonpill-icons-art`의 새 파일만 작성했다.

## 실제 조사와 제안 키

| 실제 Item | 현재 공유 sprite | 신규 제안 sprite | 실제 size | 새 원본 |
| --- | --- | --- | --- | --- |
| `Item.Salt` 소금 | `pill_white` | `original_salt` | 1×1 | `ashveil-salt.png` |
| `Item.GlassEye` 유리 눈 | `pill_blue` | `original_glass_eye` | 1×1 | `ashveil-glass-eye.png` |
| `Item.PowerCell` 개척 전원셀 | `pill_green` | `original_power_cell` | 1×1 | `ashveil-power-cell.png` |
| `Item.HealthDraught` 쓴 약초탕 | `pill_green` | `original_health_draught` | 1×1 | `ashveil-health-draught.png` |
| `Item.PurificationAmpoule` 정화 앰플 | `pill_blue` | `original_purification_ampoule` | 1×1 | `ashveil-purification-ampoule.png` |

기존 `crafting.json`, `prosthetics.json`, `items-consumables.json`의 원문을 읽었다. `tools/art/nonpill-usage-survey.json`에 5개의 실제 Def, 크기·무게·스택·실물 관련 필드, 관련 의수족 규칙과 소금 패치, 읽은 코드/기획/세계관 파일의 SHA를 보존했다. 모든 원본 PNG는 32×32이며 실제 인벤토리 점유 1×1을 바꾸는 제안이 아니다.

- **소금**: 제작 재료이며 실제 `saltrim-coast.json` 패치의 saltGrams는 35다. `fluid-crafting.ts`는 실제 물의 소금 질량을 다룬다. 그림은 거친 결정과 흩어진 알갱이의 재료 인상만 나타낸다. 결정 개수는 아이템 수량·35g 계량·스택 수가 아니며 새 자루·그릇·용기를 추가하지 않는다.
- **유리 눈**: 실제 `Prosthetic.GlassEye`를 결손된 왼눈/오른눈 부위에 설치하는 유리제 물품이다. 원래 효율은 0이고 firstImpression은 3이며 시력 회복 장치가 아니다. 수리 재료도 `GlassShard`다. 매끈한 밝은 유리 곡면·작은 회청록 홍채·동공을 그렸고, 생체 조직·핏줄·기계 렌즈·발광·시력 효과는 넣지 않았다. 홍채 색은 외형 해석이며 상태·등급 정보가 아니다.
- **개척 전원셀**: 실제 `Prosthetic.PioneerArm.powerItem`이며 `prosthetics.ts`의 charge 작업에서 실물 셀 하나를 소모한다. 원래 명세의 30일 전력은 게임 규칙이며 아이콘에 충전율·남은 일수·가득 찬 상태를 표시하지 않는다. 평범한 마모색 케이스와 두 접점으로 정제와 구분했다. 번개·극성·배터리 게이지·문자·브랜드·작동 LED는 없다.
- **쓴 약초탕**: 실제 설명은 수도원 약제실의 약초를 달인 물이다. 섭취하는 약제이며 체력 회복은 기존 drug 규칙이 담당한다. 기본 표현은 작은 불투명한 흙빛 용기와 소박한 마개다. 내용물 색·잔량선·잎 장식·치유 십자·효능 기호·김·복용량은 표시하지 않는다.
- **정화 앰플**: 실제 개척기 항생 약품이며 소모품 크기는 1×1, stackable false다. 가는 유리 목과 닫힌 유리 몸체를 직접 그려 약초탕의 둥근 불투명 용기와 구분했다. 주사기·바늘·용량/기한·감염 정답 기호·물 정화 기호·품질/봉인 판정·빛나는 내용물은 없다. 실제 사용 경로나 감정·부작용 규칙을 새로 만들지 않는다.

CANON과 세계관의 소금 해안·교역 재료, 개척 유물의 전지, 의수족/약품 설정을 읽었다. 셀의 공학 구조, 약초탕 용기 재질, 앰플의 세부 곡선은 크기와 명칭/용도에 맞춘 **시각 해석**이다. 이를 정본에 없는 새 재질 규칙·내용물·용기 Item·소유권·상태 데이터로 주장하지 않는다.

원래 pill 6종과 `Item.WaterPill`은 범위에서 제외했다. seed 효과 대응·의약 지식·감정·유통기한·역가·음용/의료 효과·가격·무게·스택·수량은 변경하지 않았다. 이 파일은 적용 전 제안이며 실제 Def를 이미 변경했다고 표시하지 않는다.

## 직접 제작한 픽셀과 편집 원본

외부 이미지나 팩을 입력·추출·크롭·트레이싱·재색칠하지 않았다. 자체 firearm/storage 도구의 표준 라이브러리 캔버스·도형 선·PNG/SVG·문자 출력 구조와 19색 재질 팔레트를 재사용했고, 소금 결정·유리 눈·셀·약초탕 용기·앰플은 새 좌표/곡면 수식으로 작성했다. 수정은 PNG 후처리 없이 좌표 소스에서 한다. 제작물은 프로젝트용 자체 원본이며 프로젝트와 같은 사용 조건으로 제공한다.

다섯 PNG는 32×32 RGBA, 알파는 0/255이며 가장자리에 투명 여백이 있다. 같은 이름 SVG는 같은 정수 픽셀의 rect를 보존한 편집 원본이다. `*-16.png`는 원본의 `(2x+1, 2y+1)` 중심 최근접 표본으로 만든 16px 표시 검토용이다. 실제 게임 frame 크기를 16px로 바꾸는 자산은 아니다.

`ashveil-nonpill-contact.png`는 960×376 px 검토 시트다. 각 열은 32px 원본의 4배 확대, 밝고 어두운 배경의 원본 32/16px, 16px의 4배 확대를 제공한다. 수량·내용물·충전·내구·효능을 정답처럼 표시하는 상태 뱃지는 없다.

## 재현과 독립 검사

```sh
python3 tools/art/draw-nonpill-icons.py
python3 tools/art/draw-nonpill-icons.py --check
python3 tools/art/check-nonpill-icons.py
```

제작 도구는 MAIN을 import하거나 읽지 않고, 포함된 조사 스냅샷과 좌표만으로 자신의 20파일을 결정적으로 생성한다. `--check`는 파일을 쓰지 않고 바이트를 대조한다. 별도 검사 도구도 생성기를 import하지 않고 PNG를 직접 디코딩해 SVG 정수 rect와 독립 비교한다.

원본 아트 검토 과정에서 원본 32px PNG 5개, 16px PNG 5개와 contact 총11개를 `view_image`로 각각 실제 열었다. 소금 결정의 불규칙 실루엣, 인공 유리 눈의 곡면, 셀 접점, 둥근 약초탕 용기와 가는 앰플의 차이를 일반 아이콘 크기와 확대에서 확인했다.

실행 완료:

- 20생성 파일 결정적 바이트 재현 `PASS`.
- PNG 32px 5개·16px 5개의 RGBA/CRC/알파, PNG/SVG 5쌍 전 픽셀 일치 `PASS`.
- 19색 팔레트 범위·투명 외곽 여백·서로 다른 이미지 5개 `PASS`.
- 16px 중심 최근접 샘플과 원본의 정확한 대응 `PASS`.
- 정확한 실제 Item 5종·size 1×1·새 key 5개만 있는 조각·출처 SHA `PASS`.

기록은 `docs/art-nonpill-icons-verification.json`에 있다. 게임 등록·Def/실제 매니페스트·Root/Core/Git·기존 pill/WaterPill은 수정하지 않았고 GPU·브라우저·프로젝트/무거운 검사는 실행하지 않았다.

## 적용 제안

`tools/art/nonpill-manifest.fragment.json`에는 새 sheet/frame 5개씩만 있으며 기존 키를 포함하지 않는다. 표의 정확한 5종 Def에만 sprite를 연결하는 제안이다. 파일 경로는 `public/sprites/original/items/ashveil-{물품}.png`다. 실제 등록·Def 패치·기존 공유 sprite 소비자와 게임 화면 검증은 Root가 별도로 담당한다.

## SHA-256

- `tools/art/draw-nonpill-icons.py`: `27c1a2731a07003a9e1c81d799abe44459473bbb362e2c69ff98014cfe1ebd58`
- `tools/art/check-nonpill-icons.py`: `0ef81624c899bd0c4c356b86ff2631c2259204b4657d7162153401df3d78b5aa`
- `docs/art-nonpill-icons-verification.json`: `5407235d9cbe08c7713d8393e3e3080a840fe234d03ad660b05a2e68f4a19aea`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/items/ashveil-salt.png` | 272 | `d9d021b7c02de1c4cb1fff235059500485ba0a3c33db7f2a806dc21bcee4e1ef` |
| `public/sprites/original/items/ashveil-salt.svg` | 6347 | `0b00152cd8f84c14377a7b0ec2b6b08893d4540e5221e227d5e9fe82f6548636` |
| `public/sprites/original/items/ashveil-salt-16.png` | 153 | `22afedcf1ebe7fa4a92e413f9356b0164797052bd42bc4de5840bf145799b8ea` |
| `public/sprites/original/items/ashveil-glass-eye.png` | 264 | `e9267143e5015109193c77f5ee35c6fb540b019af406adeb2cdb4dd56770d435` |
| `public/sprites/original/items/ashveil-glass-eye.svg` | 8137 | `fb951d7b69fb68cc87a3f9df397f88183044ee4bd6c0230885520f21af515def` |
| `public/sprites/original/items/ashveil-glass-eye-16.png` | 170 | `4d5c1c208fb628acbbe14c773e2776fb860b1239c946d641a0dc1cec6e900c9e` |
| `public/sprites/original/items/ashveil-power-cell.png` | 248 | `d0b700df4e409f6e86de64acb5f75d5e77b7b49256d1478e2965fd216e3a5f91` |
| `public/sprites/original/items/ashveil-power-cell.svg` | 9602 | `57fddb74eab3840c7dfa2ce0c2530d0be8e4e2489b5e83e025f1171203d36d5e` |
| `public/sprites/original/items/ashveil-power-cell-16.png` | 152 | `e86360253d206cb306c83958bde56440dda6103411776a93c0d9bc4af73b3466` |
| `public/sprites/original/items/ashveil-health-draught.png` | 271 | `d76d1bf1dd0af6726a8532d8434cfabca8ba6eb8e5eba73102b38af2f8061703` |
| `public/sprites/original/items/ashveil-health-draught.svg` | 7714 | `ac40adbc4f5c864c64b60aed5961d2916728d6f0bee2ccb40edb97fcc4e124ee` |
| `public/sprites/original/items/ashveil-health-draught-16.png` | 164 | `cb3f2b58af9e3b2876dec83e9a3c00ed4a1205007bf241dedec1e64bc2de3f94` |
| `public/sprites/original/items/ashveil-purification-ampoule.png` | 245 | `fb033b650d289cf56d0c51972bbbcabb5387614d2f362e7ef8040248cf475f6e` |
| `public/sprites/original/items/ashveil-purification-ampoule.svg` | 7855 | `00e064dea0a5c899dc05e803350f8fd00eb850c4371e705c58843e144bbf64db` |
| `public/sprites/original/items/ashveil-purification-ampoule-16.png` | 151 | `35af231399f623bd4e01b4ee049a6ce12283c6bf778f664fa6481265e4981c7e` |
| `public/sprites/original/items/ashveil-nonpill-contact.png` | 10894 | `c30f8bba9ad957afb7d5c53a5bac5ec6236f2fbdd28da1d40911d036e04e9c93` |
| `public/sprites/original/items/ashveil-nonpill-palette.json` | 345 | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |
| `tools/art/nonpill-manifest.fragment.json` | 957 | `76651928a36a09084a50a6160c95e63511e64c733d29a70e04e25834344919c3` |
| `tools/art/nonpill-usage-survey.json` | 6246 | `2ac565def5be1d78969d2a0fcdb1a1523bc0ab844b77f1754739a18a63a587d4` |
| `public/sprites/original/items/ashveil-nonpill-source.json` | 5276 | `549ca9430fc1b971a68423d5df88e235ce2043628f16a558539181babaa51b59` |

## v0.289 적용

Root가 contact를 직접 확인하고 새5키를 등록했다. 실제5Item.sprite만 별도patch로 연결하며 기존pill6/WaterPill과 원래물품상태·UID를 유지한다.20출력 재현을 통과했고 실제UI·전체검증은 별도로 진행한다.
