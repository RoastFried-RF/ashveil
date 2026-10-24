# v340 측량기 회수품 독자 원화4종

실제 `tools/content-plans/expanded-creatures-v331/core-fragment/defs/harvest-v331.json`의 네 물품과 `Body.Surveyor.mechanical.salvage`, 베스티어리 §12, CREDITS의 프로젝트 자체 산업물품/v303 제작 기록을 읽었다. 기존 자체 측량기 idle, 합금 조각·저출력 전원셀·기계 패치·유리눈 PNG를 직접 보아 재질·물리 구조·소지품 크기 기준을 대조했다. 생성 입력은 그중 **자체 측량기+합금 조각+저출력 전원셀**3PNG뿐이다. 타 게임 픽셀·외부 에셋·트레이싱은 사용하지 않았다.

**새1PNG의 독립된4고유 원본 영역**이다. 네 개를 별도 생성PNG4장이라고 세지 않는다. 새 픽셀은 image_gen으로만 제작했고 원문과 입력/출력 SHA·정확한 프롬프트/인수·도구 출력 경로를 보존했다. 첫 후보는 원본 재질/형태와 최종 축소 검토에 통과했으며 실패/삭제 후보0개다. `active:false`이며 부모가 원본/등록을 연결하는 단계가 남았다.

| 실제 계획 물품 | 정확 frame키 | 원래칸 | 원화에서 확인한 구조 |
|---|---|---|---|
| Item.SurveyLens · 측량 렌즈 | av331_survey_lens |1×1|곡면의 어두운 광학유리·동심 렌즈 고정환·합금/황동 테두리|
| Item.AntennaWire · 안테나 선재 | av331_antenna_wire |1×1|구리 코일·붙어 있는 두 끝·약한 녹청|
| Item.LightLegFrame · 경량 다리 프레임 | av331_light_leg_frame |1×2|삼각 비움이 있는 합금레일·무릎 관절·하부 스트럿·붙은 발판|
| Item.ThermalSensor · 열 감지 부품 | av331_thermal_sensor |1×1|사각 검은 IR창·금속 케이스/측면 방열홈·아래 접점|

선재의 구리300g, 다리의 합금800g, 렌즈/센서 유물 필드와 원래 소지품 크기를 유지한다. 원래 측량기의 회수는 렌즈1·선재2·다리1·열감지1(각chance1), 저출력 전원셀1(chance.5)이며 그 수량·조건을 바꾸지 않았다. 전원셀은 기존 원화가 있어 이번 신규 수에 포함하지 않는다. 아이콘의 코일/접점 개수가 실제 회수량을 만들지 않는다. [물품 원문 스냅샷](planned-item-defs.snapshot.json)·[원래 회수 규칙](surveyor-salvage.snapshot.json)은 참고이며 새 Def 등록 파일이 아니다.

## 원본과 등록

원본은1254×1254 `originals/surveyor-material-icons-v1.png`다. 영역순서는 왼위 렌즈, 오른위 선재, 왼아래 다리, 오른아래 열감지다. 전체가 닫힌 물품이며 링/선 끝/다리 상단·발판/접점이 잘리지 않았다. 바닥·그림자·손·다른 물체·UI·라벨·마법광·열지도는 넣지 않았다. 렌즈의 작은 반사는 작동/발광이나 전원 공급을 뜻하지 않는다. 다리 발판은 해당 부품에 붙은 물리적 플랜지다.

- [sprites.fragment.json](sprites.fragment.json):1시트·실제 시트크기·정확4crop. 원본 PNG를 `public/sprites/original/direction-v340/`에 바이트 그대로 복사한 후 부모 registry에 병합할 제안이다.
- [items.fragment.json](items.fragment.json): 기존 계획 Def의4sprite 키와 소지품 크기에 대한 비활성 매핑. 원래 Def가 이미 같은 키를 쓰므로 **새 Item Def/패치를 추가할 필요가 없다.** 스냅샷을 다시 등록하면 안 된다.
- [install-plan.json](install-plan.json): 원본 목적 경로/SHA와 이 통합 조건.
- `requests/`, `records/`: 정확 image_gen 인수/프롬프트·자체 입력과 SHA·원래 출력 경로·보존본 SHA. 생성 도구가 공개하지 않은 모델 버전은 추정하지 않았다.
- [source-survey.json](source-survey.json): 읽은 정의/기존원화/크레딧과 ItemIcon.vue의 실제 종횡비 유지 공식, v338 불변 기준선.

실제 알파≥16영역에서4px 여백을 두었다. 가로crop 간격최소223px, 세로밴드crop 간격138px다. PNG 전체 가장자리/4crop 경계의 알파≥16잘림0, 다른 큰 물품 혼입0, 연결 물품 픽셀 손실0이다. Pillow/NumPy/SciPy는 픽셀/알파·연결 영역·기준·CRC/해시 **읽기만** 수행했다. PNG 잘라 저장·배경 제거·리샘플링·재인코딩·재색칠을 하지 않았다.

## 실제 축소 검토

원본과 최종 [32px/실제칸비율](diagnostics/four-icons-native32.png), [어두운/밝은/검정 알파 합성](diagnostics/alpha-comparison.png)2장을 직접 열었다. 16px·32px·32×64px 및 정수4배 진단으로 색/렌즈·선재·긴 다리·사각센서를 구분했다. 실제 `ItemIcon.vue`는 `min(box.w/frame.w,box.h/frame.h)`로 전체crop을 종횡비 유지해 칸에 맞춘다. 최종 native 진단도 추가 가짜여백/늘임 없이 이 공식을 썼다. 실제 게임 컴포넌트를 로드해 검증한 것은 아니다.

32px에서 광학유리/고정환과 구리의 코일 구멍·끝, 관절/발판, 사각 IR창·접점이 구분된다. 긴 다리는 실제1×2칸/32×64에서 더 세부 구조가 보인다. 모든 미세 흠집·관절비움이16/32px에서 유지된다고 주장하지 않는다. 별도canvas 진단은52개·브라우저오류0·게임로드false다. 전체 페이지 PNG도 보존했지만 실제로 열어 본 최종 검토 캡처는 위2장이다. [native-review.json](native-review.json)에 그 SHA와 범위를 남겼다.

실제 게임의 인벤토리·툴팁·회수/제작·끌기/배치 입력은 부모 통합 후 검토해야 한다. 이 원화 묶음은 새 회수 수량·재료·유물 효과·생성/기계 상태를 활성화하지 않는다. 범위 내 바이트/참조 검사와 실제 게임 출시 수락을 구분한다.

```sh
python3 /workspace/.ashveil-planned/v340-surveyor-materials/register-materials.py
python3 /workspace/.ashveil-planned/v340-surveyor-materials/validate-staging.py
python3 -m http.server 6353 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v340-surveyor-materials
node /workspace/.ashveil-planned/v340-surveyor-materials/capture-staging.mjs
```

SHA/PNG CRC·정확crop/물품키·원래4Def/5salvage·불변v338전33파일 검사는 [validation-proof.json](validation-proof.json)에 있다. 최종 원문/등록은 [art-final.json](art-final.json)에 동결했다. 메인src/public/docs/dist·게임상태·이전staging은 수정하지 않았고 빌드·Full/World·commit/push를 실행하지 않았다. 독립 진단서버는 검토 후 종료했다.
