import {displayItemLabel as itemLabel,displayItemDefLabel} from './locales/item'
import { t, defText } from './locale'
import {firearmRates} from '../core/firearms'
import {qualityFromScore} from '../core/crafting'
import {foodKcal,cookingRules} from '../core/cooking-state'
import {displayWaterLines} from './locales/item-water'
import type {MaterialDef,Stuff} from '../core/types'
import {pillAgeLines} from '../core/pill-aging'
// 툴팁 문구: 아이템·능력·수정치를 한국어로 풀어 쓴다

import { waterVesselForDef,drinkVolume, turnOf, pillBelief, knowledgeDef, readingPageTurns, drugPreview, type DrugDef, player, ambientTemp, foodFreshness, freshnessBand, FRESHNESS_LABEL, rotRate, masteryStage, stuffProfile, rawStock, structuralDurability, durabilityBand, hasQuality, itemDef, qualityInfo, temperatureDelta, thermalState, type ProstheticDef, type AbilityDef, type Creature, type ItemDef, type ItemInst, type World, thirstBand } from '../core'

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
    const lab = t(MOD_LABEL[k] ?? k)
    if (lab.endsWith('×')) return `${lab}${v}`
    return `${lab} ${v! > 0 ? '+' : ''}${v}`
  })
}

const GROUP_LABEL: Record<string, string> = {
  skull: '두개골', ear: '귀', eye: '눈', nose: '코', jaw: '턱', neck: '목', chest: '흉부', abdomen: '복부', pelvis: '골반',
  upperArm: '상완', forearm: '전완', hand: '손', finger: '손가락', thigh: '대퇴', shin: '정강이', foot: '발', toe: '발가락',
}

function materialLabel(w:World,ref:Stuff[string]):string {
  const m=stuffProfile(w,ref)
  return m.id==='Material.Mixed'&&Array.isArray(ref)?ref.map(p=>defText(w.db.get<MaterialDef>(p.material))).join('·'):defText(m)
}

