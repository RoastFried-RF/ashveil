# v303 아이템·능력 전수 아트 방향 적용

**206 Item + 28 Ability + 기본 행동 4개(shove/trip/disarm/crouch) = 238개 새 원화**를 직접 제작했다. 동일 물품의 구 호출 이름 34개까지 포함해 baseline의 **272개 프레임 키를 전부 교체**한다. 모든 키의 논리 크기는 **32×32**이며, 이 담당 범위에 16px 프레임은 없다. 콘텐츠 패치나 Def 바인딩을 바꾸지 않고 현재 key를 그대로 새 아틀라스 좌표로 연결한다.

## 방향과 참고 검토

[공통 방향](art-direction-v303.md)과 CANON D13을 적용했다. [공식 참고 목록](../tools/art/direction-v303/references.json)의 **12개 JPG를 모두 `view_image`로 직접 열었다**. 참고 이미지의 픽셀·외곽선을 복제하거나 생성기에 입력하지 않았다. 관찰한 재질 대비·구조·마모 원리를 새 정수 좌표 도형에 적용했다.

| 참고작에서 본 원리 | 새 아이템·능력에 적용한 내용 |
| --- | --- |
| Fear & Hunger: 마른 면, 빛을 받는 소수의 밝은 부분, 쓰던 생활 도구 | 먹색 외곽, 흐릿한 유리, 닳은 가죽·접힌 천, 발광 대신 실제 도구의 구조 |
| Stoneshard: 지면과 분리되는 장비 외곽, 석재·목재·천의 반사 차이 | 날·총열은 가는 밝은 선, 천은 넓고 무광인 면, 목재는 방향 있는 단면·결·손잡이 |
| Darkwood: 물건의 용도와 남은 사용 흔적 | 회전식 탄창, 볼트 손잡이, 부싯돌 장치, 빈 탄피 입구, 뚜껑·포장·내용물 상태를 각각 그림 |
| Darkest Dungeon: 마른 새김 선, 제한된 밝은 면, 무거운 철 | 능력과 기본 행동을 각진 먹색 판 위의 도구·행위자·방향 도식으로 새로 작성 |

팔레트는 먹 `#19191b`, 그늘 `#29282a`, 흙 `#49413b`, 돌 `#68645c`, 닳은 면 `#969080`, 천 `#a69a7b`, 피부 `#b3a18b`, 양피지 `#d0c2a0`, 철 `#697075`, 녹 `#78503c`를 중심으로 한다. 넓은 청록 면을 줄였고 청록은 전원셀·유물의 작은 재질 부분에 사용했다. 좌상단의 밝은 면과 그 아래의 두께를 정수 픽셀로 구분한다.

참고 JPG별 검토 링크:

- Darkest Dungeon®: [darkest-dungeon-0.jpg](../test-results/references-v303/darkest-dungeon-0.jpg) · [darkest-dungeon-1.jpg](../test-results/references-v303/darkest-dungeon-1.jpg) · [darkest-dungeon-2.jpg](../test-results/references-v303/darkest-dungeon-2.jpg)
- Darkwood: [darkwood-0.jpg](../test-results/references-v303/darkwood-0.jpg) · [darkwood-1.jpg](../test-results/references-v303/darkwood-1.jpg) · [darkwood-2.jpg](../test-results/references-v303/darkwood-2.jpg)
- Fear & Hunger: [fear-hunger-0.jpg](../test-results/references-v303/fear-hunger-0.jpg) · [fear-hunger-1.jpg](../test-results/references-v303/fear-hunger-1.jpg) · [fear-hunger-2.jpg](../test-results/references-v303/fear-hunger-2.jpg)
- Stoneshard: [stoneshard-0.jpg](../test-results/references-v303/stoneshard-0.jpg) · [stoneshard-1.jpg](../test-results/references-v303/stoneshard-1.jpg) · [stoneshard-2.jpg](../test-results/references-v303/stoneshard-2.jpg)

## 새 형태와 상태 구분

