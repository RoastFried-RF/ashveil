# v303 소품 직접 원화

[공통 미술 지침](art-direction-v303.md)의 잿빛 수도원·좌상단 광원·16px 기조를 적용했다. [`baseline-registry.json`](../tools/art/direction-v303/baseline-registry.json)의 담당 **152개 프레임 키, 19개 sheet 키, 모든 x/y/w/h**를 보존하고 새 좌표 도형으로 원화를 작성했다. 그중 `crate_closed`는 `crate0`과 같은 물체를 가리키는 호환 별칭이다.

원본 PNG를 불러와 필터·재색칠·크롭·추적하지 않았다. 새 생성기는 JSON 계약만 읽고 각 물체의 정수 다각형, 윗면·앞면, 구조선, 파손, 재질 군집과 접지 그림자를 그린다. 이전 그림을 읽는 코드는 생성기에 없다.

## 실제 참고와 적용

공식 Steam 참고의 [Stoneshard 0](../test-results/references-v303/stoneshard-0.jpg), [Darkwood 0](../test-results/references-v303/darkwood-0.jpg), [Darkest Dungeon 0](../test-results/references-v303/darkest-dungeon-0.jpg), [Fear & Hunger 0](../test-results/references-v303/fear-hunger-0.jpg)를 `view_image`로 실제 열었다. 참고 이미지는 분석에만 사용했고 게임 atlas·SVG에 복제하거나 추적하지 않았다.

- 저대비 지면 위에 보이는 판재 두께, 철띠, 실제 받침과 물체 아래 좁은 그림자를 관찰했다. 새 상자에는 판재 이음과 측면, 문에는 뒤틀린 철띠, 작업대에는 윗면과 다리를 그렸다.
- 상아·흙색 재질의 밝은 면을 좁게 쓰고, 그림자 속에 물체의 구조를 유지했다. 석상은 숙인 머리·두 팔이 받치는 책·무거운 받침으로, 석관은 두꺼운 케이스·클램프·마모된 인물 부조로 설계했다.
- 잿빛 목재, 먹색 철, 석회암, 마른 천을 구분했다. 보통 설비를 청록색 유물로 칠하지 않았으며 녹슨 접합부와 드문 이끼만 사용했다. 불꽃은 작은 심지와 밝은 핵 주위에만 따뜻한 색을 둔다.
- 소나무는 비대칭의 겹치는 늘어진 가지층과 드문 침엽 군집, 고사목은 기울어진 굵은 줄기·파손 단면·방향이 다른 큰 가지를 새로 그렸다. 재배 식물은 종별 잎·줄기·실제 배지를 유지하며 수확 수량을 표시하지 않는다.

## 소유 범위와 정확한 coverage

| sheet | 프레임 키 수 | 구조와 실제 의미 |
|---|---:|---|
| `kt_props` | 11 | 손잡이 물병·낮은 항아리·깨진 항아리, 책을 든 석상, 두꺼운 석관, 파손 기둥, 석조 벽감, 비틀린 사슬, 석조 팔걸이 의자, 쌓인 책·펼친 책 |
| `kt_brazier` | 8 | 갈비살이 있는 주철 화로, 벌어진 세 발, 움직이는 불꽃과 불티 |
| `objects` | 21 | 목제·가죽 덮인·못 박은 궤짝의 닫힘/부분 열림/열림, 횃불 3, 등불 3, 가시 3, 문 2, `crate_closed` 별칭 |
| `dw_env` | 3 | 새 물푸레나무, 세 면이 구분되는 바위, 기울어진 갓·아가미가 있는 버섯 군집 |
| `dw_tree_dead` | 1 | 잎 없는 파손 물푸레나무 |
| `cd_veina1` | 24 | 뜯긴 결합 조직, 가지와 실제로 이동하는 부풀음 |
| `cd_littleeyes` | 36 | 젖은 유기 조직 속 세 눈의 엇갈린 눈꺼풀·시선과 조직 수축 |
| `cd_urn_1` | 1 | 깨진 목·박힌 눈·철 고정구가 있는 의식 항아리 |
| `cd_statue_b1` | 1 | 몸을 낮춘 사람 형태의 석상과 실제 대각선 철 구속대 |
| `complete_props_ground` | 37 | 아래의 작물·물체·시설·오버레이·손잡이 없는 불꽃 |
| `original_forest_pine`, `original_forest_dead` | 2 | 새 소나무와 기울어진 숲 고사목, 각각 80×96 |
| `original_storage_chest0`, `original_storage_chest2` | 2 | 두꺼운 판재와 철 모서리의 보관함 닫힘·열림, 각각 16×16 |
| `original_ashberry_bush` | 1 | 톱니 잎·갈라진 목질 가지의 월드 관목, 32×32 |
| `original_hearth_oat_plot` | 1 | 좁은 잎·굽은 줄기·늘어진 중성색 귀리 소수, 32×32 |
| `original_pantry_full`, `original_pantry_low`, `original_pantry_empty` | 3 | 철 모서리 선반과 실제 세 재고 상태의 내용물, 각각 32×32 |
| 합계 | **152** | **19 sheets**, 호환 별칭 1개 포함 |

