import {isWaterVessel,waterCapacity} from './water-vessels'
// 같은 물병을 실제 수원/정수 장소로 운반한다. 물과 도구/연료를 원격 생성하지 않는다.
import { multiTurnFactor } from './action-time'
import type { Action } from './actions'
import { approachBaseStore, baseStoreError, transferBase } from './base-camp'
import { baseCampDef, baseTaskActive } from './base-camp-state'
import { creatureAt, inBounds, terrainAt, tileAt, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb, DIRS, type Pos } from './geom'
import { diagonalBlocked, findPath } from './path'
import { fireWarmth } from './thermal'
import { drinkVolume } from './wash-water'
import { fillWaterBottle, nearbyWater, startWaterTreatment, waterTreatmentError } from './water'
import { waterQuality,waterBatches,waterResourcePlan, waterSafetyDef, drinkableSalinity, suitableDrink } from './water-state'
import type { BaseWaterDef, Creature, ItemInst, WaterTreatment } from './types'
export const baseWaterDef=(w:World)=>w.db.get<BaseWaterDef>('BaseWater.Hearth')
export function baseWaterSafe(w:World,i:ItemInst){const q=waterQuality(w,i);return isWaterVessel(w,i)&&!i.waterFrozen&&drinkVolume(w,i)>0&&q.pathogen===0&&q.ash<=baseWaterDef(w).maxAsh&&suitableDrink(w,i)}
export function refreshBaseWater(w:World){
 const base=w.s.map.baseCamp;if(!base||!Object.values(base.tasks).some((t)=>t.kind==='water'))return
 const ml=(tileAt(w,base.store).cont?.items??[]).reduce((n,i)=>n+(baseWaterSafe(w,i)?drinkVolume(w,i):0),0)
 for(const task of Object.values(base.tasks))if(task.kind==='water')task.remaining=Math.max(0,(task.waterTarget??0)-ml)
}
function access(w:World,c:Creature){const error=baseStoreError(w,c,false),task=w.s.map.baseCamp?.tasks[c.id];return error??(!task||task.kind!=='water'||!baseTaskActive(w,c,task.id)?'유효한 식수 작업 배정이 없다':null)}
export function takeBaseWaterBottle(w:World,c:Creature,uid:number):string|null{
 const error=access(w,c);if(error)return error
 const source=tileAt(w,w.s.map.baseCamp!.store).cont?.items.find((i)=>i.uid===uid&&isWaterVessel(w,i))
 if(!source)return '창고의 실제 물병이 아니다'
 const failure=transferBase(w,c,'take',uid,1);if(failure)return failure
 w.s.map.baseCamp!.tasks[c.id].waterBottle=uid;return null
}
export function fillBaseWater(w:World,c:Creature,uid:number,pos:Pos):string|null{
 const error=access(w,c);if(error)return error
 if(!inBounds(w,pos)||cheb(pos,w.s.map.baseCamp!.store)>baseCampDef(w).radius||!canSee(w,c,pos))return '실제로 보이는 거점 수원이어야 한다'
 const failure=fillWaterBottle(w,c,uid,pos);if(failure)return failure
 w.s.map.baseCamp!.tasks[c.id].waterBottle=uid;return null
}
export function treatBaseWater(w:World,c:Creature,uid:number,method:WaterTreatment):string|null{
 const error=access(w,c);if(error)return error
 if(!baseWaterDef(w).methods.includes(method)||method==='settle')return '배정한 식수 작업의 정수 방식이 아니다'
 const failure=startWaterTreatment(w,c,uid,method,multiTurnFactor(w,c));if(failure)return failure
 const task=w.s.map.baseCamp!.tasks[c.id];task.waterBottle=uid;c.activity!.baseOrder=task.id;c.activity!.woundCount=c.body.wounds.length;return null
}
function route(w:World,c:Creature,p:Pos){return cheb(c.pos,p)===0||!!findPath(w,c.pos,p,{avoidCreatures:true,selfId:c.id,maxNodes:1200})}
function neighbor(w:World,c:Creature,pos:Pos):Pos|undefined{return [{x:0,y:0},...DIRS].map((d)=>({x:pos.x+d.x,y:pos.y+d.y})).filter((p)=>inBounds(w,p)&&terrainAt(w,p).passable&&(!creatureAt(w,p)||creatureAt(w,p)!.id===c.id)&&hasLos(w,p,pos)&&!diagonalBlocked(w,pos,p.x-pos.x,p.y-pos.y)&&route(w,c,p)).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)[0]}
function sourceGoal(w:World,c:Creature){
 const base=w.s.map.baseCamp!,candidates:{pos:Pos;goal:Pos;score:number}[]=[]
 for(let y=base.store.y-baseCampDef(w).radius;y<=base.store.y+baseCampDef(w).radius;y++)for(let x=base.store.x-baseCampDef(w).radius;x<=base.store.x+baseCampDef(w).radius;x++){
  const pos={x,y};if(!inBounds(w,pos)||!terrainAt(w,pos).water||!canSee(w,c,pos))continue
  const goal=neighbor(w,c,pos),source=goal&&nearbyWater(w,{...c,pos:goal},pos)
  if(goal&&source&&drinkableSalinity(w,source.quality))candidates.push({pos,goal,score:source.quality.ash*10+source.quality.pathogen})
 }
 return candidates.sort((a,b)=>a.score-b.score||cheb(c.pos,a.goal)-cheb(c.pos,b.goal)||a.pos.y-b.pos.y||a.pos.x-b.pos.x)[0]
}
export function baseHeatGoal(w:World,c:Creature){
 const base=w.s.map.baseCamp!,candidates:Pos[]=[]
 for(let y=base.store.y-baseCampDef(w).radius;y<=base.store.y+baseCampDef(w).radius;y++)for(let x=base.store.x-baseCampDef(w).radius;x<=base.store.x+baseCampDef(w).radius;x++){const pos={x,y};if(inBounds(w,pos)&&terrainAt(w,pos).passable&&(!creatureAt(w,pos)||creatureAt(w,pos)!.id===c.id)&&canSee(w,c,pos)&&fireWarmth(w,{...c,pos})>=15&&route(w,c,pos))candidates.push(pos)}
 return candidates.sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)[0]
}
export function baseWaterDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 const base=w.s.map.baseCamp,task=base?.tasks[c.id];if(!base||task?.kind!=='water')return null
 refreshBaseWater(w);if(access(w,c))return null
 const stock=tileAt(w,base.store).cont?.items??[],owned=c.bag.filter(i=>isWaterVessel(w,i)),held=owned.find((i)=>i.uid===task.waterBottle)??owned.find((i)=>!baseWaterSafe(w,i)),refill=stock.filter((i)=>isWaterVessel(w,i)&&(!baseWaterSafe(w,i)||drinkVolume(w,i)<waterCapacity(w,i))).sort((a,b)=>drinkVolume(w,a)-drinkVolume(w,b)||a.uid-b.uid)[0]
 if(!held){
  if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)}
  if(refill){if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)};return{action:{type:'baseWaterTake',uid:refill.uid}}}
  const own=owned.find((i)=>baseWaterSafe(w,i));if(own){if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)};return{action:{type:'baseTransfer',direction:'put',uid:own.uid}}}
  return{action:{type:'wait'}}
 }
 const volume=drinkVolume(w,held),underfilled=volume<waterCapacity(w,held)&&volume<task.remaining
 if(volume<=0||underfilled||!suitableDrink(w,held)){const source=sourceGoal(w,c);if(!source)return{action:{type:'wait'}};return cheb(c.pos,source.pos)<=1&&!diagonalBlocked(w,c.pos,source.pos.x-c.pos.x,source.pos.y-c.pos.y)?{action:{type:'baseWaterFill',uid:held.uid,pos:source.pos}}:{goal:source.goal}}
 if(baseWaterSafe(w,held)){if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)};return transferBase(w,c,'put',held.uid,undefined,true)?{action:{type:'wait'}}:{action:{type:'baseTransfer',direction:'put',uid:held.uid}}}
 const q=waterQuality(w,held),methods=baseWaterDef(w).methods.filter((m)=>held.waterFrozen?m==='boil':q.ash>baseWaterDef(w).maxAsh?waterSafetyDef(w).treatments[m].ashMult<1:waterSafetyDef(w).treatments[m].pathogenMult===0)
 for(const method of methods){
  const batches=waterBatches(w,held),treatment=waterSafetyDef(w).treatments[method],tool=treatment.tool&&waterResourcePlan(c,treatment.tool,batches,true),fuel=treatment.fuel&&waterResourcePlan(c,treatment.fuel,batches)
  const need=treatment.tool&&!tool?treatment.tool:treatment.fuel&&!fuel?treatment.fuel:undefined
  if(need){if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)};const supply=stock.find((i)=>i.def===need&&(i.uses??1)>0);if(!supply)continue;return{action:{type:'baseTransfer',direction:'take',uid:supply.uid,count:1}}}
  if(method==='boil'&&fireWarmth(w,c)<15){const goal=baseHeatGoal(w,c);if(goal)return{goal};continue}
  if(!waterTreatmentError(w,c,held,method))return{action:{type:'baseWaterTreat',uid:held.uid,method}}
 }
 return{action:{type:'wait'}}
}
export function baseWaterStatus(w:World,c:Creature){const task=w.s.map.baseCamp?.tasks[c.id];if(task?.kind!=='water')return '';if(c.activity?.kind==='water')return '실제 물병을 정수하는 중이다';return task.remaining<=0?'실제 창고의 식수 목표를 채웠다':`병원체 없는 식수 목표${task.waterTarget}ml까지 ${task.remaining}ml가 더 필요하다. 물병·수원·정수 도구/연료를 확인하자.`}
