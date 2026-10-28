# v302 생물 원화 전수 조사와 보완

33개의 해석된 비추상 Creature Def, 기존 manifest의 20 chars, 536개 고유 프레임을 조사했다. 기존 20종 원본은 그대로 유지하며 이번에 새로 그렸다고 집계하지 않는다. 기존 원본을 직접 contact로 조합한 검토 자료 5개를 모두 `view_image`로 열었다. 새 그림은 이미지 입력 없이 새 정수 픽셀 좌표로 작성한 동물 4종과 역할 2종, 총 168개 포즈다. 공유 manifest·Core·콘텐츠·renderer·기존 PNG는 이 담당 도구가 수정하지 않는다.

`CLAUDE.md`, `.agents/skills/ashveil-game-development/SKILL.md`, `docs/CANON.md` D13/D14, `docs/lore/bestiary.md` §1/§2/§3/§0.5와 늪거머리 기록, 실제 `src/core/creatures.ts`, `src/client/render/creature-sprite.ts`, `MapRenderer.ts`, `atlas.ts`, `MapView.vue`, `creatures.json`, `murk-fens.json` 및 동결된 `tools/art/complete-catalog-v302-before.json`을 기준으로 했다. 모든 배치는 16px 월드 타일의 정수 픽셀 화풍을 따른다. 새 동물 셀은 16×16, 성인 역할 셀은 기존 성인 원본과 맞춘 24×32다.

## 새 원화와 연결

| 표시 key | 원화와 재질 | PNG 경로 (`public/sprites/original/complete/creatures/` 아래) | 포즈 |
|---|---|---|---|
| ash_hound | 회색 겹털, 긴 주둥이, 선 귀, 네 다리, 덤불 꼬리 | ash_hound-walk.png / ash_hound-attack.png | 4방향 × 걷기3·공격4 = 28 |
| ash_hound_alpha | 더 넓은 목/가슴, 큰 갈기 형상, 목 흉터; 단순 재색칠 아님 | ash_hound_alpha-walk.png / ash_hound_alpha-attack.png | 28 |
| burrow_rat | 낮은 둥근 등, 분홍 귀/맨꼬리, 작은 앞니, 짧은 발 | burrow_rat-walk.png / burrow_rat-attack.png | 28 |
| murk_leech | 눈/사지 없는 편평한 마디 몸, 낮은 녹회색 젖은 피부, 끝 흡반 | murk_leech-walk.png / murk_leech-attack.png | 28 |
| complete_reaver_chief | 넓고 갈라진 낡은 외투, 다른 형태의 어깨 천 조각, 짧은 머리의 인간 | complete_reaver_chief-walk.png / complete_reaver_chief-attack.png | 28 |
| complete_reaver_archer | 좁은 실루엣, 작은 두건, 화살통/대각 끈, 가벼운 옷 | complete_reaver_archer-walk.png / complete_reaver_archer-attack.png | 28 |

각 `*-contact.png`는 행=down/left/right/up, 열=idle/walk0/walk1/walk2/attack0/attack1/attack2/attack3, 정수4배 미리보기다. 6개를 각각 `view_image`로 열어 새 포즈와 종/역할 식별을 확인했다. idle은 walk0의 명시 참조이며 `*-static.png`도 같은 자체 원본 idle이다. 6개 표시 key 자체의 static frame도 제공하므로 같은 key를 읽는 preload/아이콘 소비자가 외부 타일을 요청하지 않는다. 신규 고유 포즈168, static alias6으로 등록 frame은174이고 sheet12·char6·추가 독립 anim0이다.

동물은 기존 sprite key를 그대로 char key로 등록한다. `createCreature`는 char가 없으면 해당 sprite key를 저장하며, renderer는 `chars[creatureSprite(w,c)]`를 먼저 읽는다. `loadAtlas`가 모든 manifest sheet를 불러오므로 이 fragment 결합만으로 동물 경로가 생긴다. MapView의 icons는 GROUND+Item+Ability뿐이며 일반 Creature.sprite를 미리 불러오지 않는다. 따라서 기존 재늑대/굴쥐는 실제 로딩 경로도 없었고, 늪거머리만 GROUND의 외부 `tiles/murk_leech.png`를 사용했다. 새 동일 key static frame은 그 요청을 제거한다.

