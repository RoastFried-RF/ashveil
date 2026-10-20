import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
import {emitNoise} from '../src/core/perception'
export function sleepMemoryFixture(bed=true){
 const d=conditionThoughtsFixture(),pos={x:d.p.pos.x+2,y:d.p.pos.y}
 if(bed)tileAt(d.w,d.p.pos).t='Terrain.Bed'
 tileAt(d.w,pos).t='Terrain.Campfire';d.s.map.lights=[{pos,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]
 d.p.needs.fatigue=60;invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return d
}
export type SleepMemoryPhase='well'|'ground'|'wet'|'poor'|'noise'|'pending'
export function sleepMemoryNativeFixture(phase:SleepMemoryPhase){
 const d=sleepMemoryFixture(!['ground','wet'].includes(phase)),initialTime=d.s.time
 if(phase==='wet'){d.wet(60);d.p.needs.wetness=60}
 if(phase==='poor'){d.s.map.lights=[];d.p.needs.fatigue=15.01;invalidateLights(d.w)}
 if(phase==='pending')d.p.needs.fatigue=15.05
 const error=playerAct(d.w,{type:'sleep'},2);if(error)throw Error(error)
 const observation=structuredClone(d.p.sleepObservation)
 if(phase==='noise')emitNoise(d.w,d.p.pos,40,-1)
 if(phase!=='pending'){const stop=playerAct(d.w,{type:'stopActivity'});if(stop)throw Error(stop)}
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,observation,pending:phase==='pending'}}
}
