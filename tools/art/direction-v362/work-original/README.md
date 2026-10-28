# v361 LEFT / RIGHT / BACK 다리 없는 작업 차체 · source-only

승인된 병렬 원화 작업. 자체 v357 해당 방향 차체, v335 동일 방향 work, v359 FRONT work를 직접 열고 이 원문만 일관성 입력으로 사용했다. image_gen.imagegen **방향당1회 / 총3회·3PNG / 자동 재생성0회**. 각 결과를 부모에게 도착 순서대로 전달했다. 메인 게임에 적용하거나 Core/Def를 바꾸지 않았다.

## 결과와 엄격한 원문 수

| 방향 | 원본 원화 영역 | 깨끗한 후보 | 기능상태 | 부모에게 제안한 runtime source 순서 |
| --- | ---: | ---: | ---: | --- |
| LEFT |4|3|3| `0→1→2→0` (닫힌 회복에0명시 재사용) |
| RIGHT |4|3|3| `0→1→2→0` (닫힌 회복에0명시 재사용) |
| BACK |4|4|3| `0→1→2→3` (시작/끝이 별도 원문의 닫힌 상태) |

**LEFT3 / RIGHT3은 실제 source 끝 clip으로 보류**했다. 각각 오른쪽 캔버스 경계에 alpha≥16 픽셀42개/25개가 있어 본체 외판/센서 끝이 잘린다. 보류를 풀거나 추가 생성하지 않았다. 부모가 닫힌 source0의 회복 재사용을 명시적으로 승인했으므로 `runtime-work-proposal.json`에 이를 기록했다. 4runtime 항목을4새 성공 원문으로 세지 않는다. 총12raw영역 중 깨끗한 후보10개, 실제4족work 프레임0개다.

LEFT/RIGHT의 큰 aft boss와 고정 벤트 중심, BACK의 두 큰 boss를 **정적 graphic 등록점2개**로 보존했다. 움직이는 spout tip을 차체 등록에 쓰지 않는다. physical hip은 계속null이며 부모2.5D 다리 배치와 분리된다.

## 원문 바이트/정확 프롬프트

모두2172×724 RGBA이며 도구 원문과 보존본 SHA가 같다. 픽셀/알파/숨은 RGB를 변경하지 않았다.

| 방향 | `originals/` 보존 PNG | SHA-256 |
| --- | --- | --- |
| LEFT | `sower-left-work-chassis-v1.png` | `fde768263c1ae70ad3892469d4185443e283590ad1d956ada21fa0ffb162a559` |
| RIGHT | `sower-right-work-chassis-v1.png` | `fc18fe225414d5f75900eacfb5593a61c9363cd0df65cab3f9055fbecee3386e` |
| BACK | `sower-back-work-chassis-v1.png` | `e5a6391a9bf596d5944addf949f08c45f23832641c7d7efdcfb5469ef50e9640` |

도구 원본의 정확한 절대 경로, 입력3원문/참고 SHA, 정확 프롬프트와 UTF8 SHA, 포즈별 RGBA 크롭 해시는 `records/sower-<direction>-work-chassis-v1.json`에 있다. 생성 전에 저장한 프롬프트/입력은 `requests/`에 있다. `references/`의5자체PNG는 기존 원문의 바이트 복사본이며 추가 생성물이 아니다. 타 게임 픽셀을 사용하지 않았다.

Pillow/NumPy/SciPy는 알파/영역/해시/표식 좌표의 읽기 전용 분석에만 썼다. 배경 제거·픽셀 편집·마스크·반전·재색칠·새 크롭 PNG/리샘플링 원화를 만들지 않았다. 원문3의 clip을 배율/외부 픽셀 추정으로 숨기지 않았다.

## 정확한 source-fragment

`[x,y,width,height]`, 오른쪽/아래 끝 제외. 각 몸체의 실제 alpha≥16 주요 컴포넌트 주위4px 여백을 기준으로 확인했다. 캔버스 끝에 닿은 보류3은 완전한4px여백을 만들 수 없다.

| 방향 |0 closed-ready|1 short collar|2 work deployed|3 closed-recovery|
| --- | --- | --- | --- | --- |
| LEFT | `[16,94,536,441]` | `[560,94,533,449]` | `[1103,95,532,484]` | `[1642,95,530,437]` **HELD** |
| RIGHT | `[14,80,539,450]` | `[559,79,536,456]` | `[1100,80,538,492]` | `[1644,80,528,450]` **HELD** |
| BACK | `[9,106,526,476]` | `[552,106,526,484]` | `[1094,106,527,527]` | `[1637,106,526,476]` |

