import {decideCrawler} from './crawlers'
import {decideSower} from './sower'
import {firearmReady,firearmSupply} from './firearms'
import {decideWildlife} from './wildlife'
import {decideSurveyor} from './surveyor'
import {throwQuote} from './throwing'
import {residentCropSupplyDecision} from './resident-crop-supplies'
import {residentProduceDecision} from './resident-produce'
import {residentCultivationDecision} from './resident-cultivation'
import {residentCookingDecision} from './resident-cooking'
import {npcCareAction} from './npc-care'
import {scriptAITargetScores} from './script-ai'
import {activeEscort,contractEscortGoal} from './escort-contracts'
import {npcSocialAction} from './npc-social'
import {observeNpcPrisoners} from './prisoner-witnesses'
import {npcAbductionAction} from './npc-abduction'
import {placePatrolWait} from './place-event-rules'
import {scriptPlaceActorReturned} from './script-hooks'
import {npcWorldCartographyAction} from './npc-world-cartography'
import {animalRememberedThreats,animalFearRules,expireAnimalFear} from './animal-fear'
import {npcFireResponse,knownFireDanger} from './fire-avoidance'
import {npcNoteAction} from './note-reading'
import {npcCartographyAction} from './npc-cartography'
import {breakdownAction} from './psyche'
import {readyFood} from './open-food-state'
import {privateSound} from './hallucination-state'
import {urgentWaterLanding} from './boat-flood'
import {worldRaidDecision} from './world-raids'
import { caravanExitFor } from './caravans'
import { drinkableSalinity, suitableDrink } from './water-state'
import { dispatchKinship, kinLightThreat } from './kinship'
import { noticeKinFlee, returningKin } from './kinship-state'
import { baseRaidGoal, noticeBase } from './base-defense'
import { machineReady, machineRules } from './machine-state'
import { npcCustodyAction } from './npc-custody'
import { prisonerSleepAction } from './prisoner-care'
import { struggleQuote } from './prisoner-escape'
import { escortGoal } from './prisoner-escort'
import { rescueActive, rescueDef } from './rescue-state'
import { companionDef, isCompanion } from './companion-state'
import { mercyActive, prisonerCareDef } from './prisoner-state'
import { companionDecision } from './companions'
import { delayResidentWarmth, residentWarmthDef, residentWarmthGoal, warmthError } from './resident-warmth'
import { beddingMoveDef, beddingSiteAvailable, delayResidentBedding, furnitureQuote, residentBeddingGoal, residentBeddingSites } from './bedding-move'
import { clinicSupplyGoal, delayClinicSupply } from './clinic-supply'
import { delayResidentRest, residentBedAt, residentRestGoal, residentSleepFoodTarget } from './resident-rest'
import { delayResidentSupply, residentProvisionGoal } from './resident-provisions'
import { delayResidentWater, residentDrink, residentWaterDef, residentWaterGoal, residentNeedsDrink } from './resident-water'
import {delayResidentHygiene,observeResidentHygiene,residentHygieneGoal,residentHygieneSupply} from './resident-hygiene'
import {beddingWashQuote} from './bedding-lice'
import {residentVesselGoal} from './resident-vessels'
import { delayResidentPurification, residentPurificationGoal } from './resident-purification'
import { nearbyWater, waterTreatmentError } from './water'
import { handState, washHandsError } from './hand-hygiene'
import { knownCreatureName } from './bestiary-state'
// 적 AI: 무리 사냥꾼(재늑대), 약탈자, 겁많은 쥐. 같은 규칙 아래에서 판단한다.

import { hostile, multiTurnFactor, type Action } from './actions'
import { abilityReady } from './abilities'
import { capacity, energyMax, hpMax, partDamage, regionState, totalBleed } from './body'
import { canReach, facingRelation, fx, rangedRange, wake } from './combat'
import { creatureAt, inBounds, log, player, rng, terrainAt, tileAt, turnOf, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb, DIRS, dirIndex, eq, type Pos } from './geom'
import { countOf, findSpot, itemDef, lightSource, mainWeapon } from './items'
import { diagonalBlocked, findPath } from './path'
import { emitNoise, smellMult, smells } from './perception'
import { moraleEvent, moraleOf, packHalved } from './morale'
import { awardDefeat } from './progression'
import { alarmArrived, raidStash } from './storyteller'
import type { Creature, ItemInst } from './types'

function visibleHostiles(w: World, c: Creature): Creature[] {
  return w.s.creatures.filter((o) => o.alive && o.id !== c.id && hostile(w, c, o) && o.ai.mode !== 'surrender' && canSee(w, c, o.pos))
}

function stepToward(w: World, c: Creature, dest: Pos): Action | null {
  if (eq(c.pos, dest)) return null
  let path = c.ai.path
  const avoidCells=knownFireDanger(w,c)
  if (!path || !path.length || path.some(p=>avoidCells.has(p.y*w.s.map.w+p.x)) || !eq(path[path.length - 1], dest) || (c.id + turnOf(w)) % 7 === 0) {
    path = findPath(w, c.pos, dest, { avoidCreatures: true, selfId: c.id, maxNodes: 1200,avoidWater:!!machineRules(w,c)||!!w.db.creature(c.def).crawler,avoidCells }) ?? undefined
    c.ai.path = path
  }
  if (!path || !path.length) return null
  const next = path[0]
  const occ = creatureAt(w, next)
  if (occ && occ.id !== c.id) {
    c.ai.path = undefined
    // 막히면 옆으로 비켜 접근
    return sidestep(w, c, dest)
  }
  path.shift()
  const dir = dirIndex(next.x - c.pos.x, next.y - c.pos.y)
  if (dir < 0 || cheb(next, c.pos) !== 1) {
    c.ai.path = undefined
    return null
  }
  return { type: 'move', dir }
}

