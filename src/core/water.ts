import {completeInteraction,witnessInteraction} from './interactions'
import {boilHeatPresent,boilSignature,waterBoilQuote} from './boil-state'
import { recordResidentUse } from './world-simulation'
import { mapWorlds } from './journey'
// 병원체/재가 분리된 음수·정수와 시간 정산.
import { bodyDef, capacity, isMissing } from './body'
import { exposeDisease } from './conditions'
import { clamp, inBounds, log, tileAt, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import { cheb, DIRS, type Pos } from './geom'
import { hasLos } from './fov'
import { diagonalBlocked } from './path'
import { allItems, findItem, removeOne, removeStack } from './items'
import { practice } from './skills'
import { fireWarmth } from './thermal'
import { treatedWater, waterQuality, waterSafetyDef, waterSalinity, WATER_TREATMENT_LABEL } from './water-state'
import {waterBatches,waterResourcePlan,waterResourceValid,waterTreatmentSignature} from './water-state'
import {isWaterVessel,waterCapacity,waterVessel,waterVesselForm} from './water-vessels'
import type { Creature, ItemInst, WaterQuality, WaterTreatment } from './types'

export function drinkContaminants(w: World, c: Creature, q: WaterQuality, volume: number) {
  if (volume <= 0) return
  const d = waterSafetyDef(w)
  if (q.ash > 0) c.needs.ash = clamp(Math.round(((c.needs.ash ?? 0) + q.ash / d.ashDivisor * volume / d.exposureMl) * 10000) / 10000, 0, 100)
  if (q.pathogen <= 0 && !c.needs.waterExposure?.ml) return // 새 노출 없는 안전한 물은 난수를 소비하지 않는다.
  const exposure = c.needs.waterExposure ??= { ml: 0, pathogenMl: 0 }
  for (let left = volume; left > 0;) {
    const take = Math.min(left, d.exposureMl - exposure.ml)
    exposure.ml += take; exposure.pathogenMl += q.pathogen * take; left -= take
    if (exposure.ml < d.exposureMl) continue
    const chance = Math.min(1, exposure.pathogenMl / d.exposureMl * d.pathogenRisk)
    if (chance > 0 && exposeDisease(w, c, d.disease, chance) && c.faction === 'player') c.history.push({ turn: turnOf(w), kind: 'disease', text: '오염된 물에 노출됨' })
    exposure.ml = 0; exposure.pathogenMl = 0
  }
}
export function nearbyWater(w: World, c: Creature, source?: Pos): { pos: Pos; quality: WaterQuality } | null {
  const positions = source ? [source] : [{ x: 0, y: 0 }, ...DIRS].map((dir) => ({ x: c.pos.x + dir.x, y: c.pos.y + dir.y }))
  for (const pos of positions) {
    if (!inBounds(w, pos) || cheb(c.pos, pos) > 1 || !hasLos(w, c.pos, pos) || diagonalBlocked(w, c.pos, pos.x - c.pos.x, pos.y - c.pos.y)) continue
    const tile = tileAt(w, pos), terrain = w.db.terrain(tile.t)
    if (!terrain.water || (tile.icy || terrain.icy) && (tile.iceHoleUntil ?? 0) <= turnOf(w)) continue
    const d = waterSafetyDef(w), q = { ...(d.sources[terrain.waterSource ?? 'pond'] ?? d.sources.pond) }
    if (w.s.creatures.some((o) => !o.alive && cheb(o.pos, pos) <= 3)) q.pathogen += d.corpsePathogen
    return { pos, quality: q }
  }
  return null
}
export function waterDaily(w: World, c: Creature) {
  const n = c.needs, d = waterSafetyDef(w)
  if ((n.ash ?? 0) >= d.kidneyAt) {
    for (const id of d.kidneys) if (bodyDef(w, c).parts.some((p) => p.id === id) && !isMissing(w, c, id)) {
      const damaged = c.body.organDamage ??= {}
      damaged[id] = Math.min(c.body.maxHp[id], (damaged[id] ?? 0) + d.kidneyDamage)
    }
    if (c.faction === 'player') log(w, 'danger', '쌓인 재가 신장을 손상시켰다. 재가 적은 물이 필요하다.')
  }
  if (n.ash) n.ash = Math.max(0, Math.round((n.ash - d.ashDaily) * 10000) / 10000)
}
export function waterTreatmentError(w: World, c: Creature, it: ItemInst | undefined, method: WaterTreatment): string | null {
  if (!it || !isWaterVessel(w,it) || it.count!==1 || (it.uses ?? 0) <= 0) return '물이 든 실제 물 용기 하나가 필요하다'
  const d = waterSafetyDef(w).treatments[method],batches=method==='settle'?1:waterBatches(w,it)
  if (it.waterFrozen && method !== 'boil') return '먼저 불에서 눈이나 얼음을 녹여야 한다'
  if (method === 'boil' && fireWarmth(w, c) < 15) return '불에서2칸 안으로 가야 한다'
  if (d.fuel && !waterResourcePlan(c,d.fuel,batches)) return '실제 물량을 끓일 연료가 부족하다'
  if (d.tool && !waterResourcePlan(c,d.tool,batches,true)) return `${w.db.item(d.tool).label}의 실제 물량에 맞는 잔량이 필요하다`
  return null
}
export function startWaterTreatment(w: World, c: Creature, uid: number, method: WaterTreatment, factor: number): string | null {
  const it = findItem(c, uid), err = waterTreatmentError(w, c, it, method)
  if (err) return err
  const d = waterSafetyDef(w).treatments[method]
  if (method === 'settle') {
    it!.waterSettlesAt = turnOf(w) + d.turns
    removeStack(c, uid); it!.gx = undefined; it!.gy = undefined; tileAt(w, c.pos).items.push(it!)
    if (c.faction === 'player') log(w, 'info', '물병을 바닥에 두었다. 여섯 시간 동안 흔들지 않으면 재가 가라앉는다.')
    return null
  }
  if(method==='boil'){
    const q=waterBoilQuote(w,c,uid,factor);if(q.error)return q.error
    const job=c.boilJob??{uid,remaining:q.turns,total:q.total,sourceDef:it!.def,uses:it!.uses??1,quality:structuredClone(q.quality!),signature:boilSignature(w,it),fuelUid:q.fuel?.uid,toolUid:q.tool?.uid,heat:q.heat!,...(q.batches>1?{batches:q.batches,fuels:q.fuels,tools:q.tools}:{})}
    c.boilJob=job;c.activity={kind:'water',remaining:job.remaining,total:job.total,label:'물 끓임',uid,toolUid:job.toolUid,waterTreatment:method,waterUses:job.uses,waterQuality:structuredClone(job.quality)}
    return null
  }
  const batches=waterBatches(w,it!),tools=waterResourcePlan(c,d.tool,batches,true),tool=tools?.length?c.bag.find(i=>i.uid===tools[0].uid):undefined
  const turns = Math.max(1, Math.ceil(d.turns * batches * factor))
  c.activity = { kind: 'water', remaining: turns, total: turns, label: `물 ${WATER_TREATMENT_LABEL[method]}`, uid, toolUid: tool?.uid, waterTreatment: method, waterUses: it!.uses, waterQuality: structuredClone(waterQuality(w, it!)),...(batches>1?{waterBatches:batches,waterTools:tools,waterSignature:waterTreatmentSignature(w,it,method)}:{}) }
  return null
}
export function waterStep(w: World, c: Creature): boolean {
  const act = c.activity!, method = act.waterTreatment!, it = findItem(c, act.uid ?? -1), d = waterSafetyDef(w).treatments[method]
  const tool = act.toolUid === undefined ? undefined : c.bag.find((i) => i.uid === act.toolUid)
  const q = it && waterQuality(w, it)
  const job=method==='boil'?c.boilJob:undefined,batches=job?.batches??act.waterBatches??1
  const fuels=job?.fuels??(job?.fuelUid!==undefined?[{uid:job.fuelUid,count:batches}]:waterResourcePlan(c,d.fuel,batches)),tools=job?.tools??act.waterTools??(tool?[{uid:tool.uid,count:batches}]:undefined)
  const err = waterTreatmentError(w, c, it, method) || (act.waterSignature&&act.waterSignature!==waterTreatmentSignature(w,it,method)?'원래 물량이나 정수 규칙이 바뀌었다':null) || (job&&(!boilHeatPresent(w,c,job.heat)||job.uid!==act.uid||job.sourceDef!==it?.def||job.signature!==boilSignature(w,it)||JSON.stringify(job.quality)!==JSON.stringify(q)||!waterResourceValid(c,d.fuel,fuels,batches))?'원래 물·연료·열원이나 끓이기 규칙이 바뀌었다':null)
  if (err || !it || it.uses !== act.waterUses || q!.pathogen !== act.waterQuality?.pathogen || q!.ash !== act.waterQuality?.ash || waterSalinity(q!) !== waterSalinity(act.waterQuality!) || !waterResourceValid(c,d.tool,tools,batches,true)) {
    if (c.faction === 'player') log(w, 'warn', `정수 중단: ${err ?? '쓰던 물이나 도구가 바뀌었다'}.`)
    c.activity = undefined; return true
  }
  if(job)job.remaining=Math.max(0,act.remaining)
  if (act.remaining > 0) return false
  if (d.fuel) {
    recordResidentUse(w,c,d.fuel,batches);for(const fuel of fuels!)for(let n=0;n<fuel.count;n++)removeOne(w,c,fuel.uid)
  }
  for(const reserved of tools??[]){const item=c.bag.find(i=>i.uid===reserved.uid)!;if(item.uses!==undefined){item.uses-=reserved.count;if(!item.uses)removeOne(w,c,item.uid)}else for(let n=0;n<reserved.count;n++)removeOne(w,c,item.uid)}
  it.water = treatedWater(w, q!, method); delete it.waterSettlesAt; if (method === 'boil') delete it.waterFrozen
  waterVesselForm(w,it,it.water)
  if (method === 'boil') practice(w, c, 'survival', `boil:${it.uid}:${turnOf(w)}`)
  const event=({boil:'waterBoil',cloth:'waterCloth',charcoal:'waterCharcoal',settle:'waterSettle',pill:'waterPill'}as const)[method]
  completeInteraction(w,c,event,c.name+'의 실제 물 '+WATER_TREATMENT_LABEL[method]+' 완료')
  if (c.faction === 'player') log(w, 'good', `물 ${WATER_TREATMENT_LABEL[method]} 완료. 병원체와 재는 서로 다른 오염이다.`)
  c.activity = undefined;if(method==='boil')c.boilJob=undefined
  return true
}
/** 침전은 내려놓은 병만 정산한다. 가방으로 옮기면 흔들려 다시 시작해야 한다. */
export function waterTick(w: World) {
  const now = turnOf(w)
  if (now % TURNS_PER_HOUR) return
  const settle = (local:World,pos:Pos,it: ItemInst,observed=true) => {
    if (!it.waterSettlesAt || it.waterSettlesAt > now) return
    it.water = treatedWater(local, waterQuality(local, it), 'settle'); delete it.waterSettlesAt
    if(observed)witnessInteraction(local,'waterSettle',pos,'원래 물병의 실제 침전 완료')
  }
  for (const local of mapWorlds(w)) for (let i=0;i<local.s.map.tiles.length;i++) {const tile=local.s.map.tiles[i]!,pos={x:i%local.s.map.w,y:Math.floor(i/local.s.map.w)};tile.items.forEach(it=>settle(local,pos,it));tile.cont?.items.forEach(it=>settle(local,pos,it,tile.cont!.opened)) }
  for (const local of mapWorlds(w)) for (const c of local.s.creatures) for (const it of allItems(c)) if (it.waterSettlesAt) delete it.waterSettlesAt
}

export function fillWaterBottle(w:World,c:Creature,uid:number,pos?:Pos):string|null{
 if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'manipulation')<.2)return '물병을 채울 손을 쓸 수 없다'
 const it=findItem(c,uid)
 if(!it||!isWaterVessel(w,it)||it.count!==1)return '담을 실제 물 용기가 없다'
 const source=nearbyWater(w,c,pos);if(!source)return '물이 없다'
 const unit=w.db.item(it.def).drink!.water,uses=waterCapacity(w,it)/unit,old=(it.uses??0)>0
 const form=waterVessel(w,it)!.dirty;it.water={...source.quality};it.def=form;it.uses=uses;delete it.waterSettlesAt;delete it.waterFrozen
 if(c.faction==='player')log(w,'info',`${old?'남은 물을 버리고 ':''}${source.quality.source??'물'}을(를) 용기에 채웠다.`)
 return null
}
