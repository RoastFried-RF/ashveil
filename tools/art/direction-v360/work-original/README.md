# v359 전면 작업 차체 후보

image_gen 정확히 **1회·1PNG·재생성0**으로 생성했다. 원문은 **2172×724**, SHA-256 `f4d07f7bda2e9205b36fee765d81878d26fa3919e8236636ed6eb3eb4a46d5e3`이다. 자체 v354 전면 리그 원문과 v335 work 원문을 직접 열어 보고, 바이트 동일 복사본2개를 일관성 입력으로 사용했다. 정확한 도구 인수/프롬프트와 입력 SHA를 `requests/`, `reference-inputs.json`에 보존했다. 기존 원문·staging은 변경하지 않았다.

전면 차체만4개다. 고유 RGBA 원문 영역은4개지만 기능적으로는 **닫힘·열림/짧은 전개·투입 stroke의3상태**가 명확하다. pose0 준비와 pose3 회복은 모두 닫힌 iris/접힌 도구로 수렴하며 차이가 작다. 작은 픽셀/질감 차이를 네 번째 독립 기능으로 세지 않았다. 준비→열림→투입→닫힌 회복의 루프 시작/복귀 후보로 전달한다. **전체4족 작업 프레임0개, 새 다리 원화0개**이며 부품 인스턴싱은 새 authored frame 수가 아니다.

직접 원문과 `diagnostics/poses.png`, `details.png`, `aligned.png`를 보았다. 두 비대칭 탱크·전면 광학부·앞쪽 둥근 힙 캡2개·접힌 작은 belly calibration tools가4차체에 유지된다. iris가 열리고 짧은 nozzle가 나온 pose1, 더 길게 내려간 pose2가 읽힌다. 작은 공구와 nozzle은 drive leg가 아니고, 다리·발·바닥·그림자·밖에 떠다니는 씨앗·분사 효과가 없다. 그림만으로 실제 종자 보유/소비나 무한 산물을 주장하지 않는다.

`joint-registration.json`은 포즈별 **관측한 두 foreground hip pin**과 optics aperture midpoint·두 tank filler center를 원문/crop/정규화 좌표로 제공한다. 두 핀 간격은383/384/383/384source px다. 표식은 원문 핀 캡 안에 직접 확인했다. 핀 좌표의 수동 관측 불확실성은약±3px, 탱크/광학 landmark는±4px다. 이는 투영된2D 중심 후보이며 숨은 뒤 힙의 소유나3D축을 증명하지 않는다.

같은 파일의 `sourceToV354ObservedPinFrame`은 기존 관측 핀 `[182,428]`, `[608,428]`에 맞추는 isotropic scale/rotation/translation을 제공한다. **중점 정렬+핀 간격 정렬** 기준이며 .75알파 겹침을48worldpx핀 간격의1×/3×로 직접 봤다. 원문을 수정하거나 늘리지 않았다. 실제 런타임 크기·가림·지지와 작업 시작/중단/복귀 연결은 부모가 결정한다.

간격 요청의 미달도 보존했다. 요청 몸폭≤62%셀 대신 실제92.1..92.4%이며 pose2높이는 요청70%보다73.8%다. 그래도 주요 몸 경계 사이 간격은42/38/36px, 정확한4px여백 crop은 **모든 주요 몸 보존·이웃 주요 몸0·alpha≥16불투명 테두리0·구조적잘림0**이다. 원문 canvas 가장자리의 잔여 알파 최대4는 숨은 저알파RGB로, 새 몸 결손/리메이크 결함으로 세지 않는다. 부모 지시에 따라 폭 미달만으로 추가 생성하지 않았다. 원문/후보는 전부 보존했다.

`sprites.fragment.json`은 `held_av359_*`4개 영역만 가진 후보이며 char/실제4족 work를 등록하지 않는다. `active:false`, `activationReady:false`, `fullBodyWorkApproved:false`, `releaseApproved:false`를 유지한다. 실제 유한 파종 활동이 성립한 동안에만 이를 재생하도록 부모가 연결해야 한다. 메인 src/public/Core/Def/build/test/game/commit/push는 변경·실행하지 않았다. 사적 HTML은 원문 canvas 관찰만 했고 crop PNG를 재저장하지 않았다. 바이트·CRC·alpha 대조 및 이전99파일 변경0은 `source-byte-alpha-proof.json`에 있다.
