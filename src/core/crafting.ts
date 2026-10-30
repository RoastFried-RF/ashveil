import {residentHarvestOrigin} from './resident-cultivation'
import {mergeFoodWater} from './food-contamination'
import {cropHarvestContaminants} from './crop-contamination'
import {runItemLifecycleWorker,hasItemWorkerMethod,runItemMaterialWorker,type ScriptItemDebit} from './script-item'
import {runScriptHooks} from './script-hooks'
import {cultivationHarvestError} from './cultivation'
import {completeInteraction} from './interactions'
import {rememberLifeEvent} from './life-memories'
import {relicAppraisal} from './prosthetics'
import type {RngStream} from './rng'
import {gatherSeasonError,gatherSignature,gatherFireError} from './gather-state'
import {finishAnimalBrowse} from './wildlife'
import {gatherStockCount,takeGatherStock} from './gather-stock'
import {boiledMealQuote,consumeMealWater} from './boiled-meal'
import {batchStatus,preservationError,preservationSignature} from './preservation-state'
import {preparePreservation} from './preservation'
import { fluidCraftQuote, consumeCraftFluid } from './fluid-crafting'
import { diagonalBlocked } from './path'
import { towerSoilFertility } from './tower-consequences'
import { consumeMaterialPlan, materialCraftQuote, materialPlanPresent } from './material-crafting'
import { materialRecovery, receiveRecoveredMaterials } from './material-recovery'
import { baseCraftActive, recordBaseCraft } from './base-camp-state'
import { dirtyHands } from './hand-hygiene'
import { treatedWater, waterQuality,waterSafetyDef } from './water-state'
import { foodFreshness } from './food-state'
// 제작·수리·분해 (08 §4·7·8). 작업 중단은 진행을 보존하고 완료 때만 재료를 소비한다.
import { materialMixPenalty, primaryMaterial } from './materials'
import { averageArmorDurability } from './gear-state'
import { capacity } from './body'
import { clamp, log, player, rng, terrainAt, tileAt, turnOf, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb } from './geom'
import { addToBag, allItems, findItem, itemDef, makeItem, qualityOf, removeOne } from './items'
import { emitNoise } from './perception'
import { masteryStage, practice } from './skills'
import { fireWarmth } from './thermal'
import { effectiveStat, traitAdd } from './traits'
import type { WaterQuality, ItemInst, Creature, RecipeDef, Stats, WorkJob, MaterialSelection, Stuff } from './types'

/** 손 작업·모닥불 −10, 주변 작업장은 Def의 보정. 가장 좋은 사용 가능한 작업장을 쓴다. */
export function workshop(w: World, c: Creature, allowed?: string[]): { id: string; bonus: number } {
  let best = { id: fireWarmth(w, c) >= 15 && (!allowed || allowed.includes('campfire')) ? 'campfire' : 'hand', bonus: -10 }
  if (allowed && !allowed.includes(best.id)) best = { id: 'none', bonus: -10 }
  for (let y = c.pos.y - 1; y <= c.pos.y + 1; y++) for (let x = c.pos.x - 1; x <= c.pos.x + 1; x++) {
    if (x < 0 || y < 0 || x >= w.s.map.w || y >= w.s.map.h) continue
    const station = terrainAt(w, { x, y }).station
    if (station && (!allowed || allowed.includes(station.id)) && (best.id === 'none' || station.bonus > best.bonus) && hasLos(w, c.pos, { x, y })) best = station
  }
  return best
}

