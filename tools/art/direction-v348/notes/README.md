# v350 잿곰 가공 기록 · 비활성 독자 원화

부모가 승인한 병렬 원화 작업이다. `Item.BearProcessingNotes`(잿곰 가공 기록)에 쓸 아이콘을 image_gen.imagegen **정확히1회 / 생성 PNG1장 / 재생성0회**로 만들었다. 기존 자체 공작/재질 수첩과 v347 잿곰 회수품 원문을 직접 열고 참고했으며 타 게임 픽셀이나 그림은 입력/복사하지 않았다.

## 원문과 등록

- 도구 원본: `/workspace/generated_images/exec-31b782b6-96f7-434c-8509-7b07c440d050.png`
- 같은 바이트 보존본: `originals/bear-processing-notes-v1.png`
- SHA-256: `85766c419fe8776bf7f46c21cac6a212fbaa81da111dcb81a90f7ebee91810dc`
- 크기:1254×1254 RGBA, 실제 alpha0 배경
- 키: `av350_bear_processing_notes`
- 단일 고유 source-fragment: `[214,210,855,904]` (`x,y,width,height`, 오른쪽/아래 끝 제외)
- 독립 등록안: `sprites.fragment.json`
- 정확 프롬프트: `requests/bear-processing-notes-v1.prompt.txt`
- 정확 프롬프트/원문 경로/참고 SHA/읽기 전용 알파 분석/시각 판단: `records/bear-processing-notes-v1.json`

원본과 보존본의 SHA가 같다. PNG 픽셀/알파를 변경하지 않았고 배경 제거·재색칠·반전·Pillow 파생 이미지 생성은 하지 않았다. Pillow/NumPy/SciPy는 읽기 전용 알파/컴포넌트/크기 분석에만 썼다. 프레임은 주요 원화 알파 컴포넌트 주위3px 여백을 포함한다. 멀리 떨어진 약한 알파 흔적은 source PNG에서 지우지 않고 프레임 밖에 둔다. 세 참고 PNG의 바이트 복사본은 기존 자체 원문이며 새 생성물 수에 포함하지 않는다.

## 직접 본 결과와 한계

보존 원문과 진단 스크린샷 세 장을 view_image로 직접 열었다. 얇고 해진 양피지 묶음, 왼쪽 어두운 가죽 끈과 매듭, 굵고 휜 발톱의 잉크 스케치, 작은 접힌 생가죽 스케치, 읽을 수 없는 손글씨가 원문에 있다. 별개의 실제 발톱/가죽 물품이 붙은 그림이 아니다. 기존 닫힌 짙은 공작/재질 수첩과 달리 밝은 그림 양피지가 노출되어 구분된다.

실제32px에서는 수첩/가죽 끈/큰 C형 발톱 도안이 읽힌다. **작은 생가죽 스케치의 정확한 재질은 확대와 아이템 이름에 의존한다.** 16px에서는 주로 묶은 그림 기록지로 읽히며 두 재료의 세부 해부학을 보장하지 않는다. 생성 도구가 요청한 약60% 점유율 대신 가로 약68%/세로72%를 썼지만 충분한 외부 여백 안에 완전한 원화가 있고 명시 프레임은 잘리지 않는다. 밝음·검정·체커 위 합성에서 사각 배경/외부 발광은 보이지 않았다.

- `diagnostics/notes-native32.png`: 원문 상세,16/32/48px 및 같은 원본의 CSS4배 표시
- `diagnostics/alpha-comparison.png`: 밝음/검정/체커 합성
- `diagnostics/own-original-comparison.png`: 기존 자체 수첩과 잿곰 재료32px 비교
- `diagnostics/browser-observation.json`: staging 파일만 사용하고 메인 게임을 불러오지 않은 기록

`index.html`은 현재 ItemIcon.vue와 같은 비율 유지·가운데정렬·pixelated CSS 표시의 독립 진단이다. 별도 Playwright page.setContent로 staging 파일만 공급했다. 진단 스크린샷과 확대는 배포용 새 픽셀 원화가 아니다.

## 부모 통합 계약

`install-plan.json`에 원본 바이트 복사와 manifest 병합 경로를 기록했다. 부모가 별도 아이템/제작법 습득을 구현하고, 새 게임 검은 숲의 버려진 사냥 야영 흔적에 실제 기록 한 부를 배치한다. 이 원화 작업은 획득/지식 연결이 구현됐음을 주장하지 않는다. 기존 수첩 동작이나 유한 자원 규칙을 바꾸지 않는다.

원화 의미·투명 배경·32px 수첩 정체성은 통합 후보로 승인한다. 실제 런타임/한 부 배치/제작법 습득/출시 전체 승인은 부모 구현 후 별도다. 메인 저장소의 src/public/dist/publication과 기존 파일은 수정하지 않았고 빌드·테스트·메인 게임 실행·Full/World·commit·push를 하지 않았다. 중립 rig/의복은 범위 밖이다.
