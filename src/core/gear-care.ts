import {exposeFletching} from './fletching-state'
import { rainAcidity, weatherDef } from './climate-state'
// 08 §5: 날 마모·시위·재비 부식과 정비. 시계와 난수는 게임 상태만 쓴다.
import { clamp, log, rng, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { isRaining } from './environment'
import { armorPartsForBody, averageArmorDurability, bowProblem } from './gear-state'
import { quiverItems, allItems, findItem, itemDef, qualityInfo, removeOne, storedItems } from './items'
import { primaryMaterial, structuralDurability } from './materials'
import { fireWarmth } from './thermal'
import type { Activity, Creature, ItemInst, ItemDef } from './types'

export type GearCare = NonNullable<Activity['care']>
const LABEL: Record<GearCare, string> = { oil: '기름칠', wax: '밀랍칠', sharpen: '날 갈기', string: '시위 걸기', unstring: '시위 풀기' }
const TURNS: Record<GearCare, number> = { oil: 20, wax: 20, sharpen: 200, string: 6, unstring: 3 }
const MATERIAL: Partial<Record<GearCare, string>> = { oil: 'Item.LampOil', wax: 'Item.Wax' }
function stone(w: World, c: Creature) { return allItems(c).find((i) => itemDef(w, i).toolTags?.includes('whetstone') && (i.durability ?? 100) > 0) }
export function edgeLoss(w: World, it: ItemInst | undefined, loss: number) {
  if (!it || it.edge === undefined || itemDef(w, it).ranged) return
  const points = (it.edgeWear ?? 0) + loss * (150 - (primaryMaterial(w, it)?.hardness ?? 50)), n = Math.floor((points + 1e-9) / 100)
  it.edgeWear = points - n * 100
  it.edge = Math.max(0, it.edge - n)
}
export function gearCareError(w: World, c: Creature, uid: number, kind: GearCare): string | null {
  const it = findItem(c, uid), d = it && itemDef(w, it)
  if (!it || !d) return '정비할 물건이 없다'
  if (['wax', 'string', 'unstring'].includes(kind) && !d.ranged) return '활에만 할 수 있는 정비다'
  if (kind === 'oil' && primaryMaterial(w, it)?.category !== 'Metal') return '금속 장비에만 기름칠할 수 있다'
  if (kind === 'sharpen') {
    if (it.edge === undefined || d.ranged) return '갈 수 있는 날이 없다'
    if (it.edge >= ((it.rust ?? 0) >= 3 ? 70 : 100)) return '날이 충분히 서 있다'
    if (!stone(w, c)) return '쓸 수 있는 숫돌이 필요하다'
  }
  if (kind === 'unstring' && (it.bowUnstrung || it.bowBroken)) return '이미 풀렸거나 끊어진 시위다'
  if (kind === 'string' && !it.bowUnstrung && !it.bowBroken) return '이미 시위가 걸려 있다'
  const material = kind === 'string' && it.bowBroken ? 'Item.BowString' : MATERIAL[kind]
  if (material && !c.bag.some((i) => i.def === material)) return `${w.db.item(material).label}이(가) 필요하다`
  return null
}
export function startGearCare(w: World, c: Creature, uid: number, kind: GearCare, factor: number): string | null {
  const err = gearCareError(w, c, uid, kind)
  if (err) return err
  if (!Number.isFinite(factor) || factor > 4) return '몸 상태 때문에 정비할 수 없다'
  const n = Math.max(1, Math.ceil(TURNS[kind] * factor - 1e-9))
  c.activity = { kind: 'gearCare', uid, care: kind, remaining: n, total: n, label: `${itemDef(w, findItem(c, uid)!).label} ${LABEL[kind]}` }
  return null
}
export function gearCareStep(w: World, c: Creature): boolean {
  const act = c.activity
  if (!act?.care || act.uid === undefined) return true
  const err = gearCareError(w, c, act.uid, act.care)
  if (err) { log(w, 'warn', `${act.label} 중단: ${err}.`); c.activity = undefined; return true }
  if (act.remaining > 0) return false
  const it = findItem(c, act.uid)!, kind = act.care, turn = turnOf(w)
  const material = kind === 'string' && it.bowBroken ? 'Item.BowString' : MATERIAL[kind]
  if (material) removeOne(w, c, c.bag.find((i) => i.def === material)!.uid)
  if (kind === 'oil') it.oiledUntil = turn + 2 * TURNS_PER_DAY
  if (kind === 'wax') it.waxedUntil = turn + TURNS_PER_DAY
  if (kind === 'unstring') it.bowUnstrung = true
  if (kind === 'string') { if (it.bowBroken) it.bowMoisture = 0; it.bowUnstrung = false; it.bowBroken = false }
  if (kind === 'sharpen') { it.edge = (it.rust ?? 0) >= 3 ? 70 : 100; it.edgeWear = 0; const tool = stone(w, c)!; tool.durability = Math.max(0, (tool.durability ?? 100) - 1) }
  log(w, 'good', `${act.label} 완료.`)
  c.activity = undefined
  return true
}
/** 실제 발사 직전 한 번만. 끊어지면 화살은 남고 행동과 당기기 기력은 소모한다. */
export function bowStringBreaks(w: World, c: Creature, paid = false): boolean {
  const it = c.equip.main, d = it && itemDef(w, it)
  if (!it || !d?.ranged || bowProblem(it, d)) return false
  const chance = Math.floor(((it.bowMoisture ?? 0) - 60) / 2)
  if (chance <= 0 || !rng(w, 'combat').chance(chance / 100)) return false
  it.bowBroken = true
  if (!paid) c.needs.energy = Math.max(0, c.needs.energy - (d.attacks?.[0]?.energy ?? 6))
  log(w, 'warn', `${d.label}: 젖은 활시위가 끊어졌다! 화살은 남아 있다.`)
  return true
}
export function corrodeGear(w: World, it: ItemInst, amount: number, bodyId:string, cloak?:ItemDef['apparel']) {
  if(amount<=0)return
  const d = itemDef(w, it), max = (structuralDurability(w, it) ?? d.apparel?.durability ?? 100) * qualityInfo(it).dur
  if (d.apparel) {
    const parts = it.partDurability ??= {}, points = it.partCorrosion ??= {}, rust = it.partRust ??= {}
    for (const part of armorPartsForBody(w, bodyId, d)) {
      const id = part.id
      parts[id]??=it.durability??100
      const covered = cloak && cloak.layer > d.apparel.layer && part.groups.some((g) => cloak.groups.includes(g))
      const total = (points[id] ?? 0) + amount * (covered ? .2 : 1), loss = Math.floor((total + 1e-9) / 1000)
      points[id] = total - loss * 1000
      if (loss) { parts[id] = Math.max(0, parts[id] - loss * 100 / max); rust[id] = Math.min(3, (rust[id] ?? 0) + loss) }
    }
    it.rust = Math.max(0, ...Object.values(rust)); averageArmorDurability(it)
  } else {
    const total = (it.corrosion ?? 0) + amount, loss = Math.floor((total + 1e-9) / 1000)
    it.corrosion = total - loss * 1000
    if (loss) { it.durability = Math.max(0, (it.durability ?? 100) - loss * 100 / max); it.rust = Math.min(3, (it.rust ?? 0) + loss) }
    if ((it.rust ?? 0) >= 3 && it.edge !== undefined) it.edge = Math.min(70, it.edge)
  }
}
/** 실물 활시위는 소유자와 무관하게 같은 비·밀랍·건조·일일 탄성 규칙을 쓴다. */
export function ageBowWeather(w:World,it:ItemInst,exposed:boolean,heat:number,elapsed=1){
  if(elapsed<=0)return
  const turn=turnOf(w),outside=w.s.map.kind==='surface',wet=it.bowMoisture??0
  const waxTurns=clamp((it.waxedUntil??-Infinity)-(turn-elapsed)-1,0,elapsed),wax=waxTurns===elapsed?.3:waxTurns===0?1:1-.7*waxTurns/elapsed
  let delta=0
  if(outside&&(w.s.overworld?weatherDef(w).group!=='clear':w.s.weather!=='clear'))delta=exposed&&!it.bowUnstrung&&isRaining(w) ? .5*wax : 1/TURNS_PER_HOUR*wax
  else if(wet>0)delta=-(heat>=15?10:2)/200
  if(delta>0&&heat>=15)delta-=10/200
  if(delta||wet)it.bowMoisture=clamp(wet+delta*elapsed,0,100)
  const days=Math.floor(turn/TURNS_PER_DAY)-Math.floor((turn-elapsed)/TURNS_PER_DAY)
  if(days>0&&!it.bowUnstrung&&!it.bowBroken)it.elasticity=Math.max(0,(it.elasticity??100)-days)
}
export function gearTick(w: World, c: Creature,elapsed=1) {
  const turn = turnOf(w), outside = w.s.map.kind === 'surface', exposed = outside && !tileAt(w, c.pos).roof
  const rain = isRaining(w), equipped = Object.values(c.equip).filter((i): i is ItemInst => !!i)
  for (const it of storedItems(allItems(c))) {
    if(it.missingItem)continue
    const d = itemDef(w, it), held = equipped.includes(it)
    if(d.fletching)exposeFletching(w,it,exposed&&(held||quiverItems(c).includes(it)),elapsed)
    if(it.durability!==undefined||d.apparel||d.ranged||d.book||d.fletching)it.gearAgedAt=turn
    if(d.ranged)ageBowWeather(w,it,exposed&&held,fireWarmth(w,c),elapsed)
    if (!held || !exposed || !rain || it.durability === undefined) continue
    const m = primaryMaterial(w, it)
    const exposure=Math.max(0,Math.min(elapsed,turn-(it.oiledUntil??-Infinity)+1))
    const cloak=c.equip.back&&c.equip.back.uid!==it.uid?itemDef(w,c.equip.back).apparel:undefined
    if (m?.category === 'Metal') corrodeGear(w,it,exposure*(100 - m.corrosionResist) / 100 * (w.s.overworld ? weatherDef(w).corrosionMult * (1 + rainAcidity(w) / 5) : 1),c.body.def,cloak)
  }
}

