# v347 잿곰 회수품 독자 원화 · 비활성 통합 후보

부모가 승인한 병렬 원화 작업. image_gen.imagegen **정확히1회**, 생성 PNG **1장**, 재생성 **0회**. 기존 자체 v333 수렵 산물과 v340 측량 부품을 직접 열어 재질·규모를 참고했다. 타 게임 그림/픽셀은 입력하거나 복사하지 않았다. 두 기존 PNG는 참고 SHA 검증·독립 진단을 위한 바이트 복사본이며 새 생성물 수에 포함하지 않는다.

## 보존된 원문

- 도구 원본: `/workspace/generated_images/exec-1a4c2225-c4b7-43e2-9304-bc03b448ed41.png`
- 같은 바이트: `originals/cinder-bear-harvest-icons-v1.png`
- SHA-256: `5c8ae3b0957fb9a0bda355433a37d70449037cf1b1b29d4497107e8042ded05c`
- 1536×1024 RGBA, 실제 alpha0 배경, 4고유 원화영역. 생성 파일/복사본의 바이트와 픽셀을 변경하지 않았다.
- 정확한 프롬프트: `requests/cinder-bear-harvest-icons-v1.prompt.txt` 및 `records/cinder-bear-harvest-icons-v1.json`. 새 원화를 만들었으므로 이미지 입력은 없고, 직접 본 자체 참고 원본과 SHA는 별도로 기록했다.

## 크롭 계약

좌표는 `[x,y,width,height]`, 오른쪽/아래 끝은 제외다. 한 PNG를 그대로 로드해 아래 네 source fragment로 사용한다. Pillow는 알파/컴포넌트/영역을 읽는 데만 썼으며 크롭 PNG, 리샘플링 PNG, 반전/재색칠 파생 원화는 만들지 않았다.

| 아이템 | 요청된 기존 키 | 원문 크롭 | 가방 크기 |
| --- | --- | --- | --- |
| 잿곰 생가죽 | `av331_cinder_bear_hide` | `[175,93,615,390]` | 2×2, 현재 아이콘 상자70×70px |
| 잿곰 지방 덩이 | `av331_bear_fat` | `[908,92,451,391]` | 1×1,32×32px |
| 잿곰 발톱 | `av331_bear_claw` | `[239,552,479,395]` | 1×1,32×32px |
| 밀봉한 잿곰 담즙 | `av331_bear_bile` | `[1003,542,232,406]` | 1×1,32×32px |

생성기는 요청한68% 칸 점유율을 정확히 지키지 않았고 가죽은 명목상 반폭 경계를 약20px 넘는다. 이웃 물품과 겹침/잘림은 없으며, 동등 칸 계산 대신 위 수동 확인한 명시 크롭을 사용한다.

정확한 등록안은 `sprites.fragment.json`, 아이템의 기존 콘텐츠 계획에서 읽은 이름/크기/스프라이트는 `items.snapshot.json`. 후자는 실제 활성 획득 경로를 증명하거나 새 물품을 활성화하는 패치가 아니다. 부모가 현재 구현한 유한 해체/회수 규칙을 유지한다.

## 직접 본 결과

원본과 세 진단 스크린샷을 view_image로 직접 열었다. 넓고 검은 생가죽의 두꺼운 접힌 털, 황백색 불규칙 지방, 짙은 굵은 뿌리의 휜 발톱, 코르크/봉인과 올리브 담즙 수위가 있는 병이 구분된다. 기존 멧돼지의 갈색 가죽·밝은 엄니·분홍 테두리 직육면체 지방과 다른 실루엣이다.

생성 도구 원본 미리보기의 어두운 주변색은 실제 alpha0 아래 RGB였으며, 독립 브라우저의 밝음/검정/체커 합성에서 사각 배경이나 주변 발광이 보이지 않았다. **숨겨진 RGB나 알파를 정리하지 않았고 원문 그대로다.** 미세한 외곽 알파는 보존한다. 검정에 가까운 배경에서는 검은 가죽 대비가 약해지며, 현재 갈색 가방 배경 및2×2 크기에서는 접힌 형태가 읽힌다. 32px 병은 가로 약18px로 표시되어 다른 물품보다 좁다.

`index.html`은 비활성 원화 진단이다. 현재 `src/client/ui/ItemIcon.vue`의 비율 유지·중앙배치·pixelated CSS 표시와 `InventoryWindow.vue`의38px칸/칸×38−6px를 모사한다. 별도 Playwright page.setContent로 staging 파일만 공급했다. 메인 게임을 불러오지 않았다. 4배 화면은 같은 원본에 CSS 배율을 준 관찰 자료이며 새32px 원화가 아니다.

- `diagnostics/four-icons-native32.png`: 원문 영역/32px/실제 가방 비율
- `diagnostics/alpha-comparison.png`: 밝음/검정/체커 합성
- `diagnostics/own-original-comparison.png`: 기존 자체 수렵·측량32px 비교
- `diagnostics/browser-observation.json`: 요청한 staging 파일과 앱 미실행 기록
- `records/read-only-alpha-and-crops.json`: 읽기 전용 알파/영역 근거

부모의 통합 검토 후보로 네 영역의 정체성과 표시 가독성을 승인한다. 실제 런타임/획득 연결/출시 전체 승인은 아직 하지 않는다. 메인 저장소, src/public/dist/publication과 기존 원화는 수정하지 않았고 빌드·테스트·게임 브라우저·Full/World·commit·push를 실행하지 않았다. 중립 rig/의복은 이번 작업에 포함하지 않았다.

구체적인 바이트 복사/manifest 병합 계약은 `install-plan.json`에 있다. 진단 스크린샷은 배포용 원화로 등록하지 않는다.
