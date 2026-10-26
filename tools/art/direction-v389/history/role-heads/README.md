# v389 역할별 머리 원본 요청 — 입력 검증 거절 / 중단

도구 호출은1회이며 결과 PNG는0개다. `referenced_image_paths` 최대5개 제한에 v381+worker/healer/trader/guard/reaver 자체 원본6개를 전달해 입력 검증에서 거절됐다. 정확한 오류는 **`referenced_image_paths` must contain at most 5 paths**이다. moderation 거절로 기록하지 않는다. 요청을 바꾸거나 자동·수동 재시도하지 않았다.

요청한5역할×4방향 머리20개는 제작되지 않았다. 새 raw PNG 경로·SHA·bytes와 crop/neck/crown/face polygon은 모두 null이다. 검토한 참조나 원문 프롬프트를 완성 원화로 세지 않는다.

- `requests/role-heads-v1.json` / `.prompt.txt`: 실제 전달한 인수와 프롬프트 그대로.
- `references/`: 직접 연 자체 원본6개의 무변경 복사본.
- `records/references.json`: 원래 경로·참조 경로·SHA256·바이트·치수·exactcopy.
- `records/direct-view-review.json`: 실제 참조 외형 관찰. 기존 hood/helmet 아래의 보이지 않는 머리는 추정 승인하지 않음.
- `records/tool-failure.json` / `call-budget.json`: 입력 제한·PNG0·재시도0·중단 근거.

원래 v322 참고자료는 해당 저장소 LICENSE의 CC0 문구를 가지며 이미지 생성 원본임이 기록돼 있다. v381 자체 원본은 이전 출처 기록에 연결되지만 이 실패 작업에서 새 라이선스를 만들지 않는다. 새 원화가 없으므로 별도 완성 아트 라이선스나 품질 승인을 발행하지 않는다.

작업은 이 새 스테이징에만 기록했다. main/spec/installer/MapRenderer/workbench/Def/역사 스테이징은 수정하지 않았다. 브라우저·게임·GPU·Full/World/Type와 과거 v3101000run은 실행하지 않았다.
