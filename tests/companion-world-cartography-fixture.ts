import {worldScoutingNativeFixture} from './world-scouting-fixture'
import {companionWorldMapQuote} from '../src/core/companion-world-cartography'
export function companionWorldCartographyFixture(){
 const d=worldScoutingNativeFixture('outside'),q=()=>companionWorldMapQuote(d.w,d.npc),request=()=>{const quote=q();d.act({type:'companionWorldMap',target:d.npc.id,operation:'start',paperUid:quote.paperUid,inkUid:quote.inkUid})},paper=()=>d.npc.bag.find(i=>i.uid===d.paperUid)!,ink=()=>d.npc.bag.find(i=>i.uid===d.inkUid),finish=()=>{for(let i=0;!paper().note&&i<200;i++)d.act({type:'wait'});if(!paper().note)throw Error('companion original world map unfinished')}
 return{...d,q,request,paper,ink,finish}
}
export type CompanionWorldCartographyPhase='quote'|'drawing'|'stopped'|'drawn'|'collected'|'read'|'pending'
export function companionWorldCartographyNativeFixture(phase:CompanionWorldCartographyPhase){
 const d=companionWorldCartographyFixture(),initialTime=d.s.time
 if(phase!=='quote')d.request()
 if(phase==='stopped'){for(let i=0;i<9;i++)d.act({type:'wait'});d.act({type:'companionWorldMap',target:d.npc.id,operation:'stop'})}
 if(['drawn','collected','read'].includes(phase))d.finish()
 if(phase==='collected'||phase==='read')d.act({type:'companionWorldMap',target:d.npc.id,operation:'collect',paperUid:d.paperUid})
 if(phase==='read')d.act({type:'read',uid:d.paperUid})
 if(phase==='pending')d.act({type:'rest',turns:80},4)
 return{...d,proof:{phase,initialTime,actualElapsedTU:d.s.time-initialTime,paperUid:d.paperUid,inkUid:d.inkUid,originalNpcId:d.npc.id,actualInitialNpcObservationAt:14401}}
}
