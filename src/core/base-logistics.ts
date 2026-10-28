import {cultivationStatus,cultivationWaterQuote,cultivationSubstrateQuote} from './cultivation'
import {drinkVolume} from './wash-water'
import {isWaterVessel} from './water-vessels'
import {waterQuality,waterSalinity} from './water-state'
import { suitableDrink } from './water-state'
import { baseWaterSafe } from './base-water'
// 운반/채집은 실제 창고의 목표 재고를 채운다. 같은 물품을 꺼냈다 돌려놓아도 순증으로 세지 않는다.
import { multiTurnFactor } from './action-time'
import type { Action } from './actions'
import { approachBaseStore, baseStoreError, transferBase } from './base-camp'
import { baseCampDef, baseTaskActive, refreshBaseLogistics } from './base-camp-state'
import { capacity } from './body'
import { companionDef } from './companion-state'
import { startGather } from './crafting'
import { creatureAt, inBounds, terrainAt, tileAt, turnOf, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb, DIRS, type Pos } from './geom'
import { foodFreshness } from './food-state'
import { gridAdd, itemDef } from './items'
import { diagonalBlocked, findPath } from './path'
import { ageLooseGear } from './gear-weather'
import type { BaseLogisticsDef, Creature } from './types'
export const baseLogisticsDef=(w:World)=>w.db.get<BaseLogisticsDef>('BaseLogistics.Hearth')
export function basePickup(w:World,c:Creature,uid:number,preview=false):string|null{
 const task=w.s.map.baseCamp?.tasks[c.id],error=baseStoreError(w,c,false)
 if(error)return error
 if(!task||task.kind!=='haul'||!baseTaskActive(w,c,task.id)||task.remaining<=0||cheb(c.pos,w.s.map.baseCamp!.store)>baseCampDef(w).radius)return '유효한 운반 배정이 없다'
 const floor=tileAt(w,c.pos).items,source=floor.find((i)=>i.uid===uid&&i.def===task.item)
 if(!source)return '주울 실제 물품이 발밑에 없다'
 const count=Math.min(task.remaining,source.count),probe={...source,count,gx:undefined,gy:undefined,rot:undefined},shadow={db:w.db,s:{...w.s,nextId:-1}}
 if(gridAdd(shadow,{items:structuredClone(c.bag),w:10,h:6},structuredClone(probe)))return '받을 배낭에 자리가 없다'
 if(preview)return null
 ageLooseGear(w,source,c.pos)
 const moved=count===source.count?source:{...source,uid:w.s.nextId++,count}
 if(count===source.count)floor.splice(floor.indexOf(source),1);else source.count-=count
 delete moved.gx;delete moved.gy;delete moved.rot;gridAdd(w,{items:c.bag,w:10,h:6},moved);return null
}
export function startBaseGather(w:World,c:Creature,pos:Pos):string|null{
 const task=w.s.map.baseCamp?.tasks[c.id],error=baseStoreError(w,c,false)
 if(error)return error
 if(!task||task.kind!=='gather'||!baseTaskActive(w,c,task.id)||task.remaining<=0||!inBounds(w,pos)||cheb(pos,w.s.map.baseCamp!.store)>baseCampDef(w).radius||terrainAt(w,pos).gather?.item!==task.item||!canSee(w,c,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return '실제로 볼 수 있는 배정 자원이어야 한다'
 const source=terrainAt(w,pos).gather!,shadow={db:w.db,s:{...w.s,nextId:-1}}
 if(gridAdd(shadow,{items:structuredClone(c.bag),w:10,h:6},{uid:-1,def:source.item,count:source.count}))return '채집물을 받을 배낭 공간이 없다'
 const failure=startGather(w,c,pos,multiTurnFactor(w,c));if(failure)return failure
 c.activity!.baseOrder=task.id;return null
}
function accessible(w:World,c:Creature,pos:Pos,adjacent=false):Pos|undefined{
 const cells=adjacent?[{x:0,y:0},...DIRS].map((v)=>({x:pos.x+v.x,y:pos.y+v.y})):[pos]
 return cells.filter((p)=>inBounds(w,p)&&terrainAt(w,p).passable&&(!creatureAt(w,p)||creatureAt(w,p)!.id===c.id)&&hasLos(w,p,pos)&&(!adjacent||!diagonalBlocked(w,pos,p.x-pos.x,p.y-pos.y))&&(cheb(c.pos,p)===0||!!findPath(w,c.pos,p,{avoidCreatures:true,selfId:c.id,maxNodes:1200}))).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)[0]
}
export function baseLogisticsDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 const base=w.s.map.baseCamp,task=base?.tasks[c.id]
 if(!base||!task||!['haul','gather'].includes(task.kind))return null
 refreshBaseLogistics(w,task.item)
 if(!baseTaskActive(w,c,task.id))return null
 if(task.remaining<=0)return null
 const cargo=c.bag.find((i)=>i.def===task.item)
 if(cargo){if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)};const count=Math.min(cargo.count,task.remaining);return transferBase(w,c,'put',cargo.uid,count,true)?{action:{type:'wait'}}:{action:{type:'baseTransfer',direction:'put',uid:cargo.uid,count}}}
 const candidates:{pos:Pos;goal:Pos;uid?:number}[]=[],plots:{pos:Pos;goal:Pos}[]=[]
 for(let y=base.store.y-baseCampDef(w).radius;y<=base.store.y+baseCampDef(w).radius;y++)for(let x=base.store.x-baseCampDef(w).radius;x<=base.store.x+baseCampDef(w).radius;x++){
  const pos={x,y};if(!inBounds(w,pos)||!canSee(w,c,pos))continue
  if(task.kind==='haul'){
   const item=tileAt(w,pos).items.find((i)=>i.def===task.item),goal=item&&accessible(w,c,pos)
   if(item&&goal)candidates.push({pos,goal,uid:item.uid})
  }else if(terrainAt(w,pos).gather?.item===task.item&&(tileAt(w,pos).gatherAt??0)<=turnOf(w)){
   const crop=cultivationStatus(w,pos),goal=accessible(w,c,pos,true);if(goal){if(crop&&!crop.ready){if(crop.valid)plots.push({pos,goal})}else candidates.push({pos,goal})}
  }
 }
 candidates.sort((a,b)=>cheb(c.pos,a.goal)-cheb(c.pos,b.goal)||a.pos.y-b.pos.y||a.pos.x-b.pos.x)
 const target=candidates[0]
 if(!target)return baseCropCareDecision(w,c,plots)??{action:{type:'wait'}}
 if(task.kind==='haul')return cheb(c.pos,target.pos)===0?basePickup(w,c,target.uid!,true)?{action:{type:'wait'}}:{action:{type:'basePickup',uid:target.uid!}}:{goal:target.goal}
 return cheb(c.pos,target.pos)<=1&&!diagonalBlocked(w,c.pos,target.pos.x-c.pos.x,target.pos.y-c.pos.y)?{action:{type:'baseGather',pos:target.pos}}:{goal:target.goal}
}
/** 작업자도 실제 창고 음식/식수로 보급한다. 공공 배급 원장은 건드리지 않는다. */
export function baseWorkerSupply(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 const base=w.s.map.baseCamp,task=base?.tasks[c.id],d=companionDef(w)
 if(!base||!task||!baseTaskActive(w,c,task.id,false)||capacity(w,c,'manipulation')<.2)return null
 const hungry=c.needs.kcal<d.eatBelow,thirsty=c.needs.waterDeficit>=d.drinkAbove
 if(!hungry&&!thirsty)return null
 const items=tileAt(w,base.store).cont?.items??[],supply=thirsty?items.find((i)=>itemDef(w,i).drink&&!itemDef(w,i).drink!.alcohol&&!i.waterFrozen&&(i.uses??1)>0&&suitableDrink(w,i)&&(task.kind!=='water'||baseWaterSafe(w,i))):items.find((i)=>itemDef(w,i).food&&!itemDef(w,i).food!.raw&&!i.foodFrozen&&foodFreshness(i)>=baseLogisticsDef(w).minFreshness)
 if(!supply)return null
 if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)}
 return transferBase(w,c,'take',supply.uid,1,true)?null:{action:{type:'baseTransfer',direction:'take',uid:supply.uid,count:1}}
}