깨끗한10영역의 이웃 주요 body 픽셀 혼입0, 크롭으로 잃은 기존 주요 body 픽셀0, alpha≥16 크롭경계0, source canvas 접촉0이다. 보류2영역의 '기존 source 픽셀 크롭손실0'은 캔버스 밖에서 잘린 본체가 없다는 뜻이 아니다. 밖의 손실량은 알 수 없으므로null로 기록했다. 좁은 간격/요청 폭%미달만을 실패로 세지 않았고 실제clip만 보류했다.

`sprites.fragment.json`에는 깨끗한10후보만 있다. 보류2의 크롭은 기록 전용 `held-clipped-frames.fragment.json`에 따로 두었으며 병합하지 않는다. source-region UID와 원본/크롭 내부/정규화 좌표는 `joint-registration.json`에 있다.

## 직접 본 기구/방향과 기능상태

세 원본과 방향별 whole crop/기구 확대/표식, v357 비교를 직접 열었다. LEFT는 센서가 왼쪽·높은 탱크 왼쪽, RIGHT는 반대, BACK은 높은 탱크 오른쪽·후면 벤트이며 가짜 전면 광학부가 없다. 모든 포즈가 지지legs/foot0, 기존 짧은 접힌 belly tools와 원래 downward port를 유지한다. 떠다니는 실물 씨앗/가짜 포자/액체 jet/고정 stock은0이다.

관측한3기구 상태는 **닫힌 compact cap → black gap과 짧게 드러난 collar → 더 길게 전개된 nozzle/collar**다. 시작과 회복은 모두 compact closed여도 된다. iris 내부의 실제 꽃잎/구멍 구조는 측·뒤 시점에서 직접 관측하지 못해null이다. BACK에서는 원래 아래 collar만 전개되고 후면 벤트를 작업 구멍으로 바꾸거나 카메라쪽 가짜 새 nozzle를 내지 않았다. 이3가시 기구 상태가 실제 씨앗 소비/작업 성공을 보장하지 않는다.

## 흔들리지 않는 graphic 등록점

`stationary-registration-anchors.json`에 원래 v357 기준점과 각 포즈의 source/crop/정규화/±오차를 보존했다. boss는±3원본px, vent는±4원본px의 수동 관측이다. 실제 hip 소유/회전축을 주장하지 않고 부모의 uniform scale+rotation/translation 표시에만 쓴다.

| 방향 | v357 정적 graphic 두점 | work0 | work1 | work2 | work3 |
| --- | --- | --- | --- | --- | --- |
| LEFT boss/vent | `[726,419] / [443,464]` | `[517,367] / [305,402]` | `[1057,367] / [847,401]` | `[1598,366] / [1389,402]` | 보류 원문에만 기록 |
| RIGHT boss/vent | `[139,446] / [332,426]` | `[82,397] / [236,382]` | `[626,397] / [779,382]` | `[1168,397] / [1321,383]` | 보류 원문에만 기록 |
| BACK 두boss | `[177,378] / [660,375]` | `[62,414] / [481,414]` | `[604,414] / [1025,414]` | `[1147,414] / [1567,414]` | `[1690,414] / [2110,414]` |

추가 광학 aperture/벤트/spout landmark와±오차는 포즈별 `joint-registration.json`에 있다. 광학은 보이는 밝은 aperture 한 개의 중심이며 두 aperture의 중점으로 속이지 않는다. BACK 광학은null이다. 움직이는 spout tip은 관찰자료이며 등록점이 아니다. LF/RF/LH/RH와 반대편 숨은 physical hip은null이다.

`review.html`은 원본 source-fragment와 SVG표식/기구 확대만 보여 주는 독립 page.setContent 진단이다. PNG를 편집하지 않았다. `diagnostics/left-work-source.png`, `right-work-source.png`, `back-work-source.png`, `base-v357-comparison.png`, `browser-observation.json`을 보존했다. 스크린샷은 배포용 원화가 아니다.

## 넘기는 범위

`handoff-contract.json`과 `art-final.json`에 후보/보류/정확 집계를 기록했다. 부모가 정적 graphic 두점으로 표시를 정렬하고, 기존13part/14bodyblend 리그의 실제 발 접지·작업 중단/닫힘 복귀·가림/자원 cue를 검토한다. 이 source-only 작업은 전체4족work나 출시를 수락하지 않는다.

메인/src/public/Core/Def/dist/publication 수정·빌드·테스트·게임 실행·Full/World·commit·push는0이다. 기존 v357/v359 동결 자료도 수정하지 않았다.
