# v352 Sower 상태 원화 — 부모 통합 검토용 부분 제안

메인·게임 실행과 분리된 독립 staging이다. `active:false`, `activationReady:false`를 유지한다. image_gen **정확히 4회, 4 PNG, 원본 64영역**을 제작했고 자동 재생성은 0회다. 원본을 복사만 했으며 PNG crop 재저장·픽셀 편집·반전·보간은 하지 않았다. `sprites.fragment.json`에는 검토 제안 **56영역**만 들어 있다. 보류 8영역도 원본과 `candidate-crops.json`에 남아 있다.

| 동작 | 원본 | 제안 | 보류 | 제안 배율 |
|---|---:|---:|---|---:|
| hurt | 16 | 16 | 없음 | .22 |
| fall | 16 | 12 | left 4 | .20 |
| rise | 16 | 16 | 없음 | .20 |
| attack | 16 | 12 | right 4 | .21 |

각 PNG는 실제 1254×1254다. 행은 down/left/right/up, 열은 phase0..3이다. 공격은 런타임 CharDef 계약에 따라 `attack`에, 나머지는 `motions`에만 제안했다. 기존 walk/idle/work·다른 상태·이전 원문을 덮지 않는다. 이 파일은 완전한 CharDef가 아니므로 부분 방향을 통째로 덮어쓰지 말고 명시적으로 deep merge해야 한다. 누락 방향을 해결하거나 별도 허용한 fallback 정책을 정하기 전 출시 완성 모델로 세지 않는다.

## 실제 참고와 제작 경계

기존 v335의 sower-idle-v2, work-v1, walk-down-v2, walk-up-v2 원문을 직접 열었다. 기준 모델은 큰 4족 정원 기계, 넓은 회색 철제 섀시, 황동 피스톤, 둥근 발판 4개, 높고 낮은 비대칭 탱크 2개, 배관, 전면의 짧은 하향 광학부와 하부 종자 주입구다. 3족 Surveyor·6족 Culler와 구별했다. `docs/lore/bestiary.md` §11 및 Body.Sower의 DriveLeg1..4/기계 파트/Creature.Sower의 경로 밀어내기 자연 공격을 읽었다.

생성 참고 입력은 canonical idle과 별도 front/rear walk 3개다. 기존 work 원문의 rear 행은 고정 탱크 위치가 idle과 달라 기존 등록에서 flipX를 쓰므로 새 생성의 기준 입력으로 사용하지 않았다. 이번 신규 등록에는 flipX가 없다. 소유한 독자 원화만 참조했으며 타 게임 픽셀을 입력하지 않았다.

`requests/`는 도구에 실제 넘긴 정확한 인수를 보존한다. `reference-inputs/`는 자체 입력의 바이트 동일 복사본이다. 입력 SHA는 `reference-manifest.json`, 생성 기본 경로/복사 경로/출력 SHA는 `provenance.json`에 있다. 기본 `/workspace/generated_images/` 파일도 그대로 두었다.

## 직접 시각 검토와 보류 사유

생성 결과 원문 4장을 직접 보았고, 독립 canvas의 source-chart 4장, 기존 idle과 비교한 선택 배율의 4위상 합성, 실제 1× 크기 phase3 합성을 직접 열어 봤다. 메인 게임·Native 방·Core는 로드하지 않았다. 원화의 고정 방향·전후면 광학부/환기구·탱크 장착·접힌 도구/4족 구분·발판·접지와 낮은 차체 지지를 봤다. 무기/주먹·마법 효과·바닥·그림자·새 외부 자원은 몸에 들어 있지 않다. 가려진 먼 발판은 가림으로 기록하며 네 발의 모든 물리적 접촉이 보인다고 주장하지 않는다.

