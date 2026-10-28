# 11 — 모딩 (Modding)

> **3차 반영 (2026-10-13): CANON §7.4 정리** — Def 예시를 2·3차 정본에 맞췄다: `SkillDef`·`TalentDef` → `AbilityDef`(15 §11), 가장자리 `spawn` 사건 → `PlaceEventDef`(`origin` 필수, 10 §7), 지역·층·공급원 Def(14 §12)와 `HealthPoolDef`(02 §16)를 추가했다(§3.4). 의미 검증 목록(§3.2)에서 '최소 무게'를 빼고(D22) 격자 크기·`origin`·능력 트리·숙달 2종·경험치 원천(D15·D23) 규칙을 넣었다. 패치·샘플 모드 예시의 무기 공격을 07 §14 형식(`energy`, 천분율 정수, TU 없음 — D9·D24)으로, 맵 생성 대상을 지역 지상 지도(09 §12)로 바꿨다. 텍스처는 16×16(D13). 일관성 정리: `MasteryDef` 검증에 **책 횟수 상한 `bookCap`**(06 §5.2·15 §9.3, core 15 = 2단계 문턱)을 넣고 `BookDef`의 `masteryCount` 합산 규칙을 연결했다.
> 기준: `CANON.md` D6(엔진 독립: 순수 TS 로직 + JSON Def), §4 결정론 규칙, §7 D8·D13·D22~D24. 사용하는 Def 타입은 01~15의 스키마 예시를 따른다.
> 상태: 초안 v0.2 · 2026-10-13

## 0. 결론 요약

- 기본 게임 전체가 `core` 모드다. 엔진 코드에 콘텐츠를 하드코딩하지 않는다. **개발자가 쓰는 도구 = 모더가 쓰는 도구.**
- Def는 **JSON + JSON Schema**(정본)로 정의한다. TS 타입은 스키마에서 생성한다 → 엔진을 바꿔도(D6) Def 파일·패치·스키마는 한 글자도 안 바뀐다.
- 로드 파이프라인: 매니페스트 → 위상 정렬 → Def 수집 → **패치(원본 Def에 적용)** → 상속 해석 → 참조 해석 → 의미 검증 → 동결. 결과는 **로드 해시**로 세이브와 시드 공유 문자열에 박힌다.
- 스크립트는 단계적: 프로토타입은 **데이터 모드만**. 이후 훅 포인트 → 워커 등록. 스크립트는 QuickJS 샌드박스에서 `ctx.rng`만으로 돌고, 상태를 직접 바꾸지 못하고 **명령 목록을 반환**한다.

## 1. 목적 / 설계 의도

| 의도 | 결과 |
|---|---|
| 콘텐츠 = 데이터 | 밸런스 조정·신규 적·신규 사건이 코드 빌드 없이 가능 |
| 패치 > 덮어쓰기 | 여러 모드가 같은 Def의 다른 필드를 동시에 고쳐도 공존 |
| 결정론 유지 | 모드를 써도 "같은 시드 + 같은 모드 목록 = 같은 세계" |
| 실패를 먼저 보여준다 | 로드 전에 충돌·누락·순환을 리포트, 게임 중 크래시 대신 |
| 엔진 이전 대비 | 포맷·의미론을 문서 + 적합성 테스트로 고정 |

플레이어 결정: 모드 목록이 곧 "이번 판의 규칙"이다. 시드 공유 문자열에 모드 해시가 포함되므로, 친구와 같은 세계를 돌리려면 같은 모드 목록이 필요하다.

## 2. 모드 폴더 구조

```
mods/someone.nightmod/
├─ manifest.json
├─ defs/            # 새 Def (하위 폴더 자유)
├─ patches/         # 다른 Def 수정
├─ lang/ko/ lang/en/  # 문자열 키 → 텍스트
├─ textures/        # 16×16 PNG, 화면 ×3 배율(CANON D13, 12 픽셀 가이드). 공개 배포 예제는 CC0 에셋만(CANON 7.1)
├─ migrations/      # Def ID 이름 변경 맵 (§7)
└─ scripts/         # 단계 1+ (훅·워커)
```

## 3. Def 시스템 [프로토타입]

### 3.1 형식 · ID
```json
{
  "defType": "DamageTypeDef",
  "id": "DamageType.Slash",
  "parent": "DamageType.EdgedBase",
  "abstract": false,
  "label": "@damage.slash.label",
  "armorCategory": "Edge",
  "woundDef": "Wound.Cut",
  "bleedPerDamage": 2.0,
  "arteryChancePerDamage": 0.02
}
```
| 필드 | 규칙 |
|---|---|
| `defType` | 스키마 이름. 알 수 없는 타입은 오류 |
| `id` | `^[A-Z][A-Za-z0-9]*(\.[A-Z][A-Za-z0-9]*)+$`. core 외 모드는 접두 권장(`Nightmod.Trait.Nightwalker`) |
| `parent` | 같은 `defType`의 Def 1개(단일 상속). 다른 모드의 Def면 의존성 선언 필수 |
| `abstract` | true면 인스턴스화·참조 불가, 부모로만 사용 |
| `@키` | 문자열은 `lang/` 키 참조. 리터럴도 허용(경고) |

