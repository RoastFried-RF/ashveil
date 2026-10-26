# v389 실제 NPC4뷰 · 역할 머리 검토

`human-fit-r6/npc-{down,left,right,up}-down-world.png` **4장을 모두 직접 열었다.** 각 장의 NPC8명과 플레이어1명에서 머리 부착·목·두상 크기·후드·투구·좌우/뒤 방향의 명확한 **P1/P2를 발견하지 못했다.** 플레이어는 네 장 모두 정면이며 NPC8명만 각 초기 방향을 따른다.

맵에는 상단 후드4명, 하단 투구2명과 머리가 드러난 궁수/떠돌이, 아래쪽 플레이어가 보인다. 정면/두 측면에서는 머리장비와 얼굴 방향이 맞고, 뒤 NPC에서는 앞 눈·코·입이 나타나지 않는다. 머리가 떠 있거나 이중 얼굴로 겹치는 현상은 확인되지 않았다. 후드·투구가 머리카락을 가리므로 모든 역할을 그림만으로 개별 식별했다고 주장하지 않는다.

초기JSON과 presentation의 실제 actorID 연결로 **9명 모두 HumanView surface**임을 확인했다. 요청한 역할은 worker(정착민66), healer(의사75), trader(상인84), guard(경비93), reaver(약탈자103/두목109/궁수117)다. 추가로 wanderer가 플레이어1과 NPC떠돌이122에 쓰인다. 각 표면의 물품 UID는 해당 초기 장비 UID 안에 있으며 후드/투구와 face-occlusion의 실제 source가 방향에 맞다. 뒤에서는 얼굴 재표시 노드가 없다. UID와 역할은 픽셀이 아니라 읽기 전용 JSON 근거다.

이것은 **자연 마을 플레이 수락이 아니다.** NPC는 실제 Def loadout을 가진 유한 초기fixture이며, met=true·faction=player·nextAct=초기시각+1,000,000,000으로 정적 배치됐다. 네 방향도 각 fixture의 초기 facing이다. NPC AI/적대/대화/스케줄/이동·공격 동작/세이브·난수·시간·전체 세계 동등성은 이 검토에서 수락하지 않았다.

이전 `workbench-40-review.*`는 합성 작업대의 별도 검토로 그대로 보존했다. 새 `npc-4-review.json`에4PNG 실제 SHA·치수·개별 시각 관찰과 initial/presentation SHA,9명별 실제 ID/역할/장비/방향 근거를 기록했다. 큰 r6폴더의 다른 PNG를 수락한 것으로 확대하지 않는다.

새 캡처·이미지 생성·제품/PNG/역사 수정·브라우저/GPU/게임·Full/World/Type·과거 v3101000run 실행은 없었다.
