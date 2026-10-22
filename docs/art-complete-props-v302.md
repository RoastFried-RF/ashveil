# v302 소품 직접 원화

`docs/CANON.md` D13의 16px·낡은 석조 기조와 프로젝트 [게임 개발 절차](../.agents/skills/ashveil-game-development/SKILL.md)를 읽고 제작했다. 사용자 승인 범위인 원화와 검토 자료만 작성했다. manifest, Def, Core, renderer는 이 담당 작업에서 수정하지 않았다.

## 작성 방식

- 편집 원본: [`tools/art/draw-complete-props.py`](../tools/art/draw-complete-props.py). 새 정수 좌표의 다각형, 선, 사각형과 재질 군집으로 물체를 직접 설계했다.
- 외부·기존 PNG를 입력, 크롭, 샘플링, 추적, 재색칠하지 않았다. 도구는 PNG를 열지 않으며, 참조 JSON에서 기존 키와 크기 계약만 읽는다.
- 모든 물체는 이 작업에서 새로 그린 것이다. 큰 물체는 정수 2px 군집으로 작도하고 16px 물체는 1px로 작도했다. 선명한 정수 경계와 0/255 알파만 사용한다.
- 낡은 석재, 재빛 청록 잎·유약·직물, 상아색 천·종이·버섯, 녹슨 황동의 팔레트를 사용한다. [`palette.json`](../public/sprites/original/complete/props/palette.json)에 실제 색을 기록했다.
- 각 sheet에 PNG와 동일한 픽셀을 담는 편집 가능한 SVG를 함께 저장했다. SVG의 정수 scanline 사각형은 이 도구가 새로 작도한 메모리 픽셀의 직렬화다. Python 좌표가 구조 편집 원본이며 SVG는 픽셀 편집 원본이다.

재생성:

```sh
python tools/art/draw-complete-props.py
python tools/art/draw-complete-props.py --check
```

## 산출물과 계약

[`complete-props.fragment.json`](../tools/art/complete-props.fragment.json)에 sheet URL 10개, 프레임 142개, 새 애니메이션 `complete_fire`, `actualGround` 37개를 제공한다. PNG·SVG·팔레트·검토 이미지는 [`public/sprites/original/complete/props/`](../public/sprites/original/complete/props/)에 있다. [`integrity.json`](../public/sprites/original/complete/props/integrity.json)에 SHA-256·sheet 크기·프레임 설명·검사 수치를 기록한다. `--check`는 파일을 쓰지 않고 같은 좌표에서 다시 만든 31개 산출물의 바이트와 디스크의 일치를 검사한다.

| 기존 sheet 계약 | 프레임 수 | 새 형상 |
|---|---:|---|
| `kt_props` | 11 | 손잡이 유약병, 황동띠 항아리, 깨진 항아리, 봉인 문장을 든 후드 석상, 인물 부조 석관, 파손 기둥, 벽감 봉헌상, 방향이 교대하는 사슬, 석조 의자, 쌓인 고서·펼친 고서 |
| `kt_brazier` | 8 | 부식된 세 발 황동 화로와 실제로 움직이는 불꽃 |
| `objects` | 20 | 목제 상자·적색 칠 상자·못 박은 궤짝의 3상태, 삼각 받침 횃불, 매달린 철창 등불, 높이가 다른 가시, 아치 나무문·열린 문짝 |
| `dw_env` | 3 | 여섯 잎무리의 새 물푸레나무, 균열 암석, 네 갓의 환경 버섯 군집 |
| `dw_tree_dead` | 1 | 각진 가지와 갈라진 줄기의 새 고사목 |
| `cd_veina1` | 24 | 갈라진 조직, 이동하는 부풀음, 움직이는 가는 가지 |
| `cd_littleeyes` | 36 | 세 눈의 엇갈린 깜박임, 시선 이동, 조직 수축 |
| `cd_urn_1` | 1 | 눈이 박힌 깨진 의식 항아리 |
| `cd_statue_b1` | 1 | 녹슨 띠에 묶인 무릎 꿇은 우상 |
| `complete_props_ground` | 37 | 아래의 실제 16×16 물체·투명 오버레이·손잡이 없는 불꽃 |