- **ID 중복**: 같은 ID를 두 번 정의하면 오류. 의도적 교체는 `"override": true`(전체 교체, 리포트에 기록). 일반적으로는 패치를 쓴다.
- 확률·계수 값은 Def에서 소수(0.02) 허용, 로드 시 ‱ 또는 고정소수점 정수로 변환해 코어에 전달(결정론).

### 3.2 스키마 · 검증 단계
- 정본: `schema/<DefType>.schema.json`(JSON Schema 2020-12). 커스텀 키워드: `x-defRef`(참조 대상 타입), `x-unit`(ml, TU, g), `x-range`.
- TS 쪽은 스키마에서 타입·검증기를 생성(코드가 정본이 아님).

| 단계 | 검사 | 실패 처리 |
|---|---|---|
| 1 파싱 | JSON 문법, BOM, 중복 키 | 파일 단위 오류 |
| 2 형 검사 | 원본 Def를 "부분 스키마"(모든 필드 선택)로 | 오류 |
| 3 패치 | §4 | 패치별 오류/경고 |
| 4 상속 해석 | 순환, 부모 없음, 타입 불일치 | 오류 |
| 5 완전 스키마 | 해석된 Def를 필수 필드 포함 스키마로 | 오류 |
| 6 참조 해석 | `x-defRef` 대상 존재·타입·abstract 아님 | 오류(선택 참조는 경고) |
| 7 의미 검증 | Def 타입별 규칙(아래 §3.2.1) | 오류/경고 |
| 8 동결 | 불변 객체로 고정, 로드 해시 계산 | — |

#### 3.2.1 의미 검증 규칙 (7단계)

| Def | 규칙 | 심각도 | 근거 |
|---|---|---|---|
| `BodyDef` | 부위 커버리지 합 = 1,000(‰) | 오류 | 02 §16 |
| `HealthPoolDef` | `regions` 정확히 6개(머리·몸통·팔 2·다리 2), BodyDef의 모든 부위가 정확히 한 region에 속함, `stateThresholds` 내림차순 | 오류 | 02 §2.0, CANON D18 |
| `ItemDef` | `grid.w`·`grid.h` ≥ 1, 기본 배낭(10×6)에 회전 포함 들어갈 것. `weight`·`carryCapacity` 필드는 **폐지 필드**(오류) | 오류 | 13, CANON D22 |
| `WeaponDef` | `family` 필수(능력 트리 계열), 공격마다 `energy` 필수. `tu`·`stamina`·`skill`은 폐지 필드(현재 스키마 오류, 옛 스키마는 §8 자동 변환) | 오류 | 07 §14, CANON D9·D24 |
| `RecipeDef` | 개척·정원사 기술 아이템 제작 레시피 금지 | 경고 | CANON §3.3 |
| `WeatherTableDef` | 각 행 전이 확률 합 = 100 | 오류 | 09 §9.2 |
| `AbilityDef` | (`tree`, `order`) 유일, 트리당 4개(core 트리), `tier` 2는 같은 트리 능력 1개 선행, `prerequisites` 같은 트리·순환 없음. `Active`는 `energy`·`cooldownTurns` 필수, `Toggle`은 `toggleCost` 필수 | 오류 | 15 §5·§7 |
| `MasteryDef` | core는 `Mastery.Medicine`·`Mastery.Survival` 2종. 모드가 새 숙달을 추가하면 경고("D23 이탈"). `thresholds` 5개 오름차순, `bookCap` 필수이고 1 ≤ `bookCap` ≤ `thresholds[1]`(책으로는 2단계 문턱까지 — core 15). 위반은 오류 | 경고 / 오류 | 15 §9.3, 06 §5.2, CANON D23 |
| `XPSourceDef` | `kind` ∈ {Kill, Surrender, Rout, RoomDiscover, FloorEntry, Crisis}. 행동 횟수·독서·걸음 수 기반 kind는 오류. `Crisis`는 `limit.perGameDay` 필수 | 오류 | 15 §3, CANON D15 |
| `BookDef` | `skillXP`·`capSkill`은 폐지 필드(오류), `masteryCount` 대상은 숙달 Def만. 런타임에 책 `masteryCount`는 숙달마다 합산해 그 `MasteryDef.bookCap`(노련함이면 문턱 배율 ×0.8 적용 → 12)에서 자른다 | 오류 | 06 §5.2 |
| `PlaceEventDef` | `category: Threat`이면 `origin` 필수, `composition.fromPopulation`은 true만, `spawn` 필드는 폐지 필드(오류), `traces` 1개 이상 | 오류 | 10 §7·§10, CANON D8 |
| `RegionDef` | 지상 지도 1개, `dungeon` 층의 `depth`가 1부터 연속, `exits` 타일이 지상 지도 안의 통행 가능 칸 | 오류 | 14 §2·§12 |
| `MapGenDef`(지상) | `Validate` 단계에 `ResidentsInAnchors` 포함(모든 거주자가 구역·방 안) | 오류 | 09 §12, CANON D8 |
| `DungeonFloorDef` | `rooms[].residents`는 방에만, 복도 거주자 없음. `populationSources` 존재 | 오류 | 14 §4 |
| `ReoccupationRuleDef` | `graceDays` ≥ 0, `dailyChance` 0~1,000(‰) | 오류 | 14 §9.3 |
| 폐지 타입 | `SkillDef`·`TalentDef`·`EventDef` | 오류 + 대체 타입 안내(§3.4) | CANON D8·D23 |

