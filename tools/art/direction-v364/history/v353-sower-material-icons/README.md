# v353 파종기 회수 물품2종 · Def 확정 전 비활성 원화

승인된 병렬 원화 작업. `tools/content-plans/expanded-creatures-v331/core-fragment/defs/harvest-v331.json`의 두 Item 원문을 읽고 이름/크기/아이콘 키를 그대로 기록했다. image_gen.imagegen **정확히1회 / 생성 PNG1장 / 재생성0회**로 두 고유 아이콘을 준비했다. 실제 Def/획득/컨테이너 동작을 확정하거나 수정하지 않았다.

## 원본 바이트와 명시 크롭

- 도구 원문: `/workspace/generated_images/exec-7ee4717f-d17a-40ba-a118-54ba576ecff4.png`
- 같은 바이트 보존본: `originals/sower-material-icons-v1.png`
- SHA-256: `ef5e939ad839f1a8329c4ac8a537cda2bbf7d9c6fff348c9fec421387bf8c17d`
- 크기:1774×887 RGBA, 실제 alpha0 배경
- 정확 프롬프트: `requests/sower-material-icons-v1.prompt.txt`
- 독립 등록 조각: `sprites.fragment.json`
- 프롬프트·원본/보존 경로·참고 SHA·읽기 전용 알파/영역 분석·시각 판단: `records/sower-material-icons-v1.json`

| 계획 Item | 요청된 원문 sprite값 | `[x,y,width,height]` | 계획 가방 크기 |
| --- | --- | --- | --- |
| Item.SowerSeedCapsule · 파종기 저조도 종자 캡슐 | `av331_sower_seed_capsule` | `[366,271,187,446]` | 1×1칸 → 현재32×32px 상자 |
| Item.SowerReservoir · 파종기 빈 저장 탱크 | `av331_sower_reservoir` | `[1012,126,630,659]` | 2×2칸 → 현재70×70px 상자 |

오른쪽/아래 끝은 제외다. 주요 alpha>0 원화 컴포넌트 주위3px 여백으로 골랐으며 두 영역은 겹치거나 다른 물품을 포함하지 않는다. 생성기는 요청한 대략45%/65% 높이 대신 약50%/74%로 그렸지만 여백과 분리는 충분하다. 동등 칸 나누기 대신 명시 크롭을 사용한다. 원문 밖/프레임 밖의 작은 알파 흔적을 지우지 않았다. 배경 제거·픽셀 수정·재색칠·반전·크롭 PNG/리샘플링 PNG 생성은 하지 않았다. Pillow/NumPy/SciPy는 읽기 전용 분석에만 사용했다.

## 직접 본 자체 참고 원문

기존 v335 파종기 idle-v2와 work-v1, v340 측량 부품, 최근 v350 가공 기록을 모두 view_image로 직접 열었다. `references/`는 네 자체 원문의 바이트 복사본이며 추가 생성물이 아니다. 원문/복사본 경로와 SHA는 `records/source-survey.json`에 있다. 타 게임 그림/픽셀을 입력하거나 복사하지 않았다. 새 원화이므로 생성 이미지 입력은 없고 직접 본 참고 구조/재질을 정확 프롬프트에 기술했다.

파종기 원화에는 서로 다른 종자/정착균 탱크2개, 담색 금속 몸체·돔, 검은 짧은 주입 목·고정띠, 황동 연결부가 있다. 큰 회수품은 그중 짧고 둥근 저장 용기 계열을 따른다. 회수 후 열린 목/비어 있는 내부는 아이콘 표현 제안이며, 기계의 실제 독립 절단 부위·뚜껑 조작·급수 기능을 구현했다는 뜻이 아니다.

기존 파종기 작업 원화에는 유한 재고를 고정 그림으로 위조하지 않으려고 별도 배출 캡슐이 없다. 따라서 종자 캡슐의 밀봉 외피/작은 검사창은 실제 종자 내용과 기계 재질에 맞춘 **새 외형 제안**이다. 기계 원문에 이미 있던 별도 캡슐 모델이라고 주장하지 않는다. 계획 Def 원문은 `items.plan-snapshot.json`에 보존했으며 활성 패치가 아니다.

## 실제 크기와 알파 합성 검토

보존 원문과 진단 스크린샷 세 장을 직접 열었다. 좁고 밀봉된 종자 캡슐과 넓고 열린 빈 탱크가 구분된다. 캡슐에는 둥근 마감/금속 띠/올리브 담색 외피/갈색 씨앗을 보이는 작은 호박색 검사창이 있다. 탱크에는 낮고 둥근 담색 몸체, 검은 주입 목의 빈 타원, 두 고정띠와 아래 황동 연결부가 있다. 새 무기·발광 코어·주사기·기름통 형태로 바꾸지 않았다.

32px 상자에서 캡슐의 실제 폭은 약13.4px라 개별 종자 수를 읽는다고 주장하지 않는다. 작은 종자 창과 갈색 덩어리로 읽힌다. 탱크는32px에서도 넓은 빈 용기 실루엣이 읽히며, 계획2×2칸의70px에서는 열린 목/건조한 내부/연결부가 더 분명하다. 16px은 주로 실루엣·재질만 읽힌다. 밝음/검정/체커 합성에서 사각 배경이나 외부 발광은 보이지 않았다. 알파0 아래 숨은 RGB와 미세한 외곽 알파는 원문 그대로다.

- `diagnostics/sower-materials-native32.png`: 원문 상세,16/32px, 계획 가방32/70px
- `diagnostics/alpha-comparison.png`: 밝음/검정/체커 합성
- `diagnostics/own-original-comparison.png`: 실제 파종기·측량 부품·최근 기록 비교
- `diagnostics/browser-observation.json`: 메인 게임을 불러오지 않은 독립 staging 요청 기록

`index.html`은 ItemIcon.vue와 같은 비율 유지·중앙정렬·pixelated CSS를 사용한 표시 진단이다. 가방은 InventoryWindow.vue의38px칸/칸×38−6px 상자 규칙만 모사했다. 별도 Playwright page.setContent에서 staging만 공급했다. CSS4배 확대와 스크린샷은 진단 자료이며 배포용 새32px 원화가 아니다.

## 남은 통합

두 원화의 정체성/구분/알파 표시를 부모 통합 검토 후보로 승인한다. `install-plan.json`에 원문 복사/manifest 병합/계획 키 연결과 부모가 확정할 Def/실제 회수/컨테이너 제약을 기록했다. 유한 종자 재고·회수 수량·배출/파종 기능과 물통 용량을 이 원화로 추가하거나 추측하지 않는다.

메인/src/public/dist/publication과 기존 파일을 수정하지 않았고 빌드·테스트·메인 게임 실행·Full/World·commit·push를 하지 않았다. Def 확정/실제 런타임/출시 전체 승인도 하지 않았다.
