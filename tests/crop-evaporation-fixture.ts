import {playerAct} from '../src/core/game'
import type {Action} from '../src/core/actions'
import {cultivationStatus} from '../src/core/cultivation'
import {cultivationNativeFixture,type CultivationPhase} from './cultivation-fixture'
import {tileAt,player,type World} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
export type EvaporationPhase='dry'|'watered'|'roof'|'cold'|'nearRipe'|'pending'
export function cropEvaporationFixture(phase:EvaporationPhase='dry'){
 const source:CultivationPhase=phase==='roof'||phase==='cold'?'watered':phase,d=cultivationNativeFixture(source)
 if(phase==='roof')tileAt(d.w,d.pos).roof=true
 if(phase==='cold'){d.s.time=(28800+5*1200)*100;d.p.nextAct=d.s.time;d.s.map.daylightMult=1}
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=s.creatures.find(c=>c.id===s.playerId)!
 invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,pos:d.pos,seedsUid:d.seedsUid,waterUid:d.waterUid,act:(action:Action,budget?:number)=>{const error=playerAct(w,action,budget);if(error)throw Error(error)},crop:()=>cultivationStatus(w,d.pos)!,seed:()=>player(w).bag.find(i=>i.uid===d.seedsUid)!,bottle:()=>player(w).bag.find(i=>i.uid===d.waterUid)!,proof:{...d.proof,evaporationPhase:phase,declaredIsolatedCultivationTestPlot:true,noClaimOfActualEarlierSeasonOrEarlierGrowthHistory:true,declaredCover:phase==='roof',declaredColdSchedule:phase==='cold',initialRendererFx:s.fx.splice(0)}}
}