두목/궁수의 raw 저장 선택은 바꾸지 않는다. `tools/art/complete-creatures.patches.json`은 실제 baseline Def에 characterAliases가 없음을 읽고 두 Def 모두 `add /characterAliases`를 제안한다. 두목 reaver0 → complete_reaver_chief, 궁수 reaver0/reaver1 → complete_reaver_archer이며 Root가 적용한다. 기존 장비/능력/AI/몸/출현 규칙은 건드리지 않는다. 손무기를 원화에 고정하지 않는다. 화살통 형태는 역할 식별용이며 화살 잔량/새 Item/장비 능력/발사 상태를 보장하지 않는다. 늪거머리의 attack 포즈는 흡반 접근 표현이고 원래 없는 naturalAttack 규칙을 만들지 않는다.

별도 해상 동물 Creature Def는 기준33종에 없다. 해안 염부·장부지기·간병인·파수꾼은 기존 인간 역할 원본을 쓰는 사람이다. Def가 없는 새 어류·게 등을 만든 것으로 집계하지 않는다. 재늑대/굴쥐가 정본 프로토타입 출현 제외라는 이유로 그림을 생략하지 않았고 출현 규칙도 바꾸지 않았다. 다른 종 아이콘으로 동물을 대신하지 않는다.

## 기존20 chars 직접 검토

아래 경로는 모두 `public/` 아래의 실제 원본이다. 표의28은 걷기12+공격16이고 idle4는 걷기 참조다. 기존 드론 정지형만 고유4다. 기존 원화에서 방향 또는 공격 누락은 발견하지 않았다. 새 역할2종은 기존 약탈자 원화를 수정/재색칠하지 않고 별도로 작성했다.