### 3.3 상속 병합 의미론

| 값 종류 | 규칙 |
|---|---|
| 스칼라 | 자식이 덮어씀 |
| 객체 | 키 단위 깊은 병합 |
| 배열 | **기본 교체**. `{"$append": [...]}` 뒤에 추가, `{"$prepend": [...]}`, `{"$remove": [값 또는 {"id":..}]}` |
| `null` | 해당 키 삭제(부모 값 무효화) |
| `"$inherit": false`(객체 안) | 그 객체는 병합 대신 통째 교체 |

**검산 1 — 상속 병합**
```json
[
  { "defType": "WeaponDef", "id": "Weapon.MeleeBase", "abstract": true, "noise": { "swing": 6, "clash": 8 }, "special": ["Special.Shove"], "blockValue": 5 },
  { "defType": "WeaponDef", "id": "Weapon.HandAxe", "parent": "Weapon.MeleeBase", "noise": { "swing": 7 }, "special": { "$append": ["Special.BeardHook"] } }
]
```
결과: `noise = {swing: 7, clash: 8}`(깊은 병합), `special = ["Special.Shove", "Special.BeardHook"]`, `blockValue = 5`(상속).

### 3.4 2·3차 방향의 주요 Def 타입 [프로토타입]

> 1차 설계의 `SkillDef`(사용 기반 숙련)·`TalentDef`(숙련 임계 재능)·`EventDef`(가장자리·시야 밖 `spawn` 포함)는 **폐지**했다(CANON D8·D23). 로더는 이 타입을 만나면 오류를 내고 대체 타입을 안내한다(§3.2 7단계, §8 마이그레이션). 각 타입의 정본 예시는 괄호 안 문서다.

| 1차 타입 | 대체 | 정본 |
|---|---|---|
| `SkillDef` | `AbilityDef`(능력 트리 6 × 4) + `MasteryDef`(의료·생존 숙달 2종만) + `LevelCurveDef`·`XPSourceDef` | 15 §11 |
| `TalentDef` | `AbilityDef`(패시브) — 1차 재능은 05 부록 A의 후보 풀 | 15 §11, 05 부록 A |
| `EventDef`(`spawn`) | `PlaceEventDef`(`origin` 필수, `composition.fromPopulation`) | 10 §7 |
| (없음) | `RegionDef`·`DungeonFloorDef`·`RoomTypeDef`·`PopulationSourceDef`·`ReoccupationRuleDef` | 14 §12 |
| (없음) | `HealthPoolDef`(HP 풀 + 6부위) | 02 §16 |

**능력** (15 §11 형식 그대로)
```json
{
  "defType": "AbilityDef",
  "id": "Ability.Blunt.HeadBash",
  "label": "@ability.headBash.label",
  "tree": "Tree.Blunt", "tier": 1, "order": 1,
  "kind": "Active",
  "energy": 14, "cooldownTurns": 6, "turns": 1,
  "requires": { "weaponFamily": "Blunt" },
  "attackMods": [
    { "stage": "HitLocation", "field": "partWeightMult.Head", "op": "mul", "value": 4000 },
    { "stage": "Stun", "field": "stunChanceAddPct", "op": "add", "value": 40 }
  ],
  "quickSlot": true,
  "icon": "icon:ability_head_bash"
}
```
- 값은 15 §6.3 '머리 강타'(기력 14, 대기 6, 머리 가중 ×4, 기절 +40%p). `4000` = ×4.0(천분율 정수, §3.1).

**장소 사건** (10 §7 형식 그대로, 필드 일부)
```json
{
  "defType": "PlaceEventDef",
  "id": "Nightmod.Event.ShadeForage",
  "category": "Threat",
  "tags": ["ShadeFolk", "Forage"],
  "origin": { "place": "Place.GreyCloister.Floor1.EastCrack", "population": "Pop.ConduitDepths" },
  "schedule": { "at": "22:00", "everyDays": 1 },
  "conditions": ["pop('Pop.ConduitDepths').count >= 6"],
  "chance": 250,
  "composition": { "fromPopulation": true, "count": [1, 2] },
  "route": { "waypoints": ["Wp.Floor1.Storeroom", "Wp.Floor1.EastCrack"], "waitMinutes": 10 },
  "traces": ["Trace.Footprints"],
  "resolveWhileFrozen": "Settlement",
  "text": { "title": "@nightmod.event.shadeForage.title" }
}
```
- 모드 예: 그늘 사람이 밤마다 1층 창고로 먹이를 찾으러 나온다. 출발지 = 관로 균열(장소) + 관로 하단(공급원). 공급원 인원이 6 미만이면 열리지 않는다(10 E1).

**지역** (14 §12 `RegionDef`)과 **HP 풀** (02 §16 `HealthPoolDef`)은 해당 문서 예시를 그대로 쓴다. 모더가 자주 패치하는 필드:

| Def | 필드 | 패치 예 |
|---|---|---|
| `RegionDef` | `populationSources`, `exits[].status` | 출입구 `"Future"` → `"Open"` |
| `PopulationSourceDef` | `start`, `cap`, `regen` | 관로 하단 상한 24 → 30 |
| `ReoccupationRuleDef` | `graceDays`, `dailyChance` | 유예 3일 → 5일 |
| `HealthPoolDef` | `maxHp`, `regions[].maxRatio`, `stateThresholds` | 머리 최대치 300 → 250(‰) |

## 4. 패치 연산 [프로토타입: add/replace/remove/merge + ifModLoaded]

### 4.1 형식
```json
[
  { "op": "replace", "target": "DamageType.Slash", "path": "/bleedPerDamage", "value": 2.5 },
  { "op": "add", "target": "Race.Human", "path": "/traits/-", "value": "Nightmod.Trait.Nightwalker",
    "ifModLoaded": "someone.nightmod" },
  { "op": "merge", "targetQuery": { "defType": "WeaponDef", "tags": ["Weapon.Axe"] },
    "path": "/noise", "value": { "clash": 10 } },
  { "op": "add", "target": "MapGen.GreyCloister.Surface", "path": "/steps[op=Validate]", "position": "before",
    "value": { "op": "Scatter", "items": { "Nightmod.Obj.Shrine": 1 } } },
  { "op": "remove", "target": "Event.ReaverPatrol", "path": "/onSee[trace=Trace.ReaverCorpse]",
    "optional": true },
  { "op": "replace", "target": "Reoccupy.Default", "path": "/graceDays", "value": 5 }
]
```

| 연산 | 의미 |
|---|---|
| `add` | 객체 키 추가(이미 있으면 오류) / 배열 삽입(`/-` 끝, `[k=v]` 기준 `position: before/after`) |
| `replace` | 기존 값 교체(없으면 오류) |
| `remove` | 삭제(없으면 오류, `optional`이면 경고) |
| `merge` | 객체 깊은 병합(§3.3 규칙 동일) |
| `test` | 값이 일치할 때만 같은 파일의 이후 패치 블록 적용(`"then": [...]`) |

- **경로**: JSON Pointer(RFC 6901) + 확장 선택자 `[키=값]`(객체 배열에서 인덱스 대신 식별 필드로 찾기). 인덱스 경로(`/steps/3`)는 허용하지만 경고(다른 모드가 순서를 바꾸면 깨짐).
- **대상**: `target`(ID 1개) 또는 `targetQuery`(defType + tags/parent 필터, 일치 0개면 경고).
- **조건**: `ifModLoaded`, `ifModNotLoaded`, `ifDefExists`, `ifGameVersion`.

### 4.2 적용 순서
1. 모든 모드의 Def를 수집한 뒤, **모드 로드 순서 → 파일 경로 사전순 → 파일 내 배열 순서**로 패치를 적용한다.
2. 패치는 **상속 해석 전의 원본 Def**에 적용된다 → 추상 부모를 패치하면 모든 자식에 전파된다.
3. 자식이 이미 같은 필드를 덮어쓰고 있으면 부모 패치는 그 자식에 효과가 없다 → 검증 CLI가 "가려진 패치" 경고.

**검산 2 — 부모 패치 전파**: §3.3 예에서 `{"op":"replace","target":"Weapon.MeleeBase","path":"/blockValue","value":7}` → HandAxe의 blockValue = **7**(자식이 정의 안 함). 같은 패치로 `/noise/swing`을 9로 바꾸면 HandAxe는 **7 유지**(자식이 swing 7을 정의) + "가려진 패치" 경고.

## 5. 매니페스트 · 의존성 · 로드 순서 [프로토타입]

```json
{
  "id": "someone.nightmod",
  "name": "@mod.name",
  "version": "1.2.0",
  "gameVersion": ">=0.3.0 <0.5.0",
  "defSchemaVersion": 3,
  "dependencies": [{ "id": "core", "version": ">=0.3.0" }],
  "optionalDependencies": [{ "id": "other.betterwolves" }],
  "loadAfter": ["other.betterwolves"],
  "loadBefore": [],
  "incompatibleWith": ["third.nightless"],
  "scripts": { "stage": 0 },
  "authors": ["someone"],
  "tags": ["Content", "Trait"],
  "workshopId": null
}
```

### 5.1 위상 정렬
- 간선: `dependencies`·`loadAfter`(대상 → 나), `loadBefore`(나 → 대상). 목록에 없는 대상의 load 규칙은 무시.
- **Kahn 알고리즘**, 진입 차수 0인 후보가 여럿이면 ① 사용자 목록 순서 ② ID 사전순으로 선택 → **결정론적 순서**.
- 순환이 있으면 순환 경로를 출력하고 로드 거부.

**검산 3** — 사용자 목록 [C, A, B, D], A는 core 의존, B는 A 의존·`loadBefore: [C]`, C는 core 의존, D는 `loadAfter: [B]`:
간선: core→A, core→C, A→B, B→C, B→D. 진입 차수: core 0, A 1, B 1, C 2, D 1.
① core → A·C 차수 감소(A 0, C 1) → ② 후보 {A} → A → B 0 → ③ B → C 0, D 0 → 후보 {C, D}, 사용자 목록 순서상 C가 먼저 → C → ④ D.
**결과: core, A, B, C, D**.

