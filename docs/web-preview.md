# 웹 플레이 미리보기

최신 검증 완료 버전은 [README](../README.md)와 [진행 기록](progress.md)에 표시한다. 검증된 구현 단위마다 원격 main에 push하며, 작업 중인 코드를 검증 완료 버전으로 표시하지 않는다. 아래는 실제 배포 시도와 제한의 날짜별 기록이다.

GitHub Pages용 [자동 빌드·배포 설정](../.github/workflows/pages.yml)을 준비했다. Node.js24·pnpm9.15.9로 잠금 파일 설치 후 타입 검사와 Vite 빌드를 수행하고, dist만 Pages 아티팩트에 올린다. main의 앱 변경과 수동 실행으로 갱신한다. 저장소 공개 설정은 변경하지 않는다.

실제 [GitHub Actions 실행](https://github.com/RoastFried-RF/ashveil/actions/runs/39480877885)은 설치·타입 검사·Vite 빌드·Pages 아티팩트 생성을 통과했다. 공개 단계는 `Get Pages site failed / Not Found`로 실패했다.

현재 클라우드에 제공된 GitHub 인증으로 Pages API를 호출하면 `Resource not accessible by integration`(HTTP403)이 반환된다. 임시 Cloudflare 주소 생성도 환경의 네트워크 정책에서 HTTP403으로 차단되었다. 따라서 지금 사용할 수 있다고 확인한 외부 플레이 URL은 없다.

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
