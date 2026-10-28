import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {createCreature} from '../src/core/creatures'
import {tileAt,turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
export function corpseThoughtsFixture(old=true,distance=3,def='Creature.Reaver'){
 const d=conditionThoughtsFixture();d.s.time+=TURNS_PER_DAY*100;d.p.nextAct=d.s.time;d.p.needs.nutritionDay=Math.floor(turnOf(d.w)/TURNS_PER_DAY)
 const corpse=createCreature(d.w,def,{x:d.p.pos.x+distance,y:d.p.pos.y});corpse.alive=false;corpse.deathTurn=turnOf(d.w)-(old?TURNS_PER_DAY:0);corpse.scent=144;corpse.money=7;d.s.creatures.push(corpse)
 // 유효한 초기 부패/냄새 기록이다. 이 장면이 과거 하루를 실제 진행한 것으로 세지 않는다.
 const fire={x:d.p.pos.x,y:d.p.pos.y+2};tileAt(d.w,fire).t='Terrain.Campfire';d.s.map.lights=[{pos:fire,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,corpse}
}
export type CorpseThoughtPhase='odor'|'fresh'|'cold'|'far'|'search'|'scavenger'|'pending'
export function corpseThoughtNativeFixture(phase:CorpseThoughtPhase){
 const searching=['search','scavenger','pending'].includes(phase),d=corpseThoughtsFixture(phase!=='fresh'&&!searching,searching?1:phase==='far'?4:3),initialTime=d.s.time,originalBag=structuredClone(d.corpse.bag),originalEquip=structuredClone(d.corpse.equip),originalMoney=d.corpse.money
 if(phase==='cold')d.p.traits=['Trait.ColdBlooded']
 if(phase==='scavenger')d.p.background='Bg.Scavenger'
 const error=playerAct(d.w,searching?{type:'search'}:{type:'wait'},phase==='pending'?1:undefined);if(error)throw Error(error)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,corpseId:d.corpse.id,originalBag,originalEquip,originalMoney,validInitialOldCorpse:phase==='odor'||phase==='cold'||phase==='far',pending:phase==='pending'}}
}