기존 v302 소품 sheet 10개는 143키다. 이는 기존 원화 142키와 통합 단계의 `crate_closed` 별칭 1키를 포함한다. 추가 수목·저장함·관목·귀리·식료품 선반 9키를 합쳐 152키다. `original_storage_chest_item`과 원재료·식품 아이콘은 item 담당이며, 월드의 `original_ashberry_bush`는 이 담당으로 조율했다. UI의 26개 등록·슬라이스는 UI 담당이고 pantry 의미 sprite 세 장만 이 담당이다.

37개의 실제 16×16 ground는 기존 키와 의미를 유지한다.

- 생활 물체·오버레이 11키: `complete_well`, `complete_campfire_cold`, `complete_bed_plain`, `complete_bed_insulated`, `complete_bed_scorched`, `complete_forge`, `complete_workbench`, `complete_barricade`, `complete_wall_crack`, `complete_wall_sealed`, `complete_sarcophagus_open`.
- 작물 5키: `complete_crop_shade`, `complete_crop_cabbage`, `complete_crop_potato`, `complete_crop_turnip`, `complete_crop_whitecap`. 흰갓은 껍질·노출 끝단을 가진 갈색 배양목 위에 있다.
- 제작 시설 4키: `complete_loom`, `complete_tanning_vat`, `complete_artisan`, `complete_saltwork`. 베틀은 기울어진 프레임·경사·직물·발판, 장인 작업대는 조임틀·숫돌, 무두질 통은 판재·띠·가죽, 소금 시설은 단일 금속솥·손잡이·그을린 냉화덕이다. 소금솥의 불꽃·현재 물량·무료 산출물은 그리지 않았다.
- 수동 장치 5키: `complete_tower_sensor`, `complete_receiver_conduit`, `complete_spire_console`, `complete_zero_vault_seal`, `complete_leaking_conduit`. 비대칭 탐침/측면 계기, 굽은 관/볼트 있는 플랜지, 경사 제어반/측면 케이블, 두 기둥/가로 잠금봉, 굽은 파손 관/틈으로 물리 구조를 분리했다. 임의 상태등·숫자·성공 표시를 넣지 않았다.
- 침구 3키: `complete_field_mat`, `complete_straw_bed`, `complete_good_bed`. 휴대용 `complete_bed_insulated`는 별도 침대가 아닌 후드·접힌 입구·누빔·묶음끈이 있는 두꺼운 천 침낭이다.
- 공동 시설 4키: `complete_beacon`, `complete_resident_depot`, `complete_altar_closed`, `complete_altar_open`.
- 불꽃 3키: `complete_fire0/1/2`. 손잡이 없는 실제 타일 불꽃, 기존 `complete_fire` fps 7 계약을 유지한다.
- 돌잔해·선체 2키: `complete_rubble`, `complete_boat_frame`. 돌잔해에 해골을 넣지 않았고, 선체는 외곽과 늑골·버팀대만 남겨 실제 얕은 물이 보이는 내부를 투명하게 뒀다.

## 생성·체크와 검토 자료

편집 원본은 [`draw-props.py`](../tools/art/direction-v303/draw-props.py), 연결은 [`props.fragment.json`](../tools/art/direction-v303/props.fragment.json)이다. atlas PNG 19개와 정수 픽셀 SVG 19개, 팔레트·coverage·프레임 설명·SHA-256은 [`public/sprites/original/direction-v303/props/`](../public/sprites/original/direction-v303/props/)에 있다. SVG는 새 좌표 작도로 생성한 픽셀의 정확한 편집 표현이며 외부 PNG 추적 결과가 아니다.

