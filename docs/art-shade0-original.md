# ASHVEIL 그늘 사람 원본 — shade0 적용 전 제작본

2026-10-20, 사용자 요청에 따라 일반 그늘 사람 한 종류를 직접 그렸다. 실제 게임과 분리된 `/workspace/ashveil-shade-art`의 산출물이며, 게임 저장소·Core/Def·기존 문서·실제 manifest·Git은 변경하지 않았다.

## 실제 대상과 문서 근거

`src/content/core/defs/creatures.json`의 `Creature.Shade`는 `char: [shade0, shade1, shade2, shade3]`를 갖는다. `src/core/creatures.ts`는 `r.pick(chars)`로 외형을 선택한다. 네 키 중 고정된 최다 외형이 있는 구조가 아니므로 일반형의 첫 키인 **`shade0`**를 선택했다. 실제 출현 횟수를 측정해 최다라고 판정한 것은 아니다. 별도 우두머리는 `Creature.ShadeChief`의 `shade_chief`다.

| 읽은 근거 | 아트에 반영한 내용 |
| --- | --- |
| `docs/CANON.md` §7.3·D26·D32 | 관로로 내려간 정비공 가족들의 후손, 작은 인간형, 일반 인간보다 작은 체구 |
| `docs/lore/bestiary.md` §17 | 창백한 피부, 넓은 동공, 같은 인간 신체, 누더기 셔츠와 모아 둔 잡동사니 |
| `docs/lore/factions.md` §8.1 | 지하 지파의 생활과 몸, 낮은 조도에 적응한 사람들 |
| `docs/lore/world-bible.md` T10 | 3세대의 어둠·영양 결핍으로 작고 창백해진 후손이라는 설명 |
| 실제 `sprites.json`의 `chars.shade0` | 걷기 12개, 대기는 각 방향 걷기 1번, 기존 공격 프레임 없음 |

창백한 작은 성인 인간, 짧고 드문 어두운 머리, 넓은 검은 동공, 둥근 귀, 평범한 코·입·턱·손발을 그렸다. 체격을 줄여 약탈자·떠돌이보다 낮게 보이게 했고, 경계하는 구부정한 자세를 디자인 선택으로 추가했다. 새 생물종이나 추가 신체 부위는 만들지 않았다. 피부와 손이 누더기 천보다 밝지만 눈은 발광하지 않는다.

누더기 셔츠의 해진 단, 꿰맨 옆 패치, 닳은 허리끈, 허리에 매단 작은 반지 조각을 넣었다. 반지 조각은 주워 모은 물건이라는 시각적 개성이며 실제 아이템이나 장착 상태를 추가하지 않는다. 패치는 인물의 왼쪽 가슴에 놓아 반대 옆모습에는 다른 솔기만 보이게 했다. 고정 칼은 그리지 않아 실제 장비와 중복되지 않는다.

몸·머리·얼굴·손발·의복·방향·보행·공격 팔 좌표를 `tools/art/draw-shade0.mjs`에 새로 작성했다. 이전에 직접 만든 약탈자 도구에서 캔버스·PNG 인코딩·SVG·검토 시트·무결성 검사의 구조만 재사용했다. 기존 외부 시트 또는 이전 인물 PNG의 픽셀을 읽거나 추출·트레이싱·재색칠하지 않는다. 이번 팩은 이미지 생성 도구 호출이나 이미지 편집 없이 작성한 정확한 픽셀 원본이다.

## 제공 파일

