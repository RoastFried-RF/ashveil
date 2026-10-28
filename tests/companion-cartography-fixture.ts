import {mapWritingFixture} from './map-writing-fixture'
import {createCreature} from '../src/core/creatures'
import {enlistRecruit} from '../src/core/companions'
import {addToBag} from '../src/core/items'
import {hpMax} from '../src/core/body'
import {playerAct} from '../src/core/game'
import {npcFieldMap} from '../src/core/npc-map-memory'
export function companionCartographyFixture(seed='map-writing-proof'){
 const d=mapWritingFixture(seed),npc=createCreature(d.w,'Creature.SettlementGuard',{x:d.p.pos.x+1,y:d.p.pos.y})
 npc.faction='coalition';npc.nextAct=d.s.time;npc.traits=[];npc.background=undefined;npc.age=undefined;npc.bag=[];npc.equip={};npc.body.wounds=[];npc.body.missing=[];npc.effects=[];npc.traumas=[];npc.asleep=false;npc.unconscious=false;npc.literacy=2;npc.literate=true;npc.stats={str:10,agi:10,vit:10,per:10,wil:10};npc.hp=hpMax(d.w,npc);npc.skills={survival:0}
 Object.assign(npc.needs,{kcal:1000,waterDeficit:0,fatigue:20,sleepDebt:0,stress:0,bodyTemp:37,wetness:0,vitamin:100,protein:100})
 d.s.creatures.push(npc);enlistRecruit(d.w,npc,1);npc.companion!.order='hold';npc.companion!.anchor={...npc.pos}
 // 유효한 초기 동의 동료와 그 사람의 원래 재료다. 이전 돌봄/영입/전달 턴을 실행했다고 주장하지 않는다.
 d.p.bag=d.p.bag.filter(i=>i!==d.paper&&i!==d.ink);if(addToBag(d.w,npc,d.paper)||addToBag(d.w,npc,d.ink))throw Error('동료 원래 재료')
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 const request=()=>act({type:'companionMap',target:npc.id,operation:'start',paperUid:d.paper.uid,inkUid:d.ink.uid})
 const finish=()=>{for(let i=0;!d.paper.note&&i<400;i++)act({type:'wait'});if(!d.paper.note)throw Error('동료 지도 미완료')}
 return{...d,npc,act,request,finish}
}
export type CompanionCartographyPhase='unobserved'|'quote'|'drawing'|'stopped'|'drawn'|'collected'|'read'|'pending'
export function companionCartographyNativeFixture(phase:CompanionCartographyPhase){
 const d=companionCartographyFixture(),initialTime=d.s.time
 if(phase!=='unobserved')d.act({type:'wait'})
 if(phase!=='unobserved'&&!npcFieldMap(d.w,d.npc)?.rooms.length)throw Error('동료의 실제 방 관찰 없음')
 if(!['unobserved','quote'].includes(phase))d.request()
 if(phase==='stopped'){for(let i=0;i<9;i++)d.act({type:'wait'});d.act({type:'companionMap',target:d.npc.id,operation:'stop'})}
 if(['drawn','collected','read'].includes(phase))d.finish()
 if(phase==='collected'||phase==='read')d.act({type:'companionMap',target:d.npc.id,operation:'collect',paperUid:d.paper.uid})
 if(phase==='read')d.act({type:'read',uid:d.paper.uid})
 if(phase==='pending')d.act({type:'rest',turns:80},2)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,npcId:d.npc.id,paperUid:d.paper.uid,inkUid:d.ink.uid,initialInk:3,pending:phase==='pending',initialCompanionAndMaterialsExplicit:true}}
}
