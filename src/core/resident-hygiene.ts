// 자기 몸과 직접 본 개인 침구만 관리한다. 물·용기는 기존 현물을 쓴다.
import {bodyDef,capacity} from './body'
import {beddingMapKey} from './camping'
import {activeBeddingLice,beddingLiceRules} from './bedding-lice'
import {tileAt,turnOf,type World} from './ctx'
import {foodSafetyDef} from './food-state'
import {canSee,hasLos} from './fov'
import {eq} from './geom'
import {hasEffect} from './traits'
import {drinkVolume,washWaterSupply} from './wash-water'
import {isWaterVessel,waterCapacity} from './water-vessels'
import type {Creature,ResidentWaterDef} from './types'
const policy=(w:World)=>w.db.tryGet<ResidentWaterDef>('ResidentWater.Hearth')
function eligible(w:World,c:Creature){return !!policy(w)?.hygiene&&w.s.hygieneEnabled!==false&&c.id!==w.s.playerId&&c.alive&&!c.asleep&&!c.unconscious&&!c.captivity&&!c.activity&&!!c.residentSite&&c.residentSite===w.s.overworld?.currentRegion&&c.faction===w.s.overworld?.sites.find(s=>s.id===c.residentSite)?.faction&&!!beddingLiceRules(w)?.hostBodies.includes(bodyDef(w,c).id)&&capacity(w,c,'consciousness')>=.5&&capacity(w,c,'manipulation')>=.2}
function ownedBed(w:World,c:Creature){return w.s.map.residentBeds?.find(b=>b.owner===c.id&&!b.packedUid)}
function observedBed(w:World,c:Creature){
 const b=ownedBed(w,c)
 if(!b||!canSee(w,c,b.pos)||!hasLos(w,c.pos,b.pos))return undefined
 const tile=tileAt(w,b.pos),lice=activeBeddingLice(w,b.pos)
 return tile.t===b.terrain&&lice?{map:beddingMapKey(w),pos:{...b.pos},terrain:b.terrain,...(tile.placed?{uid:tile.placed.item.uid}:{}),sourceAt:lice.at}:undefined
}
/** AI가 직접 본 침구의 관찰만 기억한다. 화면/계획 조회에서는 호출하지 않는다. */
export function observeResidentHygiene(w:World,c:Creature){
 if(!eligible(w,c))return
 const bed=ownedBed(w,c),old=c.residentHygieneBed
 if(old&&(!bed||old.map!==beddingMapKey(w)||!eq(old.pos,bed.pos)||old.terrain!==bed.terrain))delete c.residentHygieneBed
 if(bed&&canSee(w,c,bed.pos)&&hasLos(w,c.pos,bed.pos)){
  const seen=observedBed(w,c)
  if(seen)c.residentHygieneBed=seen
  else delete c.residentHygieneBed
 }
}
export function residentHygieneGoal(w:World,c:Creature){
 const d=policy(w)?.hygiene
 if(!d||!eligible(w,c)||c.needs.bodyTemp<d.minBodyTemp||(c.residentHygieneAfter??0)>turnOf(w))return null
 if(c.needs.hygiene<d.washAt||hasEffect(c,'lice',turnOf(w)))return {kind:'body' as const,waterMl:foodSafetyDef(w).washWater}
 if(!d.bedding)return null
 const bed=ownedBed(w,c),memory=c.residentHygieneBed??observedBed(w,c)
 if(!bed||!memory||memory.map!==beddingMapKey(w)||!eq(memory.pos,bed.pos)||memory.terrain!==bed.terrain)return null
 if(canSee(w,c,bed.pos)&&hasLos(w,c.pos,bed.pos)){
  const seen=observedBed(w,c)
  if(!seen||seen.uid!==memory.uid||seen.sourceAt!==memory.sourceAt)return null
 }
 return {kind:'bedding' as const,waterMl:beddingLiceRules(w)!.washWaterMl,pos:{...memory.pos}}
}
export function residentHygieneSupply(w:World,c:Creature,ml:number){
 const supply=washWaterSupply(w,c,ml),vessels=c.bag.filter(i=>i.count===1&&isWaterVessel(w,i)),capacityMl=vessels.reduce((n,i)=>n+waterCapacity(w,i),0)
 const gap=Math.max(0,ml-supply.water),gain=(i:typeof vessels[number])=>waterCapacity(w,i)-(i.waterFrozen?0:drinkVolume(w,i))
 const fill=capacityMl>=ml?vessels.filter(i=>i.waterFrozen||drinkVolume(w,i)<waterCapacity(w,i)).sort((a,b)=>Number(gain(b)>=gap)-Number(gain(a)>=gap)||(gain(a)>=gap?gain(a)-gain(b):gain(b)-gain(a))||drinkVolume(w,a)-drinkVolume(w,b)||a.uid-b.uid)[0]:undefined
 return {...supply,capacityMl,fill}
}
export function delayResidentHygiene(w:World,c:Creature){c.residentHygieneAfter=turnOf(w)+(policy(w)?.retryTurns??1);c.residentReturning=true}
