# 웹 플레이 미리보기

**2026-10-23 (한국 시간) 현재:** 공개 [v0.307 게임](https://roastfried-rf.github.io/ashveil/)을 플레이할 수 있다. main `a2c6856`의 build·deploy 성공과 새 고사목 원화·탐구 저장/복원·시야/배율·캐릭터/소지품/신체를 확인했다. 아래 실패 기록은 당시 관측 이력이다.

최신 검증 완료 버전은 [README](../README.md)와 [진행 기록](progress.md)에 표시한다. 검증된 큰 기능 묶음마다 원격 main에 push하며, 작업 중인 코드를 검증 완료 버전으로 표시하지 않는다. 아래는 실제 배포 시도와 제한의 날짜별 기록이다.

GitHub Pages용 [자동 빌드·배포 설정](../.github/workflows/pages.yml)을 준비했다. Node.js24·pnpm9.15.9로 잠금 파일 설치 후 타입 검사와 Vite 빌드를 수행하고, dist만 Pages 아티팩트에 올린다. main의 앱 변경과 수동 실행으로 갱신한다. 저장소 공개 설정은 변경하지 않는다.

실제 [GitHub Actions 실행](https://github.com/RoastFried-RF/ashveil/actions/runs/39480877885)은 설치·타입 검사·Vite 빌드·Pages 아티팩트 생성을 통과했다. 공개 단계는 `Get Pages site failed / Not Found`로 실패했다.

초기 배포 시 클라우드에 제공된 GitHub 인증으로 Pages API를 호출하면 `Resource not accessible by integration`(HTTP403)이 반환된다. 임시 Cloudflare 주소 생성도 환경의 네트워크 정책에서 HTTP403으로 차단되었다. 따라서 그 시점에는 외부 플레이 URL을 확인하지 못했다.

저장소 관리자가 [Settings → Pages](https://github.com/RoastFried-RF/ashveil/settings/pages)에서 Source를 **GitHub Actions**로 지정하면, [Playable preview 워크플로](https://github.com/RoastFried-RF/ashveil/actions/workflows/pages.yml)를 실행해 배포할 수 있다. 비공개 저장소의 Pages 지원 여부는 계정 요금제에도 따른다. 설정을 마친 뒤 성공한 deploy 작업의 환경 URL이 실제 플레이 주소다. 배포 성공 전에는 예상 URL을 동작하는 사이트로 안내하지 않는다.

로컬 확인은 `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm preview --host 127.0.0.1` 순서다. 브라우저의 각인·모드·설정은 접속 주소별로 저장되므로 다른 도메인으로 옮길 때는 게임의 내보내기 기능으로 원본을 보관한다.

사용자의 직접 활성화 요청 후 실제 Pages 생성 POST도 실행했으나 같은403이었다. 이어 사용자 기기 인증을 완료한 계정으로 다시 실행해도403이며, Actions secret 설정을 위한 키 조회도 권한 거절된다. 인증 승인 자체는 확인했지만 이 클라우드 연동이 Pages 관리 권한을 제공하지 않아 직접 활성화할 수 없다. 동작하지 않는 주소나 완료되지 않은 배포를 공개 완료로 표시하지 않는다.

2026-10-20 v0.282 중간 push 후 Pages 조회를 다시 확인했으나 현재 GitHub 연동은 여전히 HTTP403 `Resource not accessible by integration`을 반환했다. 사이트 생성/배포 성공이나 공개 주소를 주장하지 않는다. 검증 브랜치와 저장소의 실제 화면 자료는 push했으며 구현/검증은 계속 진행한다.

2026-10-20 main282 c79b2ed의 [Actions39510964400](https://github.com/RoastFried-RF/ashveil/actions/runs/39510964400)은 build 작업을 시작하지 못했다. 실제 check annotation은 최근 계정 결제 실패 또는 사용 한도 증가 필요를 원인으로 명시했다. deploy는 skipped이고 이번 원격 빌드/아티팩트/웹배포 성공은 주장하지 않는다. 로컬282 빌드/실제 화면·전체/월드 검증은 통과했다. 비용·한도 설정은 변경하지 않았다.

2026-10-21 v0.290 c50f34f의 [Actions39532217366](https://github.com/RoastFried-RF/ashveil/actions/runs/39532217366)도 build 시작 전에 계정 결제 실패/사용 한도 오류로 차단됐다(check119000526801). deploy는 skipped이며 원격290 아티팩트/사이트 성공을 주장하지 않는다. 로컬 전체5,907개·월드30판과 실제18장으로 검증한 ZIP은 `artifacts/ashveil-v0.290-web.zip`에 있다. 비용·한도·저장소 공개 설정은 변경하지 않았다.


v0.292(main da7007e) 자동배포 확인: https://github.com/RoastFried-RF/ashveil/actions/runs/39536728279 에서 build/check119014964439가 실행단계0개로 실패했고 deploy는 skipped다. 실제 annotation은 “The job was not started because recent account payments have failed or your spending limit needs to be increased.”다. 로컬 빌드/5,936개/13장/2전체복원 통과와 원격배포는 구분한다. Ubuntu26전환 notice는 별도 안내이며 결제실패 원인을 대체하지 않는다. 자금·사용한도·공개범위를 바꾸지 않았다.

## v0.295 최신 배포 확인 · 2026-10-21

main 5ddcedcaac83bfc685d7420a75d470d88cacb187의 [Actions39543439010](https://github.com/RoastFried-RF/ashveil/actions/runs/39543439010)에서 build119036172690은 실행단계0개로 실패하고 deploy119036188165는건너뛰었다. 실제 annotation은 “The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the Billing & plans section in your settings”다. Ubuntu26이전공지와별도문제다. 공개사이트주소는확인하지못했다. 로컬검증빌드 v0.295 ZIP16,565,897bytes/SHA256 c7635c270a2d61ed4203c738ea4f77c15751eb14c039f5c4d3ad6d4e3e1d959e의898dist파일은동결빌드와모두동일하다. 계정결제·지출한도변경은수행하지않았다.

임시 정적 미리보기도 검증완료295/dist만4318에서시도했으나 localhost.run의SSH접속이Connection refused로끝나 공개주소를받지못했다. 시스템SSH의로컬기계용include소유자오류와별도로,해당로컬경로전용설정이원격호스트와무관함을읽고빈SSH클라이언트설정/개인키·비밀번호인증없이시도한실제연결결과다. 사용한자체4318서버는종료했고 기존5173/다른서버는건드리지않았다. 새공개URL을확인했다고주장하지않는다.

## v0.296 게시 확인

main d31186a1a9c70bf329ad49b116aa9a80b36100d6을push한뒤Actions [39547880473](https://github.com/RoastFried-RF/ashveil/actions/runs/39547880473)을조회했다. build119050073099는0단계실행/실패, deploy119050087500는0단계/건너뜀이며검사주석은계정결제실패또는사용량한도였다. Ubuntu26이행notice는별도이며배포실패원인으로해석하지않는다. 공개URL검증은없고검증된v0.296 ZIP은907dist파일과정확히일치한다.

## v0.297 게시 확인 · 2026-10-21

main4c0749d8c1e5c96239bd211604ed9e6c04c0656a의 [Actions39551024374](https://github.com/RoastFried-RF/ashveil/actions/runs/39551024374)을실제조회했다. build119060006522는실행0단계/실패, deploy119060024524는실행0단계/건너뜀이었다. 실제검사주석은계정결제실패또는지출한도증가필요를명시했다. Ubuntu26이행notice와구분하며이번원격빌드·아티팩트·공개URL성공을주장하지않는다. 로컬검증v0.297 ZIP은919dist파일과전바이트일치하며16,592,433bytes/SHA256 f6b6a184c76ff4414e3422e07bc62eb60daa047c25902a262a532cef810bddcf다. 결제·한도·공개범위는변경하지않았다.

## v0.298–299 통합 로컬 빌드

전체6073개·실제31PNG/203복원11·월드30판을 통과한299의 로컬ZIP은 `artifacts/ashveil-v0.299-web.zip`이다. 16622863bytes, SHA256 `eabad082fc03cae871ac78d8f9e8565ae14994a09a9b2b0bb65c23fe4a38a13a`. 압축안943dist파일은 검증한불변299빌드와모두동일하다. 이는공개사이트URL이나원격배포성공을뜻하지않는다. 마지막확인된원격실패원인은위297기록의계정결제/한도이며인증/결제/지출한도변경은수행하지않았다.

## v0.299 실제 원격 확인 (다음 큰 게시에 포함할 기록)

main5b47f73200be6adc4cbd146f7372a382b0bfbd3e의 [Actions39561309446](https://github.com/RoastFried-RF/ashveil/actions/runs/39561309446)은build119092981460이실행단계0개로실패하고deploy119093002379는건너뛰었다. 실제annotation은최근계정결제실패또는지출한도증가필요를원인으로명시한다. Ubuntu26이전notice와별도문제이며공개플레이URL은없다. 로컬299검증/ZIP과원격배포를구분하고, 인증/결제/한도/저장소공개설정은바꾸지않았다. 사용자큰묶음요청에따라이원격확인문서만을위한추가작은push는하지않는다.

## v0.300 원격 확인 · 다음 큰 묶음에 포함

main733419c37c6242f581a5c042ff87d570ecb551fb의 [Actions39566538764](https://github.com/RoastFried-RF/ashveil/actions/runs/39566538764)은build119110060909가실행0단계로실패하고deploy119110083681은건너뛰었다. 실제annotation은최근계정결제실패또는지출한도증가필요를명시한다. 검증된로컬300ZIP은991dist파일과모두같고16,680,075bytes/SHA256 f2f6b6e0a127be5d4d053313928c1b94a4c64a5436dfa31dedd88ca94d7ad944다. 공개사이트성공은확인하지못했다. 결제/한도/인증설정은변경하지않았고,사용자요청에따라이확인기록만별도push하지않는다.

## v0.301 원격 확인 · 다음 큰 게시에 포함

main `3f2622418b606bcb33a1adc76956c60b114360af`을 push한 뒤 [Actions39640078522](https://github.com/RoastFried-RF/ashveil/actions/runs/39640078522)를 실제 확인했다. build119360976933은 실행 단계0개로 실패했고 deploy119361012688은 건너뛰었다. 실제 주석은 최근 계정 결제 실패 또는 지출 한도 증가 필요를 명시한다. Ubuntu26 이전 공지와 별개다. 공개 플레이 URL은 확인하지 못했다.

검증된 v0.301 ZIP은 빌드991파일과 전부 같으며 16691338bytes, SHA256 `a963e72e8e90f96e401bdc5f6135ef68b19568aff605d764415579f69d74c91e`다. 결제·한도·인증 설정은 변경하지 않았다. 사용자 요청에 따라 이 원격 확인 기록만을 위한 작은 추가 push는 하지 않는다.

## v0.302 원격 확인 · 다음 큰 게시에 포함

main `c6718dd56c9fb8fcf139f9f4a441570b06e9f7ac`의 [Actions39729441951](https://github.com/RoastFried-RF/ashveil/actions/runs/39729441951)은 build119660865857이 실행0단계로 실패했고 deploy119660881212는 건너뛰었다. 실제 주석은 최근 계정 결제 실패 또는 지출 한도 증가 필요를 명시한다. Ubuntu26 이전 공지와 별개이며 공개 플레이 URL은 확인하지 못했다. 결제·한도·인증 설정은 바꾸지 않았다.

검증된 웹 ZIP은1477dist파일과 모두 같고18,300,223bytes/SHA256 `e07fb10432c21a71c61f1878981d0ffc9e405625c3dc1d5d6faa215b59bc93db`다. 원본 도감은511,252bytes/SHA256 `664886e418262a97c26597f5e777bee16b36f8b76556ebd1b8572299a2a99535`, 이미지166개/378항목을 포함한다. 사용자 요청에 따라 이 배포 실패 기록만을 위한 작은 추가 push는 하지 않는다.

## v0.303 공개 배포 성공 · 다음 큰 게시에 포함

main `bc30246fc887d44d6b3e88370dd102b16be41ab9`의 [Actions39742082221](https://github.com/RoastFried-RF/ashveil/actions/runs/39742082221)은 build119701506542·deploy119701941030 모두 성공했다. 새 미술 원본을 적용한 타이틀(v0.303), 실제 새 게임, 소지품과 신체 창을 두 해상도에서 열고 실제 PNG4장을 직접 확인했다. 브라우저 오류는0개다. 최초 원화 응답91회는 모두HTTP200이며, 고유URL89개의 공개 응답을 같은 출처 브라우저 fetch로 읽어 SHA256이 최종 검증본과 같음을 확인했다. 이4장은 로컬 게임36+도감12장 집계와 별도다.

최초 DevTools 응답 본문 읽기와 이후 Node 직접 fetch는 환경의 전송 방식 때문에 실패했다. 해당 진단 시도의 PNG는 최종 성공 수에 포함하지 않으며, 같은 출처 브라우저에서 읽고 해시한 세 번째 실행을 최종 근거로 보존한다. 게임 소스·원화는 수정하지 않았다. `test-results/publication-v303-complete.json` 및 `test-results/pages-v303-live-v3/audit.json`에 실제 원격/화면/바이트 근거를 남겼다. 이 사후 기록만을 위한 작은 추가 push는 하지 않는다.

## v0.304 공개 배포 성공 · 다음 큰 게시에 포함

main `6f0674fef4ec8bb7d9ef3e8325dc301186e1c0b1`의 [Actions39837285836](https://github.com/RoastFried-RF/ashveil/actions/runs/39837285836)은 build120028800403·deploy120029224732 모두 성공했다. 정상 공개 URL에서 v0.304 표시·실제 새 게임 시작·소지품/신체 창·기본 Shift+N 주민 창을 확인했다. 두 해상도의 최종 공개 PNG4장을 모두 열어 검토했고 브라우저 오류는0개다. 최초 원화 응답91회는 모두HTTP200, 고유URL89개를 같은 출처 브라우저 fetch로 읽은 SHA256은 최종 검증본과 정확히 같다. 이4장은 로컬 조작/공통34장과 별도다.

첫 공개 실행도 기능/해시 검사는 통과했으나 소지품 첫 촬영이 닫기 아이콘 다운로드 전 프레임을 잡았다. 기존 결과를 보존하고 실제 CSS 이미지 디코딩 완료를 기다린 두 번째 실행의4장을 최종 화면 근거로 삼았다. 게임 코드/리소스는 추가 수정하지 않았다. [원격 근거](release-v304-publication.json). 사용자의 큰 묶음 게시 요청에 따라 이 사후 기록만을 위한 작은 추가 push는 하지 않는다.

## v0.305 공개 배포 성공 · 다음 큰 게시에 포함

main `5fdfa079720c7136fd2efed499a22412645b6d5c`의 [Actions39848092917](https://github.com/RoastFried-RF/ashveil/actions/runs/39848092917)은 build120066657171·deploy120067195554 모두 성공했다. 정상 공개 URL에서 v0.305·새 게임·F3 전체 시야 맞춤·캐릭터의 거리 표기·소지품/신체·Shift+N을 확인했다. 최종 공개7PNG를 모두 열었고 브라우저 오류는0개다. 최초 원화 응답94회는 모두HTTP200, 고유89파일을 같은 출처 브라우저 fetch로 읽은 SHA256은 검증본과 같다. 로컬38PNG와 별도다.

첫 촬영에서 작은 지도 영역을 캐릭터 창이 덮은 장면을 크기 전환 프레임으로 의심해400ms 안정화를 더한 두 번째 실행으로 재확인했다. 같은 창 가림이며 앱 결함이나 코드 수정은 없었다. 두 실행을 보존하고 두 번째7장을 최종 근거로 삼는다. [원격 근거](release-v305-publication.json). 이 사후 기록만 추가 push하지 않는다.

## v0.306 공개 배포 성공 · 다음 큰 게시에 포함

main `a360e83f2ab4078b1ef1c24379efe313101ccca8`의 [Actions39857118996](https://github.com/RoastFried-RF/ashveil/actions/runs/39857118996)은 build120098094116·deploy120098492959 모두 성공했다. 정상 공개 URL에서 v0.306·실제 탐구 선택/저장·복원 검토/취소/확인, F3 전체 시야 맞춤·캐릭터/소지품/신체·Shift+N을 확인했다. 공개8PNG를 모두 열었고 브라우저 오류0개다. 최초 원화 응답91회HTTP200, 고유89파일을 같은 출처 브라우저 fetch로 읽어 SHA256이 검증본과 같음을 확인했다. 로컬40PNG와 별도다. [원격 근거](release-v306-publication.json). 이 기록만을 위한 작은 추가 push는 하지 않는다.

main `a2c68568cb656c83ac087e0aa73b5bf479021f12`의 [Actions39864429905](https://github.com/RoastFried-RF/ashveil/actions/runs/39864429905)은 build120122937411·deploy120123361776 모두 성공했다. 정상 공개 URL에서 새 원화 응답93회HTTP200·고유90파일 SHA256이 검증본과 같았다. 최종 공개8PNG를 모두 열었고 브라우저 오류0개다. 복원 직후 크기 변경/첫 캐릭터 창의 지도 배경은 잠깐 비어 있어 다음 렌더링 재현 대상으로 남겼으며 뒤 소지품/신체 화면은 복원된 지도를 표시했다. [원격 근거](release-v307-publication.json). 이 사후 기록만을 위한 작은 추가 push는 하지 않는다.

추가 공개 입력 재현에서 첫 캐릭터 창의 공백은 창이 보이는 지도 영역 전체를 가린 결과임을 확인했다. 창을 실제로 오른쪽으로 옮기고 닫으면 같은 지도가 보이며 자동 저장 원문도 같다. 추가2PNG를 모두 열었다. 렌더링 장애로 단정한 최초 추정은 위 근거로 정정한다.
