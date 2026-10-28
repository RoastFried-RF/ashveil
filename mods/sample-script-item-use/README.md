# 실제 의료 적용·제작 재료 소비 예제

타이틀에서 선택하면 원래 붕대/천의 실제 치료 적용과 제작 재료 차감만 자기 JSON 기록·한국어 로그로 남긴다. scripts.api ^1.3.0 / ItemCompWorker.onApplied·onMaterialConsumed 예제이다. 새 물품이나 몸을 만들지 않는다.

의료는 원래 제공자/실제 환자, 원래 물품UID·Def와 실제 개수/회분 감소·상처/부위/partial을 알린다. 부분 부목이 실제 재료를 쓴 경우 partial:true이며 완치 콜백이 아니다. 제작은 실제 원래 개수/그램/ml 차감량과 준비/완성 단계를 알린다. 완성품 더미 병합이나 남은 조각의 동일 UID와 무관하게 원래 차감량을 기록한다. 실제 작업 전체가 끝난 뒤 추가 명령을 적용하고 실패해도 원래 치료/소비/완성품을 되돌리지 않는다. 현재 의료 연결은 공통 치료 경로이며 별도 의수 설치 등은 별도 범위이다.

`pnpm mod:package sample-script-item-use test-results/sample-script-item-use.tar.gz`로 로컬 패키지를 만든다. 기존 출력은 덮어쓰지 않는다.