function freeStep(w: World, c: Creature, p: Pos, d: Pos): boolean {
  return inBounds(w, p) && terrainAt(w, p).passable && !creatureAt(w, p) && !diagonalBlocked(w, c.pos, d.x, d.y)&&!knownFireDanger(w,c).has(p.y*w.s.map.w+p.x)
}
function residentCultivationAction(w:World,c:Creature):Action|null{const d=residentProduceDecision(w,c)??residentCultivationDecision(w,c)??residentCropSupplyDecision(w,c);return d?.action??(d?.goal?stepToward(w,c,d.goal)??{type:'wait'}:null)}
function residentRestAction(w: World, c: Creature): Action | null {
  const bed = residentRestGoal(w, c)
  if (!bed) {
    if (!c.residentSite || c.residentSite !== w.s.overworld?.currentRegion || !c.home) return null
    if (residentBedAt(w, c.pos)?.owner === c.id) c.residentReturning = true
    if (!c.residentReturning) return null
    if (eq(c.pos, c.home)) { c.residentReturning = undefined; return null }
    return stepToward(w, c, c.home) ?? { type: 'wait' }
  }
  c.residentReturning = undefined
  if (cheb(c.pos, bed.pos) <= 1 && hasLos(w, c.pos, bed.pos) && (terrainAt(w, bed.pos).id !== bed.terrain || (creatureAt(w, bed.pos)?.id ?? c.id) !== c.id)) {
    delayResidentRest(w, c); return { type: 'wait' }
  }
  if (eq(c.pos, bed.pos)) return { type: 'sleep' }
  const step = stepToward(w, c, bed.pos)
  if (step) return step
  delayResidentRest(w, c); return { type: 'wait' }
}
function residentFoodAction(w: World, c: Creature): Action | null {
  if (!c.residentSite || c.residentSite !== w.s.overworld?.currentRegion) return null
  if (c.needs.kcal <= 0 || c.needs.kcal < residentSleepFoodTarget(w,c)) {
    const food = c.bag.find((it) => readyFood(w,c,it) && !itemDef(w, it).food!.raw) ?? c.bag.find((it) => readyFood(w,c,it))
    if (food) return handState(w, c) === 'dirty' && !washHandsError(w, c) ? { type: 'washHands' } : { type: 'consume', uid: food.uid }
  }
  const cooking=residentCookingDecision(w,c)
  if(cooking?.action)return cooking.action
  if(cooking?.goal){const step=stepToward(w,c,cooking.goal);if(step)return step}
  const depot = residentProvisionGoal(w, c)
  if (!depot) return null
  if (cheb(c.pos, depot) <= 1 && hasLos(w, c.pos, depot)) return { type: 'residentRation' }
  const step = stepToward(w, c, depot)
  if (step) return step
  delayResidentSupply(w, c); return { type: 'wait' }
}
function residentBeddingAction(w:World,c:Creature):Action|null{
  const goal=residentBeddingGoal(w,c)
  if(!goal)return null
  if(goal.kind==='pack'){
    if(cheb(c.pos,goal.pos)<=1&&hasLos(w,c.pos,goal.pos)){
      if(!furnitureQuote(w,c,goal.pos).error)return{type:'packFurniture',pos:goal.pos}
      delayResidentBedding(w,c);return null
    }
    const step=stepToward(w,c,goal.pos)
    if(step)return step
    delayResidentBedding(w,c);return null
  }
  const d=beddingMoveDef(w)!
  if(cheb(c.pos,goal.pos)<=d.approachRadius&&hasLos(w,c.pos,goal.pos)){
    if(c.residentBedTarget&&!beddingSiteAvailable(w,c,c.residentBedTarget))c.residentBedTarget=undefined
    c.residentBedTarget??=residentBeddingSites(w,c)[0]
    const dest=c.residentBedTarget
    if(dest){
      if(cheb(c.pos,dest)<=1&&hasLos(w,c.pos,dest))return{type:'place',uid:goal.uid,dir:dirIndex(dest.x-c.pos.x,dest.y-c.pos.y)}
      const step=stepToward(w,c,dest)
      if(step)return step
    }
  }else{
    const access=DIRS.map((v)=>({x:goal.pos.x+v.x*d.warmRadius,y:goal.pos.y+v.y*d.warmRadius})).filter((p)=>inBounds(w,p)&&terrainAt(w,p).passable&&(!creatureAt(w,p)||creatureAt(w,p)!.id===c.id)).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)
    for(const pos of access){const step=stepToward(w,c,pos);if(step)return step}
  }
  delayResidentBedding(w,c);return null
}
function residentWarmAction(w: World, c: Creature): Action | null {
  const fire = residentWarmthGoal(w,c), d = residentWarmthDef(w)
  if (!fire) {
    if(c.residentWarming && d && c.needs.bodyTemp>=d.target){c.residentWarming=undefined;c.residentReturning=true}
    return null
  }
  c.residentWarming=true
  if(cheb(c.pos,fire.pos)<=2 && hasLos(w,c.pos,fire.pos)){
    if(terrainAt(w,fire.pos).id===fire.terrain && w.s.map.lights.some((l)=>l.kind==='campfire'&&!l.off&&eq(l.pos,fire.pos)) && !warmthError(w,c)) return {type:'warmByFire'}
    delayResidentWarmth(w,c);return null
  }
  const access:Pos[]=[]
  for(let y=fire.pos.y-2;y<=fire.pos.y+2;y++)for(let x=fire.pos.x-2;x<=fire.pos.x+2;x++){
    const pos={x,y},occ=inBounds(w,pos)?creatureAt(w,pos):undefined
    if(inBounds(w,pos)&&terrainAt(w,pos).passable&&!terrainAt(w,pos).water&&!terrainAt(w,pos).bedding&&(!occ||occ.id===c.id))access.push(pos)
  }
  access.sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)
  for(const p of access){const step=stepToward(w,c,p);if(step)return step}
  delayResidentWarmth(w,c);return null
}
function residentPurifyAction(w: World, c: Creature, it: ItemInst): Action | null {
  const goal = residentPurificationGoal(w, c, it)
  if (!goal) return null
  if (goal.kind === 'fuel') {
    if (cheb(c.pos, goal.pos) <= 1 && hasLos(w, c.pos, goal.pos)) return { type: 'residentFuel' }
    const step = stepToward(w, c, goal.pos)
    if (step) return step
  } else {
    if (cheb(c.pos, goal.pos) <= 2 && hasLos(w, c.pos, goal.pos)) {
      const fire = w.s.map.residentHearth!, factor = multiTurnFactor(w, c)
      if (terrainAt(w, goal.pos).id === fire.terrain && w.s.map.lights.some((l) => l.kind === 'campfire' && !l.off && eq(l.pos, goal.pos)) && !waterTreatmentError(w, c, it, 'boil') && Number.isFinite(factor) && factor <= 4) {
        c.residentReturning = true; return { type: 'waterTreatment', uid: it.uid, method: 'boil' }
      }
      delayResidentPurification(w, c); return null
    }
    const access: Pos[] = []
    for (let y = goal.pos.y - 2; y <= goal.pos.y + 2; y++) for (let x = goal.pos.x - 2; x <= goal.pos.x + 2; x++) {
      const pos = { x, y }
      if (inBounds(w, pos) && terrainAt(w, pos).passable && !terrainAt(w, pos).water && !terrainAt(w, pos).bedding && !terrainAt(w, pos).station && (!creatureAt(w, pos) || creatureAt(w, pos)!.id === c.id)) access.push(pos)
    }
    access.sort((a, b) => cheb(c.pos, a) - cheb(c.pos, b) || a.y - b.y || a.x - b.x)
    for (const p of access) { const step = stepToward(w, c, p); if (step) return step }
  }
  delayResidentPurification(w, c); return null
}
function residentWaterAction(w: World, c: Creature): Action | null {
  const d = residentWaterDef(w)
  if (!d || !c.residentSite || c.residentSite !== w.s.overworld?.currentRegion) return null
  observeResidentHygiene(w,c)
  if (residentNeedsDrink(w,c)) { const drink = residentDrink(w, c); if (drink) return residentPurifyAction(w, c, drink) ?? { type: 'consume', uid: drink.uid } }
  const well = residentWaterGoal(w, c)
  if (!well) return null
  if (cheb(c.pos, well.pos) <= 1 && hasLos(w, c.pos, well.pos)) {
    const source=nearbyWater(w,c,well.pos)
    if (terrainAt(w, well.pos).id !== well.terrain || !source || !drinkableSalinity(w,source.quality)) { delayResidentWater(w, c); return { type: 'wait' } }
    c.residentReturning = true
    return well.uid === undefined ? { type: 'drinkHere', pos: well.pos } : { type: 'fillBottle', uid: well.uid, pos: well.pos }
  }
  const access = DIRS.map((dir) => ({ x: well.pos.x + dir.x, y: well.pos.y + dir.y })).filter((p) => inBounds(w, p) && terrainAt(w, p).passable && !terrainAt(w, p).water && !terrainAt(w, p).bedding && !terrainAt(w, p).station && (!creatureAt(w, p) || creatureAt(w, p)!.id === c.id))
    .sort((a, b) => cheb(c.pos, a) - cheb(c.pos, b) || a.y - b.y || a.x - b.x)
  for (const p of access) { const step = stepToward(w, c, p); if (step) return step }
  delayResidentWater(w, c); return { type: 'wait' }
}

