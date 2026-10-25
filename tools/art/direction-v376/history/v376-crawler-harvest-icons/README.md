# v376 관로 지네 회수품·가공품 아이콘 — source-only 동결

자체 v372 분리 원문을 먼저 직접 열고 **유일한 일관성 입력**으로 사용했다. 새 image_gen **정확1회 / PNG1개 / 6개 고유 영역 / 재생성0**이다. 타 게임 에셋/픽셀, 원문 편집/배경 제거/알파 마스크/리샘플링·파생 cropPNG 제작은0이다. 메인 authoring/아이콘 등록/Core/Def/공유 빌드/게임/테스트/Native/commit/push는 수정하거나 실행하지 않았다.

원문 `originals/crawler-harvest-icons-v1.png`: **1536×1024 RGBA,2,009,628bytes**.

`SHA-256: 32be48c2f616bd37511b0d09a703fdedf2c42b9f659fd30e2b01b97d45c0ed7b`

도구 원문 `/workspace/generated_images/exec-c36697e0-5741-447a-8714-afc33fd003cf.png`와 보존본은 바이트가 같다. 정확 호출 인수는 `requests/crawler-harvest-icons-v1.json`, 프롬프트 원문은 `requests/exact-prompt.txt`, prompt SHA는 `b9e6c5c579d1c0dd36d1abda4d753c259e3d2fd3ec329f9e88471f0d1715b3d7`다. 유일한 참고 원문 SHA는 `d79e58402ddfe288399997088a83bd85ee08d171e83b7dcfc342fdaf49d29d2f`이며 참고 복사본을 새 원화로 세지 않는다.

## 정확 키와 원문 영역

3열×2행 순서이며 사각형은 source x/y/width/height(오른쪽·아래 배타적)다. 키는 부모가 지정한 원문 그대로다.

| 아이콘 키 | 크롭 | 직접 관측 |
|---|---|---|
| `av376_crawler_venom_sac` | `[145,93,244,393]` | 갈색 막·길쭉한 관·큰 황록색 내용물이 있는 한 주머니 |
| `av376_crawler_plate` | `[584,171,364,299]` | 회색 갈색 테두리의 넓고 낮은 외골격 판 하나 |
| `av376_crawler_leg_segment` | `[1165,75,216,413]` | 양끝 갈색 관절과 회색 중심을 가진 가늘고 긴 단일 마디; 아래 링크·갈고리·화살촉 없음 |
| `av376_crawler_raw_meat` | `[92,606,364,309]` | 차가운 회색 살과 갈색 외피의 작은 단일 덩이 |
| `av376_crawler_roasted_meat` | `[589,620,359,287]` | 황갈색 익은 살과 짙은 외피, 생고기와 구별되는 한 덩이 |
| `av376_crawler_cuirass` | `[1101,545,328,403]` | 목/양팔 구멍·갈색 끈·회색 판을 가진 세로 흉갑 아이콘 |

`sprites.fragment.json`은1sheet/size+6frame을 제안하며 메인에는 등록하지 않았다. 독립 장비 Def나 물품ID를 추측하지 않았다. 부모가 실제 Item에 키를 연결한다. `installer-proposal.json`은 원문 바이트 복사와 frame 병합의 **제안만**이며 authoring에 쓰는 실행기는 만들거나 실행하지 않았다.

## 실제24px 직접 검토

새 원문과 `diagnostics/six-icons-24px-and-source-review.png`, `diagnostics/native24-dark-strip.png`를 직접 열었다. native24/32 DOM은 현재 ItemIcon.vue의 contain/transform/overflow 계산과 pixelated CSS에 맞췄다. 검정·흰색·체커 위 native24와 원문 확대를 보았으며,24px canvas×6는 읽기 진단일 뿐 배포 원화가 아니다. 실제 메인 소지품 창을 연 검토와는 구분한다.

24px에서 황록 독샘/넓은 판/가느다란 마디/회색 날살/갈색 익은살/세로 흉갑이 서로 구분된다. 다리 마디는 contain폭 약12.55px여서 작은 관절 세부는 줄어든다. 독샘은 큰 내용물 색은 읽히지만 작은 생물학적 막·관이 유리병처럼 보일 여지가 있어 물품명 문맥이 필요하다. 껍질과 금속의 재질 차이, 정확 지네 종 식별도24px 픽셀만으로 보장하지 않는다. 원문에는 미세 재질이 많으며 엄격한 인덱스 팔레트/수작업 픽셀 격자를 만들었다고 주장하지 않는다. 흉갑은 **소지품 아이콘**이지 착용 몸체/의복 레이어가 아니다.

## 알파·이웃·요청 미달

alpha16 큰 연결 성분은 정확6개, 여섯 크롭의 큰 그림 손실0·다른 주요 아이콘 혼입0·alpha16크롭경계0·캔버스경계0이다. crop RGBA해시는6개 모두 다르다. 실제 그림 잘림이나 이웃 혼입을 축소로 숨기지 않았다. RGBA 흰색/체커 표시에서 큰 갈색 안개나 바닥 그림자는 보이지 않았다.

원문 전체 alpha0은1,163,981px,alpha1~15는28,609px,alpha16~250는33,938px,alpha251이상은346,336px,최대254다. 여섯 주요 그림 밖의 저알파 잔점4834px, 크롭 밖4515px, 캔버스 가장자리12px는 모두alpha16미만이다. 선언 크롭의 alpha1경계는 순서대로1/1/8/3/0/0이다. 이 잔점과 안쪽 잔여 fringe를 원문에서 지우지 않았으므로 **whole-atlas strict alpha1-clean 수락false**다. `icons-review.json`, `records/alpha-analysis.json`에 픽셀 수·정확 bbox·경계·혼입·crop해시를 보존했다.

각512셀55%이하 조건은 여섯 그림 모두 적어도 한 축에서 초과했다. 이는 조건 미달로 명시하되 실제 분리/잘림과 구분했다. 추가 생성이나 source크기 수정으로 덮지 않았다. 실제24px 표시 후보로는 검토했지만 프롬프트의 모든 조건이 충족됐다고 쓰지 않는다.

## 부모 전달과 짧은 구제기 감사

`handoff-contract.json`이 원문/키/제약과 부모 통합 접점이다. 부모가 실제 Def/획득/제작/드롭/독/음식/방어구 동작과 소지품·장착 표시를 검토해야 한다. `active:false`, `releaseAccepted:false`다.

추가 새생성0으로 `culler-runtime-risk-audit.md`를 작성했다. 읽은 공용 리그는4leg ID·%4순회·4view 생성과body/upper/lower/foot만 지원한다. 구제기6다리+2낫은 middle pair/지지점과2개 독립tool의 렌더·소유·공격상태까지 확장해야 하며, v373 boss/물리hip null·기울어진 금속핀축·cap겹침·고정lower·발하단투영·안쪽절삭날불확정·단일FRONT한계를 유지한다. 다른 전용 코드가 없다고 추측하거나 runtime을 통과했다고 쓰지 않았다.

v372/v373의 기존53파일 SHA는 이번 작업 전후 동일함을 확인했다. 자체 진단 브라우저는 닫혔고 HTTP서버는 시작하지 않았다. 원문 동일성·JSON해석·영역·알파 읽기 분석만 했으며 main게임/공유dist를 열지 않았다. `artifact-sha256.json`은 자기 자신을 제외한 동결 파일 해시다.
