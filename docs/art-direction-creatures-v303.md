# v303 캐릭터 전수 원화

v302 기준의 **52개 actor sheet, 718개 frame key, 28개 char 등록(26개 고유 형상)**을 모두 새 정수 좌표로 다시 그렸다. 기존 PNG에 필터·색상 변환을 적용하지 않았고 외부/기존 이미지의 픽셀을 읽어 형상을 만들지 않았다. 신규 PNG52개와 네이티브 픽셀에 정확히 대응하는 자체 SVG52개를 제공한다. 앞 작업의 동물4종·역할2종 보완만 교체한 것이 아니라 기존 주인공·모든 적·주민·드론·융합체까지 전수 신규 저작이다.

기준은 `docs/art-direction-v303.md`, CANON D13/D14, 저장소 CLAUDE와 게임 개발 스킬 및 `tools/art/direction-v303/baseline-registry.json`이다. 공식 참고12장(`test-results/references-v303/{fear-hunger,stoneshard,darkwood,darkest-dungeon}-{0,1,2}.jpg`)을 각각 실제 열었다. 거친 피부·해진 옷과 불균형한 자세, 지면 위의 명확한 실루엣, 작은 밝은 재질면과 생활 도구의 구조를 관찰했다. 참고작 캐릭터·실루엣·픽셀·문양은 복제/추적하지 않았다. 참고12원문 URL/SHA는 공용 `tools/art/direction-v303/references.json`에 남아 있다.

## 새 인체와 재질

성인 얼굴은 폭3px, 두상은 약5×6px로 만들고 어깨 폭 약10px, 길어진 목/몸통, 어깨-팔꿈치-손의 두 관절, 골반-무릎-발의 분리와 상체 체중 이동을 넣었다. 큰 둥근 두상과 짧게 뭉친 팔다리를 유지하지 않았다. 현 주인공은 각진 좁은 두건과 사선 망토·낮게 맨 짐, 옛 주인공은 드러난 작은 얼굴과 긴 열린 모직 외투로 완전히 다르게 그렸다.

역할은 동일 몸에 팔레트만 바꾸지 않고 옷의 재단·길이·어깨·소매·짐·도구로 구분한다. 노동자는 리넨 앞치마/걷은 소매, 간병인은 머리천/긴 앞치마/접은 천, 경비는 누비 외투/긴 창, 상인은 긴 겹조끼/문서가방이다. 두목의 도끼·작은 방패, 궁수의 활·화살통, 경비의 창은 현재 Def loadout을 확인한 역할 해석이다. 수량·품질·내구·실제 장착 변경을 원화가 나타내는 것은 아니다.

그늘 사람은 작은 성인 인간의 비례를 유지한다. 말라붙은 자와 사제는 피부·입·남은 의복이 있는 살아 있는 환자다. 포자 인간도 사람 얼굴과 옷 위에 비대칭 마른 균체를 얹는다. 어떤 인간형도 발광 눈/초록 오라/해골 마스코트로 그리지 않았다. 공통 먹색 외곽, 흙빛 천, 피부, 골백색의 작은 닳은 면과 철/녹/황동을 별도 구조에 배치했다. 균체는 베이지·갈색 주름이며 일반 생물 전체를 녹색으로 칠하지 않았다.

## 정확한 연결 계약

- 25개 활동형 × 28개 방향 포즈 = 700개, 드론 정지형4개로 char 참조 고유 frame key는704개다.
- 융합체 legacy 호환 anim6개와 동일 사각형 static alias8개를 포함해 담당 frame key는718개다.
- 28개 등록 중 `player`는 `original_wanderer_hero`, `reaver2`는 `reaver1`의 기존 프레임 참조 별칭을 그대로 유지한다. 이를 별도 신규 형상으로 중복 집계하지 않는다.
- 모든 frame 배열 `[sheet,x,y,w,h]`를 baseline과 동일하게 보존했다. 모든 char 객체도 방향·walk/idle/attack 배열·anchor·attackAnchor·renderScale·headOffset·shadow·healthBarWidth까지 baseline과 동일하다.
- `amalgam` legacy anim의 키·6프레임·fps도 유지한다. `cd_veina1`과 `cd_littleeyes`는 props 담당 범위라 이 조각에서 수정하지 않는다.
- 공용 manifest에는 `tools/art/direction-v303/creatures.fragment.json`의52 sheet URL을 접합한다. frame/char/legacy anim 항목은 baseline과 동일한 감사용 완전 목록이다. Core·Def·저장·표시 별칭·renderer를 변경하지 않는다.