| char | 원본 경로 | 프레임 / contact | 직접 확인 |
|---|---|---|---|
| hero | sprites/original/ashveil-wanderer-attack.png<br>sprites/original/ashveil-wanderer-walk.png | 28 / existing-contact-1.png | 낡은 청회색 두건·가죽띠·가방의 살아 있는 떠돌이. 네 방향과 팔 준비/뻗음/복귀 확인. |
| reaver0 | sprites/original/ashveil-reaver-attack.png<br>sprites/original/ashveil-reaver-walk.png | 28 / existing-contact-1.png | 큰 어깨·회색 머리·낡은 가죽/천의 약탈자. 네 방향과 맨손 공격 확인. |
| reaver1 | sprites/original/ashveil-reaver1-attack.png<br>sprites/original/ashveil-reaver1-walk.png | 28 / existing-contact-1.png | 짧은 머리·붉은 어깨천·가벼운 하체의 별도 약탈자. 네 방향과 팔 공격 확인. |
| shade0 | sprites/original/ashveil-shade0-attack.png<br>sprites/original/ashveil-shade0-walk.png | 28 / existing-contact-1.png | 작고 창백한 얼굴·해진 짧은 셔츠. 네 방향과 다리/팔 포즈 확인. |
| shade1 | sprites/original/ashveil-shade1-attack.png<br>sprites/original/ashveil-shade1-walk.png | 28 / existing-contact-2.png | 짧은 머리·넓은 동공·통 셔츠의 작은 인간. 네 방향과 공격 확인. |
| shade2 | sprites/original/ashveil-shade2-attack.png<br>sprites/original/ashveil-shade2-walk.png | 28 / existing-contact-2.png | 흩어진 머리·작은 창백한 얼굴·어두운 옷. 네 방향과 공격 확인. |
| shade_chief | sprites/original/ashveil-shade-chief-attack.png<br>sprites/original/ashveil-shade-chief-walk.png | 28 / existing-contact-2.png | 작고 창백한 인간과 겹친 목/어깨 천. 네 방향과 공격 확인. |
| shade3 | sprites/original/ashveil-shade3-attack.png<br>sprites/original/ashveil-shade3-walk.png | 28 / existing-contact-2.png | 묶은 머리·긴 목·낡은 옷의 작은 인간. 네 방향과 공격 확인. |
| withered | sprites/original/ashveil-withered-attack.png<br>sprites/original/ashveil-withered-walk.png | 28 / existing-contact-3.png | 마른 피부와 구부정한 몸, 남은 옷과 살아 있는 얼굴. 네 방향과 할퀴기 확인. 해골/언데드로 교체하지 않음. |
| withered_priest | sprites/original/ashveil-withered-priest-attack.png<br>sprites/original/ashveil-withered-priest-walk.png | 28 / existing-contact-3.png | 마른 살아 있는 얼굴·긴 낡은 예복·내려치는 팔. 네 방향과 공격 확인. |
| spore0 | sprites/original/ashveil-spore0-attack.png<br>sprites/original/ashveil-spore0-walk.png | 28 / existing-contact-3.png | 살아 있는 인체 위 어깨/팔의 불규칙 포자 덩이. 네 방향과 주먹 동작 확인. |
| spore1 | sprites/original/ashveil-spore1-attack.png<br>sprites/original/ashveil-spore1-walk.png | 28 / existing-contact-3.png | 다른 모양의 갓·어깨 덩이·해진 옷. 네 방향과 주먹 동작 확인. |
| tender_drone | sprites/original/ashveil-drone-attack.png<br>sprites/original/ashveil-drone-walk.png | 28 / existing-contact-4.png | 냉각핀·여섯 다리·센서/도구팔. 네 방향과 보행/타격 확인. |
| tender_drone_inert | sprites/original/ashveil-drone-inert.png | 4 / existing-contact-4.png | 낮아진 몸통·접힌 여섯 다리의 정지 기계. 네 방향의 실제 정지형이며 공격 없음은 의도된 계약. |
| amalgam | sprites/original/ashveil-amalgam-attack.png<br>sprites/original/ashveil-amalgam-walk.png | 28 / existing-contact-4.png | 머리 셋·팔 넷·다리 없는 기저 몸덩이. 네 방향의 끌기/후려치기 확인. |
| resident_worker | sprites/original/ashveil-resident-attack.png<br>sprites/original/ashveil-resident-walk.png | 28 / existing-contact-4.png | 짧은 머리·올리브 생활복. 네 방향과 맨손 공격 확인. |
| resident_healer | sprites/original/ashveil-healer-attack.png<br>sprites/original/ashveil-healer-walk.png | 28 / existing-contact-5.png | 묶은 머리·회백색 앞치마·녹청 생활복. 네 방향과 맨손 공격 확인. |
| resident_guard | sprites/original/ashveil-guard-attack.png<br>sprites/original/ashveil-guard-walk.png | 28 / existing-contact-5.png | 넓은 회녹색 외투·높은 목깃. 네 방향과 맨손 공격 확인. |
| resident_trader | sprites/original/ashveil-trader-attack.png<br>sprites/original/ashveil-trader-walk.png | 28 / existing-contact-5.png | 갈색 겹조끼·옷깃·허리천. 네 방향과 맨손 공격 확인. |
| original_wanderer_hero | sprites/original/ashveil-player-wanderer-attack.png<br>sprites/original/ashveil-player-wanderer-walk.png | 28 / existing-contact-5.png | 패치 두건·낡은 외투·허리띠의 현 플레이어. 네 방향과 맨손 공격 확인. |

## 33개 Def별 실제 원본과 미지원 상태

전체 경로·정확한 방향별 포즈 수·raw char/sprite·기존 aliases/dormant·새 표시 제안은 `tools/art/complete-creatures-mapping.json`에 Def마다 명시했다. 아래는 같은33개 목록이다. 경로는 `public/` 아래이며 이름이 같은 기존 종 원화를 공유하는 것은 같은 종/인간 역할의 의도된 재사용이다. “없음”은 fragment와 두 역할 표시 patch를 결합한 후 이33Def가 선택하는 원본의 누락이 없다는 뜻이며, 실제 게임/GPU 통과를 뜻하지 않는다.