| 파일 | 용도 | 크기 |
| --- | --- | --- |
| `public/sprites/original/ashveil-shade0-walk.png` | 투명 RGBA 걷기 12개·공유 대기 | 72 × 128 px |
| `public/sprites/original/ashveil-shade0-attack.png` | 투명 RGBA 새 공격 16개 | 128 × 160 px |
| `public/sprites/original/ashveil-shade0-walk.svg` | 보행 PNG와 같은 픽셀의 편집 원본 | 72 × 128 좌표 |
| `public/sprites/original/ashveil-shade0-attack.svg` | 공격 PNG와 같은 픽셀의 편집 원본 | 128 × 160 좌표 |
| `public/sprites/original/ashveil-shade0-frames.json` | `sheets`·`frames`·`chars.shade0` 조각과 기존/신규 계약 설명 | 총 28프레임 |
| `public/sprites/original/ashveil-shade0-contact.png` | 4방향 전체 포즈, 이름, 두 어두운 배경과 지면선 검토 | 768 × 1584 px, 정수 4배 |
| `public/sprites/original/ashveil-shade0-palette.json` | 피부·천·솔기·금속과 검토 배경색 | 22색 |
| `public/sprites/original/ashveil-shade0-integrity.json` | 파일 크기·해시, 도구 해시, 포즈 해시와 검사 결과 | JSON |
| `tools/art/draw-shade0.mjs` | 제작·재현·읽기 전용 검사 도구 | Node.js 내장 모듈만 사용 |
| `docs/art-shade0-original.md` | 출처·대상·실제 계약·검사 범위 | 이 문서 |

대기는 기존 계약대로 각 방향 보행 1번을 읽으므로 별도의 중복 대기 PNG를 만들지 않았다. SVG는 정수 좌표의 색 경로와 `crispEdges`를 사용하고 PNG와 같은 픽셀을 보존한다. 재현 기준은 도구의 좌표다. SVG만 수작업으로 바꾸면 다음 재생성에서 덮어쓰므로 변경한 디자인을 도구에도 반영한다.

## 실제 계약: 기존 12개 보존 + 선택적 공격 16개 추가

기존 `shade0`에는 **28개가 아니라 12개**의 프레임만 있다. 네 방향 걷기 3개씩이며, 대기는 각 방향 `shade0_w_*1`이다. 걷기는 다른 생물들도 함께 쓰는 `mon1` 시트의 일부를 읽는다. 기존 공격은 별도 그림 없이 렌더러의 기본 돌진 표현을 사용한다.

제공 조각은 `shade0_w_{down,left,right,up}{0..2}` **기존 이름과 walk/idle 배열을 그대로 유지**하고, `shade0_a_{down,left,right,up}{0..3}` **새 이름 16개**를 추가한다. 현재 `CharDef.attack`과 `MapRenderer`가 이미 지원하는 선택적 공격 배열에 연결한다. Core 행동·전투 판정·이동 속도·공격 시간을 추가하거나 수정하는 작업은 아니다. 기존 프레임 이름과 새 이름 사이의 충돌이 없음을 검사했다.

| 동작 | 행 순서 | 셀·열 | 프레임 사각형 |
| --- | --- | --- | --- |
| 걷기·대기 | down·left·right·up | 24×32, 3열 | `['shade0', 열×24, 행×32, 24, 32]` |
| 새 선택적 공격 | down·left·right·up | 32×40, 4열 | `['shade0_atk', 열×32, 행×40, 32, 40]` |

공격은 준비·들기·뻗기·회복의 네 포즈다. 몸은 보행 원본을 `(4,8)`에 놓는다. 공격 팔을 그릴 때 해당 팔의 대기 그림은 생략해 손이 중복되지 않게 했다. 실제 전체 28개 포즈는 서로 다른 바이트를 갖는다.

| 설정 | 적용용 조각의 값 | 이유 |
| --- | --- | --- |
| `anchor` | `[0.5,31/32]` = `[0.5,0.96875]` | 보행 x=12·지면 y=31 |
| `attackAnchor` | `[0.5,39/40]` = `[0.5,0.975]` | 공격 x=16·지면 y=39; 몸 오프셋을 빼면 x=12·y=31 |
| `renderScale` | `1` | 새 원본의 픽셀 밀도를 유지하고 그림 자체를 작게 설계 |
| `headOffset` | `22` | 머리 상단 y=9에서 지면 y=31까지의 높이 |

원본 시트의 셀 크기는 다른 인간과 같지만 보행 실루엣은 y=9..30에 그려져 머리부터 지면까지 약 22px다. 이전 원본 약탈자의 약 28~29px보다 작다. 이 값은 시각적 제작 선택이며 체격 0.7을 키의 정확한 선형 배율이라고 해석한 것은 아니다. Core의 체격·HP·시야·빛 회피는 변경하지 않는다.