- 도검은 별도 날·접힌 등·핀을 박은 탱·손잡이로 작성했다. 마체테의 긴 작업 날, 대도의 긴 양손 손잡이, 녹슨 칼의 무딘 녹, 뼈칼의 골백색 면을 구분했다. 손도끼는 굽은 목재 자루와 끼운 머리, 부싯돌은 결박과 깨진 면을 보여 준다.
- 화승 장총은 부싯돌 장치와 장전봉, 소총은 노리쇠 손잡이, 권총은 회전식 실린더와 짧은 개머리로 그렸다. 공장/재생 실탄·빈 탄피·납탄·뇌관·종이 화약 포장은 각각 다른 실제 구조로 작성했다.
- 셔츠·코트·앞치마·누빔·사슬옷·양모 의류는 소매·자락·목끈·격자 봉제·금속 고리·뜨개 조직으로 구별한다. 접힌 천과 감은 붕대, 실타래와 활시위, 생가죽과 무두질 가죽은 별도의 구조다.
- 막대 의족·관절 의족·갈고리 손·개척 의수·정원사 이식지는 소켓·무릎 축·후크·손가락·흰 가지 형태를 그렸다. 침낭·침대·깔개와 공유하지 않는다.
- 생고기·훈제·구이·직접 말린 고기·염장육, 밀봉/개봉/빈 통조림·배급 포장은 조리면·절임 입자·뚜껑·내용물·접힘으로 나눈다. 달걀과 깨진 달걀, 빈 그릇과 날/익은 죽도 분리한다.
- 기본 물병·흐린 물병·솔잎차 물병·숯·모래 여과통을 모두 새로 그렸다. 여과통은 병목 대신 넓은 입구와 숯·모래 층, 하단 출구를 가진다. 물의 병원체나 재·염분 수치를 그림으로 단정하지 않는다.
- 미확인 여섯 정제는 색과 외형만 그렸다. 효능·질환·위험 문양을 붙이지 않았다. 정수정은 확인된 물품명에 맞는 별도 포장 도식이다. 횃불·모닥불 조립품·등불 아이콘에 실제 점화 상태를 고정하지 않았다.
- 능력 28개와 기본 행동 4개는 새로 그린 각진 판에 도구·몸·표적·방향을 읽을 수 있는 새김 그림이다. 포자 분출은 사람 주변으로 흩어지는 입자, 화살 회수는 화살을 집는 손, 다리 걸기는 쓰러지는 자세로 나타낸다.

## 범위와 산출물

- [생성기](../tools/art/direction-v303/draw-items.py): 새 폴리곤·선·픽셀 군집의 직접 저작 원본. 기존 SVG는 그리기가 끝난 뒤 검사의 외곽 비교에만 사용하고, 기존 PNG/JPG는 그림 생성의 입력으로 읽지 않는다.
- [통합 fragment](../tools/art/direction-v303/items.fragment.json): 신규 sheet 1개, 기존 frame key 272개 그대로. 별도 콘텐츠 patch는 만들지 않는다.
- [아틀라스 PNG](../public/sprites/original/direction-v303/items/items-atlas.png) / [명시적 픽셀 SVG](../public/sprites/original/direction-v303/items/items-atlas.svg): **512×480**, 16열×15행, 32×32 셀, **66,396바이트**. 한 sheet에 238개 새 원화를 담는다.
- [전체 카탈로그·계약](../public/sprites/original/direction-v303/items/catalog.json): 전체 238개 의미·Def·label·현재 key·개별 PNG/SVG·배치 좌표, alias 34개, baseline 기대/provided 키, 파일별 CRC·알파·해시를 기록한다.
- [독립 계약](../public/sprites/original/direction-v303/items/independent-contract.json): 전체 baseline 272개와의 변경·크기·기하 비교, 개별 238+아틀라스 1개의 PNG/SVG 계약.
- `original_storage_chest_item`은 이 작업에 포함한다. `original_ashberry_bush`, `original_hearth_oat_plot`, pantry UI, 나무, `original_storage_chest0/2`와 월드 prop은 소품 담당 범위로 제외했다.

## 재현과 실제 그림 검토

```sh
python3 tools/art/direction-v303/draw-items.py
python3 tools/art/direction-v303/draw-items.py --check
```

생성 후 `--check`를 실행해 **238개 픽셀 해시 고유**, PNG 서명·chunk CRC·IHDR·RGBA·알파 0/255, 개별 SVG의 명시적 픽셀 소스, 아틀라스 **238개 사각 영역의 RGBA 정확 일치**, fragment와 전체 카탈로그의 재현을 확인했다. v302 직접 제작 원화 178개는 기존 SVG와 새 그림의 알파 실루엣이 모두 다르다.

생성기를 import하지 않는 독립 검사에서는 baseline의 **272개 키·32×32 크기가 전부 보존**, 누락/추가 **0개**, 새 픽셀과 SVG 복원 일치 **239개**, 아틀라스의 개별 원화 일치 **238개**를 확인했다. 비교 감사에서만 baseline PNG를 읽어 새 그림과 대조했고 **272개 모두 픽셀·알파 외곽·색 영역의 기하 패턴이 달랐다**. 색만 치환한 결과는 **0개**다. 이 비교의 이전 이미지 픽셀은 새 그림 생성에 들어가지 않는다.

다음 contact **8장 모두를 `view_image`로 직접 열었다**. 아이템 5장·능력 1장·기본 행동 1장에는 3배 확대와 원래 32px 미리보기가 함께 있고, 전체 atlas contact 1장으로 포장 후 누락과 식별성을 확인했다. 검토 중 일반 손도끼와 조립 손도끼가 같던 부분에 별도 결박·핀·마모를 넣어 고친 뒤 재생성했고, 최종 contact 전부를 검토했다.

