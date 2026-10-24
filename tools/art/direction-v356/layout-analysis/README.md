# v355 파종기 FRONT 리그 배치 분석

2026-10-24. **새 원화/이미지 생성0, 원본 PNG 변경0, 런타임/출시 수락false**다. v335 정면의 투영 기준과 v354 실제4부품을 읽기 전용으로 분석해 부모 Pixi/3D→정사영 시제품의 근거와 가정을 분리했다. 기존 staging과 메인/src/public/dist/Core 코드/publication은 변경하지 않았다. 게임·빌드·Core/World·Native·브라우저·commit/push 실행0이다.

## canonical 정면의 관찰값과 추정값

`sower-idle-v2.png`, `sower-work-v1.png`, `sower-walk-down-v2.png` 원본을 다시 직접 열었다. 실제 앞 방향은 idle 첫 행, work 마지막 행, front-walk2×2다. 앞12개 source frame을 문맥으로 대조했고 **idle0/work0/walk0 3개에만 상세 랜드마크**를 기록했다. 12개 전부를 새 핀 등록했다고 주장하지 않는다.

`canonical-front-observations.json`에서 **LF/RF는 인물의 좌/우 앞다리**이며 FRONT에서 LF는 viewer-right, RF는 viewer-left다. 앞 힙의 원형 황동 핀은 보인다. 반면 무릎은 원형 축이 드러나지 않아 **보이는 피스톤 출구를 투영 관절 랜드마크로 추정**, 발목도 보이는 collar/연결부의 추정이다. 뒤 LH/RH 힙은 모두 `null / occluded`다. 뒤 발판의 일부 하단 rim은 보이지만 투명 원화에는 바닥이 없으므로 그것을 실제 압력/3D 접지 증거로 쓰지 않았다. 원본별 수동점 허용 오차는약3–6px다.

예를 들어 idle0의 원래 시트 픽셀은 다음과 같다.

| 항목 | RF / viewer-left | LF / viewer-right |
| --- | --- | --- |
| 보이는 앞 힙 핀 | [130,240] | [255,240] |
| 추정 피스톤 출구 | [109,286] | [278,287] |
| 추정 발목 collar | [103,325] | [285,325] |
| 근사 앞발 하단 rim | [103,341] | [284,342] |
| 대응 뒤발의 부분 rim | RH [127,318] | LH [258,318] |

비교용 원점[196,342]는 앞발 하단의 근사 평균 투영점이며, 기존 authoring ground[196,339]와 따로 보존했다. 확대 원화에서 실제 점 위치와 그 분류를 다시 확인했다. work와 기존 walk는 자세/원문 해상도·모델 폭 차이가 있어 같은 물리3D 측정값으로 강제하지 않았다.

보이는 앞 힙→피스톤 출구→발목 랜드마크로 계산한 **화면상 lower/upper 비는약0.72–0.86**이다. 실제 회전축/3D 링크 길이를 측정한 것이 아니며, 가림·각도·foreshortening 및 원본 모델 차이가 포함된다.

## v354 원문 핀·축의 독립 검토

v354 원문 `sower-front-rig-components-v1.png`를 직접 열고, 확정 `joint-registration.json`을 읽었다. 원문 SHA는 `01c034f0dc67699cabc91b55798013446ddbb4fb281fbbdbcb452faa4153dff2`다. v355에서 새 PNG 원화나 복사본을 제작하지 않았다.

| 실제 원문 지점 | source 픽셀 / 축 |
| --- | --- |
| 앞 RF/LF 차체 핀 | [182,428] / [608,428] |
| upper proximal→distal | [995,238]→[985,563], vector[-10,325], 길이325.154px |
| lower proximal→distal | [358,764]→[375,1132], vector[17,368], 길이368.392px |
| foot ankle→sole hint | [944,1011]→[955,1165], vector[11,154] |

독립 알파 분석에서 핀 중심 주변 radius12 사각형의 최소 알파는 앞 차체252, 위 바깥 boss251, upper/lower/foot252다. 금속 캡 안쪽에 축이 있고 중심 투명 구멍은 없다. **완전alpha255라고 바꾸어 쓰지 않았다.** 원문 핀은 세로축에 정확히 정렬되지 않으므로 texture centre/수직 가정으로 붙이면 어긋난다. 실제2D 축을 기준으로 `rotation=atan2(targetDelta)-sourceAxisAngle`을 적용하는 근거가 된다. 이 cap의 표면이 보인다고 실제3D 회전축/후면을 알아낸 것은 아니다.

차체의 **[160,374]/[636,373] 위 바깥 boss는 보인다. 그러나 뒤 힙 역할은 미확인**이다. 이 점을 LH/RH의 관찰 핀으로 바꾸지 않았다. `v354-pin-review.json`은 실제 보이는 지점·알파와 역할 가림을 분리한다.

## 배치·기부·가림 제안

`layout-proposal.json`의 좌표는 FRONT 화면에서 x오른쪽/y아래, 근사 앞발 바닥을[0,0]으로 둔 **표시 가정**이다.

| 항목 | RF/RH | LF/LH | 근거 구분 |
| --- | --- | --- | --- |
| 앞 힙 | RF[-14.91,-23] | LF[14.91,-23] | 실제 source 앞핀을 body배율.07로 매핑한 제안 |
| 뒤 힙 | RH[-10,-27] | LH[10,-27] | **가려진 내부 모서리 추정**, observed source=null |
| 중립 앞 sole | RF[-21,0] | LF[21,0] | canonical 보이는 rim과 폭을 맞춘 제안 |
| 중립 뒤 sole | RH[-15,-6] | LH[15,-6] | canonical 부분 뒤 rim의 폭/깊이에 맞춘 제안 |