기존 `shade0` 걷기 앵커는 `[0.5,0.92]`, 기본 렌더 배율은 0.72다. 추후 통합 시 `sheets`의 **새 키 두 개**와 `frames` 28개, `chars.shade0`를 함께 적용한다. **공용 `mon1` URL·프레임을 교체하지 않는다.** 이 조각은 `shade1`·`shade2`·`shade3`·`shade_chief`·플레이어·약탈자 및 Core Def를 포함하지 않는다. 아직 다른 그늘 사람 외형까지 원본화한 것은 아니다.

## 재현과 실제 확인

격리 폴더 루트에서 실행한다.

```sh
node tools/art/draw-shade0.mjs
node tools/art/draw-shade0.mjs --check
```

첫 명령은 이 폴더의 아트 파일 8개만 생성한다. `--check`는 예상 바이트를 메모리에서 만들어 제공 파일과 비교하며 쓰기를 하지 않는다. 다른 인자와 `--install`은 거부한다. 외부 패키지·네트워크·브라우저·GPU가 필요 없다.

실제로 확인한 범위:

- `--check` 통과: 28개 경계·방향별 수·대기 연결·서로 다른 포즈, 전 포즈 발 기준선, 앵커 일치, 팔레트 색과 0/255 알파, PNG CRC·압축/스캔라인 해독, 생성 바이트 재현.
- 실제 게임 manifest와 읽기 전용 대조 통과: 기존 걷기 12개와 idle 배열 보존, 새 공격 이름 16개 충돌 없음, 공용 `mon1`과 다른 캐릭터가 조각에 없음.
- 원본 전체 걷기 PNG·공격 PNG와 4배 검토 PNG를 `view_image`로 직접 확인. 첫 검토에서 눈이 해골처럼 읽힐 여지를 줄이도록 눈 아래 피부와 코·입을 보완한 뒤 최종 PNG를 다시 확인.
- 문서에 적은 8개 SHA-256과 실제 파일의 일치 검사 통과.

이는 독립 아트 시트 검토이며 실제 게임 화면 검증을 대신하지 않는다. 게임 빌드·전체 회귀·전체 타입 검사·브라우저·GPU를 실행하지 않았다. 이동·공격·사망·조명·시야 아래의 실제 화면 검토는 통합 담당자의 범위다.

## SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `ashveil-shade0-walk.png` | `943934a8ddfb4a8b2f54302ffd111ff3f0dbccef979b1ff133b690d8cf6af45c` |
| `ashveil-shade0-attack.png` | `cf240e0c5f945ecfa09ac15a04076fbfcb4d6ea7b59f2ba9ab8e4f68ee7e6f98` |
| `ashveil-shade0-walk.svg` | `c5e55d2a6d9150589dd9fdc10060bfe583316dad15879eec8b074c2ebf63838c` |
| `ashveil-shade0-attack.svg` | `bacbdd22fc9970513dcd55add6633d80943b02ef9ed6f5ef952f1476c6c59141` |
| `ashveil-shade0-contact.png` | `fdac70131592f602ccfbf209794f4244e52304aaa233216a9f152eb420c4cf37` |
| `ashveil-shade0-palette.json` | `7eccc2e9af97d011f340a0fc167174fa49d0bb393975619f1b93cf275de32549` |
| `ashveil-shade0-frames.json` | `aa84763403e74857d8dc1b7144baf4ac273e1ff873a4bbb6e3bfc9b762915751` |
| `draw-shade0.mjs` | `1918496e01049e44ecea3f6944310dc1682263c62226df7090d33e01110bce6d` |

## v0.285 통합 작업

Root가 전체 검토 시트의 작은 인간형/얼굴·누더기/방향·발 기준을 직접 본 뒤 sheets/기존12+새16 frames/chars.shade0 전체를 실제 manifest에 연결했다. 공용mon1/나머지shade/정상 출현 확률은 유지한다. 실제 게임 검증은 아직 진행 전이다.
