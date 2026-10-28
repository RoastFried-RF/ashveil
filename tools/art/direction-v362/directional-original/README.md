# v357 파종기 LEFT / RIGHT / BACK 관절 원문 · source-only

부모가 승인한 병렬 원화 작업. 자체 v335 방향별 idle/work와 v354 전면4부품 원문을 view_image로 직접 열고, 이 세 자체 PNG만 일관성 입력으로 사용했다. image_gen.imagegen **방향당 정확히1회 / 총3회·3PNG / 자동 재생성0회**. 실패/보류 출력도 원문 그대로 보존했으며 추가 생성하지 않았다.

**이 묶음은 source-only다.** 세 방향의 차체+upper+lower+foot가 각각 한 영역으로 분리되어 총12source영역이다. 새 보행/공격 프레임은0개며, 공유 파츠를4다리에 인스턴싱해도 새 원화나16새프레임으로 세지 않는다. 네발 리그/실제 보행/출시 수락은 전부 false다.

## 원문 보존과 방향 결과

| 방향 | 보존 PNG | 실제 크기 | SHA-256 | 직접 본 결과 |
| --- | --- | --- | --- | --- |
| LEFT | `originals/sower-left-rig-components-v1.png` |1254×1254| `3e87ac18cc6372a114db8237f076f49be804b12c1c3f195dc09bade4c8314653` | 센서가 왼쪽, 높은 탱크 화면 왼쪽/낮은 탱크 오른쪽. 차체 방향은 후보 승인, 부품은 근측 표면 후보 |
| RIGHT | `originals/sower-right-rig-components-v1.png` |1254×1254| `d6526042a18fc7267057f9a98761a9ee30caf96072a3594580f7aa9d797cd936` | 센서가 오른쪽, 높은 탱크 화면 오른쪽/낮은 탱크 왼쪽. 차체 방향은 후보 승인, 부품은 근측 표면 후보 |
| BACK | `originals/sower-back-rig-components-v1.png` |1355×1160| `fefa2b5529c29c9b02123f87443d023f960838345e66db00937e50047c874778` | 후면 벤트와 높은 오른쪽/낮은 왼쪽 탱크는 맞음. **링크/발판의 실제 뒤면 표면·가림 재현은 보류** |

도구 원문은 순서대로 `/workspace/generated_images/exec-6ff2bb7d-31ad-4fa0-aae3-5a3561c23810.png`, `exec-25998de6-6e3f-4d64-a504-7acbc2f4bf42.png`, `exec-80adb8d4-158d-43fb-bef0-1b66aaccd4b5.png`다. 세 보존본 모두 도구 원본과 SHA가 같다. BACK을 포함한 실패/보류 원문도 삭제하거나 덮어쓰지 않았다.

정확 프롬프트/이미지 입력은 `requests/sower-<direction>-rig-components-v1.prompt.txt`와 같은 이름의 JSON, 프롬프트·원문 경로·참고 SHA·알파 분석·수동 판단은 `records/sower-<direction>-rig-components-v1.json`에 있다. `references/`의3PNG는 기존 자체 원문의 바이트 복사본이며 추가 생성물이 아니다. 타 게임 그림/픽셀을 입력/복사하지 않았다.

## 명시 크롭

`[x,y,width,height]`, 오른쪽/아래 끝 제외다. 생성기가 명목2×2 칸 경계를 정확히 지키지 않아 동등 셀 계산은 쓰지 않는다. 아래 주요 원화 영역은 서로 겹치지 않고 다른 부품을 포함하지 않는다. 각 주요 alpha>0 컴포넌트 주위3px 여백을 포함한다.

| 방향 | 차체 | upper | lower | foot |
| --- | --- | --- | --- | --- |
| LEFT | `[67,75,722,587]` | `[914,159,214,517]` | `[330,703,190,509]` | `[726,945,449,251]` |
| RIGHT | `[50,44,693,588]` | `[882,141,233,522]` | `[287,681,172,530]` | `[721,929,457,284]` |
| BACK | `[113,28,602,571]` | `[973,183,206,465]` | `[350,640,178,495]` | `[818,896,427,240]` |

`sprites.fragment.json`의12키는 모두 `held_` 후보이며 CharDef/활성 모델을 제공하지 않는다. BACK PNG의 실제 폭/높이가 다르므로1254 정사각형이라고 가정하지 않는다. 원문 픽셀/알파/숨은 RGB를 변경하지 않았고 배경 제거·PNG 편집·마스크·반전·재색칠·부품 추출 PNG/재래스터화 원화를 만들지 않았다. Pillow/NumPy/SciPy는 읽기 전용 분석에만 썼다.