차체 pivot은 실제 앞핀 중점source[395,428], 제안 표시 위치[0,-23], body배율.07이다. 따라서 새 차체 탱크 상단은 대략-48px, 아래 파종구는약-9px로 기존 정면 높이와 가까워진다. foot배율.03이면 실제 ankle→sole source[11,154]는 표시[.33,4.62]가 된다. 이 수치는 바닥 높이/충돌/게임 Native 수락이 아니다.

제안 가림 순서는 **뒤 LH/RH 다리 → 차체 → 앞 LF/RF 다리**다. 뒤 proximal 부분은 차체 알파 뒤에 가려지고 뒤 발판은 부분 노출되는 것이 정상이다. 모든 힙/다리가 독립적으로 보이게 만들지 않는다. 앞 upper의 작은 proximal cap이 더 큰 차체 boss 위에 겹칠 때 두 ring/외곽이 어떻게 읽히는지는 아직 미수락이다. 작은 접힌 매니퓰레이터와 중앙 파종구는 차체 픽셀이며 구동 다리/접지로 세지 않는다. 고정 FRONT 밖의 회전/부위 교차에는 별도 투영 깊이 순서가 필요하다.

## 두 링크 길이와 부모3D 가정의 분리

`projected-length-comparison.json`은 **화면 평면의 비교 예시만** 담는다. upper source배율.037/lower.025이면 화면상 길이12.03/9.21px, lower/upper=.766이다. 위 제안 중립 앞 sole에서 발목 offset을 뺀 힙→발목 거리는 RF19.47/LF19.26px로 합21.24px 안에 들어온다. 이는 source raw부분과 canonical 랜드마크 비율을 비교하는 예시이며 실제 부모3D 설정으로 강제하지 않는다. 처음 전달한 .033/.028도 단순 화면 길이의 초기 예시였고 물리 길이 관측값이 아니다.

`parent-3d-prototype-assumptions.json`에는 **부모가 전달한 가정**을 별도로 보존했다: fixed3D upper/lower 각15, groundY와 heightZ 투영.707, hipZ32.53·ankleZ6.54, stride20·stance duty.75. 그 단순 앞다리 예에서 수직차25.99, x차6.09, stance반여행7.5를 합친 거리는약27.73으로 링크합30보다 작다. **관찰/구현/재생 검증이 아닌 명목 수치**다. 발 source xoffset·몸 기울임·뒤 힙·다른 이동방향·실제 경로를 넣은 최대 reach는 부모가 다시 판단해야 한다. canonical 화면 비율이나 source 핀 길이로 물리15+15를 증명하지 않았다.

모든 부품을 PNG가 같다는 이유로 같은 배율에 놓으면 원문325/368px 링크가 지나치게 길어진다. source scale/2D 투영/물리3D 길이는 구분해야 한다. lower는 고정 중간 extension 원문 하나이므로 통째로 늘렸다 줄이는 표시를 실제 피스톤 stroke 원화로 세지 않는다.

## 4발 지지·한발 회복 제안과 조립 한계

`gait-and-support-proposal.json`은 normalized cycle에서 LH[0,.25)→LF[.25,.5)→RH[.5,.75)→RF[.75,1) 각각 한 발만 회복하고 나머지3발은 stance인 제안이다. 부모의 이동거리/stride에 따라 phase를 진행하고, stance 동안에는 world-ground plant를 유지하여 몸이 움직일 때 발이 함께 끌려가지 않게 한다. 회복은 이전 뒤쪽 release→다음 앞쪽 plant의 부드러운 경로, 낮은 높이 hump를 제안했다. 멈춘 상태에서 보행 시계가 계속 돌거나 발을 중립 위치로 순간 이동시키는 것을 수락하지 않는다.

정지4발의 근사 ground COM hint[0,-3]와 각3발 지지 때 앞/뒤·반대쪽으로 옮긴 **가정 COM hint**를 기록했다. 이 hint들은 제안한 투영 지지 삼각형 내부지만 실제 질량/중력/물리 안정성 계산은 아니다. 차체 그림의 중심을 바닥 COM으로 관측했다고 주장하지 않는다.

핀 접점 자체는 불투명하지만 조립의 최종 가독성은 부모 화면 검토가 필요하다. 공유 source는 **같은 조명/한 앞·위 시점**이며, 축을 회전시켜도 숨은 옆면/관절 면/발밑면 원화가 추가되지 않는다. foot는 미제작 underside를 드러내지 않도록 우선 평평한 상태의 상하 이동만 제안한다. 공유 upper/lower/foot4인스턴스는 원본12개/보행프레임12개가 아니다. v355 새 보행 원본은0이다.

## 실제로 연 진단과 범위

canonical 원문3개·v354 원문1개와 다음 자료를 직접 열었다.

- `canonical-<idle/work/walk>-front0-source.png`3장: 원본 crop의 최근접 확대, 새 원화가 아님.
- `canonical-<idle/work/walk>-landmarks-diagnostic.png`3장: 관찰 힙/추정 출구·collar/부분 sole-rim을 색과 문구로 구분.
- `v354-visible-pins-axis-alpha-diagnostic.png`: 실제 source 핀, 기울어진 축, 역할 미확인 boss와 중앙 sole chord 주석.
- `layout-and-support-wireframe.png`: 표시/지지 가정의 선도이며 부품 조립/게임 화면/새 source art가 아님.

Pillow/NumPy는 원문 읽기·알파와 명시된 crop/주석 진단만 만들었고 순수Python 기하 계산은 게임/Core를 실행하지 않는다. 원문·등록 SHA는 `provenance.json`에 있다. 부모 Pixi 시제품의 실제 효율/가독성/접지·거리/전환·release 수락을 대신하지 않았다.
