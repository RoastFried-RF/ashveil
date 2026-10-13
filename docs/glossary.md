# ASHVEIL 용어집 (Glossary)

| 항목 | 내용 |
|---|---|
| 문서 버전 | v0.3 — **2차 방향 반영(2026-10-13)**: CANON D7~D14(스톤샤드 기반 + 림월드 혼합)의 신규 용어 추가, 폐지 용어 표시 |
| 기준 | [CANON.md](CANON.md) — 충돌 시 CANON 우선 |
| 정렬 | 가나다순(자음 묶음). 영문·기호로 시작하는 용어는 맨 끝 "기호·영문" 절 |
| 분류 | 세계 · 역사 · 지명 · 세력 · 인물 · 생물 · 아이템 · 문화 · 기술 · 게임 · 표기 |

## 사용 규칙

1. **새 고유명사는 이 용어집에 먼저 등록**하고 쓴다. 등록되지 않은 고유명사가 문서·Def에 나오면 리뷰에서 반려한다.
2. RimWorld·Stoneshard의 고유명사·설정 용어·코드 용어는 쓰지 않는다(CANON §2). 아래 "쓰지 않는 말" 표를 따른다.
3. 영문 표기는 Def ID·로컬라이제이션 키의 기준이 된다(예: `Creature.AshHound`, `Faction.SalvageGuild`).
4. "작가 전용" 표시가 있는 용어는 게임 텍스트에 직접 쓰지 않는다([world-bible §10](lore/world-bible.md)).

### 쓰지 않는 말 → 대신 쓰는 말

| 피할 표현 (레퍼런스 고유·코드 용어 연상) | ASHVEIL 용어 |
|---|---|
| 상태 이상 스택을 가리키는 레퍼런스 코드 용어 | **상태**(Condition), **상처 개체**(Wound Object) |
| 기분 구성 요소를 가리키는 레퍼런스 코드 용어 | **기분 요인**(Mood Factor) |
| 숙련 학습 배율을 가리키는 레퍼런스 용어 | **적성**(Aptitude) |
| 레퍼런스 게임의 적대 기계 종족명 | **야생 정원사**, **정원사 기계** |
| 레퍼런스 게임의 초월 기술 계열명 | **정원사 (기술 단계)** |
| 레퍼런스 게임의 고급 행성 분류명 | (사용 안 함 — 하스 밖 세계는 "바깥 하늘") |
| 레퍼런스 게임의 신념 체계 시스템명 | (사용 안 함 — 세력 이념은 "이념"으로만 서술) |
| 레퍼런스 게임의 저장 제한 모드명 | **각인**(Imprint) |

