# v303 지면·벽·문 새 원화

2026-10-22. 최종 리비전 **`terrain-r3-quiet-earth`**. [공통 미술 방향](art-direction-v303.md)과 `tools/art/direction-v303/baseline-registry.json`을 기준으로 **124개 프레임을 새로 그렸다**. 기존 그림의 색을 바꾸거나 PNG를 입력해 가공하지 않았다. 정수 좌표·석판 코스·짧은 잎·젖은 침전 덩어리·목재 이음·철 보강대와 녹의 위치를 새로 작성했다. 기본 픽셀 밀도와 기존 프레임 키·너비·높이를 보존했다.

## 기준 목록 대조

| 기준 sheet 소유 범위 | 키 / 수량 | 보존한 논리 크기 |
|---|---|---|
| `kt_floor` | `kt_floor_q0..3`, 4개 | 128×128 |
| `av_complete_terrain_moss_v302` | `moss_s0..11`, `moss_t0..5`, `moss_l0..8`, 27개 | 앞 18개 16×16, 큰 군집 9개 32×32 |
| `av_complete_terrain_walls_v302` | `wall_face0..7`, `wall_top`, `wall_edge_N/S/E/W`, `wall_ledge0..1`, `shelf0..23`, 39개 | 16×16 |
| `av_complete_terrain_depth_v302` | `cd_floor0..19`, 20개 | 16×16 |
| `av_complete_terrain_misc_v302` | `floor_stairs`, `floor_ladder`, `skull`, `complete_stairs_up`, `complete_ladder_down`, 5개 | 16×16 |
| `av_complete_terrain_ground_v302` | 풀 3, 풀·흙 3, 흙 3, 진흙 4, 재 4, 물 2, 피 5, 갑판 3, 합계 27개 | 16×16 |
| `rusted_door_closed` | 같은 이름의 키 1개 | 16×32 |
| `rusted_door_open` | 같은 이름의 키 1개 | 16×16 |

**합계 124개, 기준 대비 누락 0개·추가 0개·크기 변경 0개.** 미사용 호환 키도 같은 기준으로 모두 포함했다. `original_hearth_oat_plot`은 이번 terrain 소유 묶음에 포함하지 않고 props 담당 범위로 통합 담당에게 알렸다. 렌더러·manifest·Core·Defs·package·Git 파일은 변경하지 않았다.

새 fragment의 최상위 키는 `sheets`, `frames`만 있다. 새 sheet 이름은 `av_direction_terrain_{floor,moss,walls,depth,misc,ground,doors}_v303`의 7개이며, 프레임은 기존 형식 `[sheetKey,x,y,width,height]`로 연결한다. 모든 새 키와 크기를 동결 기준 JSON에서 독립 대조한다.

## 공식 참고 이미지에서 적용한 원리

다음 네 공식 Steam 스크린샷 파일을 각각 `view_image`로 실제 열었다. 원본 URL·SHA256은 통합 [참고 기록](../tools/art/direction-v303/references.json)에 있다. 이 이미지는 분석용이며 생성 도구의 입력에 넣거나 픽셀을 복사·추적하지 않았다.

| 직접 확인한 파일 | 관찰과 이번 원화의 적용 |
|---|---|
| `test-results/references-v303/stoneshard-0.jpg` | 인물·건물보다 조용한 흙 바닥과 바닥 높이에서 낮게 자란 풀. 풀은 타일당 두 군집, 각 군집 3픽셀 정도로 제한하고 흙은 3~4개의 가까운 명도 덩어리로 구성 |
| `test-results/references-v303/fear-hunger-0.jpg` | 낡은 석재 바닥과 깊이 있는 서가. 큰 석판은 16px 반복 단위와 맞추지 않고 22~31px 코스 높이·29~57px 폭으로 구성. 서가에는 높이·기울기·빈 공간이 다른 책·두루마리·더미를 배치 |
| `test-results/references-v303/darkwood-0.jpg` | 조명과 시야가 긴장을 만들고 바닥의 장식이 화면을 점유하지 않음. 광원을 바닥에 굽지 않고 중간 이하의 명도·절제한 표면 강조로 제작 |
| `test-results/references-v303/darkest-dungeon-0.jpg` | 구조가 읽히는 두꺼운 석재와 중요한 면에 제한된 밝기. 벽의 4px 상부 두께·전면 코스·어두운 아랫면을 구분하고 철문의 가장자리·보강대에만 작은 밝은 면을 배치 |

