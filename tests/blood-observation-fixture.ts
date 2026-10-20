import {victoryMemoryFixture} from './victory-memory-fixture'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {tileAt} from '../src/core/ctx'
export type BloodObservationPhase='blood'|'bloodlust'|'hidden'|'internal'|'attack'|'pending'
export function bloodObservationFixture(){
 const d=victoryMemoryFixture();d.enemy.body.blood=d.enemy.body.bloodMax
 return d
}
export function bloodObservationNativeFixture(phase:BloodObservationPhase){
 const d=bloodObservationFixture(),initialTime=d.s.time
 if(phase==='bloodlust')d.p.traits=['Trait.Bloodlust']
 if(phase==='hidden'){
  d.enemy.pos.x=d.p.pos.x+3
  for(let y=d.p.pos.y-4;y<=d.p.pos.y+4;y++)tileAt(d.w,{x:d.p.pos.x+1,y}).t='Terrain.RuinWall'
 }
 if(phase==='internal')d.wound.internal=true
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const error=playerAct(d.w,phase==='attack'?{type:'attack',target:d.enemy.id}:phase==='pending'?{type:'rest',turns:20}:{type:'wait'},phase==='pending'?2:undefined)
 if(error)throw Error(error)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,sourceId:d.enemy.id,woundId:d.wound.id,pending:phase==='pending'}}
}