- [아이템 1/5](../public/sprites/original/direction-v303/items/contact-items-01.png)
- [아이템 2/5](../public/sprites/original/direction-v303/items/contact-items-02.png)
- [아이템 3/5](../public/sprites/original/direction-v303/items/contact-items-03.png)
- [아이템 4/5](../public/sprites/original/direction-v303/items/contact-items-04.png)
- [아이템 5/5](../public/sprites/original/direction-v303/items/contact-items-05.png)
- [능력 28개](../public/sprites/original/direction-v303/items/contact-abilities-01.png)
- [기본 행동 4개](../public/sprites/original/direction-v303/items/contact-maneuvers-01.png)
- [최종 아틀라스](../public/sprites/original/direction-v303/items/contact-atlas.png)

공유 manifest·renderer·Core·Defs·Git은 수정하지 않았다. GPU/Full/World/브라우저/프로젝트 테스트는 이 담당 작업에서 실행하지 않았고, 실제 게임 화면 검증은 통합 담당 범위다.

최종 atlas SHA-256: `6f814b505a177879a4b6805715738948701d654d6696d08adfe0f8b5561efe2b`

fragment SHA-256: `84363581a2b3d8bad5c2db32e67823d35fced08ba5ce2c5814312c59188ed1f4`

## 모든 의미별 현재 키 매핑

