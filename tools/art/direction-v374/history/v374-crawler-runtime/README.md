# v374 관로 지네 격리 2D 런타임 조립

v372의 원문6영역을 그대로 읽어 조립하는 standalone Canvas시제품이다. 메인·Core·publisher·공유dist를 읽어 실행하지 않았다. image_gen추가0, 신규원화0, 기존PNG편집0이며 source copy는 SHA `d79e58402ddfe288399997088a83bd85ee08d171e83b7dcfc342fdaf49d29d2f`의 바이트동일 복사본이다. `source-provenance.json`에 원래 PNG/관측계약 경로와 이전23파일 SHA를 남겼다.

## 조립과 소유

`site/rig.js`는 Head 뒤 거리 경로를 따라 **Segment1..7 + TailSegment8**을 배치하고, 각 체절의 **Segment{1..8}LeftLeg/RightLeg**를 안정된 ID로 유지한다. 8체절/16다리, leg owner는 대응 Segment 또는 TailSegment8이다. 머리는 닫힘/열림 중1개만 그린다. 프레임마다 Head1 + body8 + upper16/lower16 = **41표시 인스턴스**이며 source6영역/기존원문1PNG의 공유다. 새 원화41개나 authored8체절/16족 보행 프레임으로 세지 않는다.

body sourceScale .05, pitch11.2du, upper8.5du/lower8.25du, stride14du 등은 조립용 **임의2D표시 단위(du)** 가정이다. 게임 지도 타일/미터/실제 전체 배율이 아니다. 몸 경로는 이동거리 history를 따라가며 head 명령은 즉시 바뀌되 실제 이동방향은 최대곡률 .095rad/du로 돈다. 따라서90°명령은 곡선 전환이며 실제 게임의 즉시 방향전환을 이미 연결한 것이 아니다.

각 발은 stance동안 world anchor를 고정하고 거리로 회복을 시작·진행한다. 양수 속도에서 정지하면 이미 회복 중인 발만 시간으로 마무리하고 새 회복은 시작하지 않는다. 속도0은 이동/회복/시뮬레이션시간 전체를 동결한다. 재출발은 같은 scene owner와 anchor epoch를 유지한다. 회복 궤적은 overhead2D곡선으로, 실제3D발 들림/배면을 그렸다고 하지 않는다.

`pinMatrix`는 상부 양끝 관측cap과 하부 근위→관측 hookTip의 투영 축을 target joints에 맞춘다. **요청 foot/anchor와 IK가 clamp한 end는 별도로 보존**한다. end가 닿지 않으면 원래 foot대비 reach error와 실제 그린 hook대비 stance anchor drift가 남는다. foot=end로 덮어서 오차를0으로 만들지 않았다. source matrix로 그린 cap/hook좌표를 DOM관찰 도구가 독립적으로 다시 계산했다.

하부 실제 ankle축은 v372에서 추정됐으므로 이를 확정된 관절로 사용하지 않았다. 대신 직접 관측된 free hook tip을 **2D 접촉 대리점**으로 쓴다. 몸판 소켓/목/overlap 위치와 삽입 깊이·3D축은 여전히 가정이다. 좌측 표시반전은 같은 upper/lower원문을 source축의 수직방향으로 반사하는 것으로, 반대 면/좌우 원화를 새로 그린 것이 아니다. 회전·반전과 함께 그려진 하이라이트도 돈다.

## 실제 DOM 관찰과 경계 보정

전용 port6394/site만 구동해 실제 버튼/select/checkbox를 조작했다. 위치나 발을 외부 API로 주입하지 않았으며 읽기는 `#audit-json`, 소유표16행과 canvas스크린샷이다. 1차 `observations/initial`에는 정지/직선/대각/급좌·급우회전/0·.5·1·2배/재출발/턱전환/표시반전의195표본과10스크린샷을 보존했다.

1차 집계의0배/정지 기준에는 DOM의90ms audit갱신 전 **이전 speed2/runningtrue 표본**이 섞였다. 그 실패 집계와 raw는 그대로 남겼다. 이후 관찰기만 실제DOM상태 확인→2rAF→기준→대기→2rAF→after 방식으로 보강했다. `observations/boundary-confirmation`에서 이 경계만 짧게 다시 관찰했으며 rig의 위치/foot/anchor/end를 수정하지 않았다. 전체 시나리오를 반복하지 않았다. 초기 실행관찰기 원문도 `initial/inspect-runtime.initial.mjs`에 있다.