## ㄱ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **각인** | Imprint | 게임 | 기본 저장 모드. 단일 슬롯·자동 저장·사망 시 세이브 삭제 (D4) | [GDD §10](GDD.md) |
| **갈래길 장부관** | Forkway Ledgerhouse | 지명 | 회색 고원 유일의 상설 시장. 고물길드 지부 | [factions §2](lore/factions.md) |
| **감염 경주** | Infection Race | 게임 | 상처 감염 진행과 면역 진행 중 먼저 100%에 닿는 쪽이 이기는 모델 | [02](design/02-body-and-health.md) |
| **개척 (기술 단계)** | Charter Tier | 기술 | 칼든 공사의 기술. 현재 생산 불가, 발굴만 가능 (CANON 3.3) | [world-bible §6](lore/world-bible.md) |
| **개척기** | Charter Era | 역사 | 침전 302년~번영기 이전. 정원사망으로 테라포밍한 시기 | [world-bible §3](lore/world-bible.md) |
| **검역 초막** | Quarantine Hut | 문화 | 촌락 밖 7일 격리용 오두막 | [world-bible §5.3](lore/world-bible.md) |
| **검은 숲** | Blackwood | 지명 | 고원 남동 분지의 저조도 숲. 확장 지역 | [world-bible §1.2](lore/world-bible.md) |
| **검은 입** | The Black Mouth | 지명 | 잿빛 약탈단 고원 거점 폐광 | [world-bible §1.3](lore/world-bible.md) |
| **검은 줄** | Black Line | 세력·게임 | 길드 장부의 블랙리스트. 전 장부관 거래 불가 | [factions §2.8](lore/factions.md) |
| **검인 고리** | Stamped Ring | 문화 | 고물길드가 인장을 찍은 구리 고리 주화. 화폐 단위 "고리" | [world-bible §7.1](lore/world-bible.md) |
| **격자 배낭** | Grid Pack | 게임 | 10×6칸 소지품 격자. 아이템마다 칸 크기, 무게 없음(D11) | [13](design/13-inventory.md) |
| **경계 단계** | Alert Level | 게임 | 정원 구역의 위협 수준 0~3. 야생 정원사의 "평판" 대체 | [world-bible §4.4](lore/world-bible.md) |
| **경험치** | Experience (XP) | 게임 | 처치·새 방 발견·층 진입·위기 극복으로 얻는 성장 수치. L → L+1 = 100 × L × (L+1) / 2 | [15 §2](design/15-abilities.md) |
| **계약** | Contract | 게임 | 세력이 발주하는 의뢰(퀘스트) | [10](design/10-storyteller-and-events.md) |
| **계약인** | Contractfolk | 문화 | 공사 계약 노동자(산업 이주민) 후손. 경멸어로도 쓰임 | [world-bible §7.2](lore/world-bible.md) |
| **고물길드** | Salvage Guild | 세력 | 유물 발굴·교역·화폐 주조 세력. 기본 태도 우호 | [factions §2](lore/factions.md) |
| **고원 촌락연합** | Moorhold Villages | 세력 | 양치기 골 촌락들의 방어 연합. 기본 태도 중립 | [factions §1](lore/factions.md) |
| **고원말** | Moor Tongue | 문화 | 공사 표준어에서 갈라진 회색 고원 공용어 | [world-bible §7.2](lore/world-bible.md) |
| **곡창 평원** | Granary Plains | 지명 | 잉걸땅 중부의 옛 곡창. 현재 회색 먼지밭 | [world-bible §1.2](lore/world-bible.md) |
| **골든 테스트** | Golden Test | 기술(개발) | 시드 + 커맨드 로그 → 상태 해시를 고정 보관하는 결정론·포팅 검증 | [GDD §12](GDD.md) |
| **공격치** | Attack Rating | 게임 | 무기 정확도 + floor((민첩−10)×1.5) + (지각−10) + 보너스. 명중 공식 입력(CANON 7.2) | [05 §2.1](design/05-progression.md) |
| **공급원** | Population Source | 게임 | 장소의 유한한 거주 인구 저장소. 재점거·사건 편성은 여기서만 나온다 | [14 §9.4](design/14-locations-and-dungeons.md) |
| **공사** | the Company | 역사 | 칼든 공사의 약칭. 일상어에선 "옛 시절 높은 사람들" | [world-bible §3](lore/world-bible.md) |
| **공사 배급봉** | Charter Ration Bar | 아이템 | 70년 밀봉 고칼로리 식량. 30% 변질 | [world-bible §7.4](lore/world-bible.md) |
| **공사 표지판** | Charter Signage | 문화·게임 | 유적의 공사 경고문. 문해력이 있으면 위험 사전 인지 | [world-bible §7.2](lore/world-bible.md) |
| **공포 수치** | Dread | 게임 | 약탈단이 플레이어에게 느끼는 공포 0~100. 평판과 별개 | [factions §3.6](lore/factions.md) |
| **과열** | Overheat | 게임 | 기계형의 열량이 100에 도달해 강제 정지하는 상태 | [bestiary §0.3](lore/bestiary.md) |
| **관로** | Conduit | 세계 | 탑과 탑, 탑과 마디를 잇는 지하 통로. 정원사망 지하층 | [world-bible §4.1](lore/world-bible.md) |
| **관로 지네** | Conduit Crawler | 생물 | 관로에 사는 대형 절지동물. 마비독 | [bestiary §9](lore/bestiary.md) |
| **관로 하단** | Conduit Depths | 지명 | 잿빛 수도원 1층 균열 너머의 비공개 구역. 그늘 사람 공급원 | [14 §9.4](design/14-locations-and-dungeons.md) |
| **괴혈병** | Scurvy | 게임 | 비타민 0일 때 진행하는 결핍 질환 (CANON 4) | [03](design/03-survival.md) |
| **구제기** | Culler | 생물 | 유해 동물 제거용 대형 정원사 기계. 구역 +200m까지만 추격 | [bestiary §13](lore/bestiary.md) |
| **굴뚝** | Chimney | 문화 | 대기처리탑의 민간 호칭 | [world-bible §4.1](lore/world-bible.md) |
| **굴쥐** | Burrow Rat | 생물 | 관로·창고의 대형 쥐. 물리면 감염 위험 높음 (CANON) | [bestiary §2](lore/bestiary.md) |
| **궤도 중계기** | Orbital Relay | 세계 | 정원사망 궤도층. 3기. 침묵의 주체 | [world-bible §4.1](lore/world-bible.md) |
| **귀환 보증** | Return Bond | 세력·게임 | 길드 서비스. 원정 중 사망 시 지정인에게 보증금 지급 | [factions §2.4](lore/factions.md) |
| **규칙 대칭성** | Rule Symmetry | 게임 | 플레이어 규칙 = 적·NPC·동물·기계 규칙 (CANON 5) | [GDD §4.2](GDD.md) |
| **그늘 사람** | Shade-folk | 생물 | 장막 아래 지하로 내려간 사람들의 후손(지하 지파). 작고 빛을 싫어하며 무리 지음(CANON 7.3) | [bestiary §17](lore/bestiary.md) |
| **그늘 사람들** | Shade-folk | 세력(확장) | 검은 숲의 야행성 은둔 공동체 | [factions §8](lore/factions.md) |
| **기능 능력치** | Body Function | 게임 | 의식·이동·조작·시야·청각·호흡·순환. 부위 상태에서 계산 | [02](design/02-body-and-health.md) |
| **기력** | Energy | 게임 | 최대 = 50 + 의지 × 5. 공격·능력·방어 반응에 소모, 턴마다 회복(CANON 7.2). 1차 '스태미나' 대체 | [07 §6](design/07-combat.md) |
| **기분 요인** | Mood Factor | 게임 | 기분을 구성하는 개별 항목(수치 + 지속시간) | [04](design/04-psyche.md) |
| **긴겨울** | Longwinter | 세계 | 42일. 가장 긴 계절. 고개 폐쇄, 노지 작물 불가 | [world-bible §2.1](lore/world-bible.md) |
| **긴밤 지킴** | Longnight Vigil | 문화 | 긴겨울 가장 긴 밤에 화덕을 꺼뜨리지 않는 관습 | [world-bible §7.5](lore/world-bible.md) |
| **깊이 3층** | Three Depths | 게임 | 모든 시스템이 가져야 하는 L1 표면 / L2 중간 / L3 심층 구조 (CANON 5) | [GDD §4.1](GDD.md) |

