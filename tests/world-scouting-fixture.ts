import {companionCartographyFixture} from './companion-cartography-fixture'
import {enableOverworld,worldIndex} from '../src/core/overworld'
import {player,turnOf} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {playerAct} from '../src/core/game'
import {cheb} from '../src/core/geom'
import {meetingStep} from './first-impressions-fixture'
import {initializeClimate} from '../src/core/climate'
import {initializeWorldSimulation} from '../src/core/world-simulation'
export function worldScoutingFixture(){
 const d=companionCartographyFixture('world-scouting-proof'),m=enableOverworld(d.w),index=worldIndex(m,m.position),old=structuredClone(m.worldObservations![index]!)
 initializeClimate(d.w);initializeWorldSimulation(d.w)
 // 초기부터 동의한 동료와 실제 출입구. 처음 받은 옛 지리 기록과 달라진 현재 지형이며 과거 이동/변화를 실행했다고 주장하지 않는다.
 d.p.pos={...d.s.map.exits[0]};d.npc.pos={...d.s.map.exits[1]};d.npc.companion!.order='follow';d.npc.companion!.anchor={...d.npc.pos};delete d.npc.fieldMaps;delete d.npc.worldScouting
 old.at=Math.max(0,turnOf(d.w)-600);m.worldObservations![index]=structuredClone(old);m.cells[index]!.temperature=old.cell.temperature+9
 const w={db:d.w.db,s:deserialize(serialize(d.s))},p=player(w),npc=w.s.creatures.find(c=>c.id===d.npc.id)!,act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(w,a,budget);if(e)throw Error(e)}
 const approach=()=>{for(let i=0;cheb(p.pos,npc.pos)>1&&i<20;i++){const a=meetingStep(w,npc);act(a??{type:'wait'})}if(cheb(p.pos,npc.pos)>1)throw Error('actual scout approach')}
 return{w,s:w.s,p,npc,m:w.s.overworld!,index,old,act,approach,paperUid:d.paper.uid,inkUid:d.ink.uid}
}
export type WorldScoutingPhase='inside'|'outside'|'heard'|'surveyed'|'pending'
export function worldScoutingNativeFixture(phase:WorldScoutingPhase){
 const d=worldScoutingFixture(),initialTime=d.s.time
 if(phase!=='inside'){d.act({type:'leave'});d.act({type:'wait'});d.approach()}
 if(['heard','surveyed','pending'].includes(phase))d.act({type:'talk',target:d.npc.id})
 if(phase==='surveyed')d.act({type:'surveyWorld'})
 if(phase==='pending')d.act({type:'rest',turns:20},4)
 return{...d,proof:{phase,initialTime,actualElapsedTU:d.s.time-initialTime,initialOldGeographyAndCompanionExplicit:true}}
}
