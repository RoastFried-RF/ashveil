# v302 지형 원화 전체 교체 패키지

2026-10-22. 이번 지형 담당 산출물은 **118프레임 / 자체 아틀라스 5개**다. `CLAUDE.md`, [프로젝트 게임 개발 스킬](../.agents/skills/ashveil-game-development/SKILL.md), `docs/CANON.md` D13, `tools/art/complete-catalog-v302-before.json`의 키·크기 계약을 읽고 제작했다. 작업 지시가 정한 파일 범위를 지켰으며 manifest·Core·Def·renderer·Git를 직접 변경하지 않았다.

| 분류 | 프레임 | 규격 / 설계 |
|---|---:|---|
| `kt_moss`의 모든 기존 키 | 27 | `moss_s0..11`, `moss_t0..5`는 16×16, `moss_l0..8`은 32×32. 서로 다른 이끼 군집 외곽·융기·연결 방향을 직접 설계 |
| `kt_walls`의 모든 기존 키 | 39 | 16×16. 벽 전면 8개, 윗면 1개, N/S/E/W 가장자리 4개, 턱 2개, 서가 24개 |
| `cd_tiles`의 모든 기존 키 | 20 | `cd_floor0..19`, 16×16. 각기 다른 석재 이음·침윤 경로·광물성 침전 |
| `x72_misc`의 모든 기존 키 | 3 | `floor_stairs`, `floor_ladder`, `skull`, 각각 16×16 |
| 기존 MapView GROUND 담당 | 20 | `grass0..2`, `grassdirt0..2`, `dirt0..2`, `ash0..3`, 얕은 물·깊은 물, `blood0..3`, `blood_pool` |
| 조사 중 누락 확인된 진흙 | 4 | `mud0..3`, 16×16. 웅덩이·습지 잔풀·해안 침전 띠·눌린 발자국 배치를 별도로 제작 |
| 새 갑판 바닥 | 3 | `deck0..2`, 16×16. 판재 끝 이음, 못, 마모 결과 옹이 위치를 각각 다르게 제작 |
| 방향별 출입 구조 추가 | 2 | `complete_stairs_up`, `complete_ladder_down`, 각각 16×16. 올라가는 돌계단과 어두운 사각 개구부 안으로 내려가는 목재·금속 사다리 |

레거시 등록 프레임 89개는 키와 너비·높이를 모두 보존했다. 기존 GROUND는 미등록 32×32 파일을 renderer가 16px로 축소해 사용하던 리소스다. 이번에는 D13의 16px 기본 픽셀 밀도에 맞춘 새 16×16 등록 프레임으로 제공한다. 이 선택은 통합 담당과 공유·합의했다. `murk_leech`, `kt_floor`, 물품·능력 아이콘은 이번 담당 범위 밖이다.

## 직접 제작 방식

`tools/art/draw-complete-terrain.py`에 정수 픽셀 좌표, 다각형 꼭짓점, 벽돌 배치, 서가 내용물 배치 문자열, 잔물결 선, 흙·재 퇴적 덩어리를 직접 작성했다. 기존 PNG를 입력·추출·트레이싱·재색칠하지 않았으며 외부 이미지·생성 이미지·외부 폰트·난수 노이즈를 사용하지 않았다. 기존 자체 도구에서 소프트웨어 Canvas·PNG/SVG 직렬화·접촉 시트의 일반 구현 관례만 재사용했다. 기존 GROUND 파일은 너비·높이 헤더만 조회했고 그림 데이터는 보지 않았다.

차가운 회녹색 석조와 고원 지면을 기본으로, 책·해골·사다리 고정구에만 상아·황동 강조를 제한했다. 이끼와 핏자국은 투명 배경의 별도 군집이며, 불투명 지면은 알파 구멍 없이 이어진다. 벽은 전면·윗면·측면 띠·아랫턱의 값 차이로 깊이를 낸다. 서가 24개는 세운 책, 기울어진 책, 책 더미, 두루마리, 빈 공간을 다르게 배치했고 책/두루마리/더미 점유 모양이 24개 모두 다르다. 단순 팔레트 교체 변형은 없다.

## 산출물과 fragment 계약