## ㄴ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **남은 별** | The Last Star | 세계 | 장막 틈에 보이는 유일한 중계기 | [world-bible §10 T7](lore/world-bible.md) |
| **납골당** | Ossuary (Floor) | 지명 | 잿빛 수도원 지하 2층. 옛 병동. 말라붙은 자의 거처 | [14 §3.3](design/14-locations-and-dungeons.md) |
| **납골실** | Ossuary Room | 게임 | 방 유형. 벽감·석관 2~4, 잠듦 확률 50% | [14 §4](design/14-locations-and-dungeons.md) |
| **뇌관** | Primer | 아이템 | 탄약 재장전의 병목 부품 | [world-bible §6.1](lore/world-bible.md) |
| **능력** | Ability | 게임 | 능력 포인트로 배우는 기술. 액티브(기력·재사용 대기)·패시브·토글 | [15](design/15-abilities.md) |
| **능력 트리** | Ability Tree | 게임 | 도검·도끼·둔기·창·궁술·생존 6개 × 능력 4개 | [15 §6](design/15-abilities.md) |
| **능력 포인트** | Ability Point | 게임 | 레벨업마다 1, 시작 2. 능력 1개를 배운다 | [15 §4](design/15-abilities.md) |
| **능력치** | Attribute | 게임 | 근력·민첩·지각·활력·의지. 생성 시 정해지고 레벨업마다 1점 추가(상한 20) | [05](design/05-progression.md) |

## ㄷ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **다턴 행동** | Channel Action | 게임 | 여러 턴 걸리는 채널 행동(치료·수색·수면·착탈). 중간에 끊길 수 있다 | [01 §4.2](design/01-time-and-turns.md) |
| **대기처리탑** | Atmospheric Processor | 세계 | 정원사망 대기층. 12기. 재의 장막의 원천 | [world-bible §4.1](lore/world-bible.md) |
| **던전 층** | Dungeon Floor | 게임 | 방 그래프 + 복도 + 계단. 시드로 한 번 생성 후 고정, 떠나면 정지 | [14 §2](design/14-locations-and-dungeons.md) |
| **도감** | Codex | 게임 | 생물·기계 지식. S0~S4 단계로 공개 | [bestiary §0.1](lore/bestiary.md) |
| **돌무지** | Cairn | 문화 | 촌락 장례. 언 땅 대신 돌을 쌓음 | [world-bible §7.3](lore/world-bible.md) |
| **동력 잔량** | Charge | 게임 | 기계형의 "배고픔" 대응 변수. 30% 미만이면 복귀 | [bestiary §0.3](lore/bestiary.md) |
| **둥지** | Nest | 생물 | 수리 드론이 모은 기계 잔해 더미. 부품 보물창고 | [world-bible §4.3](lore/world-bible.md) |
| **등대지기 형제단** | Lantern Brethren | 세력(확장) | 소금 해안의 등대 신호망 조합 | [factions §8](lore/factions.md) |
| **등불 서약단** | Lamp Covenant | 역사 | 유산 임대로 이주한 중세 재현 종교 공동체. 순례회의 뿌리 | [world-bible §3.1](lore/world-bible.md) |
| **디테일 채택 테스트** | Detail Admission Test | 게임(설계) | 결정·이야기·세계 중 하나 이상을 만족해야 디테일 채택 | [GDD §4.6](GDD.md) |
| **떠돌이** | Drifter | 게임 | 이름 없는 주인공 (CANON 3.7) | [GDD §6](GDD.md) |
| **떠오르는 숫자** | Floating Number | 게임(UI) | 피해·경험치가 개체 머리 위로 떠오르는 표시(D14) | [12 §2.5](design/12-ui-ux.md) |

## ㄹ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **레벨** | Level | 게임 | 경험치로 오르는 성장 단계. 1~20. 레벨업마다 능력치 +1·능력 포인트 +1(D12) | [15 §2](design/15-abilities.md) |
| **루팅 창** | Loot Window | 게임(UI) | 시체·상자·석관·서가·바닥의 내용물을 끌어놓는 창 | [13 §8](design/13-inventory.md) |

## ㅁ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **마디** | Node | 생물 | 정원 구역 하나를 지휘하는 고정형 기계 | [world-bible §4.2](lore/world-bible.md) |
| **마지막 정산** | Final Reckoning | 문화 | 길드 장례. 유품 경매로 빚을 갚음 | [world-bible §7.3](lore/world-bible.md) |
| **말라붙은 자** | The Withered | 생물 | **언데드가 아니라** 회색열 말기(정체 경과) 환자. 통증을 못 느끼지만 살아 있다(CANON 7.3) | [bestiary §19](lore/bestiary.md) |
| **맨발 회중** | Barefoot Congregation | 역사 | 유산 임대로 이주한 원시 회귀 공동체 | [world-bible §3.1](lore/world-bible.md) |
| **맹약석** | Compact Stone | 문화 | 울타리 맹약을 새긴 촌락 광장의 돌기둥 | [factions §1.3](lore/factions.md) |
| **명부** | The Roll | 세력 | 잔존 경비대 대원 명단. 명찰은 명부벽에 걸림 | [factions §5](lore/factions.md) |
| **무기고 협정** | Armory Accord | 역사 | 침후 55년. 재장전은 경비대, 유통은 길드 | [world-bible §3.1](lore/world-bible.md) |
| **문해력** | Literacy | 게임 | 책·문서·공사 표지판 해독 능력 | [06](design/06-knowledge.md) |

