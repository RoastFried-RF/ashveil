# ASHVEIL 원본 그늘 사람 일반형 shade3 — 준비 패키지

2026-10-20에 일반 그늘 사람의 네 번째 외형인 `shade3`의 보행·대기 원본과 새로운 공격 포즈를 직접 그렸다. 현재 상태는 **아트와 병합 조각 준비 완료, 게임 미등록**이다. 모든 새 파일은 `/workspace/ashveil-shade3-art` 안에만 작성했다. 게임 소스·Core·Def·실제 매니페스트·공용 `mon1`·우두머리·다른 외형·기존 문서·git은 변경하지 않았다.

## 정체성과 새 도형

CANON §7.4 D32, `docs/lore/world-bible.md` T10, `docs/lore/factions.md` §8.1, `docs/lore/bestiary.md` §17의 작고 창백한 성인 인간을 표현한다. 피부와 인간형 정체성은 같은 설정이며 새 종족·변이·직업·이야기를 추가하지 않았다. 뾰족한 귀·송곳니·노출된 뼈·발광 눈은 그리지 않았다.

`shade1`과 구분하기 위해 머리띠 없이 옆으로 쓸린 짧은 머리, 폭이 넓은 턱선과 작은 수염 명암, 해진 회갈색 셔츠의 대각 솔기, 한쪽 밝은 소매·무릎 수선과 천 발목 묶음을 새 정수 좌표로 설계했다. 몸통·발·옷·측면·팔꿈치 경로도 새로 작성했다. 피부 면은 눈 아래·코·턱에 남기고 검은 동공은 작게 그렸다.

기존 자체 도구의 좌표 캔버스·관절 선 렌더·PNG/SVG 인코더·검토 시트 구조와 21색 재질/피부 팔레트를 재사용했다. 외부 이미지·기존 시트·생성 이미지의 픽셀을 입력·추출·트레이싱·재색칠하지 않았다. 왼쪽과 오른쪽 옆모습은 각자 좌표로 작성한다.

## 실제 기존 계약과 새 공격

작업 시작 시 실제 `src/client/sprites.json`의 `chars.shade3`에는 방향별 보행 3개와 가운데 대기 1개만 있었으며 **attack은 없었다**. 보행 셀은 `mon1`의 x=0/24/48, 방향 행 y=128/160/192/224에 있었다.

본 패키지는 기존 보행 이름 12개와 네 방향 idle 목록을 그대로 보존한다. **공격 16개는 이번에 새로 만든 동작**이며 기존 공격을 교체한 작업으로 기록하지 않는다.

| 항목 | 값 |
| --- | --- |
| 보행 원본 | `ashveil-shade3-walk.png`, 72 × 128 px |
| 보행 셀 | 24 × 32 px, 3열 × 4행 |
| 방향 행 | `down`, `left`, `right`, `up` |
| 기존 보행 이름 | 방향별 `shade3_w_{방향}0`, `1`, `2` |
| 기존 대기 | 방향별 `shade3_w_{방향}1` |
| 신규 공격 원본 | `ashveil-shade3-attack.png`, 128 × 160 px |
| 신규 공격 셀 | 32 × 40 px, 4열 × 4행 |
| 신규 공격 이름 | 방향별 `shade3_a_{방향}0`, `1`, `2`, `3` |
| 신규 공격 포즈 | 준비·올리기·뻗기·회복, 고정 무기 없는 어깨·팔·손 동작 |

## 지면과 병합 조각

`tools/art/shade3-manifest.fragment.json`은 `sheets`, `frames`, `chars` 병합 조각이며 실제 게임 매니페스트를 읽거나 수정하는 설치 기능은 없다.

- 시트 키: `shade3`, `shade3_atk` 두 개만 포함한다.
- 캐릭터 키: `shade3` 하나만 포함한다.
- 프레임: `shade3_` 이름 28개만 포함한다.
- 보행 anchor: `[0.5, 31/32]`.
- 공격 anchor: `[0.5, 39/40]`.
- 공격 셀 안의 몸 위치: `[4, 8]`. `39 − 8 = 31`로 지면이 같다.
- `renderScale: 1`, `headOffset: 22`.
- 실제 12개 보행 포즈의 불투명 픽셀 범위는 모두 y=9~30이며 높이는 22px다. 발 밑면은 y=31이다.

