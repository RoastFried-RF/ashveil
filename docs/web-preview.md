# 웹 플레이 미리보기

v0.271은 통합 검증을 마친 배포 기준이다. 원격 main에 구현 코드를 올렸으며, 이후 검증 구간도 같은 방식으로 push한다. 작업 중 코드를 마지막 검증 완료 버전으로 표기하지 않는다.

GitHub Pages용 [자동 빌드·배포 설정](../.github/workflows/pages.yml)을 준비했다. Node.js24·pnpm9.15.9로 잠금 파일 설치 후 타입 검사와 Vite 빌드를 수행하고, dist만 Pages 아티팩트에 올린다. main의 앱 변경과 수동 실행으로 갱신한다. 저장소 공개 설정은 변경하지 않는다.

현재 클라우드에 제공된 GitHub 인증으로 Pages API를 호출하면 `Resource not accessible by integration`(HTTP403)이 반환된다. 임시 Cloudflare 주소 생성도 환경의 네트워크 정책에서 HTTP403으로 차단되었다. 따라서 지금 사용할 수 있다고 확인한 외부 플레이 URL은 없다.

저장소 관리자가 [Settings → Pages](https://github.com/RoastFried-RF/ashveil/settings/pages)에서 Source를 **GitHub Actions**로 지정하면, [Playable preview 워크플로](https://github.com/RoastFried-RF/ashveil/actions/workflows/pages.yml)를 실행해 배포할 수 있다. 비공개 저장소의 Pages 지원 여부는 계정 요금제에도 따른다. 설정을 마친 뒤 성공한 deploy 작업의 환경 URL이 실제 플레이 주소다. 배포 성공 전에는 예상 URL을 동작하는 사이트로 안내하지 않는다.

로컬 확인은 `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm preview --host 127.0.0.1` 순서다. 브라우저의 각인·모드·설정은 접속 주소별로 저장되므로 다른 도메인으로 옮길 때는 게임의 내보내기 기능으로 원본을 보관한다.
