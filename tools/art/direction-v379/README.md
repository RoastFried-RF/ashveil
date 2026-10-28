# v379 구제기 · 실제 렌더 연결

`av379_culler`는 자체 v373 FRONT와 v378 LEFT/RIGHT/BACK 원문4PNG·24영역을 재등록한다. 이번 imagegen/새 원문 PNG는0이다. `history/`에 v373·v377·v378의155파일을 바이트 보존했고 기존 staging/원문은 바꾸지 않았다. 정확 요청·실패·source SHA·원래 보류 사유는 각 이력에 남는다. 한 방향 화면은 차체1 +6drive×3 +2scythe×2 =23인스턴스이며23고유 원화/보행 프레임이 아니다. 방향 혼합120ms 동안 outgoing23인스턴스가 추가된다.

## 실제 신체와 동작

Core와 같은21ID를 읽는다. `DriveRF/RM/RH/LF/LM/LH` 각각은 upper/lower/foot3그림만 소유한다. `isMissing`이면 그3개를 숨기고, 실제 `partEff`가0인 붙어 있는 drive는 남겨 접고 접지를 해제한다. `Left/RightScytheArm`과 `Left/RightScytheBlade`는 각각 독립 그림 소유다. blade만 소실되면 arm과 반대 낫은 남는다. `partDamage/maxHp`는 실제 부위의 명암/손상 표식에 연결한다.

공격 ID는 `cullerLeftScythe→left`, `cullerRightScythe→right`, `cullerAcid→acid`, `cullerNet→net`다. 실제 FX의 mode를 보존하며 현재 장비나 임의 손을 추측하지 않는다. 선택된 낫만 준비.28/접촉.12/후속.24/복귀.36의 큐를 따른다. 접촉 목표는 실제 방향의 인접 생물 몸통 투영이며 source cap→tip을 고정2D 길이로 연결한다. 피격/중단에는 현재 각도에서 복귀한다. 사망/기능 정지/기상은 같은 차체·사지의 낮춤/접기이며 새 fall/rise 원화가 아니다.

산/망 도형은 실제 해당 attack cue에서만 재생하며 장치 소실/기능0이면 표시하지 않는다. 실제 caster→target 거리로2/3칸 등 대상 투영까지 이동한다. 포획망은 교차 평행선의 격자로 표현한다. 분사구·망 발사점은 원화에 확정된 물리 muzzle이 아닌 방향별2D 표시 가정이다. 범위·효과·소모·UID는 Core가 결정하고 이 렌더러는 바꾸지 않는다. 실제 `cullerCooling`을 읽어 기존 차체에 느린 vent 선의 명암을 표시하며 새 냉각 원화나 게임 시간 진행으로 세지 않는다.

## 위치·접지·자산 수명

root는 `viewPos*16+(8,14)`와 정확히 같다. 별도 조향/논리 위치 이탈/일반 공격·피격 root 튀김을 더하지 않는다. 이동 거리로 두 tripod를 교대하며 위협받는 접지는 들린 발의 착지를 마친 뒤 옮긴다. 정상6drive 표현에서 최소3접지를 유지한다. 접지 world anchor/epoch는 고정한다. 공중 착지 목표는2D reach envelope 안에 계획하며 raw nominal/선택한 landing을 분리한다. 완전히 접힌 링크의 작은 제외 원을 우회하는 공중 곡선도 raw 후보와 실제 요청 ankle을 함께 남긴다. IK가 clamp한 end와 요청 goal은 다른 필드이며 오차를0으로 덮어쓰지 않는다.

4방향은 각각 독립 source/layout이다. 방향 변경에는 새 표시 접지 owner와120ms 혼합을 쓰며 연속3D yaw나 방향 전환 전후 동일 접지의 연속성을 주장하지 않는다. 현재 시야의 비벽 칸 mask가 몸·발·FX를 가리고 같은 mask/실제 alpha가 포인터 선택에 쓰인다. map/모델/title 정리에서 표시 객체와 mask를 해제하며 shared atlas texture는 파괴하지 않는다. 선택 로더는 Culler를 쓸 때만4원문을 요구한다.

## 확인한 것과 한계

