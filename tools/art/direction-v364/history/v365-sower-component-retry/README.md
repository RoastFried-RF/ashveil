# v365 파종기 회수품 — 수동 오류 복구 후보

별도로 승인된 수동 복구1회로 원문PNG1장(2172×724), 독립 아이콘3개를 얻었다. **v363실패1call/0PNG + v365복구1call/1PNG = 총2call/신규원문1PNG**다. 자동 루프·추가 생성은0회다. 이전 실패 기록은 그대로이며 성공으로 바꾸거나 중복 원문 수로 세지 않는다.

정확한 도구 인수/프롬프트/자체 참고 입력은 v363과 동일하다. 인수 JSON SHA는 `9fafdabb29f8004c4b19148762f1a56993c8b05a3c391234af3dcca55917364f`다. 입력경로도 기존의 보존된 참조를 그대로 사용했다. `retry-contract.json`은 실제 입력경로/로컬 바이트동일 복사본/SHA를 기록한다. 필터 해제·우회 문구·새로운 폭력 요소를 추가하지 않았다. 원문은 기본 도구 출력에서 바이트 그대로 복사했다.

원문 SHA-256: `f72bd41f60e0abab16f84bced3e91cc8206f584582960841a2f17ddac50542a3`.

| 계획 물품 | frame key | 정확 crop[x,y,w,h] |
|---|---|---|
| Item.LargeActuator | av331_large_actuator | [132,71,613,574] |
| Item.SettlementFungusCapsule | av331_settlement_fungus_capsule | [953,120,263,503] |
| Item.MediumPowerCell | av331_medium_power_cell | [1552,193,489,431] |

세 물품은 실제 볼트 금속 가동기/황동 축, 밀봉된 회색가루 chamber, 닫힌 박스 동력 모듈이다. 파종기 본체/구동부와 같은 녹슨 강철·황동·옅은 오염색을 유지한다. 외부 광원·마법구체·떠다니는 입자·씨앗·마른 땅/그림자를 넣지 않았다. source PNG와 `diagnostics/sources.png`, `native.png`, `zoom.png`를 직접 봤다.

32px/48px의 어둡고 밝은 배경에서 세 실루엣은 구분된다. 회색가루 캡슐은 기존 v353의 가늘고 갈색 내용물이 있는 종자 캡슐과 비교했다. 32px에서 미세 가루 입자·볼트·정확한 단자 개수가 독립적으로 읽힌다고 과장하지 않는다. 48px에서 봉인/하우징과2단자 형태가 더 잘 보인다. `visual-review.json`에 물품별 판단을 남겼다. 이것은 원문을 읽는 private canvas의 최근접 표시이며 실제 게임 소지품 UI를 실행한 검토는 아니다.

모든 후보는4px여백의 crop이며 주요 연결 실루엣 손실0·이웃 주요 몸0·alpha≥16불투명 crop테두리0·원문 구조적 잘림0이다. canvas 가장자리 잔여 알파 최대1은 저알파 잔여값이며 물품 잘림으로 세지 않는다. 간격/크기 요청 미달도 숨기지 않았다. 가동기는 몸폭83.6%셀/높이78.2%, 캡슐높이68.4%, 동력모듈폭66.4%셀로 요청 최대치60%폭/65%높이를 일부 넘는다. 첫 간격216px은 요청한 canvas10%=217.2px보다1.2px짧지만 원문 주요 몸은216/344px로 분리돼 있다. 추가 생성하지 않았다.

`sprites.fragment.json`은1sheet/3frames, `item-links.json`은 기존 계획 Item ID와 sprite key·source crop·center anchor를 연결하는 후보 메타데이터다. 새 Def/Core를 설치하지 않았다. `artRegionUid`는 그림 SHA/사각형 식별자이며 실제 유한 harvest UID가 아니다. 실제 수확·제작·정비·동력/감염 효과는 부모 연결 범위다. `active:false`, `activationReady:false`, `releaseApproved:false`를 유지한다.

PNG편집·crop/리샘플 원화 저장은0이다. 브라우저 스크린샷은 검토 증거이며 신규 원문으로 세지 않는다. 이전 v363실패와 v357/v353의62파일 SHA가 바뀌지 않았음을 읽기 대조했다. 메인/src/public/Core/Def 변경·build/test/game/commit/push는0이다. 정확 인수·참고SHA·원문·크롭·원화 판단·바이트/알파 근거를 함께 보존했다.
