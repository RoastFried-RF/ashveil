import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {playerAct} from '../src/core/game'
import {tileAt,turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {createCreature} from '../src/core/creatures'
export type MentalContinuationPhase='dark'|'litNight'|'nightOwl'|'isolated'|'talk'|'prayer'
export function mentalContinuationNativeFixture(phase:MentalContinuationPhase){
 const d=conditionThoughtsFixture();let targetId:number|undefined,initialSilence:number|undefined
 if(['dark','litNight','nightOwl'].includes(phase)){d.s.time=0;d.p.nextAct=0;d.p.needs.nutritionDay=0}
 if(phase==='nightOwl')d.p.traits=['Trait.NightOwl']
 if(phase==='litNight'||phase==='prayer'){const pos={x:d.p.pos.x+2,y:d.p.pos.y};tileAt(d.w,pos).t='Terrain.Campfire';d.s.map.lights=[{pos,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]}
 if(phase==='isolated'||phase==='talk'){
  // 유효한 초기 장면의 기존 관찰 이력:12일차/11일 무대화. 과거 전체 생활을 실행했다는 뜻은 아니다.
  d.s.time=12*TURNS_PER_DAY*100;d.p.nextAct=d.s.time;d.p.needs.nutritionDay=12
  d.p.socialObservation={since:TURNS_PER_DAY};initialSilence=turnOf(d.w)-TURNS_PER_DAY
  if(phase==='talk'){const npc=createCreature(d.w,'Creature.SettlementDoctor',{x:d.p.pos.x+1,y:d.p.pos.y});npc.faction='player';npc.nextAct=1e12;npc.needs.nutritionDay=12;d.s.creatures.push(npc);targetId=npc.id}
 }
 if(phase==='prayer'){d.p.traits=['Trait.Pious'];d.s.weather='ashrain';tileAt(d.w,d.p.pos).roof=false}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const initialTime=d.s.time,error=playerAct(d.w,phase==='talk'?{type:'talk',target:targetId!}:phase==='prayer'?{type:'pray'}:{type:'wait'},phase==='prayer'?2:undefined)
 if(error)throw Error(error)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,initialSilence,targetId,actualTurns:(d.s.time-initialTime)/100,pending:phase==='prayer'}}
}
