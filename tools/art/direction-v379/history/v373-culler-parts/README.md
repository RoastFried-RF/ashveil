# v373 구제기 정면 분리 부품 후보 — source-only 동결

새 image_gen **1회·PNG1개·6개 고유 원문 영역**, 자동 재생성0이다. 기존 canonical `culler-idle-v2.png`를 직접 다시 열고 그 자체 원문1개만 일관성 입력으로 사용했다. 기존8원문/v368은 보존했다. 메인 등록·렌더러·Core·Def·게임·빌드·테스트·Native·commit/push는 실행하거나 수정하지 않았다.

원문: `originals/culler-front-parts-v1.png` (1536×1024 RGBA, 1,627,696bytes)

`SHA-256: 6f30979dc5c4db6496c135718e84fa70eef52ebfc936af126a1b121471c6542a`

도구 원문 `/workspace/generated_images/exec-0f0dbe5d-cf30-45fa-8892-156e3e2f539a.png`와 보존본은 바이트가 같다. 정확 입력은 `requests/culler-front-parts-v1.json`, 프롬프트 원문은 `requests/exact-prompt.txt`에 있으며 prompt SHA는 `453d19f85541447da4253d5271ccd9db9a70c94b49809c1144ec591049aa12b4`다. 참고 PNG SHA는 `51670a65d139794b3284da16556fbcc11f19434a57b81d5587cbebfed59b7662`다. 참고 복사본은 새 원화로 세지 않는다.

## 직접 본 결과와 크롭

정면 센서2개·화면 오른쪽 민트색 탱크·길게 이어진 회색 강철 등판과 황동 연결부 정체성이 유지됐다. 차체에는 구동 strut/발과 낫팔/낫날이 baked되지 않았고, 낫날을 지지발로 세지 않았다. 정확한 3열×2행 부품 순서는 다음과 같다. 사각형은 x/y/width/height, 오른쪽·아래 배타적이다.

| 원문 부품 | 정확 크롭 | 수동 관측 원문 핀/접점 |
|---|---|---|
| 차체·센서·탱크 | `[155,76,361,382]` | 앞 보스 `[245,429]`, `[373,429]`; 옆 그래픽 보스는 joint JSON 참조 |
| drive upper | `[667,121,187,332]` | proximal `[820,185]` → distal `[744,408]` |
| drive lower | `[1159,76,194,408]` | proximal `[1318,141]` → distal `[1235,435]` |
| 평평한 발판 | `[173,667,330,224]` | ankle `[342,744]`; 아래 실루엣 기준선 `[257,880]`→`[414,880]` |
| 낫팔 upper | `[668,539,233,379]` | proximal `[857,620]` → distal `[756,868]` |
| 낫날+아래팔 | `[1181,538,245,428]` | proximal `[1274,597]`; 날끝 `[1296,951]` |

부품 핀 중심 오차는 ±3sourcepx, 차체 보스 ±6px, 발 아래 실루엣/날끝 ±4px다. 8개 실제 부품 관절 핀의 반경12 square(25×25) 최저 알파는251~252다. 실제 금속 안쪽 중심이며 검은 투명 구멍을 pivot으로 고르지 않았다. 차체의 보이는 보스와 **물리적 여섯 hip/두 tool shoulder는 구분한다**. DriveLeg1~6 물리 hip, tool shoulder 소유, 진짜3D축은 모두 null이다. 정면 한 원문에서 가려진 연결부를 관측했다고 단정하지 않았다.

`joint-registration.json`이 최종 좌표·상대 crop 좌표·정규화·고정 source축·알파 주변값 계약이다. `sprites.fragment.json`은 `held_av373_…` 키의 제안일 뿐 메인 등록하지 않았다. 부품 진단 PNG의 표식은 시각 검토 전후 1~3px 세밀화 전의 provisional 표식이며 `records/provisional-parts.json`과 대응한다. 최종 계약은 `joint-registration.json`이다.

## 알파·분리와 생성 조건 미달

6개 부품 전체와 각각의 검정/흰색/체커 배경·축소 진단을 직접 열었다. main alpha16 성분은 정확6개이며 선언 크롭의 alpha1 경계0, 다른 main 성분 혼입0, 차체/날/발의 실제 잘림0이다. 흰색·체커 크롭에서 큰 안개나 바닥 그림자는 보이지 않았다. 이 관찰은 모든 알파가 깨끗하다는 뜻은 아니다.

