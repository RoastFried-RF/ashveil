# 원래 야영지에서 출발하는 새 사건

타이틀에서 선택하면 새 날짜에 현재 지도에서 예약 가능한 경우에만 짧은 순찰을1턴 뒤 예약한다. 새 Sample.Event.CampCircuit은 원래 reaverCamp 공급원의 명시된 구성원 두 사람만 사용한다. 원래 몸/배낭/장비/위치/UID를 보존하고 실제 경로를 걸어 개울과 집으로 돌아오게 한다. 출발/실제 귀환 결과는 자기 JSON 기록과 한국어 로그로 남긴다. 사망/납치/교전은 실제 세계에서 진행되므로 귀환을 보장하지 않는다.

scripts.api ^1.2.0 / PlaceEventWorker.canFire·execute와 onDayStart/onEventResolved 예제이다. ctx.view.queueableEvents는 현재 지도에서 유효한 공급원을 가진 예약 가능 사건 ID를 최대32개 제공한다. 미리보기가 세계 상태를 바꾸지 않는다. 경로는 @home으로 끝나야 하며 현재 연결은 원래 명시된 구성원/귀환 경로가 있는 야영지 사건의 명시적 예약이다. 자동 가중 사건 선택 전체와 다른 종류의 출발지는 별도 범위이다.

`pnpm mod:package sample-script-place-kind test-results/sample-script-place-kind.tar.gz`로 로컬 패키지를 만든다. 기존 출력은 덮어쓰지 않는다.
