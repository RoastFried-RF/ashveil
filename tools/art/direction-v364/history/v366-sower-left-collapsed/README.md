# v366 Sower LEFT 최종 낮은 접힘 — 단일 후보

2026-10-24. **image_gen 정확1회·원문1PNG·재생성0**으로 만든 별도 최종 자세 후보다. 센서 LEFT와 비대칭 탱크/네 발판은 유지됐지만 **요청한 캔버스 폭≤55%는 미달(73.44%)**이다. `activationReady:false`, 완전한 endpoint/전환/출시 수락false를 유지한다. 기존 v352 LEFT fall 보류·원문·등록은 변경하지 않았다.

## 먼저 직접 본 자체 자료

v335 `sower-idle-v2.png`, `sower-work-v1.png`, v357 `sower-left-rig-components-v1.png`를 다시 직접 열었다. v352 실제 경로는 `v352-sower-state-art`이며 README/visual-review와 `originals/sower-fall-v1.png`도 직접 열었다. 기존 LEFT fall0..2는 좌향이나3의 센서가 관찰자 쪽으로 돌아와 전체 LEFT4개가 보류된 근거를 확인했다. 그 실패 원문은 생성 입력으로 주지 않았다.

생성 입력은 직접 본 자체 idle/work/LEFT부품3PNG뿐이다. 한 이미지에 하나의 낮고 완전히 접힌 유지보수/정지 기계, 센서 왼쪽, 높은 탱크 위왼쪽/낮은 탱크 위오른쪽, 붙어 있는4driveleg/4pad, 상자 차체·짧은 bellytools·숨은 파종구, 투명 배경과 중앙≤55% 범위를 요청했다. 정확 prompt/인수는 `requests/sower-left-collapsed-v1.json`, 참고/원문 SHA와 도구 경로는 `provenance.json`에 있다. 타 게임 픽셀/트레이싱을 쓰지 않았다.

## 실제 원문 관찰

- 센서가 실루엣의 왼쪽 끝에 길게 나와 왼쪽을 향하고, 측면 vent가 남아 있다. 기존 잘못된 최종 자세처럼 중앙의 대칭 FRONT 얼굴로 돌아서지 않는다.
- 높은 ribbed 탱크는 위왼쪽, 낮고 둥근 탱크는 위오른쪽이다. 두 탱크·호스·상자 차체·회전 센서·접힌 보정도구/짧은 하부 spout의 기본 모델이 보존됐다.
- 4개의 둥근 pad가 구분된다. 센서 아래 pad, 가운데 전경 pad, 몸 안쪽 먼 pad, 바깥 뒤 pad가 있으며 굽힌 갑판/짧은 황동 piston이 붙어 있다. 세 연결 경로는 읽히지만 먼 안쪽 proximal/위쪽과 센서 뒤 일부 hip은 가려진다. **모든4hip/전체 링크가 보인다고 주장하거나 물리 LF/RF/LH/RH 소유를 임의로 확정하지 않았다.**
- 새 여분 다리/다섯째 pad·떠난 부품·큰 몸 손실은 관찰되지 않는다. 파종구와 짧은 보정도구를 추가 지지발로 세지 않는다. 사람·피부·혈흔·노출 신체·전투 장면·실제 바닥/그림자/입자는 보이지 않는다.
- 낮게 접힌 유지보수/정지 기계로 읽히지만 **v3520..2와 이어지는 최종 완전 접힘 높이/정지 자세와 Native 전환 수락은 미완료**다. 후보 한 장으로 전체 fall clip을 승인하지 않았다.

`visual-review.json`에는 센서/탱크/vent/보이는 bearing·belly spout와4pad의 수동 관찰 중심/부분 하단 rim을 원래 시트 픽셀로 남겼다. 근사 오차약±6px이며 hitbox/실제 압력 접점이 아니다. 물리 corner 관측은 모두null, 먼 안쪽 upper 연결 가림을 명시했다.

## 정확 crop·기부와 원문 보존

원문 실제 크기는 **1254×1254 RGBA**, SHA-256은 `3f5a479080c89252cb22c0fd69090c48e41cb3e7807a3437abc77dd3d2ca89e2`다. 보존 PNG는 도구 출력 `/workspace/generated_images/exec-3d56c10c-fecf-46a2-a297-ac8ec7aeaaed.png`와 바이트가 같다. 도구 원문도 삭제하지 않았다.

| 항목 | 원래 시트 픽셀/측정 |
| --- | --- |
| 주요 alpha≥16 bbox |[196,369,1117,969], right/bottom exclusive|
| 주요 실루엣 폭/높이 |921×600 =73.44%×47.85% canvas|
| alpha≥16 여백 left/top/right/bottom |196/369/137/285px|
| alpha>0 연결 주몸 bbox |[192,367,1121,974]|
| 주몸의 faint edge+3px crop |**[189,364,935,613]**|
| 명목 몸 지면 pivot source |**[660,964]**|
| 같은 pivot crop 내부 |[471,600]|

crop은 JSON 사각형만 기록했고 crop PNG로 저장하지 않았다. `frame-candidate.json`의 anchor는[471/935,600/613]다. pivot은 보이는 낮은 pad 띠 아래의 수동 몸 투영점이며 바닥 시뮬레이션/모든4발 접지 증거가 아니다. 예시 배율.061은 crop약57.04×37.39px로 기존 idle 폭을 대략 비교하기 위한 **미적용 수치**일 뿐이다. 같은 탱크 크기·완전 접힘 높이/원래 fall0..2 연결은 부모 검토가 남는다.

alpha≥16의 원본 캔버스 접촉은0이다. 하지만 **alpha1 edge18픽셀**이 있고 낮은 알파1–15는11,252픽셀이다. 그 faint 원문을 지우지 않았다. alpha≥16 주몸 밖은 고립1픽셀뿐이고 alpha≥128은 주몸 밖0이다. 실루엣이 잘렸다고 과장하거나 canvas 접촉이 모든 알파에서0이라고 주장하지 않았다.

폭 요구를 맞추려고 PNG를 축소/패딩 재작성하지 않았다. `analyze-source.py`는 Pillow/NumPy/SciPy로 읽기 전용 알파·영역·해시/JSON만 작성하며 **PNG 저장0, Pillow 리샘플0, 픽셀 편집0**이다. 별도 진단/합성 PNG도 만들지 않았고 보존 원문 자체를 `view_image`로 다시 직접 열어 검토했다.

## 부모 전달 범위

`frame-candidate.json`과 `handoff-contract.json`은 **단일 LEFT 최종 후보**만 설명한다. 기존 v352 LEFT4개를 승인/수정하거나 다른 동작/방향을 채우지 않는다. 남은 판단은 요청 폭 미달을 포함한 후보 수락, 완전한 낮은 최종 자세·같은 모델 높이/크기, 원래0..2와 실제 Native 전환/가림·지면이다. 추가 생성은 하지 않는다.

메인/src/public/Core/Def/dist/publication·기존 staging 수정, 빌드·테스트·게임/Native·commit/push는0이다. 출시 수락false를 유지한다.
