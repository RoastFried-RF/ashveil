# v371 재나방 채집·가공 아이콘2 — 자체 원문 후보

기존 자체 v370 나방과 현재32px item atlas를 직접 열어 형태·회갈색/뼈색/나무·돌 기조를 확인했습니다. 입력 이미지 없이 **image_gen 정확히1회 / PNG1장 / 아이콘2개 / 재생성0회**로 새 원문을 만들었습니다. 원화와 세계의50마리 입력·1g 가루·10g 음식 규칙은 별개이며, 그 수치를 이미지 조각 개수나 크기로 증명하지 않습니다. 부모가 실제 채집/연구/안료/씻김/가공 규칙을 맡습니다.

## 무수정 원문과 제안 프레임

- 도구 출력: `/workspace/generated_images/exec-597543ab-3e5f-45da-882e-9d8e8a90302d.png`
- 바이트 그대로 보존: `originals/ashmoth-harvest-icons-v1.png` — **1774×887 RGBA, 410,455bytes**.
- SHA-256: `3262d4adf9ef3f7babe0447e708a291b27dd349591daaa5cbda5f19f773ed0d9`
- 정확 `prompt.txt`, `generation-args.json`, 자체 참고 SHA/입력 판단 `plan.json`, 호출/원문/진단 내역 `provenance.json`.
- 원본 픽셀 수정/재인코딩/리샘플/알파 제거0. 원문1PNG와 개인 체커 진단2PNG를 분리 기록했습니다.

원문 crop 사각형은 **x,y,width,height**, alpha1/16 경계는 **x0,y0,x1,y1(끝 제외)**입니다. `sprites.fragment.json`은 부모 등록용 **제안**이며 public경로/파일은 아직 이 작업이 만들지 않았습니다. `frame-proposals.json`에 정확 좌표·crop RGBA해시·중심을 기록했습니다.

| 프레임 제안 | 원문 crop | alpha1 bbox | alpha16 bbox |
|---|---|---|---|
| `av371_moth_wing_dust` | `[245, 343, 454, 324]` | `[63, 37, 815, 788]` | `[253, 351, 691, 659]` |
| `av371_roasted_moths` | `[1080, 323, 445, 349]` | `[963, 168, 1661, 833]` | `[1088, 331, 1517, 663]` |

제안 sheet key `av371_ashmoth_harvest_icons_v1`, public 경로 제안 `sprites/original/v371-ashmoth-harvest-icons/ashmoth-harvest-icons-v1.png`. 실제 등록 담당자가 public위치를 결정/복사하고 경로를 맞춰야 합니다. 이 staging에는 런타임 등록을 하지 않았습니다.

## 직접 본 의미와 한계

원문 전체와 각 아이콘의1:1 체커 합성 진단을 **모두 view_image로 직접 열었습니다**. 왼쪽은 회색 돌접시/거친 회색 입자·연한 날개비늘 조각, 오른쪽은 갈색 나무그릇/구운 갈색 분절 곤충과 날개조각으로 재질·색·용도가 구분됩니다. 명확한 계단형 외곽과 큰 픽셀 덩어리가 보입니다. 피·절단 고어·끈적임·안개·증기·발광·바닥·문자는 보이지 않습니다.

한계도 남깁니다. 왼쪽 용기는 요청한 매우 얕은 접시보다 테두리가 두껍고 그릇처럼 보이며, 큰 화면에서는 입자가 작은 자갈처럼 읽힐 수 있습니다. 오른쪽은 작은 곤충 몇 마리가 상징적으로 보이고 일부 날개가 비교적 온전하게 큽니다. 실제32/48px UI·Native 관찰은 부모가 수행하며 여기서 작은 크기 가독성/레시피 양/가공 효과를 수락하지 않았습니다.

## 알파·경계·오염

실제2칸은 각887×887입니다. alpha16그림 폭/높이는 안료 **49.38%/34.72%**, 음식 **48.37%/37.43%**로 모두≤55%입니다. 의미 있는 실루엣이 캔버스나 이웃 아이콘에 잘리지 않았습니다. 두 제안 crop 간 원문 영역 중첩0, 이웃 아이콘 오염0입니다.

크롭은 alpha≥8 bbox+8px 여백이며 alpha제거/threshold를 적용하지 않았습니다. 각 crop 밖 alpha≥8 누락0, **crop 테두리 최대alpha0**입니다. 캔버스 가장자리도 nonzero0이며 **x815–962의148px 전높이 중앙 간격은 완전alpha0**입니다. 다만 crop 밖에 alpha1–7 잔상이 안료67px/음식133px 남아 있어 원문 배경 전체가 수학적으로 완전alpha0이라는 주장은 하지 않습니다. 원문은 손대지 않았고 `alpha-analysis.json`에 alpha1/8/16/32/128/248/255 경계·성분·해시를 보존합니다.

`activationReady:false`, `releaseAccepted:false`, `strictOriginalPromptContractPassed:false`를 유지합니다. 두 아이콘의 원문 의미/분리는 확인했으며 최종 게임 연결/실제 크기 가독성/출시 수락은 부모 담당입니다.

작성은 새 v371 staging만 했습니다. authoring/publisher/기존 staging/등록/게임/빌드/테스트/commit/push0. `manifest.sha256`은 자기 자신을 제외한 산출물 해시입니다.
