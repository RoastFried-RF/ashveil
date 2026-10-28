# ASHVEIL 원본 교역상 resident_trader

실제 `Creature.SettlementTrader`와 상속하는 `Creature.SignalistMerchant`, `Creature.LanternMerchant`를 먼저 조사했다. 세 종은 `Creature.Settler → Creature.Human`의 살아 있는 성인 인간·civilian 규칙과 생활 소지품을 상속한다. 원래 raw char는 셋 모두 hero이고 resident_trader는 **새 표시 전용 char 제안**이다. `trader-usage-survey.json`에 실제 세 Def 원문, 부모 사슬, 상속한 char/loadout/faction/body/sizeClass/ai/inn/description과 읽은 원본 파일 SHA를 담았다. 조사 스냅샷은 raw 정의 상속이며 콘텐츠 patch를 실행하지 않는다.

상속 생활 소지품은 RagShirt/LeatherCoat/Boots/Hood, Hardtack3과 WaterBottle2다. 물품/화폐/재고/거래 역할은 실제 상태가 담당한다. CANON의 낡은 폐허 재질, lore/factions §2의 교역 생활 및 신호회·형제단 상인의 실제 description, world-bible의 교역소를 읽었다. 상인이라고 새 돈·장부·가방·무기·거래 재고를 항상 소유한 것처럼 그림에 고정하지 않았다. 새 세력 문양·직업 특성·효과를 만들지 않는다.

## 새 geometry

어두운 쓸어넘긴 머리와 소박한 회색 관자놀이, 피부·코·눈·입이 남은 성인 얼굴, 회백색 접힌 옷깃과 소매, 짙은 적갈색 겹조끼 형태의 낡은 생활복, 얇게 접힌 허리천, 평범한 바지와 신발을 직접 새 좌표로 작성했다. worker의 올리브색 작업복·짧은 머리, healer의 묶은 머리·앞치마·청록 생활복과 구분한다. 조끼/옷깃/허리천은 기존 옷의 시각 해석이며 새 장비 Item이 아니다. 맨손 동작은 실제 무기를 고정하지 않는 몸 표현이다.

외부 이미지 입력·외부팩 크롭·재색칠·추출·트레이싱을 하지 않았다. 이전에 직접 만든 표준 라이브러리 캔버스/PNG/SVG/선·문자 출력 소프트웨어만 재사용하며 상인 얼굴/머리/몸/조끼/소매/바지/신발/팔 동작은 새 좌표다. 프로젝트를 위해 제작했고 프로젝트와 같은 사용 조건으로 제공한다.

## 표현 계약

- 신규 char `resident_trader`, 신규 walk12/idle 참조와 attack16. 기존 hero·worker·healer의 키나 픽셀은 이 묶음에 포함하지 않는다.
- `resident_trader_w_{down,left,right,up}{0,1,2}`: 셀24×32, 시트72×128, 각 방향 idle=`w_*1`. 방향별 보행 순서는 현재 성인 원본과 같다.
- `resident_trader_a_*`: 셀32×40, 시트128×160, 4방향×준비/당김/타격/복귀.
- `renderScale=1`, 보행 anchor `[0.5,31/32]`, 공격 anchor `[0.5,39/40]`, 공격 몸 offset `[4,8]`.
- 모든 보행 머리 꼭대기 y3, 마지막 발 픽셀 y30, 지면 경계31이므로 성인 28px와 실제 `headOffset=28`이다. 공격 발 마지막38/지면39에서 offset8을 빼면 보행 지면31과 같다. 올라간 공격 손은 머리 높이로 세지 않는다.

Root의 현재 characterAliases는 기존 실제 저장 sprite를 바꾸지 않는 표시 대응이다. 이 아트는 그 연결을 구현하지 않는다. 상인 정확한 세 종에만 표시를 연결할지 결정하는 일, 새 Def/patch·저장/세계/거래/브라우저 검증은 Root가 담당한다.

## 산출물과 재현

보행/공격 PNG+SVG, 28자세 contact PNG, 팔레트, `trader-manifest.fragment.json`, 실제 사용 대상 조사 JSON, integrity JSON을 제공한다. 제안 public 경로는 `sprites/original/ashveil-trader-{walk,attack}.png`다. contact는 원본 검토 자료이며 실제 게임 촬영이 아니다.

```sh
python3 draw-trader.py
python3 draw-trader.py --check
```

제작 도구는 실제 조사 스냅샷을 소스에 고정해 재현 시 MAIN을 다시 읽지 않고, 외부 패키지나 이미지를 불러오지 않으며 자기 격리 폴더에만 출력한다. `--check`는 모든 생성 바이트를 읽기 전용으로 대조한다. Root/Core/Def/Git/공용 시트·manifest/브라우저/GPU/프로젝트 전체 검사는 변경하거나 실행하지 않는다.

## v0.288 통합 작업

Root가 원본 contact를 직접 열고 28프레임과 char를 적용했다. 실제 SettlementTrader에 저장 hero를 보존하는 표시 별칭을 추가해 두 상인 자손이 상속한다. 재현 및 실제 게임·저장·전체 검증은 각각 별도 기록한다.

통합 저장소 재현은 전체 격리 출처를 보존한 `python3 tools/art/trader/draw-trader.py --check`로 실행한다. SOURCE 해시 의존으로 단독 스크립트 이동은 실패했으며 원래12파일 묶음을 그대로 보존해 해결했다.
