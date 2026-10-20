# 지상·던전 생성 워커 예제

타이틀에서 선택하면 최초 지상과 던전 각 층을 만들 때 입구 곁 바닥 한 칸을 진흙으로 바꾼다. 원래 주민·귀환점·출입구·시설·물품과 연결은 코어가 보호한다. 실제 생성만 자기 호출 횟수/지도 기록을 남기며, 인물 미리보기와 이미 방문한 지도는 기록을 늘리지 않는다. 기존 저장 지도를 다시 만들지 않는다.

WorldGen.Hearth.mapWorkers.surface/dungeon을 MapGenStepWorker.execute에 연결한 단계2 예제이다. 새 물품·생물·생성 장소는 추가하지 않는다. 일반 첫 후보 검증 단계이며 기존 생성 알고리즘의 모든 내부 절차를 개별 op로 노출하지는 않는다.

`pnpm mod:package sample-script-map-stages test-results/sample-script-map-stages.tar.gz`로 로컬 패키지를 만든다. 이미 있는 출력 파일은 덮어쓰지 않는다.