const TOOL_BONUS = [-5, 0, 3, 5, 8, 10]
function tool(w: World, c: Creature, tag: string) {
  return allItems(c).filter((it) => (it.durability ?? 100) > 0 && itemDef(w, it).toolTags?.includes(tag)).sort((a, b) => qualityOf(b) - qualityOf(a) || a.uid - b.uid)[0]
}
function toolsError(w: World, c: Creature, tags: string[] = []): string | null {
  const missing = tags.find((tag) => !tool(w, c, tag))
  return missing ? `도구가 필요하다: ${({ blade: '칼날', hammer: '망치', needle: '바늘', tongs: '집게' } as Record<string, string>)[missing] ?? missing}` : null
}
function toolBonus(w: World, c: Creature, tags: string[] = []) {
  const it = tags[0] ? tool(w, c, tags[0]) : undefined
  return it ? TOOL_BONUS[qualityOf(it)] : 0
}
function handPenalty(w: World, c: Creature) { return Math.floor(Math.max(0, 1 - capacity(w, c, 'manipulation')) * 10 + 1e-9) * 3 }
export function workScore(w: World, c: Creature, attr: keyof Stats, tags: string[] = [], maintenance = true, allowed?: string[], smithing = false): number {
  return (effectiveStat(w, c, attr) - 10) * 2 + traitAdd(w, c, maintenance ? 'repairBonus' : 'craftQ') + (smithing ? traitAdd(w, c, 'smithQ') : 0) + toolBonus(w, c, tags) + workshop(w, c, allowed).bonus - handPenalty(w, c)
}
export const cookingQualityBase=(w:World,c:Creature)=>25+workScore(w,c,'per',[],false,['campfire'])+masteryStage(w,c,'survival')*4
export function craftingQuality(w: World, c: Creature, r: RecipeDef, roll: number,stuff=w.db.item(r.output.item).stuffDefaults): number {
  return clamp(25 + workScore(w, c, r.primaryAttr, r.tools, false, r.stations, r.category === 'smithing') + (r.mastery ? masteryStage(w, c, r.mastery) * 4 : 0) + materialMixPenalty(stuff) + roll - 15, 0, 100)
}
export function qualityFromScore(q: number): number { return q < 20 ? 0 : q < 45 ? 1 : q < 65 ? 2 : q < 80 ? 3 : q < 95 ? 4 : 5 }

export function bindInputs(c: Creature, needs: { item: string; count: number }[]): WorkJob['inputs'] | null {
  const remaining = new Map<number, number>(), result: WorkJob['inputs'] = []
  for (const need of needs) {
    let count = need.count
    for (const it of c.bag.filter((i) => i.def === need.item&&!i.contents?.length).sort((a, b) => a.uid - b.uid)) {
      const used = remaining.get(it.uid) ?? 0, n = Math.min(count, it.count - used)
      if (n <= 0) continue
      result.push({ uid: it.uid, def: it.def, count: n }); remaining.set(it.uid, used + n); count -= n
      if (count === 0) break
    }
    if (count > 0) return null
  }
  // 같은 묶음이 여러 입력에 쓰여도 중복 소비하지 않는다.
  const merged = new Map<number, WorkJob['inputs'][number]>()
  for (const i of result) { const old = merged.get(i.uid); if (old) old.count += i.count; else merged.set(i.uid, { ...i }) }
  return [...merged.values()]
}
function hasInputs(c: Creature, inputs: WorkJob['inputs']) {
  return inputs.every((i) => c.bag.some((it) => it.uid === i.uid && it.def === i.def && it.count >= i.count&&!it.contents?.length))
}
function consumeInputs(c: Creature, inputs: WorkJob['inputs'],debits?:ScriptItemDebit[]) {
  for (const b of inputs) {
    const it = c.bag.find((i) => i.uid === b.uid)!
    debits?.push({uid:it.uid,item:it.def,countConsumed:b.count,usesConsumed:0,mlConsumed:0,gramsConsumed:0})
    it.count -= b.count
  }
  c.bag = c.bag.filter((it) => it.count > 0)
}
function receive(w: World, c: Creature, id: string, count: number, quality?: number, uses?: number, foodQ?: number, freshness?: number, foodState?: Pick<ItemInst, 'foodThawed' | 'foodWet' | 'foodLeftover' | 'foodBurnt'>, water?: WaterQuality,stuff?:Stuff,contaminantAsh?:number,originalVessel?:ItemInst,foodWater?:ItemInst['foodWater'],cropHarvest?:ItemInst['cropHarvest'],cartridge?:{case:ItemInst;wetness:number},workshopMade?:ItemInst['workshopMade']) {
  const it = originalVessel?structuredClone(originalVessel):cartridge?structuredClone(cartridge.case):makeItem(w, id, count)
  if(cartridge){if(cartridge.case.count>1)it.uid=w.s.nextId++;it.def=id;it.count=count;it.powderWetness=cartridge.wetness;it.gearAgedAt=turnOf(w);delete it.gx;delete it.gy;delete it.rot}
  if(originalVessel){it.foodVesselDef=it.def;it.def=id;it.count=count;delete it.gx;delete it.gy;delete it.rot;it.uses=w.db.item(id).food?.servings;it.foodSealed=true;delete it.contaminantAsh;delete it.foodWater;delete it.cropHarvest;delete it.workshopMade}
  if(stuff)it.stuff=structuredClone(stuff)
  if(cropHarvest)it.cropHarvest=structuredClone(cropHarvest)
  if(foodWater)it.foodWater=structuredClone(foodWater)
  if(contaminantAsh)it.contaminantAsh=contaminantAsh
  if (water) it.water = water
  if (quality !== undefined&&!originalVessel&&!cartridge) it.quality = quality
  if (foodQ !== undefined && itemDef(w, it).food) it.foodQ = foodQ
  if (freshness !== undefined && itemDef(w, it).food) { it.freshness = freshness;if(foodState){it.foodThawed=foodState.foodThawed;it.foodWet=foodState.foodWet;it.foodLeftover=foodState.foodLeftover;it.foodBurnt=foodState.foodBurnt} }
  if (uses !== undefined && itemDef(w, it).drink) it.uses = uses
  if(workshopMade)it.workshopMade=workshopMade
  const left = addToBag(w, c, it)
  if (left) tileAt(w, c.pos).items.push({ ...it, uid:c.bag.some(x=>x.uid===it.uid)?w.s.nextId++:it.uid, count: left, gx: undefined, gy: undefined, rot: undefined })
  return it
}