legacy 105개는 기존 **키와 width/height를 전부 그대로 유지**했다. `broken_column` 48×128 등 큰 계약도 유지했다. 기존 `objects`의 횃불·등불 원좌표는 겹치므로 새 atlas는 비중첩 좌표로 다시 배치했다. 통합 시 fragment의 전체 좌표를 사용해야 한다. 기존 원본 수목 pine/dead 경로는 건드리지 않았다. 이번 `tree`·`tree_dead`는 호환 기본키와 Blackwood 표현용으로 새로 만든 자체 원본이다.

### 실제 16×16 키

- 물체·오버레이 11개: `complete_well`, `complete_campfire_cold`, `complete_bed_plain`, `complete_bed_insulated`, `complete_forge`, `complete_workbench`, `complete_barricade`, `complete_wall_crack`, `complete_wall_sealed`, `complete_bed_scorched`, `complete_sarcophagus_open`.
- 이 중 `complete_bed_insulated`는 실제 `Terrain.Bedroll`용 휴대 침낭이다. 목재틀·별도 베개 없이 바닥에 펼친 두툼한 청록 천, 통합 후드, 접힌 입구, 누빔선, 묶음끈을 그렸다.
- 돌잔해 1개: `complete_rubble`. 각진 돌판, 금 간 모서리 벽돌, 따로 흩어진 자갈을 직접 작도했다. 해골·유골 없이 `Terrain.Rubble`을 표현하며 기존 `skull`·`Terrain.Remains`의 계약을 건드리지 않는다. 기존 ground atlas의 빈 칸 `[126,36,16,16]`을 사용해 이전 140개 프레임 좌표와 10개 sheet 크기를 그대로 유지했다.
- 배 골조 1개: `complete_boat_frame`. 갈색 목재의 뾰족한 선수·굽은 선체 테두리, 노출된 세 늑골, 가로 버팀대를 직접 작도했다. 내부 빈 곳과 바깥 여백은 완전히 투명하며 물이나 완성 갑판을 그리지 않았다. 실제 얕은 물 바닥 위에 얹을 미완성 선체다. 기존 atlas 빈 칸 `[144,36,16,16]`을 사용해 앞선 141개 프레임 좌표와 모든 sheet 크기를 유지했다.
- 작물 5개: `complete_crop_shade`, `complete_crop_cabbage`, `complete_crop_potato`, `complete_crop_turnip`, `complete_crop_whitecap`. 종별 잎·줄기·갓과 실제 배지를 그렸다. `complete_crop_whitecap` 하단은 갈색 배양 통나무로, 수평의 껍질 결·갈라진 선·오른쪽 노출 끝단을 구분하고 그 위에 흰갓 버섯을 두었다. 뿌리 수량, 장식 열매, 숙기 정답이나 수확 성공 표시를 추가하지 않았다.
- 제작 시설 4개: `complete_loom`의 세로 경사·직물, `complete_tanning_vat`의 둥근 통·늘어진 가죽, `complete_artisan`의 조임틀·숫돌, `complete_saltwork`의 단일 큰 금속솥·손잡이·받침·그을린 냉화덕. `Terrain.SaltPan`의 실제 명칭은 공용 가열 소금솥이며 장작으로 끓이는 시설이므로, 증발조 대신 솥을 그렸다. 불꽃·현재 물량·무료 소금이나 수확량을 그리지 않았다.
- 장치 5개: `complete_tower_sensor`의 세로 탐침·계기, `complete_receiver_conduit`의 굽은 관·결합구, `complete_spire_console`의 경사 제어반·안테나, `complete_zero_vault_seal`의 고정 바퀴·잠금봉, `complete_leaking_conduit`의 균열 관·물방울. 임의 성공·실패등이나 숫자를 그리지 않았다.
- 침구 3개: `complete_field_mat`의 엮은 풀·가지, `complete_straw_bed`의 불규칙 짚, `complete_good_bed`의 장식틀·두 베개·접힌 덮개.
- 공동 시설 4개: `complete_beacon`, `complete_resident_depot`, `complete_altar_closed`, `complete_altar_open`. 봉화 받침, 식량·천 공동 선반, 닫힌 돌제단과 들어 올린 덮개가 있는 돌제단을 분리했다.
- 불꽃 3개: `complete_fire0`, `complete_fire1`, `complete_fire2`. 손잡이·받침 없이 한 타일 안에서 움직이는 새 불꽃이다. `fragment.anims.complete_fire = {frames: [...], fps: 7}`.

