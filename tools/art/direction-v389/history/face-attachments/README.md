# v389 눈·입 부착용 원문 좌표

등록 원문을 직접 보고 RGBA/픽셀 근방을 읽어 선택한2D 그래픽 점이다. 새 PNG·생성 호출·원문/제품/기존 face·scale 수정은 없다. 실제3D 소켓이나 고글/마스크 fit 수락이 아니다.

- `role-eyes.json`:5역할×(정면2+왼쪽1+오른쪽1)=**20눈 점**, 실제 보이는15개 head view. 각 frame/crop과 crop-local `eyes` 및 source-global/RGBA/±4–5raw px 관찰을 기록했다. 뒤5개 `eyes={}`다.
- `role-mouths.json`:5역할×3방향=**15입술선 점**. `mouth`는 crop-local이고 뒤5개 null이다. 정면±6/profile±7, 수염에 일부 가린 healer/trader±8raw px다. 닫힌 입술선/측면 입술 가장자리의 관찰·추정점이지 코/입의3D 중심이 아니다.
- `base-v381-eyes.json`:기본 v381 머리 **4눈 점**. 실제 frame/crop을 명시하고 기존 midpoint를 다시 동공 근방으로 확인했다. 뒤/먼 쪽 눈은 만들지 않았다.
- `runtime-label-normalization.json`:전달 뒤 부모가 갱신한 near-side 규약과 역사 raw 계약의 차이를 기록한다.

**프로필 눈 라벨을 주의해야 한다.** `role-eyes.json`은 최초 요청 규약인 LEFT.`right` / RIGHT.`left`를 역사 그대로 보존했다. 현재 부모 런타임은 가까운 팔다리와 맞춰 **LEFT는 `left`, RIGHT는 `right`**로 정규화한다. 따라서 역할 raw 좌표만 그 반대 key로 옮기며 좌표/픽셀은 바꾸지 않는다. 정면 양안 key는 그대로다. **`base-v381-eyes.json`은 이미 현재 런타임 규약을 쓰므로 다시 바꾸면 안 된다.**

모든 crop은 원본 전역 `[x,y,width,height]` 끝 제외, eyes/mouth는 명시한 frame crop-local `[x,y]`다. 원문 RGBA·전역 좌표는 별도의 observations에 이름을 구분해 남겼다. 고글의 nearLens는 실제 눈에, 마스크는 입술선/코 덮임을 고려한 부착점에 맞춰야 하며 전체 strap/PNG 중점을 눈 소켓이라고 부르지 않는다. 입 점은 generic `height*.61`보다 현재 역할 머리 scale 기준 약0.58–1.29world px 아래지만, 이것만으로 마스크 축·덮임·실루엣을 확정하지 않는다.

원문 역할 머리 SHA256은 `2d6f88f7119b623423660b39826e4c1ff05a914f053703507e81853675deecfe`, 기본 v381은 `f05cfe92abe4e81218d5f415310a008a0335379729ad5b6af2c641c45938e25e`다. 기존 `head-contract-runtime.json` SHA `3b3373543f0bc29efb8c550aee1773679c2a80f7cc32b4fa0b4454428243b252`와 초기 `role-eyes.json` SHA `2f49c83209251e48aecd63abb488ce5178949220aae9622ea5a44add5a610b15`를 유지했다.

브라우저·GPU·게임·Core/Def·Full/World/Type·과거 v3101000run 실행은 없다. 런타임 정규화와 실제 착용 화면 검토는 부모의 별도 통합 범위다.
