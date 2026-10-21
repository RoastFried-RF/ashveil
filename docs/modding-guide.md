# 콘텐츠 모드 만들기

현재 사용할 수 있는 경로는 JSON Def의 추가·상속·패치, 로더 검증, 새 게임의 모드 선택과 같은 구성의 각인 복원이다. 이 안내는 실제 로더와 함께 검사한 예제를 사용한다. v0.224에서 동기 스크립트 훅을 추가했다. 장소 워커 첫 연결은 아래에 있으며 AI 워커는 아래에서 지원하며 나머지 워커·창작마당 연결은 [남은 구현 범위](expansion-roadmap.md)에 있다. JSON만으로 코어/클라이언트에 없는 새 행동을 정의할 수는 없다.

## 처음 실행하기

Node/pnpm 의존성을 설치한 저장소에서 다음을 실행한다. 로컬 배포 도구는 현재 클라우드 환경의 GNU tar와 Node zlib를 사용한다.

```bash
pnpm validate-defs sample-patrol-contract
pnpm schema
pnpm validate-schema
pnpm dev
```

새 게임에서 ‘순찰 장부 예제’를 선택한다. 실제 양치기 골의 상인 곁에서 N을 열면 기존 세 지점 경로의 새 순찰 보수가30/기한2일로 게시된다. 수락할 때 실제 시장 잔액에서30을 예치하며 실제 순서 이동·확인·돌아와 보고해야 받는다. 새 사람·물품·화폐를 만들지 않는다. 이 예제는 v0.211 이상의 `PatrolContract.Hearth`를 사용한다.

`validate-defs`는 실제 상속/패치 후의 참조와 범위를 확인한다. `validate-schema`는 원본 JSON 모양을 검사한다. 둘은 서로 다른 검사이며, 실제 플레이/각인 검사도 별도로 한다.

## 폴더와 manifest

```text
mods/
  sample-patrol-contract/
    manifest.json
    patches/
      ledger.json
    README.md
```

`defs/`와 `patches/`의 JSON은 각각 Def/패치의 배열이다. 하위 폴더를 나눠도 된다. JSON 주석/후행 쉼표는 허용하지 않는다. 현재 브라우저는 빌드 시 모드 파일을 수집하므로 폴더를 추가한 뒤 개발 서버를 다시 시작하거나 다시 빌드한다.

```json
{
  "id": "sample-patrol-contract",
  "name": "순찰 장부 예제",
  "version": "1.0.0",
  "description": "기존 실제 순찰의 보수와 기한을 바꾼다.",
  "dependencies": ["core"]
}
```

| 필드 | 의미 |
|---|---|
| id | 모드 식별자. 폴더 이름과 달라도 되지만 다른 manifest와 중복되면 안 된다 |
| name / version | 표시 이름과 배포 버전 문자열 |
| description / author | 선택적인 설명/저자 |
| dependencies | 반드시 함께 로드할 모드id |
| loadAfter | 존재할 때 뒤에 로드할 모드id. 필수 의존성 대신 쓰지 않는다 |
| incompatibleWith | 동시에 로드할 수 없는 모드id |

core를 먼저 로드하고 의존 순서를 정렬한다. 독립 모드는id 순서, 파일은 경로 순서로 처리한다. 순환/없는 필수 의존/중복ID/동시 비호환은 시작 오류다. 버전 문자열에 대한 자동 호환 범위 판정은 없다. 다른 모드의 Def를 상속하면 그 모드를 dependencies에도 선언한다.

## 새 Def와 상속

실제 타입 이름은 `Trait`, `Item`, `Terrain`, `PlaceEvent`처럼 쓴다. 기획 문서의 옛 `ItemDef`/`EventDef` 예시를 그대로 붙이기보다 [현재 Schema](schema/defs.schema.json)와 [현재 타입](../src/core/types.ts)을 확인한다. 알 수 없는 타입은 로더가 거절한다.

```json
[
  {
    "defType": "Trait",
    "id": "Trait.ExampleHemophobic",
    "label": "피를 꺼리는 성향",
    "description": "피를 보면 스트레스가 빨리 쌓인다.",
    "conflicts": ["Trait.Bloodlust"],
    "mods": { "stressMult": 1.6 }
  }
]
```

새 Def를 등록해도 자동으로 생물에게 붙거나 물품이 생성되지는 않는다. 사용하는 배경/배치/규칙과의 연결도 필요하다. 기존 Def를 바꾸려면 원본을 복사해 덮어쓰지 말고 패치를 쓴다.

`parent`는 같은 타입의 부모 하나를 지정한다. 자식이 쓰지 않은 필드는 부모에서 물려받는다. `abstract:true`인 부모는 직접 사용하는 완성 Def가 아니며, 최종 자식에는 실제 필수 필드가 있어야 한다. 다른 모드 부모는 실제 의존성을 선언한다. 상속 뒤 참조/범위와 필수 필드는 다시 검증한다.

새 Item을 만들기 전에는 [인벤토리/칸·물품 레지스트리](design/13-inventory.md)와 재질/장비 규칙을 확인한다. 기존 예제의 무기를 복사했다고 등록/아트/밸런스 검토가 끝난 것은 아니다. 현재 콘텐츠 모드는 빌드에 있는 sprite 식별자를 재사용한다. 임의의 PNG를 폴더에 넣으면 자동으로 새 atlas가 되지는 않는다. 저장소에는 허가된 잘라낸 게임용 스프라이트만 넣으며 원본 팩을 배포하지 않는 [에셋 원칙](CANON.md)을 따른다.

## 기존 Def 패치

[검사한 순찰 장부 예제](../mods/sample-patrol-contract/patches/ledger.json)는 다음 세 변경을 한다.

```json
[
  {"op":"replace","target":"PatrolContract.Hearth","path":"/baseReward","value":30},
  {"op":"replace","target":"PatrolContract.Hearth","path":"/deadlineDays","value":2},
  {"op":"replace","target":"PatrolContract.Hearth","path":"/routes/[key=hearth-round]/label","value":"양치기 골 여유로운 시장길 순찰"}
]
```