export function craftMaterialQuote(w:World,c:Creature,r:RecipeDef,selection?:MaterialSelection){return materialCraftQuote(w,c,r,bindInputs(c,r.inputs)??[],selection,workshop(w,c,r.stations).id)}
/** 동료는 자기 실제 재료로 충분하면 더 인출하지 않는다. 창고 견적은 작업장 이동 전에 계산한다. */
export function stockMaterialQuote(w:World,c:Creature,r:RecipeDef,stock:ItemInst[]){const fixed=bindInputs(c,r.inputs)??[],own=materialCraftQuote(w,c,r,fixed);return own.error?materialCraftQuote(w,{...c,bag:[...c.bag,...stock]},r,fixed):own}
export function craftError(w: World, c: Creature, r: RecipeDef,selection?:MaterialSelection): string | null {
  if (r.waterTreatment && c.bag.some((i) => r.inputs.some((b) => b.item === i.def) && itemDef(w, i).drink && (i.uses ?? 1) <= 0)) return '물이 든 병이 필요하다'
  if (!r.basic && !c.recipes?.includes(r.id)) return '아직 모르는 제작법이다'
  for (const [key, value] of Object.entries(r.minAttr ?? {})) if (c.stats[key as keyof Stats] < value) return '필요한 능력치가 부족하다'
  if (r.stations?.length && !r.stations.includes(workshop(w, c, r.stations).id)) return '알맞은 작업장이 필요하다'
  const environment=preservationError(w,c,r);if(environment)return environment
  const err = toolsError(w, c, r.tools)
  if (err) return err
  if (!bindInputs(c, r.inputs)) return '재료가 부족하다'
  const meal=boiledMealQuote(w,c,r);if(meal.error)return meal.error
  const fluid=fluidCraftQuote(w,c,r)
  if(fluid.error)return fluid.error
  const old=c.workJob
  if(old?.kind==='craft'&&old.recipe===r.id&&r.materialInputs?.length&&!old.materialPlan)return '제작법의 원재료 규칙이 바뀌었다. 작업을 취소하고 다시 시작해야 한다'
  if(old?.kind==='craft'&&old.recipe===r.id&&old.materialPlan){
    if(!materialPlanPresent(w,c,old.materialPlan,old.inputs))return '예약한 실제 원재료가 바뀌었다. 작업을 취소하고 다시 시작해야 한다'
    if(selection&&Object.keys(selection).length){const q=craftMaterialQuote(w,c,r,selection);if(q.error||JSON.stringify(q.plan)!==JSON.stringify(old.materialPlan))return '진행 중인 작업의 재질을 바꾸려면 먼저 취소해야 한다'}
  }else{const q=craftMaterialQuote(w,c,r,selection);if(q.error)return q.error}
  return null
}
export function craftTurns(w: World, c: Creature, r: RecipeDef, factor: number): number {
  const speed = r.category === 'cooking' ? 1 - masteryStage(w, c, 'survival') * 0.05 : 1
  return Math.max(1, Math.ceil(r.workTurns * factor * speed - 1e-9))
}
export function startCraft(w: World, c: Creature, id: string, factor: number,selection?:MaterialSelection): string | null {
  const r = w.db.get<RecipeDef>(id), err = craftError(w, c, r,selection)
  if (err) return err
  if (!Number.isFinite(factor) || factor > 4) return '몸 상태 때문에 작업할 수 없다'
  const old = c.workJob
  if (old?.kind === 'craft' && old.recipe === id) {
    if (!hasInputs(c, old.inputs)) return '작업 재료가 바뀌었다. 작업을 취소하고 다시 시작해야 한다'
  } else {
    c.workJob = { kind: 'craft', recipe: id, progress: 0, total: craftTurns(w, c, r, factor), inputs: bindInputs(c, r.inputs)!,...(r.boiledMeal?{mealPlan:boiledMealQuote(w,c,r).plan}:{}),...(r.evaporation?{fluidPlan:fluidCraftQuote(w,c,r).plan}:{}),...(r.materialInputs?.length?{materialPlan:craftMaterialQuote(w,c,r,selection).plan}:{}) }
  }
  c.activity = { kind: 'craft', label: r.label, total: c.workJob!.total, remaining: c.workJob!.total - c.workJob!.progress, woundCount: c.body.wounds.length }
  return null
}