function residentHygieneAction(w:World,c:Creature):Action|null{
 const goal=residentHygieneGoal(w,c)
 if(!goal)return null
 if(!residentHygieneSupply(w,c,goal.waterMl).available){
  const vessel=residentVesselGoal(w,c)
  if(vessel){
   if(cheb(c.pos,vessel.pos)<=1&&hasLos(w,c.pos,vessel.pos))return {type:'residentVessel',target:vessel.target}
   const step=stepToward(w,c,vessel.pos);if(step)return step
  }
  delayResidentHygiene(w,c);return null
 }
 if(goal.kind==='body'){c.residentReturning=true;return {type:'wash'}}
 if(cheb(c.pos,goal.pos)<=1&&hasLos(w,c.pos,goal.pos)){
  if(!beddingWashQuote(w,c,goal.pos).error){c.residentReturning=true;return {type:'washBedding',pos:goal.pos}}
  delayResidentHygiene(w,c);return null
 }
 const step=stepToward(w,c,goal.pos)
 if(step)return step
 delayResidentHygiene(w,c);return null
}

function sidestep(w: World, c: Creature, dest: Pos): Action | null {
  let best: { dir: number; score: number } | null = null
  for (let i = 0; i < 8; i++) {
    const d = DIRS[i]
    const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
    if (!freeStep(w, c, p, d)) continue
    const score = cheb(p, dest)
    if (!best || score < best.score) best = { dir: i, score }
  }
  return best && best.score <= cheb(c.pos, dest) ? { type: 'move', dir: best.dir } : null
}

function stepAway(w: World, c: Creature, threats: {pos:Pos}[]): Action | null {
  let best: { dir: number; score: number } | null = null
  for (let i = 0; i < 8; i++) {
    const d = DIRS[i]
    const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
    if (!freeStep(w, c, p, d)) continue
    const score = Math.min(...threats.map((t) => cheb(p, t.pos))) * 10 - terrainAt(w, p).moveMult
    if (!best || score > best.score) best = { dir: i, score }
  }
  return best ? { type: 'move', dir: best.dir } : null
}

/** 무리 사냥꾼: 대상의 측면/후면 빈칸을 노린다 */
function flankSpot(w: World, c: Creature, target: Creature): Pos | null {
  let best: { p: Pos; score: number } | null = null
  for (const d of DIRS) {
    const p = { x: target.pos.x + d.x, y: target.pos.y + d.y }
    if (!inBounds(w, p) || !terrainAt(w, p).passable) continue
    const occ = creatureAt(w, p)
    if (occ && occ.id !== c.id) continue
    const rel = facingRelation(target, p)
    const score = (rel === 'back' ? 30 : rel === 'side' ? 15 : 0) - cheb(c.pos, p) * 3
    if (!best || score > best.score) best = { p, score }
  }
  return best?.p ?? null
}

function nearestFood(w: World, c: Creature, range: number): Pos | null {
  let best: { p: Pos; d: number } | null = null
  for (let y = Math.max(0, c.pos.y - range); y <= Math.min(w.s.map.h - 1, c.pos.y + range); y++) {
    for (let x = Math.max(0, c.pos.x - range); x <= Math.min(w.s.map.w - 1, c.pos.x + range); x++) {
      const t = w.s.map.tiles[y * w.s.map.w + x]
      if (!t.items.some((i) => itemDef(w, i).food?.raw)) continue
      const p = { x, y }
      if (!canSee(w, c, p)) continue
      const d = cheb(c.pos, p)
      if (!best || d < best.d) best = { p, d }
    }
  }
  return best?.p ?? null
}

/** 적의 능력 사용 규칙 (A13) */
function chooseAbility(w: World, c: Creature, t: Creature, threats: Creature[]): Action | null {
  const r = rng(w, 'ai')
  const d = cheb(c.pos, t.pos)
  for (const id of c.abilities) {
    const def = w.db.ability(id)
    if (def.kind !== 'active' || abilityReady(w, c, id)) continue
    if (def.sweep) {
      if (threats.some((o) => cheb(o.pos, c.pos) <= 1)) return { type: 'ability', id }
      continue
    }
    if (def.burst) {
      if (threats.some((o) => cheb(o.pos, c.pos) <= def.burst!.radius)) return { type: 'ability', id }
      continue
    }
    if (def.grab) {
      if (d <= 1 && !t.effects.some((e) => e.kind === 'grabbed') && r.chance(0.3)) return { type: 'ability', id, target: t.id }
      continue
    }
    if (def.lunge) {
      const dx = t.pos.x - c.pos.x, dy = t.pos.y - c.pos.y
      if (d >= 2 && d <= def.lunge + 1 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) {
        let clear = true
        for (let k = 1; k < d; k++) {
          const p = { x: c.pos.x + Math.sign(dx) * k, y: c.pos.y + Math.sign(dy) * k }
          if (!terrainAt(w, p).passable || creatureAt(w, p)) clear = false
        }
        if (clear) return { type: 'ability', id, target: t.id }
      }
      continue
    }
    if (def.self) {
      if (c.needs.energy < energyMax(w, c) * 0.3 && !threats.some((o) => cheb(o.pos, c.pos) <= 1)) return { type: 'ability', id }
      continue
    }
    if (def.channel) {
      if (d >= 3 && r.chance(0.6)) return { type: 'ability', id, target: t.id }
      continue
    }
    if (def.attack && canReach(w, c, t) && r.chance(0.5)) return { type: 'ability', id, target: t.id }
  }
  return null
}

