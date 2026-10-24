# v344 잿곰 뒤 보행 4자세 원문 보완

2026-10-24. **`activationReady:false`**, runtime/출시 수락은 미완료다. 부모가 추가로 지정한 **뒤 보행4자세만 image_gen1회·1PNG·재시도0회**로 만들었다. 다른 동작/종을 생성하지 않았고 v334/v342 기존 원문·실패·부분 등록을 변경하지 않았다.

## 원본에서 확인한 결과

v334 앞 walk, v342 좌/우 walk, 미승인 뒤 walk **4개 PNG를 먼저 다시 직접 열었다**. 기존 뒤 원본은 raw1/raw3의 중앙 앞발을 LF/RF 어느 어깨가 소유하는지 확인할 수 없었다. 이번에는 같은340kg 잿곰의 넓은 어깨/낮은 몸을 유지하며 양쪽 앞다리를 후지보다 조금 넓게 놓아 **바깥 윤곽의 어깨→앞발 경로**가 각각 보이도록 새 원문을 요청했다. 입력은 자체 앞·좌·우 원본3개이며 외부/타 게임 픽셀·트레이싱을 사용하지 않았다.

| source reading order | 실제 들린 발 | 실제 나머지 지지발 | 원문 관찰 |
| --- | --- | --- | --- |
| raw0 좌상 | LH 왼뒷발 | LF/RF/RH | viewer-left 가까운 뒷발바닥과 굽힘, 양쪽 먼 앞발 접지 |
| raw1 우상 | LF 왼앞발 | RF/LH/RH | viewer-left 바깥 앞발이 들리며 해당 어깨에 이어짐, 양쪽 뒷발 접지 |
| raw2 좌하 | RH 오른뒷발 | LF/RF/LH | viewer-right 가까운 뒷발바닥과 굽힘, 양쪽 먼 앞발 접지 |
| raw3 우하 | RF 오른앞발 | LF/LH/RH | viewer-right 바깥 앞발이 들리며 해당 어깨에 이어짐, 양쪽 뒷발 접지 |

뒤 보기에서 해부학적 왼쪽은 viewer-left다. 신규4개는 각기 **앞2·뒤2개의 발과 한 발 회복/나머지3발 지지**를 원문에서 구분할 수 있어 기본 source-pose 제안으로 정리했다. 이전 중앙 앞발을 좌우로 추정한 것이 아니며, 새 원문에는 다섯 번째 중앙 발이 없다. 꼬리/귀/등의 방향은 모두 뒤이며 얼굴·주둥이·눈을 노출하지 않는다. 작은 둥근 귀·짧은 꼬리·낮고 넓은 몸/큰 어깨와 두꺼운 곰 다리다. 늑대 확대·무기·사람 손·직립 경고 자세를 등록하지 않았다.

`paw-review.json`과 `diagnostics/paw-paths-source-diagnostic.png`에는 수동으로 본 네 발 중심·지지/회복 및 양쪽 앞다리의 대략적 보이는 경로를 기록했다. 점과 선은 **읽기 전용 진단 주석**이며 원화 수정/정확한 Body 히트박스/런타임 발 접촉 자료가 아니다. 털에 가려지는 부위 내부를 전부 보았다고 주장하지 않는다. 이 원문 판별은 실제 게임의 하중/지형/충돌/부위 손상 수락을 대신하지 않는다.

## 무수정 원문과 등록 제안

`originals/cinder-bear-walk-up-v1.png`는 도구 반환 원문과 **바이트가 같은1PNG**, 실제 크기는1254×1254다. 정확한 프롬프트/인수는 `requests/cinder-bear-walk-up-v1.json`, 입력3개 경로/참고 SHA·출력 경로/원본 SHA·바이트 일치 여부는 `provenance.json`에 있다. 공개되지 않은 모델 버전은 추측하지 않았다. PNG 재인코딩·배경 제거·리샘플링·부분 수정·원문 자르기 저장을 하지 않았다.

