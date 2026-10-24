import {firearmRates} from '../core/firearms'
import {qualityFromScore} from '../core/crafting'
import {foodKcal,cookingRules} from '../core/cooking-state'
import {pillAgeLines} from '../core/pill-aging'
// 툴팁 문구: 아이템·능력·수정치를 한국어로 풀어 쓴다

import { waterVesselForDef,drinkVolume, turnOf, pillBelief, knowledgeDef, readingPageTurns, drugPreview, type DrugDef, waterLines, player, ambientTemp, foodFreshness, freshnessBand, FRESHNESS_LABEL, rotRate, masteryStage, stuffProfile, rawStock, structuralDurability, durabilityBand, hasQuality, itemDef, itemLabel, qualityInfo, temperatureDelta, thermalState, type ProstheticDef, type AbilityDef, type Creature, type ItemDef, type ItemInst, type World, thirstBand } from '../core'

export const SLOT_LABEL: Record<string, string> = {
  head: '머리', chest: '몸', lining:'안감', hands: '손', feet: '발', belt: '허리', back: '등', neck: '목',
  ring1: '반지', ring2: '반지', ring: '반지', main: '주무기', off: '보조',
}
const CAT_LABEL: Record<ItemDef['category'], string> = {
  weapon: '무기', apparel: '옷·방어구', shield: '방패', medical: '의료품', food: '음식', drink: '마실 것',
  drug: '약', tool: '도구', ammo: '탄약', misc: '잡동사니',
}
const DMG_LABEL: Record<string, string> = { cut: '베기', stab: '찌르기', blunt: '타격', bite: '물기', burn: '화상', gunshot: '총상' }
const SKILL_LABEL: Record<string, string> = { blade: '도검', axe: '도끼', blunt: '둔기', spear: '창', archery: '활', crossbow: '석궁', firearm:'화기', throwing:'투척', unarmed: '맨손' }
export const MOD_LABEL: Record<string, string> = {
  maxHp: '최대 체력', hitBonus: '명중', evasion: '회피', bleedMult: '받는 출혈 ×', painMult: '통증 ×', stressResist: '스트레스 저항',
  hitBonus_blade: '도검 명중', hitBonus_axe: '도끼 명중', hitBonus_blunt: '둔기 명중', hitBonus_spear: '창 명중', hitBonus_archery: '활 명중',
  dmgVsBleeding: '출혈 중인 적 피해', fractureDealt: '골절 유발 ×', deflectHalf: '튕겨냄 강화', reachHit: '거리 유지 명중',
  rangePenaltyHalf: '거리 감점 절반', arrowRecover: '화살 회수', bandageBonus: '붕대 효과', treatSpeed: '처치 속도',
  smithQ: '대장 제작·수리 Q', waterStumble: '물·진흙 비틀거림', waterFearImmune: '물 공포 면제', bargain: '흥정 항', mapReliability: '지도 작성 신뢰도', firstImpression: '첫인상', relicAppraisal: '유물 감정치', masteryThresholdMult: '숙달 문턱 ×',
  sutureBonus: '봉합 Q', mood: '상시 기분', killMood: '살인 기분', killMoodMult: '살인 기분 ×', deathMood: '죽음 목격 기분', beastMood: '짐승 처치 기분', surrenderMood: '항복 수용 기분',
  bloodDamage: '피 냄새 근접 피해 ×', bloodMood: '피 냄새 기분', bloodStressRecovery: '전투 스트레스 회복/시간', bloodFearImmune: '피 공포 면제',
  stat_per: '지각', identifyBonus: '감별 확률', wakeThreshold: '각성 임계', sleepQuality: '수면 질 ×', nightOwl: '야행성',
  foodPoisonMult: '식중독 확률 ×', rawMood: '날 음식 기분', tasteMoodMult: '맛 기분 ×', fineMealQ: '훌륭한 식사 Q 문턱',
  kcalMult: '칼로리 소비 ×', breathKcal: '숨 고르기 kcal', coldComfort: '추위 쾌적 보정', heatComfort: '더위 쾌적 보정', frostbiteMult: '동상 노출 ×', coldBreath: '추위 숨 고르기',
  stressMult: '스트레스 누적 ×', breakdownMult: '붕괴 확률 ×', traumaMult: '트라우마 확률 ×', nearDeathMoodMult: '위기 기억 기분 ×',
  alcoholNeed: '술 의존', alcoholMoodMult: '술 기분 ×', alcoholMood: '술 기분', aloneMood: '혼자 기분', sneakMutter: '10턴당 혼잣말 확률',
  neatGearMood: '손질 부족 기분', treatCleanliness: '처치 청결', manipulationTime: '손 작업 시간 ×', craftQ: '제작 Q', manipulationCap: '손 조작 상한', weaponDropMult: '무기 떨굼 ×',
  stumble: '비틀거림', stumbleIfPositive: '험한 이동 비틀거림', energyRegenMult: '기력 회복 ×', immunityMult: '면역 ×', bodySizeMult: '밀치기 체중 ×', farSightMult: '5칸 밖 시야 ×',
  morale: '사기', stanceTurns: '방어 자세 지속', attackAbilityEnergy: '공격 능력 기력', fledMood: '물러난 기분', faceScarMood: '얼굴 흉터 기분', fineClothesMood: '좋은 옷 기분', prayerRelief: '기도 스트레스 회복', fractureTaken: '피격 골절 확률 ×', executeCooldown: '급소/머리 강타 재사용',
  rangedHit: '원거리 명중', sightRange: '시야', lightThreshold: '어둠 적응', noiseMult: '소음 ×', healMult: '회복 ×',
}

