# v302 아이템·능력 전수 원본 제작

`complete-catalog-v302-before.json`의 실제 해결된 정의와 소비자를 기준으로 Item **206개**, Ability **28개**를 대조했다. 외부 이미지로 해결되던 Item **144개**와 최종 공유 조사에서 분리한 Item **5개**, 모든 Ability **28개**, HUD의 직접 소비 `shove` **1개**를 직접 그렸다. 최종 신규 원화는 Item **149개**·Ability **28개**·HUD **1개**, 합계 **178개**다. 기존 원본 바인딩을 유지하는 Item은 **57개**다. 기존에 능력이 가리키던 무기·알약 원본 파일도 그대로 유지한다. Item 206개·Ability 28개를 모두 자체 원본으로 연결하며 Item 간 공유 아이콘 키와 실제 프레임 공유 그룹은 모두 **0개**, 능력 고유 키는 **28개**다. 실제 콘텐츠와 manifest 통합은 상위 작업 담당 범위다.

## 산출물

- [생성기](../tools/art/draw-complete-items.py): 정수 좌표의 명시적 폴리곤·픽셀 군집. 외부 PNG 입력·크롭·추적·재색칠이나 무작위/해시 형태 생성 없음.
- [통합 fragment](../tools/art/complete-items.fragment.json): 신규 아틀라스 sheet **1개**, 신규 frame **178개**, 구 호출 호환 frame alias **34개**.
- [콘텐츠 patch](../tools/art/complete-items.patches.json): Item `/sprite` 149개·Ability `/icon` 28개. 상속 병합 전 실제 원문에 필드가 있는 146개는 `replace`, 없는 31개는 `add`다. 기존 바인딩을 유지하는 Item 57개와 HUD 행동은 patch에서 제외.
- [전체 카탈로그](../public/sprites/original/complete/items/catalog.json): 전체 234개 정의와 HUD 1개의 이름·설명·이전 실제 바인딩·유지/제작 여부·새 key·원본 PNG·SVG·아틀라스 좌표·의미별 도형 계열.
- [아틀라스 PNG](../public/sprites/original/complete/items/complete-items-atlas.png) / [명시적 픽셀 SVG](../public/sprites/original/complete/items/complete-items-atlas.svg): **512×384**, 16열×12행, 32×32 셀. PNG **49,700바이트**. 실제 로더가 읽는 신규 sheet는 이 한 장이다.
- 아틀라스의 각 178개 사각 영역은 편집 증거로 남긴 각 32×32 PNG와 RGBA 단위로 정확히 같다. 개별 SVG도 동일 픽셀 군집을 한 행씩 기록한다.
- [개별 PNG 계약](../public/sprites/original/complete/items/integrity.json), [아틀라스 계약](../public/sprites/original/complete/items/atlas-integrity.json), [독립 검사 결과](../public/sprites/original/complete/items/independent-contract.json), [contact 목록](../public/sprites/original/complete/items/contacts.json).

## 시각 설계와 직접 검토

CANON D13의 낡은 재질 기조를 따라 재빛 청록·상아 천·철·낡은 황동·가죽·목재를 사용했다. 각 이미지는 32×32 RGBA, 알파 0/255의 선명한 픽셀로 작성했다. 투명 외곽과 1픽셀 어두운 윤곽, 제한된 재질 밝기 군집으로 기본 32px 표시에서도 큰 형태를 먼저 읽게 했다. 팔레트는 시각 재질 선택이며 새로운 게임 효과나 미확인 물품의 정체를 정의하지 않는다.

- 침낭은 둥글게 말린 머리와 끈, 풀·가지 깔개는 교차 격자, 짚/나무/좋은 침대는 충전물·틀·높은 머리판을 다르게 그렸다.
- 셔츠는 소매와 목깃, 코트는 긴 자락과 띠, 앞치마는 목끈과 앞주머니, 사슬옷은 반복 고리로 구별한다. 천 조각을 의족·셔츠·침낭의 공통 그림으로 쓰지 않는다.
- 막대 의족은 상단 소켓과 끝 막대, 관절 의족은 무릎 축과 발, 갈고리 손은 굽은 금속 후크, 개척 의수는 관절과 손가락, 정원사 이식지는 명시된 흰 가지 형태를 따른다.
- 생고기/훈제/구이/육포/직접 말린 육포/염장육, 밀봉/개봉/빈 통조림, 밀봉/개봉/빈 배급 포장은 조리 흔적·뚜껑·내용물·접힘 상태를 각각 그렸다.
- 책은 잎을 반복하는 대신 종자 새싹·약초 절구·야전 십자·병동 침상·야영 도구·글자·사전 괄호·정제 대조·동물 머리·재료 접합·수신 회로·염법·배 도식 등 정의에 대응하는 표지 모양을 사용한다.
- 능력은 받아넘기는 교차 날, 급소 표적, 쪼개진 갑옷, 휘두르는 궤적, 다리 표적, 부러진 뼈, 밀어내는 방향, 찌그러진 갑옷, 붕대, 폐, 낮춘 몸, 방패, 돌진, 다중 팔, 붙잡은 팔로 구별한다. 모든 28종을 각 동작 도식으로 분리했다. 추가 10종은 깊은 절상·두 표적을 관통하는 창·거리 눈금·창대에 걸린 다리·세 창의 방어벽·조준점과 활·숨을 고르는 궁수·다리로 향한 화살·화살을 거두는 손·사방으로 퍼지는 포자 구름으로 그렸다. 포자 분출에 알약 원화를 사용하지 않는다.
- 여섯 미확인 정제와 실제 기본 물병·흰 알약·화살 원본은 유지했다. 최종 조사에서 같은 원본을 공유하던 석궁 볼트·정수정·흐린 물병·솔잎차 물병·숯·모래 여과통만 의미에 맞는 고유 원화로 분리했다. 미확인 정제의 효능·색 대응을 새로 단정하지 않았다.
- 석궁 볼트는 짧고 굵은 축과 짧은 꼬리 날개, 흐린 물은 침전과 부유 입자, 솔잎차는 솔잎 표지로 그렸다. 여과통은 목이 없는 깔때기형 통·검은 숯층·밝은 모래층·하단 출구를 단면식 도식으로 보여 물병과 구별한다. 정수정은 물방울 표지 포장과 별도의 흰 정제로 구별한다. 질병 검출이나 물의 정확한 재·염분 수치를 그림으로 단정하지 않는다.

