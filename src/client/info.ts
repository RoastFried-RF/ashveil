// 툴팁 문구: 아이템·능력·수정치를 한국어로 풀어 쓴다

import { itemDef, itemLabel, type AbilityDef, type ItemDef, type ItemInst, type World } from '../core'

export const SLOT_LABEL: Record<string, string> = {
  head: '머리', chest: '몸', hands: '손', feet: '발', belt: '허리', back: '등', neck: '목',
  ring1: '반지', ring2: '반지', ring: '반지', main: '주무기', off: '보조',
}
const CAT_LABEL: Record<ItemDef['category'], string> = {
  weapon: '무기', apparel: '옷·방어구', shield: '방패', medical: '의료품', food: '음식', drink: '마실 것',
  drug: '약', tool: '도구', ammo: '탄약', misc: '잡동사니',
}
const DMG_LABEL: Record<string, string> = { cut: '베기', stab: '찌르기', blunt: '타격', bite: '물기', burn: '화상' }
const SKILL_LABEL: Record<string, string> = { blade: '도검', axe: '도끼', blunt: '둔기', spear: '창', archery: '활', unarmed: '맨손' }
export const MOD_LABEL: Record<string, string> = {
  maxHp: '최대 체력', hitBonus: '명중', evasion: '회피', bleedMult: '받는 출혈 ×', painMult: '통증 ×', stressResist: '스트레스 저항',
  hitBonus_blade: '도검 명중', hitBonus_axe: '도끼 명중', hitBonus_blunt: '둔기 명중', hitBonus_spear: '창 명중', hitBonus_archery: '활 명중',
  dmgVsBleeding: '출혈 중인 적 피해', fractureDealt: '골절 유발 ×', deflectHalf: '튕겨냄 강화', reachHit: '거리 유지 명중',
  rangePenaltyHalf: '거리 감점 절반', arrowRecover: '화살 회수', bandageBonus: '붕대 효과', treatSpeed: '처치 속도',
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
  lines.push(`${CAT_LABEL[d.category]}${d.slot ? ` · ${SLOT_LABEL[d.slot]}` : ''}${d.twoHanded ? ' · 양손' : ''}`)
  for (const a of d.attacks ?? []) {
    lines.push(`${a.label}: ${DMG_LABEL[a.damageType] ?? a.damageType} ${a.damage} · 관통 ${a.pen} · 정확도 +${a.accuracy} · 기력 ${a.energy}`)
  }
  if (d.attacks?.length) {
    const a = d.attacks[0]
    lines.push(`계열 ${SKILL_LABEL[a.family] ?? a.family}${a.reach ? ` · 리치 ${a.reach}` : ''}${a.bleedMult ? ` · 출혈 ×${a.bleedMult}` : ''}${a.stunD ? ` · 머리 기절 판정 D+${a.stunD}` : ''}${a.shortBlade ? ' · 잠든 대상 첫 타 ×2' : ''}`)
  }
  if (d.weapon) lines.push(`막기치 ${d.weapon.block} · 받아넘기기치 ${d.weapon.parry > 0 ? '+' : ''}${d.weapon.parry}`)
  if (it?.edge !== undefined) lines.push(`날 상태 ${Math.round(it.edge)}% (피해 ×${((60 + it.edge * 0.4) / 100).toFixed(2)})`)
  if (d.ranged) lines.push(`유효 사거리 ${d.ranged.effective ?? d.ranged.range} · 최대 ${d.ranged.range} · 탄약 ${w.db.item(d.ranged.ammo).label}`)
  if (d.shield) lines.push(`막기치 ${d.shield.block} · 흡수 ${d.shield.absorb} · 기력 4 + 피해/2`)
  if (d.apparel) {
    const ar = d.apparel.armor
    const parts = [`날 ${ar.sharp ?? 0}`, `타격 ${ar.blunt ?? 0}`, `열 ${ar.heat ?? 0}`]
    lines.push(`방어 ${parts.join(' / ')}${d.bulk ? ` · 둔중 ${d.bulk}` : ''}${d.apparel.noise ? ` · 걷기 소음 ${d.apparel.noise}` : ''}`)
    lines.push(`덮는 곳: ${d.apparel.groups.map((g) => GROUP_LABEL[g] ?? g).join(' · ')}`)
    lines.push(`단열 ${d.apparel.insulation}${d.apparel.waterproof ? ' · 방수' : ''}`)
  }
  lines.push(...modLines(d.mods))
  if (d.food) lines.push(`${d.food.kcal} kcal${d.food.raw ? ' · 날것' : ''}`)
  if (d.drink) lines.push(`수분 ${d.drink.water} ml${d.drink.dirty ? ' · 더러움' : ''}${d.drink.alcohol ? ' · 술' : ''}`)
  if (d.medical) lines.push({ bandage: '상처에 감아 출혈을 줄인다', tourniquet: '팔다리 동맥 출혈을 멈춘다 (2시간 안에 풀 것)', splint: '골절을 고정한다', disinfect: '상처를 소독한다' }[d.medical.kind])
  if (d.light) lines.push(`등불 반경 ${d.light.radius}${it?.fuel !== undefined ? ` · 연료 ${Math.round((it.fuel / 1200) * 10) / 10}시간` : ''}${it?.lit ? ' · 켜짐' : ''}`)
  if (d.refuel) lines.push(`등불 연료 +${Math.round(d.refuel / 1200)}시간`)
  if (it?.uses !== undefined) lines.push(`남은 양 ${it.uses}`)
  if (it?.durability !== undefined) lines.push(`내구 ${Math.round(it.durability)}%${it.durability <= 0 ? ' — 파손' : it.durability < 30 ? ' — 부서지기 직전' : it.durability < 60 ? ' — 닳음' : ''}`)
  lines.push(`크기 ${d.size?.[0] ?? 1}×${d.size?.[1] ?? 1}`)
  if (d.description) lines.push(d.description)
  return { title: it ? itemLabel(w, it) : d.label, lines, color: rarityColor(d) }
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