## ㅂ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **바늘잎 차** | Needle Tea | 아이템 | 비타민 +8. 괴혈병 예방 (L2 지식) | [world-bible §7.4](lore/world-bible.md) |
| **방 유형** | Room Type | 게임 | 경비실·납골실·서고·성소·창고·감방. 방마다 고정 거주자·컨테이너 | [14 §4](design/14-locations-and-dungeons.md) |
| **배경** | Background | 게임 | 캐릭터 생성 시 1개. 시작 숙련·평판·지식 결정 | [GDD §6.2](GDD.md) |
| **번영기** | Era of Plenty | 역사 | 침전 150~30년. 성간 교역 전성기 | [world-bible §3.1](lore/world-bible.md) |
| **볕철** | Glimmer | 세계 | 18일. 짧은 여름. 장막 틈 빈도 최대 | [world-bible §2.1](lore/world-bible.md) |
| **보호세** | Ward Tax | 세력 | 경비대가 촌락에서 곡식으로 걷는 세금 | [factions §5.4](lore/factions.md) |
| **부름 받은 자** | the Called | 세력 | 순례회가 우대하는 "울림 듣는 자" | [factions §4.3](lore/factions.md) |
| **부위 상태** | Region State | 게임 | 6부위(머리·몸통·팔×2·다리×2)의 멀쩡(≥85)·타박(≥60)·부상(≥35)·중상(>0)·불구(0) 단계(D10) | [02 §2.0](design/02-body-and-health.md) |
| **불 나눔** | Fire-Sharing | 문화 | 촌락 손님법. 중립 이상이면 화덕 옆 무료 숙박(7일 1회) | [world-bible §7.5](lore/world-bible.md) |
| **비틀거림** | Stumble | 게임 | 이동이 실패해 턴을 잃을 확률. 다리 상태·지형·몸 상태의 합(화면 문구 '휘청') | [01 §5.2](design/01-time-and-turns.md) |
| **빠른 슬롯** | Quick Slot | 게임(UI) | 하단 10칸(키 1~0). 능력과 소모품 공유 | [13 §7](design/13-inventory.md) |

## ㅅ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **사기** | Morale | 게임 | 0~100. 임계 이하 도주·항복. 기계형·말라붙은 자·포자 인간·융합체엔 없음 | [07](design/07-combat.md) |
| **사망 보고서** | Death Report | 게임 | 사망 원인 사슬을 보여주는 사후 공개 화면 | [GDD §4.4](GDD.md) |
| **사슬꾼** | Chainhand | 세력 | 약탈단의 노예 노동자 | [factions §3.3](lore/factions.md) |
| **삯검** | Hired Blade | 세력 | 길드의 고용 호위 | [factions §2.3](lore/factions.md) |
| **산업 (기술 단계)** | Industrial Tier | 기술 | 화약 총기·강철 공구. 일부 수리·재장전만 가능 | [world-bible §6](lore/world-bible.md) |
| **상처 개체** | Wound Object | 게임 | 상처 하나하나가 독립 상태를 가진 객체 | [02](design/02-body-and-health.md) |
| **상태** | Condition | 게임 | 질병·중독·마비 등 몸에 붙는 지속 효과의 총칭 | [02](design/02-body-and-health.md) |
| **상태 가시화** | State Visibility | 게임(UI) | 중요한 상태를 맵 위에서 보이게 하는 원칙: 애니메이션·숫자·판정 문구·머리 위 아이콘·체력 막대(D14) | [12 §2.5](design/12-ui-ux.md) |
| **상호작용 매트릭스** | Interaction Matrix | 게임 | 재질·원소·환경 조합 반응 데이터 테이블 | [GDD §4.3](GDD.md) |
| **서리목 고개** | Frostneck Pass | 지명 | 고원과 남부를 잇는 유일한 수레길. 긴겨울 폐쇄 | [world-bible §1.3](lore/world-bible.md) |
| **세 목동별** | Three Shepherd Stars | 문화 | 궤도 중계기 3기의 옛 민간 호칭 | [world-bible §4.1](lore/world-bible.md) |
| **세 줄 종** | Three-Line Peal | 문화·게임 | 순례회 종 음형. 정원사 기계를 일시 정지 (L3) | [world-bible §10 T5](lore/world-bible.md) |
| **소금 해안** | Saltrim Coast | 지명 | 잉걸땅 서부 해안. 확장 지역 | [world-bible §1.2](lore/world-bible.md) |
| **소문** | Rumor | 게임 | 거리에 따라 늦게 도착하고 왜곡되는 정보 | [06](design/06-knowledge.md) |
| **소작** | Cautery | 게임 | 불로 지져 출혈을 즉시 멈추는 처치. 통증 극심, 흉터 확정 | [02](design/02-body-and-health.md) |
| **수리 드론** | Tender Drone | 생물 | 정비용 소형 정원사 기계. 출혈 없음, 부품 손상·과열 (CANON) | [bestiary §4](lore/bestiary.md) |
| **숙달** | Mastery | 게임 | 의료·생존에만 남은 반복 성장 0~5단계(성공 5/15/30/50/80회) | [15 §9.3](design/15-abilities.md) |
| **숙련** | Skill | 게임 | **(2차 폐지)** 사용 기반 기술 수치. 레벨·능력 트리와 의료·생존 숙달로 대체(D12) | [05 §4](design/05-progression.md) |
| **순찰** | Patrol | 게임 | 약탈자 야영지에서 매일 06:00에 걸어 나오는 장소 사건 | [10 §3](design/10-storyteller-and-events.md) |
| **스태미나** | Stamina | 게임 | **(2차 폐지)** → **기력**(Energy)으로 대체(CANON 7.2) | [07 §6](design/07-combat.md) |
| **시드** | Seed | 게임 | 월드·사건 생성의 출발 난수값. 결정론의 기준 | [GDD §11](GDD.md) |
| **신열매** | Sourberry | 아이템 | 비타민 +15. 볕철에만 | [world-bible §7.4](lore/world-bible.md) |
| **신호회** | The Signalists | 세력(확장) | 중계기 재접촉을 노리는 기술 결사. 순례회의 숙적 | [factions §8](lore/factions.md) |

