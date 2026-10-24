# v358 파종기 방향별2.5D 배치 분석

2026-10-24. **새 픽셀/이미지 생성0, 게임/테스트 실행0, 메인 활성0, 완성된4방향 리그 수락false**다. v357 LEFT/RIGHT/BACK 원문3개와 canonical v335 idle/work 원문2개를 직접 열었다. 부모의 현재 `articulated-gait.ts`는 읽기만 했고 import/실행/수정하지 않았다.

부모 FRONT r4의125관찰·접지 drift0·도달오차≈5.62e-15·가정COM 지지이탈0은 **부모가 제공한 정면 결과**로만 보존했다. 이번 분석에서 재현하거나 다른 방향 수락으로 확장하지 않았다. 현재 물리 링크17.5+17.5, `screenX=x`, `screenY=(groundY-z)*SQRT1_2`, front body pivot[395,428]/scale.07, hip높이23/√.5·ankle높이4.62/√.5가 검토 시점의 FRONT 가정이다.

## 실제 source·관측 좌표

`source-observations.json`에 방향별 실제 sourceSize,4영역 crop, 핀 source/crop/정규화 좌표와 알파, 실제 painted 축, sole 좌표/벡터를 기록했다. 원문은 v357에 그대로 있으며 SHA는 `provenance.json`에 고정했다. **BACK은1355×1160**이라 다른1254정사각 시트와 같은 칸 계산을 쓰면 안 된다.

| 방향 | 실제 크기 | 차체에서 실제 보이는 painted boss |
| --- | --- | --- |
| LEFT |1254×1254| aft large[726,419]1개 |
| RIGHT |1254×1254| aft lower[139,446], aft upper[107,376], forward small[578,376]3개 |
| BACK |1355×1160| left[177,378], right[660,375]2개 |

이것들은 **그림에 보이는 금속 캡/보스 중심**이다. LEFT는 sensor/하부 장갑이 다른 앞 모서리를 가리고, RIGHT는 큰 뒤 캡·작은 상부/센서 브래킷의 기능 대응이 확정되지 않았으며, BACK도 near hind인지 far fore의 베어링인지 판별되지 않았다. 따라서 **LF/RF/LH/RH의 physical hip 관측/캘리브레이션은 전 방향 모두null**로 유지했다. 보이는 보스 수를 확인된 물리 힙 수로 바꾸지 않았다.

차체/upper/lower/foot의 전체 visible pin/boss21개를 원문에서 독립 확인했다. radius12 사각영역의 최저 alpha는252–253이며 중심 투명 구멍이 없다. 핀/축이 불투명하다는 것과 실제3D 축/다리 소유가 증명됐다는 것은 구분한다. 각 링크의 source painted 축도 다르므로 중앙·수직을 가정하지 않는다.

| 방향 | upper source vector | lower source vector |
| --- | --- | --- |
| LEFT |[19,351]|[22,365]|
| RIGHT |[40,362]|[7,389]|
| BACK |[8,312]|[17,365]|

## native 크기와 그래픽 앵커

`directional-layout-proposals.json`에 탱크 neck·센서/벤트·중앙 파종구처럼 실제 보이는 **그래픽 대응점**을 약±6source px의 수동점으로 기록했다. 이 점은 원화 크기/방향/차체 origin 비교에 쓸 수 있지만 힙으로 쓰지 않는다. LEFT의 옆 벤트·센서, RIGHT의 반대 센서/벤트, BACK의 뒤 벤트/이중 탱크 배치는 canonical 방향과 구분된다.

진단에서 .07을 강제 설정이 아닌 **동일한 기준 배율의 시각 비교**로만 놓았다. 그때 legless body bbox는 LEFT약50.54×41.09px, RIGHT48.51×41.16px, BACK42.14×39.97px다. 기존 canonical full-machine은 약57×50–51px이며 다리까지 포함하므로 서로 같은 bbox라고 맞추지 않는다. 차체 높이/탱크·재질이 같은 크기 군으로 읽히는 부분은 있으나 root/hip/가림까지 맞춰진 몸은 아니다.

중앙 파종구 끝을 [0,-9]에 놓는 그래픽 trial과 body.065–.075 범위를 명시했으며 물리 힙/동일3D root 캘리브레이션은false다. 부모가 원화의 비균등 왜곡으로 핀을 억지로 맞추지 않는 계약을 유지한다. 부분 scale이나 source drawing이 바뀌었다고 주장하지 않았다.

## FRONT skeleton yaw만으로 해결되지 않는 근거

`projection-calibration-analysis.json`은 검토한 FRONT 값과 코드 SHA, 순수Python의 **이상적인 yaw 투영**을 기록한다. client/game 코드를 실행한 검사가 아니다. canonical LEFT/RIGHT에는 앞 광학부와 옆 벤트가 함께 보이므로 방향 이름이 정확한±90도 정사영 카메라를 증명하지도 않는다.

