// 자기 시야/기억·실물 밧줄·실제 호송만 쓰는 현지 NPC의 포획 원정.
import type {Action} from './actions'
import {bodyDef,capacity} from './body'
import {effectiveFaction,isCompanion} from './companion-state'
import {inBounds,player,terrainAt,turnOf,type World} from './ctx'
import {hostile} from './diplomacy'
import {canSee,hasLos} from './fov'
import {knownFireDanger} from './fire-avoidance'
import {cheb,dirIndex,type Pos} from './geom'
import {unequipError} from './items'
import {findPath} from './path'
import {endEscort,escortHand,prisonerEscortDef} from './prisoner-escort'
import {prisonerDef} from './prisoner-state'
import {prisonerQuote} from './prisoners'
import type {Creature,NpcAbductionDef} from './types'
export const npcAbductionDef=(w:World)=>w.db.get<NpcAbductionDef>('NpcAbduction.Hearth')
function eligible(w:World,c:Creature){
 const d=npcAbductionDef(w)
 return c!==player(w)&&w.s.creatures.includes(c)&&c.alive&&!isCompanion(w,c)&&!c.caravan&&!c.roadRaid&&!c.captivity&&!c.asleep&&!c.unconscious&&!c.activity&&(c.mapId===undefined||c.mapId===w.s.map.id)&&d.roles.includes(w.db.creature(c.def).ai)&&bodyDef(w,c).kind==='humanoid'&&!['flee','surrender','calm'].includes(c.ai.mode)&&capacity(w,c,'consciousness')>=.5&&capacity(w,c,'manipulation')>=.2&&c.needs.kcal>=d.minKcal&&c.needs.waterDeficit<d.maxWaterDeficit&&c.needs.fatigue<d.maxFatigue
}
function visible(w:World,c:Creature,target:Creature){return(target.mapId===undefined||target.mapId===w.s.map.id)&&hasLos(w,c.pos,target.pos)&&canSee(w,c,target.pos)}
function catchable(w:World,c:Creature,target:Creature){return target!==player(w)&&target!==c&&target.alive&&!target.captivity&&bodyDef(w,target).kind==='humanoid'&&hostile(w,c,target)&&(target.unconscious||target.ai.mode==='surrender'&&!target.asleep&&!target.activity)&&visible(w,c,target)}
export function planNpcAbduction(w:World,c:Creature,targetId:number):string|null{
 const target=w.s.creatures.find(o=>o.id===targetId),home=c.home,d=npcAbductionDef(w),rope=c.bag.find(i=>i.def===prisonerDef(w).rope&&i.count>0&&(i.durability??100)>0)
 if(!eligible(w,c)||c.abduction||c.leading||!home||!inBounds(w,home)||!terrainAt(w,home).passable||!target||!catchable(w,c,target)||cheb(c.pos,target.pos)>d.approachRange||!rope)return'현지의 실제 포획 대상·자기 거처와 밧줄을 확인해야 한다'
 c.abduction={target:target.id,ropeUid:rope.uid,started:turnOf(w),mapId:w.s.map.id,region:w.s.overworld?.currentRegion,home:{...home},lastSeen:{...target.pos}};return null
}
export function finishNpcAbduction(w:World,c:Creature):string|null{
 if(c===player(w)||!w.s.creatures.includes(c)||!c.abduction)return'진행 중인 실제 NPC 포획이 없다'
 const target=w.s.creatures.find(o=>o.id===c.abduction!.target);if(target?.captivity?.captor===c.id&&target.captivity.rope.uid===c.abduction.boundRopeUid)endEscort(w,target)
 c.abduction=undefined;return null
}
export function rememberAbductionBind(w:World,c:Creature,target:Creature,reservedUid:number,actualUid:number){
 const job=c.abduction;if(!job||c===player(w)||!w.s.creatures.includes(c)||!w.s.creatures.includes(target)||job.target!==target.id||job.ropeUid!==reservedUid||job.mapId!==w.s.map.id||job.region!==w.s.overworld?.currentRegion||target.captivity?.captor!==c.id||target.captivity.rope.uid!==actualUid)return
 job.boundRopeUid=actualUid
}
function toward(w:World,c:Creature,pos:Pos):Action|null{
 const next=findPath(w,c.pos,pos,{avoidCreatures:true,selfId:c.id,maxNodes:1200,avoidCells:knownFireDanger(w,c)})?.[0];return next?{type:'move',dir:dirIndex(next.x-c.pos.x,next.y-c.pos.y)}:null
}
export function npcAbductionAction(w:World,c:Creature,threats:Creature[]):Action|null{
 if(!eligible(w,c)||threats.some(o=>o.alive&&!o.asleep&&!o.unconscious&&!o.captivity&&o.ai.mode!=='surrender'))return null
 const d=npcAbductionDef(w),job=c.abduction
 if(!job){
  if(c.leading||!c.home)return null
  const target=w.s.creatures.filter(o=>catchable(w,c,o)&&cheb(c.pos,o.pos)>1&&cheb(c.pos,o.pos)<=d.approachRange).sort((a,b)=>cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.id-b.id)[0]
  return target&&c.bag.some(i=>i.def===prisonerDef(w).rope&&i.count>0&&(i.durability??100)>0)?{type:'npcAbductionPlan',target:target.id}:null
 }
 if(job.mapId!==w.s.map.id||job.region!==w.s.overworld?.currentRegion)return{type:'npcAbductionEnd'}
 const target=w.s.creatures.find(o=>o.id===job.target),seen=target&&visible(w,c,target)
 if(!seen){return cheb(c.pos,job.lastSeen)<=1?{type:'npcAbductionEnd'}:toward(w,c,job.lastSeen)??{type:'npcAbductionEnd'}}
 if(!target.alive)return{type:'npcAbductionEnd'}
 // 다음 실제 이동 명령에서만 새 목격 위치를 기록한다. 질의 자체는 바꾸지 않는다.
 if(target.pos.x!==job.lastSeen.x||target.pos.y!==job.lastSeen.y)return{type:'npcAbductionObserve',target:target.id}
 if(!target.captivity){
  if(!catchable(w,c,target))return{type:'npcAbductionEnd'}
  if(cheb(c.pos,target.pos)>1)return toward(w,c,target.pos)??{type:'npcAbductionEnd'}
  return prisonerQuote(w,c,target,'bind',job.ropeUid).error?{type:'npcAbductionEnd'}:{type:'prisoner',operation:'bind',target:target.id,ropeUid:job.ropeUid}
 }
 if(target.captivity.captor!==c.id||target.captivity.faction!==effectiveFaction(w,c)||target.captivity.rope.uid!==job.boundRopeUid)return{type:'npcAbductionEnd'}
 if(cheb(c.pos,job.home)<=d.homeRadius&&cheb(target.pos,job.home)<=d.homeRadius){
  if(target.captivity.anklesFree&&cheb(c.pos,target.pos)<=1&&!prisonerQuote(w,c,target,'hold').error)return{type:'prisoner',operation:'hold',target:target.id}
  return target.captivity.anklesFree?{type:'wait'}:{type:'npcAbductionEnd'}
 }
 if(target.unconscious||target.asleep||capacity(w,target,'consciousness')<.5)return{type:'wait'}
 if(!target.captivity.escort){
  if(cheb(c.pos,target.pos)>1)return toward(w,c,target.pos)??{type:'wait'}
  if(!escortHand(w,c,target))for(const slot of ['off','main']as const)if(c.equip[slot]&&!unequipError(w,c,slot))return{type:'unequip',slot,expectedUid:c.equip[slot]!.uid}
  return prisonerQuote(w,c,target,'escort').error?{type:'wait'}:{type:'prisoner',operation:'escort',target:target.id}
 }
 if(cheb(c.pos,target.pos)>=prisonerEscortDef(w).leashRadius)return{type:'wait'}
 return toward(w,c,job.home)??{type:'wait'}
}
export function observeAbductionTarget(w:World,c:Creature,id:number):string|null{
 const target=w.s.creatures.find(o=>o.id===id);if(!eligible(w,c)||c.abduction?.target!==id||!target||!visible(w,c,target))return'같은 포획 대상의 실제 모습을 확인해야 한다'
 c.abduction.lastSeen={...target.pos};return null
}
