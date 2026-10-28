# ASHVEIL 원본 수리 드론 Tender Drone — 준비 패키지

2026-10-21에 실제 `Creature.TenderDrone`의 방향별 보행·대기·공구 공격과 정지 상태를 위한 원본 픽셀 아트를 직접 그렸다. 상태는 **원본과 병합 조각 준비 완료, 게임 미등록**이다. 모든 새 파일은 `/workspace/ashveil-drone-art` 안에만 작성했다. 실제 게임 소스·Core·Def·공용 시트·매니페스트·기존 문서·git은 변경하지 않았다.

## 읽은 설정과 실제 구현

CANON §3.2~3.5, `docs/lore/world-bible.md` §4.1~4.3, `docs/lore/bestiary.md` §0.3/§4, `src/content/core/defs/machines.json`, 실제 `src/client/sprites.json`과 renderer의 캐릭터 생성·기계 정지 외형·공격 프레임 경로를 확인했다.

실제 식별자와 기계 계약:

| 항목 | 실제 값 |
| --- | --- |
| Creature | `Creature.TenderDrone` |
| 활성 sprite/char | `tender_drone` |
| dormantChar | `tender_drone_inert` |
| 몸 | `Body.TenderDrone` → `Body.Mechanical` |
| 구동 다리 | `DriveLeg1`~`DriveLeg6`, 여섯 개 |
| 기타 주요 부품 | 섀시·내부 코어·전원셀·냉각 루프·센서 마스트·좌우 매니퓰레이터·공구 헤드 |
| 기본 자연 공격 | `cut`, 절단 집게, 베기·갑옷 내구 손상 |
| 추가 자연 공격 | `weld`, 용접 불꽃, 화상·대상 열량 |
| 설정 | 정원사망의 소형 6족 정비 기계, 18kg·높이 0.5m, 야생화 후 잔해에서 부품 수거 |

도감의 수리 드론은 피 대신 유압액을 잃고, 통증 대신 과열과 부품 손상을 겪는다. 이 아트는 실제 상태 값을 바꾸거나 고정된 누출·과열 효과를 덧붙이지 않는다.

## 원본 외형과 동작

여섯 관절 다리, 등 위 냉각판 세 개, 짧은 광학 센서, 서로 다른 절단 집게와 작은 용접 노즐, 교체 패널·돌출 관절·부식된 구리 배관을 새 좌표로 그렸다. 낡은 회사 정비 기계라는 재질을 바랜 청록 도장·재 먼지·둔한 금속·탁한 구리의 16색으로 표현한다. 코어는 불투명 섀시 안에 있으며 외부의 마법 보석처럼 그리지 않았다.

광학 센서의 작은 호박색 점은 낮은 면적의 표시부다. 인간형 얼굴·유기물 피부·곤충 날개·고유 브랜드·읽을 수 없는 장식 글자는 추가하지 않았다. 세 냉각판은 고정된 금속판이며 두 작은 공구팔은 여섯 구동 다리와 별도다.

보행은 관절과 지지 발을 바꾸는 삼각 지지 교대 동작이다. 네 방향에서 센서·공구·판넬·냉각판의 배치가 달라진다. 정지 상태는 같은 기계의 다리와 공구를 접고 센서 표시를 꺼 낮아진 섀시로 표현한다. 파손 조각이나 새 부품을 영구적으로 추가하지 않았다.

공격은 공구팔 준비·벌리기·절단 집게 닫기/내밀기·회복의 네 포즈다. 현재 renderer는 방향별 한 attack 목록을 읽고 `cut`/`weld` ID별 시트를 고르지 않는다. 따라서 공통 공구팔 전개를 제공하고 용접 불꽃을 모든 공격 프레임에 고정하지 않았다. `weld`의 불꽃·피해·열량은 실제 공격 이벤트에 따른 게임 연출이 담당할 영역이며 이 패키지는 renderer나 Core를 수정하지 않는다.

외부 팩·기존 드론 이미지·생성 이미지를 입력·추출·크롭·트레이싱·재색칠하지 않았다. 자체 좌표 캔버스·PNG/SVG 인코더·검토 시트 구조를 재사용했고 섀시·다리·공구·방향·동작은 새 픽셀 좌표로 작성했다.

## 기존 계약 보존과 새 프레임 구분

작업 시작 시 활성/정지 드론은 각각 **정적 32 × 32 프레임 하나**를 walk/idle 네 방향에서 함께 사용했다. 두 char 모두 attack은 없었고 `anims` 항목도 없었다. 기존 anchor는 `[0.5, 0.8]`, renderer의 암묵 배율은 0.72였다. 기존 12보행이나 16공격이 있었다고 기록하지 않는다.

