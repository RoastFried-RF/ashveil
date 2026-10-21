import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {playerAct} from '../src/core/game'
import {player,tileAt,turnOf,type World} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {cultivationStatus} from '../src/core/cultivation'
import type {Action} from '../src/core/actions'
import {perform} from '../src/core/actions'
import {makeItem,addToBag} from '../src/core/items'
import {startFireWork,campfireAt} from '../src/core/campfire'
import {finishBase} from './base-camp-fixture'

export type OatPhase='seed'|'dry'|'watered'|'nearRipe'|'pending'
export function oatCultivationFixture(phase:OatPhase='seed',polluted=false){
 const d=clinicalDiseaseFixture('actual-oat-cultivation-299',false),pos={x:21,y:20}
 d.p.background=undefined;d.p.skills={};d.p.facing=2;d.s.storyteller.budget=-1e9;d.s.map.daylightMult=1;d.s.map.name='귀리·실제 종자와 유한 관수'
 for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)tileAt(d.w,{x,y}).roof=false
 const seeds=d.add('Item.OatSeed',3),bottle=d.add('Item.WaterBottle'),clean=d.add('Item.Oats',2)
 bottle.uses=5;bottle.water={pathogen:polluted?60:0,ash:polluted?20:0,source:polluted?'처음 가진 실제 관수용 오염수':'처음 가진 실제 담수'}
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=player(w)
 const act=(action:Action,budget?:number)=>{const error=playerAct(w,action,budget);if(error)throw Error(error)}
 const seed=()=>p.bag.find(i=>i.uid===seeds.uid)!,water=()=>p.bag.find(i=>i.uid===bottle.uid)!,crop=()=>cultivationStatus(w,pos)!
 if(phase!=='seed')act({type:'place',uid:seeds.uid,dir:2})
 if(['watered','nearRipe','pending'].includes(phase))act({type:'waterCrop',pos,uid:bottle.uid,ml:1000})
 // 별도 유한 초기 상태다. 이전143997유효성장턴/관수·환경 이력을 실행했다고 주장하지 않는다.
 if(phase==='nearRipe'){crop().state.growth=crop().total-3;crop().state.waterUnits=3*crop().rule!.waterMl+Math.ceil(3*crop().evaporationMlPerHour*crop().total/1200);crop().state.lastAt=turnOf(w)}
 if(phase==='pending')act({type:'rest',turns:20},1)
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,pos,seedsUid:seeds.uid,waterUid:bottle.uid,cleanUid:clean.uid,seed,water,crop,act,proof:{phase,polluted,initialTime:s.time,declaredSeedCount:3,originalSeedUid:seeds.uid,originalWaterUid:bottle.uid,declaredWaterMl:1000,declaredCleanGrain:{uid:clean.uid,count:2},nearRipeIsDeclaredInitialState:phase==='nearRipe',source:'FiniteactualnewGame(nooverworld)/originalplayer, declarednoon/healthybody/pausedstory/clear7x7soil/sun/initialOatSeed3+water1000ml+cleanOats2. NearRipe growthtotal-3/finitewater explicitlydeclared, not past5days replay. No postloadworld/time/RNG/material injection in Native.'}}
}

export function oatCultivationNativeFixture(mode:'seed'|'nearRipe'|'legacy202'){
 const d=oatCultivationFixture(mode==='nearRipe'?'nearRipe':'seed',mode==='nearRipe')
 const add=(id:string,count=1)=>{const it=makeItem(d.w,id,count);if(addToBag(d.w,d.p,it))throw Error('finite oat initial bag');return it}
 let cooking:undefined|{bowlUid:number;bottleUid:number;kitUid:number;woodUid:number;fireUid:number;pos:{x:number;y:number}}
 if(mode==='nearRipe'){
  // 별도 유한 초기 조리 재료와 실제 설치·점화된 원래 불이다. UI 이후에는 주입하지 않는다.
  const kit=add('Item.CampfireKit'),wood=add('Item.Wood'),pos={x:19,y:20},bowl=add('Item.Bowl'),bottle=add('Item.WaterBottle')
  bowl.quality=3;bowl.durability=81;bottle.uses=3;bottle.water={pathogen:0,ash:0,source:'초기 조리용 담수600ml'}
  const placed=perform(d.w,d.p,{type:'place',uid:kit.uid,dir:6});if(!placed.ok)throw Error(placed.msg)
  const error=startFireWork(d.w,d.p,pos,wood.uid);if(error)throw Error(error);finishBase(d.w,d.p)
  cooking={bowlUid:bowl.uid,bottleUid:bottle.uid,kitUid:kit.uid,woodUid:wood.uid,fireUid:campfireAt(d.w,pos)!.uid,pos}
 }
 if(mode==='legacy202'){tileAt(d.w,d.pos).t='Terrain.OatPlot';tileAt(d.w,d.pos).gatherAt=turnOf(d.w)+1}
 d.s.fx=[];invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return{...d,cooking,proof:{...d.proof,mode,cooking,legacyNearDeadlineDeclared:mode==='legacy202',extraInitialCookingMaterials:mode==='nearRipe'?'OriginalnewKit1/Wood1/Bowl1quality3dur81/freshwater600ml; actualKernelplace/fireworkfinish in finiteinitialscene, no worldclock advance or pastnormalplay claim. Originalcrop1000ml separate and already spent.':undefined}}
}