### 애니메이션과 용기 상태

`brazier` 8프레임은 불꽃의 외곽, 삼켜지는 빈 곳, 내부 주황·밝은 군집, 불티 위치가 움직인다. 횃불·등불 3프레임은 기존 동작 계약을 유지하면서 불꽃을 새로 작도했다. `complete_fire`는 바닥·나무·침구·야영불용 손잡이 없는 별도 3포즈다.

`cd_veina1`은 24개 경로 위치를 따라 부풀음이 이동하고 작은 가지가 변형된다. `cd_littleeyes`는 세 눈의 시차 깜박임·동공 이동과 주변 조직 움직임으로 36개 프레임이 달라진다. 단일 정적 그림 24/36회 복사가 아니다. 스크립트에서 전체 픽셀 해시가 각각 8/8·24/24·36/36·3/3개로 서로 다른지 검사한다.

`chest`, `chest_red`, `crate`의 `0/1/2`는 각각 닫힘·부분 열림·완전히 열린 내부로 외곽과 빈 공간이 바뀐다. 열린 항아리·제단·석관도 각자 다른 형태를 사용한다.

## 직접 열어 확인한 이미지

아래 8개 PNG를 모두 `view_image`로 직접 열어 확인했다. 추가 24종은 07~08에서 확인했다. 돌잔해 추가 뒤에는 06을 다시 직접 열어 새 파편 군집과 나머지 11종의 동일한 외형을 확인했다. 배 골조 추가 뒤에는 08을 다시 직접 열어 선체 외곽·노출 늑골·빈 내부를 확인했다. 최종 의미 검토의 침낭·가열 소금솥·흰갓 배양목 수정 뒤에는 06·07을 다시 직접 열어 실제 물체 형태를 확인했다.

1. [`contact-01-containers-lights.png`](../public/sprites/original/complete/props/contact-01-containers-lights.png): 용기 3상태·횃불·등불·가시·문·항아리·고서.
2. [`contact-02-stone-and-wood.png`](../public/sprites/original/complete/props/contact-02-stone-and-wood.png): 큰 석상·석관·128px 기둥·벽감·의자·새 수목·바위·버섯·사슬·우상.
3. [`contact-03-brazier-motion.png`](../public/sprites/original/complete/props/contact-03-brazier-motion.png): 화로 8포즈의 실제 외곽·내부 변화.
4. [`contact-04-sinew-motion.png`](../public/sprites/original/complete/props/contact-04-sinew-motion.png): 조직 24프레임의 이동하는 부풀음.
5. [`contact-05-eyes-motion.png`](../public/sprites/original/complete/props/contact-05-eyes-motion.png): 눈 36프레임의 엇갈린 깜박임과 시선.
6. [`contact-06-ground-replacements.png`](../public/sprites/original/complete/props/contact-06-ground-replacements.png): 기존 renderer 도형 대체 11종과 해골 없는 돌잔해 1종. 목재 없는 휴대 침낭의 통합 후드·천 입구·누빔도 확인했다.
7. [`contact-07-crops-stations.png`](../public/sprites/original/complete/props/contact-07-crops-stations.png): 잎·갓이 다른 작물 5종과 독립 시설 4종. 흰갓 아래의 갈색 배양목·오른쪽 끝단과 단일 금속 소금솥·그을린 냉화덕도 확인했다.
8. [`contact-08-devices-camp.png`](../public/sprites/original/complete/props/contact-08-devices-camp.png): 장치 5종·침구 3종·봉화·배급 선반·제단 2상태·손잡이 없는 불꽃 3포즈·미완성 배 골조.

## 통합 담당자용 제안