## ㅇ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **야생 정원사** | Feral Gardeners | 세력 | 명령을 잃은 자율 기계 체계. 대화 불가 | [factions §6](lore/factions.md) |
| **야생화** | Going Feral | 세계 | 정원사망 지상 기계가 명령을 잃고 마지막 규정을 왜곡 수행하는 현상 | [world-bible §4.3](lore/world-bible.md) |
| **야영지 보관함** | Camp Stash | 게임 | 시작 야영지의 12×8 보관 격자. 수색대가 털 수 있다 | [13 §2](design/13-inventory.md) |
| **약탈자** | Reaver | 생물 | 잿빛 약탈단원. 인간 템플릿의 기준 | [bestiary §3](lore/bestiary.md) |
| **양치기 골** | Shepherd's Dale | 지명 | 촌락연합의 중심 골짜기 | [world-bible §1.3](lore/world-bible.md) |
| **엄니돼지** | Tuskhog | 생물 | 야생화한 공사 가축 돼지. 다쳐도 도주하지 않음 | [bestiary §8](lore/bestiary.md) |
| **연대기** | Chronicle | 게임 | 캐릭터 간 영구 기록. 게임 효과 없음 | [GDD §4.5](GDD.md) |
| **열량** | Heat | 게임 | 기계형의 스태미나 대응 변수 0~100 | [bestiary §0.3](lore/bestiary.md) |
| **오염된 성소** | Tainted Sanctum | 지명 | 잿빛 수도원 지하 3층. 살덩이·포자 바닥, 대성소에 융합체 | [14 §3.3](design/14-locations-and-dungeons.md) |
| **울림 듣는 자** | Hum-hearer | 게임(특성) | 정원사 기계의 고주파음을 듣는 청각 변이 | [world-bible §10 T9](lore/world-bible.md) |
| **울타리 맹약** | Hedge Compact | 역사 | 침후 19년 촌락연합 창설 서약 | [world-bible §3.1](lore/world-bible.md) |
| **울타리꾼** | Hedgeguard | 세력 | 촌락 민병 | [factions §1.3](lore/factions.md) |
| **원시 (기술 단계)** | Primitive Tier | 기술 | 돌·뼈·가죽 수준. 어디서나 생산 | [world-bible §6](lore/world-bible.md) |
| **위협 예산** | Threat Budget | 게임 | 시간에 따라 쌓이고 사건 발생 시 소비되는 스토리텔러 자원 | [10](design/10-storyteller-and-events.md) |
| **유산 임대** | Heritage Lease | 역사 | 공사가 생활양식 공동체에 저가로 땅을 빌려준 제도 | [world-bible §3.1](lore/world-bible.md) |
| **유압액 누설** | Hydraulic Leak | 게임 | 기계형의 출혈 대응. 바닥에 유막 흔적 | [bestiary §0.3](lore/bestiary.md) |
| **융합체** | The Amalgam | 생물 | 회색열 치료 시도로 여러 환자가 엉겨 생긴 살덩이. 3층 보스(CANON 7.3) | [bestiary §20](lore/bestiary.md) |
| **이빨** | Fang | 세력 | 약탈단 두목의 측근 정예 | [factions §3.3](lore/factions.md) |
| **인가** | Clearance | 문화 | 공사 출입 인가에서 온 말. 순례회에선 "축복" | [world-bible §7.2](lore/world-bible.md) |
| **일조 지수** | Insolation Index | 게임 | 0~100. 침묵 전 맑은 정오 = 100. 작물·기분·건조에 사용 | [world-bible §2.1](lore/world-bible.md) |
| **잉걸땅** | Emberland | 지명 | 하스의 개척 대륙 | [world-bible §1.2](lore/world-bible.md) |

