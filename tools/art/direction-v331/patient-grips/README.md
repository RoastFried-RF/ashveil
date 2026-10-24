# v331 patient / withered_priest 실제 손 접점 자료

2026-10-24에 현재 `src/client/sprites.json`의 기존 원화를 직접 열어 수동 등록했다. 이 디렉터리는 **staging 자료**이며 게임의 src/public/docs, 기존 v330 자료, 원본 PNG는 수정하지 않았다. 신규 원화나 추가 애니메이션 프레임을 만든 작업도 아니다.

## 등록 계약

`patient-grips.json`은 v330와 같은 구조다.

```ts
type PalmGrips = {
  format: 1;
  frames: Record<string, {
    main: [number, number] | null;
    off: [number, number] | null;
  }>;
};
```

- 키는 실제 `av322_patient_{idle|walk|attack}_{direction}{index}` 프레임 키다.
- 숫자 쌍은 해당 프레임 **원래 크롭**의 왼쪽 위를 원점으로 한 원본 픽셀 좌표다. x는 오른쪽, y는 아래로 증가한다. 시트 전체 좌표가 아니다.
- anchor/scale/flipX는 적용하지 않았다. 소비자는 프레임별 실제 크롭 너비·높이와 `frameTransforms`를 적용한다. 기준점에서의 오프셋은 `(px - width * anchorX) * scale`, `(py - height * anchorY) * scale`이고, `flipX`가 있으면 x 오프셋을 반전한다. 최종 위치는 렌더러의 인물 기준점과 동일하게 사용해야 한다.
- `main`은 **최종 표시 인물의 해부학적 오른손**, `off`는 왼손이다. 화면의 오른쪽/왼쪽을 뜻하지 않는다.
- 좌향 공격은 아래 설명처럼 원본이 반전 공유되므로, JSON에 이미 최종 표시의 해부학적 손을 맞춰 넣었다. 소비자는 `flipX`에 따라 **좌표만 반전**하고 **main/off 이름을 다시 교환하지 않는다**.
- `null`은 손이 소매/몸통/다른 팔에 가려졌거나 독립적으로 확정할 수 없는 경우다. 추정 접점이 아니다. 해당 손의 향로/의료 도구 overlay를 숨기고, 임의의 앞쪽 손 위치를 더해서는 안 된다.
- 보이는 손의 피부·손가락/쥔 주먹 중심을 수동으로 골랐다. 세부 손가락 관절이나 손잡이 방향 정보, IK, 도구별 회전축은 포함하지 않는다. 주먹 중심을 도구 그림의 손잡이 접점에 맞추는 작업은 소비자 표시 구현에서 필요하다.
- 기존 `attack`의 `mainHand` 메타데이터는 정답으로 재사용하지 않았다. 실제 원화의 보이는 주먹을 기준으로 새로 등록했다. 이 자료를 사용하는 프레임에는 추가적인 가짜 전방 손 이동을 더하지 않는다.

## 검토 범위와 가림

고유 원화 모델은 `patient` 한 종이다. `withered_priest`와 `shade0` 등 같은 프레임을 쓰는 캐릭터 별칭은 별개 원화로 세지 않았다. 캐릭터별 표시 크기가 달라도 여기의 원본 크롭 좌표는 같다. 실제 표시에는 해당 캐릭터의 프레임 변환을 적용한다.

| 동작·방향 | 등록 프레임 키 | 보이는 main | 보이는 off | null 손 슬롯 |
| --- | ---: | ---: | ---: | ---: |
| idle down | 4 | 4 | 4 | 0 |
| idle left | 4 | 0 | 4 | 4 |
| idle right | 4 | 4 | 0 | 4 |
| idle up | 4 | 4 | 4 | 0 |
| walk down | 12 | 12 | 12 | 0 |
| walk left | 12 | 2 | 12 | 10 |
| walk right | 12 | 12 | 0 | 12 |
| walk up | 12 | 12 | 12 | 0 |
| attack down | 8 | 8 | 8 | 0 |
| attack left | 8 | 7 | 8 | 1 |
| attack right | 8 | 8 | 7 | 1 |
| attack up | 8 | 3 | 0 | 13 |
| 합계 | **96** | **76** | **71** | **45** |

