# ASHVEIL 원본 대도 아이콘 — 283용 준비 패키지

2026-10-20에 정본 `docs/design/07-combat.md` §7.1의 후속 양손 도검인 대도를 위한 픽셀 아트를 직접 그렸다. 제작 상태는 **원본 리소스 준비 완료, v0.283 게임 연결 작업 중**이다. 기능의 선등록·실제 Def·아틀라스 연결·게임 검증은 통합 담당자가 별도 진행한다.

모든 새 파일은 `/workspace/ashveil-greatsword-art` 안에만 작성했다. MAIN 소스·Def·아틀라스·CREDITS·기존 문서·git은 변경하지 않았다.

## 원본 디자인과 파일

`public/sprites/original/items/ashveil-greatsword.png`는 32 × 32 px 투명 RGBA PNG다. `ashveil-greatsword.svg`는 동일한 픽셀을 정수 사각형으로 보존한 편집 원본이다.

투창과 구분되도록 날이 차지하는 면적을 넓히고 금속의 평평한 면·낡은 모서리·작은 흠집을 그렸다. 양손으로 쥐는 긴 목재 손잡이는 어두운 가죽 띠로 감고, 짧은 직선형 가드와 작은 금속 끝마개만 더했다. 황동 가드·바랜 청록 손잡이 고리·낡은 목재·차가운 금속을 기존 원본 계열과 같은 19색으로 배치했다. 보석·마법 발광·판타지 문양·브랜드·문자는 없다.

도형과 픽셀을 모두 새 정수 좌표로 설계했다. 외부 팩을 참조 이미지로 입력하거나 트레이싱·추출·크롭·재색칠하지 않았다. 기존 자체 원본의 Canvas/PNG/SVG 렌더 구조와 팔레트만 재사용했다.

## 권장 연결

| 항목 | 값 |
| --- | --- |
| frame | `greatsword` |
| sheet | `original_greatsword` |
| 이미지 | `public/sprites/original/items/ashveil-greatsword.png` |
| 영역 | `[0, 0, 32, 32]` |

이 표는 향후 연결 제안이다. 현재 게임에 적용되었다는 의미가 아니며, 아이콘에는 실제 장비 상태·품질·공격 연출을 그려 넣지 않았다.

## 재현 도구와 직접 확인

`tools/art/draw-greatsword.py`가 모든 픽셀 좌표·재질 클러스터·팔레트의 제작 원본이다. Python 표준 라이브러리만 사용하며 자신의 새 아트 파일 5개만 생성한다. 저장된 그림을 입력받거나 편집하지 않는다.

```sh
python3 tools/art/draw-greatsword.py
```

도구와 제공 파일을 같은 상대 경로로 옮긴 뒤 재생성할 수 있다. `--check`는 저장된 파일과 재생성 바이트를 비교하는 선택 기능이며 이번 격리 제작 단계에서는 실행하지 않았다.

- 실제 32 × 32 PNG를 `view_image`로 열어 넓은 날·긴 손잡이·가드를 직접 확인했다.
- `ashveil-greatsword-contact.png`(192 × 248 px)의 큰 그림은 4배 정수 렌더, 아래 둘은 어두운 배경/밝은 배경에서의 실제 1배 표시다. 검토 시트도 직접 확인했다.
- PNG 헤더에서 원본과 검토 시트의 크기를 읽었다.
- `ashveil-greatsword-palette.json`에 19색 재질 팔레트, `ashveil-greatsword-source.json`에 제작 방법·프레임/시트 제안·해시가 있다.
- PNG는 불투명 픽셀과 완전 투명 배경으로 구성하며 블러·보간·반투명 테두리는 없다.
- 프로젝트 테스트·타입 검사·브라우저·GPU·git은 실행하지 않았다.

## SHA-256

제작 도구: `bfc437ef45ccfb34ead32224ad60c2140e54c7c9c75744d89fc2d1ca863ecc24`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `ashveil-greatsword.png` | 277 | `260672678ad62113a7e37dbe546d6fc857a57fbbfd28a3bdac886b04e2dc4092` |
| `ashveil-greatsword.svg` | 8971 | `5ed8683a35344f1cb78073898775854e4f40bba064f19119654a878432048c5e` |
| `ashveil-greatsword-contact.png` | 1611 | `4e77f7e4590efc0a3fbbf20dbbdfabd948631804be05516009416e4003ad1ee4` |
| `ashveil-greatsword-palette.json` | 345 | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |


통합 작업에서13에 먼저 등록한 뒤 실제 Item.Greatsword/Recipe.Greatsword와 위 프레임/시트를 연결했다. Root도 검토 시트를 열어 확인했다. 실제 게임 화면 검증은 아직 남아 있다.

283의 실제 Native7장/전체191복원2/16단계/700TU와 공통8장/두 화면 크기 입력을 통과했다. 통합 담당자는 Native7장과 두 타이틀을, 독립 UI 검토자는15장 모두를 실제 열어 확인했다. 색/포즈의 원본 검토 시트와 실제 조명·시야의 게임 장면을 구분하며 조명/시야 규칙을 아트 검토를 위해 바꾸지 않았다.