지면은 전체를 녹색으로 물들이지 않는 젖은 석회암·흙·재의 중성색 계열이다. 풀·이끼에만 올리브색을 제한했다. 큰 S 곡선·큰 싹·16px 외곽 테두리·발광 오염 혈관을 그리지 않았다. 이끼는 넓은 덩어리를 채우지 않고 분리된 얕은 군집으로 바꿨다. 피는 위험색의 작은 국소 오버레이로 남겼다.

128px 석판은 넓은 조용한 면과 일부 짧은 균열·미세한 마모로 구성했다. 임의의 macro 이웃을 붙여도 상하·좌우 가장자리 픽셀이 일치한다. 최종 R2의 깊은 층 바닥에는 0~1개의 짧고 얕은 부분 이음과 낮은 대비의 젖은 면만 있으며, 모든 16px 타일에 정방형 음각 테두리를 넣지 않았다. 벽에는 석재 상부·전면·두께가 있고, 서가는 실제 저장 구조를 가진 목재 틀과 두 단의 내용물로 읽힌다.

철문 닫힘은 돌 jamb와 아치, 철 패널, 두 가로 보강대, 경첩·잠금 부위, 그 아래의 녹을 새로 그린 16×32 원화다. 열림은 같은 논리 키의 16×16 크기에서 좁게 보이는 철문 옆면·열린 통로·문턱을 따로 작성했다. 닫힘 PNG의 잘라내기나 변형은 사용하지 않았다.

## 실제 심미 검토와 수정

생성한 아래 10개 검토 PNG를 각각 별도의 `view_image`로 직접 열었다.

| 파일 | 확인한 대상 |
|---|---|
| `contact-floor.png` | 128px macro 4개의 큰 석판·코스·일부 균열·낮은 대비 |
| `contact-moss-small.png` | 작은 군집 12개, 축축한 홈 6개의 투명 외곽과 낮은 점유 면적 |
| `contact-moss-large.png` | 32px 9개 군집이 넓은 바닥을 덮지 않는 분리된 형태 |
| `contact-walls.png` | 벽 전면 8개·상부·네 방향 가장자리·턱의 두께 |
| `contact-shelves.png` | 책·두루마리·더미와 빈 공간이 다른 서가 24개 |
| `contact-depth.png` | R2의 이음 없는 12종과 짧은 부분 이음 1개만 있는 8종, 매우 드문 작은 마모 |
| `contact-ground.png` | 풀·흙·진흙·재·물·피·갑판 27개의 전체 외형 |
| `contact-misc.png` | 계단 위·아래, 사다리 위·아래, 해골의 기능 실루엣 |
| `contact-doors.png` | 철문 아치·보강대·녹, 열린 문 옆면·문턱 |
| `material-fields.png` | 실제 16px 프레임을 인접 배치한 풀·흙·재·물·갑판·젖은 석회암의 반복 인상 |

초기 인접 배치 검토에서 물의 반복 물결과 갑판의 촘촘한 줄이 강했다. 물의 넓은 물결을 낮은 대비의 평평한 수면 덩어리와 짧은 잔물결로 수정했고, 갑판은 8px 폭 두 판재와 드문 끝 이음으로 다시 그렸다. 이끼 군집의 꼭짓점도 조금 잘라 작은 사각 덩어리가 떠 보이는 인상을 줄였다. 수정한 물·갑판·이끼 검토 PNG는 다시 직접 열었다.

### R2: 독립 검토에 따른 반복 무늬 제거