export function itemTip(w: World, it: ItemInst | null, defId?: string): { title: string; lines: string[]; color: string } {
  const d = it ? itemDef(w, it) : w.db.item(defId!)
  const lines: string[] = []
  if(d.fletching)lines.push(it?.fletchingDamaged?t("깃 손상 · 원거리 명중 −{0}" ,d.fletching.hitPenalty):t('깃 정상 · 직접 재비에 노출되면 손상된다.'), t('탄약 선택/빠른 슬롯은 같은 깃 상태만 사용한다. 소진해도 다른 상태를 섞어 쏘지 않는다.'))
  if(d.quiver)lines.push(t('화살 전용1×6칸 · 등 슬롯/망토와 함께 착용 불가'), t('온전히 착용한 동안 실제 내부 화살을 꺼내 쏘거나 장전한다.'))
  if(d.pocket)lines.push(t('허리 주머니2×2 · 착용 완료 후 소모품에 바로 접근'), t('전투 중에도 빠른 슬롯 연결은0턴이며 사용은 원래 행동 시간을 쓴다.'))
  if(d.storage)lines.push(t("내부 {0}×{1}칸 · {2}더미 보관" ,d.storage[0],d.storage[1],it?.contents?.length??0), t('더블클릭 또는 우클릭 → 열기. 물품은 꺼낸 뒤 사용한다. 가방을 겹쳐 넣을 수 없다.'))
  if(it?.missingItem)return{title:d.label,lines:[t("원래 정의: {0}" ,it.missingItem.def),t("원래 칸 {0}×{1} · {2}개" ,it.missingItem.size[0],it.missingItem.size[1],it.count), t('원래 상태를 보관 중이다. 사용·장착·거래·분할할 수 없다.'), t('원래 정의가 돌아오면 같은 물품으로 복원한다.')],color:'#d9a040'}
  if (d.relic && (it?.appraisal ?? 0) < 2) {
    return { title: it ? itemLabel(w, it) : displayItemDefLabel(d), lines: [(d.unknownDescription ? defText(d,'unknownDescription') : t('개척기 또는 그보다 오래된 물건이다.')), (it?.appraisal ?? 0) === 1 ? t('의료·신체 대체용 유물로 추정된다. 정확한 기능은 아직 모른다.') : t('용도 미확인'), t('우클릭 → 살펴보기로 감정한다. 문해·지각·발굴꾼 배경이 도움이 된다.')], color: rarityColor(d) }
  }
  if(it)for(const contract of w.s.overworld?.contracts??[])if(contract.kind==='recover'&&contract.status==='active'&&turnOf(w)<contract.deadline&&contract.itemUid===it.uid)lines.push(t('회수 의뢰의 원본 · {0}',contract.label))
  if(it)for(const contract of w.s.overworld?.contracts??[])if(contract.kind==='excavate'&&contract.status==='active'&&turnOf(w)<contract.deadline&&contract.proof?.uid===it.uid)lines.push(t('발굴 의뢰의 원본 · {0}',contract.label))
  if(it)for(const contract of w.s.overworld?.contracts??[])if(contract.kind==='rescue'&&contract.status==='active'&&turnOf(w)<contract.deadline&&contract.relic?.uid===it.uid)lines.push(t('구조 의뢰의 원래 유품 · {0}',contract.name))
  if (d.prosthetic) {
    const p = w.db.get<ProstheticDef>(d.prosthetic)
    lines.push(t("의수족 · 기본 효율{0}% · 의료{1}단계" ,Math.round(p.efficiency * 100),p.medicine))
    if (p.powerTurns) lines.push(t("전원셀{0}일 · 영하에서 효율×{1}" ,p.powerTurns / 28800,p.coldMult ?? 1))
    if (p.maintenanceTurns) lines.push(t("가죽끈 정비 주기{0}일" ,p.maintenanceTurns / 28800))
    if (p.grip === false) lines.push(t("한 손 무기를 쥘 수 없다 · 양손 무기 보조{0}" ,p.twoHandSupport ?? 0))
    lines.push(t('신체 창에서 결손 부위를 골라 설치한다.'))
  }
  lines.push(`${t(CAT_LABEL[d.category])}${d.slot ? ` · ${t(SLOT_LABEL[d.slot])}` : ''}${d.twoHanded ? t(' · 양손') : ''}`)
  if (it && (hasQuality(d) || it.quality !== undefined)) {
    const q = qualityInfo(it)
    const vessel=!!(d.food?.emptyVessel||d.drink?.emptyVessel)||w.db.all<ItemDef>('Item').some(x=>x.food?.emptyVessel===d.id||x.drink?.emptyVessel===d.id)
    if(d.food&&!vessel){if(it.foodQ===undefined)lines.push(t('음식 품질 {0}',t(q.label)))}
    else if(vessel)lines.push(t('용기 품질 {0}',t(q.label)))
    else lines.push(t("품질 {0}{1}" ,t(q.label),q.dmg !== 1 ? t(" · 피해·방어 ×{0} · 내구 ×{1} · 단열 ×{2}" ,q.dmg,q.dur,q.ins) : ''))
  }
  if(it?.foodQ!==undefined&&d.food)lines.push(t('음식 품질 {0} · Q {1}',t(qualityInfo({...it,quality:qualityFromScore(it.foodQ)}).label),Number(it.foodQ.toFixed(1))))
  for (const a of d.attacks ?? []) {
    lines.push(t("{0}: {1} {2} · 관통 {3} · 정확도 +{4} · 기력 {5}" ,t(a.label),t(DMG_LABEL[a.damageType] ?? a.damageType),Number(a.damage.toFixed(2)),a.pen,a.accuracy,a.energy))
  }
  if (d.unidentified === 'pill') {
    if (it) lines.push(...pillAgeLines(w, player(w), it).map(line=>t(line)))
    const belief = pillBelief(w,d.id), rules = knowledgeDef(w)
    if (belief?.confidence === 'likely' && belief.belief) lines.push(t("추정 효능: {0}" ,defText(w.db.pill(belief.belief),'description')))
    if (belief?.ruledOut.length) lines.push(t("관찰로 배제: {0}" ,belief.ruledOut.map((id) => defText(w.db.pill(id))).join(', ')))
    lines.push(t("감별{0}턴 · ¼ 맛보기{1}턴 (효과×{2}, 감별치+{3})" ,rules.examineTurns,rules.tasteTurns,rules.tasteFraction,rules.tasteBonus))
    if (it?.pillRemaining !== undefined) lines.push(t("남은 정제 {0}% · 복용 효과도 남은 분량만 적용" ,Math.round(it.pillRemaining*100)))
  }
  const drugId = d.unidentified ? w.s.knowledge.pillKnown[d.id] ? w.db.pill(w.s.knowledge.pillKnown[d.id]).drug : undefined : d.drug?.def
  if (drugId) {
    const drug = w.db.get<DrugDef>(drugId), preview = drugPreview(w, player(w), drugId)
    lines.push(t("{0} · {1}지속{2}시간{3}" ,drug.external ? t('외용') : t('복용'),d.unidentified ? t('원래 약 기준 ') : '',drug.durationTurns / 1200,drug.pain ? t(" · {0} 통증−{1}" ,d.unidentified ? t('100% 효력의') : t('현재'),preview.pain.toFixed(1)) : ''))
    if (drug.family) lines.push(t("현재 내성{0}/100 · 이번 의존 위험{1}%" ,preview.tolerance.toFixed(1),(preview.addiction * 100).toFixed(1)))
    if (drug.consciousness || drug.breathing) lines.push(t("의식 감점{0} · 호흡−{1}" ,drug.consciousness,drug.breathing))
    if (drug.external) lines.push(t('신체 창에서 겉으로 드러난 상처를 골라 바른다.'))
  }
  const raw=it&&rawStock(w,it);if(raw)lines.push(t("제작 원재료: {0} · 조각당 {1}g · 합계 {2}g{3}" ,defText(raw.material),raw.unitGrams,raw.grams,d.rawFragment?t(' · 재질을 고르는 제작에 다시 쓸 수 있다'):''))
  if (d.ranged?.reloadTurns&&!d.ranged.firearm) lines.push(t("장전 기본{0}턴 · {1} · 빈 석궁으로 사격하면 먼저 장전한다" ,d.ranged.reloadTurns,it?.loadedAmmo ? t('한 발 장전됨')+(it?.loadedAmmoFletching?t(' (깃 손상)'):'') : t('빈 석궁')) )
  if(d.apparel?.liningHost)lines.push(t('안감 칸1개 · 셔츠/재킷을 넣을 수 있다'))
  if(d.apparel?.liner)lines.push(t('안감으로 착용 가능 · 겉옷과 착탈 시간이 합산된다'))
  if (it && d.stuffSlots?.length) {
    for (const slot of d.stuffSlots) {
      const mat = materialLabel(w, it.stuff?.[slot.id] ?? slot.ref)
      lines.push(t(slot.primary?'재질 주재료: {0}{1}':'재질 보조: {0}{1}',mat,Array.isArray(it.stuff?.[slot.id]) && new Set((it.stuff![slot.id] as {material:string}[]).map(p=>p.material)).size>1 ? t(' (질량 가중 혼합)') : ''))
    }
    for(const parts of Object.values(it.stuff??{}))if(Array.isArray(parts))lines.push(parts.map(part=>`${defText(w.db.get<MaterialDef>(part.material))} ${part.massG}g`).join(' · '))
    const structural = structuralDurability(w, it)
    if (structural !== null) lines.push(t("최대 구조 내구 {0} (재질·품질·수리 반영)" ,Math.floor(structural * qualityInfo(it).dur * (it.maxDurability ?? 100) / 100)))
  }
  if (d.attacks?.length) {
    const a = d.attacks[0]
    lines.push(t("계열 {0}{1}{2}{3}{4}" ,t(SKILL_LABEL[a.family] ?? a.family),a.reach ? t(" · 리치 {0}" ,a.reach) : '',a.bleedMult ? t(" · 출혈 ×{0}" ,a.bleedMult) : '',a.stunD ? t(" · 머리 기절 판정 D+{0}" ,a.stunD) : '',a.shortBlade ? t(' · 잠든 대상 첫 타 ×2') : ''))
    if(a.partWeights)lines.push(t("부위 가중: {0}" ,Object.entries(a.partWeights).map(([key,value])=>`${t(REGION_LABEL[key]??key)} ×${value}`).join(' · ')))
  }
  if (d.weapon) lines.push(t("막기치 {0} · 받아넘기기치 {1}{2}" ,d.weapon.block,d.weapon.parry > 0 ? '+' : '',d.weapon.parry))
  if (it?.edge !== undefined && !d.ranged) lines.push(t("날 상태 {0}% (피해 ×{1})" ,Math.round(it.edge),((60 + it.edge * 0.4) / 100).toFixed(2)))
  if(d.ranged?.firearm){
    const rd=d.ranged,cfg=rd.firearm!,rates=it&&firearmRates(w,it),mag=rd.magazine
    lines.push(mag?t("탄창 {0}/{1}발 · {2} 기본{3}턴" ,it?.loadedCartridges?.length??0,mag.capacity,mag.mode==='round'?t('한 발마다'):t('클립'),rd.reloadTurns):t("장전 기본{0}턴 · {1} · {2}1 + {3}1" ,rd.reloadTurns,it?.loadedRound?t('한 발 장전됨'):t('빈 장총'),displayItemDefLabel(w.db.item(rd.ammo)),displayItemDefLabel(w.db.item(cfg.powder!))))
    if(mag&&it?.loadedCartridges?.length)lines.push(t("다음 탄: {0} · 탄창 {1}" ,itemLabel(w,it.loadedCartridges[0]!),it.loadedCartridges.map(i=>itemLabel(w,i)).join(' / ')))
    if(rates)lines.push(t("총열 오염 {0}/100 · 불발 {1}% · 걸림 {2}%{3}" ,rates.fouling,rates.misfire,rates.jam,it?.firearmJammed?t(' · 현재 걸림'):''),t("장전 화약 {0} · 총열 청소 기본{1}턴/총기 기름1 · 걸림 해소 기본{2}턴" ,rates.wet?t('젖음'):t('건조'),cfg.cleanTurns,cfg.unjamTurns))
  }
  if((d.powder||d.cartridge)&&it)lines.push(t("화약 젖음 {0}% · 젖으면 불발 위험 증가" ,(it.powderWetness??0).toFixed(1)))
  if(d.cartridge)lines.push(t("실제 한 발 · 기본 불발{0}% · 총열 오염+{1} · 사용 후 빈 탄피 회수" ,d.cartridge.misfire,d.cartridge.fouling))
  if (d.ranged) lines.push(t("유효 사거리 {0} · 최대 {1} · 탄약 {2}" ,d.ranged.effective ?? d.ranged.range,d.ranged.range,displayItemDefLabel(w.db.item(d.ranged.ammo))))
  if (d.throwable) {
    const thrown = d.throwable, a = thrown.attack
    lines.push(t("투척 {0} {1} · 관통 {2} · 정확도 {3} · 기력 {4}" ,DMG_LABEL[a.damageType],a.damage,a.pen,a.accuracy,a.energy), t("유효 사거리 {0} · 최대 {1} · 실제1개를 던져 바닥에서 회수" ,thrown.effective,thrown.range), t('더블클릭/빠른 슬롯: 투척 조준 (Tab·Enter·Esc)'))
  }
  if (d.ranged && !d.ranged.firearm && it) lines.push(t(it.bowBroken?'시위 끊어짐 · 습기 {0}% · 탄성 {1}%':it.bowUnstrung?'시위 풀림 · 습기 {0}% · 탄성 {1}%':'시위 걸림 · 습기 {0}% · 탄성 {1}%',(it.bowMoisture ?? 0).toFixed(1),it.elasticity ?? 100), t('습기 30%: 피해 −10%·사거리 −1 / 60%: −25%·−3, 끊어질 수 있다'))
  if (it?.rust) lines.push(t("녹 {0}단계 · 가치 −{1}%{2}" ,it.rust,it.rust * 15,it.rust >= 3 && it.edge !== undefined ? t(' · 날 최대 70%') : ''))
  if (it?.partDurability) lines.push(t("부위별 내구 {0}~{1}% (표시 내구는 평균)" ,Math.min(...Object.values(it.partDurability)).toFixed(0),Math.max(...Object.values(it.partDurability)).toFixed(0)))
  const now = Math.floor(w.s.time / 100)
  if ((it?.oiledUntil ?? 0) > now) lines.push(t("기름칠: {0}시간 부식 면제" ,((it!.oiledUntil! - now) / 1200).toFixed(1)))
  if ((it?.waxedUntil ?? 0) > now) lines.push(t("밀랍칠: {0}시간 시위 젖음 ×0.3" ,((it!.waxedUntil! - now) / 1200).toFixed(1)))
  if (d.shield) lines.push(t("막기치 {0} · 흡수 {1} · 기력 4 + 피해/2" ,d.shield.block,d.shield.absorb))
  if (d.apparel) {
    const ar = d.apparel.armor
    const parts = [t("날 {0}" ,ar.sharp ?? 0), t("타격 {0}" ,ar.blunt ?? 0), t("열 {0}" ,ar.heat ?? 0)]
    lines.push(t("방어 {0}{1}{2}" ,parts.join(' / '),d.bulk ? t(" · 둔중 {0}" ,d.bulk) : '',d.apparel.noise ? t(" · 걷기 소음 {0}" ,d.apparel.noise) : ''))
    lines.push(t("덮는 곳: {0}" ,d.apparel.groups.map((g) => t(GROUP_LABEL[g] ?? g)).join(' · ')))
    const ap = d.apparel
    if(ap.eyeProtection)lines.push(t('눈 보호 · 실제로 온전히 착용하고 내구가 남아 있어야 눈부심·노출을 막는다'))
    const water = ap.waterproofPct ?? (ap.waterproof ? 90 : 0)
    lines.push(t("단열 {0} · 젖으면 단열 −{1}%{2}{3}" ,ap.insulation,ap.wetLoss ?? (ap.waterproof ? 0 : 70),water ? t(" · 방수 {0}%" ,water) : '',ap.windproof ? t(" · 방풍 {0}%" ,Math.round(ap.windproof * 100)) : ''))
    const wet = Object.values(it?.wetness ?? {})
    if (wet.length) lines.push(t("젖음 {0}~{1}% (덮는 부위별)" ,Math.round(Math.min(...wet)),Math.round(Math.max(...wet))))
  }
  lines.push(...modLines(d.mods))
  if(d.saltGrams)lines.push(t("소금 한 단위 {0}g" ,d.saltGrams))
  if(it?.contaminantAsh)lines.push(t("재 노출 {0} · 조리/보존으로 사라지지 않는다" ,Number(it.contaminantAsh.toFixed(4))))
  if (d.food) lines.push(t("{0} kcal · 단백 {1}g · 비타민 {2} · 수분 {3}ml{4}{5}" ,Number((it?foodKcal(w,it):d.food.kcal).toFixed(1)),d.food.protein ?? 0,d.food.vitamin ?? 0,d.food.water ?? 0,d.food.thirst ? t(" · 추가 갈증 {0}ml" ,d.food.thirst) : '',d.food.raw ? t(' · 날것') : ''))
  if(it?.foodWater)lines.push(t('물·재료에서 옮은 오염 {0}ml · 병원체 {1}',Number(it.foodWater.ml.toFixed(3)),Number(it.foodWater.quality.pathogen.toFixed(2))))
  if(it?.foodBurnt)lines.push(t('탄 음식 · 열량 ×{0} · 맛 {1}',cookingRules(w)?.burnKcal??1,cookingRules(w)?.burnMood??0))
  if(d.fragile)lines.push(t('바닥에 버리면 더미 전체 {0}% 깨짐 · 물/침구 완충 · 실제 내용물 보존',Math.round(d.fragile.dropChance*100)))
  if(d.food?.rawDisease)lines.push(t('날것 섭취 시 {0} 노출 위험 {1}%',defText(w.db.get<import('../core').DiseaseDef>(d.food.rawDisease.def)),Math.round(d.food.rawDisease.chance*100)))
  if(d.food?.sprouts)lines.push(it&&foodFreshness(it)<=d.food.sprouts.at?t('싹 난 생감자 · 추가 식중독 위험 {0}%',d.food.sprouts.risk):t('싹 나기 전 · 오래된 생감자는 싹이 날 수 있다'))
  if(d.openFood)lines.push(t('개봉 {0}턴 · 식사1턴 별도 · 실제 칼/손도끼 필요 · 중단하면 진행이 남지 않는다',d.openFood.turns))
  if(d.food?.servings)lines.push(t('남은 음식 {0}/{1}회분 · 다 먹으면 같은 빈 용기가 남는다',it?.uses??d.food.servings,d.food.servings))
  if(it?.foodSaltGrams)lines.push(t('원래 물의 소금 {0}g · 먹으면 추가 수분 손실',Number(it.foodSaltGrams.toFixed(3))))
  if(d.food?.warm&&it)lines.push(it.foodHeatedAt!==undefined&&turnOf(w)-it.foodHeatedAt<d.food.warm.coolTurns?t('아직 따뜻함 · 먹으면 체온 +{0}°C',d.food.warm.gain):t('식은 음식 · 따뜻한 체온 효과 없음'))
  if(d.food?.scentRadius)lines.push(t('훈제 냄새 반경 +{0}칸 · 여러 조각을 가져도 중첩되지 않는다',d.food.scentRadius))
  if ((d.food || d.drink?.freshHours) && it) {
    const f = foodFreshness(it), band = freshnessBand(w, it), rate = rotRate(w, it, d, ambientTemp(w))
    const target = band === 'fresh' ? 60 : band === 'stale' ? 30 : 0
    lines.push(t("신선도 {0} · {1}{2}{3}" ,f.toFixed(1),t(FRESHNESS_LABEL[band]),it.foodThawed ? t(' · 해동 손상') : '',it.foodWet ? t(' · 젖음') : ''))
    if (!(d.food?.freshHours??d.drink?.freshHours)) lines.push(t('밀봉 보존: 신선도 감소 없음'))
    else if (rate === 0) lines.push(t('이 기온에서는 얼어서 부패하지 않는다'))
    else if (band !== 'rotten') lines.push(t("현재 기온에서 약{0}시간 뒤 {1}" ,Math.max(0, (f - target) / rate).toFixed(1),band === 'fresh' ? t('오래됨') : band === 'stale' ? t('상함') : t('썩음')))
    if (masteryStage(w, player(w), 'survival') >= 5 && band === 'fresh' && rate > 0 && (f - 60) / rate <= 24) lines.push(t('곧 오래됨 — 생존 숙달로 변화를 알아챘다'))
  }
  if (d.drink && it) lines.push(...displayWaterLines(w, player(w), it))
  if(d.drink?.freshHours)lines.push(t('300ml당 비타민 {0} · 신선 기간 {1}시간 · 다 마시면 같은 물병이 남는다',d.drink.vitamin??0,d.drink.freshHours))
  if (d.drink) lines.push(t("수분 {0} ml{1}{2}{3}" ,d.drink.water,d.drink.dirty ? t(' · 더러움') : '',d.drink.alcohol ? t(' · 술 · 이뇨100ml') : '',d.drink.kcal ? ` · ${d.drink.kcal} kcal` : ''))
  if (d.medical) lines.push({ bandage: t('상처에 감아 출혈을 줄인다'), tourniquet: t('팔다리 동맥 출혈을 멈춘다 (2시간 안에 풀 것)'), splint: t('골절을 고정한다'), disinfect: t('상처를 소독한다'), suture: t('바늘과 함께 봉합한다. 동맥 결찰·힘줄 봉합은 의료 숙달3단계가 필요하다') }[d.medical.kind])
  if (d.light) lines.push(t("등불 반경 {0}{1}{2}" ,d.light.radius,it?.fuel !== undefined ? t(" · 연료 {0}시간" ,Math.round((it.fuel / 1200) * 10) / 10) : '',it?.lit ? t(' · 켜짐') : ''))
  if (d.book) lines.push(t("문해{0}단계{1} · 쪽당{2}턴{3}{4}{5}" ,d.book.literacyMin ?? 1,d.book.selfStudy ? t(' · 문맹도 독학 가능') : '',readingPageTurns(w,player(w)),d.book.literacyTo ? t(" · 온전한 완독으로 문해{0}단계" ,d.book.literacyTo) : '',d.book.identify?.length ? t(" · 정제 {0}종 식별" ,d.book.identify.length) : '',d.book.bestiary?.length ? t(" · 생물 {0}종 문헌 지식" ,d.book.bestiary.length) : ''), t("독서 {0}/{1}쪽{2}{3}{4}" ,it?.readPages ?? 0,d.book.pages,it?.lostPages ? t(" · 번진 쪽 {0}" ,it.lostPages) : '',d.book.amount ? t(" · {0} 숙달 +{1}회 (책 누계 최대 15)" ,d.book.mastery === 'medicine' ? t('의료') : t('생존'),d.book.amount) : '',d.book.unlocks?.length ? t(" · 제작법 {0}개" ,d.book.unlocks.length) : ''))
  if (it?.readProgress) lines.push(t("다음 쪽 진행 {0}턴 · 중단해도 보존" ,it.readProgress))
  if(d.cooking)lines.push(t('{0}{1}/{2}턴 → {3}',t(d.food?.emptyVessel?'실제 모닥불 바로 곁 조리 ':'불 2칸 내 조리 '),it?.cookProgress??0,d.cooking.turns,displayItemDefLabel(w.db.item(d.cooking.result))))
  if (d.place) {
    const place = w.db.terrain(d.place)
    lines.push(t("바라보는 쪽에 설치 → {0}" ,defText(place)))
    if(place.cultivation){const r=place.cultivation;lines.push(t("성장할 햇빛 {0}~{1}% · {2}~{3}°C · 한 회차 물 {4}ml" ,r.minLight*100,(r.maxLight??1)*100,r.minTemp,r.maxTemp,r.waterMl));if(r.minLight===0&&!place.gather?.soilDependent)lines.push(t('기온이 맞는 지하에서는 자리를 떠나도 남은 실제 물로 자란다.'));if(r.substrate)lines.push(t("실제 배지 {0}회 수확 · 소진 뒤 {1} 하나로 교체" ,r.substrate.cycles,displayItemDefLabel(w.db.item(r.substrate.item))))}
    if (place.bedding) lines.push(t("그 위에서 수면 질 {0}{1}{2}" ,place.bedding.quality.toFixed(2),place.bedding.insulation ? t(" · 수면 중 전신 단열 +{0} (품질·젖음 반영)" ,place.bedding.insulation) : '',place.bedding.portable ? t(' · F2에서 접어 회수') : ''), t("침구 젖음 {0}% · 그을음 {1}%" ,Math.round(it?.wetness?.torso ?? 0),Math.ceil(it?.beddingScorch??0)))
  }
  if(it?.beddingLice&&it.beddingLice.until>turnOf(w))lines.push(t('침구에 이 흔적이 있다. 실제 물로 세탁하고 몸도 별도로 씻어야 한다.'))
  const vessel=waterVesselForDef(d);if(vessel)lines.push(t('물 용기 용량 {0}ml · 물을 다 써도 같은 빈 용기를 남긴다',vessel.capacityMl))
  if (d.refuel) lines.push(t("등불 연료 +{0}시간" ,Math.round(d.refuel / 1200)))
  if(d.respirator)lines.push(t('남은 여과 {0}턴 · 실제 착용 중 재 먼지에서만 소모한다.',it?.uses??d.uses??0))
  else if(it?.uses!==undefined&&!d.drink?.emptyVessel)lines.push(t('남은 양 {0}',it.uses))
  if(it?.brokenRelic)lines.push(t('영구 파손 · 수리 불가'))
  if (it?.maxDurability !== undefined && it.maxDurability < 100) lines.push(t("수리 후 최대 내구 {0}% (영구 감소)" ,it.maxDurability.toFixed(1)))
  if (it?.durability !== undefined) { const b = durabilityBand(it.durability); lines.push(t("내구 {0}%{1}" ,Math.round(it.durability),t(b.label) ? ` — ${t(b.label)}` : '')) }
  lines.push(t("크기 {0}×{1}" ,d.size?.[0] ?? 1,d.size?.[1] ?? 1))
  if (d.description) lines.push(defText(d,'description'))
  return { title: it ? d.drink?.emptyVessel?defText(d)+' ['+drinkVolume(w,it)+'ml]':itemLabel(w, it) : defText(d), lines, color: rarityColor(d) }
}