/** 항복 (07 §8): 무기를 내려놓는다. 항복을 받아낸 경험치는 처치와 같다 (15 §3) */
function surrender(w: World, c: Creature, threats: Creature[]): Action {
  const pl = player(w)
  c.ai.mode = 'surrender'
  c.ai.cornered = false
  if (threats.some((t) => t.id === pl.id)) awardDefeat(w, pl, c, 1, '항복시킴')
  const mw = mainWeapon(w, c)
  if (mw) {
    c.equip.main = undefined
    tileAt(w, c.pos).items.push(mw)
  }
  fx(w, { k: 'status', id: c.id, text: '항복', color: '#f0f0f0', turn: turnOf(w) })
  if (canSee(w, pl, c.pos)) log(w, 'warn', `${knownCreatureName(w,c)}이(가) 무기를 내던지고 무릎을 꿇는다. "살려줘…!"`)
  return { type: 'wait' }
}

/** 도주 목적지: 약탈자 = 야영지(거점), 던전 = 가까운 계단 */
function fleeDest(w: World, c: Creature): Pos | undefined {
  if (w.s.map.kind === 'surface') return c.faction === 'reavers' ? c.home ?? w.s.map.waypoints?.reaverCamp : undefined
  const links = w.s.map.links.map((l) => l.pos).sort((a, b) => cheb(a, c.pos) - cheb(b, c.pos))
  return links[0]
}