| op | 용도 |
|---|---|
| add | 없는 객체 키 추가 또는 배열 삽입 |
| replace | 존재하는 값 교체 |
| remove | 존재하는 키/배열 원소 삭제 |
| merge | 기존 객체/상속 구조에 재귀 병합 |

`target`은 실제 Def id다. `path`는 JSON Pointer이며 키에 든 `/`는 `~1`, `~`는 `~0`으로 표현한다. 루트나 없는 경로/범위 밖 배열을 임의로 만들어 주지 않는다. 실패한 패치는 원본을 부분 변경하지 않는다. `ifModLoaded`/`ifModNotLoaded`/`ifDefExists`는 해당 조건일 때만 적용할 때 쓴다. 조건 때문에 생략될 수 있는 패치가 필수 참조를 만들어야 하는 구조는 피한다.

`override`로 우연히 중복ID를 숨기는 대신, 의도와 의존성을 분명히 하고 기존 Def의 일부 변경에는 패치를 사용한다. 모든 선택 모드를 함께 로드해 충돌도 검사한다.

## 목록 선택자와 삽입

배열의 객체는 `[id=값]`/`[key=값]` 등으로 찾는다. [선택자 예제](../mods/sample-selector/patches/quiet.json)는 `/director/profiles/[key=quiet]/restHours`를 바꾼다. 목록 앞에 다른 성향이 추가돼도 같은quiet을 선택한다.

일치 항목이 없거나 둘 이상이면 오류다. 선택자 위치에 `add`할 때는 `position:"before"` 또는 `"after"`로 방향을 명시한다. 숫자 인덱스는0이상의 정수이며 `/-`는add의 끝 삽입에만 쓴다. 키 안의 Pointer 이스케이프도 해석한다. [선택자 구현/제한](mod-patch-selectors-implementation.md)을 확인한다.

## 배열과 객체 병합

배열의 기본 병합은 교체다. 기존 항목을 남기고 추가하려면 다음 지시를 쓴다.

| 지시 | 동작 |
|---|---|
| `{"$prepend":[...]}` | 앞에 추가 |
| `{"$append":[...]}` | 뒤에 추가 |
| `{"$remove":[값 또는 {"id":"값"}]}` | 같은 값/지정id 항목 제거 |

같은 지시에 함께 쓰면 삭제→앞 추가→뒤 추가 순서다. 객체 키의null은 상속/merge에서 삭제하고, 객체의 `$inherit:false`는 그 객체를 통째로 교체한다. 최종 필수 키를 삭제했다면 최종 로더 검증은 실패한다.

[병합 예제](../mods/sample-merge/patches/profiles.json)는 기존 네 성향을 보존하면서 ‘긴 휴식’을 추가한다. 선택자 예제와 함께 켜도 기존quiet60시간/새long-rest72시간을 각각 유지한다. 원본 자식Schema는 병합 지시와 새 원소의 실제 타입을 확인하며, 최종 상속/참조 검사도 필요하다. [구현 범위](mod-merge-implementation.md).

## 원래 인원만 사용하는 장소 사건

[순찰 데이터 예제](../mods/sample-patrol/manifest.json)는 기존 야영지 사람 두 명을 편성해 개울/원래 집 경로를 걷고 경유지에서37턴 기다리게 한다. 새 적/물품을 정의하지 않는다.

```json
{"op":"replace","target":"Event.ReaverPatrol","path":"/composition/count","value":[2,2]}
```

같은 패치에chance1/route `["stream","@home"]`/waitTurns37을 둔다. 실제 경보/수색 반응은 남아 있으므로 야영불/흔적에 따라 이 순찰에서도 수색이 이어질 수 있다.

| 필드 | 실제 의미 |
|---|---|
| defType | `PlaceEvent`. 기존 `Event.ReaverPatrol` id는 호환을 위해 유지 |
| origin | 실제 세력key/현재 지도 경유지key/최소 원래 인원 |
| composition.fromPopulation | true. 실제 원래 인원을 사용 |
| composition.count | 최소/최대 편성 인원. 모자란 인물을 새로 만들지 않음 |
| leader / leaderChance | 실제 생물Def / 보통 두목 동행 확률 |
| traces | 출발지/사건을 예고하는 흔적 |
| place | 경로·확률·대기 행동 |

경로에는 지도에 있는 경유지 이름, `@home`(원래 집), `@trace`(보고된 흔적), `@stash`(실제로 가까운 보관함)를 쓴다. 보관함이 없으면 그 선택 경유만 생략한다. 출발지/필수 경유지가 없으면 편성/강화 비용을 만들지 않는다. 순찰 도착은 기존AI처럼 한 칸 이내이며 수색은 도착 대기 없이 다음 목적지로 간다. 몸/경로/격자/유한 인원을 그대로 사용한다.

폐지된 `Event`타입/`spawn`필드는 오류다. [형식 전환](place-event-schema-implementation.md)을 확인한다. 보이지 않는 현재 인구/원격 물품을 계약 UI에 그대로 공개하는 기능도 이 예제에 없다. 새 계약은 공개 경로 또는 실제 관찰 사본과 기존 장부를 사용해야 한다.

## 검사와 각인 호환

