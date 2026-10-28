import {npcCartographyFixture} from './npc-cartography-fixture'
import {makeWorld} from './helpers'
import {ensureSociety} from '../src/core/diplomacy'
import {npcMapPurchaseQuote} from '../src/core/npc-cartography'
export function mapFraudFixture(seed='map-fraud-proof-0'){
 const d=npcCartographyFixture(seed)
 // 처음부터 우호 관계인 비고용 약탈단 필경사와 원래 개인 재료의 유효 초기 상태다.
 d.s.overworld=makeWorld(seed,undefined,true).s.overworld;d.npc.faction='reavers';d.npc.name='약탈단 필경사';ensureSociety(d.w)!.reputation.reavers=0
 return {...d}
}
export type MapFraudPhase='initial'|'drawn'|'purchased'|'read'|'pending'
export function mapFraudNativeFixture(phase:MapFraudPhase,seed='map-fraud-proof-0'){
 const d=mapFraudFixture(seed),initialTime=d.s.time
 if(phase!=='initial')d.act({type:'wait'})
 if(['drawn','purchased','read'].includes(phase))d.finish()
 if(phase==='purchased'||phase==='read'){const q=npcMapPurchaseQuote(d.w,d.p,d.npc,d.paper.uid);d.act({type:'buyNpcMap',target:d.npc.id,uid:d.paper.uid,expectedPrice:q.price})}
 if(phase==='read')d.act({type:'read',uid:d.paper.uid})
 if(phase==='pending')d.act({type:'rest',turns:80},2)
 return {...d,proof:{phase,seed,initialTime,actualElapsedTU:d.s.time-initialTime,paperUid:d.paper.uid,npcId:d.npc.id,initialFriendlyScribeAndOriginalMaterialsExplicit:true}}
}