export function aiDecide(w:World,c:Creature):Action{
  const action=decideAction(w,c)
  return action.type==='wait'&&!w.db.creature(c.def).wildlife&&!activeEscort(w,c)?npcCareAction(w,c)??residentCultivationAction(w,c)??npcSocialAction(w,c)??action:action
}
function decideAction(w: World, c: Creature): Action {
  observeNpcPrisoners(w,c)
  const fire=npcFireResponse(w,c);if(fire){c.ai.path=undefined;return fire}
  if(w.db.creature(c.def).parasite)return {type:'wait'}
  const landing=urgentWaterLanding(w,c);if(landing)return stepToward(w,c,landing)??{type:'wait'}
  if(w.db.body(c.body.def).kind==='humanoid'&&c.breakdown&&!c.unconscious&&!c.asleep&&!c.captivity){const forced=breakdownAction(w,c);if(forced)return forced}
  if(c.roadRaid&&!c.captivity&&!c.companion&&c.needs.kcal>300&&c.needs.waterDeficit<500&&c.needs.fatigue<90){const decision=worldRaidDecision(w,c);if(decision?.loot)return{type:'worldRaidLoot'};if(!visibleHostiles(w,c).length)return decision?.goal?stepToward(w,c,decision.goal)??{type:'wait'}:{type:'wait'}}
  if(c.caravan&&!c.captivity&&!c.companion&&!visibleHostiles(w,c).length){const exit=caravanExitFor(w,c);return exit?stepToward(w,c,exit)??{type:'wait'}:{type:'wait'}}
  if(machineRules(w,c))return machineDecision(w,c)
  const wildlife=w.db.creature(c.def).wildlife
  if(wildlife)return decideWildlife(w,c,wildlife,{toward:p=>stepToward(w,c,p),away:threats=>stepAway(w,c,threats),ability:(target,threats)=>chooseAbility(w,c,target,threats)})
  const r = rng(w, 'ai')
  const cdef = w.db.creature(c.def)
  const turn = turnOf(w)
  const pl = player(w)
  const ai = c.ai
  noticeBase(w,c)

  if(c.captivity){
    const goal=escortGoal(w,c),sleep=prisonerSleepAction(w,c)
    if(sleep?.type==='sleep')return sleep
    if(c.captivity.escort)return goal?stepToward(w,c,goal)??{type:'wait'}:{type:'wait'}
    if(c.captivity.anklesFree){const seen=w.s.creatures.filter((o)=>o.alive&&o.id!==c.id&&hostile(w,c,o)&&canSee(w,c,o.pos)&&cheb(c.pos,o.pos)<=prisonerCareDef(w).guardRadius);if(seen.length){const away=stepAway(w,c,seen);if(away)return away}}
    return !struggleQuote(w,c).error?{type:'struggle'}:{type:'wait'}
  }
  if(w.db.creature(c.def).crawler)return decideCrawler(w,c,{toward:p=>stepToward(w,c,p)})
  noticeKinFlee(w,c)
  if(returningKin(c)&&!isCompanion(w,c)&&!c.asleep&&!c.unconscious){
    const dest=fleeDest(w,c)
    if(dest&&cheb(c.pos,dest)===0&&!canSee(w,pl,c.pos)){dispatchKinship(w,c);c.alive=false;c.deathCause='escaped';const source=w.s.sources?.find(s=>s.species===c.def&&s.floors.includes(w.s.map.id));if(source)source.count=Math.min(source.cap,source.count+1);return{type:'wait'}}
    if(dest)return stepToward(w,c,dest)??{type:'wait'}
  }
  if(mercyActive(w,c)&&!isCompanion(w,c)){
    if(rescueActive(w,c)&&!visibleHostiles(w,c).length){
      c.rescue!.restUntil??=turn+rescueDef(w).restTurns
      if(turn<c.rescue!.restUntil)return{type:'wait'}
      const d=companionDef(w),food=c.needs.kcal<d.eatBelow&&c.bag.find((i)=>readyFood(w,c,i)&&!itemDef(w,i).food!.raw),water=c.needs.waterDeficit>=d.drinkAbove&&c.bag.find((i)=>itemDef(w,i).drink&&!itemDef(w,i).drink!.alcohol&&!i.waterFrozen&&(i.uses??1)>0&&suitableDrink(w,i))
      if(food)return{type:'consume',uid:food.uid}
      if(water)return{type:'consume',uid:water.uid}
      if(c.needs.fatigue>=d.sleepAt&&c.needs.bodyTemp>=35&&(c.drowsyUntil??0)<=turn)return{type:'sleep'}
      const needs=residentWaterAction(w,c)??residentFoodAction(w,c)??residentWarmAction(w,c)??residentHygieneAction(w,c)??residentRestAction(w,c)
      if(needs)return needs
      return c.home?stepToward(w,c,c.home)??{type:'wait'}:{type:'wait'}
    }
    if(!rescueActive(w,c))return c.home?stepToward(w,c,c.home)??{type:'wait'}:{type:'wait'}
  }

  // 잠든 적: 소리로만 깬다(perception). 포자 인간은 인접 칸에 2턴 이상 머물면 깬다 (14 §7.2)
  if (c.asleep) {
    // 냄새를 맡은 잠든 개체는 '뒤척임': 깊은 잠 → 얕은 잠 (07 §9.2 검산 G)
    if (c.deepSleep && smellMult(w, c) > 0 && pl.alive && smells(w, c, pl)) c.deepSleep = undefined
    if (c.def.startsWith('Creature.SporeMan') && pl.alive && cheb(pl.pos, c.pos) <= 1) {
      ai.nearTurns = (ai.nearTurns ?? 0) + 1
      if (ai.nearTurns >= 2) wake(w, c, '곁의 기척')
    } else ai.nearTurns = 0
    if (c.asleep) return { type: 'wait' }
  }
  if(cdef.fireFear){
  expireAnimalFear(w,c)
  const remembered=animalRememberedThreats(w,c),fear=animalFearRules(w,c)
  if(fear&&remembered.length&&!visibleHostiles(w,c).some(o=>cheb(o.pos,c.pos)<=1&&!remembered.some(f=>f.id===o.id))){
    if(remembered.every(o=>cheb(o.pos,c.pos)>fear.avoidRadius))return{type:'wait'}
    const away=stepAway(w,c,remembered);if(away?.type==='move'&&remembered.every(o=>cheb({x:c.pos.x+DIRS[away.dir].x,y:c.pos.y+DIRS[away.dir].y},o.pos)>=cheb(c.pos,o.pos)))return away
  }
  }
  const isGuard = cdef.ai === 'guard' || cdef.ai === 'boss' 

  // 진정한 개체(물을 받은 말라붙은 자)는 그 자리에 머문다
  if (ai.mode === 'calm') return { type: 'wait' }
  const threats = visibleHostiles(w, c)
  const custody=npcCustodyAction(w,c,threats)
  if(custody&&custody.type!=='prisoner')return custody
  if(custody?.type==='prisoner'&&custody.operation==='release')return custody
  const abduction=npcAbductionAction(w,c,threats);if(abduction)return abduction
  if(custody)return custody
  const directive=companionDecision(w,c,threats)
  if(directive?.action)return directive.action
  if(directive?.goal)return stepToward(w,c,directive.goal)??{type:'wait'}
  const lightThreat=kinLightThreat(w,c)
  if(!threats.length&&lightThreat){const away=stepAway(w,c,[lightThreat]);if(away)return away}
  if (cdef.ai === 'civilian') {
    if (threats.length) { const away = stepAway(w, c, threats); if (away) return away; const near = threats.find((t) => canReach(w, c, t)); return near ? { type: 'attack', target: near.id } : { type: 'wait' } }
    const water = residentWaterAction(w, c)
    if (water) return water
    if ((!c.residentSite || c.residentSite !== w.s.overworld?.currentRegion || !residentWaterDef(w)) && c.needs.waterDeficit >= 500) { const drink = c.bag.find((it) => itemDef(w, it).drink && !itemDef(w, it).drink!.alcohol && (it.uses ?? 1) > 0 && !it.waterFrozen && suitableDrink(w,it)); if (drink) return { type: 'consume', uid: drink.uid } }
    const provisions = residentFoodAction(w, c)
    if (provisions) return provisions
    if (c.needs.kcal <= 0) { const food = c.bag.find((it) => readyFood(w,c,it)); if (food) return handState(w, c) === 'dirty' && !washHandsError(w, c) ? { type: 'washHands' } : { type: 'consume', uid: food.uid } }
    if (cdef.clinic && handState(w, c) === 'dirty' && !washHandsError(w, c)) return { type: 'washHands' }
    const bedding=residentBeddingAction(w,c)
    if(bedding)return bedding
    const warmth = residentWarmAction(w,c)
    if(warmth)return warmth
    const hygiene=residentHygieneAction(w,c)
    if(hygiene)return hygiene
    const rest = residentRestAction(w, c)
    if (rest) return rest
    const care=npcCareAction(w,c);if(care)return care
    const supply = clinicSupplyGoal(w, c)
    if (supply) {
      if (supply.kind === 'shop' && cheb(c.pos, supply.pos) <= 1) return { type: 'clinicSupply', target: supply.trader! }
      const step = stepToward(w, c, supply.pos)
      if (step) return step
      if (supply.kind === 'shop') delayClinicSupply(w, c)
    }
    const escort=contractEscortGoal(w,c);if(escort!==undefined)return escort?stepToward(w,c,escort)??{type:'wait'}:{type:'wait'}
    return npcNoteAction(w,c)??npcCartographyAction(w,c)??npcWorldCartographyAction(w,c)??{ type: 'wait' }
  }

  if (!threats.length) { const water = residentWaterAction(w, c); if (water) return water; const provisions = residentFoodAction(w, c); if (provisions) return provisions; const bedding=residentBeddingAction(w,c);if(bedding)return bedding; const warmth=residentWarmAction(w,c); if(warmth)return warmth;const hygiene=residentHygieneAction(w,c);if(hygiene)return hygiene; const rest = residentRestAction(w, c); if (rest) return rest; const care=npcCareAction(w,c);if(care)return care;const farming=residentCultivationAction(w,c);if(farming)return farming;const escort=contractEscortGoal(w,c);if(escort!==undefined)return escort?stepToward(w,c,escort)??{type:'wait'}:{type:'wait'};const note=npcNoteAction(w,c);if(note)return note;const map=npcCartographyAction(w,c);if(map)return map;const worldMap=npcWorldCartographyAction(w,c);if(worldMap)return worldMap }
  // 사기 (07 §8): 사건 즉시 + 5턴마다 판정
  const M = moraleOf(w, c)
  ai.morale = M
  if (!cdef.noMorale && ai.mode !== 'surrender' && ai.mode !== 'flee' && threats.length) {
    const check = ai.moraleCheck === undefined || turn - ai.moraleCheck >= 5
    let flee = M < 10 || packHalved(w, c)
    if (!flee && M < 25 && check) flee = r.int(0, 99) < (25 - M) * 4
    if (check) ai.moraleCheck = turn
    if (flee) {
      // 도주 불가: 다리 중상 이상 · 물러날 칸 없음(포위·막다른 곳)
      const legs = Math.max(regionState(w, c, 'lleg'), regionState(w, c, 'rleg'))
      const away = stepAway(w, c, threats)
      const gain = away?.type === 'move' && threats.every((t) => cheb(t.pos, { x: c.pos.x + DIRS[away.dir].x, y: c.pos.y + DIRS[away.dir].y }) >= cheb(t.pos, c.pos))
      if (legs < 3 && gain) {
        ai.mode = 'flee'
        noticeKinFlee(w,c,threats.some(t=>t.id===pl.id))
        ai.cornered = false
        for (const o of w.s.creatures) if (o.alive && o.id !== c.id && o.faction === c.faction && canSee(w, o, c.pos)) moraleEvent(o, -5, 't20', turn)
        fx(w, { k: 'status', id: c.id, text: '도주!', color: '#e0c050', turn })
        if (canSee(w, pl, c.pos)) log(w, 'combat', `${knownCreatureName(w,c)}이(가) 겁에 질려 달아나기 시작한다.`)
      } else if (c.faction === 'reavers' && !ai.cornered && r.int(0, 99) < Math.max(20, (25 - M) * 3)) {
        return surrender(w, c, threats)
      } else if (!ai.cornered) {
        ai.cornered = true
        fx(w, { k: 'status', id: c.id, text: '궁지', color: '#e07040', turn })
        if (canSee(w, pl, c.pos)) log(w, 'combat', `${knownCreatureName(w,c)}이(가) 궁지에 몰렸다. 이를 악물고 덤빈다.`)
      }
    }
  }

  if (ai.mode === 'surrender') {
    if (!threats.length || threats.every((t) => cheb(t.pos, c.pos) > 6)) {
      if (r.chance(0.05)) ai.mode = 'flee'
    }
    return { type: 'wait' }
  }

  if (ai.mode === 'flee') {
    if (!threats.length && M >= 40) { ai.mode = 'idle'; ai.goneSince = undefined }
    // 도주 경험치: 시야 밖으로 사라져 30턴 동안 돌아오지 않으면 50% (15 §3)
    if (canSee(w, pl, c.pos)) ai.goneSince = undefined
    else {
      ai.goneSince ??= turn
      if (turn - ai.goneSince >= 30 && c.body.wounds.some((wd) => wd.sourceId === pl.id)) awardDefeat(w, pl, c, 0.5, '도주시킴')
    }
    // 도주는 지도 가장자리가 아니라 공급원 쪽으로 (12 §12.3 · D11): 약탈자는 야영지, 던전 거주자는 계단(관로·순례길로 이어진다)
    const dest = fleeDest(w, c)
    if (dest && cheb(c.pos, dest) <= 0 && !canSee(w, pl, c.pos)) {
      if (w.s.map.kind === 'dungeon') {
        // 층을 떠나 공급원으로 돌아간다
        dispatchKinship(w,c)
        c.alive = false
        c.deathCause = 'escaped'
        const src = w.s.sources?.find((x) => x.species === c.def && x.floors.includes(w.s.map.id))
        if (src) src.count = Math.min(src.cap, src.count + 1)
        if (c.body.wounds.some((wd) => wd.sourceId === pl.id)) awardDefeat(w, pl, c, 0.5, '도주시킴')
        return { type: 'wait' }
      }
      ai.mode = 'guard'
      return { type: 'wait' }
    }
    if (threats.length) {
      const toward = dest ? stepToward(w, c, dest) : undefined
      if (toward && toward.type === 'move') {
        const d = DIRS[toward.dir]
        const next = { x: c.pos.x + d.x, y: c.pos.y + d.y }
        if (threats.every((t) => cheb(t.pos, next) >= cheb(t.pos, c.pos) || cheb(t.pos, next) > 1)) return toward
      }
      const away = stepAway(w, c, threats)
      if (away) return away
      // 도망칠 곳이 없으면 싸운다
      const adj = threats.find((t) => canReach(w, c, t))
      if (adj) return { type: 'attack', target: adj.id }
    }
    if (dest) return stepToward(w, c, dest) ?? { type: 'wait' }
    return { type: 'wait' }
  }

  // 목표 선택
  let target: Creature | undefined
  const wantsFight = cdef.ai === 'raider' || isGuard
    || (cdef.ai === 'packHunter' && (ai.hunger > 0.4 || (ai.alertTurn !== undefined && turn - ai.alertTurn < 200)))
    || (cdef.ai === 'skittish' && (ai.alertTurn !== undefined && turn - ai.alertTurn < 50))
  if (threats.length) {
    const scores=cdef.considerationWorker?scriptAITargetScores(w,c,threats):null
    threats.sort((a, b) => scores?(-cheb(b.pos,c.pos)*10+(scores.get(b.id)??0))-(-cheb(a.pos,c.pos)*10+(scores.get(a.id)??0)):cheb(a.pos,c.pos)-cheb(b.pos,c.pos))
    const cand = threats[0]
    // 쥐는 쓰러졌거나 피 흘리는 대상에게만 대담
    const weak = cand.unconscious || totalBleed(w, cand, true) > 3
    const cornered = cheb(cand.pos, c.pos) <= 1 && (cdef.ai !== 'skittish' || r.chance(0.35))
    if (wantsFight || (cdef.ai === 'skittish' && weak) || cornered) target = cand
    else if (cdef.ai === 'skittish' && cheb(cand.pos, c.pos) <= 4) {
      return stepAway(w, c, threats) ?? { type: 'wait' }
    }
  }

  // 배고픈 짐승: 고기가 보이면 먼저 먹는다
  if ((cdef.ai === 'packHunter' || cdef.ai === 'skittish') && ai.hunger > 0.3) {
    const nearThreat = threats.some((t) => cheb(t.pos, c.pos) <= 2)
    if (!nearThreat) {
      const here = tileAt(w, c.pos).items.some((i) => itemDef(w, i).food?.raw)
      if (here) {
        if (canSee(w, pl, c.pos) && ai.mode !== 'eat') log(w, 'flavor', `${knownCreatureName(w,c)}이(가) 고기를 뜯기 시작한다.`)
        ai.mode = 'eat'
        return { type: 'eatFloor' }
      }
      const food = nearestFood(w, c, 8)
      if (food) {
        ai.mode = 'eat'
        const st = stepToward(w, c, food)
        if (st) return st
      }
    }
  }

  // 거점 경비는 일정 거리 이상 쫓지 않는다 (보스 7칸, 경비 14칸)
  if (target && c.home && !ai.route && (cdef.ai === 'boss' || cdef.ai === 'guard') && cheb(target.pos, c.home) > (cdef.ai === 'boss' ? 7 : 14)) {
    target = undefined
    if (ai.mode === 'hunt') { ai.mode = 'return'; ai.path = undefined }
  }
  if (target) {
    // 소리쳐 깨우기는 한 번 경보한 뒤 120턴(6분)은 다시 하지 않는다 — 추적을 잃었다 되찾을 때마다 외치지 않게
    if (ai.mode !== 'hunt' && isGuard && turn - (ai.alertTurn ?? -999) > 120) {
      ai.alertTurn = turn
      emitNoise(w, c.pos, 12, c.id) // 소리쳐 동료를 깨운다 (14 §7.3: 소음 12)
      fx(w, { k: 'status', id: c.id, text: '!', color: '#ff5050', turn })
      if (canSee(w, pl, c.pos)) log(w, 'warn', cdef.ai === 'boss' ? `${knownCreatureName(w,c)}이(가) 꿈틀거리며 몸을 일으킨다. 방 전체가 울린다.` : `${knownCreatureName(w,c)}이(가) 당신을 발견했다.`)
    }
    // 무리 부르기는 60턴에 한 번 (빛을 피해 물러났다 다시 오는 그늘 사람이 매번 소리치지 않게)
    if (ai.mode !== 'hunt' && cdef.ai === 'packHunter' && turn - (ai.alertTurn ?? -999) > 60) {
      ai.alertTurn = turn
      emitNoise(w, c.pos, 12, c.id) // 짖어서 무리를 부른다
      if (canSee(w, pl, c.pos)) log(w, 'warn', `${knownCreatureName(w,c)}이(가) 이빨을 드러내고 짖는다.`)
    }
    ai.mode = 'hunt'
    ai.target = target.id
    ai.lastSeen = { ...target.pos }
    // 능력 (15 §15: 적도 같은 능력 Def를 쓴다)
    const ab = chooseAbility(w, c, target, threats)
    if (ab) return ab
    // 빛을 싫어하는 무리: 광원을 든 대상에게는 정면으로 오지 않고, 동료 둘이 붙을 때까지 빛 밖에서 기다린다 (07 §12.4)
    if (cdef.lightAverse && cheb(c.pos, target.pos) > 1) {
      const src = lightSource(w, target)
      if (src) {
        const near = w.s.creatures.filter((o) => o.alive && o.id !== c.id && o.faction === c.faction && cheb(o.pos, target.pos) <= 2).length
        if (near < 2 && cheb(c.pos, target.pos) <= src.radius + 1) {
          return stepAway(w, c, [target]) ?? { type: 'wait' }
        }
        if (near < 2) return { type: 'wait' }
        const spot = flankSpot(w, c, target)
        if (spot) { const st = stepToward(w, c, spot); if (st) return st }
      }
    }
    // 손에 든 실제 투척 무기만 쓴다. 기존 소지 돌을 자동 공격 탄약으로 소비하지 않는다.
    if(cheb(c.pos,target.pos)>1)for(const item of [c.equip.main,c.equip.off])if(item&&itemDef(w,item).throwable&&!throwQuote(w,c,item.uid,target.id).error)return {type:'throwAttack',uid:item.uid,target:target.id}
    // 실제 장전된 마지막 탄도 배낭 탄약과 별개로 사용할 수 있다.
    const gun=c.equip.main,gunRange=gun&&itemDef(w,gun).ranged
    if(gun&&gunRange?.firearm&&cheb(c.pos,target.pos)>1 ){
      if(gun.firearmJammed)return {type:'firearmCare',uid:gun.uid,operation:'unjam'}
      if(cheb(c.pos,target.pos)<=rangedRange(w,c,target)&&(firearmReady(w,c,gun)||firearmSupply(w,c,gun)))return {type:'shoot',target:target.id}
    }
    // 원거리 무기
    const mw = mainWeapon(w, c)
    if (mw && itemDef(w, mw).ranged && !itemDef(w,mw).ranged!.firearm && cheb(c.pos, target.pos) > 1) {
      if (countOf(c, itemDef(w, mw).ranged!.ammo) > 0 && cheb(c.pos, target.pos) <= rangedRange(w, c, target)) return { type: 'shoot', target: target.id }
    }
    if (canReach(w, c, target)) return { type: 'attack', target: target.id }
    if (cdef.ai === 'packHunter') {
      const spot = flankSpot(w, c, target)
      if (spot) {
        const st = stepToward(w, c, spot)
        if (st) return st
      }
    }
    return stepToward(w, c, target.pos) ?? sidestep(w, c, target.pos) ?? { type: 'wait' }
  }

  // 냄새 추적 (07 §9.2): 감지하면 그쪽을 조사한다
  if (smellMult(w, c) > 0 && (cdef.ai !== 'skittish' || ai.hunger > 0.4)) {
    const prey = w.s.creatures.find((o) => o.alive && hostile(w, c, o) && smells(w, c, o))
    if (prey && ai.mode !== 'investigate') {
      if (canSee(w, pl, c.pos)) log(w, 'flavor', `${knownCreatureName(w,c)}이(가) 고개를 들고 냄새를 맡는다.`)
      ai.mode = 'investigate'
      ai.dest = { ...prey.pos }
    }
  }

  // 마지막으로 본 곳 / 소리 난 곳 조사
  if (ai.mode === 'hunt' && ai.lastSeen) {
    ai.mode = 'investigate'
    ai.dest = ai.lastSeen
  }
  if (ai.mode === 'investigate' && ai.dest) {
    if (cheb(c.pos, ai.dest) <= 0) { ai.mode = 'wander'; ai.dest = undefined }
    else {
      const st = stepToward(w, c, ai.dest)
      if (st) return st
      ai.mode = 'wander'
    }
  }

  const phantom=privateSound(w,c)
  if(phantom&&!ai.target&&cheb(c.pos,phantom.pos)>0){const step=stepToward(w,c,phantom.pos);if(step)return step}

  // 순찰 (14 §10): 경유지마다 30분 대기, 마지막은 거점 → 경비로 복귀
  if (ai.route?.length) {
    if (ai.mode !== 'patrol') ai.mode = 'patrol'
    const i = ai.routeIdx ?? 0
    const goal = ai.route[i]
    if (cheb(c.pos, goal) <= 1) {
      const last = i >= ai.route.length - 1
      // 수색대는 기다리지 않는다. 보관함에 닿으면 턴다 (10 §3.2)
      const searching = ai.task?.kind === 'search' || ai.task?.kind === 'alarm'
      if(baseRaidGoal(w,c,goal))return{type:'baseRaidLoot'}
      if (ai.task?.kind === 'search' && ai.task.stash && eq(goal, ai.task.stash)) raidStash(w, c, w.s.map, goal)
      if (ai.waitUntil === undefined) ai.waitUntil = turn + (last || searching ? 0 : placePatrolWait(w,c))
      if (turn >= ai.waitUntil) {
        ai.waitUntil = undefined
        ai.routeIdx = i + 1
        if (last) {
          scriptPlaceActorReturned(w,ai.placeEvent??(ai.task?.kind==='search'?'Event.ReaverSearch':'Event.ReaverPatrol'),c.id)
          if (ai.task?.kind === 'alarm') alarmArrived(w, c)
          ai.task = undefined
          ai.route = undefined; ai.routeIdx = undefined; delete ai.placeEvent; ai.mode = isGuard ? 'guard' : 'wander'
        }
      }
      return { type: 'wait' }
    }
    const st = stepToward(w, c, goal)
    if (st) return st
  }

  // 경비형: 거점 근처에 머문다
  if (isGuard && c.home) {
    if (cheb(c.pos, c.home) > 5) {
      ai.mode = 'return'
      const st = stepToward(w, c, c.home)
      if (st) return st
    }
    ai.mode = 'guard'
    if (r.chance(0.15)) {
      const d = DIRS[r.int(0, 7)]
      const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
      if (cheb(p, c.home) <= 3 && freeStep(w, c, p, d)) return { type: 'move', dir: DIRS.indexOf(d) }
    }
    return { type: 'wait' }
  }

  // 배회
  ai.mode = ai.mode === 'eat' ? 'wander' : ai.mode
  if (r.chance(cdef.ai === 'raider' ? 0.5 : 0.35)) {
    if (!ai.dest || r.chance(0.05) || eq(ai.dest, c.pos)) {
      ai.dest = { x: Math.max(1, Math.min(w.s.map.w - 2, c.pos.x + r.int(-8, 8))), y: Math.max(1, Math.min(w.s.map.h - 2, c.pos.y + r.int(-8, 8))) }
      ai.path = undefined
    }
    const st = stepToward(w, c, ai.dest)
    if (st) return st
    ai.dest = undefined
  }
  // 굶주림 증가
  ai.hunger = Math.min(1, ai.hunger + 0.0005)
  return { type: 'wait' }
}

