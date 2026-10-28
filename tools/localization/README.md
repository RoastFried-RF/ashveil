# 현지화 원문 조사

`source-catalog.ts`는 한국어 표시 원문의 **읽기 전용 후보 목록**을 만든다. 소스를 번역·변경하지 않으며, 런타임이나 저장된 세계의 문구도 바꾸지 않는다. 새로운 패키지를 설치하지 않고 기존 TypeScript와 `vue/compiler-sfc` AST를 사용한다.

```sh
node --import tsx tools/localization/source-catalog.ts --out test-results/localization/NEW_NAME
```

출력은 현재 체크아웃의 `test-results` 아래 새 디렉터리여야 한다. 기존 디렉터리(빈 것도 포함), 출력 경로의 심볼릭 링크 이탈, 불변 체크포인트 내부 쓰기는 거부한다. `catalog.json`에는 원문 조각, SHA-256 앞20자리 기반 ID, 파일·1부터 시작하는 행/열·문맥, 각 사용처의 원래 표현식이 들어간다. `summary.json`에는 통계가 들어간다. 전체 입력 파일의 SHA-256을 남기고 수집 후 다시 읽어 바이트 변경이 없었는지 확인한다. 생성 시각은 카탈로그에 넣지 않으므로 같은 입력은 같은 결과를 만든다. 병렬 편집 중 입력이 바뀌면 새 출력으로 다시 수행한다.

조사 범위는 `src`와 `mods`의 `.ts`, `.vue`, `.json`이다. `.d.ts`, `node_modules`, `locales` 번역 카탈로그, `src/client/locale.ts` 런타임 자체는 제외한다. Vue는 SFC 스크립트, 인접한 텍스트/보간 묶음, 표시 속성(title/aria-label/placeholder/alt/label 등), 표시 표현식과 이벤트 안의 문자열을 읽는다. `<style>`과 비표시 속성·모델·반복 바인딩을 번역 대상으로 삼지 않는다. TS 템플릿과 문자열 결합은 고정 조각 `parts`와 동적 `expressions`로 분리한다. 예를 들어 `(a+b)+'턴'`의 `a+b`는 하나의 동적 인수여서 숫자 덧셈 의미를 보존한다. `${p.name}`은 원문의 표현식으로만 기록하며 개인 이름의 값을 조회하지 않는다. 이 도구는 브라우저나 World를 생성하지 않는다.

다음은 명시적으로 제외하고 사유와 위치만 기록한다.

- `NAMES`, `PERSONAL_NAMES`, `GIVEN_NAMES`, `FIRST_NAMES`, `SURNAMES`라는 정적 배열과 `name` 속성의 값. 모드 `manifest.json`의 표시 이름은 포함한다.
- import/export 경로, 타입 전용 리터럴, 객체의 속성 이름, 원시 ID·Def 참조·경로·sprite·CSS 등 알려진 기술 속성, 인덱스 조회 키와 동등 비교 키.
- Vue의 CSS·ID·URL·key·testid 등 표시 속성 목록 밖의 정적/동적 속성.

각 사용처의 `usage`는 `ui`, `log`, `content`, `candidate`다. 정적 `log()` 인수는 log, 알려진 메시지 호출은 ui, Def의 label/description/note 등과 해당 필드를 바꾸는 JSON patch value는 content다. 클라이언트의 나머지 문자열은 UI 후보이며, 문맥을 확정할 수 없는 코어 문자열은 candidate다. 표시됨을 증명하는 실행 추적이 아니다. 기술 문자열이 후보로 남거나, 동적으로 합성한 문장·허용 목록 밖의 컴포넌트 prop·JS 모드·외부 파일·`name`이라는 일반 항목명이 빠질 수 있다. 제외된 한국어 조건 키와 개인 이름은 추후 번역 정책에서 수동 검토해야 한다. 코드의 문자열 수를 영어 UI/로그/콘텐츠 완성률로 사용하지 않는다. 입력 표현식의 민감한 실제 값이나 숨겨진 세계 상태를 수집하지 않는다.

ID는 파일 위치나 변수 이름이 아닌 정확한 `parts` 배열을 기준으로 만들고 literal과 format 접두사를 구분한다. 같은 고정 조각은 사용처의 표현식이 달라도 한 항목에 모인다. 이 목록에는 번역문·번역 품질·조사 변형·문장 재배치 규칙·런타임 치환 기능이 없다. 이후 영어 작업의 검토 자료다.

입력은 유효한 UTF-8만 허용하며 SHA 재검은 실제 파일 바이트를 대상으로 한다. `src`·`mods` 루트나 하위 소스의 심볼릭 링크도 명시적 검토 없이 따라가지 않는다. 이 입력 명세는 위 조사 범위에만 해당하며 저장소 전체 추적 파일의 무결성 명세와 구분한다.