- `test-results/autonomy-v379/culler-contract-final/audit.json`:4facing 독립1520경로 표본, 실제 supplied root 동일, 도달/접지 목표 차0·동일epoch anchor 변이0, 최소3정상접지. 고정2D 링크오차3.56e-14 이하, source pin산술오차7.11e-15 이하, 두 낫 목표 산술오차1.78e-15 이하. 착지 nominal의 최대 계획 보정2.267표시px다. PNG CRC/24crop·잘못된 소켓 거절·선택4sheet도 확인했다.
- `culler-preview-r2/audit.json`: 실제 DOM138상태에서4facing/0·.5·1·2배/직선·대각 반전/정지·재출발/각6drive소실·motor0/좌우낫4단계·중단/한blade소실/산·망·냉각·사망·기상/픽셀hit·시야mask를 관찰했다. browser errors0, root/도달/안정접지 drift/anchor 변이0, 최소3정상접지다.
- `culler-fx-final/audit.json`: 최종2/3칸 FX/탱크 소실/픽셀·mask만 별도 실제 DOM10상태로 확인했다. 앞 이동 검사를 다시 실행했다고 세지 않는다. 실제 net PNG에서 평행 격자가 보이는 것을 직접 확인했다.
- 1차 `culler-preview-r1`의119관찰과 실행 source/초기 layout/PNG를 보존했다. 옆면 far knee가 차체 위로 솟는 문제는 원문을 바꾸지 않고 LEFT/RIGHT far bend.y를 아래로 바꿔 해결했다. windup PNG 저장 뒤120ms contact를 기다린 관찰은 timeout했다. 두번째는4단계를 먼저 관찰하고 별도 실제 버튼 공격에서 PNG를 찍었다. PNG는 RAF가 계속 도는 화면이며 한 프레임 동결은 아니다.
- `records/geometry-r1-failure.json`에는 공중 후보가 완전 굽힘 제외 원에 들어가0.225861px 초과한 최초 실패를 남겼다. 이후 공중 곡선만 우회했고 접지 anchor를 옮기지 않았다.
- 직접 본 장면은 r1의4방향, r2 LEFT/RIGHT·양낫 contact·dead, 거리 보정 r3 acid/net, 최종 net이다. 원문4장과 v377 initial-clean-3x도 직접 대조했다. 나머지 저장 PNG를 모두 직접 보았다고 세지 않는다.

수치와 장면은 제한2D 연결·표현 검토다. BACK의5appendage 역면, 발의 toe/heel·밑면·진짜 지면, 가려진 hip/shoulder 축, 낫의 진짜 안쪽 절삭날은 검증되지 않았다. source pin은2D graphic 관측점이며 물리3D 관절이 아니다. 차체에 baked된 센서·탱크·안테나는 독립 탈착 원화가 없어 상태 표식으로 구분한다. 전체3m 몸의 지도 점유, 자기 충돌/질량·중력 안정·동역학과 실제 시체 원화도 여기서 완성됐다고 세지 않는다. 논리 점유는 현재 Core의 한 칸이다. 부분 반전은 반대 면/새 원화가 아니다.

## 수동 정화액 소품과 공개 도감

부모가 제공한 `FxEvent.attack.prop={uid,def}`에는 현재 glaive를 추측하지 않고 actual tank의 `equipmentSpec`/slot0/UID를 보존한다. MapRenderer는 `use`와 실제 소품 프레임의 기울임을 표시하며 같은 턴의 일반 use observation이 이를 덮지 않게 한다. debug action의 `propUid/propDef`가 원래 물품을 보존한다. 이 동작의 실제 게임 입력/소모 검증은 부모 Native 범위이며 개인 Culler viewer 통과와 혼동하지 않는다. prop 없는 기존 공격은 그대로다.

`public/artbook/culler/`는 실제 게임과 같은 CullerView/CullerMotion/walk-motion을 쓰며 exporter로 빌드했다. 원문4PNG의 public 출력 SHA를 확인하고 provenance에 공유 모듈 SHA를 기록했다. 도감 root는 Culler 차체 원문 카드에서 이 조립 viewer로 연결한다. public 전용24frame/1char fragment는 게임 등록값과 같고 전체 sprite manifest를 불필요하게 번들하지 않는다. entry JS가1,797KB에서65.78KB로 줄었다. 새 아트를 만들거나 Core를 복제한 것이 아니다.

대상 ESLint와 자체 계약 검사를 실행했다. private Vite6398/브라우저는 각 관찰 finally에서 종료했다. 공용 main build, 게임 Native, Core·콘텐츠·타입·저장·root 문서/버전·push는 부모 담당이며 자식이 실행/통과했다고 기록하지 않는다. 최종 공개 viewer 빌드만 부모의 후속 명시 지시에 따라 실행했다. `render-integration.json`은 담당 파일의 point-in-time SHA이며 전체 출시 승인이 아니다.
