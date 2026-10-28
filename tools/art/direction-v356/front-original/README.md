# v354 파종기 전면 관절 원화 시제품 · 원본4부품

부모가 승인한 병렬 원화 작업. 기존 v335 front idle/work와 실패 whole-walk/v351 left-walk를 직접 열어 탱크 비대칭/재질/4다리 구조와 보행 실패를 확인했다. 자체 idle/work 원문2개를 일관성 입력으로 주고 image_gen.imagegen **정확히1회 / PNG1장 / 자동 재생성0회**로 새 원문을 그렸다. 기존 PNG에서 조각을 잘라 새 부품으로 만들거나 마스크/픽셀 편집/재색칠/반전/복제 생성하지 않았다.

## 보존 원문

- 도구 원문: `/workspace/generated_images/exec-ea34a320-d333-40f6-9347-19fec7259701.png`
- 동일 바이트 보존본: `originals/sower-front-rig-components-v1.png`
- SHA-256: `01c034f0dc67699cabc91b55798013446ddbb4fb281fbbdbcb452faa4153dff2`
- 1254×1254 RGBA, 실제 alpha0 배경
- 정확 프롬프트: `requests/sower-front-rig-components-v1.prompt.txt`
- 실제 이미지 입력/옵션: `requests/sower-front-rig-components-v1.json`
- 프롬프트·원문/보존 경로·참고 SHA·읽기 전용 알파 분석·한계: `records/sower-front-rig-components-v1.json`

`references/`의 기존 자체4PNG는 바이트 복사본이며 새 생성물 수에 포함하지 않는다. 타 게임 그림/픽셀을 입력하거나 복사하지 않았다. Pillow/NumPy/SciPy는 원문 알파/영역/색상 위치의 읽기 전용 분석에만 썼다. 별도 크롭 PNG나 재래스터화된 파츠 원화는 없다.

## 명시 source-fragment와 수동 핀

좌표는 원본 픽셀 `x,y`, 크롭은 `[x,y,width,height]`로 오른쪽/아래 끝 제외다. 명목2×2 배치는 차체가 반폭/반높이 경계를 조금 넘으므로 동등 칸으로 나누지 않는다. 네 주요 원화는 완전히 분리되어 있다. 정확 크롭은 주요 alpha>0 컴포넌트 주위3px 여백을 포함하며 다른 부품을 포함하지 않는다. 프레임 밖의 희미한 알파/숨은 RGB도 원문에서 지우지 않았다.

| 부품 | 명시 크롭 | source 연결점 |
| --- | --- | --- |
| 다리/발 없는 전면 차체 | `[108,49,574,586]` | 아래쪽 전경 핀 좌`[182,428]`, 우`[608,428]` |
| 공유 위쪽 strut1개 | `[896,156,201,476]` | proximal`[995,238]` → distal`[985,563]` |
| 공유 아래 piston1개 | `[303,681,172,523]` | proximal`[358,764]` → distal`[375,1132]` |
| 공유 발판1개 | `[762,924,397,258]` | ankle`[944,1011]`, sole 기하 힌트`[955,1165]` |

차체 바깥 위쪽의 금색 보스 좌`[160,374]`, 우`[636,373]`도 눈에 보이지만, 그것이 후방 다리의 정확한 힙 중심/삽입 깊이라는 해석은 **추정**으로 남겼다. 계획 Body의 DriveLeg1..4에 물리 앞/뒤/좌/우를 임의 매핑하지 않았다.

`joint-registration.json`에 원본/크롭 내부/정규화 핀, source축 벡터/길이/각도, 발판 sole, 불투명 이웃 알파, 가림/공유/부모 수학 접점을 기록했다. 핀 중심 알파252–253, 각 중심 주위 반경12px 사각영역 최저 알파251–252로 금속 안쪽이다. 이는 **겹칠 수 있는 불투명 중심 후보**의 근거이며 실제3D 회전축/해부학/접지 승인 근거는 아니다. lower는 source x가17px 어긋난 두 핀이므로 텍스처 중앙/완전 수직 축을 가정하지 않는다.