기존 anchor y=0.92와 암묵 배율 0.72를 유지한 변경이라고 주장하지 않는다. 새 원본의 22px 몸과 이미 합의한 그늘 사람 원본 지면·높이 규격에 맞춘 명시값이다. 통합 담당자가 조각을 병합하고 실제 게임 표시를 별도 확인한다.

## 편집 원본과 재현

`tools/art/draw-shade3.py`가 신체·옷·방향·보행·공격·팔레트의 제작 원본이다. Python 표준 라이브러리만 사용하며 이미지 입력·다운로드 없이 자신의 아트/팔레트/출처/병합 조각 8개만 생성한다.

```sh
python3 tools/art/draw-shade3.py
python3 tools/art/draw-shade3.py --check
```

첫 명령은 원본을 재생성한다. 두 번째는 결과를 메모리에서 다시 만들어 저장된 바이트와 비교하고 파일을 쓰지 않는다. 이번 제작에서 `--check`를 실행해 8개 파일의 재현을 확인했다.

같은 이름의 SVG는 PNG와 동일한 정수 픽셀의 편집 원본이다. `ashveil-shade3-palette.json`에 21색 팔레트가 있으며 `ashveil-shade3-source.json`에 기존 계약·새 동작 수·제작 방법·해시가 있다.

`ashveil-shade3-contact.png`는 640 × 1304 px 4배 검토 시트다. 위는 보행 12개, 아래는 신규 공격 16개이며 각 방향 행은 D/L/R/U다.

## 직접 확인과 검증

보행 PNG·공격 PNG·전체 검토 시트를 각각 `view_image`로 실제 열어 확인했다. 가벼운 아트 검사로 다음 사항을 확인했다.

- `--check`의 8개 파일 결정적 바이트 재현.
- PNG 크기·RGBA 형식·알파 값 0/255와 SVG 전 픽셀 일치.
- 28개 프레임의 시트 경계와 외곽 여백·방향별 포즈 차이.
- 실제 기존 매니페스트와 12개 보행 이름·네 방향 idle 목록의 정확한 일치.
- 기존 attack 부재와 신규 16개 공격의 구분.
- 병합 조각의 shade3 전용 키 및 같은 지면·배율·상태 표시 높이.
- 실제 보행 12개 모두 22px 높이.

실제 게임 등록·실행 검증은 아직 수행하지 않았다. 공용 mon1·우두머리·다른 외형·Core·Def·실제 게임 매니페스트·git은 수정하지 않았고 GPU·브라우저·프로젝트 검사·무거운 검사는 실행하지 않았다.

## SHA-256

제작 도구: `d4c0ef4b90dd43b85640108d8e52d7411d242779faca5cafc91b4ab58c604fec`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/ashveil-shade3-walk.png` | 1247 | `037b2fa4bca3b27e07cd743dede5b1b4db7c9ae581d4455c7dcfdc48d8683b94` |
| `public/sprites/original/ashveil-shade3-attack.png` | 1618 | `ce54a8b6922068f17483bf9e2d5938a7eaf25b9e62aced7c1c0710716bb8cdce` |
| `public/sprites/original/ashveil-shade3-walk.svg` | 93087 | `b6d6128b769aab0163fa7a50299c40af4b1919783b86dd387e28f270c1419f1a` |
| `public/sprites/original/ashveil-shade3-attack.svg` | 137765 | `d96f248158d4d897bdc355f538b2d9ca1b733cec2274e6fd748e4b7c13181a36` |
| `public/sprites/original/ashveil-shade3-contact.png` | 13837 | `ed87ca15b221a296e7395524d82daf6bdd7e2e425af139afb7da997bcd9fed51` |
| `public/sprites/original/ashveil-shade3-palette.json` | 381 | `a9326554f9d37fdc4ca0db6c1e4ffd8cb797cebe769eb057ac03daed04491e50` |
| `tools/art/shade3-manifest.fragment.json` | 4113 | `a10deb2bf0971a551c631e821c84adccc9bd110d98dd0a0df7de6ee62186f8cf` |


## v0.285–286 통합 작업

Root가 전체 검토 시트를 직접 열고 새 시트2개/기존12+새16프레임/chars.shade3을 실제 manifest에 연결했다. 공용mon1/정상 종·외형 선택 확률은 유지한다. 실제 게임 검증은 아직 진행 전이다.