## ㅈ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **작가 전용 진실** | Author-only Truth | 표기(작가) | 게임 텍스트에 직접 쓰지 않는 세계의 정답. 공개 단계 P0~P4로 관리 | [world-bible §10](lore/world-bible.md) |
| **잔존 경비대** | Remnant Wardens | 세력 | 공사 경비대 후손. 소수 화기. 기본 태도 경계 | [factions §5](lore/factions.md) |
| **잠든 적 기습** | Sleeping Strike | 게임 | 잠든·기절한 대상 공격: 명중 +40, 반응 불가, 후면 판정, 첫 타 ×1.5 | [07 §2.8](design/07-combat.md) |
| **잠행** | Stealth | 게임 | 생존 트리 토글 능력. 이동 소음 ×0.3, 발견 거리 −40%, 이동 2턴 | [15 §6.6](design/15-abilities.md) |
| **장막 순례회** | Pilgrims of the Veil | 세력 | 장막을 신의 수의로, 기계를 천사로 믿는 교단. 기본 태도 경계 | [factions §4](lore/factions.md) |
| **장막 틈** | Veil Break | 세계 | 장막이 잠시 걷히는 희귀 날씨. 일조 100, 밤 복사냉각 | [world-bible §2.2](lore/world-bible.md) |
| **장물** | Marked Goods | 게임 | 원래 세력의 표식이 남은 약탈품. 해당 정착지에서 몰수 | [factions §3.4](lore/factions.md) |
| **장부장** | Ledgermaster | 세력 | 길드 장부관 책임자 | [factions §2.3](lore/factions.md) |
| **장비 슬롯** | Equipment Slot | 게임 | 머리·몸·장갑·장화·허리띠·망토·목걸이·반지×2·주무기·보조 11개(D11) | [13 §6](design/13-inventory.md) |
| **장소 기반 사건** | Place Event | 게임 | 출발지와 실제 인구를 가진 사건(순찰·수색·재점거·소문). 가장자리 스폰 대체(D8) | [10](design/10-storyteller-and-events.md) |
| **재 농도** | Ash Load | 게임 | 지역 환경 변수 0~100. 재폐·시야·작물·기계 밀집에 영향 | [world-bible §2.5](lore/world-bible.md) |
| **재가래** | Ash Phlegm | 게임 | 회색열 2단계의 회색 가래. 외부 관찰 단서 | [world-bible §5.2](lore/world-bible.md) |
| **재까마귀** | Ash Crow | 생물 | 부상자·사체 위를 맴도는 까마귀 떼. 길드 전서 까마귀의 원종 | [bestiary §7](lore/bestiary.md) |
| **재나방 떼** | Ashmoth Swarm | 생물 | 밤에 광원으로 몰려드는 군체. 횃불을 끔 | [bestiary §10](lore/bestiary.md) |
| **재내림** | Ashfall | 세계 | 30일. 재비 최다, 추수·저장의 계절 | [world-bible §2.1](lore/world-bible.md) |
| **재눈** | Ashsnow | 세계 | 재 섞인 회색 눈. 발자국이 남음 | [world-bible §2.2](lore/world-bible.md) |
| **재늑대** | Ash Hound | 생물 | 변이·야생화한 개 무리. 피 냄새·소음에 반응 (CANON) | [bestiary §1](lore/bestiary.md) |
| **재달** | Cinder | 세계 | 하스의 위성. 장막 너머 주황 얼룩 | [world-bible §1.1](lore/world-bible.md) |
| **재때** | Grime | 게임 | 재비로 의복에 쌓이는 오염 0~100. 단열 저하 | [world-bible §2.3](lore/world-bible.md) |
| **재떡** | Ashcake | 아이템 | 순례회 의식 음식. 탑 기슭 재를 섞음 | [world-bible §7.4](lore/world-bible.md) |
| **재맹세자** | Ashsworn | 세력 | 순례회 전사 수도사 | [factions §4.3](lore/factions.md) |
| **재물** | Ashwater | 아이템 | 받은 빗물·녹인 재눈. 정화 필요 | [world-bible §2.3](lore/world-bible.md) |
| **재바람** | Ashgale | 세계 | 재를 실은 강풍. 시야 −60%, 재폐 누적 | [world-bible §2.2](lore/world-bible.md) |
| **재반점** | Ash-mottling | 게임 | 회색열 3단계의 회색 피부 반점. 회복 후 흉터 | [world-bible §5.2](lore/world-bible.md) |
| **재보리** | Ash Barley | 아이템 | 고원 주곡. 일조 20 미만에선 자라지 않음 | [world-bible §2.1](lore/world-bible.md) |
| **재비** | Ashrain | 세계 | 산성 섞인 회색 비 (CANON). 체온·부식·식수·작물에 영향 | [world-bible §2.3](lore/world-bible.md) |
| **재뿔사슴** | Ashhorn Stag | 생물 | 대형 초식 변이동물. 대량 고기 | [bestiary §5](lore/bestiary.md) |
| **재사용 대기** | Cooldown | 게임 | 액티브 능력 사용 후 다시 쓸 수 없는 자기 턴 수 | [15 §5](design/15-abilities.md) |
| **재의 겨울** | Ash Winter | 역사 | 침후 0~20년. 일조 급감·대기근·회색열 | [world-bible §3.1](lore/world-bible.md) |
| **재의 장막** | Ashveil / the Veil | 세계 | 처리탑이 뿜은 재가 하늘을 덮은 상태. 게임 제목의 뜻 | [world-bible §2](lore/world-bible.md) |
| **재이름** | Ash Name | 문화 | 순례회 입회 시 받는 두 단어 이름 | [world-bible §7.6](lore/world-bible.md) |
| **재점거** | Reoccupation | 게임 | 정리한 방이 3일 유예 뒤 하루 15%로 공급원 인구에게 다시 차는 것 | [14 §9.3](design/14-locations-and-dungeons.md) |
| **재폐** | Ash Lung | 게임 | 재 흡입 누적 만성 상태 0~100. 거의 회복 불가 | [world-bible §2.5](lore/world-bible.md) |
| **재표지자** | Ash-marked | 문화·특성 | 회색열 회복자. 부분 면역 | [world-bible §5.3](lore/world-bible.md) |
| **잿곰** | Cinder Bear | 생물 | 대형 포식 변이동물. 긴겨울 동면 | [bestiary §6](lore/bestiary.md) |
| **잿빛 수도원** | Grey Cloister | 지명 | 회색 고원 북서의 순례회 초기 수도원 폐허. 프로토타입 지역(지상 + 지하 3층) | [14 §3](design/14-locations-and-dungeons.md) |
| **잿빛 약탈단** | Ashen Reavers | 세력 | 약탈·노예 무리들의 총칭. 기본 태도 적대 | [factions §3](lore/factions.md) |
| **잿손 하엘** | Hael Ashhand | 인물 | 장막 순례회 창시자(침후 6년) | [world-bible §3.1](lore/world-bible.md) |
| **적성** | Aptitude | 게임 | **(2차 폐지)** 숙련별 학습 배율. 숙련 폐지와 함께 사용 안 함 | [05 부록 B](design/05-progression.md) |
| **전서 까마귀** | Ledger Crow | 세력·생물 | 길드가 길들인 재까마귀. 장부관 간 장부 동기화 | [factions §2.3](lore/factions.md) |
| **정산** | Settlement (Re-entry) | 게임 | 정지했던 층에 돌아올 때 일 단위 과정(불씨·부패·치유·재점거)을 한 번에 계산 | [14 §9.2](design/14-locations-and-dungeons.md) |
| **정원 구역** | Garden Zone | 세계 | 마디 하나가 관리하는 반경 300~800m 구역 | [world-bible §4.4](lore/world-bible.md) |
| **정원사 (기술 단계)** | Gardener Tier | 기술 | 정원사망 기술. 원리 이해 불가, 발굴만 | [world-bible §6](lore/world-bible.md) |
| **정원사 심장** | Gardener Heart | 아이템 | 정원사 기계의 고급 동력핵 | [bestiary §13](lore/bestiary.md) |
| **정원사망** | Gardener Lattice | 세계 | 궤도 중계기 + 대기처리탑 + 작업기계 + 관로의 테라포밍 체계 | [world-bible §4](lore/world-bible.md) |
| **정지되다** | to be stopped | 문화 | 고원말로 "죽다" | [world-bible §7.2](lore/world-bible.md) |
| **정착균** | Settler Fungus | 세계(작가 전용) | 정원사망이 뿌린 토양 개량 곰팡이. 회색열의 원인 | [world-bible §10 T2](lore/world-bible.md) |
| **제3 초소** | Post Three | 지명 | 잔존 경비대 본거지. 탄약 재장전소 | [world-bible §1.3](lore/world-bible.md) |
| **종지기** | Bell-bearer | 세력 | 순례회 행렬 인도자. 유일하게 글을 배움 | [factions §4.3](lore/factions.md) |
| **종탑 사건** | Belfry Incident | 역사 | 침후 47년. 종소리로 구제기를 물린 기록 | [world-bible §3.1](lore/world-bible.md) |
| **중세 (기술 단계)** | Medieval Tier | 기술 | 철제 무기·사슬갑옷·석궁. 대장간에서 생산 | [world-bible §6](lore/world-bible.md) |
| **지역** | Region | 게임 | 지상 지도 1장 + 던전 층 N개 + 공급원의 묶음 | [14 §2](design/14-locations-and-dungeons.md) |
| **지역 출입구** | Region Exit | 게임 | 지역 밖 존재가 들어오는 유일한 장소. 하루 전 소문으로 예고 [후속] | [10 §2](design/10-storyteller-and-events.md) |
| **지혈대** | Tourniquet | 아이템 | 동맥 출혈 처치. 장시간 사용 시 괴사 | [02](design/02-body-and-health.md) |