원문 전체 alpha0은1,278,060px, alpha1~15는28,483px, alpha16~250는33,516px, alpha251이상은232,805px이며 최대254다. 여섯 큰 성분 밖의 잔점2015px, 크롭 바깥1777px, 캔버스 가장자리26px는 모두 alpha16 미만이다. alpha16의 성분 밖/크롭 밖/캔버스 가장자리 픽셀은 모두0이다. **원문 전체의 strict alpha1-clean 수락은 false**다. 제거/마스크/알파 수정/배경 제거/리샘플링 없이 원문과 각 크롭 안의 모든 잔여 알파를 보존했다. 전체 및 부품별 값은 `records/alpha-analysis.json`, `records/residual-alpha.json`, `parts-review.json`에 있다.

요청한 각 셀55% 이하는 여섯 부품 모두 적어도 한 축에서 초과했다. 이는 `parts-review.json`에 그대로 기록했다. 실제 크롭 분리는 유지돼 이웃 혼입/잘림과 구분했으며, 축소해 조건을 충족했다고 주장하지 않는다. 재생성 예산0을 지켰다.

## 날·발·리그의 남은 한계

날 근위 금속 핀부터 굽은 날끝까지 하나의 연결된 아래팔 원문이다. 준비 상태처럼 아래로 접힌 곡선과 끝점은 읽히지만 밝은 넓은 bevel은 화면 오른쪽 볼록면을 따른다. 요청한 **안쪽 절삭날**이라고 확정할 근거는 부족해 `requestedInnerCuttingBevelProven:false`를 유지한다. 화면 왼쪽 오목 곡선/날끝과 단순 외관을 곧바로 실제 공격·안전한 휴대 자세 수락으로 세지 않는다.

발판의 보이는 평평한 하단 chord는 정면 투영 실루엣이다. 미제작 발바닥 면이나 실제 ground plane, 이동 중 접지/미끄럼 검토는 하지 않았다. lower는 원문 고정 길이이며 가상 telescopic stroke를 그렸다고 주장하지 않는다. 원문 금속 하이라이트는 회전/반전과 함께 움직이며 반대/뒤/안쪽 면은 미제작이다.

부모가 관절 시제품을 만들면 1차체+6upper+6lower+6발+2tool upper+2날 =23표시 인스턴스지만 **6원문, 보행0프레임, 공격0프레임**이다. 반전이 필요하면 부모 metadata에서 명시하고 anatomical main/off와 광원 비대칭을 함께 검토해야 한다. 원문 반전/복제 결과는 이 stage에서 만들지 않았다. 가림 순서·두 cap 겹침·hip/도구 어깨·거리 기반 tripod 접지·공격/중단/회복은 부모 runtime 검토 대상이다. 분리 원화만으로 완성3D 골격을 수락하지 않는다.

`active`, `releaseAccepted`, `semanticGaitApproval`, `fullAttackAccepted`, `acidSprayAccepted`, `captureNetAccepted`, `physical3DSkeletonAccepted`는 전부 false다. 다른 방향·6족 보행·낫 공격·산분사·포획망 완료로 세지 않는다.

## 파일과 실행 범위

- 정확 입력·참고·원문 보존: `requests/`, `references/`, `originals/`, `records/tool-output.json`, `records/call-budget.json`.
- 부모 source-only 전달 계약: `handoff-contract.json`, `joint-registration.json`, `parts-review.json`, `sprites.fragment.json`, `art-final.json`.
- `review.html`, `capture-staging.mjs`, `diagnostics/*-source-review.png`는 소스 크롭을 SVG로 보여 준 개인 표시 진단이다. 게임에 넣을 새 원화가 아니다. Pillow/NumPy/SciPy는 읽기 전용 분석에만 사용했다.
- 진단용 브라우저는 닫혔고 HTTP서버는 시작하지 않았다. 메인 게임/공유 dist를 열지 않았다. `diagnostics/own-lifecycle.json`에 기록했다.
- 이번 실행은 원문 바이트 동일성·JSON 해석·크롭 범위·알파/핀 수치와 직접 시각 관찰만이다. 메인 게임 검사·빌드·테스트·Native는 실행하지 않았다. `artifact-sha256.json`은 자기 자신을 제외한 동결 파일 해시다.