| 정의/행동 | 표시 이름 | 보존한 frame key | 새 도형 계열 |
| --- | --- | --- | --- |
| `Item.Hood` | 두건 | `complete_item_hood` | misc / hood |
| `Item.AshMask` | 방진 면포 | `complete_item_ash_mask` | misc / mask |
| `Item.LightCrossbow` | 경석궁 | `complete_item_light_crossbow` | tool / crossbow |
| `Item.Arrow` | 화살 | `ashveil_arrow_bundle` | tool / arrow |
| `Item.Bolt` | 석궁 볼트 | `complete_item_bolt` | tool / bolt |
| `Item.Pole` | 뱃사공 장대 | `complete_item_pole` | tool / pole |
| `Item.LeatherCoat` | 가죽 코트 | `complete_item_leather_coat` | shirt / coat |
| `Item.LeatherApron` | 가죽 앞치마 | `complete_item_leather_apron` | misc / apron |
| `Item.OilclothCloak` | 방수포 망토 | `complete_item_oilcloth_cloak` | misc / cloak |
| `Item.OiledRaincoat` | 기름 먹인 천 우비 | `complete_item_oiled_raincoat` | misc / raincoat |
| `Item.Note` | 쪽지 | `complete_item_note` | book / note |
| `Item.OldMap` | 낡은 경비대 지도 | `complete_item_old_map` | book / map |
| `Item.OldLedger` | 길드 장부 조각 | `complete_item_old_ledger` | book / ledger |
| `Item.Lute` | 낡은 류트 | `complete_item_lute` | misc / lute |
| `Item.StorageChest` | 목제 보관함 | `original_storage_chest_item` | domestic / chest |
| `Item.Hardtack` | 건빵 | `complete_item_hardtack` | misc / hardtack |
| `Item.ShadeRoot` | 그늘뿌리 | `original_shade_root` | vegetables / shade_root |
| `Item.ShadeSeeds` | 봉인된 그늘 작물 종자 | `original_shade_seeds` | vegetables / shade_seeds |
| `Item.SeedVaultKey` | 종자 금고 열쇠 | `complete_item_seed_vault_key` | misc / key |
| `Item.SeedVaultLedger` | 종자 금고 정비 기록 | `complete_item_seed_vault_ledger` | book / seed |
| `Item.CampfireKit` | 야영 모닥불 꾸러미 | `original_hearth_campfire_kit` | domestic / campfire_kit |
| `Item.FieldMat` | 풀·가지 깔개 | `complete_item_field_mat` | bedding / mat |
| `Item.Bedroll` | 침낭 | `complete_item_bedroll` | bedding / bedroll |
| `Item.StrawBed` | 짚 침대 | `complete_item_straw_bed` | bedding / straw |
| `Item.Bed` | 나무 침대 | `complete_item_bed` | bedding / bed |
| `Item.GoodBed` | 좋은 침대 | `complete_item_good_bed` | bedding / good |
| `Item.MedicalBag` | 의료 가방 | `complete_item_medical_bag` | misc / medical_bag |
| `Item.TetanusSerum` | 봉인된 개척 혈청 | `complete_item_tetanus_serum` | bottle / serum |
| `Item.Wood` | 목재 | `original_hearth_wood` | domestic / wood |
| `Item.Stone` | 돌 조각 | `original_hearth_stone` | misc / stone |
| `Item.IronScrap` | 고철 조각 | `original_hearth_iron_scrap` | misc / iron_scrap |
| `Item.SteelIngot` | 강철 덩이 | `complete_item_steel_ingot` | misc / steel_ingot |
| `Item.RawHide` | 생가죽 | `complete_item_raw_hide` | misc / hide |
| `Item.Leather` | 무두질 가죽 | `original_hearth_leather` | misc / leather |
| `Item.Linen` | 리넨 천 | `complete_item_linen` | misc / linen |
| `Item.Wool` | 양모 | `complete_item_wool` | misc / wool |
| `Item.Thread` | 실 꾸러미 | `original_hearth_thread` | misc / thread |
| `Item.Charcoal` | 숯 | `original_hearth_charcoal` | misc / charcoal |
| `Item.Salt` | 소금 | `original_salt` | misc / salt |
| `Item.Wax` | 밀랍 | `complete_item_wax` | misc / wax |
| `Item.Needle` | 바늘 | `complete_item_needle` | tool / needle |
| `Item.Tongs` | 쇠집게 | `complete_item_tongs` | tool / tongs |
| `Item.StoneHammer` | 돌망치 | `complete_item_stone_hammer` | tool / stone_hammer |
| `Item.IronHammer` | 쇠망치 | `complete_item_iron_hammer` | tool / iron_hammer |
| `Item.WorkbenchKit` | 작업대 조립품 | `complete_item_workbench_kit` | kit / bench |
| `Item.ForgeKit` | 대장간 조립품 | `complete_item_forge_kit` | kit / forge |
| `Item.LoomKit` | 베틀 조립품 | `complete_item_loom_kit` | kit / loom |
| `Item.TanningVatKit` | 무두질 통 조립품 | `complete_item_tanning_vat_kit` | kit / vat |
| `Item.ArtisanKit` | 장인 작업대 조립품 | `complete_item_artisan_kit` | kit / artisan |
| `Item.CraftManual` | 고원 공작 수첩 | `complete_item_craft_manual` | book / craft |
| `Item.Egg` | 달걀 | `original_hearth_egg` | domestic / egg |
| `Item.CrackedEgg` | 깨진 달걀 | `original_cracked_hearth_egg` | domestic / cracked_egg |
| `Item.Cabbage` | 양배추 | `complete_item_cabbage` | vegetables / cabbage |
| `Item.CeramicJar` | 빈 도기 항아리 | `complete_item_ceramic_jar` | jar / empty |
| `Item.PickledCabbageJar` | 양배추 절임 항아리 | `complete_item_pickled_cabbage_jar` | jar / filled |
| `Item.CabbageSeed` | 양배추 씨앗 | `complete_item_cabbage_seed` | vegetables / cabbage_seed |
| `Item.SignalMaintenanceManual` | 칠번 처리구역 수신 설비 지침 | `complete_item_signal_maintenance_manual` | book / signal |
| `Item.FlintlockMusket` | 부싯돌 장총 | `flintlock_musket` | firearm / musket |
| `Item.LeadBall` | 납탄 | `lead_ball` | firearm / lead_ball |
| `Item.BlackPowderCharge` | 흑색화약 1회분 | `powder_charge` | firearm / powder |
| `Item.GunOil` | 총기 기름 | `gun_oil` | firearm / gun_oil |
| `Item.RawMeat` | 생고기 | `complete_item_raw_meat` | meat / raw |
| `Item.SmokedMeat` | 훈제 고기 | `complete_item_smoked_meat` | meat / smoked |
| `Item.Jerky` | 육포 | `complete_item_jerky` | meat / jerky |
| `Item.AirDriedMeat` | 직접 말린 육포 | `complete_item_air_dried_meat` | meat / dried |
| `Item.SharpeningStone` | 숫돌 | `complete_item_sharpening_stone` | misc / sharpen |
| `Item.BowString` | 여분 활시위 | `original_bow_string` | misc / bow_string |
| `Item.Greatsword` | 대도 | `greatsword` | knife / greatsword |
| `Item.Revolver` | 회전식 권총 | `revolver` | firearm / revolver |
| `Item.BoltRifle` | 볼트식 소총 | `bolt_rifle` | firearm / rifle |
| `Item.FactoryCartridge` | 공장 실탄 | `factory_round` | firearm / factory_round |
| `Item.ReclaimedCartridge` | 재생 실탄 | `reclaimed_round` | firearm / reclaimed_round |
| `Item.SpentCase` | 빈 탄피 | `empty_case` | firearm / empty_case |
| `Item.PrimerCap` | 뇌관 | `primer_cap` | firearm / primer |
| `Item.RagShirt` | 누더기 옷 | `complete_item_rag_shirt` | shirt / rag |
| `Item.PaddedJacket` | 누빔 재킷 | `complete_item_padded_jacket` | shirt / padded |
| `Item.ScrapMail` | 고철 사슬옷 | `complete_item_scrap_mail` | shirt / mail |
| `Item.ScrapHelmet` | 고철 투구 | `complete_item_scrap_helmet` | misc / helmet |
| `Item.Boots` | 가죽 장화 | `complete_item_boots` | misc / boots |
| `Item.Gloves` | 작업 장갑 | `complete_item_gloves` | gloves / leather |
| `Item.LeatherBelt` | 가죽 허리띠 | `ashveil_leather_belt` | domestic / belt |
| `Item.BoneCharm` | 뼈 부적 | `complete_item_bone_charm` | misc / charm |
| `Item.SealRing` | 녹슨 인장 반지 | `complete_item_seal_ring` | misc / ring |
| `Item.Cloth` | 천 조각 | `original_hearth_cloth` | misc / cloth |
| `Item.Bandage` | 붕대 | `original_hearth_bandage` | domestic / bandage |
| `Item.Tourniquet` | 지혈대 | `complete_item_tourniquet` | misc / tourniquet |
| `Item.Splint` | 부목 | `complete_item_splint` | misc / splint |
| `Item.Moonshine` | 밀주 | `complete_item_moonshine` | bottle / moonshine |
| `Item.Painkiller` | 백색 정제 | `complete_item_painkiller` | misc / painkiller |
| `Item.PillYellow` | 노란 알약 | `pill_yellow` | pill / yellow |
| `Item.PillBlue` | 푸른 알약 | `pill_blue` | pill / blue |
| `Item.PillWhite` | 흰 알약 | `pill_white` | pill / white |
| `Item.PillBlack` | 검은 알약 | `pill_black` | pill / black |
| `Item.PillGreen` | 초록 알약 | `pill_green` | pill / green |
| `Item.PillMagenta` | 자홍 알약 | `pill_magenta` | pill / magenta |
| `Item.WaterBottle` | 물병 (깨끗한 물) | `water_bottle` | bottle / water |
| `Item.DirtyWaterBottle` | 물병 (흐린 물) | `complete_item_dirty_water_bottle` | distinct_water / dirty_water |
| `Item.DriedApple` | 말린 사과 | `complete_item_dried_apple` | vegetables / apple |
| `Item.CannedMeat` | 개척기 통조림 | `complete_item_canned_meat` | tin / sealed |
| `Item.Lantern` | 기름 등불 | `complete_item_lantern` | misc / lantern |
| `Item.HealthDraught` | 쓴 약초탕 | `original_health_draught` | bottle / draught |
| `Item.LampOil` | 등잔 기름 | `complete_item_lamp_oil` | bottle / oil |
| `Item.Bones` | 뼈 무더기 | `complete_item_bones` | misc / bones |
| `Item.AshCap` | 잿빛 갓버섯 | `complete_item_ash_cap` | vegetables / mushroom |
| `Item.RoastedMeat` | 구운 고기 | `complete_item_roasted_meat` | meat / roast |
| `Item.Torch` | 횃불 | `original_hearth_torch` | tool / torch |
| `Item.MedicalGuide` | 고원 약초 안내서 | `complete_item_medical_guide` | book / medical |
| `Item.FieldManual` | 야전 처치 수첩 | `complete_item_field_manual` | book / firstaid |
| `Item.WardRecords` | 순례회 병동 기록 | `complete_item_ward_records` | book / ward |
| `Item.SurvivalGuide` | 고원 생존 수첩 | `complete_item_survival_guide` | book / survival |
| `Item.WillowTea` | 흰버들 껍질 차 | `complete_item_willow_tea` | bottle / willow |
| `Item.PoppyTincture` | 잠꽃 팅크 | `complete_item_poppy_tincture` | bottle / poppy |
| `Item.AshLeaf` | 쓴재잎 | `complete_item_ash_leaf` | misc / ash_leaf |
| `Item.PurificationAmpoule` | 정화 앰플 | `original_purification_ampoule` | bottle / ampoule |
| `Item.BitterMoss` | 쓴이끼 습포 | `complete_item_bitter_moss` | misc / moss |
| `Item.AlphabetPrimer` | 글자 익히기 | `complete_item_alphabet_primer` | book / alphabet |
| `Item.PioneerDictionary` | 개척 사전 | `complete_item_pioneer_dictionary` | book / dictionary |
| `Item.PioneerPharmacopoeia` | 개척 약전 | `complete_item_pioneer_pharmacopoeia` | book / pharma |
| `Item.PillPrimer` | 길드 의약 수첩 | `complete_item_pill_primer` | book / pill |
| `Item.HighlandBestiary` | 고원 생물지 | `complete_item_highland_bestiary` | book / bestiary |
| `Item.RustyKnife` | 녹슨 칼 | `original_rusty_knife` | knife / rusty |
| `Item.HuntingKnife` | 사냥칼 | `complete_item_hunting_knife` | dagger / hunting |
| `Item.Machete` | 철판 마체테 | `original_sheet_machete` | knife / machete |
| `Item.Hatchet` | 손도끼 | `original_hatchet` | axe / hatchet |
| `Item.PipeClub` | 파이프 곤봉 | `complete_item_pipe_club` | tool / club |
| `Item.RebarSpear` | 철근 창 | `original_rebar_spear` | tool / spear |
| `Item.Bow` | 사냥 활 | `original_hunting_bow` | tool / bow |
| `Item.ScrapBuckler` | 고철 방패 | `complete_item_scrap_buckler` | misc / buckler |
| `Item.Javelin` | 투창 | `javelin` | tool / javelin |
| `Item.Lockpick` | 정밀 잠금 도구 | `lockpick` | tool / lockpick |
| `Item.MachinePatch` | 누출 밀봉 패치 | `complete_item_machine_patch` | misc / machine_patch |
| `Item.SmallActuator` | 소형 구동기 | `complete_item_small_actuator` | misc / actuator |
| `Item.HydraulicFluid` | 밀봉된 유압·냉각액 | `complete_item_hydraulic_fluid` | bottle / fluid |
| `Item.LowPowerCell` | 저출력 전원셀 | `complete_item_low_power_cell` | misc / low_cell |
| `Item.WeldNozzle` | 용접 노즐 | `complete_item_weld_nozzle` | misc / nozzle |
| `Item.Ink` | 지도용 잉크 | `complete_item_ink` | misc / ink |
| `Item.RawFragment` | 원재료 조각 | `complete_item_raw_fragment` | misc / fragment |
| `Item.CustomKnife` | 재질을 고른 사냥칼 | `complete_item_custom_knife` | dagger / custom |
| `Item.CustomHatchet` | 재질을 고른 손도끼 | `complete_item_custom_hatchet` | axe / custom |
| `Item.CustomShirt` | 짜 맞춘 셔츠 | `complete_item_custom_shirt` | shirt / custom_shirt |
| `Item.CustomMail` | 재질을 고른 사슬옷 | `complete_item_custom_mail` | shirt / custom_mail |
| `Item.CustomCoat` | 재질을 고른 가죽 코트 | `complete_item_custom_coat` | shirt / custom_coat |
| `Item.MaterialManual` | 재료를 잇고 되찾는 법 | `complete_item_material_manual` | book / material |
| `Item.IronIngot` | 연철 주괴 | `complete_item_iron_ingot` | misc / iron_ingot |
| `Item.AlloyScrap` | 폐합금 조각 | `complete_item_alloy_scrap` | misc / alloy_scrap |
| `Item.AshWolfHide` | 재늑대 가죽 | `complete_item_ash_wolf_hide` | misc / wolf_hide |
| `Item.SteelHatchet` | 강철 손도끼 | `complete_item_steel_hatchet` | axe / steel |
| `Item.FlintHatchet` | 부싯돌 손도끼 | `complete_item_flint_hatchet` | axe / flint |
| `Item.AlloyHatchet` | 폐합금 손도끼 | `complete_item_alloy_hatchet` | axe / alloy |
| `Item.SteelKnife` | 강철 사냥칼 | `complete_item_steel_knife` | dagger / steel |
| `Item.BoneKnife` | 뼈칼 | `complete_item_bone_knife` | dagger / bone |
| `Item.AlloyClub` | 폐합금 곤봉 | `complete_item_alloy_club` | tool / alloy_club |
| `Item.IronMail` | 연철 사슬옷 | `complete_item_iron_mail` | shirt / iron_mail |
| `Item.SteelMail` | 강철 사슬옷 | `complete_item_steel_mail` | shirt / steel_mail |
| `Item.WoolShirt` | 양모 셔츠 | `complete_item_wool_shirt` | shirt / wool_shirt |
| `Item.WolfCoat` | 재늑대 가죽 코트 | `complete_item_wolf_coat` | shirt / wolf_coat |
| `Item.WoolGloves` | 양모 장갑 | `complete_item_wool_gloves` | gloves / wool |
| `Item.OilclothShirt` | 기름 먹인 천 셔츠 | `complete_item_oilcloth_shirt` | shirt / oil_shirt |
| `Item.MissingPlaceholder` | 없어진 정의의 보관물 | `complete_item_missing_placeholder` | misc / missing |
| `Item.Oats` | 귀리 | `original_hearth_oats` | vegetables / oats |
| `Item.OatSeed` | 귀리 씨앗 | `original_hearth_oat_seed` | vegetables / oat_seed |
| `Item.Bowl` | 빈 그릇 | `original_hearth_bowl` | domestic / bowl |
| `Item.OatmealBowl` | 귀리죽 그릇 | `original_hearth_oatmeal` | domestic / oatmeal |
| `Item.PineNeedles` | 솔잎 | `complete_item_pine_needles` | misc / pine |
| `Item.PineTeaBottle` | 솔잎차 물병 | `complete_item_pine_tea_bottle` | distinct_water / pine_tea |
| `Item.RawPotato` | 생감자 | `complete_item_raw_potato` | vegetables / raw_potato |
| `Item.BakedPotato` | 구운 감자 | `complete_item_baked_potato` | vegetables / baked_potato |
| `Item.Turnip` | 순무 | `complete_item_turnip` | vegetables / turnip |
| `Item.AshBerry` | 잿딸기 | `complete_item_ash_berry` | vegetables / berry |
| `Item.Cheese` | 치즈 | `complete_item_cheese` | vegetables / cheese |
| `Item.PotatoSeed` | 감자 종자 | `complete_item_potato_seed` | vegetables / potato_seed |
| `Item.TurnipSeed` | 순무 씨앗 | `complete_item_turnip_seed` | vegetables / turnip_seed |
| `Item.Rope` | 밧줄 | `complete_item_rope` | misc / rope |
| `Item.PegLeg` | 막대 의족 | `complete_item_peg_leg` | prosthetic / peg |
| `Item.ArticulatedLeg` | 관절 의족 | `complete_item_articulated_leg` | prosthetic / joint_leg |
| `Item.HookHand` | 갈고리 손 | `complete_item_hook_hand` | prosthetic / hook |
| `Item.GlassEye` | 유리 눈 | `original_glass_eye` | domestic / eye |
| `Item.PioneerArm` | 개척 의수 | `complete_item_pioneer_arm` | prosthetic / arm |
| `Item.GardenerLimb` | 정원사 이식지 | `complete_item_gardener_limb` | prosthetic / gardener |
| `Item.LeatherStrap` | 가죽끈 | `complete_item_leather_strap` | misc / strap |
| `Item.PowerCell` | 개척 전원셀 | `original_power_cell` | misc / cell |
| `Item.GlassShard` | 유리 조각 | `complete_item_glass_shard` | misc / glass |
| `Item.Quiver` | 가죽 화살통 | `ashveil_quiver` | domestic / quiver |
| `Item.RawRatMeat` | 굴쥐 생고기 | `complete_item_raw_rat_meat` | meat / rat_raw |
| `Item.CookedRatMeat` | 구운 굴쥐 고기 | `complete_item_cooked_rat_meat` | meat / rat_cooked |
| `Item.RationPack` | 개척 배급 팩 | `complete_item_ration_pack` | ration / sealed |
| `Item.OpenedRationPack` | 개봉한 개척 배급 팩 | `complete_item_opened_ration_pack` | ration / opened |
| `Item.EmptyRationWrapper` | 빈 배급 포장 | `complete_item_empty_ration_wrapper` | ration / empty |
| `Item.SaltedMeat` | 염장육 | `complete_item_salted_meat` | meat / salted |
| `Item.SaltworkManual` | 해안 염부의 수첩 | `complete_item_saltwork_manual` | book / salt |
| `Item.OpenedCannedMeat` | 딴 개척기 통조림 | `complete_item_opened_canned_meat` | tin / opened |
| `Item.EmptyTin` | 빈 통조림통 | `complete_item_empty_tin` | tin / empty |
| `Item.Sack` | 마대 자루 | `ashveil_sack` | domestic / sack |
| `Item.UnheatedOatmealBowl` | 덜 익은 귀리죽 그릇 | `original_hearth_raw_oatmeal` | domestic / raw_oatmeal |
| `Item.ClothFilter` | 천 여과포 | `complete_item_cloth_filter` | misc / filter |
| `Item.CharcoalFilter` | 숯·모래 여과통 | `complete_item_charcoal_filter` | distinct_water / charcoal_filter |
| `Item.WaterPill` | 개척기 정수정 | `complete_item_water_pill` | distinct_water / water_pill |
| `Item.Sand` | 고운 모래 | `complete_item_sand` | misc / sand |
| `Item.WaterBucket` | 나무 물 양동이 | `water_bucket` | domestic / bucket |
| `Item.CoracleKit` | 접은 통가죽배 | `complete_item_coracle_kit` | misc / coracle |
| `Item.CoastalBoatManual` | 통가죽배 조선 수첩 | `complete_item_coastal_boat_manual` | book / boat |
| `Item.Whitecap` | 흰갓버섯 | `original_whitecap` | vegetables / whitecap |
| `Item.WhitecapCulture` | 흰갓 배양목 | `complete_item_whitecap_culture` | misc / culture |
| `Item.CorporateCodePlate` | 공사 인가 코드 판 | `complete_item_corporate_code_plate` | misc / plate |
| `Item.ChimneyHalfManual` | 칠번 굴뚝 정비 매뉴얼 반쪽 | `complete_item_chimney_half_manual` | book / chimney |
| `Item.CalvisJournal` | 오렌 칼비스의 침후14년 일지 | `complete_item_calvis_journal` | book / journal |
| `Ab.Blade.DeepCut` | 깊게 베기 | `complete_ability_blade_deep_cut` | ability / blade_deep_cut |
| `Ab.Blade.Edge` | 칼끝 감각 | `complete_ability_blade_edge` | ability / blade_edge |
| `Ab.Blade.Parry` | 받아넘기기 자세 | `complete_ability_blade_parry` | ability / blade_parry |
| `Ab.Blade.Vital` | 급소 찌르기 | `complete_ability_blade_vital` | ability / blade_vital |
| `Ab.Axe.Split` | 쪼개기 | `complete_ability_axe_split` | ability / axe_split |
| `Ab.Axe.Ferocity` | 흉포 | `complete_ability_axe_ferocity` | ability / axe_ferocity |
| `Ab.Axe.Sweep` | 휘둘러 베기 | `complete_ability_axe_sweep` | ability / axe_sweep |
| `Ab.Axe.Hamstring` | 다리 찍기 | `complete_ability_axe_hamstring` | ability / axe_hamstring |
| `Ab.Blunt.HeadBash` | 머리 강타 | `complete_ability_blunt_head_bash` | ability / blunt_head_bash |
| `Ab.Blunt.BoneBreaker` | 뼈 부수기 | `complete_ability_blunt_bone_breaker` | ability / blunt_bone_breaker |
| `Ab.Blunt.Shove` | 밀쳐내기 | `complete_ability_blunt_shove` | ability / blunt_shove |
| `Ab.Blunt.Crumple` | 갑옷 우그러뜨리기 | `complete_ability_blunt_crumple` | ability / blunt_crumple |
| `Ab.Spear.Pierce` | 꿰뚫기 | `complete_ability_spear_pierce` | ability / spear_pierce |
| `Ab.Spear.Reach` | 거리 유지 | `complete_ability_spear_reach` | ability / spear_reach |
| `Ab.Spear.Trip` | 다리 걸기 | `complete_ability_spear_trip` | ability / spear_trip |
| `Ab.Spear.Wall` | 창벽 자세 | `complete_ability_spear_wall` | ability / spear_wall |
| `Ab.Archery.Aimed` | 조준 사격 | `complete_ability_archery_aimed` | ability / archery_aimed |
| `Ab.Archery.Calm` | 침착함 | `complete_ability_archery_calm` | ability / archery_calm |
| `Ab.Archery.LegShot` | 다리 쏘기 | `complete_ability_archery_leg_shot` | ability / archery_leg_shot |
| `Ab.Archery.Recover` | 화살 회수 | `complete_ability_archery_recover` | ability / archery_recover |
| `Ab.Survival.FirstAid` | 응급 처치 | `complete_ability_survival_first_aid` | ability / survival_first_aid |
| `Ab.Survival.Breath` | 숨 고르기 | `complete_ability_survival_breath` | ability / survival_breath |
| `Ab.Survival.Sneak` | 잠행 | `complete_ability_survival_sneak` | ability / survival_sneak |
| `Ab.Survival.Tough` | 강인함 | `complete_ability_survival_tough` | ability / survival_tough |
| `Ab.Shade.Lunge` | 달려들기 | `complete_ability_shade_lunge` | ability / shade_lunge |
| `Ab.Amalgam.Sweep` | 휩쓸기 | `complete_ability_amalgam_sweep` | ability / amalgam_sweep |
| `Ab.Amalgam.SporeBurst` | 포자 분출 | `complete_ability_amalgam_spore_burst` | ability / amalgam_spore_burst |
| `Ab.Grab` | 붙잡기 | `complete_ability_grab` | ability / grab |
| `Hud.shove` | 밀치기 | `shove` | ability / shove |
| `Hud.trip` | 다리 걸기 | `trip` | ability / trip |
| `Hud.disarm` | 무장 해제 | `disarm` | ability / disarm |
| `Hud.crouch` | 웅크리기 | `crouch` | ability / crouch |