기존 두 프레임 키 `tender_drone`, `tender_drone_inert`를 각각 새 아래 방향 대기의 alias로 보존했다. 두 기존 char 키와 두 기존 sheet 키도 유지하며 공구 공격 sheet 하나만 추가한다. 방향을 새로 구분하므로 char의 walk/idle 목록은 새 방향 프레임을 읽는다.

| 제공 내용 | 파일·계약 |
| --- | --- |
| 새 보행 12개 | `ashveil-drone-walk.png`, 96 × 128 px, 32 × 32 셀 3열 × 4행 |
| 보행 frame | `tender_drone_w_{방향}0`, `1`, `2` |
| 새 idle | 방향별 `tender_drone_w_{방향}1` |
| 새 공구 공격 16개 | `ashveil-drone-attack.png`, 160 × 160 px, 40 × 40 셀 4열 × 4행 |
| 공격 frame | `tender_drone_a_{방향}0`, `1`, `2`, `3` |
| 새 정지 방향 4개 | `ashveil-drone-inert.png`, 32 × 128 px, 32 × 32 셀 1열 × 4행 |
| 정지 frame | `tender_drone_i_{방향}`, 해당 방향 walk/idle에서 같은 한 프레임 사용 |
| 기존 alias 2개 | `tender_drone` = `tender_drone_w_down1`, `tender_drone_inert` = `tender_drone_i_down` |
| 방향 행 순서 | `down`, `left`, `right`, `up` |

전체 프레임 조각은 새 32포즈와 보존 alias 2개로 34개다. 정지 char에는 attack을 추가하지 않았다. 기존 renderer는 기계가 죽거나 의식을 잃으면 Def의 dormantChar를 선택하므로 활성/정지 char의 배율과 앵커를 같게 명시했다.

## 지면·픽셀 높이·배율

`tools/art/drone-manifest.fragment.json`은 `sheets`, `frames`, `chars` 병합 조각이며 게임 매니페스트를 직접 수정하지 않는다.

| 항목 | 값 |
| --- | --- |
| sheet 키 | `tender_drone`, `tender_drone_atk`, `tender_drone_inert` |
| char 키 | `tender_drone`, `tender_drone_inert` |
| 활성/정지 anchor | `[0.5, 31/32]` |
| 공격 anchor | `[0.5, 39/40]` |
| 공격 셀 안의 몸 위치 | `[4, 8]` |
| 원본 배율 | 두 char 모두 `renderScale: 0.75` |
| 상태 표시 높이 | 두 char 모두 `headOffset: 17` 월드 px |

`39 − 8 = 31`이므로 공격과 보행의 발 밑면은 같은 지면이다. 모든 활성/정지 포즈의 마지막 발 픽셀은 y=30, 아래 지면은 y=31이다. 활성 방향별 native 픽셀 범위는 y=9~30 / 10~30 / 11~30, 높이 20~22px다. 0.75배에서 가장 높은 보행 실루엣은 16.5 월드 px이므로 상태 표시 높이는 17이다. 정지 실루엣은 y=13~30 또는 14~30으로 더 낮다. 공격 셀은 공구팔의 이동 범위를 포함한다.

기존 anchor·암묵 배율을 그대로 유지했다고 주장하지 않는다. 새 원본의 같은 지면과 작은 기계의 표시 크기를 위한 명시값이며, 실제 게임 표시 검증은 통합 단계에서 진행한다.

## 재현 원본과 제공 파일

`tools/art/draw-drone.py`에 모든 좌표·재질·관절·방향·포즈·팔레트가 있다. Python 표준 라이브러리만 사용하며 이미지 입력·다운로드 없이 자신의 아트/팔레트/병합 조각/출처 파일 10개만 생성한다.

```sh
python3 tools/art/draw-drone.py
python3 tools/art/draw-drone.py --check
```

첫 명령은 원본을 재생성하고 두 번째는 같은 바이트를 메모리에서 다시 만들어 저장된 파일과 비교하며 파일을 쓰지 않는다.

PNG와 같은 이름의 SVG는 동일한 정수 픽셀의 편집 원본이다. `ashveil-drone-palette.json`은 16색 팔레트, `ashveil-drone-source.json`은 실제 Creature/몸/기존 계약·새 프레임 수·방법·해시를 보존한다.

`ashveil-drone-contact.png`는 752 × 1512 px 4배 검토 시트다. 위는 12보행, 중간은 16공구 공격이며 방향 행은 D/L/R/U다. 맨 아래는 D/L/R/U 정지 네 방향이다.

## 직접 확인과 저비용 아트 검사