export function repairPreview(w: World, c: Creature, uid: number) {
  const it = findItem(c, uid), d = it && itemDef(w, it).repair
  if (!it || !d || it.durability === undefined || it.brokenRelic || d.appraisalRequired&&(it.appraisal??0)<2) return null
  const current = it.partDurability && Object.keys(it.partDurability).length ? Math.min(...Object.values(it.partDurability)) : it.durability
  const score = workScore(w, c, d.attr, d.tools, true, d.station?[d.station]:undefined, primaryMaterial(w, it)?.category === 'Metal'), amount = clamp(30 + score, 10, 60)
  const max = it.maxDurability ?? 100, loss = Math.max(2, 10 - Math.floor(score / 5))
  const nextMax = max * (1 - loss / 100), field = workshop(w, c,d.station?[d.station]:undefined).bonus < 0
  const failureChance=d.relicRisk?clamp(d.relicRisk.base-relicAppraisal(w,c),d.relicRisk.min,d.relicRisk.max)/100:undefined
  return { score, amount, loss, nextMax, current, failureChance, next: Math.min(nextMax * (field ? 0.6 : 1), current + max * amount / 100), material: d.material, count: Math.ceil(d.unitsPer10 * amount / 10) }
}
export function salvagePreview(w: World, c: Creature, uid: number) {
  const it = findItem(c, uid), d = it && itemDef(w, it).salvage
  if (!it || !d) return null
  const score = workScore(w, c, d.attr, d.tools, true, undefined, primaryMaterial(w, it)?.category === 'Metal'), rate = clamp(35 + score, 10, 80)
  const outputs=materialRecovery(w,it,rate)
  if(outputs)return{score,rate,count:outputs.reduce((n,row)=>n+row.units+(row.remainder?1:0),0),material:outputs[0]?.item??d.material,outputs}
  return { score, rate, count: Math.floor(d.count * rate * (50 + (it.durability ?? 100) / 2) / 10000), material: d.material }
}

