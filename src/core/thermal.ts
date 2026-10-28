import {infectionSystemic} from './infection-state'
import { inDeepWater } from './aquatic-state'
import { alcoholStage, drugEffects } from './drug-state'
import { regionalWindBonus, weatherWetPerTurn } from './climate-state'
// 체온 (03 §7.1~7.3): 영역별 의복 층·젖음, 활동, 바람과 열원.
import { clamp, tileAt, terrainAt, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import {lyingOnBedding, beddingAt,beddingWetness,setBeddingWetness } from './camping'
import { ambientTemp } from './environment'
import { cheb, type Pos } from './geom'
import { hasLos } from './fov'
import { apparelItems, itemDef, qualityInfo } from './items'
import { metabolicSize, nutritionDef } from './nutrition-state'
import { traitAdd } from './traits'
import type { BeddingContactDef, Creature, ItemDef, ItemInst, ThermalRegion } from './types'

export const THERMAL_TURNS = TURNS_PER_HOUR / 6
export const THERMAL_REGIONS: { id: ThermalRegion; group: string; weight: number }[] = [
  { id: 'torso', group: 'chest', weight: 0.45 },
  { id: 'arms', group: 'upperArm', weight: 0.15 },
  { id: 'legs', group: 'thigh', weight: 0.25 },
  { id: 'head', group: 'skull', weight: 0.10 },
  { id: 'hands', group: 'hand', weight: 0.025 },
  { id: 'feet', group: 'foot', weight: 0.025 },
]

interface Layer { it?: ItemInst; ap?: NonNullable<ItemDef['apparel']>; insulation: number; wet: number }
type Clothing = ReturnType<typeof apparelItems>

/** 바깥층부터. 대표 부위를 덮지 않는 장비는 그 영역을 따뜻하게 하지 않는다 */
function layers(w: World, c: Creature, region: typeof THERMAL_REGIONS[number], clothes: Clothing): Layer[] {
  const out: Layer[] = clothes.filter(({ def }) => def.apparel!.groups.includes(region.group))
    .map(({ it, def }) => ({ it, ap: def.apparel!, insulation: def.apparel!.insulation * qualityInfo(it).ins * (it.half ? 0.5 : 1), wet: it.wetness?.[region.id] ?? (it.wetness ? 0 : c.needs.wetness) }))
    .sort((a, b) => b.ap.layer - a.ap.layer)
  const d = w.db.creature(c.def)
  const base = d.insulation ?? (w.db.body(c.body.def).kind === 'humanoid' && region.id === 'legs' ? 1 : 0)
  // 맨살도 기록해 옷을 벗거나 갈아입어 젖음을 지우지 못하게 한다.
  out.push({ insulation: base, wet: c.needs.skinWetness?.[region.id] ?? c.needs.wetness })
  return out
}

const wetLoss = (L: Layer) => L.ap?.wetLoss ?? (L.ap?.waterproof ? 0 : 70)
const waterproof = (L: Layer) => clamp(L.ap?.waterproofPct ?? (L.ap?.waterproof ? 90 : 0), 0, 100)
const effectiveInsulation = (L: Layer) => L.insulation * (1 - L.wet * wetLoss(L) / 10000)

/** 03 §7.1 전신 영역 가중 단열. 장비 비교용 단순 합과 구별한다 */
export function insulation(w: World, c: Creature): number {
  const clothes = apparelItems(w, c)
  return THERMAL_REGIONS.reduce((sum, r) => sum + r.weight * layers(w, c, r, clothes).reduce((s, L) => s + effectiveInsulation(L), 0), 0)
}

export function hasWaterproof(w: World, c: Creature): boolean {
  return apparelItems(w, c).some(({ def }) => (def.apparel!.waterproofPct ?? (def.apparel!.waterproof ? 90 : 0)) > 0)
}

export type ThermalActivity = 'sleep' | 'rest' | 'walk' | 'work' | 'combat'
export function thermalActivity(w: World, c: Creature, sleeping = c.asleep || c.activity?.kind === 'sleep'): ThermalActivity {
  if(inDeepWater(w,c))return 'work'
  if (sleeping) return 'sleep'
  if (c.activity?.kind === 'travel') return w.s.map.vessel?'work':'walk'
  if (['pryContainer','excavate','respirator','waterRescue', 'beaconWork', 'boatCare', 'deviceWork', 'machineCare', 'craft', 'repair', 'salvage', 'gather', 'gearCare', 'water', 'collectSnow', 'breakIce', 'wash', 'washBedding', 'warm', 'packFurniture', 'fire', 'claimBase'].includes(c.activity?.kind ?? '')) return 'work'
  if (c.exerted) return 'combat'
  return c.movedTurn !== undefined && turnOf(w) - c.movedTurn <= 1 ? 'walk' : 'rest'
}
const ACTIVITY = { sleep: [3, 0], rest: [0, 0], walk: [-5, 3], work: [-8, 5], combat: [-12, 8] } as const

export function comfortMin(w: World, c: Creature, sleeping = c.asleep || c.activity?.kind === 'sleep'): number {
  return 18 - 2.5 * (insulation(w, c) + (sleeping ? beddingAt(w, c.pos).insulation : 0)) - traitAdd(w, c, 'coldComfort') + ACTIVITY[thermalActivity(w, c, sleeping)][0]
}

/** 지하·지붕 아래는 바람이 없다. wind는 기존 세계 상태의 풍속 벡터 */
export function windStrength(w: World, c: Creature): number {
  return w.s.map.kind === 'dungeon' || tileAt(w, c.pos).roof ? 0 : clamp(Math.max(Math.abs(w.s.wind.x), Math.abs(w.s.wind.y)) + regionalWindBonus(w), 0, 4)
}

/** 불은 벽을 넘어 따뜻하게 하지 않고, 여러 불의 보너스도 중첩하지 않는다 */
export function fireWarmth(w: World, c: Creature): number {
  let heat = 0
  for (const L of w.s.map.lights) {
    if (L.off || L.kind === 'torch') continue
    const d = cheb(L.pos, c.pos)
    if (d > 6 || !hasLos(w, c.pos, L.pos)) continue
    heat = Math.max(heat, d <= 2 ? 15 : d <= 4 ? 8 : 3)
  }
  const held = [c.equip.main, c.equip.off].reduce((n, it) => n + (it?.lit && (it.fuel ?? 0) > 0 ? itemDef(w, it).light?.warmth ?? 0 : 0), 0)
  return heat + held
}

export interface ThermalState {
  shiveringKcalFloor: number
  insulation: number; low: number; high: number; air: number; feels: number
  windChill: number; heat: number; shelter: number; evaporation: number; innerWetness: number
  activity: ThermalActivity
  fever?: number
  antipyretic?: number
  falseWarmth?: number
  alcoholHeatLoss?: number
}

/** 현재 입고 있는 실제 안쪽 층의 젖음. needs의 지난 갱신값에 의존하지 않는다. */
export function innerWetness(w: World, c: Creature): number {
  const clothes=apparelItems(w,c)
  return THERMAL_REGIONS.reduce((sum,r)=>{
    const ls=layers(w,c,r,clothes),inner=r.id==='legs'?ls[ls.length-1]:ls[ls.length-2]??ls[0]
    return sum+r.weight*inner.wet
  },0)
}

export function thermalState(w: World, c: Creature, sleeping = c.asleep || c.activity?.kind === 'sleep'): ThermalState {
  return measureThermal(w, c, sleeping, thermalActivity(w, c, sleeping))
}

/** 현재 옷·몸·날씨로 다른 행동/자리를 비교한다. 세계/몸/열 적산은 바꾸지 않는다.
 * 끝낸 활동의 건조 냉각·직전 보행·전투를 다음 휴식에 이월하지 않는다. */
export function projectThermalState(w: World, c: Creature, activity: ThermalActivity, pos: Pos = c.pos): ThermalState {
  const at = { ...c, pos, activity: undefined }
  return measureThermal(w, at, activity === 'sleep', inDeepWater(w, at) ? 'work' : activity)
}

function measureThermal(w: World, c: Creature, sleeping: boolean, activity: ThermalActivity): ThermalState {
  const clothes = apparelItems(w, c)
  let ins = 0, innerWetness = 0
  for (const r of THERMAL_REGIONS) {
    const ls = layers(w, c, r, clothes)
    ins += r.weight * ls.reduce((s, L) => s + effectiveInsulation(L), 0)
    // 기본 옷(바지)은 다리의 내의, 다른 영역은 가장 안쪽 장비(없으면 맨살).
    const inner = r.id === 'legs' ? ls[ls.length - 1] : ls[ls.length - 2] ?? ls[0]
    innerWetness += r.weight * inner.wet
  }
  const outer = layers(w, c, THERMAL_REGIONS[0], clothes)[0]
  const windChill = windStrength(w, c) * 2.5 * (1 - (outer.ap?.windproof ?? 0))
  const air = ambientTemp(w)
  const shelter = tileAt(w, c.pos).roof ? 3 : 0
  const heat = fireWarmth(w, c)
  const evaporation = innerWetness >= 50 ? 3 : 0
  if (sleeping) ins += beddingAt(w, c.pos).insulation
  const drug = drugEffects(w, c)
  const fever=Math.max(c.effects.find(e=>e.kind==='fever'&&e.untilTurn>turnOf(w))?.magnitude??0,infectionSystemic(w,c).targetTemp)
  return { antipyretic: drug.febrileCooling, falseWarmth: drug.coldAwareness, alcoholHeatLoss: alcoholStage(w, c) ? drug.heatLossMult > 1 ? drug.heatLossMult : 1.15 : 1, shiveringKcalFloor: -(nutritionDef(w).hunger.find((b) => !b.shivering)?.deficit ?? Infinity) * metabolicSize(w, c), insulation: ins, low: 18 - 2.5 * ins - traitAdd(w, c, 'coldComfort') + ACTIVITY[activity][0], high: 26 - 0.5 * ins - ACTIVITY[activity][1] + traitAdd(w, c, 'heatComfort'), air, feels: air - windChill + heat + shelter - evaporation - (c.activity?.kind === 'dry' ? 2 : 0), windChill, heat, shelter, evaporation, innerWetness, activity, fever: fever>37?fever:undefined }
}

/** 1턴의 노출. 얕은 물은 하체만, 비는 겹친 층의 방수를 차례로 거친다 */
export function wetnessTick(w: World, c: Creature, sleeping=c.asleep||c.activity?.kind==='sleep',elapsed=1,environmentOnly=false) {
  const clothes = apparelItems(w, c)
  const skin = (c.needs.skinWetness ??= Object.fromEntries(THERMAL_REGIONS.map((r) => [r.id, c.needs.wetness])))
  const wetting = w.s.map.kind === 'surface' && !tileAt(w, c.pos).roof ? weatherWetPerTurn(w)*elapsed : 0
  const terrain = terrainAt(w, c.pos), water = c.flight||tileAt(w, c.pos).icy && (tileAt(w, c.pos).iceHoleUntil ?? 0) <= turnOf(w) ? undefined : terrain.water
  const drying = ((fireWarmth(w, c) >= 15 ? 10 : 2) + windStrength(w, c) + (c.activity?.kind === 'dry' ? 3 : 0))*elapsed / THERMAL_TURNS
  // 옛 세이브의 단일 젖음 값을 한 번만 옮긴다. 이후 벗은 옷도 자기 젖음을 보관한다.
  for (const { it } of clothes) it.wetness ??= Object.fromEntries(THERMAL_REGIONS.map((r) => [r.id, c.needs.wetness]))
  for (const it of c.bag) if (itemDef(w, it).book && water === 'deep') it.wetness = { torso: 100 }
  let innerWetness = 0
  for (const r of THERMAL_REGIONS) {
    let seep = wetting
    const ls = layers(w, c, r, clothes)
    const immersed = water === 'deep' || (water === 'shallow' && (!c.alive||r.id === 'legs' || r.id === 'feet'))
    for (const L of ls) {
      let wet = immersed ? 100 : clamp(L.wet + (wetting > 0 ? seep : -drying), 0, 100)
      if (terrain.id.includes('Mud') && (r.id === 'legs' || r.id === 'feet')) wet = Math.max(wet, r.id === 'feet' ? 50 : 30)
      if (c.alive&&!environmentOnly&&c.needs.bodyTemp > 37.5 && (L === ls[ls.length - 1] || L === ls[ls.length - 2])) wet = clamp(wet + 2*elapsed / THERMAL_TURNS, 0, 100)
      if (L.it) L.it.wetness![r.id] = wet
      else skin[r.id] = wet
      L.wet = wet
      seep *= 1 - waterproof(L) / 100
    }
    const inner = r.id === 'legs' ? ls[ls.length - 1] : ls[ls.length - 2] ?? ls[0]
    innerWetness += r.weight * inner.wet
  }
  // 서 있는 것만으로 침구에 닿지 않는다. 실제로 누운 몸/최외곽 옷과만 천천히 교환한다.
  const bed=tileAt(w,c.pos)
  if(terrain.bedding&&(sleeping||lyingOnBedding(w,c))){
    const rate=Math.min(1,w.db.get<BeddingContactDef>('BeddingContact.Hearth').exchangePerHour*elapsed/TURNS_PER_HOUR),bedWet=beddingWetness(bed)
    let transferred=0
    for(const r of THERMAL_REGIONS){
      const outer=layers(w,c,r,clothes)[0],delta=(bedWet-outer.wet)*rate,wet=clamp(outer.wet+delta,0,100)
      transferred+=(wet-outer.wet)*r.weight
      if(outer.it)outer.it.wetness![r.id]=wet;else skin[r.id]=wet
    }
    setBeddingWetness(bed,bedWet-transferred)
    innerWetness=THERMAL_REGIONS.reduce((sum,r)=>{const ls=layers(w,c,r,clothes),inner=r.id==='legs'?ls[ls.length-1]:ls[ls.length-2]??ls[0];return sum+r.weight*inner.wet},0)
  }
  c.needs.wetness = clamp(innerWetness, 0, 100)
}

/** 03 §7.2: 현재 조건이 10분 지속될 때의 체온 변화. 난수·실시간과 무관 */
export function temperatureDelta(c: Creature, s: ThermalState): number {
  if (s.feels < s.low) {
    const shivering = c.needs.bodyTemp <= 36.5 && c.needs.bodyTemp >= 32 && c.needs.kcal > s.shiveringKcalFloor
    let loss = Math.max(0, s.low - s.feels - (shivering ? 4 : 0)) * 0.02
    loss *= s.alcoholHeatLoss ?? (c.effects.some((e) => e.kind === 'alcohol') ? 1.15 : 1)
    return -loss
  }
  if (s.feels > s.high) return (s.feels - s.high) * 0.02
  const feverTarget = s.fever ?? 37
  const target = feverTarget > 37 ? Math.max(37, feverTarget - (s.antipyretic ?? 0)) : feverTarget
  return clamp(target - c.needs.bodyTemp, -0.1, 0.1)
}

/** 매 턴 노출을 합산해 200턴마다 반영. 직전 한 턴만 걸어 10분치 열을 얻지 못한다 */
export function temperatureTick(w: World, c: Creature, s: ThermalState) {
  const n = c.needs
  const limits=w.db.creature(c.def).temperatureLimits
  if(limits){n.bodyTemp+=(s.air-n.bodyTemp)*.01;return}
  const fixed = w.db.creature(c.def).fixedBodyTemp
  if (fixed !== undefined) { n.bodyTemp = fixed; return }
  const acc = (n.thermal ??= { turns: 0, delta: 0 })
  acc.delta += temperatureDelta(c, s) / THERMAL_TURNS
  acc.turns++
  if (acc.turns < THERMAL_TURNS) return
  n.bodyTemp = clamp(n.bodyTemp + acc.delta, 20, 44)
  acc.turns = 0
  acc.delta = 0
}