### 5.2 충돌 리포트 (로드 전 표시)

| 종류 | 심각도 | 예 |
|---|---|---|
| 의존성 누락·버전 불일치 | 오류 | `someone.nightmod` 1.2.0이 core ≥0.3.0 요구, 현재 0.2.4 |
| 순환 | 오류 | A → B → A |
| `incompatibleWith` 동시 로드 | 오류 | — |
| ID 중복 정의 | 오류(`override` 없을 때) | — |
| 같은 경로를 다른 값으로 replace | 경고(마지막 승) | `DamageType.Slash/bleedPerDamage`: modA 2.5 → modB 3.0 |
| 가려진 패치 | 경고 | §4.2 |
| 인덱스 경로 사용 | 경고 | `/steps/3` |

### 5.3 로드 해시
`loadHash = hash(정렬된 [모드ID@버전 + 내용 해시])`. 세이브 헤더와 시드 공유 문자열(`시드-성향-loadHash`)에 포함. 해시가 다르면 "같은 세계"가 보장되지 않음을 경고.

## 6. 스크립트 훅 (단계적)

| 단계 | 내용 | 범위 |
|---|---|---|
| 0 | 데이터 모드만(Def + 패치 + 문자열 + 텍스처) | [프로토타입] |
| 1 | **훅 포인트**: 정해진 시점에 호출, 읽기 전용 상태 + 명령 반환 | [후속] |
| 2 | **워커 등록**: Def가 `"worker": "modid:Name"`으로 스크립트 구현을 지정 | [후속] |

### 6.1 훅 포인트 (단계 1 초안)

| 훅 | 호출 시점 | 반환 |
|---|---|---|
| `modifyHitChance` | 07 1단계 Σ수정치 계산 시 | 정수 가산치(모드당 ±30 클램프) |
| `onAttackResolved` | 07 6단계 후 | 명령 목록 |
| `onWoundInflicted` | 상처 생성 직후 | 명령 목록 |
| `onEventFired` / `onEventResolved` | 10 사건 | 명령 목록 |
| `onDayStart` / `onSeasonStart` | 01 달력 | 명령 목록 |
| `onItemCrafted` | 08 제작 완료 | 명령 목록 |
| `onDeath` | 개체 사망 | 명령 목록(사망 보고서 항목 추가 가능) |

명령 예: `addThought`, `applyWound`, `spawnItem`, `adjustReputation`, `queueEvent`, `log`. 코어가 **모드 로드 순서 → 등록 순서**로 적용한다.
- 생물을 지도에 직접 만드는 명령(`spawnCreature`)은 **없다**(CANON D8). 생물을 움직이려면 `queueEvent`로 `origin`이 있는 `PlaceEventDef`를 예약하고, 개체는 출발지 공급원에서 뽑혀 걸어온다(10 E1·E2). `spawnItem`은 아이템 전용이며 컨테이너·바닥 칸에만 놓인다.

```ts
export default defineMod({
  hooks: {
    onWoundInflicted(ctx, wound) {
      if (wound.part === 'Hand.Left' && ctx.rng.chance(1000)) // 1000‱ = 10%
        return [ctx.cmd.addThought(wound.ownerId, 'Nightmod.Thought.Maimed')]
      return []
    },
  },
})
```

### 6.2 워커 (단계 2 초안)
| 워커 인터페이스 | 용도 |
|---|---|
| `PlaceEventWorker` | `canFire(ctx)`, `execute(ctx)` — DSL로 못 쓰는 장소 사건 조건·결과. `origin` 검증은 워커 이전에 코어가 한다 |
| `MapGenStepWorker` | 09 MapGenDef(지상 지도)·14 층 생성의 사용자 정의 `op`. 실행 뒤에도 `ResidentsInAnchors` 검증을 받는다 |
| `AIConsiderationWorker` | 07 목표 선정 유틸리티 항 추가 |
| `ItemCompWorker` | 08 아이템 컴포넌트 동작 |

## 7. 샌드박스 · 결정론 규칙

| 규칙 | 내용 |
|---|---|
| 실행 환경 | **QuickJS**(웹은 wasm, 다른 엔진은 네이티브 임베드) — 엔진 이전 시 같은 스크립트가 그대로 동작 |
| 난수 | `ctx.rng`만. 모드별 하위 스트림(`hash(부모 스트림, modId)`) → 모드 추가가 다른 모드·코어의 난수를 밀지 않음 |
| 제거된 전역 | `Math.random`, `Date`, `performance`, 타이머, 네트워크, 파일, `eval` 외부 소스 |
| 수학 | `Math.sin/cos/tan/exp/log/pow`(비정수 지수) 제거. `ctx.math.isqrt`, 고정소수점 헬퍼 제공 |
| 상태 | 훅은 상태를 직접 수정 불가(읽기 전용 프록시). 지속 데이터는 `ctx.modState`(JSON, 64KB 상한, 세이브에 저장) |
| 예산 | 훅 호출당 연산 50,000 단계(인터럽트 핸들러). 초과 시 해당 훅 이번 세션 비활성 + 리포트 |
| 순회 순서 | 상태 뷰의 컬렉션은 ID 정렬 배열로만 제공(해시 순서 의존 금지) |

