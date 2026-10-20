import {companionCartographyFixture} from './companion-cartography-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {npcMapPurchaseQuote} from '../src/core/npc-cartography'
export function npcCartographyFixture(seed='map-writing-proof'){
 const d=companionCartographyFixture(seed)
 // 유효 초기의 비고용 우호 인물과 개인 소지품이다. 실제 영입/해고/선물 입력을 실행했다고 주장하지 않는다.
 delete d.npc.companion;d.npc.faction='player';d.npc.home={...d.npc.pos};d.npc.ai.mode='guard';d.npc.money=7;d.p.money=100;d.npc.met=false;delete d.npc.firstImpressions
 const reserve=makeItem(d.w,'Item.Note');if(addToBag(d.w,d.npc,reserve))throw Error('초기 추가 원래 종이')
 const finish=()=>{for(let i=0;!d.paper.note&&i<200;i++)d.act({type:'wait'});if(!d.paper.note)throw Error('독립NPC 지도 미완료')}
 return {...d,reserve,finish}
}
export type NpcCartographyPhase='initial'|'drawing'|'drawn'|'purchased'|'read'|'pending'
export function npcCartographyNativeFixture(phase:NpcCartographyPhase){
 const d=npcCartographyFixture(),initialTime=d.s.time
 if(phase!=='initial')d.act({type:'wait'})
 if(['drawn','purchased','read'].includes(phase))d.finish()
 const quote=()=>npcMapPurchaseQuote(d.w,d.p,d.npc,d.paper.uid)
 if(phase==='purchased'||phase==='read')d.act({type:'buyNpcMap',target:d.npc.id,uid:d.paper.uid,expectedPrice:quote().price})
 if(phase==='read')d.act({type:'read',uid:d.paper.uid})
 if(phase==='pending')d.act({type:'rest',turns:80},2)
 return {...d,quote,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,npcId:d.npc.id,paperUid:d.paper.uid,inkUid:d.ink.uid,reserveUid:d.reserve.uid,independentInitialAllyAndMaterialsExplicit:true}}
}