- **fall.left:** phase0..2는 좌향이지만 **phase3의 전면 광학부가 관찰자 쪽으로 돌아온다.** 해당 원문 몸 bounds는 `[947,449,283,147]`, 제안하지 않는 3px 여백 crop은 `[944,446,289,153]`다. 단순 배율/flip으로 방향 실패를 숨기지 않고 clip4개 전체를 보류했다.
- **attack.right:** 원문 몸 자체의 실제 겹침이나 절단은 없다. phase1 bounds `[338,663,284,222]`, phase2 `[623,681,296,209]` 사이 x 범위 여백은 **1px**다. 3px crop은 이웃 주요 몸 픽셀 19개씩, 2px crop은 8/7개를 가져온다. **1px 여백은 두 몸 모두 무손실·이웃0·alpha≥16 테두리0**인 안전한 대안이다. 그러나 요청한 넓은 간격을 만족하지 못하므로 자동 수락하지 않고 clip 전체를 보류했다. `attack-right-margin-trials.json`에 0..3px 대안을 정확히 남겼다. 원문이 서로 겹친다고 과장하지 않는다.
- 넓은 간격 요구는 전반적으로 미달이다. 요청한 몸폭≤60%셀 대신 실제 몸폭은 **79.1..94.4%**다. 56개 제안 crop에는 각각 3px 여백과 이웃 주요 몸 픽셀0·불투명 테두리0이 있고 전체 실루엣은 분리돼 있다. 간격 요구 자체를 통과했다고 표시하지 않는다. 등록 여백과 실제 바이트 안전성, 미술 요청 미달을 구별했다.
- attack은 낮아지는 차체와 발판 벌림/피스톤 하중 변화가 있으나 밀어내기 전진 표현은 절제돼 있다. 특히 후향은 앞 차체가 가려져 앞쪽 추진감이 약하다. 공격 범위/실제 밀림/이동이나 연출을 이 원화만으로 검증했다고 하지 않는다. 부모 Native 전환 검토에서 재평가해야 한다.
- fall 최종 자세는 고정된 완전 평지 위의 물리 시뮬레이션이 아니라 지지 상실 후 낮게 접힌 기계 원화다. belly/pad contact는 접지 기준 후보이며 실제 지형 관통·그림자는 게임 장면에서 확인해야 한다. rise는 새 독립 원본이고 fall 역순을 재사용하지 않았다.

## 크기·접지 계약

`foot-anchors.json`은 제안 56개의 정확 crop/원문 지면 투영점/정규화 anchor/배율을 제공한다. x는 몸/발판 외곽의 중앙 투영, y는 보이는 최하단 발판/낮게 접힌 섀시 접지 띠를 기준으로 한 **명목상 기계 지면 pivot**이다. 먼 발의 실제 접촉점이나 공중 발을 모두 접지했다고 세지 않는다. 원본3px 여백을 포함한 모든 제안 crop의 주요 연결 몸체는 보존된다.

기존 idle의 실제 alpha≥16 몸 크기와 `scale .23`를 기준으로 동작별 고정 배율을 비교했다. 모든 방향/프레임에 같은 동작 배율을 사용하며 프레임별 가변 확대·가로세로 비율 왜곡으로 모델 차이를 숨기지 않았다. `scale-comparison.json`에 각 방향의 source/world 크기와 폭/높이 오차가 있다. Hurt 최종 폭은 idle 대비 +2.4..6.3%, 높이는 -0.7..-3.0%; rise 최종 폭은 -1.1..-4.1%, 높이는 -0.6..-4.2%; attack 최종 높이는 -4.9..-7.9% 낮다(우향 수치는 보류 원문 비교). 이런 원문 종횡비 차이는 단일 배율로 완전히 해결되지 않는다. 같은 .23을 무조건 적용하는 것은 피했다.

권고 loop/clip 길이는 hurt600/fall1500/rise1800/attack900ms다. `proposedMotionDurations`는 메타데이터일 뿐이며 Core TU를 바꾸지 않는다. 실제 장면의 피격 interrupt, 쓰러짐/기상 상태, 밀어내기 자연 공격 cue와 duration 연결은 부모가 별도로 검토한다. 글로벌 fall 경과/죽음 렌더의 실제 시간 정책도 여기서 실행하지 않았다.

## 사적 진단과 보존

`index.html`과 `capture-staging.mjs`는 원문을 canvas drawImage로 읽기만 한다. crop PNG를 저장하지 않으며 스크린샷은 검토 증거이지 신규 원화 수가 아니다. 처음 uniform .20 비교와 favicon404 기록은 `diagnostics/initial-uniform-scale/`에 보존했다. favicon을 data URL로 수정한 최종 사적 진단은 오류0이며 새 선택 배율 비교를 남겼다. 메인 dist/preview나 game state를 사용하지 않았다.

`analyze-sources.py`는 PNG CRC/alpha/주요 연결 몸 경계를 읽기 분석하고, `register-staging.py`는 JSON 제안만 작성한다. `audit-staging.py`로 바이트 동일성/unique RGBA 영역/제안 참조/경계/보류 미활성화/이전 staging 불변을 검증한다. 이전 v335와 v349의 118파일 SHA baseline을 보존했고 읽기 감사에서 변경0을 확인한다. 메인 src/public/docs/dist/publication 수정·빌드·World/Core/게임 Native·commit/push는 하지 않았다.