```sh
python tools/art/direction-v303/draw-props.py
python tools/art/direction-v303/draw-props.py --check
```

`--check`는 파일을 쓰지 않고 **51개 산출물**을 새로 계산해 디스크 바이트와 비교한다. 152키의 baseline x/y/w/h 일치, 19개 sheet coverage·프레임 범위·비중첩(의도한 crate 별칭 제외), 0/255 알파, 실제 픽셀 존재를 검사한다. 별도 읽기 전용 검사로 19개 실제 PNG의 전체 치수도 baseline과 같고, SVG 19개의 `crispEdges`·모든 사각형의 좌표와 크기가 정수임을 확인했다. 주요 애니메이션은 brazier 8/8, sinew 24/24, eyes 36/36, free fire 3/3개 해시가 서로 다르다. 선체 내부가 투명한지도 검사한다.

독립 읽기 전용 비교에서 기존 19개 sheet와 새 PNG의 SHA-256이 전부 다르고, 152프레임 모두 픽셀이 달라진 것을 확인했다. 프레임별로 이전 색 하나가 새 색 하나로 대응되는 단순 재색칠인지도 확인했으며 **그 조건에 해당하는 프레임은 0개**였다. 프레임 전체에서 달라진 픽셀은 76,313개다(애니메이션과 호환 별칭을 각각 프레임으로 집계). 이 비교는 제작 후 검증이며 생성기는 이전 PNG를 읽지 않는다.

아래 contact 10장을 모두 `view_image`로 실제 열었다. 미술 검토 후 소나무 수관·숲 고사목 자세, 베틀·소금솥, 수동 장치 5종의 구조를 보강하고 해당 03·08·09를 다시 열었다.

1. [`contact-01-coffers-lights.png`](../public/sprites/original/direction-v303/props/contact-01-coffers-lights.png): 용기 세 상태·등불·횃불·가시·문·도기·고서.
2. [`contact-02-sculpture.png`](../public/sprites/original/direction-v303/props/contact-02-sculpture.png): 책과 팔이 있는 석상·석관·128px 기둥·벽감·의자·구속대·사슬.
3. [`contact-03-forest.png`](../public/sprites/original/direction-v303/props/contact-03-forest.png): 서로 다른 네 수목·바위·환경 버섯·관목·귀리.
4. [`contact-04-brazier.png`](../public/sprites/original/direction-v303/props/contact-04-brazier.png): 화로의 불꽃·불티 8포즈.
5. [`contact-05-organic-sinew.png`](../public/sprites/original/direction-v303/props/contact-05-organic-sinew.png): 결합 조직과 이동하는 부풀음 24포즈.
6. [`contact-06-organic-eyes.png`](../public/sprites/original/direction-v303/props/contact-06-organic-eyes.png): 눈꺼풀·시선·조직의 36포즈.
7. [`contact-07-dwellings.png`](../public/sprites/original/direction-v303/props/contact-07-dwellings.png): 침구·우물·화덕·가구·투명 오버레이·돌잔해·선체.
8. [`contact-08-growing-crafts.png`](../public/sprites/original/direction-v303/props/contact-08-growing-crafts.png): 잎·배지가 다른 작물 5종과 실제 시설 4종.
9. [`contact-09-devices-fire.png`](../public/sprites/original/direction-v303/props/contact-09-devices-fire.png): 장치 5종·공동 시설·제단·손잡이 없는 불꽃.
10. [`contact-10-pantry-storage.png`](../public/sprites/original/direction-v303/props/contact-10-pantry-storage.png): 저장함 두 상태와 식료품 선반의 세 재고 상태.

공유 manifest·renderer·Core·Def·저장·게임 규칙·UI 슬라이스를 바꾸지 않았다. 이 담당 작업에서는 git·GPU·브라우저·Full 검사를 실행하지 않았다. 실제 게임의 배치·가림·빛과 최종 전체 검증은 통합 담당 범위이며, contact 검토를 게임 화면 통과로 기록하지 않는다.