## 28개 등록 전수 목록

경로의 공통 접두사는 `public/sprites/original/direction-v303/creatures/`이다. 아래 PNG 이름과 동명의 SVG가 실제 새 원본이다. 모든 char의 네 방향과 원래 포즈 수를 보존한다. 활동형28은 walk12+attack16, idle은 기존 프레임 참조다.

| char 등록 | 새 원본 PNG | 프레임 / 직접 확인 contact | 형상 |
|---|---|---|---|
| hero | hero.png<br>hero_atk.png | 28 / contacts/hero.png | 옛 떠돌이: 드러난 작은 얼굴, 긴 열린 모직 외투, 비대칭 어깨천과 묶은 짐. |
| reaver0 | reaver0.png<br>reaver0_atk.png | 28 / contacts/reaver0.png | 넓은 어깨의 성인, 철모·짧은 징 가죽 조끼·맨 팔·큰 신발. |
| reaver1 | reaver1.png<br>reaver1_atk.png | 28 / contacts/reaver1.png | 마른 삭발 성인, 한 소매 외투·대각 가죽띠·종아리 감개. |
| shade0 | shade0.png<br>shade0_atk.png | 28 / contacts/shade0.png | 작은 성인, 작은 정수리·내려간 어깨·해진 작업 셔츠·긴 전완. |
| shade1 | shade1.png<br>shade1_atk.png | 28 / contacts/shade1.png | 작은 성인, 열린 조끼와 작은 옆가방·정강이 감개. |
| shade2 | shade2.png<br>shade2_atk.png | 28 / contacts/shade2.png | 작은 성인, 늘어진 머리카락·긴 한 소매·대각 가슴천. |
| shade_chief | original_shade_chief.png<br>original_shade_chief_atk.png | 28 / contacts/shade_chief.png | 작은 성인 우두머리, 거친 높은 목깃·겹친 짧은 외투·팔 감개. |
| shade3 | shade3.png<br>shade3_atk.png | 28 / contacts/shade3.png | 작은 성인, 묶은 머리·민소매 어깨천·앞치마 모양 누더기. |
| withered | withered.png<br>withered_atk.png | 28 / contacts/withered.png | 살아 있는 회색열 환자: 낮은 작은 얼굴·마른 갈비와 피부·내려간 소매·굽은 정강이. |
| withered_priest | withered_priest.png<br>withered_priest_atk.png | 28 / contacts/withered_priest.png | 살아 있는 환자 사제: 작은 민머리·긴 해진 예복·줄 영대·체인과 향로. |
| spore0 | original_spore0.png<br>original_spore0_atk.png | 28 / contacts/spore0.png | 살아 있는 감염 순례자: 기운 작은 얼굴·해진 긴 셔츠·한 어깨와 팔의 마른 비정형 선반균. |
| spore1 | original_spore1.png<br>original_spore1_atk.png | 28 / contacts/spore1.png | 다른 감염 순례자: 비대칭 등/머리 옆 균체·접힌 두건·낡은 짧은 겉옷. |
| tender_drone | tender_drone.png<br>tender_drone_atk.png | 28 / contacts/tender_drone.png | 여섯 다리 수리 기계: 녹슨 철 껍질·황동 관절·빗 냉각핀·어두운 센서 틈·불균형 도구팔. |
| tender_drone_inert | tender_drone_inert.png | 4 / contacts/tender_drone_inert.png | 동일한 새 기계의 네 방향 실제 정지형: 다리 관절을 낮게 접고 도구팔을 둠. 공격 없음 유지. |
| amalgam | amalgam_atk.png<br>amalgam_walk.png | 28 / contacts/amalgam.png | 머리 셋·팔 넷·여러 몸통·다리 없는 끌리는 기저. 피부·남은 리넨·압력 주름을 구별. |
| resident_worker | resident_worker.png<br>resident_worker_atk.png | 28 / contacts/resident_worker.png | 작은 머리의 성인 노동자: 걷은 소매·긴 리넨 앞치마·허리끈·무릎 덧댐·수선 주머니. |
| resident_healer | resident_healer.png<br>resident_healer_atk.png | 28 / contacts/resident_healer.png | 성인 간병인: 좁은 머리천·비대칭 긴 앞치마·접은 천·옆가방. 현대 의료 표식 없음. |
| resident_guard | resident_guard.png<br>resident_guard_atk.png | 28 / contacts/resident_guard.png | 성인 경비: 열린 두건·긴 누비 외투·가죽 어깨보강·실제 loadout의 창·따로 지탱한 다리. |
| resident_trader | resident_trader.png<br>resident_trader_atk.png | 28 / contacts/resident_trader.png | 성인 상인: 작은 머리·긴 겹조끼·접힌 높은 옷깃·부드러운 문서가방과 주머니. |
| original_wanderer_hero | original_wanderer_hero.png<br>original_wanderer_hero_atk.png | 28 / contacts/original_wanderer_hero.png | 현 주인공: 가늘고 각진 두건, 작은 지친 얼굴, 긴 다리, 사선 망토와 낮게 맨 별도 가방. |
| ash_hound | complete_ash_hound_attack.png<br>complete_ash_hound_walk.png | 28 / contacts/ash_hound.png | 낮고 마른 야생 개: 긴 주둥이·작은 귀·기운 등·굽은 뒷발목·뭉친 회색 털. |
| ash_hound_alpha | complete_ash_hound_alpha_attack.png<br>complete_ash_hound_alpha_walk.png | 28 / contacts/ash_hound_alpha.png | 목 갈기·넓은 가슴·높은 어깨·목 흉터·다른 꼬리의 큰 개. 단순 재색칠 아님. |
| burrow_rat | complete_burrow_rat_attack.png<br>complete_burrow_rat_walk.png | 28 / contacts/burrow_rat.png | 낮고 긴 설치류: 주둥이·접힌 귀·얇은 비늘꼬리·굽은 엉덩이·앞니. |
| murk_leech | complete_murk_leech_attack.png<br>complete_murk_leech_walk.png | 28 / contacts/murk_leech.png | 편평한 회갈색 마디 몸과 끝 흡반. 눈·사지·껍질 없이 길게 굽고 수축함. |
| complete_reaver_chief | complete_reaver_chief_attack.png<br>complete_reaver_chief_walk.png | 28 / contacts/complete_reaver_chief.png | 큰 갈라진 외투, 겹친 어깨판, 작은 철모·도끼·작은 방패. |
| complete_reaver_archer | complete_reaver_archer_attack.png<br>complete_reaver_archer_walk.png | 28 / contacts/complete_reaver_archer.png | 가벼운 두건, 좁은 몸통, 사선 화살통, 길게 휜 활과 당기는 동작. |
| player | original_wanderer_hero.png<br>original_wanderer_hero_atk.png | 28 / contacts/original_wanderer_hero.png | 현 주인공: 가늘고 각진 두건, 작은 지친 얼굴, 긴 다리, 사선 망토와 낮게 맨 별도 가방. 기존 참조 별칭 유지. |
| reaver2 | reaver1.png<br>reaver1_atk.png | 28 / contacts/reaver1.png | 마른 삭발 성인, 한 소매 외투·대각 가죽띠·종아리 감개. 기존 참조 별칭 유지. |