## 이전 이름 34개 매핑

같은 물품의 구 호출 이름은 같은 새 원화의 좌표로 연결했다. 모두 baseline에 있던 key이며 추가·삭제하거나 크기를 바꾸지 않았다.

| 이전 frame key | 연결한 새 의미별 frame key | 크기 |
| --- | --- | --- |
| `hood` | `complete_item_hood` | 32×32 |
| `bow` | `original_hunting_bow` | 32×32 |
| `rebar_spear` | `original_rebar_spear` | 32×32 |
| `leather_coat` | `complete_item_leather_coat` | 32×32 |
| `oilcloth_cloak` | `complete_item_oilcloth_cloak` | 32×32 |
| `note` | `complete_item_note` | 32×32 |
| `bones` | `complete_item_bones` | 32×32 |
| `hardtack` | `complete_item_hardtack` | 32×32 |
| `cloth` | `original_hearth_cloth` | 32×32 |
| `bandage` | `original_hearth_bandage` | 32×32 |
| `moonshine` | `complete_item_moonshine` | 32×32 |
| `rag_shirt` | `complete_item_rag_shirt` | 32×32 |
| `arrow` | `ashveil_arrow_bundle` | 32×32 |
| `pipe_club` | `complete_item_pipe_club` | 32×32 |
| `ash_cap` | `complete_item_ash_cap` | 32×32 |
| `raw_meat` | `complete_item_raw_meat` | 32×32 |
| `jerky` | `complete_item_jerky` | 32×32 |
| `padded_jacket` | `complete_item_padded_jacket` | 32×32 |
| `scrap_mail` | `complete_item_scrap_mail` | 32×32 |
| `scrap_helmet` | `complete_item_scrap_helmet` | 32×32 |
| `boots` | `complete_item_boots` | 32×32 |
| `gloves` | `complete_item_gloves` | 32×32 |
| `knife` | `complete_item_hunting_knife` | 32×32 |
| `tourniquet` | `complete_item_tourniquet` | 32×32 |
| `splint` | `complete_item_splint` | 32×32 |
| `painkiller` | `complete_item_painkiller` | 32×32 |
| `dried_apple` | `complete_item_dried_apple` | 32×32 |
| `canned_meat` | `complete_item_canned_meat` | 32×32 |
| `lantern` | `complete_item_lantern` | 32×32 |
| `buckler` | `complete_item_scrap_buckler` | 32×32 |
| `hatchet` | `original_hatchet` | 32×32 |
| `rusty_knife` | `original_rusty_knife` | 32×32 |
| `food_strawberry` | `complete_item_ash_berry` | 32×32 |
| `food_cheese` | `complete_item_cheese` | 32×32 |
