import {firstImpressionsFixture} from './first-impressions-fixture'
import {serialize,deserialize} from '../src/core/save'
import {player,turnOf,START_TURN,type World} from '../src/core/ctx'
import {playerAct} from '../src/core/game'
import {merchantMapRequestQuote} from '../src/core/npc-map-shop-supplies'
import {npcMapPurchaseQuote} from '../src/core/npc-cartography'
export function merchantMapFixture(){
 const source=firstImpressionsFixture(),w:World={db:source.w.db,s:deserialize(serialize(source.w.s))},s=w.s,p=player(w),m=s.overworld!,npc=s.creatures.find(c=>c.id===source.trader.id)!,market=m.markets![npc.traderSite!]
 // 유효 초기의 원래 지역/상인/재고다. 이전 입장/시간 경과의 입력을 이 검사에서 실행했다고 주장하지 않는다.
 // 생성 도우미의 실제 입장 시각보다 이르게 되돌리지 않고, 처음 기록할 인물의 과거 관찰을 준비하지 않는다.
 s.time=Math.max(s.time,(START_TURN+1)*100)
 for(const c of s.creatures){delete c.fieldMaps;c.nextAct=c.id===p.id||c.id===npc.id?s.time:1e12}
 s.knowledge.rumors=[];s.storyteller.budget=-1e9;p.needs.hygiene=70
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 const stock=(def:string)=>market.items.filter(i=>i.def===def).reduce((n,i)=>n+i.count,0)
 const paper=()=>npc.bag.find(i=>i.note?.mapDocument?.cartographer?.id===npc.id)
 const finish=()=>{for(let i=0;!paper()&&i<200;i++)act({type:'wait'});if(!paper())throw Error('상인 원본 지도 미완료')}
 return{w,s,p,m,npc,market,act,stock,paper,finish,requestQuote:()=>merchantMapRequestQuote(w,p,npc)}
}
export type MerchantMapPhase='unobserved'|'quote'|'drawing'|'drawn'|'purchased'|'pending'
export function merchantMapNativeFixture(phase:MerchantMapPhase){
 const d=merchantMapFixture(),initialTime=d.s.time,initialPaper=d.stock('Item.Note'),initialInk=d.stock('Item.Ink')
 if(phase!=='unobserved')d.act({type:'wait'})
 if(!['unobserved','quote'].includes(phase))d.act({type:'requestMerchantMap',target:d.npc.id})
 if(phase==='drawn'||phase==='purchased')d.finish()
 if(phase==='purchased'){const paper=d.paper()!,q=npcMapPurchaseQuote(d.w,d.p,d.npc,paper.uid);d.act({type:'buyNpcMap',target:d.npc.id,uid:paper.uid,expectedPrice:q.price})}
 if(phase==='pending')d.act({type:'rest',turns:80},2)
 return{...d,proof:{phase,initialTime,actualElapsedTU:d.s.time-initialTime,actualCompletedWorldTurns:turnOf(d.w)-Math.floor(initialTime/100),initialPaper,initialInk,originalNpcId:d.npc.id,initialRegionalSourceExplicit:true}}
}