발판의 중심 sole 알파는254이며, 실제 중앙 하단 림에 든 chord만 `[[875,1165],[1030,1165]]`로 기록했다. 원형 외곽 전체를 평평한 접촉선이라고 가정하거나 바깥의 거의 투명한 좌표를 발 고정점으로 쓰지 않는다.

## 직접 본 결과

보존 원문 및 독립 SVG 진단의 부품/핀, 밝음·체커 합성, canonical front 비교를 view_image로 직접 열었다. 전면은 화면 왼쪽 높은 리브 탱크/오른쪽 낮은 둥근 탱크와 중앙 두 광학 구멍을 유지한다. 지지 다리/피스톤/발은 차체에 없다. 아래에 접힌 작은 보정 매니퓰레이터2개와 닫힌 중앙 파종구는 고정 body 픽셀로 남았으며 지지 다리로 세지 않는다. 새 차체 비율과 하부 세부는 새로 그려진 부분이므로 부모가 전체 모델/배율을 대조해야 한다.

상·하 링크 모두 두 끝의 실체 있는 금색 핀을 식별했고, 별도 발판에는 하나의 ankle cap과 낮은 sole이 있다. 핀 표식이 금속 캡 안에 들어가는 것을 독립 확대 화면에서 확인했다. 밝은 배경/체커 합성에 사각 배경이나 외부 발광은 보이지 않았다.

- `diagnostics/components-and-manual-joints.png`: 수정 없는 파츠와 SVG 핀/축/sole 표식
- `diagnostics/alpha-comparison.png`: 밝음/체커 합성
- `diagnostics/canonical-front-comparison.png`: 기존 front idle/work와 새 legless body
- `diagnostics/browser-observation.json`: staging만 공급한 page.setContent 기록

표식/스크린샷은 진단 자료이며 배포 원화가 아니다. 메인 게임을 불러오지 않았고 새 다리4개를 조합한 보행을 이 작업에서 승인하지 않았다.

## 공유 계약과 보류

**4고유 source영역 = 차체1 + upper1 + lower1 + foot1**이다. 부모 Pixi rig에서 upper/lower/foot를 네 다리에 인스턴싱해도 새 원화12개나16새프레임이 되지 않는다. 이 작업의 authored walk/attack 프레임은 **0개**다. 후보 키에 `held_`를 붙인 비활성 `sprites.fragment.json`만 제공하며 CharDef/활성 모델은 없다.

`handoff-contract.json`에 부모의 Texture source-fragment/Container 회전 접점을 기록했다. 연결점 pivot을 크롭 내부 좌표로 옮기고 projected source축을 target hip/knee 벡터에 맞추되, 상대 부품 배율과 z순서는 부모 layout 검토가 결정한다. 소스 픽셀을 같은 배율로 쓰는 것이 기계적으로 맞는다고 가정하지 않는다.

남은 한계는 후방 기부 소유/가림, body 대비 파츠 배율, 공유 파츠 회전에 따른 그려진 조명 회전, 가변 피스톤 길이, 들어 올린 발판의 미제작 밑면, 실제 root 이동과 결합한4다리 지지/회복/발 고정이다. lower는 **한 중간 길이의 단일 원화**다. 전체 lower를 늘리는 것으로 barrel/rod/힌지의 기계적 telescoping이 그려졌다고 주장하지 않는다. 가림/픽셀 마스크로 미제작 면을 숨기는 작업은 하지 않았다. 다른 방향은 아직 없다.

네 부품의 정체성과 불투명 핀 후보만 원화 시제품으로 승인한다. 네 다리 합성/보행/접지/메인 활성/출시 승인은 모두 false다. 실패/한계는 보존했고 추가 생성하지 않았다. 메인/src/public/dist/publication 수정·빌드·테스트·게임 실행·Full/World·commit·push는 하지 않았다.