export function rarityColor(d: ItemDef): string {
  const v = d.value ?? 0
  if (v >= 120) return '#e0b050'
  if (v >= 50) return '#8fb0d8'
  return '#e2ded2'
}

export function modLines(mods: Partial<Record<string, number>> | undefined): string[] {
  if (!mods) return []
  return Object.entries(mods).filter(([, v]) => v !== undefined).map(([k, v]) => {
    const lab = MOD_LABEL[k] ?? k
    if (lab.endsWith('×')) return `${lab}${v}`
    return `${lab} ${v! > 0 ? '+' : ''}${v}`
  })
}

const GROUP_LABEL: Record<string, string> = {
  skull: '두개골', ear: '귀', eye: '눈', nose: '코', jaw: '턱', neck: '목', chest: '흉부', abdomen: '복부', pelvis: '골반',
  upperArm: '상완', forearm: '전완', hand: '손', finger: '손가락', thigh: '대퇴', shin: '정강이', foot: '발', toe: '발가락',
}

export function itemTip(w: World, it: ItemInst | null, defId?: string): { title: string; lines: string[]; color: string } {
  const d = it ? itemDef(w, it) : w.db.item(defId!)
  const lines: string[] = []
  if(d.fletching)lines.push(it?.fletchingDamaged?`깃 손상 · 원거리 명중 −${d.fletching.hitPenalty}`:'깃 정상 · 직접 재비에 노출되면 손상된다.', '탄약 선택/빠른 슬롯은 같은 깃 상태만 사용한다. 소진해도 다른 상태를 섞어 쏘지 않는다.')
  if(d.quiver)lines.push('화살 전용1×6칸 · 등 슬롯/망토와 함께 착용 불가', '온전히 착용한 동안 실제 내부 화살을 꺼내 쏘거나 장전한다.')
  if(d.pocket)lines.push('허리 주머니2×2 · 착용 완료 후 소모품에 바로 접근', '전투 중에도 빠른 슬롯 연결은0턴이며 사용은 원래 행동 시간을 쓴다.')
  if(d.storage)lines.push(`내부 ${d.storage[0]}×${d.storage[1]}칸 · ${it?.contents?.length??0}더미 보관`, '더블클릭 또는 우클릭 → 열기. 물품은 꺼낸 뒤 사용한다. 가방을 겹쳐 넣을 수 없다.')
  if(it?.missingItem)return{title:d.label,lines:[`원래 정의: ${it.missingItem.def}`,`원래 칸 ${it.missingItem.size[0]}×${it.missingItem.size[1]} · ${it.count}개`, '원래 상태를 보관 중이다. 사용·장착·거래·분할할 수 없다.', '원래 정의가 돌아오면 같은 물품으로 복원한다.'],color:'#d9a040'}
  if (d.relic && (it?.appraisal ?? 0) < 2) {
    return { title: it ? itemLabel(w, it) : d.unknownLabel ?? '미확인 유물', lines: [d.unknownDescription ?? '개척기 또는 그보다 오래된 물건이다.', (it?.appraisal ?? 0) === 1 ? '의료·신체 대체용 유물로 추정된다. 정확한 기능은 아직 모른다.' : '용도 미확인', '우클릭 → 살펴보기로 감정한다. 문해·지각·발굴꾼 배경이 도움이 된다.'], color: rarityColor(d) }
  }
  if(it)for(const contract of w.s.overworld?.contracts??[])if(contract.kind==='recover'&&contract.status==='active'&&turnOf(w)<contract.deadline&&contract.itemUid===it.uid)lines.push('회수 의뢰의 원본 · '+contract.label)
  if(it)for(const contract of w.s.overworld?.contracts??[])if(contract.kind==='excavate'&&contract.status==='active'&&turnOf(w)<contract.deadline&&contract.proof?.uid===it.uid)lines.push('발굴 의뢰의 원본 · '+contract.label)
  if(it)for(const contract of w.s.overworld?.contracts??[])if(contract.kind==='rescue'&&contract.status==='active'&&turnOf(w)<contract.deadline&&contract.relic?.uid===it.uid)lines.push('구조 의뢰의 원래 유품 · '+contract.name)
  if (d.prosthetic) {
    const p = w.db.get<ProstheticDef>(d.prosthetic)
    lines.push(`의수족 · 기본 효율${Math.round(p.efficiency * 100)}% · 의료${p.medicine}단계`)
    if (p.powerTurns) lines.push(`전원셀${p.powerTurns / 28800}일 · 영하에서 효율×${p.coldMult ?? 1}`)
    if (p.maintenanceTurns) lines.push(`가죽끈 정비 주기${p.maintenanceTurns / 28800}일`)
    if (p.grip === false) lines.push(`한 손 무기를 쥘 수 없다 · 양손 무기 보조${p.twoHandSupport ?? 0}`)
    lines.push('신체 창에서 결손 부위를 골라 설치한다.')
  }
  lines.push(`${CAT_LABEL[d.category]}${d.slot ? ` · ${SLOT_LABEL[d.slot]}` : ''}${d.twoHanded ? ' · 양손' : ''}`)
  if (it && (hasQuality(d) || it.quality !== undefined)) {
    const q = qualityInfo(it)
    const vessel=!!(d.food?.emptyVessel||d.drink?.emptyVessel)||w.db.all<ItemDef>('Item').some(x=>x.food?.emptyVessel===d.id||x.drink?.emptyVessel===d.id)
    if(d.food&&!vessel){if(it.foodQ===undefined)lines.push('음식 품질 '+q.label)}
    else if(vessel)lines.push('용기 품질 '+q.label)
    else lines.push(`품질 ${q.label}${q.dmg !== 1 ? ` · 피해·방어 ×${q.dmg} · 내구 ×${q.dur} · 단열 ×${q.ins}` : ''}`)
  }
  if(it?.foodQ!==undefined&&d.food)lines.push('음식 품질 '+qualityInfo({...it,quality:qualityFromScore(it.foodQ)}).label+' · Q '+Number(it.foodQ.toFixed(1)))
  for (const a of d.attacks ?? []) {
    lines.push(`${a.label}: ${DMG_LABEL[a.damageType] ?? a.damageType} ${Number(a.damage.toFixed(2))} · 관통 ${a.pen} · 정확도 +${a.accuracy} · 기력 ${a.energy}`)
  }
  if (d.unidentified === 'pill') {
    if (it) lines.push(...pillAgeLines(w, player(w), it))
    const belief = pillBelief(w,d.id), rules = knowledgeDef(w)
    if (belief?.confidence === 'likely' && belief.belief) lines.push(`추정 효능: ${w.db.pill(belief.belief).description}`)
    if (belief?.ruledOut.length) lines.push(`관찰로 배제: ${belief.ruledOut.map((id) => w.db.pill(id).label).join(', ')}`)
    lines.push(`감별${rules.examineTurns}턴 · ¼ 맛보기${rules.tasteTurns}턴 (효과×${rules.tasteFraction}, 감별치+${rules.tasteBonus})`)
    if (it?.pillRemaining !== undefined) lines.push(`남은 정제 ${Math.round(it.pillRemaining*100)}% · 복용 효과도 남은 분량만 적용`)
  }
  const drugId = d.unidentified ? w.s.knowledge.pillKnown[d.id] ? w.db.pill(w.s.knowledge.pillKnown[d.id]).drug : undefined : d.drug?.def
  if (drugId) {
    const drug = w.db.get<DrugDef>(drugId), preview = drugPreview(w, player(w), drugId)
    lines.push(`${drug.external ? '외용' : '복용'} · ${d.unidentified ? '원래 약 기준 ' : ''}지속${drug.durationTurns / 1200}시간${drug.pain ? ` · ${d.unidentified ? '100% 효력의' : '현재'} 통증−${preview.pain.toFixed(1)}` : ''}`)
    if (drug.family) lines.push(`현재 내성${preview.tolerance.toFixed(1)}/100 · 이번 의존 위험${(preview.addiction * 100).toFixed(1)}%`)
    if (drug.consciousness || drug.breathing) lines.push(`의식 감점${drug.consciousness} · 호흡−${drug.breathing}`)
    if (drug.external) lines.push('신체 창에서 겉으로 드러난 상처를 골라 바른다.')
  }
  const raw=it&&rawStock(w,it);if(raw)lines.push(`제작 원재료: ${raw.material.label} · 조각당 ${raw.unitGrams}g · 합계 ${raw.grams}g${d.rawFragment?' · 재질을 고르는 제작에 다시 쓸 수 있다':''}`)
  if (d.ranged?.reloadTurns&&!d.ranged.firearm) lines.push(`장전 기본${d.ranged.reloadTurns}턴 · ${it?.loadedAmmo ? '한 발 장전됨'+(it?.loadedAmmoFletching?' (깃 손상)':'') : '빈 석궁'} · 빈 석궁으로 사격하면 먼저 장전한다` )
  if(d.apparel?.liningHost)lines.push('안감 칸1개 · 셔츠/재킷을 넣을 수 있다')
  if(d.apparel?.liner)lines.push('안감으로 착용 가능 · 겉옷과 착탈 시간이 합산된다')
  if (it && d.stuffSlots?.length) {
    for (const slot of d.stuffSlots) {
      const mat = stuffProfile(w, it.stuff?.[slot.id] ?? slot.ref)
      lines.push(`재질 ${slot.primary ? '주재료' : '보조'}: ${mat.label}${Array.isArray(it.stuff?.[slot.id]) && new Set((it.stuff![slot.id] as {material:string}[]).map(p=>p.material)).size>1 ? ' (질량 가중 혼합)' : ''}`)
    }
    for(const parts of Object.values(it.stuff??{}))if(Array.isArray(parts))lines.push(parts.map(part=>`${w.db.get<import('../core').MaterialDef>(part.material).label} ${part.massG}g`).join(' · '))
    const structural = structuralDurability(w, it)
    if (structural !== null) lines.push(`최대 구조 내구 ${Math.floor(structural * qualityInfo(it).dur * (it.maxDurability ?? 100) / 100)} (재질·품질·수리 반영)`)
  }
  if (d.attacks?.length) {
    const a = d.attacks[0]
    lines.push(`계열 ${SKILL_LABEL[a.family] ?? a.family}${a.reach ? ` · 리치 ${a.reach}` : ''}${a.bleedMult ? ` · 출혈 ×${a.bleedMult}` : ''}${a.stunD ? ` · 머리 기절 판정 D+${a.stunD}` : ''}${a.shortBlade ? ' · 잠든 대상 첫 타 ×2' : ''}`)
    if(a.partWeights)lines.push(`부위 가중: ${Object.entries(a.partWeights).map(([key,value])=>`${REGION_LABEL[key]??key} ×${value}`).join(' · ')}`)
  }
  if (d.weapon) lines.push(`막기치 ${d.weapon.block} · 받아넘기기치 ${d.weapon.parry > 0 ? '+' : ''}${d.weapon.parry}`)
  if (it?.edge !== undefined && !d.ranged) lines.push(`날 상태 ${Math.round(it.edge)}% (피해 ×${((60 + it.edge * 0.4) / 100).toFixed(2)})`)
  if(d.ranged?.firearm){
    const rd=d.ranged,cfg=rd.firearm!,rates=it&&firearmRates(w,it),mag=rd.magazine
    lines.push(mag?`탄창 ${it?.loadedCartridges?.length??0}/${mag.capacity}발 · ${mag.mode==='round'?'한 발마다':'클립'} 기본${rd.reloadTurns}턴`:`장전 기본${rd.reloadTurns}턴 · ${it?.loadedRound?'한 발 장전됨':'빈 장총'} · ${w.db.item(rd.ammo).label}1 + ${w.db.item(cfg.powder!).label}1`)
    if(mag&&it?.loadedCartridges?.length)lines.push(`다음 탄: ${w.db.item(it.loadedCartridges[0]!.def).label} · 탄창 ${it.loadedCartridges.map(i=>w.db.item(i.def).label).join(' / ')}`)
    if(rates)lines.push(`총열 오염 ${rates.fouling}/100 · 불발 ${rates.misfire}% · 걸림 ${rates.jam}%${it?.firearmJammed?' · 현재 걸림':''}`,`장전 화약 ${rates.wet?'젖음':'건조'} · 총열 청소 기본${cfg.cleanTurns}턴/총기 기름1 · 걸림 해소 기본${cfg.unjamTurns}턴`)
  }
  if((d.powder||d.cartridge)&&it)lines.push(`화약 젖음 ${(it.powderWetness??0).toFixed(1)}% · 젖으면 불발 위험 증가`)
  if(d.cartridge)lines.push(`실제 한 발 · 기본 불발${d.cartridge.misfire}% · 총열 오염+${d.cartridge.fouling} · 사용 후 빈 탄피 회수`)
  if (d.ranged) lines.push(`유효 사거리 ${d.ranged.effective ?? d.ranged.range} · 최대 ${d.ranged.range} · 탄약 ${w.db.item(d.ranged.ammo).label}`)
  if (d.throwable) {
    const t = d.throwable, a = t.attack
    lines.push(`투척 ${DMG_LABEL[a.damageType]} ${a.damage} · 관통 ${a.pen} · 정확도 ${a.accuracy} · 기력 ${a.energy}`, `유효 사거리 ${t.effective} · 최대 ${t.range} · 실제1개를 던져 바닥에서 회수`, '더블클릭/빠른 슬롯: 투척 조준 (Tab·Enter·Esc)')
  }
  if (d.ranged && !d.ranged.firearm && it) lines.push(`시위 ${it.bowBroken ? '끊어짐' : it.bowUnstrung ? '풀림' : '걸림'} · 습기 ${(it.bowMoisture ?? 0).toFixed(1)}% · 탄성 ${it.elasticity ?? 100}%`, '습기 30%: 피해 −10%·사거리 −1 / 60%: −25%·−3, 끊어질 수 있다')
  if (it?.rust) lines.push(`녹 ${it.rust}단계 · 가치 −${it.rust * 15}%${it.rust >= 3 && it.edge !== undefined ? ' · 날 최대 70%' : ''}`)
  if (it?.partDurability) lines.push(`부위별 내구 ${Math.min(...Object.values(it.partDurability)).toFixed(0)}~${Math.max(...Object.values(it.partDurability)).toFixed(0)}% (표시 내구는 평균)`)
  const now = Math.floor(w.s.time / 100)
  if ((it?.oiledUntil ?? 0) > now) lines.push(`기름칠: ${((it!.oiledUntil! - now) / 1200).toFixed(1)}시간 부식 면제`)
  if ((it?.waxedUntil ?? 0) > now) lines.push(`밀랍칠: ${((it!.waxedUntil! - now) / 1200).toFixed(1)}시간 시위 젖음 ×0.3`)
  if (d.shield) lines.push(`막기치 ${d.shield.block} · 흡수 ${d.shield.absorb} · 기력 4 + 피해/2`)
  if (d.apparel) {
    const ar = d.apparel.armor
    const parts = [`날 ${ar.sharp ?? 0}`, `타격 ${ar.blunt ?? 0}`, `열 ${ar.heat ?? 0}`]
    lines.push(`방어 ${parts.join(' / ')}${d.bulk ? ` · 둔중 ${d.bulk}` : ''}${d.apparel.noise ? ` · 걷기 소음 ${d.apparel.noise}` : ''}`)
    lines.push(`덮는 곳: ${d.apparel.groups.map((g) => GROUP_LABEL[g] ?? g).join(' · ')}`)
    const ap = d.apparel
    const water = ap.waterproofPct ?? (ap.waterproof ? 90 : 0)
    lines.push(`단열 ${ap.insulation} · 젖으면 단열 −${ap.wetLoss ?? (ap.waterproof ? 0 : 70)}%${water ? ` · 방수 ${water}%` : ''}${ap.windproof ? ` · 방풍 ${Math.round(ap.windproof * 100)}%` : ''}`)
    const wet = Object.values(it?.wetness ?? {})
    if (wet.length) lines.push(`젖음 ${Math.round(Math.min(...wet))}~${Math.round(Math.max(...wet))}% (덮는 부위별)`)
  }
  lines.push(...modLines(d.mods))
  if(d.saltGrams)lines.push(`소금 한 단위 ${d.saltGrams}g`)
  if(it?.contaminantAsh)lines.push(`재 노출 ${Number(it.contaminantAsh.toFixed(4))} · 조리/보존으로 사라지지 않는다`)
  if (d.food) lines.push(`${Number((it?foodKcal(w,it):d.food.kcal).toFixed(1))} kcal · 단백 ${d.food.protein ?? 0}g · 비타민 ${d.food.vitamin ?? 0} · 수분 ${d.food.water ?? 0}ml${d.food.thirst ? ` · 추가 갈증 ${d.food.thirst}ml` : ''}${d.food.raw ? ' · 날것' : ''}`)
  if(it?.foodWater)lines.push('물·재료에서 옮은 오염 '+Number(it.foodWater.ml.toFixed(3))+'ml · 병원체 '+Number(it.foodWater.quality.pathogen.toFixed(2)))
  if(it?.foodBurnt)lines.push('탄 음식 · 열량 ×'+(cookingRules(w)?.burnKcal??1)+' · 맛 '+(cookingRules(w)?.burnMood??0))
  if(d.fragile)lines.push('바닥에 버리면 더미 전체 '+Math.round(d.fragile.dropChance*100)+'% 깨짐 · 물/침구 완충 · 실제 내용물 보존')
  if(d.food?.rawDisease)lines.push('날것 섭취 시 '+w.db.get<import('../core').DiseaseDef>(d.food.rawDisease.def).label+' 노출 위험 '+Math.round(d.food.rawDisease.chance*100)+'%')
  if(d.food?.sprouts)lines.push(it&&foodFreshness(it)<=d.food.sprouts.at?'싹 난 생감자 · 추가 식중독 위험 '+d.food.sprouts.risk+'%':'싹 나기 전 · 오래된 생감자는 싹이 날 수 있다')
  if(d.openFood)lines.push('개봉 '+d.openFood.turns+'턴 · 식사1턴 별도 · 실제 칼/손도끼 필요 · 중단하면 진행이 남지 않는다')
  if(d.food?.servings)lines.push('남은 음식 '+(it?.uses??d.food.servings)+'/'+d.food.servings+'회분 · 다 먹으면 같은 빈 용기가 남는다')
  if(it?.foodSaltGrams)lines.push('원래 물의 소금 '+Number(it.foodSaltGrams.toFixed(3))+'g · 먹으면 추가 수분 손실')
  if(d.food?.warm&&it)lines.push(it.foodHeatedAt!==undefined&&turnOf(w)-it.foodHeatedAt<d.food.warm.coolTurns?'아직 따뜻함 · 먹으면 체온 +'+d.food.warm.gain+'°C':'식은 음식 · 따뜻한 체온 효과 없음')
  if(d.food?.scentRadius)lines.push('훈제 냄새 반경 +'+d.food.scentRadius+'칸 · 여러 조각을 가져도 중첩되지 않는다')
  if ((d.food || d.drink?.freshHours) && it) {
    const f = foodFreshness(it), band = freshnessBand(w, it), rate = rotRate(w, it, d, ambientTemp(w))
    const target = band === 'fresh' ? 60 : band === 'stale' ? 30 : 0
    lines.push(`신선도 ${f.toFixed(1)} · ${FRESHNESS_LABEL[band]}${it.foodThawed ? ' · 해동 손상' : ''}${it.foodWet ? ' · 젖음' : ''}`)
    if (!(d.food?.freshHours??d.drink?.freshHours)) lines.push('밀봉 보존: 신선도 감소 없음')
    else if (rate === 0) lines.push('이 기온에서는 얼어서 부패하지 않는다')
    else if (band !== 'rotten') lines.push(`현재 기온에서 약${Math.max(0, (f - target) / rate).toFixed(1)}시간 뒤 ${band === 'fresh' ? '오래됨' : band === 'stale' ? '상함' : '썩음'}`)
    if (masteryStage(w, player(w), 'survival') >= 5 && band === 'fresh' && rate > 0 && (f - 60) / rate <= 24) lines.push('곧 오래됨 — 생존 숙달로 변화를 알아챘다')
  }
  if (d.drink && it) lines.push(...waterLines(w, player(w), it))
  if(d.drink?.freshHours)lines.push('300ml당 비타민 '+(d.drink.vitamin??0)+' · 신선 기간 '+d.drink.freshHours+'시간 · 다 마시면 같은 물병이 남는다')
  if (d.drink) lines.push(`수분 ${d.drink.water} ml${d.drink.dirty ? ' · 더러움' : ''}${d.drink.alcohol ? ' · 술 · 이뇨100ml' : ''}${d.drink.kcal ? ` · ${d.drink.kcal} kcal` : ''}`)
  if (d.medical) lines.push({ bandage: '상처에 감아 출혈을 줄인다', tourniquet: '팔다리 동맥 출혈을 멈춘다 (2시간 안에 풀 것)', splint: '골절을 고정한다', disinfect: '상처를 소독한다', suture: '바늘과 함께 봉합한다. 동맥 결찰·힘줄 봉합은 의료 숙달3단계가 필요하다' }[d.medical.kind])
  if (d.light) lines.push(`등불 반경 ${d.light.radius}${it?.fuel !== undefined ? ` · 연료 ${Math.round((it.fuel / 1200) * 10) / 10}시간` : ''}${it?.lit ? ' · 켜짐' : ''}`)
  if (d.book) lines.push(`문해${d.book.literacyMin ?? 1}단계${d.book.selfStudy ? ' · 문맹도 독학 가능' : ''} · 쪽당${readingPageTurns(w,player(w))}턴${d.book.literacyTo ? ` · 온전한 완독으로 문해${d.book.literacyTo}단계` : ''}${d.book.identify?.length ? ` · 정제 ${d.book.identify.length}종 식별` : ''}${d.book.bestiary?.length ? ` · 생물 ${d.book.bestiary.length}종 문헌 지식` : ''}`, `독서 ${it?.readPages ?? 0}/${d.book.pages}쪽${it?.lostPages ? ` · 번진 쪽 ${it.lostPages}` : ''}${d.book.amount ? ` · ${d.book.mastery === 'medicine' ? '의료' : '생존'} 숙달 +${d.book.amount}회 (책 누계 최대 15)` : ''}${d.book.unlocks?.length ? ` · 제작법 ${d.book.unlocks.length}개` : ''}`)
  if (it?.readProgress) lines.push(`다음 쪽 진행 ${it.readProgress}턴 · 중단해도 보존`)
  if(d.cooking)lines.push((d.food?.emptyVessel?'실제 모닥불 바로 곁 조리 ':'불 2칸 내 조리 ')+(it?.cookProgress??0)+'/'+d.cooking.turns+'턴 → '+w.db.item(d.cooking.result).label)
  if (d.place) {
    const place = w.db.terrain(d.place)
    lines.push(`바라보는 쪽에 설치 → ${place.label}`)
    if(place.cultivation){const r=place.cultivation;lines.push(`성장할 햇빛 ${r.minLight*100}~${(r.maxLight??1)*100}% · ${r.minTemp}~${r.maxTemp}°C · 한 회차 물 ${r.waterMl}ml`);if(r.minLight===0&&!place.gather?.soilDependent)lines.push('기온이 맞는 지하에서는 자리를 떠나도 남은 실제 물로 자란다.');if(r.substrate)lines.push(`실제 배지 ${r.substrate.cycles}회 수확 · 소진 뒤 ${w.db.item(r.substrate.item).label} 하나로 교체`)}
    if (place.bedding) lines.push(`그 위에서 수면 질 ${place.bedding.quality.toFixed(2)}${place.bedding.insulation ? ` · 수면 중 전신 단열 +${place.bedding.insulation} (품질·젖음 반영)` : ''}${place.bedding.portable ? ' · F2에서 접어 회수' : ''}`, `침구 젖음 ${Math.round(it?.wetness?.torso ?? 0)}% · 그을음 ${Math.ceil(it?.beddingScorch??0)}%`)
  }
  if(it?.beddingLice&&it.beddingLice.until>turnOf(w))lines.push('침구에 이 흔적이 있다. 실제 물로 세탁하고 몸도 별도로 씻어야 한다.')
  const vessel=waterVesselForDef(d);if(vessel)lines.push('물 용기 용량 '+vessel.capacityMl+'ml · 물을 다 써도 같은 빈 용기를 남긴다')
  if (d.refuel) lines.push(`등불 연료 +${Math.round(d.refuel / 1200)}시간`)
  if(d.respirator)lines.push('남은 여과 '+(it?.uses??d.uses??0)+'턴 · 실제 착용 중 재 먼지에서만 소모한다.')
  else if(it?.uses!==undefined&&!d.drink?.emptyVessel)lines.push('남은 양 '+it.uses)
  if(it?.brokenRelic)lines.push('영구 파손 · 수리 불가')
  if (it?.maxDurability !== undefined && it.maxDurability < 100) lines.push(`수리 후 최대 내구 ${it.maxDurability.toFixed(1)}% (영구 감소)`)
  if (it?.durability !== undefined) { const b = durabilityBand(it.durability); lines.push(`내구 ${Math.round(it.durability)}%${b.label ? ` — ${b.label}` : ''}`) }
  lines.push(`크기 ${d.size?.[0] ?? 1}×${d.size?.[1] ?? 1}`)
  if (d.description) lines.push(d.description)
  return { title: it ? d.drink?.emptyVessel?d.label+' ['+drinkVolume(w,it)+'ml]':itemLabel(w, it) : d.label, lines, color: rarityColor(d) }
}