idle 16 + walk 48 + attack 32 = **96개 프레임 키**를 모두 원본 접촉 시트로 열어 봤다. 고유 `(sheet,x,y,width,height)` 크롭은 **88개**다. 접점을 겹친 동일 범위의 진단 이미지도 12개 방향·동작 시트를 모두 직접 열어 손 피부/주먹에 닿는지 대조했다. 미대조 등록 프레임은 없다.

- idle의 측면에서는 가까운 한 손만 보인다. left는 off만, right는 main만 등록했다.
- walk left는 0·8에서만 먼 오른손이 별도로 드러난다. 나머지 10개의 main은 null이다. walk right의 먼 왼손은 모두 가려졌다.
- attack right4의 뻗은 오른 주먹은 main이고, 먼 왼손은 가려져 off=null이다. 반전 공유인 attack left4에서는 같은 원본 접점이 **off**가 되고 main=null이다.
- attack up2·3·4는 오른 주먹만 드러난다. up0·1·5·6·7은 양손 모두 가려져 main/off가 모두 null이다.
- idle/walk의 up에서는 양손이 몸 옆으로 드러나므로 둘 다 등록했다. v330 work의 up 가림 결과를 이 동작에 그대로 복사하지 않았다.

## 좌향 반전 공유의 정확한 범위

현재 원본에서 **attack left0..7만** right0..7과 같은 크롭을 쓰며 `flipX: true`다. idle left0..3과 walk left0..11은 자체 좌향 크롭이고 flipX가 없다. 따라서 모든 좌향을 우향 재사용으로 취급하면 안 된다.

좌향 공격의 원본 크롭에 main/off를 겹쳐 보면 우향의 반대 색으로 표시되는 것이 맞다. 예를 들어 right0의 main `[70,53]`은 left0에서 off `[70,53]`이 되고, right0의 off `[94,55]`는 left0에서 main `[94,55]`가 된다. 둘 다 raw x 좌표는 그대로이며, 최종 반전은 표시 변환에서만 한다. 96개 키를 모두 등록했지만 이 공유 8개를 새 원화 8개로 세지 않았다.

## 원본 출처

`source-manifest.json`에 대조 시점의 전체 96개 프레임의 원본 크롭·표시 변환과 아래 PNG의 크기/SHA-256을 남겼다. 원화가 바뀌면 이 수동 접점도 다시 대조해야 한다.

| 기존 원본 경로 (`public/sprites/original/direction-v322/` 기준) | 크기 | SHA-256 |
| --- | --- | --- |
| patient-locomotion-front-left.png | 1448×1086 | `46d8af03409b4c93a7eb83ead55371c0a84dd6117e043b0c247d522c2a8d1264` |
| patient-locomotion-right-back.png | 1448×1086 | `2b9a1cd401994abffff3c846c15d2a3ecc79d04f7b40289862c51f3b5b45a00e` |
| patient-combat-front-left.png | 1448×1086 | `0dea6115a6d8a7878349a7d7b8906a607fa3b1a235fc386c4ef055d12b02119c` |
| patient-combat-right-back.png | 1774×887 | `de367fb17af4c528687570539878276ebcc98a7cc3dfbcc9643987f1a934b16a` |

## 로컬 원본 분석 도구

- `register-patient-grips.py`: 직접 고른 원본 픽셀 접점의 수동 원장이다. sibling `patient-grips.json`만 작성한다.
- `inspect-patient-grips.py`: 기존 PNG/registry를 읽어 `/tmp/ashveil-v331-patient-grips/`에 원본 접촉 시트 또는 접점 겹침 진단을 만든다. 원본/공개 자산에 쓰지 않는다. `--points patient-grips.json`이 없을 때만 sibling `source-manifest.json`을 기록한다.
- `/tmp/ashveil-v331-patient-grips/patient-{motion}-{direction}-source.png`, `-points.png` 및 선택적 `-hands.png`는 **원본 크롭 분석 진단**이다. 신규 원화/프레임이나 출시 증빙 화면으로 게시하지 않는다.

이 작업에서는 메인 authoring 코드/문서/원화 편집, 빌드, Full/World, 브라우저, commit/push를 하지 않았다. 게임 내 향로의 접점 변환·손잡이 정렬·몸통 앞뒤 표시 순서·가려진 손의 overlay 숨김은 부모 구현에서 별도로 확인해야 한다.