26개 고유 캐릭터의 contact26개, `contacts/amalgam_legacy.png`, `contacts/all-26-silhouettes.png`까지 총28개 검토용 PNG를 직접 열었다. contact의 행은 down/left/right/up, 열은 idle/walk0/walk1/walk2/attack0/attack1/attack2/attack3이다. 드론 정지형은 idle와 동일 정지 walk만 표시하고 원래 없는 공격을 추가하지 않는다. 각 프레임의 바닥 기준을 맞춘 정수 미리보기이므로 프레임 크기가 다른 공격에서도 발 위치를 대조할 수 있다.

## 52개 시트와 모든718 key의 감사

`coverage.json`은28등록별 실제 원본 경로·방향/포즈 개수·형상 소유자와718개 frameOwner를, fragment는718개 정확한 사각형을 제공한다. actor 누락/범위 밖 도형 좌표/해석되지 않는 참조는0이다. 아래 전체52개는 독립 해시 검사에서 기존 파일과 모두 달라졌다.

| sheet key | 새 PNG / 동일 이름 SVG | 프레임 키 수 |
|---|---|---|
| amalgam | amalgam.png | 6 |
| amalgam_atk | amalgam_atk.png | 16 |
| amalgam_walk | amalgam_walk.png | 12 |
| complete_ash_hound_alpha_attack | complete_ash_hound_alpha_attack.png | 16 |
| complete_ash_hound_alpha_walk | complete_ash_hound_alpha_walk.png | 13 |
| complete_ash_hound_attack | complete_ash_hound_attack.png | 16 |
| complete_ash_hound_walk | complete_ash_hound_walk.png | 13 |
| complete_burrow_rat_attack | complete_burrow_rat_attack.png | 16 |
| complete_burrow_rat_walk | complete_burrow_rat_walk.png | 13 |
| complete_murk_leech_attack | complete_murk_leech_attack.png | 16 |
| complete_murk_leech_walk | complete_murk_leech_walk.png | 13 |
| complete_reaver_archer_attack | complete_reaver_archer_attack.png | 16 |
| complete_reaver_archer_walk | complete_reaver_archer_walk.png | 13 |
| complete_reaver_chief_attack | complete_reaver_chief_attack.png | 16 |
| complete_reaver_chief_walk | complete_reaver_chief_walk.png | 13 |
| hero | hero.png | 12 |
| hero_atk | hero_atk.png | 16 |
| original_shade_chief | original_shade_chief.png | 12 |
| original_shade_chief_atk | original_shade_chief_atk.png | 16 |
| original_spore0 | original_spore0.png | 12 |
| original_spore0_atk | original_spore0_atk.png | 16 |
| original_spore1 | original_spore1.png | 12 |
| original_spore1_atk | original_spore1_atk.png | 16 |
| original_wanderer_hero | original_wanderer_hero.png | 12 |
| original_wanderer_hero_atk | original_wanderer_hero_atk.png | 16 |
| reaver0 | reaver0.png | 12 |
| reaver0_atk | reaver0_atk.png | 16 |
| reaver1 | reaver1.png | 12 |
| reaver1_atk | reaver1_atk.png | 16 |
| resident_guard | resident_guard.png | 12 |
| resident_guard_atk | resident_guard_atk.png | 16 |
| resident_healer | resident_healer.png | 12 |
| resident_healer_atk | resident_healer_atk.png | 16 |
| resident_trader | resident_trader.png | 12 |
| resident_trader_atk | resident_trader_atk.png | 16 |
| resident_worker | resident_worker.png | 12 |
| resident_worker_atk | resident_worker_atk.png | 16 |
| shade0 | shade0.png | 12 |
| shade0_atk | shade0_atk.png | 16 |
| shade1 | shade1.png | 12 |
| shade1_atk | shade1_atk.png | 16 |
| shade2 | shade2.png | 12 |
| shade2_atk | shade2_atk.png | 16 |
| shade3 | shade3.png | 12 |
| shade3_atk | shade3_atk.png | 16 |
| tender_drone | tender_drone.png | 13 |
| tender_drone_atk | tender_drone_atk.png | 16 |
| tender_drone_inert | tender_drone_inert.png | 5 |
| withered | withered.png | 12 |
| withered_atk | withered_atk.png | 16 |
| withered_priest | withered_priest.png | 12 |
| withered_priest_atk | withered_priest_atk.png | 16 |

