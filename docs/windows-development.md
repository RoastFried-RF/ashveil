# Windows 로컬 개발과 v1 작업 환경

2026-10-30 KST. 원격 기준 `7c11ce496eceffc4f6df9b02f8d5a61fbd7a4310`을 별도 작업본으로 가져왔다. 동기화된 ChatGPT 프로젝트의 `sources/`는 수정하지 않는다. 공개 기준은 v0.404-dev/저장219이며, 이 PC의 준비나 개별 검사 통과를 v1 출시 완료로 취급하지 않는다.

## 시작

설치된 Node24, npm, Python3, Git for Windows의 GNU tar, Chrome 또는 Edge를 사용한다. Node24가 PATH에 없으면 기존 Codex 번들 런타임도 확인한다. 자동 검색되지 않는 설치는 명시적으로 전달한다. Node/브라우저/압축기 다운로드, 전역 패키지 설치, 전역 PATH 변경은 없다.

```powershell
./tools/windows/ashveil.ps1 setup
# 필요할 때만 기존 설치 지정
./tools/windows/ashveil.ps1 setup -NodePath C:/tools/node24/node.exe -BrowserPath 'C:/Program Files/Google/Chrome/Application/chrome.exe'
# Git와 다른 곳의 기존 GNU tar가 필요할 때만 -GnuTarPath C:/tools/gnu/bin/tar.exe
./tools/windows/ashveil.ps1 doctor
./tools/windows/ashveil.ps1 dev
./tools/windows/ashveil.ps1 authoring
./tools/windows/ashveil.ps1 release
./tools/windows/ashveil.ps1 release --locale --item-locale
./tools/windows/ashveil.ps1 pnpm game:check --scenario smoke --check
```

`setup`은 `.local-tools/`에만 pnpm9.15.9와 Python venv/jsonschema를 설치하고, 저장소 의존성은 기존 잠금파일로 설치한다. 실제 도구 경로는 무시되는 `.local-tools/runtime.json`에 저장한다. 실행 동안만 PATH/CHROMIUM_PATH/PYTHONUTF8/ASHVEIL_PYTHON을 설정하며 종료 시 이전 값을 복구한다. 기존 Git의 GNU tar를 BSD tar보다 먼저 사용하고, 독립 ZIP 검사에는 명시적인 로컬 Python을 전달한다. `doctor`는 도구 존재와 버전 검사이며, 게임 실행 성공의 증거는 아니다. Windows 브라우저 버전은 창을 열지 않고 실행 파일 메타데이터로 읽는다.

`authoring`과 `release`는 기존 공통 `plan.py`/`run.py`를 사용한다. 실행마다 `test-results/windows/시각-무작위접미사`에 새 계획·종료 코드·로그·PNG/JSON을 기록한다. Windows release는 타입/린트, Def/스프라이트/독립 Schema, Full(작업자2), 빌드, 두 화면 크기의 실제 입력 스모크를 실행한다. `--item-details-locale`은 관련 대상 검사와 세 화면의 상세 설명/저장 복원을 추가한다. `--item-supplies-locale`은 음식/물/독서·총기 실제 입력과 지식/UID·저장 복원을 별도 heavy Native로 추가한다. 함께 지정하면 이전 상세 검사 뒤 순서대로 실행한다. World30, 원정1,000판, 나머지 Native/사람 평가는 별도 증거가 필요하다.

## 자원과 정리

`--ash-cake`는 재떡의 실제 유한 상인 재고·구매/제작/섭취·개인 근거별 상세/폐 창·저장 복원을 세 화면에서 검사한다. `--ash-cake-course`는 별도 heavy 작업으로 유한 초기 재고와 정상 돌봄/제작 행동의 실제30일 코호트를 실행한다. `--balance`는 뒤에 기본30판/최대3일, 월드30판/최대3일을 별도 heavy 작업으로 연결하고 각 판의 원래 초기/최종 세계를 보존한다. 이 옵션들은1,000판 원정이나 실제 사람 평가를 대신하지 않는다. [정확한 구현·진단 fixture 경계](ash-cake-v407.md).

Windows의 공통 잠금은 `%LOCALAPPDATA%/ASHVEIL/harness/locks`다. 다른 작업본도 같은 네임스페이스를 사용한다. OS 파일 잠금으로 light 최대2개, heavy와 다른 모든 작업의 배타 실행을 유지한다. Linux 잠금/프로세스 그룹 계약은 유지한다.

Windows 자식은 정지 상태로 만든 뒤 종료 시 전체 트리를 정리하는 Job Object에 배정하고 실행한다. 부모가 먼저 종료한 자식도 정리하며 무관한 프로세스는 건드리지 않는다. runner가 강제 종료돼도 마지막 Job 핸들이 닫히면 그 트리만 종료된다. preview는 strictPort와 자기 프로세스의 준비 출력을 확인하며 Windows 콘솔을 숨긴다. 직접 실행하는 개발 서버는 터미널에서 Ctrl+C로 종료한다.