- **LEFT:** 기능 소유 미확정 캡1개만으로는 translation을 조정해 한 점을 언제든 맞출 수 있다. 그것이4hip·카메라 yaw·body origin/scale을 해결했다는 증거가 아니다. 숨은 앞/반대 모서리에는 추가 관측 대응이나 명시적 설계 가정이 필요하다.
- **RIGHT:** aftLower[139,446]와 forwardSmall[578,376]를 같은 측면의 fore/hind로 가정하면 .07에서 두 점 거리는약**31.12px**다. 현재 FRONT 같은쪽 fore→hind의 물리XY 간격은약**7.49**이고 어떤 yaw의 화면 간격도 그것보다 커질 수 없다. 따라서 **그 소유 가정에서는** translation/yaw만으로 맞지 않는다. 두 보스의 소유가 실제로 그 쌍이라는 뜻은 아니다. 현재 숨은 앞뒤 깊이 가정과 기능 대응을 새로 캘리브레이션해야 한다.
- **BACK:** 두 painted body cap 간격은 .07에서약**33.81px**다. FRONT가 가정한 후지 hip쌍은20, 앞 hip쌍은29.82다. 앞/뒤 어느 베어링 평면인지 모르는 상태에서 어느 쌍에 맞춘다고 선언할 수 없다. 두 쌍에 각각 맞추는 산술 scale(.0414/.0617)은 진단일 뿐 native 크기를 희생해 수락한 설정이 아니다.

FRONT의 뒤 힙/바닥 깊이는 한2D 시제품에 맞춘 가정이었다. 링크 도달·접지 성공과 별개로 다른 원화의 물리3D 신체가 증명된 것은 아니다. 방향별2.5D 캘리브레이션에서 그래픽 body 앵커, 관측 보스의 명시적 역할/장착 평면, 숨은 hip 설계 가정, 같은 시점의 source 크기·카메라를 분리해야 한다.

## sole 오프셋은 방향별 계약

실제 핀→근사 하단 rim 힌트는 다음과 같다. sole는 원문의 근사 불투명 하단 chord이며 압력/바닥 충돌 증거가 아니다.

| 방향 | ankle→sole 원문 | scale.03 표시 | 수직4.62만 유지하는 균일배율 예시 |
| --- | --- | --- | --- |
| FRONT 참고 |[11,154]|[.33,4.62]|.03|
| LEFT |[25,154]|[.75,4.62]|.03|
| RIGHT |[22,180]|[.66,5.40]|.025667|
| BACK |[13,154]|[.39,4.62]|.03|

FRONT의 x보정.33과 높이4.62를 그대로 복사하면 LEFT는 x.42, RIGHT는 x.33/y.78, BACK는 x.06만큼 시각 sole가 달라진다. 원문 그림의 ankle와 실제 접지/3D ankle를 맞추는 것은 별도 보정이다. RIGHT를 .025667로 줄이는 예시는 foot bbox도약11.73×7.29px로 바뀌므로 자동 정답/승인이 아니다. 한 물리 높이를 유지할지, source-native 모양/크기를 우선할지, 렌더 변환의 허용 범위를 부모의 분리 시제품에서 결정해야 한다. 물리 ankle 높이가 실제로 방향마다 달라진다고 관측한 것이 아니다.

## 면·가림·공유 원본 수

`bearing-surface-review.json`은 **금색 캡이 양면 bearing에서 기계적으로 가능함**과 **진짜 후면이 관측/제작됐는지**를 분리했다. through-shaft/양쪽 덮개가 있으면 비슷한 캡이 양면에 보일 수 있으므로 금색 원형 캡 자체가 불가능한 후면이라는 증거도 아니다. 반대로 그 가능성은 실제 rear surface/반대 bearing/숨은 축이 새로 그려졌다는 증거가 아니다. `trueRearJointSurfaceObserved:null`, opposite face/null, 실제3D축/null을 유지했다. 대칭 hardware를 채택하려면 별도의 명시적 설계 가정과 source/가림 검토가 필요하다.

이상적인 회전에서 가까운 그룹은 LEFT LF/LH, RIGHT RF/RH, BACK LH/RH이고 먼 그룹은 반대다. 이는 **소유/카메라 캘리브레이션 전의 방향별 가림 제안**이다. 현재 FRONT `far=RH/LH`를 전 방향에 고정하지 않는다. 기본은 먼 다리/발→차체 알파→가까운 다리/발이며 실제 투영 depth/교차 순서를 부모가 판단해야 한다. 차체의 고정 보스와 공유 proximal cap의 겹침/이중 ring, 접힌 보정도구/중앙 파종구를 다리로 오인하지 않는 가림이 중요하다.

v357은 방향당4영역, 총**12고유 source 영역**(3body+9link/foot)이다. 한 방향을 보여 주는13sprite view는1body+4upper+4lower+4foot의 **인스턴스 수**다. 세 패널이면39인스턴스를12영역에서 빌리는 것이며39새원화/프레임이 아니다. v354 FRONT4영역은 별도다. 여기서 만든 runtime instance/새 보행 프레임은0개다. 고정 길이 lower·한 면의 조명·미제작 발밑면/반대 ankle 제약도 유지했다.

## 직접 연 진단과 범위

독립 진단은 필요한3장만 만들고 전부 직접 열었다.

1. `diagnostics/native-body-comparison-trials-x4.png`: canonical idle/work의 실제 등록 변환과 새 **legless body-only .07 trial**의 표시 크기. BACK work의 기존 등록flipX는 진단 표시 변환만 적용했고 원문은 바꾸지 않았다.
2. `diagnostics/source-axes-and-sole-vectors.png`: 실제12source crop,21painted cap/축과 방향별 sole. BACK 실제 sourceSize도 표시했다.
3. `diagnostics/ideal-front-skeleton-yaw-projection.png`: 현재 FRONT 가정의4yaw 선도이며 source 핀 캘리브레이션·조립·게임 화면이 아니다.

Pillow/NumPy는 원문 읽기/알파와 명시된 표시 진단만 사용했다. 새 원문 생성/편집·메인/src/public/Core/Def/dist/publication 변경·빌드/테스트/게임/Native/commit/push는0이다. 부모가 구현 중인 격리13sprite view를 대신 실행하거나 완성되지 않은 실제4방향 리그를 승인하지 않았다.