| Def / 이름 | 표시 key | 실제 원본 PNG 경로 | 포즈 / 미지원·한계 |
|---|---|---|---|
| Creature.Shade / 그늘 사람 | shade0<br>shade1<br>shade2<br>shade3 | sprites/original/ashveil-shade0-attack.png<br>sprites/original/ashveil-shade0-walk.png<br>sprites/original/ashveil-shade1-attack.png<br>sprites/original/ashveil-shade1-walk.png<br>sprites/original/ashveil-shade2-attack.png<br>sprites/original/ashveil-shade2-walk.png<br>sprites/original/ashveil-shade3-attack.png<br>sprites/original/ashveil-shade3-walk.png | 28 + 28 + 28 + 28 / 원본 누락 없음 |
| Creature.ShadeGroveResident / 숲의 그늘 주민 | shade0<br>shade1<br>shade2<br>shade3 | sprites/original/ashveil-shade0-attack.png<br>sprites/original/ashveil-shade0-walk.png<br>sprites/original/ashveil-shade1-attack.png<br>sprites/original/ashveil-shade1-walk.png<br>sprites/original/ashveil-shade2-attack.png<br>sprites/original/ashveil-shade2-walk.png<br>sprites/original/ashveil-shade3-attack.png<br>sprites/original/ashveil-shade3-walk.png | 28 + 28 + 28 + 28 / 원본 누락 없음; 역할 전용 복장은 공유 상태 |
| Creature.ShadeGroveGuard / 종자 금고 경비 | shade0<br>shade1<br>shade2<br>shade3 | sprites/original/ashveil-shade0-attack.png<br>sprites/original/ashveil-shade0-walk.png<br>sprites/original/ashveil-shade1-attack.png<br>sprites/original/ashveil-shade1-walk.png<br>sprites/original/ashveil-shade2-attack.png<br>sprites/original/ashveil-shade2-walk.png<br>sprites/original/ashveil-shade3-attack.png<br>sprites/original/ashveil-shade3-walk.png | 28 + 28 + 28 + 28 / 원본 누락 없음; 역할 전용 복장은 공유 상태 |
| Creature.ShadeGroveMerchant / 숲의 교환상 | shade0<br>shade1<br>shade2<br>shade3 | sprites/original/ashveil-shade0-attack.png<br>sprites/original/ashveil-shade0-walk.png<br>sprites/original/ashveil-shade1-attack.png<br>sprites/original/ashveil-shade1-walk.png<br>sprites/original/ashveil-shade2-attack.png<br>sprites/original/ashveil-shade2-walk.png<br>sprites/original/ashveil-shade3-attack.png<br>sprites/original/ashveil-shade3-walk.png | 28 + 28 + 28 + 28 / 원본 누락 없음; 역할 전용 복장은 공유 상태 |
| Creature.ShadeGroveHealer / 숲의 간병인 | shade0<br>shade1<br>shade2<br>shade3 | sprites/original/ashveil-shade0-attack.png<br>sprites/original/ashveil-shade0-walk.png<br>sprites/original/ashveil-shade1-attack.png<br>sprites/original/ashveil-shade1-walk.png<br>sprites/original/ashveil-shade2-attack.png<br>sprites/original/ashveil-shade2-walk.png<br>sprites/original/ashveil-shade3-attack.png<br>sprites/original/ashveil-shade3-walk.png | 28 + 28 + 28 + 28 / 원본 누락 없음; 역할 전용 복장은 공유 상태 |
| Creature.Settler / 정착민 | resident_worker | sprites/original/ashveil-resident-attack.png<br>sprites/original/ashveil-resident-walk.png | 28 / 원본 누락 없음 |
| Creature.SettlementDoctor / 의사 | resident_healer | sprites/original/ashveil-healer-attack.png<br>sprites/original/ashveil-healer-walk.png | 28 / 원본 누락 없음 |
| Creature.Drifter / 떠돌이 | original_wanderer_hero | sprites/original/ashveil-player-wanderer-attack.png<br>sprites/original/ashveil-player-wanderer-walk.png | 28 / 원본 누락 없음 |
| Creature.Reaver / 잿빛 약탈자 | reaver0<br>reaver1 | sprites/original/ashveil-reaver-attack.png<br>sprites/original/ashveil-reaver-walk.png<br>sprites/original/ashveil-reaver1-attack.png<br>sprites/original/ashveil-reaver1-walk.png | 28 + 28 / 원본 누락 없음 |
| Creature.AshHound / 재늑대 | ash_hound | sprites/original/complete/creatures/ash_hound-attack.png<br>sprites/original/complete/creatures/ash_hound-walk.png | 28 / 원본 누락 없음 |
| Creature.AshHoundAlpha / 재늑대 우두머리 | ash_hound_alpha | sprites/original/complete/creatures/ash_hound_alpha-attack.png<br>sprites/original/complete/creatures/ash_hound_alpha-walk.png | 28 / 원본 누락 없음 |
| Creature.BurrowRat / 굴쥐 | burrow_rat | sprites/original/complete/creatures/burrow_rat-attack.png<br>sprites/original/complete/creatures/burrow_rat-walk.png | 28 / 원본 누락 없음 |
| Creature.ReaverChief / 약탈단 두목 | complete_reaver_chief | sprites/original/complete/creatures/complete_reaver_chief-attack.png<br>sprites/original/complete/creatures/complete_reaver_chief-walk.png | 28 / 원본 누락 없음; 제안 표시 patch 필요 |
| Creature.ReaverArcher / 약탈단 궁수 | complete_reaver_archer | sprites/original/complete/creatures/complete_reaver_archer-attack.png<br>sprites/original/complete/creatures/complete_reaver_archer-walk.png | 28 / 원본 누락 없음; 제안 표시 patch 필요 |
| Creature.ShadeChief / 그늘 우두머리 | shade_chief | sprites/original/ashveil-shade-chief-attack.png<br>sprites/original/ashveil-shade-chief-walk.png | 28 / 원본 누락 없음 |
| Creature.Withered / 말라붙은 자 | withered | sprites/original/ashveil-withered-attack.png<br>sprites/original/ashveil-withered-walk.png | 28 / 원본 누락 없음 |
| Creature.WitheredPriest / 말라붙은 사제 | withered_priest | sprites/original/ashveil-withered-priest-attack.png<br>sprites/original/ashveil-withered-priest-walk.png | 28 / 원본 누락 없음 |
| Creature.SporeMan / 포자 인간 | spore0<br>spore1 | sprites/original/ashveil-spore0-attack.png<br>sprites/original/ashveil-spore0-walk.png<br>sprites/original/ashveil-spore1-attack.png<br>sprites/original/ashveil-spore1-walk.png | 28 + 28 / 원본 누락 없음 |
| Creature.Amalgam / 융합체 | amalgam | sprites/original/ashveil-amalgam-attack.png<br>sprites/original/ashveil-amalgam-walk.png | 28 / 원본 누락 없음 |
| Creature.Signalist / 신호회 정비공 | resident_worker | sprites/original/ashveil-resident-attack.png<br>sprites/original/ashveil-resident-walk.png | 28 / 원본 누락 없음 |
| Creature.SettlementTrader / 상인 | resident_trader | sprites/original/ashveil-trader-attack.png<br>sprites/original/ashveil-trader-walk.png | 28 / 원본 누락 없음 |
| Creature.SignalistMerchant / 신호회 부품 교환원 | resident_trader | sprites/original/ashveil-trader-attack.png<br>sprites/original/ashveil-trader-walk.png | 28 / 원본 누락 없음 |
| Creature.SignalistHealer / 신호회 간병인 | resident_healer | sprites/original/ashveil-healer-attack.png<br>sprites/original/ashveil-healer-walk.png | 28 / 원본 누락 없음 |
| Creature.SettlementGuard / 정착지 경비 | resident_guard | sprites/original/ashveil-guard-attack.png<br>sprites/original/ashveil-guard-walk.png | 28 / 원본 누락 없음 |
| Creature.SignalistGuard / 신호회 파수꾼 | resident_guard | sprites/original/ashveil-guard-attack.png<br>sprites/original/ashveil-guard-walk.png | 28 / 원본 누락 없음 |
| Creature.TenderDrone / 수리 드론 | tender_drone<br>tender_drone_inert | sprites/original/ashveil-drone-attack.png<br>sprites/original/ashveil-drone-inert.png<br>sprites/original/ashveil-drone-walk.png | 28 + 4 정지 / 원본 누락 없음; 정지형 공격 없음(의도됨) |
| Creature.MurkLeech / 늪거머리 | murk_leech | sprites/original/complete/creatures/murk_leech-attack.png<br>sprites/original/complete/creatures/murk_leech-walk.png | 28 / 원본 누락 없음; 흡반 애니는 새 공격 규칙 아님 |
| Creature.RetiredWanderer / 정착한 옛 떠돌이 | hero | sprites/original/ashveil-wanderer-attack.png<br>sprites/original/ashveil-wanderer-walk.png | 28 / 원본 누락 없음 |
| Creature.LanternResident / 해안 염부 | resident_worker | sprites/original/ashveil-resident-attack.png<br>sprites/original/ashveil-resident-walk.png | 28 / 원본 누락 없음 |
| Creature.LanternMerchant / 형제단 소금 장부지기 | resident_trader | sprites/original/ashveil-trader-attack.png<br>sprites/original/ashveil-trader-walk.png | 28 / 원본 누락 없음 |
| Creature.LanternHealer / 형제단 간병인 | resident_healer | sprites/original/ashveil-healer-attack.png<br>sprites/original/ashveil-healer-walk.png | 28 / 원본 누락 없음 |
| Creature.LanternGuard / 해안 등대 파수꾼 | resident_guard | sprites/original/ashveil-guard-attack.png<br>sprites/original/ashveil-guard-walk.png | 28 / 원본 누락 없음 |
| Creature.ZeroVaultWarden / 제3 초소 금고 문지기 | resident_guard | sprites/original/ashveil-guard-attack.png<br>sprites/original/ashveil-guard-walk.png | 28 / 원본 누락 없음 |

