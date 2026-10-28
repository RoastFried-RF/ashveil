# 플레이어 전용 잿빛 여행자 원본 — 적용 전 격리 묶음

2026-10-21 제작. `/workspace/ashveil-player-art` 안에서 새 정수 좌표로 그린 주인공 표시용 원본이다. 새 캐릭터 키는 **`original_wanderer_hero`** 하나다. 게임의 기존 `hero`·NPC·은퇴 주민 외형과 프레임, 저장된 `Creature.sprite`, Core·Def·공용 manifest·Git은 변경하지 않았다. Root가 나중에 실제 `playerId`의 표시만 선택할 예정이다. **아트 제작/독립 픽셀 검사 완료, 게임 미등록·실제 UI 미검토** 상태다.

## 정본과 시각 방향

CANON의 이름 없는 떠돌이와 D13의 처음부터 닳은 재질, world-bible의 평범한 변경 여행자를 따른다. 새로운 이름·직업·장비·기술·종족을 추가하는 제안이 아니다.

낮은 각진 회색 후드, 먼지 올리브/잿빛의 낡은 중립 외투, 짧은 리넨 목깃, 밝은 어깨의 닳은 테두리와 분리된 두 발을 직접 설계했다. 앞모습의 작은 따뜻한 피부와 옆모습의 코·목깃은 방향을 식별하게 하며 뒷모습에는 후드의 접힌 면과 등 옷의 다른 명암을 넣었다. 작은 허리 천 주머니와 평범한 띠는 여행복의 시각 해석이다. 실제 배낭 크기·소지품·장비 슬롯을 그림으로 확정하지 않는다.

특정 검·창·활·방패, 판금 갑옷·투구·직업 문장·성별 표식·수염을 넣지 않았다. 공격 4포즈는 준비→들기→내밀기→돌아오기의 어깨/빈손 동작이다. 이것은 새로운 맨손 기술이나 실제 장착 무기의 공격 방식을 규정하지 않는다. 품질·내구도·방어력·성별·상처·피부 선택·배경·현재 장비가 고정 그림으로 판정된다는 뜻이 아니다. 장비별 오버레이나 초상 교체는 이번 범위가 아니다.

기존 자체 NPC와 같은 작은 인간 픽셀 밀도와 저채도 천·피부·가죽을 사용하되, 기존 주인공의 청록 도안이나 NPC 도형을 복사·편집·재색칠하지 않았다. 원본/타사 이미지 입력·추출·크롭·트레이싱이 없다. 새 다각형·선·사각형의 좌표와 포즈 구성을 소스에 직접 작성했다. 왼쪽은 이 새로 작성한 오른쪽 도형을 같은 인물의 좌향으로 반사한 것이며 외부 픽셀 추출이 아니다.

## 실제 기존 표시 계약 조사

`tools/art/player-reference-contract.json`에 조사 당시 `sprites.json`의 실제 hero 계약/28프레임, 현재 renderer/helper/UI 참조의 파일 SHA를 기록했다. 참고 JSON에는 기존 이미지 픽셀이 없고 생성기는 MAIN이나 기존 시트를 읽지 않는다.

| 항목 | 기존 hero | 신규 전용 원본 |
| --- | --- | --- |
| 걷기 | 4방향 ×3, 셀24×32, 시트72×128 | 같은 규격, 새12포즈 |
| 대기 | 각 방향 기존 walk1 | **각 방향 새 walk0** 재사용 |
| 공격 | 4방향 ×4, 셀32×40, 시트128×160 | 같은 규격, 새16포즈 |
| 걷기 앵커 | `[0.5,31/32]` = `[12,31]` | 동일 |
| 공격 앵커 | `[0.5,39/40]` = `[16,39]` | 동일 |
| 공격 몸체 오프셋 | 걷기 기준 `[4,8]` | 동일 |
| renderScale / headOffset | `1 / 30` | 동일 |
| native 불투명 몸 높이 | 걷기 y1..30, 공격 y9..38 | **모든28포즈 동일30px** |
| 지면 | 걷기31, 공격39 | 동일 |

