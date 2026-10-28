# ASHVEIL 원본 포자 인간 첫 외형

`Creature.SporeMan.char`의 실제 목록 `spore0`, `spore1` 중 첫 외형 **spore0만** 새로 그렸다. 입력 이미지를 읽지 않는 정수 좌표 원본 아트다. 외부 팩 추출·재색칠·기존 이미지 변형을 하지 않았다. PNG/SVG·픽셀 캔버스/글자 출력 소프트웨어는 앞서 직접 작성한 원본 도구의 작은 표준 라이브러리 패턴을 재사용하며 캐릭터 좌표는 새로 작성했다. 프로젝트를 위해 제작했고 프로젝트와 같은 사용 조건으로 제공한다.

CANON §7.3, lore/bestiary §18, world-bible의 수도원 병동·순례자 설정, 실제 Creature.SporeMan 정의를 읽었다. **장막 포자에 잠식된 인간 순례자**이므로 얼굴·목·두 팔·두 다리·해진 순례복과 작은 목걸이를 남겼다. 두피·어깨·팔에 비대칭 회녹색 포자 껍질과 자줏빛 아랫면을 붙여 옷/피부/포자 조직을 구분한다. 큰 버섯 갓 하나를 인간 머리로 대체하지 않았고 발광 눈·언데드 뼈·새 무기는 그리지 않았다. 순례자가 맨손을 들어 공격한다. 정적인 포자 덩어리는 실제 포자 구름/피격 규칙을 구현하거나 변경하지 않는다.

## 계약과 산출물

제작 전에 읽은 `src/client/sprites.json`의 spore0는 `mon2` 공유 시트의 24×32 프레임 12개를 쓴다. walk 4방향×3키(`spore0_w_{down,left,right,up}{0,1,2}`)와 방향별 idle의 `w_*1` 참조를 두 조각 모두 그대로 보존한다. 아래 두 조각은 표현 설정을 구분한다.

- **완전한 통합 제안** `ashveil-spore0-frames.json`: 새 떠돌이·약탈자·그늘 사람과 같은 픽셀 밀도를 위해 `renderScale=1`을 사용한다. 원본 모든 걷기 자세의 머리 꼭대기는 y3이고 마지막 발 픽셀은 y29다. 발 픽셀이 차지하는 마지막 구간 [29,30)의 바로 아래 경계 y30을 지면에 맞추므로 anchor와 attackAnchor는 `[0.5,30/32] = [0.5,0.9375]`다. 실제 지면 y30에서 머리 꼭대기 y3까지 `headOffset=27`로 표시한다. 위쪽 공격에서 올라간 주먹은 머리 높이에 포함하지 않는다. 보행/공격 모두 셀24×32라서 몸의 추가 오프셋은 없다. 이는 스프라이트 표현만 바꾸며 Core 체격·시야·캐릭터 키·걷기 순서는 바꾸지 않는다.
- **기존 계약의 역사 자료** `ashveil-spore0-walk-only.fragment.json`: 기존 anchor(0.5,0.92), renderScale 미지정(제작 당시 기본0.72), headOffset 미지정(제작 당시 기본22)을 원본 바이트 그대로 보존한다. SHA256은 `f110c74bddcede3b20166db720b595550ddd35501ec54d77a332a3f5efd2f246`다. 새 밀도의 완전 통합용으로 혼용하지 않는다.

- `ashveil-spore0-walk.png/svg`: 새 72×128 시트, 셀24×32. 방향 행은 down/left/right/up, 열은 왼걸음/정지/오른걸음이다.
- `ashveil-spore0-attack.png/svg`: **선택적 새 공격** 96×128 시트, 같은24×32 셀에 4방향×4자세(준비/당김/타격/복귀). 기존 spore0에는 attack 키가 없으므로 `spore0_a_*`16개를 명시적으로 새로 제안한다. 완전 조각은 위의 새 바닥 앵커를 적용한다.
- `ashveil-spore0-frames.json`: sheets/frames/완전한 chars.spore0 조각. 선택적 공격까지 포함한다.
- `ashveil-spore0-walk-only.fragment.json`: 기존 walk/idle·0.92 앵커를 보존한 역사 조각. 새 배율/바닥 앵커의 완전 통합 조각과 구분한다.
- `ashveil-spore0-contact.png`: 원본28자세를 4배로 보여 주는 검토 시트. 실제 게임 촬영 자료가 아니다.
- `ashveil-spore0-palette.json`, `ashveil-spore0-integrity.json`: 팔레트와 제작 도구/출처/산출물/자세 SHA256, 알파·치수·바닥 검사.

제안 이미지 경로는 `public/sprites/original/`이다. 실제 게임 manifest/Core/Def/공유 시트와 spore1을 수정하지 않았다. 게임 저장 각인의 char 키 spore0는 유지한다. 휴면/기도 자세나 포자 구름은 새 행동·상태를 만들어 여기서 연결하지 않는다.

```sh
python3 draw-spore0.py
python3 draw-spore0.py --check
```

제작 도구는 이 격리 폴더에만 출력한다. `--check`는 정확한 산출물 바이트를 재계산해 읽기 전용으로 비교한다. 게임 브라우저/GPU/전체 검증은 이 원본 제작 범위에 포함하지 않는다.