/** 같은 실제 채집 배정의 성장 중인 밭만 돌본다. 본인 음수와 유한 원래 용기·창고를 먼저 보존한다. */
export function baseCropCareDecision(w:World,c:Creature,plots:{pos:Pos;goal:Pos}[]):{action?:Action;goal?:Pos}|null{
 const rule=baseLogisticsDef(w).cultivation,base=w.s.map.baseCamp,task=base?.tasks[c.id],needs=companionDef(w)
 if(!rule||!base||!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id||task?.kind!=='gather'||!baseTaskActive(w,c,task.id)||c.activity||capacity(w,c,'manipulation')<.2||c.needs.kcal<needs.eatBelow||c.needs.waterDeficit>=needs.drinkAbove||c.needs.fatigue>=needs.sleepAt)return null
 const exhausted=plots.filter(({pos})=>{if(!inBounds(w,pos)||cheb(pos,base.store)>baseCampDef(w).radius||!canSee(w,c,pos)||terrainAt(w,pos).gather?.item!==task.item)return false;const crop=cultivationStatus(w,pos);return crop?.valid&&!!crop.rule!.substrate&&crop.state.remainingCycles===0}).sort((a,b)=>cheb(c.pos,a.goal)-cheb(c.pos,b.goal)||a.pos.y-b.pos.y||a.pos.x-b.pos.x)
 for(const target of exhausted){
  const substrate=cultivationStatus(w,target.pos)!.rule!.substrate!,own=c.bag.find(i=>i.def===substrate.item&&i.count>0)
  if(own){if(cheb(c.pos,target.pos)>1||diagonalBlocked(w,c.pos,target.pos.x-c.pos.x,target.pos.y-c.pos.y))return{goal:target.goal};if(!cultivationSubstrateQuote(w,c,target.pos,own.uid).error)return{action:{type:'refreshCropSubstrate',pos:target.pos,uid:own.uid}};continue}
  const source=tileAt(w,base.store).cont?.items.find(i=>i.def===substrate.item&&i.count>0)
  if(!source)continue
  if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)}
  if(!transferBase(w,c,'take',source.uid,1,true))return{action:{type:'baseTransfer',direction:'take',uid:source.uid,count:1}}
 }
 const targets=plots.filter(({pos})=>{if(!inBounds(w,pos)||cheb(pos,base.store)>baseCampDef(w).radius||!canSee(w,c,pos)||terrainAt(w,pos).gather?.item!==task.item)return false;const d=cultivationStatus(w,pos);return d?.valid&&!d.ready&&d.state.remainingCycles!==0&&d.waterMl<rule.waterBelowMl}).sort((a,b)=>cheb(c.pos,a.goal)-cheb(c.pos,b.goal)||a.pos.y-b.pos.y||a.pos.x-b.pos.x)
 const own=c.bag.filter(i=>i.count===1&&isWaterVessel(w,i)&&!i.waterFrozen&&suitableDrink(w,i)&&drinkVolume(w,i)>0),total=own.reduce((n,i)=>n+drinkVolume(w,i),0)
 for(const target of targets){
  const crop=cultivationStatus(w,target.pos)!,supplies=own.filter(i=>Number.isFinite(waterSalinity(waterQuality(w,i)))&&waterSalinity(waterQuality(w,i))<=crop.rule!.maxSalinity)
  for(const item of supplies){
   const ml=Math.min(rule.doseMl,Math.floor(crop.rule!.waterMl-crop.waterMl),drinkVolume(w,item),total-rule.reserveWaterMl)
   if(ml<=0)continue
   if(cheb(c.pos,target.pos)>1||diagonalBlocked(w,c.pos,target.pos.x-c.pos.x,target.pos.y-c.pos.y))return{goal:target.goal}
   if(!cultivationWaterQuote(w,c,target.pos,item.uid,ml).error)return{action:{type:'waterCrop',pos:target.pos,uid:item.uid,ml}}
  }
 }
 // 한 원래 물 용기만 꺼낸다. 이미 충분한 개인 물을 가지고 있다면 다른 용기를 더 쌓지 않는다.
 if(!targets.length||total>rule.reserveWaterMl&&targets.some(t=>own.some(i=>waterSalinity(waterQuality(w,i))<=cultivationStatus(w,t.pos)!.rule!.maxSalinity)))return null
 const stock=tileAt(w,base.store).cont?.items??[],source=stock.find(i=>i.count===1&&isWaterVessel(w,i)&&!i.waterFrozen&&suitableDrink(w,i)&&drinkVolume(w,i)>0&&targets.some(t=>waterSalinity(waterQuality(w,i))<=cultivationStatus(w,t.pos)!.rule!.maxSalinity))
 if(!source)return null
 if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)}
 return transferBase(w,c,'take',source.uid,1,true)?null:{action:{type:'baseTransfer',direction:'take',uid:source.uid,count:1}}
}