const REGION_LABEL: Record<string, string> = { head: '머리', torso: '몸통', larm: '왼팔', rarm: '오른팔', lleg: '왼다리', rleg: '오른다리', neck: '목' }

/** 능력 툴팁 L2(Shift): 바꾸는 판정 공식 항 (15 §19 · 12) */
export function abilityFormula(d: AbilityDef): string[] {
  const out: string[] = []
  const m = d.attack
  if (m) {
    if (m.hitBonus) out.push(`명중 = 50 + (공격치 − 회피치) × 2 + 수정 ${m.hitBonus > 0 ? '+' : ''}${m.hitBonus}`)
    if (m.damageMult) out.push(`피해 D = 기본 × 날 × 근력 × 팔 × (80 + r)% × ${m.damageMult}`)
    if (m.penBonus) out.push(`관통 +${m.penBonus} → 방어구 유효 = 실효 − 관통`)
    if (m.bleedMult) out.push(`상처 출혈 = D × 유형계수 × 혈관계수 × ${m.bleedMult} (동맥 고정값엔 곱하지 않음)`)
    if (m.arterialBonus) out.push(`동맥 판정(D ≥ 부위 HP 30%) = D × 2% + ${m.arterialBonus}%p`)
    if (m.fractureMult) out.push(`골절 = (D − 뼈 강도) × 8% × ${m.fractureMult}`)
    if (m.stunBonus) out.push(`머리 기절 판정 +${m.stunBonus}%p`)
    if (m.armorDamage) out.push(`맞은 방어구 내구 −${m.armorDamage}%p 추가`)
    if (m.partWeights) out.push(`부위 가중: ${Object.entries(m.partWeights).map(([k, v]) => `${REGION_LABEL[k] ?? k} ×${v}`).join(' · ')}`)
    if (m.aoe) out.push(m.aoe === 'adjacent' ? '범위: 인접 8칸 모두' : '범위: 앞 2칸 직선')
    if (m.knockback) out.push(`밀쳐내기 ${m.knockback}칸`)
    if (m.knockdownChance) out.push(`넘어뜨림 ${m.knockdownChance}%`)
    if (m.aimed) out.push('조준형: 야행성이면 조명 감점 절반')
  }
  if (d.stance) out.push(`자세 ${d.stance.turns}턴 (반응 phase 1: 같은 시각이면 먼저 움직인다)${d.stance.magnitude ? ` · 크기 ${d.stance.magnitude}` : ''}`)
  if (d.self?.energyPct) out.push(`기력 회복 최대치의 ${d.self.energyPct}%`)
  if (d.self?.painRelief) out.push(`통증 −${d.self.painRelief}${d.self.turns ? ` (${d.self.turns}턴)` : ''}`)
  if (d.channel) out.push(`채널 ${d.channel}턴 · 맞으면 끊기고 기력 절반 환급`)
  if (d.lunge) out.push(`직선 ${d.lunge}칸 이동 후 공격`)
  if (d.sweep) out.push(`연속 ${d.sweep}칸 휩쓸기`)
  out.push(...modLines(d.mods))
  return out
}

