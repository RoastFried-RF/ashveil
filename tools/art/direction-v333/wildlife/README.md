# v333 재뿔사슴·엄니돼지 독자 원화 준비

`v331-creatures`를 보존하고 별도 staging에 제작했다. 기존 게임의 `src/public/docs`, dist/preview/게임 상태를 수정하지 않았으며 빌드·전체 검사·World·commit/push를 실행하지 않았다. 적용한 프로젝트 제작 절차는 `.agents/skills/ashveil-character-motion/SKILL.md`다.

두 종 모두 **앞/좌/우/뒤4방향과 idle/walk/attack/hurt/fall/sleep/rise 각4프레임**을 갖춘 등록 제안을 준비했다. 캐릭터 키는 v331 Def와 같은 `av331_ashhorn_stag`, `av331_tuskhog`이고 프레임/시트 키는 `av333_*`다. 기존 늑대/굴쥐를 새 종으로 이름만 바꿔 세지 않았다.

## 원본과 실제 수량

- image_gen으로 생성한 새 원본 **13PNG / 272원본 영역**. 기존 자체 hound 원화는 스타일/카메라 참고만 했고, 이후에는 직접 생성한 각 종의 idle 시트를 정체성 입력으로 사용했다. 원본13장을 전부 직접 열었다.
- 제안하는 것은 **12PNG의224고유 원본 영역**이다. 모델은 **2종**이고 원본13장 또는 캐릭터 등록키 수를 모델13종으로 세지 않는다.
- **48영역은 제외**했다. 첫 hurt/fall 시트의 fall32영역은 앞/뒤가 옆으로 돌아 눕는 방향 변화 때문에 별도 sternal-collapse fall-v2로 대체했다. 첫 돼지 hurt16영역은2프로필 경계에서 각1픽셀의 불투명 연속 경계가 확인되어 통째로 제외하고 넓은 간격의 hurt-v2로 대체했다. [원본·좌표·실패 이유](rejected/regions.json)는 보존했다.
- 반전/역순 재생/중복 원본 영역을 새 프레임으로 세지 않았다. 제안224영역의 선택 crop에는 불투명 연속 경계 잘림0이다.

모든 생성 PNG는 `/workspace/generated_images`의 도구 출력과 같은 바이트를 `originals/`에 복사했고 원래 출력도 남겨 두었다. `records/*.json`과 `prompts/*.txt`에 정확한 입력 원화, 프롬프트, 출력 경로, 크기, SHA-256, 채택/제외 이유를 기록했다. Pillow는 알파/영역/기준점/CRC를 읽는 데만 썼다. PNG의 재색칠·크롭 저장·리샘플링·픽셀 수정은 하지 않았다.

## 모양·접지·크기

사슴은 긴 사족/갈라진 발굽/가지형 뿔/작은 꼬리, 돼지는 낮고 넓은 몸/짧은 사족/두 엄니/갈라진 진흙 껍질로 구분했다. 보행은 좌우의 앞·뒷발이 교대하는4포즈이며 공격은 각각 뿔을 낮춰 밀기/엄니로 밀기다. 앞 행은 얼굴·가슴, 뒤 행은 엉덩이·목 뒤를 보여 주며 좌/우는 실제 별도 행을 사용한다.

`sprites.fragment.json`은 원본을 그대로 참조하고 JSON crop/foot anchor/scale만 등록한다. 각 pose의 발 접지 anchor는 실제 불투명 하단 접촉부에서 읽었고, 원본 크기가 작은 다중동작 시트는 해당 방향의 실제 서 있는 포즈를 기준으로 배율을 맞췄다. 누운 포즈를 서 있는 키로 늘리지 않는다. `frameTransforms`의 개별 anchor를 보존해야 한다.

- 사슴: 기본 배율0.17, 대기 높이 약43–47월드px(뿔 포함), 머리 표식49, 그림자17×6, 보행 주기850ms.
- 돼지: 기본 배율0.12, 대기 높이 약25–27월드px, 머리 표식30, 그림자14×5, 보행 주기800ms.
- 인간의 손 장비를 붙이지 않도록 두 모델 모두 `heldItems:false`다. 그리기 가림 순서는 기존 발 위치 기반 개체 정렬을 사용한다.

