# v338 재까마귀 기본 비행 · 1회 제작/검토

이번 묶음은 **새1PNG/16고유 원본 영역**,4방향×4독자 날갯짓이다. 지시대로 우선 기본 루프를 한 번 생성하고 원본/축소 합성을 검토했다. 기존 정지나 보행/섭식을 비행으로 이름만 바꾸지 않았다. 기존/새 영역의 반전·역순·복사 재등록으로 프레임을 늘리지 않았다. 다른 생물·전서 변형·아이콘·이륙/착지는 추가하지 않았다.

기존 v334의 정지·땅 위 도약 원본과 v337 work를 직접 다시 열어 부리·머리·깃 재질·몸·두 발/날개·꼬리 비율을 대조했다. CANON의 독자 IP/2D 도트 원칙과 베스티어리 §7의 작은 조류·비행/의식 없는 대상 눈 공격 구분을 읽었다. 생성 도구에는 기존 자체 idle/work2PNG만 입력했다. 타 게임 픽셀·트레이싱·외부 이미지는 사용하지 않았다. [source-survey.json](source-survey.json)에 입력/규칙 출처와 v337 전체35파일의 불변 기준선을 남겼다.

## 실제 통과 범위와 제한

각 행은 앞/아래·왼쪽·오른쪽·뒤/위이며 각 열은 **위 정점→수평 힘주기→아래 끝→굽혀 회복**이다. 몸은 실제 공중의 앞으로 기울인 비행 자세이며 두 발은 배 아래로 접혀 있다. 두 날개가 서로 다른 위상을 대신 수행하거나 추가 팔/다리가 생긴 그림을 채택하지 않았다. 뒤에서는 얼굴을 보이려고 옆으로 돌지 않는다. 피해자·먹이·사체·피·배경·고정 바닥/그림자·광원·Z/고도 UI는 몸에 없다.

**원본 간격은 요청보다 좁다.** 뒤향 수평/하강의 알파≥16 실루엣 간격은 최소2px다. 균등 셀을 쓰지 않고 실제bbox와1px 여백으로 등록했다. 이웃 큰 실루엣 유입0, 연결된 알파≥16 몸 픽셀 손실0, 알파≥16 crop 경계 픽셀0이다. 두 crop은 서로 맞닿을 수 있고, 경계의26샘플은 알파8~15의 희미한 원래 안티앨리어싱이다. 넓은 완전 투명 간격 조건을 충족했다고 주장하지 않는다. 이를 불투명 halo라고 오판하거나 픽셀을 지우지 않았다. 원본은 보존했으며 이번 한정된1회 제작에서 재생성하지 않았다. **`active:false`, `activationReady:false`로 부모 검토에 전달한다.**

원본1장,16포즈 차트,0..3각 위상의 기존 idle/work 비교4장, 실제32×32월드px 샘플/4배 확대를 직접 보았다. 접힌 두 발·날개 위상·부리/꼬리/머리 방향·공중 중심·잘림/이웃 털을 확인했다. 작은 축소에서 눈·발가락·미세 깃이 전부 유지되는 것은 아니다. [native-review.json](native-review.json)에 실제로 연 캡처6장과 SHA를 남겼다. 전체 페이지 캡처는 추가 진단 파일이며 직접 검토한6장과 구분한다.

## 배율과 공중 몸 중심

기존 grounded `.045`와 대조해 **새 시트 전체에 `.055` 하나**를 권고한다. 위상이나 방향별로 머리를 맞추려 배율을 다르게 하지 않았다. 머리와 가슴 코어의 가시 투영 사각형을 직접 잡아 [proportion-comparison.json](proportion-comparison.json)에 기록했다. 이는 근사 측정이며 해부학적 픽셀 분할이 아니다. 수평 비행 뒤쪽 머리는 일부가 가려져 기존 서 있는 뒤머리의 가시 폭보다 작다.