최종 산출물의 다음 **9장 모두를 `view_image`로 직접 열었다**. 확대 3배와 원래 32px 미리보기가 있는 아이템 4장·능력 전체 1장·추가 능력 10개 전용 1장·HUD 1장·최종 공유 분리 5개 전용 1장을 검토했고, 최종 아틀라스 contact 1장도 열어 포장 후 배치와 실루엣을 확인했다. 초기 검토에서 유사하던 책 표지를 각 문헌의 도식으로 바꾸고 장갑 손가락 윤곽을 다듬었다.

- [아이템 1/4](../public/sprites/original/complete/items/contact-items-01.png)
- [아이템 2/4](../public/sprites/original/complete/items/contact-items-02.png)
- [아이템 3/4](../public/sprites/original/complete/items/contact-items-03.png)
- [아이템 4/4](../public/sprites/original/complete/items/contact-items-04.png)
- [능력 28개](../public/sprites/original/complete/items/contact-abilities-01.png)
- [추가 능력 10개](../public/sprites/original/complete/items/contact-ability-splits-01.png)
- [HUD 밀치기](../public/sprites/original/complete/items/contact-maneuvers-01.png)
- [최종 공유 분리 5개](../public/sprites/original/complete/items/contact-distinct-items-01.png)
- [최종 아틀라스](../public/sprites/original/complete/items/contact-atlas.png)

## 재생성과 검사

```sh
python3 tools/art/draw-complete-items.py
python3 tools/art/draw-complete-items.py --check
```

두 명령을 실행해 생성 결과 재현을 확인했다. 생성기 검사는 모든 개별 PNG의 서명·chunk CRC·IHDR 32×32/8bit/RGBA·무손실 알파·범위·픽셀 해시 고유성과 SVG 픽셀 소스를 검사한다. 아틀라스 PNG는 512×384 계약과 전체 178개 프레임의 개별 원본 RGBA 일치, fragment·patch·카탈로그의 재현을 검사한다. 개별 원본 해시는 **178개 모두 고유**하다.

패치는 로더가 상속 병합 전에 적용한다. 최초 통합 검사에서 일괄 `replace` 162개 중 상속 필드 26개가 실패했다. [최초 실패 로그](../test-results/sprites-v302-first.log)를 그대로 보존했다. 실제 `src/content/core/defs/**/*.json`을 다시 조사하면 원문 필드가 없는 대상은 30개다. `CustomHatchet`, `SteelHatchet`, `FlintHatchet`, `AlloyHatchet` 네 개는 앞선 `basic-weapons-original.json`의 `add`가 필드를 만들어 최초 26개 실패에 포함되지 않았다. 원문 필드 기준으로 **30 `add` + 132 `replace`**를 생성하도록 고쳤다. object `add`는 앞선 patch가 이미 만든 필드도 설정할 수 있다.

최초 연산 수정은 `--patches-only`, `--patches-only --check`, 전체 `--check`로 확인했다. 이후 공유 분리 5개를 추가하면서 원문에 `/sprite`가 없는 `Item.Bolt`에 `add` 한 개, 나머지 네 개에 `replace`를 더했다. 마지막 능력 10개의 고유 원화를 연결하는 `replace`도 추가해 현재 **31 `add` + 146 `replace` = 177개**다. 최종 `python3 tools/art/draw-complete-items.py`, `--check`, `--patches-only --check`를 실행했고 모두 통과했다. 독립 [패치 계약](../public/sprites/original/complete/items/patch-contract.json)은 177개 대상 모두의 실제 원문 필드 존재 여부와 연산을 대조했다. 최종 patch SHA-256: `f5b798f9969925474f03047956ff97b1ace76eb28a4a634fc801dff84001a819`.