function repairAccessError(w:World,c:Creature,it:ItemInst):string|null{
 const d=itemDef(w,it).repair
 if(it.brokenRelic)return '영구 파손된 유물은 수리할 수 없다'
 if(d?.appraisalRequired&&(it.appraisal??0)<2)return '정확히 감정한 유물만 수리할 수 있다'
 if(d?.station&&workshop(w,c,[d.station]).bonus<0)return '장인 작업장 곁에서 수리해야 한다'
 return null
}
export function maintenanceError(w: World, c: Creature, kind: 'repair' | 'salvage', uid: number): string | null {
  const it = findItem(c, uid), def = it && itemDef(w, it), d = kind === 'repair' ? def?.repair : def?.salvage
  if (!it || !d) return '이 물건에는 할 수 없는 작업이다'
  if(kind==='salvage'&&it.contents?.length)return '가방의 내용물을 먼저 꺼내야 한다'
  if(kind==='repair'){const access=repairAccessError(w,c,it);if(access)return access}
  const err = toolsError(w, c, d.tools)
  if (err) return err
  if (kind === 'salvage' && !(salvagePreview(w, c, uid)?.count)) return '회수할 수 있는 재료가 없다'
  const preview = kind === 'repair' ? repairPreview(w, c, uid) : null
  if (kind === 'repair' && (!preview || preview.next <= preview.current)) return '지금 수리해도 상태가 좋아지지 않는다'
  if (preview && !bindInputs(c, [{ item: preview.material, count: preview.count }])) return '수리 재료가 부족하다'
  return null
}
export function startMaintenance(w: World, c: Creature, kind: 'repair' | 'salvage', uid: number, factor: number): string | null {
  if (!Number.isFinite(factor) || factor > 4) return '몸 상태 때문에 작업할 수 없다'
  const err = maintenanceError(w, c, kind, uid)
  if (err) return err
  const it = findItem(c, uid)!, def = itemDef(w, it), d = (kind === 'repair' ? def.repair : def.salvage)!
  const preview = kind === 'repair' ? repairPreview(w, c, uid) : null
  const inputs = bindInputs(c, preview ? [{ item: preview.material, count: preview.count }] : [])!
  if (c.workJob?.kind !== kind || c.workJob.target !== uid) c.workJob = { kind, target: uid, progress: 0, total: Math.max(1, Math.ceil(d.turns * factor)), inputs, repairResult: preview ? { restore: (it.maxDurability ?? 100) * preview.amount / 100, max: preview.nextMax, field: workshop(w, c,def.repair?.station?[def.repair.station]:undefined).bonus < 0, score: preview.score,...(preview.failureChance===undefined?{}:{failureChance:preview.failureChance}) } : undefined }
  if (!hasInputs(c, c.workJob.inputs)) return '작업 재료가 바뀌었다. 취소하고 다시 시작해야 한다'
  if (kind === 'repair' && repairConditionsWorse(w, c, c.workJob)) return '수리 조건이 나빠졌다. 원래 조건으로 돌아가거나 취소하고 다시 시작해야 한다'
  c.activity = { kind, uid, label: `${def.label} ${kind === 'repair' ? '수리' : '분해'}`, total: c.workJob.total, remaining: c.workJob.total - c.workJob.progress }
  return null
}

function repairConditionsWorse(w: World, c: Creature, job: WorkJob): boolean {
  const it = job.target !== undefined ? findItem(c, job.target) : undefined, d = it && itemDef(w, it).repair, p = job.repairResult
  if(it&&repairAccessError(w,c,it))return true
  if(p?.failureChance!==undefined&&(repairPreview(w,c,it!.uid)?.failureChance??Infinity)>p.failureChance)return true
  return !!(d && p && ((!p.field && workshop(w, c).bonus < 0) || (p.score !== undefined && workScore(w, c, d.attr, d.tools, true, d.station?[d.station]:undefined, primaryMaterial(w, it)?.category === 'Metal') < p.score)))
}