Node 콘텐츠 로더는 네이티브 경로로 파일을 읽고 `/`로 정규화한 패키지 키로 스크립트·텍스처를 분류한다. 최초 전체 검사에서 이 분류가 `\\`를 처리하지 못해 예제 모드가 누락되는 결함을 확인했고 수정 후 관련162검사를 통과했다. `.gitattributes`는 앞으로의 체크아웃에서 텍스트를 LF로 고정하여 스크립트/저장 원문 해시가 플랫폼에 따라 변하는 것을 막는다. 게임 실행 시 임의로 원문을 정규화하거나 옛 저장의 해시를 바꾸지 않는다.

이 새 작업본에서 Git의 전역 autocrlf가 변환한 예제 모드88텍스트를 원격 HEAD의 정확한 바이트로 돌렸다. 원문과의 차이가 줄바꿈뿐인지 확인한 뒤 이 작업본에만 적용했으며 사용자 모드를 임의로 변환하는 setup 동작은 추가하지 않았다. 패키지 메타데이터/실제 ZIP·tar 경로는 `/`로 통일하고 gzip OS 헤더를 기존 Unix 값으로 고정한다. 기존 tar.gz1186바이트/SHA-256 fixture는 바꾸지 않고 Windows에서 그대로 통과했다.

POSIX 전용 링크/잘못된 파일명 fixture는 Windows에서 같은 링크 탈출을 실제 junction으로 검증하고 NTFS가 금지한 파일명은 생성 단계에서 거절되는 것을 확인한다. 링크/원문 손상·독립 Python/실제 tar·브라우저 재가져오기 검사를 생략하지 않는다.

```powershell
python tools/cloud-harness/verify-windows.py -v
python tools/cloud-harness/verify-environment.py
```

첫 검사는 실제 별도 프로세스로 두 light/한 heavy, 살아 있거나 부모가 먼저 종료한 하위 프로세스의 정리, 무관한 프로세스 보존, 인수 보존/실패 전파/덮어쓰기 거부를 확인한다. POSIX에서는 기존 `verify.py`를 사용한다. Windows 지원 추가만으로 POSIX 검사를 새로 통과했다고 기록하지 않는다.

## 현재 구현 감사와 다음 순서

후속 v407은 재떡의 실제 유한 재고·제작/섭취/노출·저장220과31.51일 통제 코호트를 연결했다. 최종13단계·Full418파일6,806검사와 Native84전체 상태 쌍/오류0을 통과했다. 대표9PNG와 고정 소스4,259파일의 SHA 일치를 확인했다. 검증 입력 교정 전의 같은 게임 규칙에서 Native219쌍·기본/월드 각30판을 완료했고, 수정본으로 원래 각인152개를 그대로 왕복했다. [v407 영수증](pc-harness-v407-proof.json). 아래 v405–406은 선행 이력이다.

v405의 최종14단계는 Full414파일6,771검사·Native87전체 상태 쌍을 통과했다. [v405 영수증](pc-harness-v405-proof.json). 후속 v406의 최종15단계는 Full415파일6,777검사, Schema178파일/오류0, 빌드/두 해상도 스모크와 네 Native의147전체 상태 쌍/브라우저 오류0을 통과했다. 최종 대표13PNG를 직접 열었으며 소스/테스트/도구4,244파일의 SHA가 동일했다. 기존 실패와 재검은 별도 보존했다. [v406 실행·소스·시각 검토 영수증](pc-harness-v406-proof.json). 이 결과는 로컬 개발 기반과 선언한 표시 범위의 수락이다.

기존 구현은 단순 초기 골격이 아니다. 순수 TS 코어와 Vue/Pixi, 전투·몸·의료·생존, 장소/월드·사회, 동료/거점, 모드/저장 호환, 선택형 영어 표시가 연결돼 있다. 현재 코드와 미완료 경계는 [v1 코드 대조 장부](goal-code-audit-v1.md), 출시 기준은 [v1 실행 기준](v1-execution.md)을 따른다.

1. 이 PC의 전체 회귀·빌드·두 해상도 실제 입력을 확인하고 결과를 보존했다.
2. v404 이후 물품 공통/장비와 음식/물/약/책/화기 상세를 ID+원문 guard, 미감정 유물/알약·물 지식 경계와 읽기 전용 상태를 지켜 검증했다. [장비](localization-v405.md) · [나머지 기본 상세](localization-v406.md).
3. 나머지 창/로그/문헌, X1–X4의 실제 결손을 별도 수락 단위로 계속 구현한다.
4. 최종 소스의 균형/원정·기기/사람 출시 게이트를 각각 증거로 닫는다. 버전 번호만 변경하지 않는다.