R1의 인접 재질 검토에서 깊은 층 바닥의 큰 ㄱ자 이음이 미로·파이프로 먼저 보였고, 재의 수평 직사각 대시와 물의 `=`형 선이 행으로 반복된다는 지적을 받았다. 해당 26프레임은 큰 선·대시를 폐기하고 새 좌표로 다시 그렸다.

| 수정 범위 | 최종 R2 구조 |
|---|---|
| `cd_floor0..19` | 12종은 이음 0개, 8종은 타일 가장자리에서 들어오는 4~6픽셀 직선 부분 이음 1개. ㄱ자·지그재그·교차점·타일 전체를 관통하는 선은 없다. 젖은 면의 RGB 차이는 작은 값으로 제한. 마모는 20종 중 4종에 각 3픽셀만 존재 |
| `ash0..3` | 타일마다 연결된 불규칙 3~5픽셀 먼지 군집 2개. 전체 표시 픽셀은 각각 7·8·8·8개. 직사각 대시·숯 막대를 제거하고 낮은 대비로 변경 |
| `water_shallow`, `water_deep` | 낮은 대비의 넓고 조용한 수면에 짧은 선 1개. 얕은 물 3픽셀, 깊은 물 2픽셀. 겹친 `=`형 선과 두 번째 행을 제거 |

R2 생성 후 위 표의 **검토 PNG 10개 모두를 다시 개별 `view_image`로 열었다**. `material-fields.png`에서 깊은 층의 파이프·미로 모티프와 재의 벽돌 행이 사라지고 물의 반복 선도 더 약해진 것을 확인했다. 다른 98프레임은 R1과 픽셀 해시가 같고, 124개 프레임의 atlas 사각형·크기 및 7개 sheet URL을 담은 fragment는 R1과 바이트까지 동일하다.

R2 PNG·SVG·generator·source는 당시 통합 담당의 build/GPU 검증 전에 고정했다. 이후 최종 GPU 독립 검토 요청에 따라 아래 R3에서 흙 3종만 추가 수정했다.

### R3: 넓은 흙 바닥의 직사각 대시 제거

최종 GPU 독립 검토에서 넓은 흙 바닥의 `dirt0..2`가 밝은 가로 직사각 두 개를 타일마다 반복해 벽돌 대시처럼 보인다는 지적이 있었다. **흙 3프레임만** 기존 대시·밝은 자갈·넓은 곡선 덩어리를 제거하고 넓은 빈 면과 연결된 불규칙 3~5픽셀 침전 군집 2개로 다시 그렸다. 타일별 표시 픽셀은 7·8·8개이며, 밝기 차이를 낮췄다.

R3의 `ground.png`, `contact-ground.png`, `material-fields.png`를 각각 직접 열어 흙의 가로 대시가 사라지고 작은 저대비 침전으로 읽히는 것을 확인했다. R2 대비 다른 **121프레임의 픽셀 해시는 동일**하고, PNG 변경은 해당 세 파일뿐이다. fragment도 바이트까지 동일하다. 도구·ground SVG·palette·source 감사 정보를 함께 재현 가능하게 갱신했고, 이후 PNG·SVG·generator·source 고정을 통합 담당에게 알렸다. 이 뒤에는 문서만 갱신했다.

## 재현 도구·산출물·검증

재생성:

```sh
python3 tools/art/direction-v303/draw-terrain.py
python3 tools/art/direction-v303/draw-terrain.py --check
```

표준 라이브러리만 사용한다. 기존 자체 도구의 Canvas·PNG/SVG 직렬화·접촉 시트 글자 구현 관례만 재사용했고 기존 원화 좌표 배열이나 픽셀을 불러오지 않았다. 생성 시 읽는 설계 데이터는 동결 baseline JSON뿐이다. PNG 입력·외부 패키지·외부 폰트·무작위 점 노이즈는 없다.

