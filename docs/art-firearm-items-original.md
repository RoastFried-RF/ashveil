# ASHVEIL 원본 화기 아이콘 — 격리 제작 패키지

2026-10-20에 부싯돌 장총·납탄·흑색화약 1회분·총기 기름용 픽셀 아이콘을 직접 그렸다. 이 패키지는 `/workspace/ashveil-firearm-art`에서만 작성했으며 MAIN 저장소의 Def·아틀라스·매니페스트·CREDITS·게임 소스에 등록하지 않았다. 디자인 문서의 기능 선등록과 실제 게임 연결은 통합 담당자가 진행한다.

## 파일과 구성

모든 아이콘은 32 × 32 px RGBA PNG, 불투명 픽셀과 완전 투명 배경으로 구성된다. 새 실루엣·재질 클러스터·작은 부품은 코드의 정수 좌표로 직접 작성했다. 외부 이미지를 입력받거나 기존 아이콘을 추출·크롭·재색칠하지 않았다. 보관 아이콘의 자체 제작 Canvas/PNG/SVG/검토 시트 구조와 19색 재질 팔레트만 재사용했다.

| 품목 | 제공 PNG | 권장 별도 프레임 | 시각적 특징 |
| --- | --- | --- | --- |
| 부싯돌 장총 | `public/sprites/original/items/ashveil-flintlock-musket.png` | `flintlock_musket` | 긴 강철 총열, 좁은 목재 손잡이와 넓은 개머리판, 작은 부싯돌 잠금장치, 낡은 구리 총열 띠 |
| 납탄 | `public/sprites/original/items/ashveil-lead-ball.png` | `lead_ball` | 무광의 둥근 납 구체, 차분한 명암 덩어리와 작은 주조 이음 자국 |
| 흑색화약 1회분 | `public/sprites/original/items/ashveil-powder-charge.png` | `powder_charge` | 각진 종이 접힘과 청록 천 묶음, 옆의 작은 검은 알갱이 |
| 총기 기름 | `public/sprites/original/items/ashveil-gun-oil.png` | `gun_oil` | 작은 청록 유리병, 넓은 구리·목재 마개, 글자 없이 기름방울만 그린 종이 표식 |

네 프레임 영역은 `[0, 0, 32, 32]`이다. 동일한 이름의 SVG는 각 PNG 픽셀을 정수 사각형으로 보존한 편집 원본이다. 아이콘에 발사·장전·고장·수량·품질 상태를 넣지 않았으며 실제 상태와 수량 표시는 게임이 담당한다. 현대식 탄피·탄창·스코프·브랜드·문자는 그리지 않았다.

## 편집 원본과 재현

`tools/art/draw-firearm-items.py`에 모든 픽셀 좌표와 팔레트가 있다. 이미지 라이브러리나 외부 다운로드 없이 Python 표준 라이브러리로 PNG와 SVG를 인코딩한다. 도구의 자체 파일 11개만 출력하며 게임 등록 기능은 없다.

```sh
python3 tools/art/draw-firearm-items.py
```

위 명령은 패키지를 MAIN으로 옮긴 뒤에도 같은 상대 경로에서 재생성할 수 있다. 검토 시트는 원본 좌표 배열을 4배 정수 배율로 직접 렌더하며 저장된 PNG를 편집하지 않는다. 편집 없이 바이트가 같은지 확인하는 `--check` 옵션도 제공하지만, 이번 격리 제작 단계에서는 프로젝트 테스트와 함께 실행하지 않았다.

## 실제 확인

- 네 32 × 32 PNG를 각각 `view_image`로 열어 투명 배경과 실루엣을 확인했다.
- `ashveil-firearm-items-contact.png`(768 × 248 px)의 4배 확대와 어두운/밝은 배경에서의 실제 1배 모습을 확인했다.
- PNG 헤더에서 네 아이콘의 32 × 32 크기와 검토 시트의 크기를 읽어 확인했다.
- 각 제공 파일의 바이트 수·SHA-256과 도구의 SHA-256을 기록했다.
- 프로젝트 테스트·브라우저·GPU는 실행하지 않았다.

## 팔레트와 해시

`ashveil-firearm-items-palette.json`은 낡은 목재·가죽·구리·상아 종이·차가운 금속·바랜 청록에 쓰는 19색 팔레트다. `ashveil-firearm-items-source.json`에 동일한 해시와 원본 제작 방법이 있다.

제작 도구 SHA-256: `c0be691a45de5b9109825d949377ef3e7a7fa015c48e9f55179f73513acfb807`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `ashveil-flintlock-musket.png` | 351 | `258775a1be016c997fa30682979885302944db48e463b2ffb8ff1c73e8b62412` |
| `ashveil-flintlock-musket.svg` | 11531 | `90cd10bb8c079e746cfb7a9735b0c852dd766a179a21ffe9f92367d99d6dd1ff` |
| `ashveil-lead-ball.png` | 224 | `6d061c64b1ddeaa80746c9c75a0c5d6bf45478d19b0332b9446ae2113dc876bb` |
| `ashveil-lead-ball.svg` | 5450 | `de9b0ca7df180c23bde46ee46d7d514a42100b376dd272a5aa7728d5b4e014b2` |
| `ashveil-powder-charge.png` | 338 | `9d633f674a09dfaa579a899fff2fcfef3f56a015199a9e282179c8f7cd64c5b8` |
| `ashveil-powder-charge.svg` | 11489 | `2f6fb5e34ab7b8cce5d80734a1f4130b7f34c982581f8fa31f803739d82f215e` |
| `ashveil-gun-oil.png` | 307 | `7b88f18482c922a9919829152c8df5ec6873e96ba95fc0d0d26bb516635d2fef` |
| `ashveil-gun-oil.svg` | 9346 | `77aa7167bbb55603da7a4ebf874dae33c45d34847cdc121f0c9f60da7d47c3f4` |
| `ashveil-firearm-items-contact.png` | 6375 | `7bca09c1062c3de5911d5d09fe6238687bfb31c2f48ada0e7f1d054a953003b3` |
| `ashveil-firearm-items-palette.json` | 345 | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |


## Root 통합 진행

v0.280에서13의4종 선등록 뒤 실제 Def와 독립 프레임4개/크레딧에 적용했다. Root도 확대/1배 검토 시트를 열었고 `python3 tools/art/draw-firearm-items.py --check`가11개 원본의 바이트 일치를 확인했다. 실제 게임 화면 연결과188 각인은 별도 검증 중이며 격리 제작 단계의 미실행 기록과 구분한다.