셀 좌표는 0 기반이다. 새 걷기에서 마지막 불투명 행은30이고 그 픽셀의 아래 모서리는31이다. 공격에서 마지막 불투명 행은38, 아래 모서리는39다. `[12,31]+[4,8]=[16,39]`이므로 프레임 종류가 바뀌어도 같은 actor 원점에 발 아래 모서리가 놓인다. 포즈별로 발 간격·보폭은 달라도 지면 앵커는 고정이다. 머리 꼭대기까지의 차이도 `31−1=39−9=30`으로 같아 기존 headOffset30을 유지한다.

전체 포즈의 불투명 경계 합집합은 걷기 `[2,1,20,30]`, 공격 `[1,9,30,38]`이다. 각 셀의 외곽 한 줄은 투명하며 옆 공격의 팔 뻗기는 넓은 공격 셀 안에 들어간다. 모든 프레임의 개별 경계·불투명 픽셀 수는 source JSON에 기록하고 별도 검사기가 다시 계산한다.

현재 renderer는 월드 타일16px에서 actor 원점을 `tile.x×16+8, tile.y×16+14`에 둔다. 새 앵커도 같은 원점을 사용하므로 발은 기존처럼 타일 아래 끝보다2월드px 위에 놓인다. 기본 그림자는 반경 `[6,2]`이고 새 char는 별도 shadow/healthBarWidth 값을 추가하지 않는다. `renderScale:1`은 네이티브 도트를 그대로 쓰기 위한 명시값이며 카메라/월드 타일/시야/가시성/피격·클릭 규칙을 바꾸지 않는다. 이 그림에는 별도 충돌 모양이 없다.

현재 걷기는 `floor(t×3)%길이`, 공격은 `min(길이−1,floor(attackT×길이))`로 프레임을 읽는다. 기존 런타임의 이동 hop·공격 방향 lunge최대5px·호흡·웅크림·피격·사망 표현은 renderer가 담당하며 이 묶음에서 바꾸지 않았다. 기존 8방향 facing은 `up,right,right,right,down,left,left,left` 네 그림 방향으로 해석한다.

## 새 키와 적용 경계

- 새 sheet: `original_wanderer_hero`, `original_wanderer_hero_atk`.
- 새 walk frame: `original_wanderer_hero_w_{down,left,right,up}{0,1,2}`.
- 새 attack frame: `original_wanderer_hero_a_{down,left,right,up}{0,1,2,3}`.
- 새 char: `original_wanderer_hero` 하나. 새 idle은 각 방향의 새 walk0 한 개를 참조한다.
- fragment에는 `sheets`2개·`frames`28개·`chars`1개만 있다. 기존 key 교체·anims·Def·표시 alias·기본 sprite 변경은 없다.

현재 `creatureSprite(w,c)`는 해당 Creature Def의 `characterAliases[c.sprite]`를 한 번 적용하며 playerId 전용 분기가 없다. 따라서 기존 `hero`를 전역 대체하거나 공통 NPC Def의 alias를 이 키로 바꾸면 은퇴 주민 등도 영향을 받는다. 이 패키지는 그러한 변경을 하지 않으며 Root의 후속 플레이어 전용 연결과 구분한다.

또한 조사 시점 `Hud.vue`·`CharacterWindow.vue`·`TitleScreen.vue`에는 `hero_w_down1`을 직접 읽는 fallback이 있다. 새 fragment만으로 그 fallback이나 기존 초상이 자동 변경되지는 않는다. 실제 게임/방향 전환/공격/발 앵커·HUD에서의 표시와 플레이어만 선택되는지는 Root 통합 후 실제 입력으로 따로 검증해야 한다.

## 파일과 재현

| 파일 | 용도 |
| --- | --- |
| `public/sprites/original/ashveil-player-wanderer-walk.png` / `.svg` | 새 보행12포즈,72×128 RGBA/SVG동일픽셀 |
| `public/sprites/original/ashveil-player-wanderer-attack.png` / `.svg` | 새 공격16포즈,128×160 RGBA/SVG동일픽셀 |
| `public/sprites/original/ashveil-player-wanderer-contact.png` | 744×1264,28포즈3배 검토·발아래 가이드 |
| `ashveil-player-wanderer-palette.json` | 새22색,알파0/255 |
| `ashveil-player-wanderer-frames.json` | 전체 새 시트/28프레임/char 조각 |
| `ashveil-player-wanderer-source.json` | 생성기/조사snapshot/산출물SHA·포즈별경계·출처·권리 |
| `tools/art/player-manifest.fragment.json` | frames JSON과 같은 바인딩 조각 |
| `tools/art/draw-player-wanderer.py` | 외부 의존성 없는 새 좌표 제작 및읽기전용 `--check` |
| `tools/art/check-player-wanderer.py` | 생성기를 import하지 않는 별도 PNG/SVG/계약 검사 |
| `tools/art/player-reference-contract.json` | 실제 기존 표시 계약과 소스 해시 snapshot |
| `docs/art-player-wanderer-verification.json` | 독립 검사 결과 |
| `docs/art-player-wanderer-integrity.json` | 문서/권리/도구를 포함한 최종파일 해시 |
| `LICENSE.txt` | 새 원본/도구/문서 CC0-1.0 선언 |