const REGION_LABEL: Record<string, string> = { head: '머리', torso: '몸통', larm: '왼팔', rarm: '오른팔', lleg: '왼다리', rleg: '오른다리', neck: '목' }

/** 능력 툴팁 L2(Shift): 바꾸는 판정 공식 항 (15 §19 · 12) */
export function abilityFormula(d: AbilityDef): string[] {
  const out: string[] = []
  const m = d.attack
  if (m) {
    if (m.hitBonus) out.push(t('명중 = 50 + (공격치 − 회피치) × 2 + 수정 {0}{1}',m.hitBonus>0?'+':'',m.hitBonus))
    if (m.damageMult) out.push(t('피해 D = 기본 × 날 × 근력 × 팔 × (80 + r)% × {0}',m.damageMult))
    if (m.penBonus) out.push(t('관통 +{0} → 방어구 유효 = 실효 − 관통',m.penBonus))
    if (m.bleedMult) out.push(t('상처 출혈 = D × 유형계수 × 혈관계수 × {0} (동맥 고정값엔 곱하지 않음)',m.bleedMult))
    if (m.arterialBonus) out.push(t('동맥 판정(D ≥ 부위 HP 30%) = D × 2% + {0}%p',m.arterialBonus))
    if (m.fractureMult) out.push(t('골절 = (D − 뼈 강도) × 8% × {0}',m.fractureMult))
    if (m.stunBonus) out.push(t('머리 기절 판정 +{0}%p',m.stunBonus))
    if (m.armorDamage) out.push(t('맞은 방어구 내구 −{0}%p 추가',m.armorDamage))
    if (m.partWeights) out.push(t('부위 가중: {0}',Object.entries(m.partWeights).map(([k,v]) => `${t(REGION_LABEL[k]??k)} ×${v}`).join(' · ')))
    if (m.aoe) out.push(t(m.aoe==='adjacent'?'범위: 인접 8칸 모두':'범위: 앞 2칸 직선'))
    if (m.knockback) out.push(t('밀쳐내기 {0}칸',m.knockback))
    if (m.knockdownChance) out.push(t('넘어뜨림 {0}%',m.knockdownChance*100))
    if (m.aimed) out.push(t('조준형: 야행성이면 조명 감점 절반'))
  }
  if (d.stance) out.push(t('자세 {0}턴 (반응 phase 1: 같은 시각이면 먼저 움직인다){1}',d.stance.turns,d.stance.magnitude?t(' · 크기 {0}',d.stance.magnitude):''))
  if (d.self?.energyPct) out.push(t('기력 회복 최대치의 {0}%',d.self.energyPct*100))
  if (d.self?.painRelief) out.push(t('통증 −{0}%{1}',d.self.painRelief*100,d.self.turns?t(' ({0}턴)',d.self.turns):''))
  if (d.channel) out.push(t('채널 {0}턴 · 맞으면 끊기고 기력 절반 환급',d.channel))
  if (d.lunge) out.push(t('직선 {0}칸 이동 후 공격',d.lunge))
  if (d.sweep) out.push(t('연속 {0}칸 휩쓸기',d.sweep))
  out.push(...modLines(d.mods))
  return out
}