## 보이는 핀과 관측 불가 기부의 구분

`joint-registration.json`에 source/crop 내부/정규화 좌표, 실제 painted-center 축 벡터/길이/각도, 불투명 이웃 알파, sole 힌트를 기록했다. 직접 보이는 그림의 핀/금속 캡 중심은 `observed:[x,y]`다. 이 좌표는 실제3D 회전축/물리 LF/RF/LH/RH 소유를 증명하지 않는다. 그림에 가리거나 소유가 불명인 실제 hip/반대편 기부는 `observed:null`, `inferred:null`로 남겼다. 가려진 후방/반대쪽 핀을 임의로 채우지 않았다.

| 방향 | upper의 보이는 핀 | lower의 보이는 핀 | foot ankle / sole 힌트 |
| --- | --- | --- | --- |
| LEFT | `[981,252]`→`[1000,603]` | `[381,787]`→`[403,1152]` | `[920,1036]` / `[945,1190]` |
| RIGHT | `[934,225]`→`[974,587]` | `[339,753]`→`[346,1142]` | `[927,1018]` / `[949,1198]` |
| BACK | 그림 캡`[1026,270]`→`[1034,582]` | 그림 캡`[394,713]`→`[411,1078]` | 그림 캡`[1013,973]` / `[1026,1127]` |

수동 핀 중심은 실루엣 끝이 아니라 금속 안쪽이며 반경12px 사각영역의 최저 알파가252–253이다. 세 차체에는 지지 다리/발이 없고, 작은 접힌 보정 매니퓰레이터와 닫힌 중앙 파종구는 고정 body 픽셀로 남았다. 그것들을 지지 다리로 세지 않는다.

BACK 원화에는 전면과 유사한 노출 금색 캡들이 있다. 보이는 그림 캡의 좌표와 불투명도는 기록할 수 있지만, 실제 뒤에서 보이는 관절면/가림이 맞다는 근거가 되지 않는다. BACK의 trueRearJointSurface/확인된 rear mechanical axis는 null/false로 남겼고 링크/발판의 방향 수락은 보류했다. 차체 후면 벤트/탱크 배치가 맞는 것과 별개다. 재생성하지 않았다.

## 직접 본 표시 진단

세 보존 원본, 세 방향 부품/핀 진단, canonical 방향 비교, 밝은 배경·체커 알파 합성을 모두 직접 열었다. `index.html`은 별도 Playwright page.setContent에서 staging만 공급하는 SVG 진단이다. 정확 source rectangle의 표시 clip만 사용하며, letterbox 공간에 이웃 원화가 보이지 않도록 원문 표시를 rectangle에 명시적으로 제한했다. 이 과정은 PNG를 편집/마스크하는 작업이 아니다. 표식과 스크린샷은 배포 원화가 아니다.

- `diagnostics/left-components-and-joints.png`
- `diagnostics/right-components-and-joints.png`
- `diagnostics/back-components-and-joints-held.png`
- `diagnostics/canonical-direction-comparison.png`
- `diagnostics/alpha-comparison.png`
- `diagnostics/browser-observation.json`

v335 raw work의 BACK 행은 기존에 flipX 보정이 필요했던 참고다. 비교 화면은 raw 그대로 표시했으며, 새 BACK의 정답 탱크 배치는 canonical idle의 높은 오른쪽/낮은 왼쪽을 따른다. 원문에 반전을 적용해 새 원화로 만들지 않았다.

## 부모에게 넘기는 범위

`handoff-contract.json`은 source-only 소비 계약이다. 원본 source rectangle, 정확 sourceSize, crop 내부 핀을 사용하되 hidden/ambiguous joint의 null을 확정 좌표로 바꾸지 않는다. 상대 파츠/차체 배율·핀 크기·깊이와 z가림·4다리 지지/회복/실제 root 이동은 부모 client-only 리그 검토가 결정한다.

lower는 방향마다 **고정된 중간 길이 원문1개**다. 가변 telescoping을 그렸다고 주장하지 않으며 파츠 전체를 늘려서 기계 스트로크가 완성됐다고 세지 않는다. 한 방향의 공유 파츠 회전은 그려진 조명도 돌리고, 반대 표면/들린 발판의 밑면은 아직 없다. 네발 리그/실제 보행/출시 수락은 모두 false다.

메인/src/public/Core/Def/dist/publication 수정·빌드·테스트·게임 실행·commit·push를 하지 않았다. 긴 하네스나 폭비 재시도도 실행하지 않았다.