생성기는 포함된 좌표·로컬 참고 snapshot만 읽는다. PNG원본·SVG·검토시트는 표준 라이브러리로 직접 출력한다. PNG/SVG를 임의로 후처리하거나 기존 hero의 픽셀을 입력하지 않는다.

```sh
cd /workspace/ashveil-player-art
python3 tools/art/draw-player-wanderer.py --check
python3 tools/art/check-player-wanderer.py
```

완료 결과: 생성9파일 재현 PASS, PNG CRC/단일종료IEND/압축stream·두PNG/SVG전픽셀 일치 PASS, 28포즈 전부서로다름 PASS,22색/알파0·255/셀외곽투명/모든몸높이30/지면31·39 PASS, 새프레임 계약/idle0/단일신규char PASS, 접촉시트28프레임3배 픽셀·배경/발가이드 대조 PASS,8개산출물 해시와 제작/조사SHA PASS. 전체 검토 시트와 실제 보행/공격 PNG원본3장을 `view_image`로 각각 직접 열었다.

이 검사는 아트와 정적 계약의 검사다. 게임/DB/세이브/Core·Full·Type·브라우저·GPU·전투·시야·장착·NPC 보존의 실제 실행 검사는 하지 않았다.

## 권리와 대표 SHA-256

새 원본/좌표/팔레트/도구/문서는 **CC0-1.0**이다. 상업 이용·수정·재배포·2차게임/모드/에셋패키지 포함을 허용하며 별도 허가와 출처 표기를 요구하지 않는다. 기존 게임 코드/이미지나 참고 snapshot에 기록된 외부 파일의 권리는 바꾸지 않는다. Root에 복사할 때 프로젝트 루트 라이선스를 덮어쓰지 말고 이 선언의 바이트를 `tools/art/player-LICENSE.txt`로 보존할 수 있다. 검사기는 그 경로가 있으면 우선 읽고, 격리 묶음에서는 루트 `LICENSE.txt`를 읽는다.

| 파일 | SHA-256 |
| --- | --- |
| 보행PNG | `d5cbebebf93e45a8b3b348d6f7be7a808734b8fe6a61f9e53ca26a15fd5e6d25` |
| 공격PNG | `2b6bb59825055c33cdaa7e138419b3333eafc78b034211b731d52f8910e9783b` |
| 접촉시트 | `74384be57ed9f4ab4ae31c7978a402d5bb36e4c5ceb0fad80b69bc281d1e88f7` |
| 조각JSON | `c52e6cea5d42fb44ae9fb6bd01a07c2cead6c0d339e4ed65ba19eda20511c3d5` |
| 제작소스 | `4eb4a741599a53e713d323e0dd71ccbbab7e29a23241cfc913751393fb680e7e` |
| 별도검사기 | `cf4bf20318b7516863d33f71184bd88fce4ec1aedd0f8e63eba06418507a5579` |
| 권리선언 | `8c958a03182f5cb28e7a2b9247c3ca1d87f07d5cbc977ae253b0cfa2545a2180` |

## v0.295 통합 작업 중

Root가 원본16파일을 정확 복사하고 새 sheet2·frame28·char1을 기존 manifest에 추가했다. 명시적인 Def 별칭을 우선한 다음 실제 playerId의 기본 hero 선택만 새 원본으로 표시한다. 저장된 외형과 NPC의 hero는 유지한다. HUD·생성 화면의 초상 아래 대체 그림과 캐릭터 창의 항상 보이는 픽셀 미니어처도 새 idle0을 사용한다. 실제 입력·화면·전체 회귀 검증은 아직 진행 전이다.