## ㅊ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **차양 규정** | Shade Protocol | 세계(작가 전용) | 탑이 반사 입자를 뿜어 일조를 줄이는 비상 냉각 모드. 장막의 정체 | [world-bible §10 T3](lore/world-bible.md) |
| **첫볕제** | First Glimmer | 문화 | 볕철 시작 축제. 가격 −10% | [world-bible §7.5](lore/world-bible.md) |
| **첫불** | Firstlight | 지명 | 최초 착륙지·옛 공사 수도. 현재 거대 폐허 | [world-bible §1.2](lore/world-bible.md) |
| **초석** | Saltpeter | 아이템 | 굴쥐 굴 퇴적물에서 얻는 화약 원료 (L3) | [world-bible §6.1](lore/world-bible.md) |
| **측량기** | Surveyor | 생물 | 정원 구역 감시용 3족 기계. 안테나로 경계 상승 | [bestiary §12](lore/bestiary.md) |
| **층 정지** | Floor Freeze | 게임 | 플레이어가 없는 층은 진행하지 않는다(턴 단위 과정 정지) | [14 §9.1](design/14-locations-and-dungeons.md) |
| **칠번 굴뚝** | Chimney Seven (G-7) | 지명 | 회색 고원의 대기처리탑. 높이 412m | [world-bible §1.3](lore/world-bible.md) |
| **침묵** | The Hush | 역사 | 침후 0년. 궤도 중계기의 전면 신호 중단 (CANON) | [world-bible §3.1](lore/world-bible.md) |
| **침묵원** | The Stillhouse | 지명 | 칠번 굴뚝 기슭의 순례회 수도원 | [world-bible §1.3](lore/world-bible.md) |
| **침묵일** | Hush Day | 문화 | 침묵 기념일. 종을 울리지 않음 | [world-bible §7.5](lore/world-bible.md) |
| **침전** | BH (Before Hush) | 표기 | 침묵 이전 연도 표기. 예: 침전 302년 | [world-bible §3](lore/world-bible.md) |
| **침후** | AH (After Hush) | 표기 | 침묵 이후 연도 표기. 현재 = 침후 71년 | [world-bible §3](lore/world-bible.md) |

## ㅋ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **칼든 공사** | Calden Charter Company | 세력(역사) | 하스를 개척한 성간 개척 회사 | [world-bible §3.1](lore/world-bible.md) |

## ㅌ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **탄피** | Casing | 아이템 | 재장전을 맡기려면 회수해야 하는 빈 탄피 | [factions §5.8](lore/factions.md) |
| **탐구** | Study | 게임 | 자유 저장 대체 모드(후보). 업적 없음 | [GDD §10.2](GDD.md) |
| **특성** | Trait | 게임 | 캐릭터 생성 시 2~3개 + 사건으로 획득·상실 | [04](design/04-psyche.md) |

## ㅍ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **파종기** | Sower | 생물 | 씨앗·균을 뿌리는 대형 정원사 기계 | [bestiary §11](lore/bestiary.md) |
| **평판** | Reputation | 게임 | 세력별 −100~+100, 6단계 | [factions §0](lore/factions.md) |
| **포자 구름** | Spore Cloud | 게임 | 포자 인간·융합체가 뿜는 구름. 기침·기력 −2·명중 −10·회색열 노출 판정 | [bestiary §18](lore/bestiary.md) |
| **포자 인간** | Spore-taken | 생물 | 장막 포자에 잠식된 순례자. 맞으면 포자를 뿜는다(CANON 7.3) | [bestiary §18](lore/bestiary.md) |
| **표석** | Waymark | 게임 | 모닥불·여관에서만 저장하는 대체 모드(후보) | [GDD §10.2](GDD.md) |

