# X3 근거 경로 대조 — 현재 코드와 다음 수락

2026-10-28 KST. Core/공식 콘텐츠는 공개 v402와 같은 원문이다. 이 표는 작가용 `lore/world-bible.md` §10을 내부 개발용으로 대조한다. 플레이어에게 미발견 진실을 공개하는 UI나 자동 지식 지급이 아니다. 일곱 실마리 묶음의 실제 데이터는 `research-threads.json`, `specimen-research-v398.json`, `ward-evidence-v399.json`, `spire-reply.json`의 패치로 구성되므로 옛 v314의 네 묶음만 세지 않는다.

| 진실 | 현재 접근·개인 근거의 코드 후보 | 남은 수락 경계 |
|---|---|---|
| T1 침묵 | `Item.CalvisJournal` 완독과 `hush` 실마리. 실제 원본 공개는 `Evidence.Calvis`. | 자동 응답/보존 모드와 원본 증언의 범위를 지킨다. 착륙장 기록 등 공개 경로의 전체 대조·현재 입력/보고서/복원은 추가 확인한다. 채권단이 오지 않은 이유인 P0는 임의 해답을 만들지 않는다. |
| T2 회색열 | `Item.SettlementMycologyRecords`와 실제 `BestiaryEntry.Rat` 해부가 `ash-fever` 근거다. | 병리 문헌은 신체 상태나 모든 굴쥐의 보균 여부를 증명하지 않는다. **재떡 한 달 섭취의 위험−30%/재폐+10은 문헌에만 언급되며, 현재 재떡 Item/섭취 과정·훈련 수지 연결을 찾지 못했다.** 실물 공급·유한 섭취·기간/비용·질병 노출 경계를 구현하고 검증할 후속 후보로 둔다. |
| T3 장막 | `Item.ChimneyHalfManual`과 실제 센서 청소의 `chimney-seven-sensor` 기록. | 청소의 원래 물/천·실제 센서 결과, 다른 장치와 분리된 접근 경로·저장 복원을 현재 입력으로 검증한다. |
| T4 탑 정지 | `chimney-seven-stopped`, `tower-consequences.ts`의 시간에 따른 하늘/일조·토양/인접 탑 및 `shade` 근거. | 실제 인가/정지 비용과 현재 선택, 계절/장기 대가·타 지역 변화·보고서를 대조한다. 초기 경계 fixture를 자연 수년 플레이로 보고하지 않는다. |
| T5 세 음 | `culler.ts: ringMaintenanceBell`의 원래 종·기계 반응/반복 내성. | 다른 지정 정원사 기계·청각/거리/내성·중단/복원의 전체 동작과 문헌/공개 지식을 대조한다. |
| T6 재늑대 | `Item.LivestockAdaptationRecords`와 실제 `BestiaryEntry.Hound` 해부의 `adaptation` 근거. | 문헌/표본·원래 사체/산물·다른 혈통 추정 금지와 복원, 털양과의 지정 연결을 대조한다. |
| T7 남은 별 | 수신 관로·첨탑 수리/실제 송신 `signal` 단계, `spire-reply.json`의 회신 단계. | 송신과 수신의 시각/전력·원래 코드 판, 당사자의 실제 회신 기록과 결말/보고서/복원을 현재 입력으로 검증한다. |
| T8 0호 금고 | `Item.CorporateCodePlate`, `Item.ChimneyHalfManual`, `Item.CalvisJournal`과 `evidence.ts`. | 기억이 실제 코드 판을 대신하지 못한다. 원본/목격자 공개와 경비대 분열의 인원·관계/현금·복원을 끝까지 검증한다. |
| T9 울림 | `resonance.ts`와 특성의 실제 청력/거리·탑 두통. | 소리의 존재와 숨은 위치/정체를 구분하고 시작 평판·청력/거리·다른 기계, 현재 UI/저장을 대조한다. |
| T10 숲 | `Item.SeedVaultLedger`, `forest` 근거와 `kinship.ts`/저조도 작물. | 금고 접근·실제 원본 기록, 두 지파 교류/관로·생태/재배와 장기 복원의 전체 연결을 대조한다. |
| T11 수도원 | `Item.AbbotFinalRecord`, `Item.AmalgamCapsuleRemnant`, 실제 융합체 해부, `cloister-seal`과 T2 병리 문헌의 결합. | 기록자 증언/실물 규격/표본을 구분하고 캡슐 잔해에서 새 소모품을 만들지 않는다. 현재 읽기→해부→근거/보고서/복원을 검증한다. |

`research.ts`는 실제 완독/오독, 미래가 아닌 당사자 현장 기록, 실제 해부, 본인 원본 공개를 확인한다. 이 규칙과 `expedition-endings.ts`/`retirement.ts`의 종료 기록이 있다는 것만으로 모든 결말 수락을 완료하지 않는다. 남은 검증은 원래 UID/몸/인원/돈과 정상 저장을 포함하며, 영어 문헌/실마리/결말/보고서도 별도로 완성해야 한다.

재떡 후속 구현에서 문헌을 읽었다는 이유로 생리 효과를 소급하지 않는다. 원래 음식의 실제 섭취와 누적 기간·부작용을 같은 신체에 저장하고, 구형 각인에는 없던 섭취 이력/실물을 만들지 않는다. 정확한 기본값·유지 기간과 공개 정보는 정본/Def로 명시한 뒤 현재 질병/재 노출 함수에 연결한다.
