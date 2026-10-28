# 기본 무기 3종 원본 아이콘

제작일: 2026-10-21. 이 격리 묶음은 원본 아트 제안이며 게임에 등록하지 않았다. `/workspace/ashveil`의 Core·Def·공용 manifest·기존 타일·Git은 수정하지 않았다. 브라우저·GPU·게임/프로젝트 검사는 실행하지 않았다.

## 실제 대상 조사

`src/content/core/defs/items-weapons.json`의 다음 세 Item만 최종 표시 변경 대상으로 제안한다. 크기는 인벤토리 격자이며 모든 아이콘의 실제 래스터 크기는 별도 32×32다.

| 실제 ID / 이름 | 기존 sprite | 격자 | 실제 재질 근거 | 제안 새 sheet / frame |
| --- | --- | --- | --- | --- |
| `Item.RustyKnife` / 녹슨 칼 | `rusty_knife` | 1×2 | `Material.Scrap` 고철 | `original_rusty_knife` |
| `Item.Hatchet` / 손도끼 | `hatchet` | 2×2 | 기본 head=`Material.Scrap`, haft=`Material.Wood` 잿나무 | `original_hatchet` |
| `Item.RebarSpear` / 철근 창 | `rebar_spear` | 1×4 | `Material.Scrap`; `Recipe.Spear`의 목재 입력 | `original_rebar_spear` |

녹슨 칼은 짧고 고르지 않은 회색 날·갈색 녹과 작은 목재 손잡이로 그렸다. 손도끼는 넓은 단날 고철 머리와 짧게 휜 잿나무 자루로 구분했다. 철근 창은 길게 편 금속 창끝·철근의 작은 마디·하단 목재 자루를 그렸다. 철근 창은 실제 양손 무기이며 기존 가벼운 목제 투창과 다른 금속 비중의 실루엣이다. 손도끼 단조 재료는 고철 4/목재 1/숯 3, 철근 창 단조 재료는 고철 4/목재 1/숯 2다. 수치와 제조 입력은 조사 근거이며 아이콘에 수량이나 성능 문양으로 표시하지 않았다.

각 Def 원문, 재질 정의, 제조법, 기존 sprite 패치 및 조사 시점의 원문 파일 SHA는 `tools/art/basic-weapons-usage-survey.json`에 보존했다. 이 조사는 원문 JSON의 상속 및 최상위 `/sprite` 패치만 정적으로 확인한 것이다. 실제 게임 Def DB를 실행한 검사가 아니며, 정적 합성 결과의 `abstract` 같은 비대상 필드는 DB 처리 결과로 해석하지 않는다.

## 공유 소비자와 손도끼 자손 보존

조사 시점의 기존 최종 sprite 공유 수는 `rusty_knife` 1종, `hatchet` 5종, `rebar_spear` 9종이다. 기존 타일이나 기존 sprite 키를 교체하면 다른 물품에 영향을 주므로 세 Item의 새 고유 sprite 바인딩만 제안한다.

손도끼의 자손 4종은 모두 원문에 자체 sprite가 없고 기존 `hatchet`를 상속한다. 다음 네 ID에는 직접 자손이나 추가 후손이 없다.

| 자손 ID | 원문 파일 | 자체 raw sprite | 기존 최종 sprite | 추가 후손 |
| --- | --- | --- | --- | --- |
| `Item.AlloyHatchet` | `materials.json` | 없음 | `hatchet` | 0 |
| `Item.CustomHatchet` | `material-crafting.json` | 없음 | `hatchet` | 0 |
| `Item.FlintHatchet` | `materials.json` | 없음 | `hatchet` | 0 |
| `Item.SteelHatchet` | `materials.json` | 없음 | `hatchet` | 0 |

Root 통합 시 기본 `Item.Hatchet`의 새 sprite를 등록하면서 네 자손은 기존 `hatchet` 값을 명시해 보존하는 방침이다. 이 묶음은 해당 Def 패치를 포함하지 않으며 최종 표시 변화가 기본 세 Item에만 한정되는지 Root의 실제 DB 검사로 확인해야 한다. 재질 선택·변경에 따른 모든 실제 상태를 이 고정 아이콘으로 표현한다고 주장하지 않는다.