이번은 요청된 최소4프레임부터 검토한 묶음이다. 기존 v322의12보행 프레임과 동일한 촘촘함을 완성했다고 주장하지 않는다. 각 포즈의 의미/발 교대는 원화와 진단 합성에서 봤으며 실제 타일 이동 거리·대각선·부상·동작 중단·플레이 속도별 자연스러움은 메인 통합 후 별도 확인해야 한다.

## 확인한 화면과 검증

`index.html`은 원본 PNG를 브라우저에서 실제 알파 합성하고 발 접지 기준점을 표시하는 **staging 전용** 비교 페이지다. 게임이나 월드 상태를 로드하지 않는다. [프레임1](screenshots/phase-0.png), [프레임2](screenshots/phase-1.png), [프레임3](screenshots/phase-2.png), [프레임4](screenshots/phase-3.png)를 모두 직접 열어2종×7동작×4방향의 등록 포즈를 비교했다. 실제 합성에서는 source 미리보기의 투명 RGB 배경/빨강 테두리가 불투명 배경으로 나타나지 않았다. 초기 진단의 favicon404는 data favicon을 넣어 수정했고 최종 [브라우저 관찰](screenshots/browser-observation.json)은 오류0, canvas56, `mainGameLoaded:false`다.

`validate-registration.py`는 원본13장의 SHA/PNG CRC, 제안12시트/224프레임의 파일·범위·불투명도·4방향·실제4영역·anchor/scale을 읽기 전용으로 확인한다. 결과는 [validation-proof.json](validation-proof.json)이다. 전체 게임 스프라이트 검사나 실제 전투 입력을 통과했다고 기록하지 않는다.

```sh
python3 /workspace/.ashveil-planned/v333-wildlife-art/register.py
python3 /workspace/.ashveil-planned/v333-wildlife-art/validate-registration.py
python3 -m http.server 6347 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v333-wildlife-art
node --import /workspace/ashveil/node_modules/tsx/dist/loader.mjs /workspace/.ashveil-planned/v333-wildlife-art/capture-review.mts
```

`register.py`를 다시 돌리면 구조 증거의 시각 상태는 pending으로 돌아간다. 재등록 뒤에는 해당 바이트의 진단 캡처를 실제로 다시 확인해야 한다. 현재 최종 직접 검토 범위와 해시는 `native-review.json`에 따로 남겼다.

## 메인 통합과 남은 범위

원화13장 가운데 실제 제안12장만 `sprites.fragment.json.sheets`의 목적 경로로 복사한다. 채택하지 않은 `tuskhog-hurt-fall-v1.png`는 실행용 manifest에 없다. 실패 원본/프롬프트/기록은 제작 출처로 보존한다. `install-plan.json`에 복사 목적 경로와 원본 해시를 적었다.

메인 캐릭터 manifest에 fragment를 병합한 뒤 실제9종 Def/행동 정책, 가림/충돌/시야, 저장 호환을 확인해야 한다. 독립 초상, 웅크림/막기/사용/먹이/특수 위협·경고 변형, 절단 뿔/엄니·진흙 코팅 변화, 더 촘촘한 보행은 이번 등록 제안에 포함하지 않았다. 사슴이 약한 사람을 사냥하지 않고 돼지의 부상 분노가 정본 정책을 따르는지는 v331 런타임 계약의 미구현 범위다. 이 원화 준비만으로 `activationReady:true`나 출시 완료로 바꾸지 않는다.


## 메인 저장소로 보존한 원본

v333 통합 시 원본13PNG는 public/sprites/original/direction-v333에 같은 바이트로 보존했다. 이 폴더의 read-only 등록/검사 도구는 저장소 위치에 상대적인 그 원본 경로를 읽는다. register.py는 제작 조각/진단 JSON만 갱신하고 게임 sprites.json에 자동 적용하지 않는다. 별도 work32영역은 ../work의 기록과 sprites.json에 연결했다. 실제 정책/게임 검사 결과는 docs의 해당 버전 proof를 따른다. 위 staging 검토 기록을 실제 게임 성공으로 바꾸어 해석하지 않는다.
