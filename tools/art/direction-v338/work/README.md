# v337 재까마귀 섭식 · 수렵 깃털 원화

기존 v334 `av331_ash_crow`의 112등록과 해당8원본, CANON·캐릭터 동작/게임 개발 스킬·베스티어리 §7 및 `tools/content-plans/expanded-creatures-v331`의 Creature.AshCrow/Body.AshCrow/Item.CrowFeathers를 읽고 직접 원화를 보았다. 기존 정지와 공격 원본2장만 자체 일관성 입력으로 주어 새 그림을 만들었다. 타 게임 픽셀·스크린샷·트레이싱은 사용하지 않았다.

새 **2PNG/17고유 원본 영역**을 제안한다. work는 **4방향×4포즈=16영역**, 깃털 아이콘은1영역이다. 기존112영역을 신규 제작으로 세지 않는다. 기존 반전·역순·같은 crop 재등록으로 새 포즈를 늘리지 않았다. 이번 첫 후보2장은 이 한정된 원화/진단 검토에 통과했으며 폐기 후보0개다. 모든 요청·반환 PNG·원래 도구 출력은 그대로 보존했다. `active:false`이며 실제 게임 출시 수락은 별도다.

## 원화 의미와 기부

work의 각 행은 앞/아래, 왼쪽, 오른쪽, 뒤/위이며 각 열은 준비→낮춤→지면 쪼기→삼킴/회복이다. 새 PNG에는 까마귀 몸만 있다. 사체·피해자·먹이·피·고정 바닥·그림자·광원·전서통/붉은 실은 넣지 않았다. 작은 검은 부리·머리, 접힌 두 날개·두 발·짧은 꼬리를 유지한다. 뒤에서는 고개를 옆으로 돌려 눈/부리를 드러내지 않는다. 깊은 옆 쪼기에서는 먼 발/발가락 일부가 몸/가까운 다리에 가려지며 별도 가짜 다리를 그리지 않았다.

**기존 .045 표시 배율, 1800ms(권고1500~2000ms) 한 주기**를 쓴다. 짧은 공격560ms와 다르게 제자리의 느린 섭식이다. 기존 idle에 비해 준비 자세의 몸은 조금 웅크린 상태다. 기부는 프레임별 실제 두 발의 지지 다각형/지면 투영점을 직접 골랐다. 부리끝과 뒤쪽 꼬리는 이 투영점보다 아래로 보일 수 있으므로 최저 불투명 픽셀을 자동 anchor로 사용하면 안 된다. [foot-anchors.json](foot-anchors.json)에 원래 시트·crop 좌표와 보이는 부리끝/뒤 부리 가림을 구분해 남겼다.

깃털은 네 개의 푸른빛 검은 깃털이 느슨하게 겹친 작은 묶음이다. 가느다란 깃축·비대칭 바람깃·끝이 온전히 들어 있다. 기존 Def가 기대하는 **`av331_crow_feathers`** frame키로 연결한다. 그림 속 깃털 개수는 실제 유한 수렵/도살 산물 수량을 정하지 않는다.

## 전달 파일

- [install-plan.json](install-plan.json): 원본2PNG의 목적 경로와 SHA-256.
- [sprites.fragment.json](sprites.fragment.json): 새2시트·실제1254×1254 크기·정확17crop. `chars` 전체를 덮어쓰지 않는다.
- [character-work.patch.json](character-work.patch.json): 기존 `av331_ash_crow`에 work16, work1800ms,16frameTransforms만 더하는 JSON Patch. 기존 v334 캐릭터부터 설치해야 하며 기존112변환은 그대로다. 병합 시128변환이다.
- [item-icon.fragment.json](item-icon.fragment.json): 기존 Item.CrowFeathers 키와 아이콘1crop·깃축끝 원래 좌표. inventory표시는 전체crop을 맞추고 깃축 anchor는 세계 접지점으로 오해하지 않는다.
- [runtime-contract.json](runtime-contract.json): **실제 유한 먹이 출처를 성공적으로 섭취한 경우만** 재생하는 비활성 계약. 단순 탐색·실패·대기시간으로 영양/먹이/깃털을 만들지 않는다.
- `requests/`, `records/`: 정확한 도구 인수·프롬프트·자체 입력과 SHA, 도구 출력 절대경로와 보존본 SHA.
- [source-survey.json](source-survey.json), [native-review.json](native-review.json), [validation-proof.json](validation-proof.json): 읽은 정의/원화와 실제 확인 범위, 기계 검사 결과.

PNG는 image_gen 출력 바이트 그대로다. Pillow/NumPy/SciPy는 원본 알파·범위·연결 요소·기준점·RGBA crop SHA를 읽는 분석만 수행한다. crop PNG 재저장·픽셀 편집·리샘플링/배경 제거를 하지 않았다. 기존 원화 참고2PNG 복사본은 byte-identical이며 신규 원화 수에 넣지 않는다.

## 실제 검토와 한계

새 원본2장과 기존8장을 직접 열었다. 독립 진단의16포즈 차트, 기존idle/선택work를 나란히 둔 **0/1/2/3 네 위상 캡처**, 실제16px와6배 정수확대, 깃털16/32/96px 합성을 직접 열어 방향·두 발·두 날개·목·기부·잘림/이웃 털·작은 크기 외형을 확인했다. 작은 타일에서 미세한 발가락과 깃바브가 전부 유지된다고 주장하지 않는다. [diagnostics](diagnostics/)는 게임이 로드되지 않는 별도canvas 자료다.75canvas·브라우저오류0이다.

17crop/2PNG의 SHA·PNG CRC, 원본바이트/입력 보존, 실제 범위·참조, 크롭 안 큰 이웃 요소0, 알파≥16경계 잘림0, 가로crop 간격최소40px, source anchor/.045배율, JSON Patch를 읽기 전용 메모리 사본에 병합해 기존112변환 보존을 검사했다. 이 검사들은 움직임의 자연스러움이나 출시 품질을 자동 보증하지 않는다.

실제 섭식 성공 신호·유한 사체/음식 양·TU·기억/시야·이동/피격 중단·맵 조명/가림은 부모가 통합한 뒤 검토해야 한다. 공격용 눈 쪼기는 기존 실제 의식 없는 대상/얼굴 보호 규칙과 공격원화를 따른다. 비행·맴돌기·다른종·전서개체는 이번 범위에 추가하지 않았다.

```sh
python3 /workspace/.ashveil-planned/v337-crow-foraging-art/register-crow.py
python3 /workspace/.ashveil-planned/v337-crow-foraging-art/validate-staging.py
python3 -m http.server 6351 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v337-crow-foraging-art
node /workspace/.ashveil-planned/v337-crow-foraging-art/capture-staging.mjs
```

최종 전달 원화·등록 SHA는 [art-final.json](art-final.json)에 동결했다. 재등록 스크립트를 실행하면 재검토해야 한다. 메인src/public/docs/dist/게임상태·기존 확정 staging은 수정하지 않았고 공유빌드·Full/World·commit/push를 실행하지 않았다. 진단 서버는 검토 후 종료했다.
