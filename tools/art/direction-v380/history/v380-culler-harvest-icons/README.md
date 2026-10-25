# v380 구제기 회수품·장병기 아이콘 — source-only 동결

자체 v376 inventory와 v378 LEFT Culler 원문을 먼저 직접 열고 이2개만 일관성 입력으로 사용했다. image_gen **정확1회/원문PNG1개/고유6영역/자동재생성0**이다. 타 게임 에셋·원문픽셀편집·재색칠·반전·마스크·알파제거·리샘플·파생cropPNG 제작은0이다. 실제Item/Core/콘텐츠/레시피/등록/공유빌드/게임/테스트/push는 부모 담당이고 여기서 변경하지 않았다.

원문 `originals/culler-harvest-icons-v1.png`의 실제 출력은1536×1024 RGBA,2,365,557bytes다.

`SHA-256: b389c1be22914533bff7536ae62b2c1604ca407e879a19494721e703a3f1452d`

도구 원문 `/workspace/generated_images/exec-21ff3b8d-c709-407d-b6aa-710c4516cb65.png`와 보존본은 바이트가 같다. 실제폭/높이는PNG를 읽어 기록했다. 프롬프트는 `requests/exact-prompt.txt`, 정확 인수는 `requests/culler-harvest-icons-v1.json`, 도구응답키/정확output_hint와 원본바이트대응은 `records/tool-response-metadata.json`에 보존했다. Base64를 메타데이터에 중복하지 않고 해당 원문PNG를 보존했다. prompt SHA는 `de620874273ecd865c16d3f24cde784dad3b49e3d8e6a8b5e6da713a70c2e33b`다.

## 물품과 정확 제안 크롭

키는 부모의Item ID를 그대로 대응한 frame이름 제안이다. main Def/registry는 변경하지 않았다. source x/y/width/height이며 오른쪽·아래는 배타적이다.

| 요청Item | 제안frame key | 정확crop |
|---|---|---|
| `Item.CullerScytheBlade` | `av380_culler_scythe_blade` | `[45,27,468,471]` |
| `Item.CullerHeart` | `av380_culler_heart` | `[575,77,403,395]` |
| `Item.CullerArmorPlate` | `av380_culler_armor_plate` | `[1053,41,452,449]` |
| `Item.CullerNetFiber` | `av380_culler_net_fiber` | `[29,551,489,433]` |
| `Item.CullerPurifierTank` | `av380_culler_purifier_tank` | `[539,570,491,348]` |
| `Item.CullerGlaive` | `av380_culler_glaive` | `[1030,498,495,487]` |

`sprites.fragment.json`은1sheet/실제size/6frames의 등록 **제안만**이다. 캐릭터0/애니메이션0이며 장병기 아이콘이 실제held-motion/양손포즈 완성은 아니다.

## 직접 본 원문과24px

원문과 `diagnostics/six-icons-24px-and-source-review.png`, `diagnostics/native24-dark-strip.png`를 직접 열었다. 사적인 DOM은contain/transform/overflow+pixelated 방식으로 native24/32를 검정·밝은색·체커 위에 표시했다.24px canvas×6는 읽기용 진단이며 원화가 아니다. 메인 소지품창/플레이를 본 증거로 쓰지 않는다.

분리낫날은 긴shaft 없이 큰 회색hook/뿌리기구가 있는 회수품으로, 장병기는 같은합금hook계열의 작은머리에 긴 갈색자루가 붙어 구별된다. 동력핵은 녹황동의 낮은 블록/스풀과 두터미널, 탱크는 밝은민트의 가로타원으로 나뉜다. 장갑판의 두껍고길쭉한금속겹과 망의 큰 교차격자는24px에서도 다르게 읽혔다.

장병기의 어두운shaft는24px에서 매우얇고 두손/목재세부가 줄어든다. 원문에는 눈에띄는 가죽wrap1개와 목부분binding이 보이며, 요청한 두개의명확히분리된가죽grip을 충족했다고 쓰지 않는다. 동력핵의 고급기능/전력량, 탱크의 산/내용량/밀봉 상태는 아이콘으로 확인할수없고 탱크의 한 fitting은 열린입구처럼 보인다. 망의thread/겹수·장갑의 실제두께도 literal수치가 아니다. 고해상도 원문에는 미세질감/여러명암이 있어 엄격한 indexedpalette나수작업pixelgrid를 제작했다고 주장하지 않는다.

## 알파·크롭과 실패 기준

실제 alpha16 주요그림6개는 모두 크롭안에 있고 본체손실0/다른icon main혼입0/alpha16crop경계0/실제캔버스 본체잘림0이다.6crop RGBA해시는 모두 다르다. 원문alpha16 전체성분은8개로 mesh[53,721] alpha17과 glaive[1355,648] alpha16 고립점2개가 각각crop안에 남아 있다.

완전히 넓은alpha0간격 조건은 충족하지 못했다. armor/glaive alpha1 main bbox가5행 겹치며 tank의 저alpha rightfringe도 인접한다. 다른아이콘의main pixel이 들어오지 않는 위의사각형을 정했고 **armor250px/glaive336px의 alpha1~2 fringe만 frame밖**으로 남겼다. 다른4개는 alpha1 main생략0이다. 원본전체PNG는 한픽셀도 바꾸지 않았으며 생략위치/최대알파/다른아이콘혼입과SHA는 `icons-review.json`에 명시했다. 이처럼 낮은alpha만croprect밖에 두는 것을 원본을 고쳤다고 기록하거나 strictalpha1완전보존이라고 주장하지 않는다.

원문전체 alpha0은950802px,alpha1~15는58117px,alpha16~250는49931px,alpha251이상은514014px,최대254다.6아이콘main밖 잔점16039px의 최대alpha3,6crop밖9263px,wholecanvas alpha1경계124px가 보존됐다. crop alpha1경계는순서대로11/18/95/56/21/114,alpha16경계는전부0이다. 실제RGBA의밝은/어두운배경 표시에서 큰색안개/바닥그림자는 보이지 않았으나 strict alpha1-clean은false다. 출력 크기나 셀점유 목표를 만들어성공이라고 세지 않았다.

## 기부·손잡이 후보와 부모접점

`landmarks-and-grips.json`은 분리날/장병기 mounting eye, terminal/fitting, shaft끝·socket·leatherwrap과 제안 main/offshaft zone을 source/crop/정규화 좌표로 남긴다. 장병기 후보 main[1158,844]/off[1259,724]는 실제shaft픽셀 위지만 손이그려진포즈도 실제양손리그수락도 아니다. 검은mounting eye는 속이빈구멍처럼 보이므로 opaquealpha만 보고solidmetalpin이라 하지 않는다. 실제3D축/기능은null이다. 느슨한날과 장병기머리는 같은재질/hook가족으로 읽히지만 정확히같은3D부품형상이라는 증거는 없다.

`handoff-contract.json`이 부모전달계약이다. 실제스탯/드롭/제작·재료소모/무기손/사거리/모션/게임표시는 부모가연결해야 한다. source-only의 `active/releaseAccepted/heldWeaponMotionAccepted`는false다. 실패기준을남기고추가생성하지 않았다.

자체브라우저는finally로종료했고HTTP서버는시작하지않았다. v376/v378기존77파일SHA불변을확인했다. 메인sprites/root/docs/Core/content/build/game/tests/push 변경0이다. `artifact-sha256.json`은자기자신을제외한동결파일해시다.
