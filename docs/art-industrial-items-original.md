# ASHVEIL 원본 산업 화기 아이콘 — 격리 제작 패키지

2026-10-20에 회전식 권총·볼트식 소총·공장 실탄·재생 실탄·빈 탄피·뇌관을 직접 픽셀로 그렸다. 모든 새 파일은 `/workspace/ashveil-industrial-art` 안에만 작성했다. MAIN 저장소의 소스·Def·아틀라스·CREDITS·기존 문서는 변경하지 않았다. 기능의 디자인 선등록과 실제 게임 연결은 통합 담당자가 진행한다.

## 원본과 권장 연결

각 아이콘은 32 × 32 px의 투명 RGBA PNG이다. 같은 이름의 SVG는 PNG와 동일한 픽셀을 편집 가능한 정수 사각형으로 보존한다. 여섯 가지 실루엣·금속 클러스터·목재·탄피 입구·재사용 자국은 모두 새 좌표로 직접 설계했다. 기존 화기 아이콘의 자체 제작 렌더 구조와 19색 팔레트만 재사용하며 이미지를 입력받거나 추출·변환·재색칠하지 않았다.

| 품목 | PNG 파일 | 권장 별도 프레임 | 구분 요소 |
| --- | --- | --- | --- |
| 회전식 권총 | `public/sprites/original/items/ashveil-revolver.png` | `revolver` | 회전 탄창의 홈, 노출 격철, 곡선 목재 손잡이, 열린 방아쇠울 |
| 볼트식 소총 | `public/sprites/original/items/ashveil-bolt-rifle.png` | `bolt_rifle` | 긴 강철 총열과 목재 개머리판, 밖으로 돌출된 볼트 손잡이 |
| 공장 실탄 | `public/sprites/original/items/ashveil-factory-round.png` | `factory_round` | 탄두와 탄피가 결합된 한 발, 균일한 황동 측면과 림 |
| 재생 실탄 | `public/sprites/original/items/ashveil-reclaimed-round.png` | `reclaimed_round` | 탄두와 탄피가 결합된 한 발, 무딘 금속색 탄두·마모와 눌림·바랜 청록 목 봉인 |
| 빈 탄피 | `public/sprites/original/items/ashveil-empty-case.png` | `empty_case` | 탄두 없이 어두운 타원형 입구가 열린 황동 관 |
| 뇌관 | `public/sprites/original/items/ashveil-primer-cap.png` | `primer_cap` | 높이가 낮은 작은 금속 캡, 황동 테두리와 평평한 금속 면 |

모든 권장 프레임의 영역은 `[0, 0, 32, 32]`이다. 실탄 두 종류는 탄약 상자나 묶음 대신 완성된 한 발로 표현했다. 뇌관은 탄피보다 폭과 높이가 작고 낮은 캡 실루엣으로 구분한다. 스코프·현대 플라스틱 부품·브랜드·문자·품질색·선택 상태·탄약 수량 표시는 그림에 넣지 않았다.

## 편집·재생성

`tools/art/draw-industrial-items.py`가 모든 도형·색·픽셀의 제작 원본이다. Python 표준 라이브러리만 사용하며 외부 이미지·라이브러리·다운로드 없이 자신의 새 아트 파일 15개를 생성한다. 게임 등록 기능은 없다.

```sh
python3 tools/art/draw-industrial-items.py
```

도구와 제공 파일을 같은 상대 경로로 MAIN에 옮긴 후에도 위 명령으로 재생성할 수 있다. SVG에는 외부 이미지 참조가 없으며 PNG에는 보간·반투명 테두리·블러를 적용하지 않았다. 보관 아이콘/기존 화기 패키지의 다른 파일을 덮어쓰지 않는다.

`--check`는 저장된 파일과 재생성 바이트가 같은지 확인하는 선택 기능이다. 이번 제작 단계에서는 실행하지 않았다.

## 검토 파일과 확인

- `public/sprites/original/items/ashveil-industrial-items-contact.png`: 576 × 496 px. 위 행은 권총·소총·공장 실탄, 아래 행은 재생 실탄·빈 탄피·뇌관이다. 각 칸의 큰 그림은 4배 정수 렌더, 아래 둘은 어두운 배경/밝은 배경에서 실제 1배 표시다.
- 검토 시트와 여섯 PNG를 각각 `view_image`로 실제 확인했다.
- PNG 헤더에서 여섯 아이콘의 32 × 32 크기와 검토 시트 크기를 읽어 확인했다.
- `ashveil-industrial-items-palette.json`에 기존 원본 화기와 같은 19색 재질 팔레트가 있다.
- `ashveil-industrial-items-source.json`에 제작 방법·도구 해시·프레임 제안·전체 제공 파일의 해시가 있다.
- 프로젝트 테스트·타입 검사·브라우저·GPU·git은 실행하지 않았다.

## SHA-256

제작 도구: `e4f7a9dd35d57cf681765386803692cbb801b844aa5b40ddf87f8b33ce452dae`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `ashveil-revolver.png` | 331 | `a6bb58845ad5f4d440af1704ba4d724a8816af300778d941fb851a6fb1809677` |
| `ashveil-revolver.svg` | 8969 | `eec1ed3e4aa25bb6d06d3da725444b247a2fc4f68037444e5361b5843e680771` |
| `ashveil-bolt-rifle.png` | 285 | `6d2108c88668a00308d0a0167638d196221f0178f23178758bd747980650ede3` |
| `ashveil-bolt-rifle.svg` | 9255 | `e0ac6db01a74c5a6eff05ca284dcf895914f02929127ee863793d005a8664181` |
| `ashveil-factory-round.png` | 216 | `9a7049abcc2896e6f37c69c7f7322a674971baba7ab5a9b95052efcd335dfd37` |
| `ashveil-factory-round.svg` | 8049 | `d78cb6e77060fb8979f42c80559df227a1a4f6c1ae2bc5ab64f343c76954118a` |
| `ashveil-reclaimed-round.png` | 279 | `84ac474f29718e396ecb4498094b0f9b8f38e69c1fca324bd3bf8b7234240a60` |
| `ashveil-reclaimed-round.svg` | 8116 | `c56b0604e778fc87684c3cdf93c0c34a2b71433319726b21eb3dcd64258c90a8` |
| `ashveil-empty-case.png` | 220 | `d4172d91cd9a50f036844c6f4ffbaf18ff07dc4cea890cc4e0758724494f665f` |
| `ashveil-empty-case.svg` | 8158 | `6cbbe94c1127fb354f1fa6ab1f4a55fa5c02b655d5772d1fe0ed345f546a9fd3` |
| `ashveil-primer-cap.png` | 208 | `ca32eb369d761042ddbac350278d3afb264aad1af9eeefa09f0f16c999bcb2f1` |
| `ashveil-primer-cap.svg` | 3867 | `9b8eb8f100314521b3ee3495a25f8692f051e9a6981719b51c3b82da9e56965b` |
| `ashveil-industrial-items-contact.png` | 8430 | `9704638f78bdf4660852a314492374d6812a7b4f02a88dd2ee535451ce78c550` |
| `ashveil-industrial-items-palette.json` | 345 | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |


## Root 통합 진행

v0.281에서13 전체를 읽고 여섯 물품을 먼저 등록한 뒤 실제 Def/프레임6개와 크레딧에 연결했다. Root도4배/1배 검토 시트를 직접 열었으며 재현 도구의 --check가15개 파일 바이트 일치를 확인했다. 실제 게임 입력/회귀 검증은 별도 진행 중이다.
