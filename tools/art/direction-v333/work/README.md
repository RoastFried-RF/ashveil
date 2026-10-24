# 사족 work 섭식·물 마시기 원화 확장

확정된 상위 v333의13PNG/224영역, fragment와 기록69파일을 그대로 보존하고 이 `work-extension`에만 추가했다. `frozen-base-hashes.json`의 확정 파일 해시69개를 전후 비교한다. 메인 `src/public/docs`, dist/preview/게임 상태는 수정하지 않았고 빌드·World·전체 검사·commit/push를 실행하지 않았다. 수렵산물7아이콘도 중복 제작하지 않았다.

재뿔사슴과 엄니돼지의 **4방향×work4프레임**, 새 원본2PNG/32고유영역을 등록 제안한다. 기존2모델의 새 동작이며 새 모델2종으로 다시 세지 않는다. 첫 돼지 후보1PNG/16영역은 주둥이가 충분히 낮아지지 않고 일부 앞발이 움직여 제외했다. 실패 원본도 `originals/tuskhog-work-v1.png`에 남기고 [이유](rejected/candidates.json)를 기록했다. 생성 전체는3PNG/48영역이고 등록 제안32영역과 구분한다.

각 원본은 image_gen으로 새로 만들었다. 입력은 확정된 해당 종의 자체 idle 원화이며, 돼지 v2는 실패 v1도 수정 참고로 받았다. 정확한 프롬프트·입력 해시·도구 출력 경로·보존 파일·SHA-256은 `prompts/`와 `records/`에 있다. 도구가 만든 PNG의 바이트를 그대로 복사하고 원래 `/workspace/generated_images` 출력도 남겨 두었다. Pillow는 알파/영역/발 위치/CRC 읽기에만 사용했다.

## 자세와 주기

사슴은 긴 목을 낮춰 입으로 낮은 자원을 집고 씹는 자세, 돼지는 짧고 두꺼운 목과 머리를 숙여 주둥이로 먹거나 마시는 자세다. 사슴 뿔은 땅이나 다른 셀을 관통하지 않고, 돼지는 두 엄니와 사족 구조를 유지한다. 고정 풀·열매·물·그릇을 몸체 그림에 넣지 않아 실제 원래 자원/행동에 결합할 수 있다. 지속 자세는 매번 upright idle로 튀어 오르지 않고 낮은 목 자세 안에서4프레임을 잇는다.

진단 재생 주기는 사슴1800ms·돼지1900ms다. **현재 게임에 이 주기를 적용했다고 주장하지 않는다.** 현재 CharDef에는 동작별 주기 필드가 없고, 렌더러의 기본 work는1000ms다. 실제 섭식 presentation의 `cycle` 또는 검증된 공통 motion duration override가 필요하다. [표현 연결 계약](presentation.contract.json)에 실제 연결점과 중단·이동·자원 보존 조건을 적었다. 애니메이션 시계가 음식/물을 소비하거나 게임 턴을 만들면 안 된다.

입 끝을 단순히 가장 아래 알파 픽셀로 잡으면 실제 발이 뜨거나 매 씹기 프레임마다 몸체가 좌우로 흔들릴 수 있다. 앞 시점은 중앙 입 영역40%를 제외하고 양옆 발을, 옆 시점은 앞쪽 주둥이 영역35%를 제외하고 실제 앞/뒷발을 읽었다. 특히 사슴 정면 프레임2에서 주둥이가 오른쪽 아래로 투영되므로 발 접점 y275를 별도로 유지한다. 해당 `frameTransforms`를 지워 공통 `[.5,1]`로 대체하지 않는다. 원본 배율0.17/0.12와 기존 체격·그림자·보행 주기는 유지했다.

## 통합 파일

- [sprites.work.fragment.json](sprites.work.fragment.json): 새2시트·32프레임·크기, 확정 캐릭터의 기존7동작을 보존하고 work만 더한 편의용 전체 char 사본.
- [character-work.patch.json](character-work.patch.json): **권장** work 전용34개 add 패치. 기존 부모 통합 필드와7동작을 덮어쓰지 않고 work clip2개와 새 foot transform32개만 더한다. 이는 client manifest용 JSON Pointer 패치이며 core Def 패치가 아니다.
- [install-plan.json](install-plan.json): 새2PNG의 실행용 목적 경로와 원본 해시. 원래 상위 fragment는 수정하지 않는다.
- [presentation.contract.json](presentation.contract.json):1800/1900ms 실제 표현 주기와 섭식/음수·위험/이동 중단 연결.
- [validation-proof.json](validation-proof.json): 원본3장의 SHA/CRC, 새32영역, 기존69파일/7동작/rig 보존, 패치 적용 결과의 메모리 사본 비교.

## 검토와 명령

새3원본을 전부 직접 열고, `index.html`의 실제 알파 합성에서 원래 idle과 새4포즈/느린 반복/발 기준점을 비교했다. [phase0](screenshots/phase-0.png)·[phase1](screenshots/phase-1.png)·[phase2](screenshots/phase-2.png)·[phase3](screenshots/phase-3.png)를 확인했다. 원본 미리보기의 숨은 투명 RGB를 실제 불투명 배경이라고 오판하지 않았다. 최종 검사 범위와 해시는 `native-review.json`에 남긴다.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 /workspace/.ashveil-planned/v333-wildlife-art/work-extension/register-work.py
python3 /workspace/.ashveil-planned/v333-wildlife-art/work-extension/validate-work.py
python3 -m http.server 6348 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v333-wildlife-art
node --import /workspace/ashveil/node_modules/tsx/dist/loader.mjs /workspace/.ashveil-planned/v333-wildlife-art/work-extension/capture-review.mts
```

이 비교 페이지는 staging 진단만 로드한다. 실제 게임의 섭식 자원·물량·도주/방어 AI, 동작 속도 설정/대각선·가림·동작 중단과 이동거리 자연스러움은 부모의 메인 통합 뒤 확인해야 한다. 새 원본과 일부 대응 소품을 만들었다는 사실만으로 원래 자원 소비나 수렵산물 아이콘까지 새로 구현했다고 세지 않는다. `activationReady:false`를 유지한다.
