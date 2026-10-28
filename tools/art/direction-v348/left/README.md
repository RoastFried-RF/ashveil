# v349 잿곰 왼쪽 피격·기상 8자세 보완

부모가 v346 원문과 실패 진단을 직접 본 뒤 허용한 별도 묶음이다. **image_gen 정확히 1회, 새 1PNG·8고유 영역, 추가 생성 0회**다. 위 두 행은 hurt.left 4자세, 아래 두 행은 rise.left 4자세이며 전체 배치는 2열×4행이다. v346의 72제안과 보류 8원문은 그대로 유지했다. 새 키는 모두 `av349_*`이고, 옛 보류 8개를 함께 등록하지 않는다.

자체 v334 idle와 v346 hurt/rise 원문 3개를 같은 모델의 참고로 사용했다. 타 게임 픽셀·외부 이미지·트레이싱은 없다. 정확한 요청과 입력/출력 SHA, 반환 경로는 `requests/`와 `records/`에 있다. 생성 PNG는 반환 바이트 그대로다. Pillow/NumPy/SciPy는 알파·범위·해시·CRC를 읽고 JSON을 작성했으며, 원본 픽셀 수정·마스크·반전·crop PNG 저장·리샘플링은 하지 않았다.

## 원본 분리와 폭 제한

실제 원본은 1254×1254다. 8개 전체 실루엣이 들어 있고, 4px 여백을 둔 8crop 모두 이웃 큰 실루엣 0·연결된 alpha≥16 몸 픽셀 손실 0·불투명 crop 경계 0이다. 균등 셀로 잘라 쓰지 않고 실제 bbox를 사용했다. 개념적 행 경계를 지나는 발도 전체 crop에 온전히 포함된다.

요청은 셀폭 60% 이하였지만 실제 전체 실루엣은 **56.6~67.3%**로 7/8이 초과했다. [원문 격자](diagnostics/source-grid-widths.png)와 [측정값](registration-analysis.json)에 그대로 남겼다. 부모가 원문을 직접 검토하고 전체 분리·무손실 crop·이웃 0을 우선하도록 지정한 기준으로 8영역을 제안한다. 배율이나 마스크로 이 수치를 숨기지 않았으며 추가 생성하지 않았다.

## 동작과 실제 표시 크기

원본, [새 8자세](diagnostics/new-eight-poses-x3.png), 기존 idle·v346 보류·새 .14·새 제안 배율을 나란히 둔 4위상 비교, 실제 native와 원문 격자까지 7진단을 직접 열었다. [검토 기록](native-review.json)에 실제 연 파일과 SHA를 남겼다.

hurt는 앞발/어깨 반동→더 깊은 가슴 압축→지지 안정→사족 회복이다. rise는 낮은 몸의 첫 노력→앞발로 가슴 밀기→뒷부분 올림→안정이며 새로 그린 순서다. 마지막 두 rise 자세는 큰 높이 변화보다 발과 체중이 안정되는 단계다. 왼쪽의 짧은 주둥이·재빛 갈기·굵은 곰 다리를 유지한다. 몸 아래 먼 다리는 일부 가려지므로 모든 숨은 접촉을 확인했다고 주장하지 않는다.

새 원문이 더 커서 같은 .14를 쓰지 않고 **hurt .115 / rise .12**를 clip 전체에 제안한다. 포즈별 크기 조절이나 비균등 늘임은 없다. 부모가 원문과 마지막 위상 비교를 직접 보고 대략 같은 가족으로 검토했으며 실제 Native와 전환 수락은 남았다.

| 비교 | 원래 몸 bbox | 배율 | 표시 몸 폭×높이 |
|---|---:|---:|---:|
| v334 idle.left0 |305×238|.14|42.70×33.32월드px|
| v346 rise.left3 |308×244|.14|43.12×34.16|
| 새 rise.left3를 .14로 표시 |407×268|.14|56.98×37.52|
| 새 rise.left3 권고 |407×268|.12|48.84×32.16|

마지막 기상 자세는 v346보다 **폭 13.27% 넓고 높이 5.85%(2월드px) 낮다**. 기존 idle과는 폭 14.38% 넓고 높이 3.48% 낮다. idle 높이에 맞추는 .12433을 쓰면 폭이 50.60까지 커진다. 한 배율로 종횡비 차이를 동시에 맞출 수 없다. [proportion-comparison.json](proportion-comparison.json)에 각 포즈의 원문/표시 크기와 이 한계를 기록했다. 방향·사지·잘림 실패를 작은 배율로 감춘 것은 아니다.

## 전달과 병합

- [sprites.fragment.json](sprites.fragment.json): 새 1sheet·실제 size·8frame. 원문 설치 제안 경로는 `public/sprites/original/direction-v349/cinder-bear-left-states-v1.png`다.
- [cinder-bear.states.partial.json](cinder-bear.states.partial.json): `motions.hurt.left`, `motions.rise.left`, 새 `frameTransforms` 8개만 깊게 병합한다. 기존 72영역과 다른 방향·idle/walk/swipe/bite를 덮어쓰지 않는다.
- [foot-anchors.json](foot-anchors.json): 원래 시트/crop의 근사 몸 지면 투영점이다. 숨은 발의 실제 접촉점을 만든 자료가 아니다.
- [install-plan.json](install-plan.json)·[runtime-contract.json](runtime-contract.json): Core 상태·손상·접지·전환과 재생시간은 부모가 실제 게임에서 검토한다.

`active:false/activationReady:false`다. 실제 게임 수락 전의 원화/등록 제안이며 손상부위 마스크나 12프레임 밀도를 완성한 것이 아니다. v346의 72개와 새 8개로 상태 80영역을 선택할 수 있고, 옛 보류 8개는 계속 보존 자료다.

PNG 원문/CRC, 새 8고유 crop·참조·clip 배율, 이웃/연결 몸 손실/경계 0, **v346 전체 59파일의 바이트·목록 불변**을 검사했다. 별도 포트6369에서 25canvas·브라우저 오류0·게임로드 false로 캡처했다. [validation-proof.json](validation-proof.json)은 폭 제한 미충족을 warning으로 보존한다. 실제 Core/Native 게임 검증은 하지 않았다.

```sh
python3 /workspace/.ashveil-planned/v349-bear-left-state-art/validate-staging.py
python3 -m http.server 6369 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v349-bear-left-state-art
node /workspace/.ashveil-planned/v349-bear-left-state-art/capture-staging.mjs
```

최종 묶음은 [art-final.json](art-final.json)에 동결했다. 메인 src/public/docs/dist/publication·게임 상태·기존 staging을 수정하지 않았고 빌드·Full/World·commit/push를 하지 않았다. 독립 진단 서버는 검토 후 종료했다.