/** actions.activityStep이 남은 턴을 하나 줄인 뒤 호출한다. 입력 조건이 깨지면 일시 중단한다. */
export function workStep(w:World,c:Creature):boolean{
  const job=c.workJob,debits=c.alive&&w.s.creatures.includes(c)&&hasItemWorkerMethod(w,'onMaterialConsumed')?[]as ScriptItemDebit[]:undefined
  const done=workStepCore(w,c,debits)
  if(job&&done&&debits?.length){
    const recipe=job.recipe?w.db.get<RecipeDef>(job.recipe):undefined,details={reason:job.kind,stage:recipe?.passiveTurns?'preparation':'completion',...(recipe?{recipe:recipe.id}:{})}
    for(const debit of debits)runItemMaterialWorker(w,c,debit,details)
  }
  return done
}
function workStepCore(w: World, c: Creature,debits?:ScriptItemDebit[]): boolean {
  const job = c.workJob
  if (!job || !c.activity) return true
  if(job.baseOrder!==undefined&&!baseCraftActive(w,c)){c.activity=undefined;return true}
  const r = job.recipe ? w.db.get<RecipeDef>(job.recipe) : undefined
  const it = job.target !== undefined ? findItem(c, job.target) : undefined
  const d = it && (job.kind === 'repair' ? itemDef(w, it).repair : itemDef(w, it).salvage)
  const err = job.kind === 'repair' && repairConditionsWorse(w, c, job) ? '수리 작업장·도구·몸 상태가 나빠졌다' : !hasInputs(c, job.inputs) ? '재료가 없어졌다' : r ? craftError(w, c, r) : !it || !d ? '대상이 없어졌다' : toolsError(w, c, d.tools)
  if (err) { log(w, 'warn', `작업 중단: ${err}. 진행은 남아 있다.`); c.activity = undefined; return true }
  job.progress++
  if (r?.noise && job.progress % 10 === 0) emitNoise(w, c.pos, r.noise, c.id)
  if (c.activity.remaining > 0) return false
  const cartridgeSources=r?.cartridgeReload&&{case:job.inputs.find(i=>i.def===r.cartridgeReload!.case),powder:job.inputs.find(i=>i.def===r.cartridgeReload!.powder)}
  const cartridge=cartridgeSources&&{case:structuredClone(c.bag.find(i=>i.uid===cartridgeSources.case!.uid)!),wetness:c.bag.find(i=>i.uid===cartridgeSources.powder!.uid)!.powderWetness??0}
  const liquid = r && w.db.item(r.output.item).drink ? job.inputs.map((b) => c.bag.find((i) => i.uid === b.uid)).find((i) => i && itemDef(w, i).drink)?.uses : undefined
  const sourceWater = r?.waterTreatment ? job.inputs.map((b) => c.bag.find((i) => i.uid === b.uid)!).find((i) => itemDef(w, i).drink) : undefined
  const liquidQuality = sourceWater && r?.waterTreatment ? treatedWater(w, waterQuality(w, sourceWater), r.waterTreatment) : undefined
  const foodInputs = job.inputs.map((b) => c.bag.find((i) => i.uid === b.uid)!).filter((i) => itemDef(w, i).food)
  const freshness = Math.min(100, ...foodInputs.map(foodFreshness))
  const foodState = foodInputs.length ? { foodThawed: foodInputs.some((i) => i.foodThawed || i.foodFrozen) || undefined, foodWet: foodInputs.some((i) => i.foodWet) || undefined, foodLeftover: foodInputs.some((i) => i.foodLeftover) || undefined,foodBurnt:foodInputs.some(i=>i.foodBurnt)||undefined } : undefined
  const meal=job.mealPlan?consumeMealWater(w,c,job.mealPlan):undefined
  const sourceFoodWater=r&&(w.db.item(r.output.item).food||w.db.item(r.output.item).place&&w.db.terrain(w.db.item(r.output.item).place!).cultivation)?mergeFoodWater(job.inputs.map(input=>({water:c.bag.find(it=>it.uid===input.uid)!.foodWater,count:input.count})),r.output.count*(r.preservation?.vessel?(w.db.item(r.output.item).food?.servings??1):1)):undefined
  const heatedQuality=meal&&sourceFoodWater?treatedWater(w,sourceFoodWater.quality,'boil'):undefined
  const foodWater=heatedQuality?(heatedQuality.pathogen>0?{ml:sourceFoodWater!.ml,quality:heatedQuality}:undefined):sourceFoodWater
  const ingredientAshDelta=heatedQuality&&sourceFoodWater?(heatedQuality.ash-sourceFoodWater.quality.ash)/waterSafetyDef(w).ashDivisor*sourceFoodWater.ml/waterSafetyDef(w).exposureMl*r!.output.count:0
  const ashTotal=(meal?.ash??0)+ingredientAshDelta+job.inputs.reduce((n,input)=>n+(c.bag.find(it=>it.uid===input.uid)!.contaminantAsh??0)*input.count,0)+(job.fluidPlan?consumeCraftFluid(w,c,job.fluidPlan,debits):0)
  const contaminantAsh=r&&ashTotal>0?ashTotal/(r.output.count*(r.preservation?.vessel?(w.db.item(r.output.item).food?.servings??1):1)):undefined
  const processing=r&&preparePreservation(w,c,r,job.inputs)
  consumeInputs(c, job.inputs,debits)
  consumeMaterialPlan(w,c,job.materialPlan,debits)
  if (r) {
    const q = craftingQuality(w, c, r, rng(w, 'loot').int(0, 30),job.materialPlan?.stuff??w.db.item(r.output.item).stuffDefaults), quality = qualityFromScore(q)
    if (r.passiveTurns) {
      const batches = (w.s.map.batches ??= [])
      batches.push({ id: w.s.nextId++, recipe: r.id, readyAt: turnOf(w) + r.passiveTurns, pos: { ...c.pos }, quality, crafter: c.id, freshness,...(processing?{processing,foodQ:q}:{}), ...foodState,...(contaminantAsh?{contaminantAsh}:{}),...(foodWater?{foodWater}:{}),...(job.materialPlan?{stuff:structuredClone(job.materialPlan.stuff)}:{}) })
      log(w,'info',r.label+' 재료를 준비했다. '+(r.preservation?'실제 불과 바람·날씨가 맞는 동안 가공한다. 제작 창에서 진행과 중단 이유를 확인할 수 있다.':(r.passiveTurns/1200).toFixed(1)+'시간 뒤 작업장 곁에서 회수할 수 있다.'))
    } else {
      const out = receive(w, c, r.output.item, r.output.count, quality, liquid, q, freshness, foodState, liquidQuality,job.materialPlan?.stuff,contaminantAsh,meal?.vessel,foodWater,undefined,cartridge,job.residentWorkshop?.recipe===r.id?{worker:c.id,site:job.residentWorkshop.site,recipe:r.id,def:r.output.item,at:turnOf(w)}:undefined)
      if(meal){out.foodHeatedAt=turnOf(w);out.foodSaltGrams=meal.salt;delete out.foodSealed;out.foodAgedAt=turnOf(w)}
      if(job.residentWorkshop?.recipe===r.id)delete c.residentWorkshopOrder
      if (r.mastery) practice(w, c, r.mastery, `craft:${out.uid}`)
      if(r.interaction)completeInteraction(w,c,r.interaction,r.label+' 실제 완료')
      runScriptHooks(w,'onItemCrafted',{ownerId:c.id,recipe:r.id,item:out.def,uid:out.uid,count:r.output.count})
      runItemLifecycleWorker(w,'onCrafted',c,out,{recipe:r.id,count:r.output.count})
      log(w, 'good', cartridge?`${r.label} 완료: ${itemDef(w,out).label} ×${r.output.count}. 화약 젖음 ${(out.powderWetness??0).toFixed(1)}%.`:`${r.label} 완료: ${itemDef(w, out).label} ×${r.output.count} (품질 ${['조악', '보통', '좋음', '뛰어남', '명품', '전설'][quality]}, Q ${q}).`)
    }
  } else if (job.kind === 'repair' && it) {
    const p = job.repairResult!
    if(p.failureChance!==undefined&&rng(w,('items.relicRepair.'+it.uid)as RngStream).chance(p.failureChance)){
      it.durability=0;it.brokenRelic=true
      if(c.id===w.s.playerId||canSee(w,player(w),c.pos))log(w,'danger',itemDef(w,it).label+'이(가) 수리 도중 영구 파손됐다. 부품은 사용됐다.')
      recordBaseCraft(w,c);c.workJob=undefined;c.activity=undefined;return true
    }
    const before=it.durability??0
    if (it.partDurability) {
      for (const id of Object.keys(it.partDurability)) it.partDurability[id] = Math.min(p.max * (p.field ? .6 : 1), it.partDurability[id] + p.restore)
      averageArmorDurability(it)
    }
    it.maxDurability = p.max; it.durability = it.partDurability ? (it.durability ?? 0) : Math.min(p.max * (p.field ? 0.6 : 1), (it.durability ?? 0) + p.restore)
    if(itemDef(w,it).relic&&(it.durability??0)>before)rememberLifeEvent(w,c,'relicRepair')
    if((it.durability??0)>before)runItemLifecycleWorker(w,'onRepair',c,it,{before,after:it.durability??0})
    log(w, 'good', `수리 완료: 내구 ${it.durability.toFixed(1)} / 최대 ${p.max.toFixed(1)}. 최대 내구는 영구 감소했다.`)
  } else if (it) {
    const salvage = itemDef(w, it).salvage!, preview=salvagePreview(w,c,it.uid)!,count = preview.count
    debits?.push({uid:it.uid,item:it.def,countConsumed:1,usesConsumed:0,mlConsumed:0,gramsConsumed:0})
    removeOne(w, c, it.uid)
    if('outputs'in preview&&preview.outputs){receiveRecoveredMaterials(w,c,preview.outputs);log(w,'info',`분해 완료: ${preview.outputs.map(row=>`${w.db.get<import('./types').MaterialDef>(row.material).label} ${row.grams}g`).join(' · ')}.`)}
    else{if (count) receive(w, c, salvage.material, count);log(w, 'info', `분해 완료: ${w.db.item(salvage.material).label} ×${count}.`)}
  }
  recordBaseCraft(w,c)
  c.workJob = undefined; c.activity = undefined
  return true
}