## 재현과 독립 검사

```sh
python3 tools/art/direction-v303/draw-creatures.py
python3 tools/art/direction-v303/draw-creatures.py --check
```

두 명령 모두 PASS. 제작 도구는 표준 라이브러리만 사용한다. 새 형상을 만드는 draw 경로는 PNG를 전혀 입력받지 않으며 baseline의 논리 좌표/크기만 읽는다. SVG는 저작한 네이티브 픽셀의 정수 run 사각형 소스이고 외부 PNG 추적이 아니다. `--check`는52 PNG+52 SVG+28 contact와 fragment/coverage/source/독립 검사 기록의 바이트 재현을 읽기 전용 대조한다. 자체 신규 저작물은 CC0-1.0으로 제공한다.

같은 명령의 분리된 `independently_check_outputs()`가 실제 출력 PNG의 signature/chunk CRC/단일 terminal IEND/RGBA8/binary alpha를 읽어 검사하고, 실제 SVG52개를 펼친 모든 픽셀이 PNG52개와 일치함을 검증한다. 기존 PNG는 변경 해시 감사용 바이트 SHA 계산만 하며 디코딩·샘플링·크롭·추적·재색칠하거나 저작 함수로 전달하지 않는다.52개 SHA 모두 baseline 파일과 다름을 확인했다. `independent-check.json`에 파일별 이전/신규 SHA와 SVG 일치가 기록돼 있다.

논리 계약은52시트/718키 범위와 모든 char 객체의 완전 동등성, 모든 frame 배열의 동등성, 방향별 walk/attack 중복 포즈 없음, 모든 도형 좌표의 프레임 내부 배치, 실제 crop과 독립 포즈의 일치를 검증한다. 아트 검토 자료이며 실제 게임 화면으로 주장하지 않는다. 브라우저·GPU·Core·저장·World·Full·Type·pnpm 검사는 담당 범위 밖이라 실행하지 않았다. 실제 공용 manifest 접합과 게임/상태 검증은 Root 통합 단계다.