보행·공격·정지 원본 PNG와 전체 검토 시트를 각각 `view_image`로 열어 직접 확인했다. 다음 가벼운 검사도 통과했다.

- `--check`: 10개 파일의 결정적 바이트 재현.
- 세 PNG의 크기·RGBA 형식·알파 값 0/255와 SVG 전 픽셀 일치.
- 34개 frame 영역·외곽 여백과 네 방향/포즈의 차이.
- 실제 기존 두 frame/char 키와 32 × 32 alias 크기 보존.
- 기존 정적 공용 방향/attack 부재와 새 동작의 구분.
- 같은 발 지면·배율·상태 표시 높이와 방향별 native 픽셀 높이.
- Core Def를 읽기만 하여 여섯 DriveLeg, 실제 활성/정지 char, `cut`/`weld` 자연 공격 ID를 대조.

게임 등록·Core/Def/renderer 변경·게임 실행 검증은 아직 수행하지 않았다. 게임 소스·공용 시트·실제 매니페스트·git을 변경하지 않았으며 GPU·브라우저·프로젝트 전체 검사·무거운 검사는 실행하지 않았다.

## SHA-256

제작 도구: `db0015d46c06f56facc837b1c531597d48ffcc6e692a1ba3f85f2d71ed49228b`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/ashveil-drone-walk.png` | 1650 | `21e1af11d8344f89883ebccb618820bed3da63d725cddba6863b6d2a77c87732` |
| `public/sprites/original/ashveil-drone-attack.png` | 1955 | `0516c4ff9a169ccfb345a4b065bcb2fbcf6c6e5a89edaffd3044a3523faaa2b4` |
| `public/sprites/original/ashveil-drone-inert.png` | 704 | `1ea607683c2af5afef6a46c91f8e272dc9f97f0c5b232bf467eb2a6bd2d0f48c` |
| `public/sprites/original/ashveil-drone-walk.svg` | 150799 | `4bc8be5e99649b8809b7b50f402afcf6a609e50c3f7bd98b6033e5f61d08cb0e` |
| `public/sprites/original/ashveil-drone-attack.svg` | 203852 | `71532a5b179a437c0e7770fa745c8bb9ea4a959eab2c935803117a20f2d77bac` |
| `public/sprites/original/ashveil-drone-inert.svg` | 35742 | `f30745c8881796c3332c8fe65658c47c36e2a47276c9e3d9512b7a08d0822a66` |
| `public/sprites/original/ashveil-drone-contact.png` | 19327 | `49fd260085d67acddb85ef28ad13c2c3c3f507d7e6336131f1f8da9235ef4513` |
| `public/sprites/original/ashveil-drone-palette.json` | 291 | `462e37475941f151f908be0d56579a02fa8b5ed0609d4ae67cb7be59f5d41049` |
| `tools/art/drone-manifest.fragment.json` | 6002 | `d9463235e6c915c73d95d0280d97fef7eccc4f4ba20ae4e29eedcf79d980e5e1` |


## v0.287 실제 적용

Root가 전체 원본 접촉 시트를 직접 열고 제작 산출물을 그대로 복사했다. 실제 시트/프레임/char를 함께 병합하고 기존 다른char/anims를 보존했다. 융합체는 새 방향형을 선택하면서 기존6키/anims도 보존했고, manifest의 shadow18×4/healthBarWidth24와 renderer의 선택적 표시 크기를 연결해 원래 대형 표시를 유지한다. 피해 숫자도 실제 headOffset을 읽는다. 드론은 기존 두 정적 키를 alias로 유지하고 실제 활성/정지 char를 함께 반영했다. 실제 게임/복원/전체 검사는 아직 남아 있다. 위 준비 패키지 설명은 제작 당시 범위다.

통합 독립 아트 검토에서 기존 공통 idle 호흡 스케일이 정지 드론에도 적용되는 것을 발견했다. 실제 기계는 생물의 호흡 pulse를 하지 않도록 renderer 조건을 분리했고 새 원본으로 최종 재빌드한다. 걷기/공구 공격과 실제 정지 char 선택은 유지한다. 실제 화면 검토는 이후다.

첫 호흡 수정의 최종 build에서 animateView에는 Creature c 변수가 없다는 타입 오류를 발견했다. 렌더러 뷰에 실제 body.machine 여부를 읽는 mechanical 표시 상태를 생성/동기화하고 animateView는 그 상태를 사용하도록 고쳤다. 실제 Core/몸/기계 수치는 바꾸지 않았고 원래 타입 오류 로그도 보존했다. 이 실패에서는 freeze/브라우저가 실행되지 않았다.