## ㅎ

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **하스** | Hearth | 세계 | 무대가 되는 변경 행성 (CANON) | [world-bible §1](lore/world-bible.md) |
| **해거름호** | the Gloaming | 역사 | 침전 3년 하스를 떠난 마지막 화물선 | [world-bible §3.1](lore/world-bible.md) |
| **해빙** | Thaw | 세계 | 30일. 진흙의 계절, 잿곰 기상 | [world-bible §2.1](lore/world-bible.md) |
| **행렬** | Procession | 세력 | 순례회의 이동 단위(5~15명, 종지기 1명). 계절마다 순례로를 돈다 | [factions §4.3](lore/factions.md) |
| **혈액량** | Blood Volume | 게임 | 인간 5,000ml. 15/30/40/50% 임계 (CANON 4) | [02](design/02-body-and-health.md) |
| **화기 허가증** | Firearm Permit | 세력·게임 | 경비대 우호 이상이면 발급(30고리). 없이 총을 들면 검문 | [factions §5.6](lore/factions.md) |
| **회랑** | Cloister Hall | 지명 | 잿빛 수도원 지하 1층. 그늘 사람·포자 인간 | [14 §3.3](design/14-locations-and-dungeons.md) |
| **회색 가루** | Grey Powder | 아이템·세계 | 재의 겨울 때 수도사들이 회색열 '치료'에 쓴 가루. 정체는 작가 전용(T2) | [bestiary §19](lore/bestiary.md) |
| **회색 고원** | Greymoor Highlands | 지명 | 북부 변경, 프로토타입 무대 (CANON) | [world-bible §1.3](lore/world-bible.md) |
| **회색 깃발** | Grey Flag | 문화 | 회색열 환자가 있는 집 문에 거는 천 | [world-bible §5.3](lore/world-bible.md) |
| **회색 폐** | Grey Lung | 게임 | 회색열 회복 후유증. 스태미나 최대 −10 | [world-bible §5.2](lore/world-bible.md) |
| **회색열** | Grey Fever | 세계 | 재의 겨울 이후 유행하는 역병 (CANON). 4단계 진행 | [world-bible §5](lore/world-bible.md) |
| **회색열 감염자** | The Fevered | 생물 | 회색열 3단계 섬망 상태의 인간. 괴물이 아니라 환자 | [bestiary §14](lore/bestiary.md) |
| **회수 조합** | Recovery Union | 역사 | 침후 8년 결성된 고물길드의 전신 | [world-bible §3.1](lore/world-bible.md) |
| **회피치** | Evasion | 게임 | (민첩−10)×2 + 장비·능력 − 둔중 + 크기, 양수면 × 다리 계수(CANON 7.2) | [05 §2.1](design/05-progression.md) |
| **흐린 늪** | Murk Fens | 지명 | 잉걸땅 동부 저지. 확장 지역 | [world-bible §1.2](lore/world-bible.md) |

## 기호·영문

| 용어 | English | 분류 | 정의 | 참조 |
|---|---|---|---|---|
| **0호 금고** | Vault Zero | 지명 | 제3 초소 지하의 봉인 금고. 경비대가 열지 않는 문 | [world-bible §10 T8](lore/world-bible.md) |
| **C1~C11** | Canon Candidates | 표기 | GDD가 제안한 CANON 추가 결정 후보 번호 | [GDD §16](GDD.md) |
| **D1~D14** | Decisions | 표기 | CANON 확정 결정 번호. D1~D6(시점·세계관·그래픽·저장·목표·엔진 이전), D7~D14(2차: 스톤샤드 기반·장소 기반 세계·1행동 1턴·HP+6부위·격자 소지품·레벨과 능력·16×16 그래픽·상태 가시화) | [CANON](CANON.md) |
| **Def** | Definition | 게임(데이터) | 콘텐츠를 정의하는 JSON 데이터 단위. `parent` 상속, 경로 패치 지원 | [11](design/11-modding.md) |
| **E1~E12** | Engine Rules | 표기 | 엔진 독립 원칙 규칙 번호 | [GDD §12](GDD.md) |
| **L1 / L2 / L3** | Depth Layers | 게임 | 깊이 3층. L1 표면(첫 1시간), L2 중간(10~50시간), L3 심층(50시간+) | [GDD §4.1](GDD.md) |
| **P0~P4** | Reveal Stages | 표기(작가) | 작가 전용 진실의 게임 내 공개 단계. P0 비공개 ~ P4 확장 결말 | [world-bible §10](lore/world-bible.md) |
| **RNG 스트림** | RNG Stream | 게임(기술) | world / combat / loot / story / ai 독립 난수열 (CANON 4) | [GDD §11](GDD.md) |
| **S0~S4** | Codex Stages | 게임 | 도감 공개 단계. ??? → 관찰 → 전투 → 해부 → 문헌 | [bestiary §0.1](lore/bestiary.md) |
| **T1~T10** | Truths | 표기(작가) | 작가 전용 진실 번호 | [world-bible §10](lore/world-bible.md) |
| **TU** | Time Unit | 게임 | 내부 시간 단위. **100 TU = 1턴 = 게임 시간 3초. 1시간 = 1,200턴** (CANON 4). 기본 행동은 모두 1턴(D9) | [01](design/01-time-and-turns.md) |
| **‱ (만분율)** | Basis Point | 게임(기술) | 코어 확률 표기 단위. 정수 연산 결정론용 | [GDD §11](GDD.md) |
| **HP** | Hit Points | 게임 | 최대 = 50 + 활력 × 5. 0이면 사망. 미치유 상처 sev 절반이 회복 상한을 묶는다(D10) | [02 §2.0](design/02-body-and-health.md) |
| **6부위** | Six Regions | 게임 | 머리·몸통·왼팔·오른팔·왼다리·오른다리. 부위 HP%와 기능 효율 중 나쁜 쪽으로 상태 결정 | [02 §2.0](design/02-body-and-health.md) |