| 확인 | 실제 기록 |
|---|---|
| 8body/16leg 소유 | 195표본 위반0, 소유표16행 |
| source matrix의 upper근위/무릎접점/hook 불일치 | 최대 약5.73×10⁻¹⁴du |
| 그린 hook대 요청 foot의 도달오차 | 최대2.93×10⁻¹⁴du |
| 같은 contact epoch의 실제 그린 hook drift | 최대5.73×10⁻¹⁴du, anchor mutation0 |
| stance 수 | 관측 최소8/16; 실제 힘/무게 안정 증명 아님 |
| speed0 DOM확인 후1초 | distance/time/root/hook/anchor 변화 모두0 |
| runningfalse확인 후 정지 | root변화0, 회복발4개가 마무리되어12→16stance |
| 정지 전후 같은 epoch stance12발 | 실제 hook drift0/anchor mutation0 |
| 회복 완료 뒤 안정16발 | hook/root 변화0 |
| 재출발 | 동일 scene owner, 거리 계속 증가, anchor mutation0 |

정지 직후 모든 발을 합친 hook변화7.77du는 **회복 중이던4발의 착지 이동**이다. stance12발의 미끄러짐으로 해석하지 않는다. 이후16발 안정구간의 변화는0이다. 0배 기준과 stop의 권위 있는 기록은 `boundary-confirmation/report.json`이며 초기 잘못된 경계 값은 통과로 고치지 않았다. `same-epoch-stance-analysis.json`은 저장된 두 snapshot에서 실제 stance만 따로 읽어 비교한 근거다.

정지·대각·빠른회전·열린머리·clean·경계보정 후 착지 PNG를 직접 열었다. 정확히 직접 본 파일은 `initial/01-rest.png`, `03-diagonal.png`, `06-fast-turn.png`, `08-open-head.png`, `10-clean.png`, `boundary-confirmation/settled-acknowledged.png`다. 체절/다리 연결은 읽히지만 안쪽 급곡선에서 다리끼리/몸판 아래로 겹치는 표시가 있어, 자체 충돌/가림과 실제 지형 지지는 미완성으로 남긴다. 숫자가 작다는 사실만으로 출시 미술·물리 승인을 하지 않는다.

두 관찰기는 자기 전용 python server/browser를 `finally`에서 닫았다. lifecycle JSON을 보존했고 port6394의 해당 server가 없음을 마지막에 확인했다. 브라우저 오류0이다. Full/World/실제게임/빌드/전체검사는 실행하지 않았다.

## 코드와 남은 범위

- `site/rig.js`: 거리 history,8체절/16다리 소유, 거리 회복·stance anchor,2D고정길이IK와 pin similarity.
- `site/workbench.js`, `site/index.html`: 실제 DOM 제어,6source drawImage/행렬표시,실제 소유/오차 JSON·16행표.
- `inspect-runtime.mjs`: 전용 server/browser와 공개 DOM 조작·독립행렬관찰. 새 관찰에는 반드시 고유 인자를 주어 기존 `initial` 기록을 덮지 않는다.
- `inspect-boundaries.mjs`: 실제 상태 ack/2rAF의0배·정지 경계 관찰 코드. 동결된 boundary기록은 그대로 보존한다.

손으로 볼 때는 별도 프로세스에서 `python3 -m http.server 6394 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v374-crawler-runtime/site`로 읽고 끝나면 그 프로세스를 종료할 수 있다. 이 제출에서는 관찰과 server종료를 끝냈다. 부모는 authoring으로 바이트 복사/등록 전에 별도 통합 판단을 한다.

Core Body/각16leg capacity·체절손상·머리연결 앞부분 생존, 실제 독·먹이·천장그립·기습낙하·휘감기·행동 취소/사망, 게임renderer와 이벤트·TU, 실제 지도벽/긴몸점유/경로충돌/수중·경사·자체충돌·물리3D질량과 접촉, 원문 상대축/배면·다른 시점 및 전체 게임배율은 미완성이다. 키보드/반대방향/zoom은 UI에 있으나 이번 별도 추가 관찰 대상으로 넓히지 않았다. 등록·메인·기존staging·publisher·게임상태 변경·build/test/push는0이며 source/런타임 승인과 출시 승인은 false다.
