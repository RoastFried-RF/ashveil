# 엄니돼지 wallow 전용 원화 확장

기존 v33313PNG/224영역과 work32영역, fragment/기록을 보존하고 `wallow-extension`에만 새 원화를 작성했다. 기존 확정100파일의 SHA-256은 전후 동일하다. 메인 게임·공유dist/preview·저장 상태·원래 문서는 수정하지 않았고 빌드·World·전체 검사·commit/push를 실행하지 않았다.

채택 제안은 **4방향×6고유포즈 = 새1PNG/24영역**이다. 기존 엄니돼지1모델의 새 동작이며, 새 모델1종으로 다시 세지 않는다. `work` 그림을 뒹구는 동작으로 재사용하지 않았다. 첫 v1의24영역은 옆 시점의 좁은 간격/독립 꼬리 알파 조각과 불충분한 복귀 구분 때문에 제외하고 [실패 원본/이유](rejected/candidates.json)를 보존했다. 생성 전체는2PNG/48영역이며 등록 제안24영역과 구분한다.

## 포즈와 접지

1. 네 다리를 굽혀 몸 낮춤
2. 가슴/배를 땅으로 내리고 다리 접음
3. 옆구리로 몸 굴려 비빔
4. 굴림에서 배/가슴 쪽으로 되돌림
5. 앞발로 밀고 기상 중간 자세
6. 원래4방향의 네발 선 자세 회복

3·4포즈의 몸 시점 변화는 **의도된 굴림**이다. 그 때문에 실제 core facing을 바꾸거나 중간에 다른 방향 행을 선택하지 않는다. 뒤 행의 복귀는 일부 옆구리가 보이는 부분 굴림이며 마지막6포즈는 분명한 뒤 시점으로 회복한다. 앞/좌/우의4포즈는 배를 땅으로 되돌린 자세다. 네 개의 짧은 돼지 다리/갈라진 발굽, 두 엄니, 짧은 목이 붙어 있는지 원본과 합성에서 직접 확인한다.

선/기상 포즈는 발 접점, 접힌 포즈는 가슴/배 접점, 굴린 포즈는 어깨/옆구리 접점을 `frameTransforms`에 등록했다. 접힌/굴린 그림을 선 키로 늘리지 않고 각 방향의 마지막 실제 선 포즈를 기준으로 행 전체 배율을 한 번 맞춘다. 원래 idle 체격과 함께 보며 확인할 수 있다. 새 원화에 고정 진흙바닥·웅덩이·물·먼지/자원·소품을 굽지 않았다. 몸의 기존 갈라진 진흙 무늬만 정체성으로 유지했다.

v2의 제안 crop 사이 간격은 최소19px이며 불투명 픽셀이 선택 crop 경계를 넘어 이웃 실루엣과 연속되는 경우는0이다. 첫 v1의 원문/알파 실패도 지우지 않았다. 검사 수치만으로 머리/다리 의미나 자연스러움을 통과했다고 세지 않는다.

## 파일과 실제 연결

- [sprites.wallow.fragment.json](sprites.wallow.fragment.json): 새1시트·24프레임·크기와 편의용 전체 char 사본. 사본은 현재 통합된 CharDef를 읽어 기존 work 주기도 보존했다.
- [character-wallow.patch.json](character-wallow.patch.json): **권장** client manifest용26add. 새 wallow clip/2400ms와 새24ground transform만 추가해 부모의 다른 필드를 덮어쓰지 않는다.
- [install-plan.json](install-plan.json): `tuskhog-wallow-v2.png` 목적 경로와 SHA-256. v1은 실행 manifest에 등록하지 않는다.
- [presentation.contract.json](presentation.contract.json): 전용 MotionName/priority/action alias/이동·회전 중단과 실제 코팅 규칙 분리.
- `records/*.json`, `prompts/*.txt`: 도구 출력 경로, 정확한 프롬프트, 자체 입력 원화와 해시, 보존/실패 이유.

제작 초기에 관찰한 코드에는 성공한 `wallow`100TU와 실제 코팅/비 세척이 있었지만 표현 alias는 work이고 MotionName에는 wallow가 없었다. 부모는 이후 전용 MotionName·2400ms·priority1·별도 action 매핑·이동/피격 중단·시작 방향 보존을 추가했다고 알렸다. 이 계약은 그 연결과 새 원화의 정합 조건이며 코드 변경 승인을 기다리는 문서가 아니다. 이번 작업에서는 메인 게임을 실행하지 않았으므로 실제 방의 최종 검토는 부모가 이어간다. 애니메이션이 진흙 코팅을 추가하거나 물/아이템을 생성하면 안 된다.

## 검토/검증

새2원본과 [phase0](screenshots/phase-0.png)·[phase1](screenshots/phase-1.png)·[phase2](screenshots/phase-2.png)·[phase3](screenshots/phase-3.png)·[phase4](screenshots/phase-4.png)·[phase5](screenshots/phase-5.png)의 실제 알파 합성을 직접 연다. 각 위상에 원래 idle과 새6포즈, 발/몸 지면선을 함께 표시해 사지·엄니·목·가림·몸의 바닥 관통·이웃 털/꼬리 혼입을 검토한다. 최종 직접 검토 범위는 `native-review.json`에 해시와 남긴다. staging 화면은 게임을 로드하거나 실제 코팅/세계 상태를 바꾸지 않는다.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 /workspace/.ashveil-planned/v333-wildlife-art/wallow-extension/register-wallow.py
python3 /workspace/.ashveil-planned/v333-wildlife-art/wallow-extension/validate-wallow.py
python3 -m http.server 6349 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v333-wildlife-art
node --import /workspace/ashveil/node_modules/tsx/dist/loader.mjs /workspace/.ashveil-planned/v333-wildlife-art/wallow-extension/capture-review.mts
```

PNG는 image_gen 도구 출력과 같은 원본 바이트다. Pillow는 알파/영역/접점/CRC 읽기에만 썼고 PNG를 수정·크롭 저장·재색칠·리샘플링하지 않았다. 반전·역순·기존 포즈 재사용을 신규 프레임으로 세지 않는다. 아트와 등록 바이트는 `art-final.json`의 해시로 확정한다. 이후 register를 재실행해 확정 자료를 덮어쓰지 말고 변경이 필요하면 새 후보/확정 묶음으로 만든다. 실제 게임의 코팅/비 세척·행동 중단·속도 설정·가림/지형 충돌 검증은 부모 통합 뒤 남아 있어 `activationReady:false`를 유지한다.