- 기존 sheet 키는 유지하고 fragment의 새 URL·새 프레임 좌표로 바꾼다. 기존 애니메이션 이름은 유지하며 `complete_fire`만 추가한다.
- `actualGround`의 37키는 실제 16×16이다. 기존 `mushrooms` 80px×0.3을 쓰던 작물 경로는 이 키에 배율 1을 적용하되 기존 성장·수확 상태에 따른 배율 조건을 유지한다.
- `Terrain.Rubble`의 물체 표현은 `complete_rubble`을 선택하고 `Terrain.Remains`는 기존 유골 원화를 유지한다. 기존 raw `skull` 키·프레임·크기와 다른 담당 프레임은 수정하지 않았다.
- `Terrain.BoatFrame`은 기존 실제 얕은 물 바닥 위에 `complete_boat_frame`을 배율 1로 표시한다. 투명한 늑골 사이로 해당 바닥을 보이며, 물·갑판 타일로 원화를 대체하지 않는다.
- `Terrain.Bedroll`은 `complete_bed_insulated`, `Terrain.WhitecapPlot`은 `complete_crop_whitecap`, `Terrain.SaltPan`은 `complete_saltwork`를 사용한다. 휴대 침낭·배양목·가열솥이라는 실제 의미에 맞춘 최종 원화이며 기존 키와 좌표를 유지했다.
- 우물·침구·작업대·방책 등 `Graphics` 도형과 `crate_closed` 공유 표현은 대응 새 키를 읽도록 연결한다. `complete_bed_scorched`, `complete_wall_crack`, `complete_wall_sealed`는 투명 오버레이이고 기존 실제 상태·강도 조건으로 표시한다.
- `complete_altar_closed/open`은 `/0$/ → 2` 자동 선택이 적용되지 않으므로 실제 searched 상태에서 명시 선택한다. 제단 두 상태는 새 원본이므로 상자 색조 변경으로 대체하지 않는다.
- 모닥불·나무불·침구불·야영불은 `complete_fire`, 금속 화로는 기존 `brazier`, 손잡이 있는 횃불 물체는 기존 `torch_stand`를 사용한다. `complete_beacon`은 받침이며 실제 광원 상태에서만 불꽃을 얹는다.
- 직접 원화의 최종 팔레트를 볼 수 있도록 기존 외부 에셋 보정 tint가 적용되는 수목·용기·버섯 경로는 통합 담당자가 실제 화면에서 확인한다. 원화 담당이 renderer를 바꾸지는 않았다.

## 실행한 검사와 남은 범위

`python tools/art/draw-complete-props.py` 실행 시 105개 legacy 키·크기의 일치, 새 37개 16×16 크기, sheet 경계, 프레임 간 비중첩, 프레임 불투명 픽셀 존재, 0/255 알파, 주요 애니메이션 프레임의 해시 고유성을 검사했다. 같은 생성기를 다시 실행해 31개 산출물(atlas·SVG·contact·팔레트·무결성 JSON·fragment)의 SHA-256이 그대로 재현되는 것도 확인했다. 최종 세 물체 수정 뒤 `python tools/art/draw-complete-props.py --check`가 31개 산출물의 바이트 일치와 같은 계약 검사를 통과했다. 배의 내부 `(7,7)`과 바깥 `(0,0)`이 투명한지도 검사한다. 배 추가 전 fragment와 비교해 이전 141개 프레임 좌표와 sheet 크기를 유지했고, 최종 세 물체 수정 전후에도 142개 키·좌표·크기, 37개 actualGround, 10개 sheet URL·크기, fragment 전체 바이트가 그대로임을 확인했다. 해당 수정의 생성 산출물은 ground PNG·SVG, integrity JSON, contact 06·07만 바뀌었다. SVG 10개의 `crispEdges`와 모든 사각형 좌표·크기의 정수 여부도 확인했다. 8장 분할 contact의 픽셀 외형을 실제 열었고, 추가·수정 뒤 해당 06·07·08을 다시 검토했다.

사용자가 지정한 담당 범위에 따라 이 작업에서는 GPU·브라우저·Full·World·Type·pnpm 검사를 실행하지 않았다. 게임 내 배치·가림·빛·기존 tint·실제 입력 상태와 원화의 일치는 통합 담당자의 후속 화면 검토 대상이다. 도구의 계약 검사나 contact 검토를 브라우저 통과로 기록하지 않는다.