기존 `rebar_spear` 소비자는 `Item.IronIngot`, `Item.LowPowerCell`, `Item.Pole`, `Item.RebarSpear`, `Item.SeedVaultKey`, `Item.SmallActuator`, `Item.SteelIngot`, `Item.Tongs`, `Item.WeldNozzle`이다. 이 중 기본 철근 창만 새 키로 연결한다. 나머지 소비자 및 기존 이미지 바이트는 이 묶음에서 변경하지 않았다. 기존 원본 대도·투창·부싯돌 장총·산업 화기/탄약도 범위 밖이며 변경하지 않았다.

## 제작 및 파일 계약

외부 이미지 입력·추출·추적·기존 이미지 편집 없이 새 정수 좌표의 다각형·선·사각형을 직접 설계했다. 자체 제작한 앞선 아이콘 도구의 일반 렌더링 도우미와 낡은 목재·회색 금속·구리·청록 계열 19색 팔레트를 재사용했다. 기존 게임/타사 아이콘 도형은 입력하지 않았다. 신규 금속 종류·독·인챈트·수치형 품질/내구도·효능/성능 문양은 표현하지 않았다. CC0로 제공한다.

- `public/sprites/original/items/ashveil-{rusty-knife,hatchet,rebar-spear}.png`: 각각 32×32 RGBA8, 알파 0/255, 투명 여백.
- 같은 이름의 `.svg`: 정수 좌표 단색 rect로 편집 가능한 PNG 전 픽셀 일치 원본.
- 같은 이름의 `-16.png`: 32px의 `(2x+1,2y+1)` 픽셀을 선택하는 16×16 미리보기. 게임 등록용 원본은 32px다.
- `ashveil-basic-weapons-contact.png`: 576×376, 4배 확대·1배·16px·밝은/어두운 배경 검토 시트.
- `ashveil-basic-weapons-palette.json`: 공통 19색. `ashveil-basic-weapons-source.json`: 생성기 SHA·각 산출물 크기/SHA·불투명 경계·대상 매핑.
- `tools/art/basic-weapons-manifest.fragment.json`: 새 sheets/frames 각 3개만, frame=`[해당 새 sheet,0,0,32,32]`. 기존 key 교체나 Def 패치 없음.
- `tools/art/draw-basic-weapons.py`: 표준 라이브러리만 사용하는 결정적 좌표 소스. 생성은 격리 폴더 안에서만 진행하며 외부 저장소를 다시 읽지 않는다.
- `tools/art/check-basic-weapons.py`: 생성기를 import하지 않는 독립 PNG/CRC·SVG 래스터·알파·팔레트·경계·16px·조사 계약·SHA 검사기.

불투명 경계는 0 기반 양끝 포함 기준으로 칼 `[5,4,25,29]`, 손도끼 `[6,4,29,28]`, 창 `[2,2,29,29]`다. 실제 32px PNG 세 장과 접촉 시트를 직접 열어 확인했다. 칼의 짧은 날/손잡이, 도끼의 넓은 한쪽 머리, 창의 긴 금속 끝이 16px 검토에서도 구분된다.

## 재현과 독립 검사

격리 묶음 루트에서 실행한다.

```sh
python3 tools/art/draw-basic-weapons.py --check
python3 tools/art/check-basic-weapons.py
```

최종 `--check`는 결정적 산출물 14개를 비교한다. 독립 검사 결과는 `docs/art-basic-weapons-verification.json`의 PASS이며 PNG/SVG 전 픽셀 일치 3쌍·32/16 크기·두 알파값·19색·서로 다른 실루엣·4자손/후손0·공유 소비자1/5/9·13파일 SHA와 생성기 SHA를 확인했다. 게임 화면/선택/장착/전투 기능을 검증한 결과가 아니다.

| 32px 원본 | SHA-256 |
| --- | --- |
| 녹슨 칼 | `a807d31be1bc59499083d391a70126d7088aafa3f0ed3a4c5b29cf96dcf42de9` |
| 손도끼 | `dcfc90d12993331ec68b9395f813a6f5f7478d0486377087a06bb8e722ae865b` |
| 철근 창 | `bba61c46c0b665149d299f133bcfd366d9e333510266373ae672e4e82a4a667e` |
| 접촉 시트 | `bbe1092be7ba5baccced13273d862ce1af5418635d6285acfe7fe725decf59b0` |


## Root 통합 기록

2026-10-21 격리 원본18파일을 복사하고 신규3키만 등록했다. 기본3Item.sprite만 새 그림을 쓰며 손도끼의4자손은 원문add패치로 기존hatchet을 명시해 보존했다. rebar_spear의 나머지8소비자도 기존키를 유지한다. 위 미등록 표현은 원본 제작 단계 기록이며 실제 게임 검증은 별도292 결과에 남긴다.