## 8. 세이브 호환성

세이브 헤더: 게임 버전, `defSchemaVersion`, 모드 목록(ID·버전·내용 해시), `loadHash`. **인스턴스는 Def의 수치를 복사하지 않고 Def ID + 상태만 저장**한다 → 모드 수치가 바뀌면 기존 세이브에도 즉시 반영.

| 변화 | 처리 |
|---|---|
| 모드 추가 | 기존 월드는 재생성하지 않음. 새 장소 사건은 `origin` 장소가 있는 지역에서만 열림, 새 바이옴·지역·층 생성은 아직 생성 안 된 지역에만 |
| 모드 제거 | 그 모드 Def를 참조하는 것: 아이템 → `Item.MissingPlaceholder`(격자 크기·배낭 위치 유지, 원 ID 보관 → 모드 재설치 시 복원), 상처·상태 → 제거 + 로그, 개체 → 층에서 제거 + 로그(공급원 인원은 그대로), 대기 사건 → 폐기, `modState` → 폐기 |
| 모드 업데이트 | Def ID 사라짐 → `migrations/rename.json`(`{"Old.Id": "New.Id"}`) 우선 적용, 없으면 제거와 동일 |
| 스키마 버전 상승 | core가 제공하는 Def 마이그레이션(JSON 변환)을 오래된 모드에 자동 적용 + 경고. 예: `defSchemaVersion` 3 → 4에서 공격의 `stamina` → `energy`, `tu` 삭제(D9·D24). `SkillDef`·`TalentDef`·`spawn` 사건은 자동 변환 불가 → 오류 + §3.4 대체 안내 |
| 각인 모드에서 목록 변경 | 허용하되 연대기에 "모드 변경됨" 표기, 업적 비활성 |

로드 전 차이 리포트: "제거될 아이템 3개, 상처 1개, 대기 사건 2개" → 계속/취소.

## 9. 모딩 도구 (= 개발 도구)

| 도구 | 기능 | 범위 |
|---|---|---|
| `ashveil-defs validate <mods...>` | §3.2 8단계 + 패치 dry-run + 충돌 리포트. 오류 시 종료 코드 1, `--json` 출력 | [프로토타입] |
| `ashveil-defs resolve <Def.Id>` | 해석된 최종 Def + **필드별 출처**(어느 파일·어느 패치가 설정했나) | [프로토타입] |
| Def 뷰어 | 검색·상속 트리·core 대비 diff·참조 역추적(이 Def를 쓰는 곳) | [후속] |
| `ashveil-sim run --seed --mods --days --bots N` | 헤드리스 시뮬: 사망 원인 분포, 사건 통계, 결정론 해시 | [후속] |
| `ashveil-defs pack` | 검증 + zip + 매니페스트 확인 | [후속] |
| 개발 모드 핫 리로드 | Def·문자열·텍스처 재적재(세이브 유지) | [후속] |
| 적합성 테스트 스위트 | 입력 Def + 패치 → 기대 출력 JSON 쌍 수백 개(엔진 이전 시 필수 통과) | [프로토타입: 30쌍] |

## 10. Steam 창작마당 업로드 흐름 [후속]

1. 게임 내 "모드 업로드"(Electron 빌드) → 로컬 모드 선택.
2. `validate` 자동 실행 → 오류 있으면 차단, 경고는 확인 후 진행.
3. `pack` → 미리보기 이미지(512×512 필수), 태그(Content/Balance/Event/MapGen/Script/Translation), 공개 범위.
4. steamworks.js UGC: 신규면 생성 → `workshopId`를 매니페스트에 기록, 기존이면 업데이트 + 변경 기록.
5. 구독자: Steam이 다운로드 → 게임 시작 시 스캔 → 모드 목록 UI(활성·순서·충돌 표시).
6. 웹 버전: 폴더·zip 가져오기(창작마당 없음). 같은 모드 파일이 양쪽에서 동작.
7. 스크립트 단계 ≥ 1 모드는 목록에 "스크립트 포함" 배지.

## 11. 버전 정책

| 대상 | 정책 |
|---|---|
| 게임 | semver. minor에서 Def 필드 추가 가능, 삭제·의미 변경은 major 또는 마이그레이션 동반 |
| `defSchemaVersion` | 정수. 깨지는 변경마다 +1, core가 이전 버전 → 현재 버전 Def 변환기 제공 |
| 폐기 예고 | 필드 폐기는 2 minor 버전 동안 경고 후 삭제 |
| 훅 API | `hookApiVersion` 별도 semver, 매니페스트 `scripts.api`로 요구 범위 선언 |
| 모드 | semver 권장, `gameVersion` 범위 필수 |

## 12. 엔진 이전(D6) 원칙

