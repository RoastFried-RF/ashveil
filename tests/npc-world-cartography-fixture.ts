import {worldScoutingFixture} from './world-scouting-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {npcWorldMapPurchaseQuote} from '../src/core/npc-world-cartography'
export function npcWorldCartographyFixture(){
 const d=worldScoutingFixture();d.p.money=100;d.npc.money=7
 // 초기 유한 재료와 옛 지역을 식별할 수 없는 기존 계약의 유효한 원래 거처다. 과거 증여/계약 입력은 주장하지 않는다.
 d.npc.companion!.originHome={x:10,y:42}
 const reserve=makeItem(d.w,'Item.Note');if(addToBag(d.w,d.npc,reserve))throw Error('original NPC reserve paper')
 d.act({type:'leave'});d.act({type:'wait'});d.approach()
 const originalWorldObservation=structuredClone(d.npc.worldScouting!),dismiss=()=>d.act({type:'dismissCompanion',target:d.npc.id}),paper=()=>d.npc.bag.find(i=>i.uid===d.paperUid),ink=()=>d.npc.bag.find(i=>i.uid===d.inkUid),finish=()=>{for(let i=0;!paper()?.note&&i<200;i++)d.act({type:'wait'});if(!paper()?.note)throw Error('independent NPC original world map unfinished')}
 return{...d,reserve,originalWorldObservation,dismiss,paper,ink,finish,quote:()=>npcWorldMapPurchaseQuote(d.w,d.p,d.npc,d.paperUid)}
}
export type NpcWorldCartographyPhase='employed'|'drawing'|'drawn'|'purchased'|'read'|'pending'
export function npcWorldCartographyNativeFixture(phase:NpcWorldCartographyPhase){
 const d=npcWorldCartographyFixture(),initialTime=d.s.time
 if(phase!=='employed')d.dismiss()
 if(['drawn','purchased','read'].includes(phase))d.finish()
 if(phase==='purchased'||phase==='read'){const q=d.quote();d.act({type:'buyNpcWorldMap',target:d.npc.id,uid:d.paperUid,expectedPrice:q.price})}
 if(phase==='read')d.act({type:'read',uid:d.paperUid})
 if(phase==='pending')d.act({type:'rest',turns:80},4)
 return{...d,proof:{phase,initialTime,actualElapsedTU:d.s.time-initialTime,originalNpcId:d.npc.id,paperUid:d.paperUid,inkUid:d.inkUid,reserveUid:d.reserve.uid,initialNpcCash:7,initialPlayerCash:100,actualInitialNpcObservationAt:14401}}
}
