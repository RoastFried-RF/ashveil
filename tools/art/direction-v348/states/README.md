# v346 잿곰 상태5동작 · bounded 원문 보존

image_gen **정확5회**, hurt/fall/sleep/rise/work 동작당1원문, 자동 재생성0회다. 새5PNG/80후보영역을 모두 보존하고 **72고유영역/18방향clip만 등록 제안**, hurt.left/rise.left 전체8자세는 보류했다. 반전·복사·보간·fall 역순·idle 이름변경으로 새 원문을 늘리지 않았다. 다른 종/동작을 추가하지 않았다. `active:false`, `activationReady:false`다.

먼저 v334 idle/swipe-v2/bite-v3, v342 좌·우walk, v344 rear PNG6개를 직접 열었다. CANON/베스티어리 §6/캐릭터 동작 스킬·이전 실패 기록을 대조했다. 생성 입력은 같은 자체 모델의 idle·좌/우walk·rear4PNG다. 넓은 어깨/재빛 등갈기·갈색 짧고 넓은 얼굴/주둥이·작은 둥근 귀·짧은 꼬리·굵은 네 발을 기준으로 새 원문을 만들었다. 타 게임 픽셀·트레이싱은 없다.

| 동작 | 생성 | 제안 | 보류 |
|---|---:|---:|---|
| hurt 피격 |16|12|left4|
| fall 무너짐 |16|16|없음|
| sleep 수면 |16|16|없음|
| rise 자력기상 |16|12|left4|
| work 낮은 냄새/섭식 |16|16|없음|
| 합계 |80|72|8|

## 보류의 정확한 원인

보류2방향의 직접 원인은 **완전한 몸을 담는 직사각형 안에 이웃 곰이 들어오는 시트 배치**다. 여백을0으로 해도 다음 픽셀이 들어온다.

- hurt.left raw2/3의 몸bbox는 x945~947의2px띠에서 교차한다. 이웃 alpha≥16픽셀은15/37개다.
- rise.left raw0/1은 x345~351의6px, raw2/3은 x944~953의9px띠에서 교차하며 이웃 픽셀은82/144/147/413개다.

[정확bbox/픽셀좌표](failure-detail.json), [원문행](diagnostics/failed-source-rows.png), [문제픽셀 확대](diagnostics/failed-pixel-zooms.png)를 보존했고 직접 열었다. 이웃 주둥이와 엉덩이/다리 털이 실제 들어온다. 몸을 자르거나 작은 배율·마스크/픽셀삭제로 숨기지 않았다. hurt.left raw0/1 자체는 범위가 안전하지만 완전한4자세clip으로 쓸 수 없으므로 함께 보류한다. 오염직사각형6개와 보류clip8자세를 구분한다.

## 실제 방향·사지·상태 검토

새5원문은 도구가 반환한 원문 표시로 직접 봤고 보존본 바이트 일치를 확인했다. 별도canvas의 동작별4방향×4차트5장을 전부 직접 열어80자세를 다시 봤다. 기존idle과 실제native 및3배 확대, 보류 원문/픽셀 확대까지 직접 확인했다. [pose-review.json](pose-review.json)·[native-review.json](native-review.json)에 실제 본 범위/가림/미수락을 구분했다.

- hurt는 머리·어깨 반동→낮은 압축→안정→원래 자세다. 균형을 잡는 한 발이 잠깐 들리기도 하며 네 발 모두가 매 순간 접지한다고 주장하지 않는다. 후향은 뒷머리/등/짧은꼬리와 뒷발 반동이며 눈/앞얼굴을 만들지 않는다.
- fall은 앞 팔꿈치/무릎 지지가 굽고 가슴·머리·뒤가 낮아져 최종 몸이 바닥 가까이 누운다. 최저 단계는 접힌 먼 사지가 몸에 가려진다. 굳게 선 마지막 그림을 무너짐으로 세지 않았다.
- sleep은 얼굴이 보이는 방향의 눈을 감고 포개진 앞발에 머리를 놓아 낮게 쉰다. 옆보기에서 겹친 다리와 뒷발바닥이 보이고 작은 가슴/머리/발 재정렬이 있다. 앞/뒤는 누운 옆구리가 단축돼 보이며 **몸통 전체 롤각과 가려진 발의 정확한 접촉은 독립 확인하지 못했다.** 일반적인 낮은 수면원화 제안이며 실제 동면/깊은잠 규칙 검증이 아니다.
- rise는 낮은 몸의 첫 노력→앞발로 가슴 밀어올림/엉덩이 낮음→뒷다리로 뒤올림→사족 안정이다. 별도로 생성했으며 fall을 뒤집은 원문/시간 재사용이 아니다.
- work는 네 발의 정지한 몸과 목/낮은 주둥이·작은 턱 움직임으로 냄새/씹기를 표현한다. 먹이·사체·피·바닥·광원을 몸에 굽지 않았다. 실제 섭식량이나 AI 냄새/표적은 부모 Core 담당이다.