[source-centres.json](source-centres.json)의 anchor는 **공중 가슴/몸 중심**이다. 발 지면점·최저 깃털·윙팁·배 아래 접힌 발이 아니다. 실제 비행 고도와 지면 그림자는 부모 runtime이 별도로 공급해야 한다. 논리16px 타일에 대해 최대 펼침 폭은**20.955월드px**다. 전체 그림이 보이는32px진단창을 사용하며 날개를16px셀에 자르거나 각 포즈를 다르게 축소하지 않는다. 실제 맵의 가림/조명·충돌·고도는 이 독립 진단에서 확인하지 않았다.

권고 날갯짓 주기는**400ms**, 느린 검토는800ms다. 비행 이동 거리나 TU를 정하는 값이 아니다. 실제 게임의 자연스러운 속도/경로·전환까지 확인했다고 주장하지 않는다.

## 전달 파일과 통합 사전조건

- [sprites.fragment.json](sprites.fragment.json): 원본1시트·실제1254×1254·정확16crop. `chars`를 덮어쓰지 않는다.
- [flight-loop.fragment.json](flight-loop.fragment.json): 비활성4방향 clip/16공중 중심변환·권고 주기. **현재 runtime CharDef 그대로가 아닌 authoring 조각**이다.
- [source-centres.json](source-centres.json): 원래 시트/크롭의 공중 몸 중심과 머리/몸 가시 투영 사각형.
- [runtime-contract.json](runtime-contract.json): 실제 airborne 상태·경로/지붕·날개 기능·기력/고도·관찰/기억·그림자·이착륙/중단 연결의 부모 담당 계약.
- [install-plan.json](install-plan.json): 원본 바이트 목적 경로와 SHA, 현재 비활성 사유.
- `requests/`, `records/`, `originals/`: 정확 image_gen prompt/인수·자체 입력/SHA·도구 반환 원문/원래 출력 경로. PNG 픽셀/인코딩은 수정하지 않았다. 기존 입력 복사본2장은 신규 원화 수에서 제외했다.

읽은 시점의 `src/client/render/character-motion.ts`는 `flight`를 MotionName/주기/우선순위에 포함하지 않고, atlas의 CharDef도 그 타입을 쓴다. MapRenderer의 실제 airborne 선택/높이/그림자와 함께 의도적으로 연결해야 한다. 기존 보행·섭식·공격을 비행으로 덮어쓰거나 이 원화만으로 공중 면역·이동거리·영양/기력을 부여하면 안 된다. 현재 MapRenderer의 nearest가정에서 정확 crop을 유지하고, 선형 필터/atlas 확장에는 좁은 간격을 다시 검토해야 한다.

## 실행한 확인

Pillow/NumPy/SciPy는 알파·연결 요소·범위·sourceRGBAcrop SHA·기준점·PNG CRC 읽기만 했다. PNG crop 재저장/리샘플·배경 제거·보정은 하지 않았다. 사적 canvas만 진단 크기로 합성했다. 독립 포트6352에서 캡처했고84canvas/브라우저오류0/게임 로드false다. SHA/CRC·16영역/참조·공중 anchor·연결 몸 손실/이웃·v337 불변35파일 검사는 [validation-proof.json](validation-proof.json)에 있다. 원화 의미/움직임 검토를 이 수치로 대신하지 않는다.

```sh
python3 /workspace/.ashveil-planned/v338-crow-flight-art/register-flight.py
python3 /workspace/.ashveil-planned/v338-crow-flight-art/validate-staging.py
python3 -m http.server 6352 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v338-crow-flight-art
node /workspace/.ashveil-planned/v338-crow-flight-art/capture-staging.mjs
```

최종 후보 SHA는 [art-final.json](art-final.json)에 동결했다. 메인src/public/docs/dist/게임state·v337 및 기존 확정 자료를 수정하지 않았고 공유빌드·Full/World·commit/push를 실행하지 않았다. 진단 서버는 검토 후 종료했다. 실제 runtime/출시 수락은 미완료다.