- `sprites.fragment.json`: 원문 sheet1개와 source frame4개뿐이며 `chars`는 비어 있다. 부모 수락 시 원문을 `sprites/original/direction-v344/cinder-bear-walk-up-v1.png`에 바이트 그대로 복사할 수 있다.
- `cinder-bear.walk-up.partial.json`: `av331_cinder_bear`의 `walk.up`4개와 frameTransforms 부분 제안. 기존 v334/v342 부분 자료와 병합할지 결정하는 후속 자료이며 runtime CharDef가 아니다.
- `foot-anchors.json`: 원본 시트와 crop 내부의 **몸 지면 투영 기부**. 개별 발 접촉점이 아니며 가려진 발 위치를 추측하는 자료도 아니다.
- `source-analysis.json`, `registration-analysis.json`: 실제 원본 알파/연결 영역·source crop·RGBA 해시·범위·다른 실루엣 유입 분석. 요청한1280/균등 셀을 crop 크기로 가정하지 않았다.

원본 crop은 `[sheet,x,y,width,height]` 픽셀 직사각형이다. 표시 오프셋은 `(sourcePixel - cropSize * anchor) * scale`이고 신규4개 배율 제안은 **.07**이다. 이전 원본들의 해상도 차이를 대략 맞춘 표시 제안이며 그림의 몸 크기를 수정하거나 구조 실패를 배율로 숨기지 않았다. 뒤의 어깨/바깥 앞발 stance는 이전 뒤보다 더 명시적이고 재빛 털 띠가 조금 더 선명하다. 실제 동일 개체감/시점/상대 크기와 방향 전환은 부모 통합에서 수락해야 한다.

새4개 RGBA crop SHA는 전부 다르고4/4가 원본 내부다. 다른 alpha≥16·면적≥400 실루엣 픽셀 혼입0, 원문 alpha≥16 캔버스 가장자리 픽셀0이다. 원문 알파 범위는0–255이며 alpha1–15 픽셀50,296개도 원문 그대로 보존했다. 낮은 알파/숨은 RGB를 불투명 배경으로 오판하거나 Pillow로 지우지 않았다. 반전/역순/alias로 추가한 신규 원본은0이다.

기본4박자 제안은 기존 v342와 같은 **1400ms, 자세당350ms**다. 게임에 적용하지 않았고 Core TU/이동거리/자원 규칙과 무관하다. 각 방향4자세는 **방향당12프레임 밀도나 출시 가능한 매끄러움 완료가 아니다.**

## 실제로 연 검토 이미지와 남은 범위

도구 출력 후 저장한 원문 PNG를 `view_image`로 다시 열었고 다음 **진단3장도 전부 직접 열었다**.

1. `diagnostics/paw-paths-source-diagnostic.png`: 원문 알파의 중립 배경 합성, 네 발과 어깨→앞발 경로/가상기부 주석.
2. `diagnostics/four-direction-family-x1.png`: v334 앞·v342 좌우·신규 뒤4개를 기존 idle과 함께 crop/anchor/scale의 native 표시로 대조.
3. `diagnostics/four-direction-family-x4.png`: 같은 모든 기본 방향/자세를4배 표시하여 실루엣·발 소유/들림·몸 크기/지면 기부를 대조.

Pillow/NumPy/SciPy는 읽기 전용 분석과 명시된 진단 합성에만 사용했다. 진단에서 원본 crop을 표시 배율로 그린 이미지는 새로운 게임 원화/배포 자산으로 세지 않는다. 실제 이동/지형·가림·충돌/발 미끄러짐, 기존 idle/swipe/bite/front 및 좌우와 최종 모델 일치, 고밀도 프레임과 나머지 상태/초상/손상 마스크, Core/AI 및 실제 통합·출시 수락은 남는다.

요청한1배치 이후 추가 생성하지 않았다. 본체 파일·sprites.json·메인 src/public/docs/dist·publication·기존 staging 변경, 브라우저/프로젝트 빌드/테스트/World/commit/push는 하지 않았다. 새 원문4개의 source 소유가 구분되더라도 활성화나 출시는 부모의 실제 통합 이후에만 수락한다.