- `public/sprites/original/complete/terrain/{moss,walls,depth,misc,ground}.{png,svg}`: 실제 atlas와 같은 픽셀의 SVG 원본.
- 같은 디렉터리의 `palette.json`, `source-integrity.json`: 색, 제작 방식, 프레임별 RGBA SHA256, 산출물별 크기·SHA256.
- `tools/art/complete-terrain.fragment.json`: 최상위 키는 **`sheets`와 `frames`만** 있다. `av_complete_terrain_{moss,walls,depth,misc,ground}_v302` 자체 sheet 5개에 118개 키를 연결한다. 프레임 형식은 `[sheetKey,x,y,width,height]`다. 기존 키를 유지하면서 좌표를 새 atlas로 옮겼다.
- `tools/art/draw-complete-terrain.py`: 표준 라이브러리만 사용하며 저장소 루트에서 `python3 tools/art/draw-complete-terrain.py`로 재생성하고 `--check`로 바이트 일치를 검사한다. 이미지 입력은 읽지 않으며, 동결 catalog의 프레임 크기만 계약 검사에 사용한다.

| 실제 PNG | atlas 크기 | SHA256 |
|---|---|---|
| `moss.png` | 192×160 | `778af845bc3005d82a0454536b2cf93764df39ea0ba251e389c863744ffb4f6e` |
| `walls.png` | 128×80 | `d1050bb6e653dd308ad0c38ee4d9eb0c6a4c062674f2d1d314be72ffaf8511cb` |
| `depth.png` | 128×48 | `16424b52357c3a10b822373409f3a7f4a063b13c4a0ce3ce5e0e92b6e37c432e` |
| `misc.png` | 128×16 | `ce0e7182a0af844ebf3edf79a910c8e85758dc328ff8554eca2c5765ea3ce21c` |
| `ground.png` | 128×64 | `5c5cb5d32697f452b7fda6352008d338ebff44895df8341a2627bd89b7bd1774` |

fragment SHA256: `ef81f388d4c07f37032e461502d3d4c9167cc0a7f0e61bd0b777b5fcecd78711`.

최종 Terrain 의미 검토에서 일반 돌계단과 탑 사다리가 위·아래 방향의 서로 다른 구조물을 공유하던 문제를 통합 담당이 확인했다. 이를 위해 `complete_stairs_up = [av_complete_terrain_misc_v302,48,0,16,16]`, `complete_ladder_down = [av_complete_terrain_misc_v302,64,0,16,16]`을 기존 misc atlas의 빈 칸에 추가했다. 기존 116프레임의 전체 사각형과 5개 sheet URL은 모두 그대로다. 기존 `floor_stairs`와 `floor_ladder`도 보존했다. 실제 `groundObjectArt` 연결은 통합 담당이 수행한다.

## 실제 확인한 이미지와 검증 경계

아래 PNG는 각각 별도의 `view_image` 호출로 직접 열어 확인했다.

| 파일 | 직접 확인한 내용 |
|---|---|
| `contact-moss-small.png` | 소형 12개와 연결형 6개의 투명 외곽, 독립적인 연결 방향 |
| `contact-moss-large.png` | 32px 군집 9개의 서로 다른 외곽·내부 덩어리 |
| `contact-walls.png` | 전면 돌 이음, 벽 깊이와 턱, 24개 책군집의 배치 차이 |
| `contact-depth.png` | 20개 바닥의 이음 위치와 침윤 띠·침전 차이 |
| `contact-ground.png` | 풀·흙·재·진흙·물·핏자국·갑판의 전체 27종 구분 |
| `contact-misc.png` | 기존 계단·사다리·해골, 추가된 위로 오르는 네 단 돌계단·사각 개구부 안으로 내려가는 사다리. 두 프레임 추가 후 갱신된 5종 시트를 다시 직접 열어 방향 차이를 확인 |
| `surface-study.png` | 인접 지면·갑판 끝 이음·반복되는 물 잔물결을 4배로 확인 |

실행한 검사: 재생성 `--check` 통과(20개 생성 산출물), 레거시 89키의 크기 일치, 전체 118개의 서로 다른 프레임 픽셀 해시, 기본 ground/depth 불투명 조건, 12개 PNG의 청크 CRC·RGBA 복호화 크기, 118프레임 atlas 경계, 서가 내용물 점유 모양 24개 고유성. 방향별 출입 구조 추가 뒤 기존 116프레임의 전체 좌표·크기와 sheet URL 5개가 추가 전과 같은지도 비교해 통과했다. 모든 검사는 이번 독립 아트 패키지만 대상으로 했다.

지시된 병렬 작업 경계를 따라 GPU·브라우저·Full·World·Type·pnpm 프로젝트 검사는 실행하지 않았다. 실제 플레이 장면에서 렌더러 색조·조명·레이어 순서를 확인했다는 주장은 하지 않는다. fragment 병합, 진흙·갑판의 실제 floor 분기 연결, 기존 GROUND 경로 대체와 통합 실행 검증은 통합 담당이 수행한다.
