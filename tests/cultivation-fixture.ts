import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {playerAct} from '../src/core/game'
import {tileAt,turnOf,type World} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {cultivationStatus} from '../src/core/cultivation'
import type {Action} from '../src/core/actions'
export function cultivationFixture(){
 const d=clinicalDiseaseFixture('shade-cultivation-physical',false),pos={x:21,y:20}
 d.s.storyteller.budget=-1e9;d.p.facing=2;d.s.map.daylightMult=.2;d.s.map.name='검은 잎 아래 재배 구획';d.s.map.lights=[]
 for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)tileAt(d.w,{x,y}).roof=false
 const seeds=d.add('Item.ShadeSeeds',3),water=d.add('Item.WaterBottle');water.uses=5;water.water={pathogen:0,ash:0,source:'처음 소지한 실제 담수'}
 // 초기 그늘/개인 종자와 물을 지정한 뒤 런타임 시계 캐시 없이 실제 입력을 시작한다.
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=s.creatures.find(c=>c.id===s.playerId)!
 invalidateLights(w);updatePlayerVision(w,p)
 const act=(action:Action,budget?:number)=>{const error=playerAct(w,action,budget);if(error)throw Error(error)},seed=()=>p.bag.find(i=>i.uid===seeds.uid)!,bottle=()=>p.bag.find(i=>i.uid===water.uid)!,crop=()=>cultivationStatus(w,pos)!
 return{w,s,p,pos,seedsUid:seeds.uid,waterUid:water.uid,act,seed,bottle,crop}
}
export type CultivationPhase='seed'|'dry'|'watered'|'nearRipe'|'pending'
export function cultivationNativeFixture(phase:CultivationPhase){
 const d=cultivationFixture()
 if(phase!=='seed')d.act({type:'place',uid:d.seedsUid,dir:2})
 if(['watered','nearRipe','pending'].includes(phase))d.act({type:'waterCrop',pos:d.pos,uid:d.waterUid,ml:1000})
 // nearRipe는 남은3성장턴과 현재3턴의 증발량을 포함한 유효 초기 밭이다. 이전28797턴의 플레이나 환경 이력을 실행했다고 주장하지 않는다.
 if(phase==='nearRipe'){d.crop().state.growth=d.crop().total-3;d.crop().state.waterUnits=3*d.crop().rule!.waterMl+Math.ceil(3*d.crop().evaporationMlPerHour*d.crop().total/1200);d.crop().state.lastAt=turnOf(d.w)}
 if(phase==='pending')d.act({type:'rest',turns:20},1)
 return{...d,proof:{phase,initialTime:d.s.time,seedUid:d.seedsUid,waterUid:d.waterUid,nearRipeIsDeclaredInitialState:phase==='nearRipe'}}
}