export function nearbyGather(w: World, c: Creature) {
  const out: { x: number; y: number }[] = []
  for (let y = c.pos.y - 1; y <= c.pos.y + 1; y++) for (let x = c.pos.x - 1; x <= c.pos.x + 1; x++) {
    if (x >= 0 && y >= 0 && x < w.s.map.w && y < w.s.map.h && terrainAt(w, { x, y }).gather && gatherStockCount(w,{x,y})>0 && !cultivationHarvestError(w,{x,y}) && !gatherFireError(w,{x,y}) && !gatherSeasonError(w,terrainAt(w,{x,y})) && (!terrainAt(w,{x,y}).gather!.soilDependent||towerSoilFertility(w)>0) && (tileAt(w, { x, y }).gatherAt ?? 0) <= turnOf(w) && hasLos(w, c.pos, { x, y })&&!diagonalBlocked(w,c.pos,x-c.pos.x,y-c.pos.y)) out.push({ x, y })
  }
  return out
}
export function startGather(w: World, c: Creature, p: { x: number; y: number }, factor: number): string | null {
  if (cheb(p, c.pos) > 1 || !nearbyGather(w, c).some((o) => o.x === p.x && o.y === p.y)) return '지금 채집할 수 없는 곳이다'
  const def = terrainAt(w, p).gather!
  if (!Number.isFinite(factor) || factor > 4) return '몸 상태 때문에 작업할 수 없다'
  c.activity = { kind: 'gather', target: p, woundCount:c.body.wounds.length, remaining: Math.max(1, Math.ceil(def.turns * factor)), gatherRule:def.seasons?.length||def.ashDeposit?gatherSignature(w,p):undefined,label: `${w.db.item(def.item).label} 채집` }
  return null
}
export function finishGather(w: World, c: Creature) {
  const p = c.activity?.target
  if (!p || cheb(p, c.pos) > 1) return
  const def = terrainAt(w, p).gather
  if (!def || cultivationHarvestError(w,p) || gatherFireError(w,p) || gatherSeasonError(w,terrainAt(w,p)) || (tileAt(w, p).gatherAt ?? 0) > turnOf(w)) return
  const fertility=def.soilDependent?towerSoilFertility(w):1
  if(fertility<=0)return
  const count=Math.min(def.count,gatherStockCount(w,p));if(count<1)return
  if(c.activity?.animalForage){finishAnimalBrowse(w,c,p,fertility);return}
  dirtyHands(w, c)
  // 직접 먹지 않는 실제 재배 곡물도 관수에서 옮은 오염을 조리 재료까지 보존한다.
  const contamination=tileAt(w,p).cultivation||w.db.item(def.item).food?cropHarvestContaminants(w,p,def.count):{}
  const origin=w.db.item(def.item).food?residentHarvestOrigin(w,c,p):undefined
  receive(w,c,def.item,count,undefined,undefined,undefined,undefined,undefined,undefined,undefined,contamination.ash,undefined,contamination.water,origin)
  takeGatherStock(w,p,count,Math.ceil(def.regrowTurns/fertility))
  if(c.id===w.s.playerId||canSee(w,player(w),c.pos))log(w, 'info', `${w.db.item(def.item).label} ×${count}을(를) 모았다.`)
}