생성기를 import하지 않는 별도 로컬 검사에서도 PNG chunk CRC·IHDR·알파·명시적 SVG rect를 새 캔버스에 복원한 픽셀 일치 **179개(개별178+아틀라스1)**, patch 대상 집합 **177개**, 신규 sheet **1개**, 실제 프레임 RGBA 일치 **178개**, 기존 frame 덮어쓰기 **0개**, Item **206개**·Ability **28개** 커버, Item의 실제 frame 공유 그룹 **0개**와 능력 고유 key **28개**를 확인했다. [독립 결과 JSON](../public/sprites/original/complete/items/independent-contract.json)에 입력 SHA-256을 기록했다.

담당 범위에서는 프로젝트 test/lint/type/GPU/브라우저/Full/World 검사를 실행하지 않았다. 기존 유지 원본은 조사 스냅샷의 실제 원본 경로·존재 판정을 보존했고, 이 문서의 시각 검토 주장은 신규 원화와 그 contact에 해당한다.

## 이전 아이콘 이름 호환

기존 manifest에 이미 등록된 frame은 덮어쓰지 않는다. 신규 alias 34개는 이전 직접 icon 호출과 단순 mod를 위한 호환 이름이며, 실제 Item/Ability Def는 각자의 새 고유 frame key를 쓴다. `cloth`·`bandage`·`bow`·`arrow`·`hatchet`·`rebar_spear`·`rusty_knife`는 의미가 맞는 기존 자체 원본을 연결한다. `pot0`, `pot1`, `crate_closed`, `stump`, `rubble0`, `chest`는 prop 담당 통합과 충돌하지 않도록 이 fragment에서 제외했다. 모든 alias의 최종 sheet/사각 좌표는 카탈로그에 명시했다.

| 호환 이름 | 원본 frame |
| --- | --- |
| `hood` | `complete_item_hood` |
| `bow` | `original_hunting_bow` |
| `rebar_spear` | `original_rebar_spear` |
| `leather_coat` | `complete_item_leather_coat` |
| `oilcloth_cloak` | `complete_item_oilcloth_cloak` |
| `note` | `complete_item_note` |
| `bones` | `complete_item_bones` |
| `hardtack` | `complete_item_hardtack` |
| `cloth` | `original_hearth_cloth` |
| `bandage` | `original_hearth_bandage` |
| `moonshine` | `complete_item_moonshine` |
| `rag_shirt` | `complete_item_rag_shirt` |
| `arrow` | `ashveil_arrow_bundle` |
| `pipe_club` | `complete_item_pipe_club` |
| `ash_cap` | `complete_item_ash_cap` |
| `raw_meat` | `complete_item_raw_meat` |
| `jerky` | `complete_item_jerky` |
| `padded_jacket` | `complete_item_padded_jacket` |
| `scrap_mail` | `complete_item_scrap_mail` |
| `scrap_helmet` | `complete_item_scrap_helmet` |
| `boots` | `complete_item_boots` |
| `gloves` | `complete_item_gloves` |
| `knife` | `complete_item_hunting_knife` |
| `tourniquet` | `complete_item_tourniquet` |
| `splint` | `complete_item_splint` |
| `painkiller` | `complete_item_painkiller` |
| `dried_apple` | `complete_item_dried_apple` |
| `canned_meat` | `complete_item_canned_meat` |
| `lantern` | `complete_item_lantern` |
| `buckler` | `complete_item_scrap_buckler` |
| `hatchet` | `original_hatchet` |
| `rusty_knife` | `original_rusty_knife` |
| `food_strawberry` | `complete_item_ash_berry` |
| `food_cheese` | `complete_item_cheese` |

## 전체 정의별 결과

