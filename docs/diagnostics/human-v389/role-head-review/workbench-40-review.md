# v389 역할 머리 최종 정적 fit 검토

`workbench-r4/head-{worker|healer|trader|guard|reaver}-{down|left|right|up}-{base|traveler}.png` **40장을 모두 `view_image` 원본으로 직접 열었다.** 이40개 정적 장면에서 머리-목 분리, 과대 두상, 좌우 반전, 뒤의 앞얼굴 노출, 후드 밖 귀/두피 중복, 명확한 잘림에 해당하는 **P1/P2를 발견하지 못했다.** 이는 이 조합의 정적 머리 fit에 한정된 수락이며 출시/전체 인체 동작 승인이 아니다.

기본형에서는 worker의 묶은 머리, healer의 회색 머리/수염, trader의 탈모/수염, guard의 짧은 머리, reaver의 거친 머리가 구분된다. 정면은 양 눈, 두 측면은 올바른 코 방향, 뒤는 뒤통수다. 후드형에서는 중앙 얼굴/코가 방향에 맞게 남고 뒤에는 앞얼굴이 나타나지 않는다. 후드는 실제로 머리카락과 귀를 가려 역할 간 세부 차이가 줄어든다. 작은1×만으로 모든 흉터/주름을 식별한다고 주장하지 않는다.

각 PNG에는 같은 실제 HumanView의1×/2×/4×가 있다. audit의 해당40행은 **idle·paused·root[0,0]·합성 UID·Core 세계 없음**이며 actual world/state 증거가 아니다. traveler는 Hood/LeatherCoat/Gloves/Boots/LeatherBelt와 RagShirt 안감 조합이다. 전체 audit146행의 error목록은 비어 있지만, 나머지106행의 모든 그림을 이 검토가 수락한 것은 아니다.

확인한 불변 제품은 `/workspace/.ashveil-checkpoints/v389-human-fit-r1`이다. 별도 `human-heads.json`과 `human-art.ts` 병합을 확인했고20개 역할/방향의 frame·a/b·face·scale·crop은 최종 원본 계약과 차이0이다. 등록 원본 SHA는 `2d6f88f7119b623423660b39826e4c1ff05a914f053703507e81853675deecfe` 그대로다. PNG별 실제 관찰·SHA·치수·audit 문맥과 소스 해시는 `workbench-40-review.json`에 기록했다.

아직 수락하지 않은 범위는 실제 게임 NPC4방향, 동작/이동/전환 중 fit, 다른25의복/투구/가면/고글, 결손·의수족·장신구, 실제 물리/방어/보온/UID/시간/난수/전체 세계다. 원본의 희미한 alpha 잔상도 수정하지 않았고 모든 배경에서 부재한다고 보증하지 않는다.

제품/이미지/역사 파일 수정과 새 이미지 생성, 브라우저·GPU·게임·Full/World/Type·과거 v3101000run 실행은 없었다. 출력은 이 새 검토 폴더의 파일뿐이다.