export function abilityTip(w: World, d: AbilityDef): { title: string; lines: string[] } {
  const lines = [t('{0} {1}단계 · {2}',treeName(d.tree),d.tier,t(d.kind === 'passive' ? '패시브' : d.kind === 'toggle' ? '전환' : '액티브'))]
  if (d.energy) lines.push(t('기력 {0}',d.energy))
  if (d.cooldown) lines.push(t('재사용 {0}턴',d.cooldown))
  if (d.weapon) lines.push(t('필요: {0}',t(SKILL_LABEL[d.weapon] ?? d.weapon)))
  lines.push(defText(d,'description'))
  lines.push(...modLines(d.mods))
  if (d.requires?.length) lines.push(t('선행: {0}',d.requires.map(r => defText(w.db.ability(r))).join(', ')))
  return { title: defText(d), lines }
}

export function treeName(tree: string): string {
  return t(({ blade: '도검', axe: '도끼', blunt: '둔기', spear: '창', archery: '활', survival: '생존', unique:'고유' } as Record<string, string>)[tree] ?? tree)
}

/** 부위 상태 색: 멀쩡·타박·부상·중상·불구 */
export const STATE_COLOR = ['#6f8a5a', '#b6a24e', '#c77a32', '#b2402c', '#4a1612']

/** 생존 일지·체온 막대가 같은 판정값을 보여 준다 (03 §15) */
export function temperatureTip(w: World, c: Creature): string[] {
  const s = thermalState(w, c)
  const delta = temperatureDelta(c, s)
  const act = { rest: '휴식', sleep: '수면', walk: '걷기', work: '작업', combat: '전투' }[s.activity]
  const lines = [
    t('심부 {0}°C · {1}{2}°C/10분 (현재 조건 유지 시)',c.needs.bodyTemp.toFixed(1),delta>=0?'+':'',delta.toFixed(2)),
    t('체감 {0}°C = 기온 {1} − 바람 {2} + 열원 {3} + 지붕 {4} − 젖음 {5}',s.feels.toFixed(1),s.air.toFixed(1),s.windChill.toFixed(1),s.heat,s.shelter,s.evaporation),
    t('전신 단열 {0} · 쾌적 {1}~{2}°C ({3})',s.insulation.toFixed(3),s.low.toFixed(1),s.high.toFixed(1),t(act)),
    t('내의 젖음 {0}% · 50% 이상이면 증발 냉각 −3°C',s.innerWetness.toFixed(0)),
  ]
  for (const it of Object.values(c.equip)) {
    if (!it?.wetness) continue
    const values = Object.values(it.wetness)
    if (values.some((v) => v > 0)) lines.push(t('{0} 젖음 {1}~{2}%',defText(itemDef(w,it)),Math.round(Math.min(...values)),Math.round(Math.max(...values))))
  }
  lines.push(t('35.0°C 저체온 · 32.0°C 위독 · {0}°C 열사병',(39.5-thirstBand(w,c).heatShift).toFixed(1)))
  return lines
}