노출된 곰 다리/발의 구조와 가림을 검토했고 새로운 사람손·추가 다리·긴 개꼬리·후향의 앞얼굴을 채택하지 않았다. 가려진 네 발 전체 경로를 모두 봤다거나 실제 Core접촉/사지를 검증했다고 주장하지 않는다. 원화는 온전한 몸이며 절단/손상부위 마스크·피/파괴 변형은 없다.

## 원문·crop·기부 계약

실제 원문5장은 모두1254×1254다. `requests/`, `records/`, `generation-results.json`에 정확prompt/도구 인수·자체 입력/SHA·출력 경로·실패/선택을 보존한다. 원문 PNG는 도구 출력과 바이트가 같고 자르기 저장/재인코딩/배경 제거/리샘플링/덧칠은 하지 않았다. Pillow/NumPy/SciPy는 알파·연결 영역·crop·해시/CRC 읽기와JSON만 작성했다. PNG진단은 별도browsercanvas다.

- [sprites.fragment.json](sprites.fragment.json):5원문 시트·실제크기·**72frame만**. `chars` 전체를 덮어쓰지 않는다.
- [cinder-bear.states.partial.json](cinder-bear.states.partial.json): `av331_cinder_bear`의 `motions`/`frameTransforms` 부분제안. 기존 idle/walk/swipe/bite와 **깊게 병합**해야 한다. 보류 left2clip을 채우는 fallback은 없다.
- [candidate-crops.json](candidate-crops.json): 보류포함80직사각형/변환. 이 파일 자체를registry로 설치하면 안 된다.
- [foot-anchors.json](foot-anchors.json): 원래시트/crop의 **근사 몸 지면 투영 기부**. 노출/가림을 기록했고 가려진 개별 발 접촉점을 지어내지 않았다.
- [install-plan.json](install-plan.json): 원문 목적 경로/SHA, 부분병합/보류 조건.

같은 기존idle과 대조해 새 상태 전체에**.14**배율을 제안한다. 개별포즈를 따로 키우거나 줄여 잘못된 방향/사지/크롭을 감추지 않았다. 표시식은 `(sourcePixel - cropSize*anchor)*scale`이다. 머리/몸 끝높이와 털 모양은 기존 가족과 대략 맞지만 **동일 모델감/실제 맵 상대크기·연결·접지는 부모 Native 수락 전**이다.

제안 주기는 hurt480/fall900/sleep5200/rise1200/work2000ms다. 게임에 적용하지 않았다. 현재 fall은 renderer의 global시간을 사용할 수 있어 CharDef기간을 추가한다고 이900ms가 재생됐다고 주장하면 안 된다. 프레임당4자세는 고밀도12프레임이나 출시 가능한 매끄러움 완료가 아니다.

## 확인과 남은 범위

원본5PNG CRC/SHA, 실제80고유RGBA영역, 제안72crop의범위/큰이웃0/연결원화손실0/alpha≥16경계0,18완전clip,125개 이전v334/v342/v344파일의바이트/목록 불변을 검사했다. 안전crop은 실제 간격에 따라1~3px여백이며 일부work왼쪽은 좁아 정확crop과nearest를 유지해야 한다. 전체 시트에 요청했던 큰 여백이 완성됐다고 주장하지 않는다. [validation-proof.json](validation-proof.json).

사적 포트6366에서136canvas/브라우저오류0/게임로드false로 캡처했다. 직접 연9캡처는native-review에SHA와함께 있다. 다른family위상 캡처도 보존했지만 그전부를 별도열었다고 적지 않았다. 실제 Core행동/손상/기억/수면·사망·섭식, 움직임/지형/가림·발미끄러짐·transition은 부모 담당이다. 메인src/public/docs/dist/publication·게임state·기존staging 변경, 빌드·Full/World·commit/push를 하지 않았다.

```sh
python3 /workspace/.ashveil-planned/v346-bear-state-art/validate-staging.py
python3 -m http.server 6366 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v346-bear-state-art
node /workspace/.ashveil-planned/v346-bear-state-art/capture-staging.mjs
```

5회한도의 이번 묶음은 [art-final.json](art-final.json)에 확정·보존했다. 재등록스크립트는 검토수치/보류분류를 초기화할 수 있으므로 동결 후 실행하면 재검토해야 한다. 별도 승인된 left8보완은 v349의 독립원문/키로 하며 이72제안/보류8을 덮어쓰지 않는다. 진단서버는 검토 후 종료했다.