```bash
pnpm validate-defs sample-patrol sample-selector sample-merge sample-patrol-contract
pnpm schema
pnpm validate-schema
pnpm exec vitest run tests/defs.test.ts tests/mod-package.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

실제 배포할 조합으로 새 게임을 열고 변경된 행동·소요 턴·돈/물품 보존·타이틀→새로고침→이어서 하기를 확인한다. 테스트 파일 이름/검사 범위는 현재 저장소의 해당 기능 테스트도 참고한다. 골든 해시를 바꾸는 변경은 이전 전체 초기/최종 상태와 명령/오류를 대조한 뒤 검토한다. 단순히 기대 해시를 다시 쓰면 회귀 검사가 되지 않는다.

각인에는 선택한 모드id 목록이 저장되고 이어서 할 때 같은 구성을 사용한다. Def 파일의 전체 사본이나 모드 버전별 콘텐츠를 각인에 동봉하는 방식은 아니다. 같은id의 모드를 업데이트해도 이미 존재하는 사람/물품 UID와 맡은 계약의 예치/보수/증거를 임의로 다시 생성하지 않는다. 이관이 필요한 규칙은 명시적인 버전 처리와 구형 전체 상태 검사가 필요하다.

새 게임 화면에서의 선택 해제는 기존 각인에서 모드를 안전하게 제거하는 이관 기능을 뜻하지 않는다. 이미 각인에 쓰인 Def id를 삭제/다른 뜻으로 재사용하지 않고, 버전과 변경 내역/지원 범위를 README에 기록한다.

## 로컬 배포 파일 만들기

```bash
pnpm mod:package sample-patrol-contract
pnpm mod:package sample-patrol-contract test-results/mod-packages/ledger-review.tar.gz
```

실제 manifest id로 원본 폴더를 찾고 의존 모드를 포함한 로더 검증을 먼저 한다. 성공하면 파일 목록/원본 SHA-256/배포 파일 SHA-256/선택한 모드/패치 수를 출력한다. 기본 출력은 `test-results/mod-packages/<id>-<version>.tar.gz`다. 같은 경로의 기존 파일은 덮어쓰지 않으므로 새 이름을 지정하거나 검토한 이전 파일을 직접 관리한다.

현재 배포 도구는 manifest.json, defs/patches의JSON, 선택적인 README.md/LICENSE/LICENSE.md/LICENSE.txt를 묶는다. 전체 선택 모드는8MiB/512파일 이내다. 소스/검사 경로의 심볼릭 링크, 실행 파일/임의 자산과 지원하지 않는 폴더는 거절한다. 이 패키지는 JSON 콘텐츠용이며 스크립트/이미지 모드의 설치기를 제공한다고 주장하지 않는다.

파일은 정렬된 상대 경로로 묶고 소유자/권한/시각을 고정한다. 같은 입력은 바이트가 같은 gzip/tar 결과를 만든다. 완성한 임시 파일을 기존 출력을 덮지 않는 방식으로 공개하며 자신이 만든 임시 파일만 정리한다. 압축에는 원래 모드 폴더가 최상위에 있으므로 다른 체크아웃의 `mods/` 안에 풀고 서버/빌드를 다시 시작한다. 필수 의존 모드가 별도 모드라면 함께 설치한다.

이 명령은 로컬 배포 파일 생성이다. 외부 창작마당에 게시하거나 계정에 업로드하는 작업은 수행하지 않는다.

## 오류를 고치기

| 메시지/상황 | 확인할 것 |
|---|---|
| 필수 의존 모드 없음 | manifest id와 dependencies, 설치 폴더 |
| 순환 의존성 | dependencies/loadAfter의 순환 고리 |
| 알 수 없는 Def/참조 | 실제 타입 이름/id, 부모·의존 모드, Schema |
| 선택자 없음/중복 | 선택 속성/값과 병합 뒤 목록 |
| 패치 경로 실패 | Pointer 이스케이프, add/replace 구분, 실제 배열 범위 |
| 값/연결 검증 오류 | 상속 뒤 필수 필드·범위·실제 장소/기구/인원 연결 |
| 모드가 새 게임 목록에 없음 | manifest.json 위치와 서버/빌드 재시작 |
| 이어서 할 수 없음 | 각인의 실제 모드id/Def와 설치한 버전, 이관 지원 |
| 배포 파일이 이미 있음 | 기존 파일 보존, 새 출력 경로 사용 |

## 참고 파일

- [실제 Def/패치 로더](../src/core/defs.ts), [현재 타입](../src/core/types.ts), [JSON Schema](schema/defs.schema.json)
- [실제 모드 검증 CLI](../tools/validate-defs.ts), [로컬 배포 도구](../tools/package-mod.ts)
- [정본 모딩 설계](design/11-modding.md), [엔진 경계와 측정](engine-evaluation.md)
- [순찰 장부 예제](../mods/sample-patrol-contract/README.md), [원래 인원 순찰 예제](../mods/sample-patrol/manifest.json), [선택자](../mods/sample-selector/manifest.json), [상속/병합](../mods/sample-merge/manifest.json)


## 동기 스크립트 훅 · v0.224

[실제 예제](../mods/sample-script-hooks/scripts/main.js)는 다음 구성으로 등록한다. 새 게임에서 ‘스크립트 훅 예제’를 선택하면 격리 실행기를 준비한 뒤 게임을 시작한다. 기본 게임에는 실행기를 로드하거나 모드 상태/난수 스트림을 만들지 않는다.

```json
{"id":"my-script","name":"나의 스크립트","version":"1.0.0","dependencies":["core"],"scripts":{"stage":1,"entry":"scripts/main.js"}}
```

```js
export default defineMod({hooks:{
  onDayStart(ctx, event) {
    ctx.modState.days = (ctx.modState.days ?? 0) + 1
    return [ctx.cmd.log('info', '새 날짜를 기록했다.')]
  },
  modifyHitChance(ctx, event) { return 2 }
}})
```

진입점은 `scripts/` 아래의 `.js` 한 파일이며 UTF-8 64KiB 이하이다. 스크립트 모드ID는 영문/숫자로 시작하는128자 이하의 영문·숫자·점·밑줄·하이픈이며 예약 객체 키는 쓸 수 없다. 모듈 import·비동기 작업·타이머를 지원하지 않는다. `stage:0`은 JSON 전용이며, `stage:2`는 아래의 장소 사건 워커 첫 연결을 지원한다. 훅 이름은 다음 9개만 허용한다.

| 훅 | 실제 호출과 입력 |
|---|---|
| modifyHitChance | 명중 계산의 정수 가산치, 모드당 ±30. 화면 미리보기는 명령·모드 데이터·난수를 저장하지 않는다 |
| onAttackResolved | 실제 공격 처리 후 actorId/targetId/hit/damage/killed/ranged |
| onWoundInflicted | 실제 세계 개체의 상처 생성 후 ownerId/woundId/part 등 |
| onDeath | 실제 사망 처리 후 ownerId. 중복 사망 통지는 제외 |
| onItemCrafted | 실제 제작/수거 출력 후 ownerId/recipe/item/uid/count |
| onDayStart | 실제 날짜 경계 후 day/year/dayIndex |
| onSeasonStart | 실제 계절 경계 후 season/year/day |
| onEventFired | 현재 지도 원래 순찰/수색 인원이 실제 출발한 뒤 event/runId/actorIds/members |
| onEventResolved | 위 사건 원래 참여자가 모두 실제 귀환하거나 사망·포로·동료·항복으로 종결된 뒤 event/runId/actorIds/returned |

동결 지역의 정산 사건은 현재 훅 대상에 포함하지 않는다. 진행 중인 사건은 각인에 원래 참여자 ID와 지역을 보존하고 현재 지도에서만 종결을 확인한다. 사건 추적 상한은32개이다.

`ctx.view`는 시각/지도 ID/플레이어 ID와 현재 사건 당사자·플레이어만 ID순으로 담는 동결된 복사본이다. 다른 NPC 전체 상태나 다른 모드 데이터를 제공하지 않는다. `ctx.event`도 읽기 전용이다. 지속 데이터는 JSON인 `ctx.modState`에만 넣는다. 훅마다 새 VM을 만들므로 전역 변수에 숨긴 데이터는 다음 호출에 유지되지 않는다.

현재 반환 가능한 명령은 `ctx.cmd.log(kind,text)`, `ctx.cmd.addThought(target,thoughtDefId)`, `ctx.cmd.adjustReputation(factionId,delta)`이다. 실제 존재하는 Def/당사자와 명령당 범위를 확인하며 목록32개 전체를 검증한 뒤 적용한다. 잘못된 명령이 하나라도 있으면 그 호출의 명령/모드 데이터/난수 모두 반영하지 않고 해당 모드의 해당 훅을 중단한다. v0.225에서 아래 세 명령을 추가했다. 장소 사건 워커는 아래에서 지원하며 다른 워커는 다음 구현 범위이다. `spawnCreature`는 제공하지 않는다.

난수는 `ctx.rng.int(lo,hi)`와 `ctx.rng.chance(0..10000)`만 제공하고 모드·훅별 하위 스트림을 저장한다. 정수 도우미는 `ctx.math.isqrt(n)`, `ctx.math.mulDiv(a,b,d)`이다. Date/시각/네트워크/파일/타이머/Math.random·초월함수는 제공하지 않는다. QuickJS0.32.0의16MiB 메모리/256KiB 스택과 인터럽트5구간으로 연산을 제한한다. 고정 런타임의 카운터 구간은10,000이지만 이 수치는 JS문장 개수나 실행 시간 보장이 아니다. 반환 결과와 상태를 합쳐 UTF-8 64KiB를 넘을 수 없다.

각인은 원래 소스 해시·모드 상태·중단 훅·하위 난수를 보존한다. 소스 구성이 바뀌면 이어 하기를 거절하므로 같은 소스를 보관한다. 소스 해시는 재현 식별용이며 보안 서명이 아니다. 모드 패키지의 SHA-256 목록은 별도로 검산한다.

```bash
pnpm validate-defs sample-script-hooks
pnpm mod:package sample-script-hooks test-results/sample-script-hooks.tar.gz
```

배포 도구는 실제 격리 실행기로 모듈을 컴파일하고 등록 훅까지 검증한다. JSON 예제와 동일하게 심볼릭 링크/경로 탈출/파일 수/압축 전 크기를 검사하며 이미 있는 출력 파일은 덮어쓰지 않는다.


## 추가 스크립트 명령 · v0.225

제목 화면의 ‘스크립트 포함’ 표시는 실제 동기 JS진입점이 있는 모드를 뜻한다. ‘스크립트 명령 예제’는 명시적으로 작은 상처와 붕대 생성/순찰 예약을 시연하며 기본으로 선택하지 않는다. 명령 인자는 다음과 같다.

| 명령 | 검증과 실제 적용 |
|---|---|
| `applyWound(target,woundDefId,partId,severity)` | 현재 사건 당사자 또는 플레이어의 살아 있는 실제 부위, 실제 WoundDef, 정수1–100. 기존 상처 경로/출혈/오염/UID를 사용하며 플레이어를 가짜 가해자로 기록하지 않는다 |
| `spawnItem(itemDefId,count,{x,y},destination='floor')` | 현재 당사자/플레이어 주변1칸, 실제 ItemDef, 정수1–min(100,maxStack). 통과 가능한 바닥 또는 이미 열린 실제 용기에만 배치. 용기는 실제 격자 빈 칸을 목록 전체로 예약하고 기존 UID/물품을 보존한다 |
| `queueEvent(eventDefId,delayTurns,{x,y})` | 현재 지상 지도의 기존 야영지 출발지/경로를 가진 순찰·수색만 지원. 근처 실제 좌표와 정수1–28800턴. 대기32건을 목록 전체로 합산하고 실제 재사용 대기/확률/원래 공급원 인원으로 한 번 출발을 시도한다 |

예약의 의미는 미래 실행 시도이다. 공급원/경로/인원/재사용 대기 조건을 만족하지 못하면 새 무리를 만들지 않고 그 예약을 끝낸다. 다른 지역에 있는 동안에는 보관하고 해당 지도에서 실제 확인할 때 처리한다. 같은 턴의 중복 예약과 정기 순찰은 한 번만 출발한다. 대기 예약·원래 인원 ID·생성한 실제 물품·소스/모드 데이터는 각인162에 보존한다.161각인에 과거 예약을 추가하지 않는다.

상처 훅이 다시 상처를 요청하는 경우도 같은 검증을 받는다. 최대4단계이며 전체 연쇄64명령을 넘는 호출은 명령/데이터/난수를 적용하기 전에 거절한다. 이 제한은 JS실행 예산과 별도로 적용한다. 생성된 아이템은 모드가 명시적으로 요청한 현물이며 기본 게임의 경제/재고에 자동 지급되지 않는다.

```bash
pnpm validate-defs sample-script-commands
pnpm mod:package sample-script-commands test-results/sample-script-commands.tar.gz
```


## 단계2 장소 사건 워커의 첫 연결 · v0.226

[선택 예제](../mods/sample-script-worker/README.md)는 기존 지상 순찰·수색 Def의 `worker`를 `modId:Name`으로 지정한다. 이 첫 구현에서 다른 사건 ID나 다른 워커 종류를 지정하면 로드 시 거절한다. `scripts.stage:2`와 실제 등록한 이름·메서드가 필요하다. 선언만으로 실행을 허용하지 않고 실제 격리 실행기의 등록 결과를 호스트가 다시 검증한다.

```json
{"id":"my-worker","name":"나의 장소 워커","version":"1.0.0","dependencies":["core"],"scripts":{"stage":2,"entry":"scripts/main.js"}}
```

```js
export default defineMod({workers:{
  CampPatrol:{
    kind:'PlaceEventWorker',
    canFire(ctx,event) { return event.members >= 2 },
    execute(ctx,event) {
      ctx.modState.departures = (ctx.modState.departures ?? 0) + 1
      return [ctx.cmd.log('info','기존 순찰대의 출발을 기록했다.')]
    }
  }
}})
```

```json
[{"op":"add","target":"Event.ReaverPatrol","path":"/worker","value":"my-worker:CampPatrol"}]
```

출발지 야영지·살아 있는 실제 공급원 인원·가능한 경로를 먼저 확인한다. 조건이 모자라면 VM을 호출하거나 사람을 만들지 않는다. `canFire`는 정수 가산치가 아닌 boolean을 반환한다. 실제 허용/거절 시도는 자신의 JSON데이터·하위 난수만 저장하고, 읽기 전용 미리보기는 저장하지 않는다. 허용 후에도 기존 사건 확률·실제 편성·예산·경로 규칙을 사용한다.

`execute`는 원래 인원에게 실제 경로를 배정하고 사건 이력을 기록한 뒤 호출하며, 위의 검증된 명령 목록만 반환한다. 실패하면 그 호출의 추가 명령/상태/난수를 반영하지 않고 해당 메서드를 중단한다. 이미 출발한 원래 인원을 되돌리거나 새 인원으로 대체하지 않는다. 이후 기존 `onEventFired`가 호출된다. 두 메서드는 각각 새 VM이므로 객체의 `this`나 전역 변수 대신 `ctx.modState`로 지속 상태를 관리한다.

뷰에는 플레이어와 실제 사건 당사자만 ID순으로 제공한다. 고정16MiB/256KiB스택/인터럽트 예산·64KiB 데이터·32명령·상처 연쇄 상한은 동일하다. 각인163에 원래 소스/자기 상태/하위 난수/중단한 메서드를 보존한다.162각인에 과거 워커 호출을 만들지 않는다. 단계1 소스 해시는 유지하고 단계2는 `qjs32-api2-`로 식별한다.

```bash
pnpm validate-defs sample-script-worker
pnpm mod:package sample-script-worker test-results/sample-script-worker.tar.gz
```

동결 지역의 새 사건 종류·일반 지상/던전 생성 단계·다른 아이템 생애 주기·훅API버전 범위 협상은 남은 확장 범위이다. 현재 실제 연결은 아래 절을 참고한다.


## 단계2 AI 목표 점수 · v0.227

기존 CreatureDef의 `considerationWorker`를 `modId:Name`으로 지정한다. 실제 선택한 단계2 모듈에 `AIConsiderationWorker`와 `score`가 등록되어야 한다. [실제 선택 예제](../mods/sample-script-ai/README.md)는 기존 약탈자에만 참조를 패치한다.

```js
export default defineMod({workers:{
  GuardPriority:{
    kind:'AIConsiderationWorker',
    score(ctx,event) {
      return event.options.map(o => ({targetId:o.targetId,bonus:0}))
    }
  }
}})
```

```json
[{"op":"add","target":"Creature.Reaver","path":"/considerationWorker","value":"my-ai:GuardPriority"}]
```

코어가 실제 깨어 있는 현재 NPC와 보이는 살아 있는 적만 제한한다. 아군/항복/숨은 사람/배우 사본은 후보가 아니다. 가까운32개 이하를 선택해 ID순으로 `event.options`에 `{targetId,distance,hp}`를 전달하고, 동결된 당사자 뷰에도 같은 실제 인원만 넣는다. `score`는 한 판단당 한 번 호출하며 각 후보의 정수 보정 목록만 반환한다. 기본 점수는 거리당−10, 보정은±30이다. 비어 있는 목록/생략한 후보는0점이다. 실제 후보 밖 ID·중복 ID·소수/비정상 값·명령은 전체를 거절한다.

유효한 실제 호출만 자기 JSON데이터와 `mod.<id>.worker.<Name>.score` 난수를 저장한다. 미리보기는 전체 상태를 바꾸지 않는다. 실패하면 자기 데이터/난수를 적용하지 않고 점수 메서드만 중단하며 기본 목표 선택으로 진행한다. 기본 게임에는 추가 상태/난수가 없다. 다른 생존·도주·경비 귀환·실제 공격 가능 조건은 그대로 적용한다. 기계형 AI도 기존 경보/전원/정비 조건을 먼저 통과해야 이 점수를 사용한다.

각인164는 실제 자기 상태·하위 난수·중단한 메서드를 보존한다.163각인에 과거 판단을 소급하지 않는다.

```bash
pnpm validate-defs sample-script-ai
pnpm mod:package sample-script-ai test-results/sample-script-ai.tar.gz
```


## 단계2 아이템의 실제 소비 · v0.228

기존 ItemDef의 `compWorker`를 `modId:Name`으로 지정한다. 실제 선택한 단계2 모듈에 `ItemCompWorker.onConsume`가 등록되어야 한다. [선택 예제](../mods/sample-script-item/README.md)는 기존 육포에만 참조를 패치한다. 이 첫 연결은 실제 섭취·사용 경로이며 장비/제작/의료 재료 등의 다른 생애 주기 콜백은 후속 범위이다.

```js
export default defineMod({workers:{
  FoodNotebook:{
    kind:'ItemCompWorker',
    onConsume(ctx,event) {
      ctx.modState.count=(ctx.modState.count??0)+1
      return [ctx.cmd.log('info','실제 음식 소비를 기록했다.')]
    }
  }
}})
```

```json
[{"op":"add","target":"Item.Jerky","path":"/compWorker","value":"my-food:FoodNotebook"}]
```

기존 음식·음료·약·기름·알약 사용이 성공하고 원래 물품의 실제 수량/회분/물량이 줄었을 때만 호출한다. 실패·빈 물병·얼어 있는 물병·없는 물품·배우 사본에는 실제 세계 콜백을 호출하지 않는다. 밀봉 음식을 따기 시작하는 것은 소비가 아니다. 개봉 뒤 실제 먹는 결과 Def에도 compWorker를 지정해야 그 소비를 기록한다.

이벤트는 `uid`(원래 쌓음/용기의 출처 UID), `item`(사용 전 Def), `providerId`/`actorId`(원래 제공자), `ownerId`(실제 소비자), `countConsumed`/`usesConsumed`/`mlConsumed`를 제공한다. 서로 먹이는 경우 제공자와 소비자는 별개 실제 객체이다. 사용량이 생략된 구형 음식도 원래 Def의 실제 회분 수를 사용한다. 쌓음 분할과 마지막 회분의 같은 빈 용기 변환/UID 처리는 기존 코어가 소유한다.

콜백은 기존 검증된 명령만 반환한다. 자기 JSON데이터/난수/명령은 목록 전체가 유효한 경우에만 반영한다. 실패하면 해당 메서드만 중단하고 이미 완료한 실제 소비를 되돌리지 않는다. 각인165는 자기 데이터/하위 난수/중단 상태와 원래 물품·빈 용기를 보존한다.164각인에 과거 소비를 소급하지 않는다.

```bash
pnpm validate-defs sample-script-item
pnpm mod:package sample-script-item test-results/sample-script-item.tar.gz
```

## 단계2 최초 지역 지도 생성 · v0.229

기존 RegionLayoutDef의 `genWorker`를 `modId:Name`으로 지정하고 `MapGenStepWorker.execute(ctx,event)`를 등록한다. [선택 예제](../mods/sample-script-mapgen/README.md)는 기존 검은 숲 정비구에만 참조를 패치한다. `event.layoutId/regionId/map`에서 원래 후보를 읽는다. `map.palette`의 인덱스를 `terrainRows[y]`의 두 자리36진법에서 복원하고 `roofRows[y][x]`를 읽는다. `protectedCells`는 y*w+x이다.

반환 목록의 각 행은 `{type:'setTerrain',x,y,terrain:'Terrain.Mud',roof:false}` 형식이며 roof는 생략할 수 있다. 최대256개, 지형과 정확한 키/좌표를 검사한다. 원래 주민·시작·출입구·문·부두·실물을 보호하고 수로/새 출입설비/원래 보호 좌표의 연결 차단은 거절한다. 자기 데이터와 지역별 모드 난수는 검증한 실제 생성에서만 반영한다. 도착 미리보기는 전체 상태를 바꾸지 않으며 이미 방문한 지역은 재생성하지 않는다. 일반 지상·던전의 개별 생성 단계는 아직 이 참조를 사용하지 않는다. [검사와 제한](script-mapgen-implementation.md).

## 훅 API와 아이템/지상·던전 워커 · v0.230

v0.230의 훅 API는 `1.1.0`이다. `scripts: {stage:2,entry:'scripts/main.js',api:'^1.1.0'}`처럼 요구 범위를 선언한다. 정확한 세 자리 버전, `^`, `~`, `>=1.0.0 <2.0.0` 같은 비교식, `*`, `||`를 지원하며 축약/와일드카드 부분 버전은 거절한다. 기존 API 생략 선언은 유지한다. 실행 중 `ctx.apiVersion`은 읽기 전용이다. API 요구 범위도 명시한 모드의 소스 해시에 포함된다.

ItemCompWorker는 `onConsume/onEquip/onUnequip/onCrafted/onRepair` 중 필요한 메서드만 등록한다. [착탈·제작 예제](../mods/sample-script-item-life/README.md)는 onConsume 없이 동작한다. 실제 완료만 원래 UID·슬롯 또는 제작법/생산 수량/개선 전후 내구를 전달한다. 부분 착용/실패에는 완료 효과가 없고 콜백 실패가 원래 물리 결과를 되돌리지 않는다.

WorldGenDef의 `mapWorkers: {surface:'modId:Name',dungeon:'modId:Name'}`은 기존 최초 지상과 던전 각 층에 같은 MapGenStepWorker를 연결한다. [지상·던전 예제](../mods/sample-script-map-stages/README.md). 원래 생성 후보의 최종 검증 단계이며 방문한 지도에는 소급하지 않는다. [세부 검사와 제한](script-lifecycles-implementation.md).

## 원래 공급원에서 출발하는 새 사건 · v0.231

v0.231의 훅 API는 `1.2.0`이다. [새 장소 사건 예제](../mods/sample-script-place-kind/README.md)는 `scripts.api: '^1.2.0'`과 새 PlaceEventDef/PlaceEventWorker를 사용한다. camp origin의 waypoint는 현재 지도의 실제 웨이포인트와 같은 ID의 유한 PopSource를 가리키고, 현재 지도/faction/명시된 members/폐쇄 여부를 검사한다. 귀환 경로는 @home으로 끝나야 한다. 새 생물을 생성하지 않고 원래 구성원만 실제 경로로 출발시킨다.

onDayStart 등에서 `ctx.view.queueableEvents.includes(eventId)`를 확인하고 실제 플레이어 좌표로 queueEvent를 반환한다. 이 목록은 현재 지도에서 예약 가능한 ID를 최대32개 제공하며 조회는 전체 상태를 바꾸지 않는다. 실제 출발 가능 여부는 시점이 되면 다시 검사한다. `ctx.view.regionId`도 현재 지역만 제공한다. 출발 뒤 execute의 추가 명령은 기존 원자적 검사에 따른다. 실제 개별 귀환 기록이 모두 종결 조건을 만족하면 onEventResolved의 반환 인원 수를 전달한다. 자동 가중 사건 선택/다른 출발지/동결 지역 사건은 별도 확장이다. [검사와 제한](script-place-kinds-implementation.md).

## 실제 의료 적용과 제작 재료 소비 · v0.232

현재 훅 API는 `1.4.0`이다. [선택 예제](../mods/sample-script-item-use/README.md)는 onApplied/onMaterialConsumed만 등록하고 기존 붕대/천에 참조를 패치한다.

onApplied는 공통 치료의 실제 차감 후 actorId/providerId(제공자), ownerId(실제 환자), uid/item(원래 물품), countConsumed/usesConsumed, effect·woundId/part와 partial을 전달한다. 차감 없는 시작/중단에는 호출하지 않는다. 부분 부목이 실제 재료를 쓴 경우 partial:true이다. onMaterialConsumed는 실제 작업 전체를 끝낸 뒤 원래 countConsumed/gramsConsumed/mlConsumed·material(있을 때)·recipe/reason·stage를 전달한다. 남은 조각의 동일 UID/완성품 병합과 관계없이 원래 차감량을 사용한다. 수동 가공 준비는 preparation, 완성은 completion이다. 실패한 콜백은 이미 완료한 물리 결과를 되돌리지 않는다. [검사와 현재 연결 범위](script-item-use-implementation.md).

## 의수족의 실제 완료 메서드 (API1.4.0)

ItemCompWorker에 onProstheticInstalled/onProstheticRemoved/onProstheticServiced/onProstheticCharged/onProstheticBroken을 선택 등록한다. 원래 물품 UID/실제 부위·시각·작업과 분리 bag/ground가 전달된다. 원래 설치·정비·분리·파손이 끝난 후만 실행하며 실패한 콜백이 물리 결과를 되돌리지 않는다. 정비 재료의 기존 onMaterialConsumed는 원래 가죽끈·전원셀의 실제 차감 UID를 사용한다. [선택 예제](../mods/sample-script-prosthetic/README.md) · [규칙·검사](script-prosthetic-implementation.md).

## 읽기 전용 Def 조회

타이틀에서 모드를 고른 뒤 ‘모드 제작 · Def 조회’를 열면 해당 구성의 ID/이름·종류·추상 정의를 검색할 수 있다. 플레이 중에는 F3 설정에서 실제 로드 구성을 조회한다. 상속 부모/자식·적용값/원시값·코어 대비 차이·역참조와 원본 파일/JSON 배열 항목·성공 패치 이력을 표시한다. 스크립트는 실행하지 않으며 게임 상태를 바꾸지 않는다. 필드별 출처 추적/resolve CLI와는 구분한다. [정확한 범위](definition-inspector-implementation.md).

## 최종 필드별 출처

`pnpm defs resolve Terrain.KtFloor`는 실제 해석값과 상속된 필드의 원본 정의·파일·배열 항목을 출력한다. `pnpm --silent defs resolve Item.PegLeg sample-script-prosthetic --json`은 선택한 실제 패치와 필드 출처를 JSON으로 출력한다. 조회 창의 ‘필드별 출처’에서도 동일하게 확인한다. 최종 경로와 원본 sourcePath를 구분하며 배열 이동 후에도 원래 요소의 출처를 보존한다. 원본 항목은 줄 번호가 아니다. [범위·검증](definition-provenance-implementation.md).

## 패치 미리보기와 검증 JSON

`pnpm --silent defs validate sample.grim sample-script-prosthetic --json`은 실제 로더/선택 스크립트 등록 검사와 패치별 적용·건너뜀·실패, 원본 항목·이유·실제 원시값 차이·참고 경고를 출력한다. 오류는 종료1이다. Def 조회의 ‘패치 적용 미리보기’에서도 같은 데이터 결과를 모드·대상·경로·상태로 검색한다. 화면은 스크립트를 실행하지 않는다. [정확한 경고 범위와 제한](definition-audit-implementation.md).

## JSON 원문 오류

콘텐츠 파일은 브라우저·Node에서 같은 원문 검사기를 사용한다. 중복 키·BOM·문법 오류는 파일/줄/열로 표시하며 해당 파일의 앞부분도 부분 적용하지 않는다. 꺼진 모드 오류는 켰을 때 보고한다. Def 조회의 ‘JSON 원문 문법 검사’에서는 적용 없이 붙여 넣은 원문을 검사할 수 있다. 스키마/참조 검사는 validate 결과와 별개다. [범위](content-json-implementation.md).

## 원본과 완성값 스키마 검사

원본은 id/defType 외 필드가 빠져 있어도 실제 후속 패치/상속으로 채울 수 있다. 잘못된 원본 타입은 오류로 남고, 상속·패치가 끝난 값은 필수 필드·중첩/배열 타입을 만족해야 한다. 실제 로더/validate CLI는 둘을 구분해 보고한다. JSON 검사에서도 문법·원본 부분·완성값을 선택할 수 있으며 게임에는 적용하지 않는다. [지원 키워드와 검증 범위](definition-schema-implementation.md).

## 콘텐츠 로드 해시와 불변 정의

타이틀의 선택 구성/Def 조회/resolve·validate JSON에 SHA-256 loadHash가 표시된다. 같은 버전·시드·입력·구성을 식별하며 꺼진 모드는 제외한다. 최종 Def는 직접 수정할 수 없으므로 실제 변경은 패치와 새 로드를 사용한다. 조회 목록의 정렬/삭제는 DB에 영향을 주지 않는다. 저장에 과거 해시를 소급하지 않는다. [현재 연결 범위](load-hash-implementation.md).

## 각인의 구성 기록

178부터 실제 새 게임의 loadHash를 저장한다. 현재 내용과 다르면 자동 진입을 중단하고 원래 각인을 보존하므로 원래 구성을 복원해야 한다. 구형 각인의 기록 없음은 과거 구성으로 추정하지 않는다. 설정에서 기록/현재 해시를 확인한다. 명시적인 다른 구성 검토/계속 흐름과 제거 복구는 아직 별도 후속이다. [현재 범위](content-header-implementation.md).

## 다른 내용으로 이어가기

179부터 실제 정의 ID/종류 목록을 기록한다. 내용이 달라도 모든 이전 ID/종류가 남아 있으면 타이틀의 검토에서 명시적으로 이어갈 수 있다. 승인하면 실제 변경 이력/연대기와 업적 기록 비활성 상태를 저장한다. 검토 뒤 각인/콘텐츠가 바뀌면 다시 확인한다. 삭제된 정의 또는 원래 목록이 없는 변경 각인은 현재 계속할 수 없으며 복원이 필요하다. [정확한 범위](content-review-implementation.md).

## 웹에서 모드 가져오기

타이틀의 ‘모드 가져오기’에서 ZIP/tar.gz 배포 파일 또는 manifest.json을 포함한 모드 폴더를 선택한다. 파일/의존 모드·스크립트 검사와 내용 해시를 확인하고 ‘이 모드 설치’를 누르면 현재 브라우저에 보관된다. 아래 모드 체크박스에서 사용할 모드를 선택한다. 기존 각인은 ‘각인 모드 구성 검토’를 거친다. 설치는 자동 적용하지 않는다.

8MiB/512파일의 현재 콘텐츠 배포 정책을 사용한다. 다른 탭에서 설치/제거했다면 ‘설치 목록 다시 읽기’ 후 다시 검토한다. ‘설치 파일 제거’는 가져온 복사본을 지우며 기본 제공 모드는 원래 내용으로 돌아간다. 브라우저 사이트 데이터를 지우면 설치한 파일도 지워지므로 원본 배포 파일을 보관한다. [형식/검사 범위](mod-import-implementation.md).

## 같은 세계의 생성 선택 공유

타이틀 ‘시드 공유’에서 현재 생성 선택의 공유 문자열을 만들고 복사한다. 상대방은 붙여 넣은 뒤 ‘공유 구성 검토’에서 실제 모드 버전/내용/순서가 같은지 확인하고 ‘생성 선택에 적용’을 누른다. 그 뒤 새 떠돌이를 시작한다. 모드가 없거나 내용이 다르면 원래 배포 파일을 설치해야 한다. 해당 시드의 정보 전용 은퇴 인물 초기 이름/이야기도 포함될 수 있다. 현재 플레이 진행은 공유 문자열에 들어가지 않는다. [형식/검사 범위](seed-share-implementation.md).

## ZIP 배포 만들기

`pnpm defs pack <modId> [출력.zip] --json`은 필수 모드와 실제 JSON/스크립트를 검사한 뒤 대상 모드만 ZIP으로 만든다. `pnpm mod:package <modId> 출력.zip`도 사용할 수 있다. 기본 tar.gz 출력은 그대로다. ZIP을 받은 사용자는 게임 타이틀의 ‘모드 가져오기’에 파일을 선택해 검토/설치할 수 있다. 기존 파일은 덮어쓰지 않으므로 새 출력 경로를 사용한다. [검사와 형식](mod-package-zip-implementation.md).

## 실제 시드와 모드로 헤드리스 실행

`pnpm sim:run run --seed 검사시드 --mods sample-patrol-contract --days 3 --bots 3 --json --out test-results/my-run.json`은 실제 선택 모드로 세 봇을 실행하고 해시/사인/사건/오류 보고서를 만든다. 한 봇은 입력한 시드를 그대로 쓰며 여러 봇은 `검사시드:0`부터 쓴다. `--dungeon`은 기존 던전만, 기본값은 월드다. 기존 보고서는 덮지 않는다. [옵션/검증 범위](sim-run-implementation.md).

## 주민이 개인 곡물로 조리하도록 설정

`ResidentProvision.Hearth.cooking`은 주민의 기존 기본 그릇 조리법을 선택한다. 현재는 `Recipe.Oatmeal`처럼 `boiledMeal.unheated`가 있는 기본 조리법을 지원한다. 역할·준비 문턱·남길 물·생활비·한 물품의 구매 상한과 재시도 간격을 함께 지정한다.

```json
{"op":"replace","target":"ResidentProvision.Hearth","path":"/cooking","value":{"recipes":["Recipe.Oatmeal"],"roles":["civilian","guard"],"homeRadius":3,"prepareBelowKcal":500,"reserveWaterMl":300,"reserveMoney":5,"maxUnitPrice":25,"retryTurns":1200}}
```

주민은 가진 곡물만 쓰고 부족한 그릇/키트/장작을 상점 곁에서 실제 돈·재고·배낭 공간으로 확인한다. 상점 목표 재고는 새 세계의 유한 초기 물품이며 옛 각인에 물품이나 돈을 채우지 않는다. 자기 모닥불 설치·점화와 실제 가열·회수·섭취는 기존 행동을 쓴다. 규칙을 끄려면 선택적 `cooking`을 제거한다. 이미 올린 음식과 물품을 소급 삭제하지 않는다.

`WorldSimulation.Hearth.nutritionKcalPerFoodUnit`은 실제 주민 식사 한 회분을 요약 Food 소비와 연결한다(기본2500kcal=1Food). 탄 음식은 실제 줄어든 열량만 기록하고 개인 일일 소비 한도를 넘기지 않는다. 이 필드를 없애면 기존 물품별 `items` 환산을 쓴다. 재사용 그릇 음식을 요약 `items`의 Food 재고로 등록하면 요약 소비가 용기까지 소모할 수 있으므로 실제 섭취 연결에는 이 열량 환산을 쓴다. 다른 사람의 현재 조리 진행/연료·원격 재고는 공개 UI에 추가하지 않는다. [구현 및 검증 범위](resident-cooking-implementation.md).