export function abilityTip(w: World, d: AbilityDef): { title: string; lines: string[] } {
  const lines = [`${treeName(d.tree)} ${d.tier}단계 · ${d.kind === 'passive' ? '패시브' : d.kind === 'toggle' ? '전환' : '액티브'}`]
  if (d.energy) lines.push(`기력 ${d.energy}`)
  if (d.cooldown) lines.push(`재사용 ${d.cooldown}턴`)
  if (d.weapon) lines.push(`필요: ${SKILL_LABEL[d.weapon] ?? d.weapon}`)
  lines.push(d.description)
  lines.push(...modLines(d.mods))
  if (d.requires?.length) lines.push(`선행: ${d.requires.map((r) => w.db.ability(r).label).join(', ')}`)
  return { title: d.label, lines }
}

export function treeName(t: string): string {
  return ({ blade: '도검', axe: '도끼', blunt: '둔기', spear: '창', archery: '활', survival: '생존' } as Record<string, string>)[t] ?? t
}

/** 부위 상태 색: 멀쩡·타박·부상·중상·불구 */
export const STATE_COLOR = ['#6f8a5a', '#b6a24e', '#c77a32', '#b2402c', '#4a1612']

/** 생존 일지·체온 막대가 같은 판정값을 보여 준다 (03 §15) */
export function temperatureTip(w: World, c: Creature): string[] {
  const s = thermalState(w, c)
  const delta = temperatureDelta(c, s)
  const act = { rest: '휴식', sleep: '수면', walk: '걷기', work: '작업', combat: '전투' }[s.activity]
  const lines = [
    `심부 ${c.needs.bodyTemp.toFixed(1)}°C · ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}°C/10분 (현재 조건 유지 시)`,
    `체감 ${s.feels.toFixed(1)}°C = 기온 ${s.air.toFixed(1)} − 바람 ${s.windChill.toFixed(1)} + 열원 ${s.heat} + 지붕 ${s.shelter} − 젖음 ${s.evaporation}`,
    `전신 단열 ${s.insulation.toFixed(3)} · 쾌적 ${s.low.toFixed(1)}~${s.high.toFixed(1)}°C (${act})`,
    `내의 젖음 ${s.innerWetness.toFixed(0)}% · 50% 이상이면 증발 냉각 −3°C`,
  ]
  for (const it of Object.values(c.equip)) {
    if (!it?.wetness) continue
    const values = Object.values(it.wetness)
    if (values.some((v) => v > 0)) lines.push(`${itemDef(w, it).label} 젖음 ${Math.round(Math.min(...values))}~${Math.round(Math.max(...values))}%`)
  }
  lines.push(`35.0°C 저체온 · 32.0°C 위독 · ${(39.5 - thirstBand(w, c).heatShift).toFixed(1)}°C 열사병`)
  return lines
}
