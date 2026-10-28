# v363 파종기 회수품 아이콘 — 생성 실패 기록

요청한 세 아이콘은 아직 제작되지 않았다. image_gen **허용된1회**를 사용했지만 출력 단계에서 HTTP400 `moderation_blocked`로 실패해 **PNG를 반환하지 않았다**. 도구가 보고한 분류는 `violence`, request ID는 `3f2ee51d-ef5a-41d5-9f79-7157f716d286`다. 정확한 오류는 `generation-failure.json`에 보존했다. 자동 재생성·추가 호출은0회다.

요청은 `Item.LargeActuator`의 실제 금속 가동기/구동축, `Item.SettlementFungusCapsule`의 밀봉 회색가루 chamber, `Item.MediumPowerCell`의 폐쇄형 산업 동력 모듈이었다. 참조 plan은 `tools/content-plans/expanded-creatures-v331/core-fragment/defs/harvest-v331.json`이며 sprite key는 각각 `av331_large_actuator`, `av331_settlement_fungus_capsule`, `av331_medium_power_cell`이다. 실제 Def/회수 UID/제작/정비는 변경하지 않았다.

자체 v357 Sower left 본체/upper/lower/foot 원문과 v353 종자 캡슐/저장 탱크 원문을 직접 보았다. 이를 원본 바이트 그대로2개 복사해 일관성 입력으로 사용했다. 정확 도구 인수와 프롬프트는 `requests/`, 입력 경로와 SHA는 `reference-inputs.json`에 있다. 기존 staging51파일 변경0과 참고 복사본의 바이트 동일성을 `preservation-proof.json`에 기록했다.

신규 원문 PNG0, 신규 아이콘 영역0, 등록 제안0이다. 출력이 없으므로 원문·32px·48px 시각 검토를 수행했다고 표시하지 않는다. `references/`의 PNG2개는 기존 입력 복사본이며 신규 리소스로 세지 않는다. 반려된 출력 파일을 찾거나 기존 그림을 재가공해 대신 채우지 않았다. `originals/`와 `diagnostics/`는 비어 있다. 잘림/알파/형태 통과를 주장하지 않는다.

이 묶음은 실패 기록이며 `active:false`, `activationReady:false`, `releaseApproved:false`다. 메인/src/public/Core/Def 수정·build/test/game/commit/push·브라우저 실행은0이다. 추가 생성 없이 전달하라는1회 한도를 지켰다.