| 정의 | 표시 이름 | 결과 | 실제 frame key |
| --- | --- | --- | --- |
| `Item.Hood` | 두건 | 신규 원화 | `complete_item_hood` |
| `Item.AshMask` | 방진 면포 | 신규 원화 | `complete_item_ash_mask` |
| `Item.LightCrossbow` | 경석궁 | 신규 원화 | `complete_item_light_crossbow` |
| `Item.Arrow` | 화살 | 기존 원본 유지 | `ashveil_arrow_bundle` |
| `Item.Bolt` | 석궁 볼트 | 신규 원화 | `complete_item_bolt` |
| `Item.Pole` | 뱃사공 장대 | 신규 원화 | `complete_item_pole` |
| `Item.LeatherCoat` | 가죽 코트 | 신규 원화 | `complete_item_leather_coat` |
| `Item.LeatherApron` | 가죽 앞치마 | 신규 원화 | `complete_item_leather_apron` |
| `Item.OilclothCloak` | 방수포 망토 | 신규 원화 | `complete_item_oilcloth_cloak` |
| `Item.OiledRaincoat` | 기름 먹인 천 우비 | 신규 원화 | `complete_item_oiled_raincoat` |
| `Item.Note` | 쪽지 | 신규 원화 | `complete_item_note` |
| `Item.OldMap` | 낡은 경비대 지도 | 신규 원화 | `complete_item_old_map` |
| `Item.OldLedger` | 길드 장부 조각 | 신규 원화 | `complete_item_old_ledger` |
| `Item.Lute` | 낡은 류트 | 신규 원화 | `complete_item_lute` |
| `Item.StorageChest` | 목제 보관함 | 기존 원본 유지 | `original_storage_chest_item` |
| `Item.Hardtack` | 건빵 | 신규 원화 | `complete_item_hardtack` |
| `Item.ShadeRoot` | 그늘뿌리 | 기존 원본 유지 | `original_shade_root` |
| `Item.ShadeSeeds` | 봉인된 그늘 작물 종자 | 기존 원본 유지 | `original_shade_seeds` |
| `Item.SeedVaultKey` | 종자 금고 열쇠 | 신규 원화 | `complete_item_seed_vault_key` |
| `Item.SeedVaultLedger` | 종자 금고 정비 기록 | 신규 원화 | `complete_item_seed_vault_ledger` |
| `Item.CampfireKit` | 야영 모닥불 꾸러미 | 기존 원본 유지 | `original_hearth_campfire_kit` |
| `Item.FieldMat` | 풀·가지 깔개 | 신규 원화 | `complete_item_field_mat` |
| `Item.Bedroll` | 침낭 | 신규 원화 | `complete_item_bedroll` |
| `Item.StrawBed` | 짚 침대 | 신규 원화 | `complete_item_straw_bed` |
| `Item.Bed` | 나무 침대 | 신규 원화 | `complete_item_bed` |
| `Item.GoodBed` | 좋은 침대 | 신규 원화 | `complete_item_good_bed` |
| `Item.MedicalBag` | 의료 가방 | 신규 원화 | `complete_item_medical_bag` |
| `Item.TetanusSerum` | 봉인된 개척 혈청 | 신규 원화 | `complete_item_tetanus_serum` |
| `Item.Wood` | 목재 | 기존 원본 유지 | `original_hearth_wood` |
| `Item.Stone` | 돌 조각 | 기존 원본 유지 | `original_hearth_stone` |
| `Item.IronScrap` | 고철 조각 | 기존 원본 유지 | `original_hearth_iron_scrap` |
| `Item.SteelIngot` | 강철 덩이 | 신규 원화 | `complete_item_steel_ingot` |
| `Item.RawHide` | 생가죽 | 신규 원화 | `complete_item_raw_hide` |
| `Item.Leather` | 무두질 가죽 | 기존 원본 유지 | `original_hearth_leather` |
| `Item.Linen` | 리넨 천 | 신규 원화 | `complete_item_linen` |
| `Item.Wool` | 양모 | 신규 원화 | `complete_item_wool` |
| `Item.Thread` | 실 꾸러미 | 기존 원본 유지 | `original_hearth_thread` |
| `Item.Charcoal` | 숯 | 기존 원본 유지 | `original_hearth_charcoal` |
| `Item.Salt` | 소금 | 기존 원본 유지 | `original_salt` |
| `Item.Wax` | 밀랍 | 신규 원화 | `complete_item_wax` |
| `Item.Needle` | 바늘 | 신규 원화 | `complete_item_needle` |
| `Item.Tongs` | 쇠집게 | 신규 원화 | `complete_item_tongs` |
| `Item.StoneHammer` | 돌망치 | 신규 원화 | `complete_item_stone_hammer` |
| `Item.IronHammer` | 쇠망치 | 신규 원화 | `complete_item_iron_hammer` |
| `Item.WorkbenchKit` | 작업대 조립품 | 신규 원화 | `complete_item_workbench_kit` |
| `Item.ForgeKit` | 대장간 조립품 | 신규 원화 | `complete_item_forge_kit` |
| `Item.LoomKit` | 베틀 조립품 | 신규 원화 | `complete_item_loom_kit` |
| `Item.TanningVatKit` | 무두질 통 조립품 | 신규 원화 | `complete_item_tanning_vat_kit` |
| `Item.ArtisanKit` | 장인 작업대 조립품 | 신규 원화 | `complete_item_artisan_kit` |
| `Item.CraftManual` | 고원 공작 수첩 | 신규 원화 | `complete_item_craft_manual` |
| `Item.Egg` | 달걀 | 기존 원본 유지 | `original_hearth_egg` |
| `Item.CrackedEgg` | 깨진 달걀 | 기존 원본 유지 | `original_cracked_hearth_egg` |
| `Item.Cabbage` | 양배추 | 신규 원화 | `complete_item_cabbage` |
| `Item.CeramicJar` | 빈 도기 항아리 | 신규 원화 | `complete_item_ceramic_jar` |
| `Item.PickledCabbageJar` | 양배추 절임 항아리 | 신규 원화 | `complete_item_pickled_cabbage_jar` |
| `Item.CabbageSeed` | 양배추 씨앗 | 신규 원화 | `complete_item_cabbage_seed` |
| `Item.SignalMaintenanceManual` | 칠번 처리구역 수신 설비 지침 | 신규 원화 | `complete_item_signal_maintenance_manual` |
| `Item.FlintlockMusket` | 부싯돌 장총 | 기존 원본 유지 | `flintlock_musket` |
| `Item.LeadBall` | 납탄 | 기존 원본 유지 | `lead_ball` |
| `Item.BlackPowderCharge` | 흑색화약 1회분 | 기존 원본 유지 | `powder_charge` |
| `Item.GunOil` | 총기 기름 | 기존 원본 유지 | `gun_oil` |
| `Item.RawMeat` | 생고기 | 신규 원화 | `complete_item_raw_meat` |
| `Item.SmokedMeat` | 훈제 고기 | 신규 원화 | `complete_item_smoked_meat` |
| `Item.Jerky` | 육포 | 신규 원화 | `complete_item_jerky` |
| `Item.AirDriedMeat` | 직접 말린 육포 | 신규 원화 | `complete_item_air_dried_meat` |
| `Item.SharpeningStone` | 숫돌 | 신규 원화 | `complete_item_sharpening_stone` |
| `Item.BowString` | 여분 활시위 | 기존 원본 유지 | `original_bow_string` |
| `Item.Greatsword` | 대도 | 기존 원본 유지 | `greatsword` |
| `Item.Revolver` | 회전식 권총 | 기존 원본 유지 | `revolver` |
| `Item.BoltRifle` | 볼트식 소총 | 기존 원본 유지 | `bolt_rifle` |
| `Item.FactoryCartridge` | 공장 실탄 | 기존 원본 유지 | `factory_round` |
| `Item.ReclaimedCartridge` | 재생 실탄 | 기존 원본 유지 | `reclaimed_round` |
| `Item.SpentCase` | 빈 탄피 | 기존 원본 유지 | `empty_case` |
| `Item.PrimerCap` | 뇌관 | 기존 원본 유지 | `primer_cap` |
| `Item.RagShirt` | 누더기 옷 | 신규 원화 | `complete_item_rag_shirt` |
| `Item.PaddedJacket` | 누빔 재킷 | 신규 원화 | `complete_item_padded_jacket` |
| `Item.ScrapMail` | 고철 사슬옷 | 신규 원화 | `complete_item_scrap_mail` |
| `Item.ScrapHelmet` | 고철 투구 | 신규 원화 | `complete_item_scrap_helmet` |
| `Item.Boots` | 가죽 장화 | 신규 원화 | `complete_item_boots` |
| `Item.Gloves` | 작업 장갑 | 신규 원화 | `complete_item_gloves` |
| `Item.LeatherBelt` | 가죽 허리띠 | 기존 원본 유지 | `ashveil_leather_belt` |
| `Item.BoneCharm` | 뼈 부적 | 신규 원화 | `complete_item_bone_charm` |
| `Item.SealRing` | 녹슨 인장 반지 | 신규 원화 | `complete_item_seal_ring` |
| `Item.Cloth` | 천 조각 | 기존 원본 유지 | `original_hearth_cloth` |
| `Item.Bandage` | 붕대 | 기존 원본 유지 | `original_hearth_bandage` |
| `Item.Tourniquet` | 지혈대 | 신규 원화 | `complete_item_tourniquet` |
| `Item.Splint` | 부목 | 신규 원화 | `complete_item_splint` |
| `Item.Moonshine` | 밀주 | 신규 원화 | `complete_item_moonshine` |
| `Item.Painkiller` | 백색 정제 | 신규 원화 | `complete_item_painkiller` |
| `Item.PillYellow` | 노란 알약 | 기존 원본 유지 | `pill_yellow` |
| `Item.PillBlue` | 푸른 알약 | 기존 원본 유지 | `pill_blue` |
| `Item.PillWhite` | 흰 알약 | 기존 원본 유지 | `pill_white` |
| `Item.PillBlack` | 검은 알약 | 기존 원본 유지 | `pill_black` |
| `Item.PillGreen` | 초록 알약 | 기존 원본 유지 | `pill_green` |
| `Item.PillMagenta` | 자홍 알약 | 기존 원본 유지 | `pill_magenta` |
| `Item.WaterBottle` | 물병 (깨끗한 물) | 기존 원본 유지 | `water_bottle` |
| `Item.DirtyWaterBottle` | 물병 (흐린 물) | 신규 원화 | `complete_item_dirty_water_bottle` |
| `Item.DriedApple` | 말린 사과 | 신규 원화 | `complete_item_dried_apple` |
| `Item.CannedMeat` | 개척기 통조림 | 신규 원화 | `complete_item_canned_meat` |
| `Item.Lantern` | 기름 등불 | 신규 원화 | `complete_item_lantern` |
| `Item.HealthDraught` | 쓴 약초탕 | 기존 원본 유지 | `original_health_draught` |
| `Item.LampOil` | 등잔 기름 | 신규 원화 | `complete_item_lamp_oil` |
| `Item.Bones` | 뼈 무더기 | 신규 원화 | `complete_item_bones` |
| `Item.AshCap` | 잿빛 갓버섯 | 신규 원화 | `complete_item_ash_cap` |
| `Item.RoastedMeat` | 구운 고기 | 신규 원화 | `complete_item_roasted_meat` |
| `Item.Torch` | 횃불 | 기존 원본 유지 | `original_hearth_torch` |
| `Item.MedicalGuide` | 고원 약초 안내서 | 신규 원화 | `complete_item_medical_guide` |
| `Item.FieldManual` | 야전 처치 수첩 | 신규 원화 | `complete_item_field_manual` |
| `Item.WardRecords` | 순례회 병동 기록 | 신규 원화 | `complete_item_ward_records` |
| `Item.SurvivalGuide` | 고원 생존 수첩 | 신규 원화 | `complete_item_survival_guide` |
| `Item.WillowTea` | 흰버들 껍질 차 | 신규 원화 | `complete_item_willow_tea` |
| `Item.PoppyTincture` | 잠꽃 팅크 | 신규 원화 | `complete_item_poppy_tincture` |
| `Item.AshLeaf` | 쓴재잎 | 신규 원화 | `complete_item_ash_leaf` |
| `Item.PurificationAmpoule` | 정화 앰플 | 기존 원본 유지 | `original_purification_ampoule` |
| `Item.BitterMoss` | 쓴이끼 습포 | 신규 원화 | `complete_item_bitter_moss` |
| `Item.AlphabetPrimer` | 글자 익히기 | 신규 원화 | `complete_item_alphabet_primer` |
| `Item.PioneerDictionary` | 개척 사전 | 신규 원화 | `complete_item_pioneer_dictionary` |
| `Item.PioneerPharmacopoeia` | 개척 약전 | 신규 원화 | `complete_item_pioneer_pharmacopoeia` |
| `Item.PillPrimer` | 길드 의약 수첩 | 신규 원화 | `complete_item_pill_primer` |
| `Item.HighlandBestiary` | 고원 생물지 | 신규 원화 | `complete_item_highland_bestiary` |
| `Item.RustyKnife` | 녹슨 칼 | 기존 원본 유지 | `original_rusty_knife` |
| `Item.HuntingKnife` | 사냥칼 | 신규 원화 | `complete_item_hunting_knife` |
| `Item.Machete` | 철판 마체테 | 기존 원본 유지 | `original_sheet_machete` |
| `Item.Hatchet` | 손도끼 | 기존 원본 유지 | `original_hatchet` |
| `Item.PipeClub` | 파이프 곤봉 | 신규 원화 | `complete_item_pipe_club` |
| `Item.RebarSpear` | 철근 창 | 기존 원본 유지 | `original_rebar_spear` |
| `Item.Bow` | 사냥 활 | 기존 원본 유지 | `original_hunting_bow` |
| `Item.ScrapBuckler` | 고철 방패 | 신규 원화 | `complete_item_scrap_buckler` |
| `Item.Javelin` | 투창 | 기존 원본 유지 | `javelin` |
| `Item.Lockpick` | 정밀 잠금 도구 | 기존 원본 유지 | `lockpick` |
| `Item.MachinePatch` | 누출 밀봉 패치 | 신규 원화 | `complete_item_machine_patch` |
| `Item.SmallActuator` | 소형 구동기 | 신규 원화 | `complete_item_small_actuator` |
| `Item.HydraulicFluid` | 밀봉된 유압·냉각액 | 신규 원화 | `complete_item_hydraulic_fluid` |
| `Item.LowPowerCell` | 저출력 전원셀 | 신규 원화 | `complete_item_low_power_cell` |
| `Item.WeldNozzle` | 용접 노즐 | 신규 원화 | `complete_item_weld_nozzle` |
| `Item.Ink` | 지도용 잉크 | 신규 원화 | `complete_item_ink` |
| `Item.RawFragment` | 원재료 조각 | 신규 원화 | `complete_item_raw_fragment` |
| `Item.CustomKnife` | 재질을 고른 사냥칼 | 신규 원화 | `complete_item_custom_knife` |
| `Item.CustomHatchet` | 재질을 고른 손도끼 | 신규 원화 | `complete_item_custom_hatchet` |
| `Item.CustomShirt` | 짜 맞춘 셔츠 | 신규 원화 | `complete_item_custom_shirt` |
| `Item.CustomMail` | 재질을 고른 사슬옷 | 신규 원화 | `complete_item_custom_mail` |
| `Item.CustomCoat` | 재질을 고른 가죽 코트 | 신규 원화 | `complete_item_custom_coat` |
| `Item.MaterialManual` | 재료를 잇고 되찾는 법 | 신규 원화 | `complete_item_material_manual` |
| `Item.IronIngot` | 연철 주괴 | 신규 원화 | `complete_item_iron_ingot` |
| `Item.AlloyScrap` | 폐합금 조각 | 신규 원화 | `complete_item_alloy_scrap` |
| `Item.AshWolfHide` | 재늑대 가죽 | 신규 원화 | `complete_item_ash_wolf_hide` |
| `Item.SteelHatchet` | 강철 손도끼 | 신규 원화 | `complete_item_steel_hatchet` |
| `Item.FlintHatchet` | 부싯돌 손도끼 | 신규 원화 | `complete_item_flint_hatchet` |
| `Item.AlloyHatchet` | 폐합금 손도끼 | 신규 원화 | `complete_item_alloy_hatchet` |
| `Item.SteelKnife` | 강철 사냥칼 | 신규 원화 | `complete_item_steel_knife` |
| `Item.BoneKnife` | 뼈칼 | 신규 원화 | `complete_item_bone_knife` |
| `Item.AlloyClub` | 폐합금 곤봉 | 신규 원화 | `complete_item_alloy_club` |
| `Item.IronMail` | 연철 사슬옷 | 신규 원화 | `complete_item_iron_mail` |
| `Item.SteelMail` | 강철 사슬옷 | 신규 원화 | `complete_item_steel_mail` |
| `Item.WoolShirt` | 양모 셔츠 | 신규 원화 | `complete_item_wool_shirt` |
| `Item.WolfCoat` | 재늑대 가죽 코트 | 신규 원화 | `complete_item_wolf_coat` |
| `Item.WoolGloves` | 양모 장갑 | 신규 원화 | `complete_item_wool_gloves` |
| `Item.OilclothShirt` | 기름 먹인 천 셔츠 | 신규 원화 | `complete_item_oilcloth_shirt` |
| `Item.MissingPlaceholder` | 없어진 정의의 보관물 | 신규 원화 | `complete_item_missing_placeholder` |
| `Item.Oats` | 귀리 | 기존 원본 유지 | `original_hearth_oats` |
| `Item.OatSeed` | 귀리 씨앗 | 기존 원본 유지 | `original_hearth_oat_seed` |
| `Item.Bowl` | 빈 그릇 | 기존 원본 유지 | `original_hearth_bowl` |
| `Item.OatmealBowl` | 귀리죽 그릇 | 기존 원본 유지 | `original_hearth_oatmeal` |
| `Item.PineNeedles` | 솔잎 | 신규 원화 | `complete_item_pine_needles` |
| `Item.PineTeaBottle` | 솔잎차 물병 | 신규 원화 | `complete_item_pine_tea_bottle` |
| `Item.RawPotato` | 생감자 | 신규 원화 | `complete_item_raw_potato` |
| `Item.BakedPotato` | 구운 감자 | 신규 원화 | `complete_item_baked_potato` |
| `Item.Turnip` | 순무 | 신규 원화 | `complete_item_turnip` |
| `Item.AshBerry` | 잿딸기 | 신규 원화 | `complete_item_ash_berry` |
| `Item.Cheese` | 치즈 | 신규 원화 | `complete_item_cheese` |
| `Item.PotatoSeed` | 감자 종자 | 신규 원화 | `complete_item_potato_seed` |
| `Item.TurnipSeed` | 순무 씨앗 | 신규 원화 | `complete_item_turnip_seed` |
| `Item.Rope` | 밧줄 | 신규 원화 | `complete_item_rope` |
| `Item.PegLeg` | 막대 의족 | 신규 원화 | `complete_item_peg_leg` |
| `Item.ArticulatedLeg` | 관절 의족 | 신규 원화 | `complete_item_articulated_leg` |
| `Item.HookHand` | 갈고리 손 | 신규 원화 | `complete_item_hook_hand` |
| `Item.GlassEye` | 유리 눈 | 기존 원본 유지 | `original_glass_eye` |
| `Item.PioneerArm` | 개척 의수 | 신규 원화 | `complete_item_pioneer_arm` |
| `Item.GardenerLimb` | 정원사 이식지 | 신규 원화 | `complete_item_gardener_limb` |
| `Item.LeatherStrap` | 가죽끈 | 신규 원화 | `complete_item_leather_strap` |
| `Item.PowerCell` | 개척 전원셀 | 기존 원본 유지 | `original_power_cell` |
| `Item.GlassShard` | 유리 조각 | 신규 원화 | `complete_item_glass_shard` |
| `Item.Quiver` | 가죽 화살통 | 기존 원본 유지 | `ashveil_quiver` |
| `Item.RawRatMeat` | 굴쥐 생고기 | 신규 원화 | `complete_item_raw_rat_meat` |
| `Item.CookedRatMeat` | 구운 굴쥐 고기 | 신규 원화 | `complete_item_cooked_rat_meat` |
| `Item.RationPack` | 개척 배급 팩 | 신규 원화 | `complete_item_ration_pack` |
| `Item.OpenedRationPack` | 개봉한 개척 배급 팩 | 신규 원화 | `complete_item_opened_ration_pack` |
| `Item.EmptyRationWrapper` | 빈 배급 포장 | 신규 원화 | `complete_item_empty_ration_wrapper` |
| `Item.SaltedMeat` | 염장육 | 신규 원화 | `complete_item_salted_meat` |
| `Item.SaltworkManual` | 해안 염부의 수첩 | 신규 원화 | `complete_item_saltwork_manual` |
| `Item.OpenedCannedMeat` | 딴 개척기 통조림 | 신규 원화 | `complete_item_opened_canned_meat` |
| `Item.EmptyTin` | 빈 통조림통 | 신규 원화 | `complete_item_empty_tin` |
| `Item.Sack` | 마대 자루 | 기존 원본 유지 | `ashveil_sack` |
| `Item.UnheatedOatmealBowl` | 덜 익은 귀리죽 그릇 | 기존 원본 유지 | `original_hearth_raw_oatmeal` |
| `Item.ClothFilter` | 천 여과포 | 신규 원화 | `complete_item_cloth_filter` |
| `Item.CharcoalFilter` | 숯·모래 여과통 | 신규 원화 | `complete_item_charcoal_filter` |
| `Item.WaterPill` | 개척기 정수정 | 신규 원화 | `complete_item_water_pill` |
| `Item.Sand` | 고운 모래 | 신규 원화 | `complete_item_sand` |
| `Item.WaterBucket` | 나무 물 양동이 | 기존 원본 유지 | `water_bucket` |
| `Item.CoracleKit` | 접은 통가죽배 | 신규 원화 | `complete_item_coracle_kit` |
| `Item.CoastalBoatManual` | 통가죽배 조선 수첩 | 신규 원화 | `complete_item_coastal_boat_manual` |
| `Item.Whitecap` | 흰갓버섯 | 기존 원본 유지 | `original_whitecap` |
| `Item.WhitecapCulture` | 흰갓 배양목 | 신규 원화 | `complete_item_whitecap_culture` |
| `Item.CorporateCodePlate` | 공사 인가 코드 판 | 신규 원화 | `complete_item_corporate_code_plate` |
| `Item.ChimneyHalfManual` | 칠번 굴뚝 정비 매뉴얼 반쪽 | 신규 원화 | `complete_item_chimney_half_manual` |
| `Item.CalvisJournal` | 오렌 칼비스의 침후14년 일지 | 신규 원화 | `complete_item_calvis_journal` |
| `Ab.Blade.DeepCut` | 깊게 베기 | 신규 원화 | `complete_ability_blade_deep_cut` |
| `Ab.Blade.Edge` | 칼끝 감각 | 신규 원화 | `complete_ability_blade_edge` |
| `Ab.Blade.Parry` | 받아넘기기 자세 | 신규 원화 | `complete_ability_blade_parry` |
| `Ab.Blade.Vital` | 급소 찌르기 | 신규 원화 | `complete_ability_blade_vital` |
| `Ab.Axe.Split` | 쪼개기 | 신규 원화 | `complete_ability_axe_split` |
| `Ab.Axe.Ferocity` | 흉포 | 신규 원화 | `complete_ability_axe_ferocity` |
| `Ab.Axe.Sweep` | 휘둘러 베기 | 신규 원화 | `complete_ability_axe_sweep` |
| `Ab.Axe.Hamstring` | 다리 찍기 | 신규 원화 | `complete_ability_axe_hamstring` |
| `Ab.Blunt.HeadBash` | 머리 강타 | 신규 원화 | `complete_ability_blunt_head_bash` |
| `Ab.Blunt.BoneBreaker` | 뼈 부수기 | 신규 원화 | `complete_ability_blunt_bone_breaker` |
| `Ab.Blunt.Shove` | 밀쳐내기 | 신규 원화 | `complete_ability_blunt_shove` |
| `Ab.Blunt.Crumple` | 갑옷 우그러뜨리기 | 신규 원화 | `complete_ability_blunt_crumple` |
| `Ab.Spear.Pierce` | 꿰뚫기 | 신규 원화 | `complete_ability_spear_pierce` |
| `Ab.Spear.Reach` | 거리 유지 | 신규 원화 | `complete_ability_spear_reach` |
| `Ab.Spear.Trip` | 다리 걸기 | 신규 원화 | `complete_ability_spear_trip` |
| `Ab.Spear.Wall` | 창벽 자세 | 신규 원화 | `complete_ability_spear_wall` |
| `Ab.Archery.Aimed` | 조준 사격 | 신규 원화 | `complete_ability_archery_aimed` |
| `Ab.Archery.Calm` | 침착함 | 신규 원화 | `complete_ability_archery_calm` |
| `Ab.Archery.LegShot` | 다리 쏘기 | 신규 원화 | `complete_ability_archery_leg_shot` |
| `Ab.Archery.Recover` | 화살 회수 | 신규 원화 | `complete_ability_archery_recover` |
| `Ab.Survival.FirstAid` | 응급 처치 | 신규 원화 | `complete_ability_survival_first_aid` |
| `Ab.Survival.Breath` | 숨 고르기 | 신규 원화 | `complete_ability_survival_breath` |
| `Ab.Survival.Sneak` | 잠행 | 신규 원화 | `complete_ability_survival_sneak` |
| `Ab.Survival.Tough` | 강인함 | 신규 원화 | `complete_ability_survival_tough` |
| `Ab.Shade.Lunge` | 달려들기 | 신규 원화 | `complete_ability_shade_lunge` |
| `Ab.Amalgam.Sweep` | 휩쓸기 | 신규 원화 | `complete_ability_amalgam_sweep` |
| `Ab.Amalgam.SporeBurst` | 포자 분출 | 신규 원화 | `complete_ability_amalgam_spore_burst` |
| `Ab.Grab` | 붙잡기 | 신규 원화 | `complete_ability_grab` |
| `Hud.shove` | 밀치기 | 신규 원화 | `shove` |
