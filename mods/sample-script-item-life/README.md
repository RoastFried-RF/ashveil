# 실제 아이템 착탈·제작 워커 예제

타이틀에서 선택하면 기존 가죽 외투의 실제 착용/탈의와 붕대 완성 때 자기 JSON 기록/한국어 로그만 남긴다. `scripts.api: "^1.1.0"`을 요구한다. onConsume 없이 onEquip/onUnequip/onCrafted만 등록할 수 있다. 수리는 onRepair를 별도로 등록한다.

부분 착용/실패/재료 부족과 새 인물 미리보기는 완료 콜백을 만들지 않는다. 실제 콜백이 실패해도 이미 완료한 원래 물리 결과는 유지한다. 다른 의료 재료의 적용/제작 재료 소비 등은 이 예제의 콜백이 아니다.

`pnpm mod:package sample-script-item-life test-results/sample-script-item-life.tar.gz`로 로컬 패키지를 만든다. 이미 있는 출력 파일은 덮어쓰지 않는다.
