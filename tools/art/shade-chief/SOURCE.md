# ASHVEIL 원본 그늘 우두머리

정확한 실제 Def ID는 **Creature.ShadeChief**, 캐릭터 키는 **shade_chief**다. Creature.ShadeLeader라는 Def는 없다. `src/content/core/defs/creatures.json`, `src/client/sprites.json`, CANON D26/D32, lore/bestiary §17, factions §8.1을 읽었다. 작은 체구의 창백한 인간 후손이며 일반 그늘 사람과 같은 인간형 신체·small 체형을 유지한다.

픽셀 좌표는 직접 새로 작성했다. 외부 이미지 입력·외부팩 추출·재색칠을 하지 않았다. 기존 자체 원본 도구의 표준 라이브러리 캔버스/PNG/SVG/글자/manifest 출력 소프트웨어를 재사용한다. 프로젝트를 위해 제작했고 프로젝트와 같은 사용 조건으로 제공한다.

우두머리는 폭넓은 검은 동공·창백한 얼굴과 두 팔·두 다리를 가진 작은 성인이다. 누더기 셔츠의 접힌 옷깃, 비대칭 꿰맨 앞자락, 묶은 천의 눈썹선으로 일반0–3과 구분한다. 새 왕관·뿔·갑옷·지팡이·방패·거인 체구는 추가하지 않았다. 실제 loadout은 녹슨 칼/사냥칼 중 선택, 누더기 셔츠와 일부 선택적 잡동사니다. 선택·무장해제가 가능한 물건을 항상 든 것처럼 고정하지 않도록 몸 원본과 선택적 공격은 맨손으로 그린다. 무기/능력/기물/신체 규칙은 이 아트가 생성하거나 바꾸지 않는다.

## 기존 계약과 새 제안

- 기존 `shade_chief_w_{down,left,right,up}{0,1,2}`12개와 각 방향의 idle=`w_*1` 참조·순서를 유지한다. 보행은 셀24×32, 시트72×128이다.
- 기존 우두머리에는 공격 키가 없다. 새 선택적 `shade_chief_a_*`16개를 셀32×40, 시트128×160으로 제안한다. 일반 원본 그늘 사람과 같은 공격 시트 규격이며, 보행 몸을(4,8) 오프셋으로 배치해 지면을 맞춘다.
- 완전한 `ashveil-shade-chief-frames.json`은 `renderScale=1`, 보행 anchor(0.5,31/32), 공격 attackAnchor(0.5,39/40), `headOffset=22`다. 모든 보행 머리 꼭대기는 y9, 마지막 발 픽셀은 y30이므로 지면 경계31−머리9=22다. 공격 발 마지막행38·경계39에서 몸 오프셋8을 빼면 같은 지면31이다. 올라간 공격 손은 머리 높이에 포함하지 않는다.
- `ashveil-shade-chief-walk-only.fragment.json`은 비교용 역사 자료로 기존 anchor(0.5,0.92)와 미지정 배율/머리높이를 보존한다. 새 native 밀도의 통합에는 완전한 조각을 사용한다.

원본 보행/공격 PNG+SVG, 28자세 contact PNG, 팔레트, 완전한 manifest 조각과 역사 조각, integrity JSON을 제공한다. 제안 경로는 `public/sprites/original/`이다. contact는 원본 검토 시트이며 실제 게임 화면이 아니다. 제작 범위는 이 격리 폴더뿐이며 게임 Root/Core/Def/Git/공용 시트/manifest는 수정하지 않는다.

```sh
python3 draw-shade-chief.py
python3 draw-shade-chief.py --check
```

제작 도구는 외부 패키지·이미지 입력 없이 자기 폴더에만 산출물을 쓴다. `--check`는 생성 바이트를 읽기 전용으로 대조한다. 제작/원본 검사는 가벼운 로컬 바이트·프레임·알파 확인뿐이며 브라우저/GPU/프로젝트 전체 검사는 실행하지 않는다.
