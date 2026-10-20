// 실제 침구의 사용 허가와 동료의 휴식. 소유권/침구/몸을 새로 만들지 않는다.
import type { Action } from './actions'
import { baseCommandError, baseStoreError, approachBaseStore, transferBase } from './base-camp'
import { baseCampDef } from './base-camp-state'
import { baseLogisticsDef } from './base-logistics'
import { baseHeatGoal, baseWaterSafe } from './base-water'
import { capacity, painStage, painTotal } from './body'
import { companionDef, isCompanion } from './companion-state'
import { creatureAt, inBounds, log, player, terrainAt, tileAt, turnOf, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb, eq, type Pos } from './geom'
import { foodFreshness } from './food-state'
import { itemDef } from './items'
import { diagonalBlocked, findPath } from './path'
import { warmthError } from './resident-warmth'
import type { BaseRestDef, Creature, MapState } from './types'
export const baseRestDef=(w:World)=>w.db.get<BaseRestDef>('BaseRest.Hearth')
function actualBed(w:World,pos:Pos,uid?:number){
 const base=w.s.map.baseCamp;if(!base||!inBounds(w,pos)||cheb(pos,base.store)>baseCampDef(w).radius)return false
 const tile=tileAt(w,pos),bedding=terrainAt(w,pos).bedding
 return !!bedding&&!!tile.placed&&(uid===undefined||tile.placed.item.uid===uid)&&(tile.placed.owner===base.owner||bedding.portable&&tile.placed.owner===undefined)
}
export function baseBedTenant(w:World,pos:Pos):number|undefined{
 const base=w.s.map.baseCamp,uid=tileAt(w,pos).placed?.item.uid,lease=uid===undefined?undefined:base?.beds?.[uid]
 return lease&&eq(lease.pos,pos)&&actualBed(w,pos,uid)?lease.tenant:undefined
}
export function baseBedQuote(w:World,pos:Pos,tenant?:Creature){
 const p=player(w),base=w.s.map.baseCamp
 let error=baseStoreError(w,p,false)
 if(!error&&(p.activity||!actualBed(w,pos)||cheb(p.pos,pos)>1||!canSee(w,p,pos)||!hasLos(w,p.pos,pos)||diagonalBlocked(w,p.pos,pos.x-p.pos.x,pos.y-p.pos.y)))error='본인의 실제 침구 곁에서 배정해야 한다'
 const occupant=inBounds(w,pos)&&creatureAt(w,pos)
 if(!error&&occupant&&(!tenant||occupant.id!==tenant.id||occupant.asleep||occupant.unconscious))error='누군가 실제로 쓰고 있는 침구다'
 if(!error&&tenant)error=baseCommandError(w,tenant)
 const uid=inBounds(w,pos)?tileAt(w,pos).placed?.item.uid:undefined,lease=uid===undefined?undefined:base?.beds?.[uid]
 if(!error&&lease&&tenant&&lease.tenant!==tenant.id)error='먼저 이전 침구 배정을 해제해야 한다'
 return{error,uid,turns:baseRestDef(w).assignTurns}
}
export function assignBaseBed(w:World,pos:Pos,tenant?:Creature):string|null{
 const q=baseBedQuote(w,pos,tenant);if(q.error)return q.error
 const base=w.s.map.baseCamp!,beds=base.beds??={}
 if(tenant){for(const [uid,lease]of Object.entries(beds))if(lease.tenant===tenant.id)delete beds[Number(uid)];beds[q.uid!]={tenant:tenant.id,pos:{...pos}};log(w,'info',`${tenant.name}에게 실제 침구 사용을 허락했다. 소유 물품과 몸은 그대로다.`)}
 else delete beds[q.uid!]
 return null
}
export function nearbyBaseBeds(w:World){const p=player(w),base=w.s.map.baseCamp;if(!base)return[];const out:Pos[]=[];for(let y=p.pos.y-1;y<=p.pos.y+1;y++)for(let x=p.pos.x-1;x<=p.pos.x+1;x++){const pos={x,y};if(actualBed(w,pos)&&canSee(w,p,pos)&&hasLos(w,p.pos,pos))out.push(pos)}return out}
export function recordBaseBedPlacement(w:World,uid:number,pos:Pos){const lease=w.s.map.baseCamp?.beds?.[uid];if(lease)lease.pos={...pos}}
/** 순수 지도 순회다. 날씨/시간 정산을 하는 mapWorlds는 호출하지 않는다. */
export function releaseBaseBeds(w:World,id:number){const maps:MapState[]=[w.s.map,...Object.values(w.s.maps),...Object.values(w.s.overworld?.scenes??{}).flatMap((s)=>[s.map,...Object.values(s.maps)])];for(const map of maps)if(map.baseCamp?.beds)for(const [uid,lease]of Object.entries(map.baseCamp.beds))if(lease.tenant===id)delete map.baseCamp.beds[Number(uid)]}
function assignedBed(w:World,c:Creature){const beds=w.s.map.baseCamp?.beds;return beds&&Object.entries(beds).find(([uid,lease])=>lease.tenant===c.id&&actualBed(w,lease.pos,Number(uid)))}
export function baseRestDecision(w:World,c:Creature,threats:Creature[]):{action?:Action;goal?:Pos}|null{
 const base=w.s.map.baseCamp
 if(!base||!isCompanion(w,c)||!c.alive||c.asleep||c.unconscious||c.captivity||c.activity||capacity(w,c,'consciousness')<.5||(c.drowsyUntil??0)>turnOf(w)||cheb(c.pos,base.store)>baseCampDef(w).radius||threats.some((o)=>!o.asleep&&!o.unconscious&&!o.captivity&&o.ai.mode!=='surrender'))return null
 const d=baseRestDef(w),bed=assignedBed(w,c);if(!bed||c.needs.fatigue<companionDef(w).sleepAt&&(c.needs.sleepDebt??0)<d.debtAt||painStage(painTotal(w,c))>=5)return null
 if(c.companion!.order==='follow'&&cheb(player(w).pos,base.store)>baseCampDef(w).radius)return null
 if(c.needs.bodyTemp<d.warmBelow){if(!warmthError(w,c))return{action:{type:'warmByFire'}};const heat=baseHeatGoal(w,c);return heat?{goal:heat}:null}
 const canFeed=capacity(w,c,'manipulation')>=.2
 if(canFeed&&c.needs.kcal<d.prepareKcal){const food=c.bag.find((i)=>itemDef(w,i).food&&!itemDef(w,i).food!.raw&&!i.foodFrozen&&foodFreshness(i)>=baseLogisticsDef(w).minFreshness);if(food)return{action:{type:'consume',uid:food.uid}}}
 if(canFeed&&c.needs.waterDeficit>d.prepareWater){const water=c.bag.find((i)=>baseWaterSafe(w,i));if(water)return{action:{type:'consume',uid:water.uid}}}
 // 재고는 실제 창고 곁에서 확인한다. 준비할 것이 없어도 잠을 무한히 미루지 않는다.
 if(canFeed&&bed[1].preparedAfterWake!==(c.lastWokeAt??-1)&&(c.needs.kcal<d.prepareKcal||c.needs.waterDeficit>d.prepareWater)){
  if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)}
  const stock=tileAt(w,base.store).cont?.items??[],water=c.needs.waterDeficit>d.prepareWater?stock.find((i)=>baseWaterSafe(w,i)):undefined,food=c.needs.kcal<d.prepareKcal?stock.find((i)=>itemDef(w,i).food&&!itemDef(w,i).food!.raw&&!i.foodFrozen&&foodFreshness(i)>=baseLogisticsDef(w).minFreshness):undefined,supply=water??food
  if(supply&&!transferBase(w,c,'take',supply.uid,1,true))return{action:{type:'baseTransfer',direction:'take',uid:supply.uid,count:1}}
  bed[1].preparedAfterWake=c.lastWokeAt??-1
 }
 const pos=bed[1].pos,occupant=creatureAt(w,pos)
 if(occupant&&occupant.id!==c.id)return null
 if(eq(c.pos,pos))return{action:{type:'sleep'}}
 return findPath(w,c.pos,pos,{avoidCreatures:true,selfId:c.id,maxNodes:1200})?{goal:pos}:null
}