그늘 숲 주민/경비/교환상/간병인은 원래 같은 종의 shade0~3를 공유한다. 종 식별과 모든 방향·동작은 지원하나 별도 직업 복장을 새로 제공한 것으로 주장하지 않는다. Reaver의 inherited sprite 배열에 남은 reaver2와 인간의 player는 현재 char가 있으면 신규 생성에 선택되지 않는다. 과거 임의 저장값까지 원본이 존재한다고 주장하지 않는다. 현 플레이어의 hero는 renderer 표시 override로 original_wanderer_hero를 쓰고, 옛 은퇴인의 hero→hero 명시 별칭은 기존 자체 원본을 유지한다.

## 재현과 검증

```sh
python3 tools/art/draw-complete-creatures.py --review-existing
python3 tools/art/draw-complete-creatures.py --check --review-existing
```

실행 결과 PASS. 새 원화 저작은 표준 라이브러리만 쓰며 외부 이미지 입력·추출·트레이싱·재색칠·기존 형상 재사용이 없다. 기존 자체 원본을 읽는 경로는 선택적인 `review_existing()` contact 조립뿐이고 새 `pose()`/`new_art()`와 분리되어 있다. 해당 검토 조립만 이미 설치된 Pillow를 사용한다. 생성은 자기 신규 경로와 fragment/mapping/patch 제안만 쓰고 `--check`는 기존 생성 바이트를 읽기 전용 대조한다. 도구 원문 SHA와 각 PNG SHA/치수는 `source.json`/`validation.json`에 기록했다. 새 저작물과 도구는 CC0-1.0으로 제공한다.

독립 PNG 계약은24개 신규 PNG의 signature/chunk CRC/단일 terminal IEND/RGBA8/binary alpha, 팔레트, 모든 frame 범위와 animation 참조, 네 방향, 방향별 실제 walk3/attack4 중복 없음, 각 char28개 전체 픽셀 상이, 1px 투명 여백, 동일 key static=idle, contact의 모든 픽셀 정수4배 일치를 검사했다. 33Def mapping의 모든 제안 표시 key가 기존 또는 새 char로 해석되는지도 확인했다. 기존20 contact5개는536고유프레임의 실제 원본 검토 자료이며 새 저작 수량에 포함하지 않는다.

브라우저·GPU·게임·Core·저장·World·Full·Type·pnpm 검사는 담당 범위 밖으로 실행하지 않았다. 실제 manifest/콘텐츠 결합 및 게임 상태/화면 검증은 Root 통합 단계다. 이 보고서는 접합 전 fragment와 제안의 준비 완료를 기록한다.