function machineDecision(w:World,c:Creature):Action{
  const d=machineRules(w,c)!,m=c.body.machine,turn=turnOf(w)
  if(!m||!machineReady(w,c))return{type:'wait'}
  if(m.errorLoop&&turn<m.errorLoop.until)return m.errorLoop.action
  m.errorLoop=undefined
  const action=machineDecisionRaw(w,c)
  if(action.type==='wait'||action.type==='move'||action.type==='attack'){
    if((partDamage(c,d.core)/(c.body.maxHp[d.core]||1)>=d.errorLoop.damage||c.hp<=hpMax(w,c)*(1-d.errorLoop.damage))&&turn-(m.errorChecked??-Infinity)>=d.errorLoop.checkTurns){
      m.errorChecked=turn
      if(rng(w,'ai').chance(d.errorLoop.chance))m.errorLoop={until:turn+d.errorLoop.turns,action:m.lastAction??action}
    }
    m.lastAction=action
  }
  return m.errorLoop?.action??action
}

function machineDecisionRaw(w:World,c:Creature):Action{
  const m=c.body.machine,d=machineRules(w,c)!
  if(!m||!machineReady(w,c)||capacity(w,c,'consciousness')<0.3)return{type:'wait'}
  // Keep the shared real controller-fault wrapper, before the repair-drone policy.
  if(w.db.creature(c.def).sower)return decideSower(w,c,{toward:p=>stepToward(w,c,p)})
  if(w.db.creature(c.def).survey)return decideSurveyor(w,c,{toward:p=>stepToward(w,c,p),away:threats=>stepAway(w,c,threats)})
  const toward=(pos:Pos):Action=>{
    const action=stepToward(w,c,pos)
    if(action?.type==='move'){const delta=DIRS[action.dir],to={x:c.pos.x+delta.x,y:c.pos.y+delta.y};if(terrainAt(w,to).water)return{type:'wait'}}
    return action??{type:'wait'}
  }
  const home=():Action=>c.home&&cheb(c.pos,c.home)>1?toward(c.home):{type:'wait'}
  if(c.home&&cheb(c.pos,c.home)<=1){
    const wd=c.body.wounds.find(wd=>!wd.patched&&wd.def==='Wound.MachinePerforation'&&[d.chassis,d.coolingLoop].includes(wd.part)&&wd.severity>wd.healed),damaged=w.db.body(c.body.def).parts.find(p=>partDamage(c,p.id)>0)
    const op:import('./types').MachineOperation|undefined=m.power<d.retreatPower?'cell':wd?'patch':m.coolant<d.coolantMl*.75?'coolant':damaged?'repair':undefined
    if(op){
      const it=c.bag.find(i=>i.def===d[op].item)
      if(it)return{type:'machineCare',target:c.id,operation:op,uid:it.uid,woundId:wd?.id,part:damaged?.id}
      const floor=tileAt(w,c.home).items.find(i=>i.def===d[op].item)
      if(floor&&findSpot(w,c,itemDef(w,floor)))return{type:'machineHaul',uid:floor.uid}
    }
  }
  if(m.power<d.retreatPower||c.hp<=hpMax(w,c)*0.4)return home()
  if(m.cargo?.some(uid=>c.bag.some(it=>it.uid===uid)))return c.home&&cheb(c.pos,c.home)<=1?{type:'machineHaul'}:home()
  // 쓰러진 동료의 현물 잔해가 교전보다 우선한다. 남은 부품이 없으면 미끼도 끝난다.
  const wreck=w.s.creatures.filter(o=>!o.alive&&o.body.machine&&o.bag.length&&canSee(w,c,o.pos)).sort((a,b)=>cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.id-b.id)[0]
  if(wreck){const it=wreck.bag.find(i=>!!findSpot(w,c,itemDef(w,i)));if(it)return cheb(c.pos,wreck.pos)<=1?{type:'machineHaul',target:wreck.id,uid:it.uid}:toward(wreck.pos)}
  const threats=visibleHostiles(w,c),scores=w.db.creature(c.def).considerationWorker?scriptAITargetScores(w,c,threats):null
  threats.sort((a,b)=>scores?(-cheb(b.pos,c.pos)*10+(scores.get(b.id)??0))-(-cheb(a.pos,c.pos)*10+(scores.get(a.id)??0)):cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.id-b.id)
  const target=threats[0]
  if(target){c.ai.mode='hunt';c.ai.target=target.id;return canReach(w,c,target)?{type:'attack',target:target.id,mode:m.heat<d.protectiveHeat&&(m.attacks??0)%4===3?'weld':undefined}:toward(target.pos)}
  if(c.ai.mode==='investigate'&&c.ai.dest&&capacity(w,c,'hearing')>0&&cheb(c.pos,c.ai.dest)>1)return toward(c.ai.dest)
  c.ai.mode='guard';c.ai.target=undefined
  return home()
}