- `tools/art/direction-v303/draw-terrain.py`: 재현 가능한 직접 좌표 원본.
- `tools/art/direction-v303/terrain.fragment.json`: `sheets`·`frames`만 포함하는 통합용 매핑.
- `public/sprites/original/direction-v303/terrain/{floor,moss,walls,depth,misc,ground,doors}.{png,svg}`: 자체 atlas 7개와 동일 픽셀의 SVG.
- 같은 디렉터리의 접촉 시트 9개·인접 재질 검토 1개, `palette.json`, `source-integrity.json`: 제작 방식·기준 범위·프레임별 RGBA SHA256·산출물별 SHA256.

총 생성 산출물은 27개다. 최종 R3 `--check` 바이트 일치, 기준 124키·크기 정확성, 124개 서로 다른 픽셀 해시, 기본 지면 불투명 조건, atlas 범위, 모든 128px macro 이웃의 가장자리 일치, macro당 5색 이하 조건이 통과했다. R2의 이음 수·부분 이음 길이·총 마모 픽셀·먼지 군집 점유·물 잔물결 수 조건과 R3 흙의 7·8·8픽셀 점유 조건도 `--check`에 포함했다. 별도 읽기 검사는 PNG 17개의 청크 CRC·RGBA 복호화 길이, source 파일 해시, R2 대비 변경 프레임이 `dirt0..2` 3개와 정확히 같은지, 나머지 121프레임과 fragment가 같은지 확인했다. 전체 124프레임의 독립 경계 검사·서가 24개 내용물 점유 모양의 고유성은 앞선 검사에서 통과했고 R3에서 해당 사각형·서가 원화는 바뀌지 않았다.

| PNG | atlas 크기 | SHA256 |
|---|---|---|
| `floor.png` | 256×256 | `6c9d31ee79499ed6243aefcf50e8644a0f7fa0ef2965b5f2520f263e124edd4f` |
| `moss.png` | 192×160 | `794363479ce4cef113b39226f684b73ce235af621baf37a35d65b0435f887d0f` |
| `walls.png` | 128×80 | `060bda31ad59ee340551699ac79e282a161a2bc9b9f430f4485f12207d89bc95` |
| `depth.png` | 128×48 | `8f3debbf6b14a9201885204596726846a7ec65b7688476f66749d5bc8c2633c5` |
| `misc.png` | 128×16 | `0363cd08bee95bf6a795140f56564eee25c1a4dc0a1cc6cb0fab5bd9cd198cd4` |
| `ground.png` | 128×64 | `a0a8c548c8a72e61821f82f4c04210aaf4b2ec5a5b494867e28f9e1d430f7be8` |
| `doors.png` | 64×32 | `29dfa11167a4294e5f90812fa59d390c7ff5878ffa5ae4bc7d9b630b3d326ea7` |

fragment SHA256: `dfc15099b04332b2ccd12e1ea7378d7c3a117ccecc0bdf8380b80d5075632b1c`.

최종 R3 `contact-ground.png` SHA256: `2da2e1a8e879a30dab2ecd00ec19068ce2cd58c2d3e9dd21714120dd68e7dd94`.

최종 R3 `material-fields.png` SHA256: `bb2c8de7150add23226174398211bef03afa638f7af180da992561efe37e7aac`.

최종 R3 감사 기록 `source-integrity.json` SHA256: `868e8a026d7c830149311f3a198945cf3be1c222d93db39ebf677bffd23fad9b`. 이 기록에 `revision`, `reviewRevision`, `r3ReviewRevision`, `revisionChecks`, 프레임별 RGBA 및 파일별 해시를 남겼다. 통합 감사 파일은 공유 소유 범위를 지켜 직접 수정하지 않았다.

GPU·Full·브라우저·프로젝트 검사와 실제 플레이 장면 검토는 수행하지 않았다. 이 기록은 원화와 독립 카탈로그 검사에 대한 것이며, 실제 게임의 기존 tint·광원·레이어 합성 결과를 확인했다는 뜻은 아니다. 프로덕션 매핑 병합과 게임 화면 검증은 통합 담당의 범위다.