1. **정본은 데이터 포맷**: Def(JSON), 스키마(JSON Schema), 패치 의미론(이 문서 §3~4), 조건 DSL 문법(EBNF, 10 사건 조건) — 코드는 구현일 뿐.
2. **적합성 테스트**: 상속·패치·위상 정렬·DSL·RNG 테스트 벡터를 JSON 파일로 보관. 새 엔진 구현은 전부 통과해야 한다.
3. **RNG 알고리즘 명세**: 알고리즘(예: PCG32)과 하위 스트림 파생 해시를 명세 + 테스트 벡터 1,000개.
4. **Def에 엔진 전용 필드 금지**: 텍스처는 상대 경로, 렌더 힌트는 선택적 `render` 블록에만.
5. **공식은 코어, 파라미터는 Def**: 공식 자체를 Def에 넣지 않는다(DSL은 조건 판정만). 그래야 코어 이식 범위가 명확하다.
6. **스크립트 런타임 이식성**: QuickJS는 C 라이브러리라 Godot·Unity에 임베드 가능.

## 13. 프로토타입 샘플 모드 — `sample.ashfang`

목표: Def 로더·상속·패치·조건부 패치가 실제로 동작함을 보이는 최소 모드.
`defs/weapons.json`
```json
[{ "defType": "ItemDef", "id": "Ashfang.Item.FangKnife", "parent": "Item.MeleeWeaponBase",
   "label": "@ashfang.fangKnife", "category": "Weapon", "tags": ["Weapon.Blade"],
   "grid": { "w": 1, "h": 2, "rotatable": true }, "stackLimit": 1,
   "equip": { "slots": ["MainHand", "OffHand"], "equipTurns": 1, "unequipTurns": 1 },
   "comps": { "weapon": "Ashfang.Weapon.FangKnife" } },
 { "defType": "WeaponDef", "id": "Ashfang.Weapon.FangKnife", "parent": "Weapon.KnifeBase",
   "label": "@ashfang.fangKnife", "family": "Blade",
   "attacks": [{ "id": "stab", "damageType": "Pierce", "baseDamage": 8, "penetration": 10,
                 "energy": 4, "reach": 1, "bleedMult": 1200, "accuracy": 0 }],
   "stuffSlot": { "blade": "Bone" } }]
```
`patches/drops.json`
```json
[{ "op": "add", "target": "Loot.Ossuary.Sarcophagus", "path": "/entries/-",
   "value": { "item": "Ashfang.Item.FangKnife", "weight": 20 } },
 { "op": "replace", "target": "DamageType.Slash", "path": "/bleedPerDamage", "value": 2.25,
   "ifModNotLoaded": "someone.realisticbleeding" }]
```
- `attacks`는 배열이라 상속 시 **통째 교체**된다(§3.3). `{"id":"stab","baseDamage":8}`만 쓰면 나머지 필드가 사라져 5단계(완전 스키마)에서 오류 → 샘플 모드가 이 함정을 일부러 보여준다.
- 공격 형식은 07 §14(`energy` = 기력, `bleedMult` 천분율 1200 = ×1.2). 1차 형식의 `tu`·`stamina` 필드는 현재 스키마에서 폐지 필드라 7단계 오류다(D9: 공격은 1턴, D24: 기력). 옛 `defSchemaVersion`을 선언한 모드만 §8 마이그레이션이 자동 변환한다.
- `family: "Blade"` + 찌르기만 있는 무기 → 도검 트리 중 **급소 찌르기는 쓸 수 있고 깊게 베기는 잠긴다**(15 §7 공격 방식 요구). 능력 Def를 건드리지 않고 무기 하나로 능력 규칙이 따라오는 것을 보여준다.
- 수용 기준: `validate` 통과, `resolve Ashfang.Weapon.FangKnife`가 부모의 `blockValue`·`noise` 등을 상속하고 `attacks`는 교체된 결과를 출처와 함께 출력, 수도원 2층 납골실 석관(13 `Container.Sarcophagus`)에서 송곳니 칼이 나올 수 있음, 베기 출혈 계수 2.25(깊은 베임 D 20 → 20 × 2.25 = 45 ml/턴).

## 14. 다른 시스템과의 상호작용

| 시스템 | 모딩 관점 |
|---|---|
| 01 시간 | TU 비용은 Def 파라미터, 스케줄러는 코어 |
| 02~06 | 신체 트리·HP 풀(`HealthPoolDef`)·상처·특성·배경·숙달·지식 항목 전부 Def |
| 07 전투 | WeaponDef·AIPersonaDef·SpecialActionDef, 훅 `modifyHitChance` |
| 08 아이템 | ItemDef·MaterialDef·RecipeDef, techLevel 검증 |
| 09 월드 | BiomeDef·MapGenDef(지상 지도, 단계 삽입 패치)·PlaceChangeDef, DiseaseDef |
| 10 스토리텔러 | PlaceEventDef(`origin` 필수, 조건 DSL)·PersonaDef [후속] |
| 13 소지품 | ItemDef(`grid`)·InventoryDef·LootContainerDef. 무게 필드 없음 |
| 14 장소 | RegionDef·DungeonFloorDef·RoomTypeDef·PopulationSourceDef·ReoccupationRuleDef |
| 15 능력 | AbilityDef·LevelCurveDef·XPSourceDef·MasteryDef |
| 12 UI | 문자열 키, 텍스처, 키 바인딩 기본값 Def |

## 15. 깊이 3층 (모더 관점)

