# v373 구제기 6다리+2낫 연결 위험 — 짧은 읽기 전용 감사

새 생성0. v373 원문/계약과 현재 공용 `articulated-gait.ts`, `articulated-rig-view.ts`, `rig-owner.ts`, `rig-spec.ts`를 읽었다. 소스 해시는 `records/read-only-code-references.json`에 기록했다. 구제기 전용 런타임을 구현/실행/검증한 보고서가 아니다. v373과 메인 소스 수정0이다.

1. **공용 리그의4발 고정 계약:** `LegId`/`LEG_ORDER`는 LH/LF/RH/RF, swing 순회는 `%4`, View 생성도 네 ID이고 `this.legs.get(id)`가 없으면 표시를 건너뛴다. v373을 이 경로에 데이터만 얹으면 middle pair가 표시/지지 계산에서 빠질 수 있다. 여섯 독립 ID와 지지/도달 제약, view 생성/검사·수명주기를 함께 확장하거나 별도 구제기 owner가 필요하다. 이는 현재 공용코드 사실이며 이미 존재할 다른 전용 구현의 부재를 주장하는 것은 아니다.
2. **여섯 hip·두 shoulder를 그림에서 측정했다고 간주하지 않기:** 원문 boss6좌표는 그래픽 기준점일 뿐이며 물리 DriveLeg1~6 hip과 tool shoulder/3D축은 null이다. 부모2.5D 배치는 추정으로 표기해야 한다. 중간/먼 다리 시작점이 몸 밖으로 나오거나 같은 한 보스에서 겹쳐 자라는지 실제 연결을 확인한다.
3. **기울어진 원문축/둥근 cap 겹침:** drive upper `[820,185]→[744,408]`(-76,223), lower `[1318,141]→[1235,435]`(-83,294), tool upper `[857,620]→[756,868]`(-101,248)이다. crop 중심/세로축이 pivot이 아니다. 근위/원위 핀은 금속 안쪽이며 radius12 최저alpha251~252다. `pinMatrix`는 양끝을 맞추지만 길이방향 투영과 두께가 달라 cap이 납작해질 수 있으므로 극단 압축/관절 접힘의 이음·가림은 눈으로 검토해야 한다. 고정 lower를 실제 피스톤 stretch로 주장하지 않는다.
4. **발 anchor와 지지:** foot ankle `[342,744]`, 보이는 하단 chord `[257,880]→[414,880]`다. 밑면/물리 지면은 미관측이다. 단순 foot texture 위치를 knee에 고정하거나 sourcecrop 높이를 접지점으로 쓰면 발이 뜬다. root 이동 전후 world contact lock, 여섯 발 가림·tripod A/B(또는 명시한 중장비 wave gait), 급회전·정지회복을 검토해야 한다. 4발용 한발씩 순회를6족교대 완료로 세지 않는다.
5. **낫 두 개는 별도 도구:** 공용 `RigArt`/`RigSpec`에는 body/upper/lower/foot만 있고 tool source/pose가 없다. 2낫을7·8번째 지지다리로 넣지 말고 각 어깨→팔꿈치→blade 근위핀 `[1274,597]`으로 연결한다. anatomical right는 정면 viewer-left다. 같은 원문을 반전/공유한다면 실제 팔 소유/피격·손상·선택된 공격 event와 조명 반전을 명시해야 한다. 공용 chassis work프레임 교체만으로 낫의 준비→접촉→후속→회복이 완성되지 않는다.
6. **날·시점·수락 보류:** blade근위부터 끝 `[1296,951]`까지 연결은 보이나 밝은 bevel은 화면 오른쪽 볼록면을 따른다. 안쪽 절삭날은 미확정이다. 6원문은 FRONT한면이고 반대/배면/밑면·side/back 원문0이다. 공용 owner는4방향 spec을 요구하지만 FRONT를네번등록해4방향을 제작했다고 세면 안 된다. 회전 하이라이트/몸 고정탱크 비대칭/다리 미제작 안면과 날의 안전휴대·접촉을 별도 검토한다.

원문 전체 저alpha 잔점과55%셀 점유 미달도 v373에 그대로 남는다. 23표시 인스턴스(1몸+18다리부품+4낫부품)는6고유원문이며 새 보행/공격 프레임 수가 아니다. 이번 감사의 `runtimeAssemblyReviewed`, `sixLegGaitAccepted`, `fullScytheAttackAccepted`, `releaseAccepted`는 모두 false다.