export function collectBatch(w: World, c: Creature, id: number): string | null {
  const batch = w.s.map.batches?.find((b) => b.id === id)
  if (!batch || cheb(batch.pos, c.pos) > 1) return '작업장 곁으로 가야 한다'
  const status=batchStatus(w,batch)
  if(status.remaining)return status.reason||'아직 가공이 끝나지 않았다'
  const r = w.db.get<RecipeDef>(batch.recipe)
  if(batch.processing&&preservationSignature(r)!==batch.processing.signature)return '제작법이 바뀌어 원래 가공 규칙을 확인해야 한다'
  const out = receive(w, c, r.output.item, r.output.count, batch.quality, undefined, batch.foodQ, batch.freshness, batch,undefined,batch.stuff,batch.contaminantAsh,batch.processing?.vessel,batch.foodWater)
  if (r.mastery && batch.crafter === c.id) practice(w, c, r.mastery, `craft:${out.uid}`)
  w.s.map.batches = w.s.map.batches!.filter((b) => b.id !== id)
  if(r.interaction)completeInteraction(w,c,r.interaction,r.label+' 실제 완성품 회수')
  log(w, 'good', `${r.label} 결과물을 회수했다.`)
  runScriptHooks(w,'onItemCrafted',{ownerId:c.id,recipe:r.id,item:out.def,uid:out.uid,count:r.output.count})
  runItemLifecycleWorker(w,'onCrafted',c,out,{recipe:r.id,count:r.output.count})
  return null
}
