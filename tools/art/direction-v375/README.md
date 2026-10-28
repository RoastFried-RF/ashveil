# 관로 지네 렌더 연결

자체 v372 PNG의 원문 바이트와6영역을 재등록했다. 새 imagegen 호출/PNG/전체 보행 원화는0이다. `av375_conduit_crawler.crawler`는 머리1개(닫힘/열림 중1선택), 중간판7개+꼬리판1개, upper/lower를16다리에 공유한다. 화면41인스턴스는41고유 원화나4방향 authored gait가 아니다. 원문 SHA는 `d79e58402ddfe288399997088a83bd85ee08d171e83b7dcfc342fdaf49d29d2f`다.

`crawler-motion.ts`는 실제 `walkPosition`이 준 root를 정확히 따라간다. v374의 독립 root 조향·곡률 제한은 사용하지 않는다. 거리 trail을 따라8체절을 배치하고 접지 동안 world anchor를 보존한다. 급회전 중 공중 회복 목표만 현재 체절의 앞쪽 도달 위치로 갱신한다. 요청 foot/anchor와 IK가 clamp한 end/오차를 분리한다. 정지 뒤 진행 중 회복발만 착지하며0시간은 상태를 진행하지 않는다. 순간이동/맵 변경/시야 재등장은 새 표시 owner를 만든다.

`MapRenderer`는 현재 보이는 Creature에서 `isMissing`, 정규화한 `partDamage`, 실제 다리 `partEff`를 읽는다. 소실은 그림을 숨기고, 붙어 있으나 기능0인 다리는 접지 해제·접힘으로 구분한다. 실제 Core의 체절/신경절/독 마비는 `partEff`를 통해 표시한다. 손상된 plate 자체는 missing이 아니면 남는다. 식별 전에는 기존 unknown tint를 유지하며 공개 inspect는 보이고 식별된 개체만 포함한다.

머리 root는 보간 위치×16+(8,14)다. 공격/피격의 일반 root 튀기는 효과를 지네에 더하지 않는다. 실제 공격 큐의 단계에서 열린 턱 원문/작은 내부 thrust를 사용하고 피격은 기존 plate의 작은 반응/섬광, 사망은 남은 몸과 접힌 다리의 명암으로 표시한다. `crawlerState.mode`의 천장 대기는 같은 등 원문을5표시px 들어 올리고 floor 전환 때 내린다. 전용 underside/ceiling/drop/curl/fall 원화가 생긴 것은 아니다. 바닥 world anchor와 천장 표시 높이를 실제3D 접촉으로 해석하지 않는다.

개체 전체는 논리 머리 칸이 현재 보일 때만 노출한다. 긴 몸/다리/그림자는 현재 FOV의 비벽 칸을 합친 mask로 자르고, 픽셀 포인터 판정도 같은 mask를 쓴다. 이는 지도의 물리적 긴 몸 점유나 자기/다리 충돌 해결이 아니다. 한 등 시점의 회전·좌우 reflection은 빛 방향과 반대 면을 새로 그리지 않는다. 소켓/겹침/목은2D 투영과 일부 추정이고 lower 끝은 관측한 갈고리끝을 사용한 표시 접촉 proxy다.

`atlas-plan`은 선택된 crawler의6영역 원문만 요구하고 다른 모델에서 해당 sheet를 제외한다. 표시 owner는 빌린 원문 texture를 파괴하지 않는다. 맵/모델 변경과 title의 renderer destroy에서 파츠/마스크를 정리한다.

## 실제 실행한 제한 검사

- `test-results/autonomy-v375/crawler-geometry-r1/audit.json`: 독립460표본에서 직선/즉시90·135도/대각선/정지·재출발, root차0·도달오차0·같은 접지epoch anchor 변이0. 최소8접지, 정지 후16접지. 실제 물리 안정 판정은 아니다.
- `crawler-contract-r2/audit.json`: 같은 경로와 자체 PNG CRC/6crop·선택 sheet·잘못된 소켓 거절 계약. world/Core를 만들지 않는다.
- `crawler-preview-r1/audit.json`: 실제 DOM83표본으로0/.5/1/2배 이동,90도 입력, 정지·재출발, 턱 공격/피격, 소실·파괴, 천장5→바닥0, mask, 사체를 관찰했다. root차/도달/안정접지 drift/동일epoch anchor 변이 모두0, browser errors0.
- `crawler-hit-r2/audit.json`: 실제 포인터5표본에서 불투명 판 hit, 투명 여백 miss, FOV로 가린 몸 miss를 확인했다. 앞 이동 관찰 뒤 중복 mask 재생성 제거/clipRadius 메서드 추가/포인터 UI를 반영한 소범위 확인이다. 이동 계산은 바뀌지 않았다.
- 직접 연 화면은 r1의02-straight/03-turn/05-jaws/06-parts/07-ceiling/08-clip/09-dead와 자체 PNG 원문이다. r1의01-rest/04-diagonal은 저장됐으나 이 기록에서 직접 열었다고 세지 않는다.
- 대상 ESLint 통과. 공용 타입/빌드/Native/Full/World/배포는 부모 담당이며 여기서 통과했다고 기록하지 않는다. 자체 Vite6396은 두 관찰 모두 finally로 종료했다.

## 공개 도감 연결

`tools/art/crawler-preview-v375`는 게임과 같은 `CrawlerView`, `CrawlerMotion`, `walk-motion`을 사용한다. DOM의 손상/천장 상태는 독립 표현 예시이며 Core 성공 검증이 아니다. 기존 도감의 캐릭터 카드는 머리 원문이라고 밝히고 조립 화면으로 연결한다.

부모가 공용 구현을 동결할 때 `node tools/art/export-crawler-v375.mjs`를 실행하면 `public/artbook/crawler/`를 생성하고 같은 원문 SHA/공유 모듈 SHA를 보존한다. 일반 catalog는 `node --import tsx tools/art/export-public-artbook.ts`로 현재 Def와 함께 내보낸다. 자식 작업에서는 이 공용 export/build를 실행하지 않았다.

재관찰은 `node --import tsx tools/inspect-crawler-preview-v375.ts test-results/새경로`를 쓴다. 포인터만은 뒤에 `--hit-only`를 붙인다. 기존 결과 경로는 덮어쓰지 않는다. `install-crawler-v375.py`는 byte-copy/등록 도구이며 새 아트를 만들지 않는다. v376 등 다른 키를 지우지 않는다.