| 층 | 내용 |
|---|---|
| L1 | 숫자 바꾸기: `replace` 패치 한 줄로 베기 출혈 계수 조정 |
| L2 | 상속으로 새 무기·적·장소 사건 추가, 조건부 패치로 다른 모드와 호환, `[op=…]`·`[id=…]` 선택자로 순서 독립 패치 |
| L3 | 훅·워커로 새 메커니즘, `modState`로 지속 상태, 시뮬 러너로 밸런스 검증, 필드별 출처 추적으로 다중 모드 디버깅 |

## 16. "이런 것까지?" 디테일

1. 추상 부모를 패치하면 모든 자식에 전파, 단 자식이 덮어쓴 필드는 "가려진 패치" 경고.
2. 배열 패치는 인덱스 대신 `[op=Validate]` 선택자 → 다른 모드가 단계를 끼워 넣어도 안 깨짐.
3. 모드마다 RNG 하위 스트림이 따로 → 모드 하나 추가해도 코어 전투 난수는 그대로.
4. 확률·계수는 Def에서 0.02처럼 소수로 써도 로드 시 고정소수점 정수(200‱)로 변환.
5. 모드 제거 시 아이템은 "알 수 없는 물건"으로 남고 원 ID를 보관 → 다시 설치하면 복원.
6. `resolve` 명령이 필드마다 "어느 모드 어느 파일 몇째 패치가 이 값을 정했나"를 보여준다.
7. 위상 정렬 동률은 사용자 목록 순 → ID 사전순 → 어느 컴퓨터에서든 같은 순서.
8. 훅이 연산 예산을 넘으면 크래시 대신 그 훅만 비활성 + 리포트.
9. 스크립트 상태 뷰의 컬렉션은 항상 ID 정렬 배열(해시맵 순회 순서 차이로 결정론이 깨지는 것 방지).
10. 시드 공유 문자열에 로드 해시가 들어가 "같은 시드인데 왜 다르지?"를 미리 경고.
11. 문자열 리터럴(`@키` 아님)은 경고 → 번역 모드가 덮을 수 없기 때문.
12. 개척·정원사 기술 아이템에 제작 레시피를 붙이면 검증 경고(세계 규칙 CANON §3.3).
13. 모드가 위협 사건에서 `origin`을 빼면 로드 전에 막힌다. "어디서 왔는가"가 없는 적은 모드로도 만들 수 없다(10 E1).
14. 1차 모드의 `stamina`·`tu` 공격 필드는 스키마 마이그레이션이 `energy`로 바꾸고 `tu`는 지운다 — 같은 무기가 "한 번 휘두르면 1턴"이 된다.

## 17. UI 표현

- 모드 관리 화면: 활성 목록(드래그로 순서 힌트 — 실제 순서는 위상 정렬 결과를 옆에 표시), 충돌 리포트 패널(오류 빨강·경고 노랑), 모드별 Def 수·패치 수.
- 개발자 콘솔(설정에서 켬): `resolve`·`validate` 동일 명령.
- 게임 내 툴팁 백과 항목에 "출처: sample.ashfang" 작은 표시.

## 18. 엣지 케이스 & 악용 방지

| 사례 | 처리 |
|---|---|
| 악성 스크립트(무한 루프·메모리) | 연산 예산, 메모리 상한 16MB/모드, 네트워크·파일 API 없음 |
| 스크립트로 세이브 조작 | 상태 직접 수정 불가, 명령만 반환 |
| 거대 Def(수만 개)로 로드 지연 | 로드 시간 리포트, 모드별 로드 시간 표시 |
| 패치가 스키마를 깨뜨림 | 5단계 완전 스키마 검증에서 패치 출처와 함께 오류 |
| 순환 상속을 다른 모드가 유발 | 4단계에서 경로 + 관여 모드 표시 |
| 번역 모드가 ID까지 바꿈 | `lang/`은 문자열 키만 허용, Def 로드 경로와 분리 |

## 19. 프로토타입 범위

| 항목 | 표시 |
|---|---|
| Def 로더(JSON), JSON Schema 검증, 상속(parent/abstract, 병합 의미론) | [프로토타입] |
| 참조 해석, 의미 검증 일부(커버리지 합·격자 크기·`origin` 필수·능력 트리·폐지 타입/필드) | [프로토타입] |
| 패치 add/replace/remove/merge, `[k=v]` 선택자, `ifModLoaded`/`ifModNotLoaded` | [프로토타입] |
| 매니페스트·위상 정렬·충돌 리포트·로드 해시 | [프로토타입] |
| `validate`·`resolve` CLI, 적합성 테스트 30쌍, 샘플 모드 `sample.ashfang` | [프로토타입] |
| 스크립트 훅·워커·QuickJS, Def 뷰어, 시뮬 러너, 창작마당, 세이브 마이그레이션 | [후속] |

## 20. 열린 질문

1. 패치를 원본에 적용(현재)할지, 해석 후 Def에도 적용 가능하게 할지(`"resolved": true` 옵션) — 가려진 패치 문제의 해법.
2. 조건 DSL 함수 목록(10 사건)과 이 문서의 보안 경계를 어디서 정본으로 둘지.
3. QuickJS vs 브라우저 Web Worker: 웹 버전 성능(wasm 오버헤드) 측정 후 확정.
4. 모드 ID 접두 강제 여부(현재 권장).
