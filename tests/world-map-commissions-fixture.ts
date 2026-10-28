import {merchantMapFixture} from './npc-map-shop-supplies-fixture'
import {player,tileAt,TURNS_PER_DAY,TURNS_PER_HOUR} from '../src/core/ctx'
import {addToBag,makeItem} from '../src/core/items'
import {DIRS} from '../src/core/geom'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
import {worldMapSurveyOffers,isWorldMapSurvey} from '../src/core/world-map-commissions'
export function worldMapCommissionsFixture(){
 const d=merchantMapFixture(),{w,s,p,npc}=d
 // 원래 실제 정착지/상인/장부/UID의 유효 초기 장면. 상인이 출입구 곁에 서 있다고 준비하며 이전 보행은 주장하지 않는다.
 s.time=(Math.floor(s.time/100/TURNS_PER_DAY)+1)*TURNS_PER_DAY*100+12*TURNS_PER_HOUR*100;s.weather='clear';s.weatherUntil=1e12;s.map.lights=[];p.pos={...s.map.exits[0]};p.literacy=2;p.literate=true;p.bag=[];p.equip={};p.needs.nutritionDay=Math.floor(s.time/100/TURNS_PER_DAY);p.needs.stress=0
 const near=DIRS.map(v=>({x:p.pos.x+v.x,y:p.pos.y+v.y})).find(pos=>{const t=tileAt(w,pos);return t&&w.db.terrain(t.t).passable&&!s.creatures.some(c=>c.id!==p.id&&c.id!==npc.id&&c.pos.x===pos.x&&c.pos.y===pos.y)})
 if(!near)throw Error('actual settlement gate merchant space');npc.pos=near
 for(const c of s.creatures){c.nextAct=c.id===p.id?s.time:1e12;delete c.activity}
 tileAt(w,p.pos)!.roof=false;tileAt(w,npc.pos)!.roof=false;invalidateLights(w);updatePlayerVision(w,p)
 const paper=makeItem(w,'Item.Note'),ink=makeItem(w,'Item.Ink',3);if(addToBag(w,p,paper)||addToBag(w,p,ink))throw Error('world survey material space')
 const fresh={db:w.db,s:deserialize(serialize(s))},actor=player(fresh),trader=fresh.s.creatures.find(c=>c.id===npc.id)!,market=fresh.s.overworld!.markets![npc.traderSite!],act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(fresh,a,budget);if(error)throw Error(error)}
 const offer=()=>worldMapSurveyOffers(fresh,actor,trader)[0]!,accept=()=>{const o=offer();if(!o)throw Error('world map survey offer');act({type:'worldMapSurveyAccept',target:trader.id,offer:o.id,expectedReward:o.reward});return fresh.s.overworld!.contracts!.filter(isWorldMapSurvey).at(-1)!}
 return{w:fresh,s:fresh.s,p:actor,m:fresh.s.overworld!,trader,market,paper:actor.bag.find(i=>i.uid===paper.uid)!,ink:actor.bag.find(i=>i.uid===ink.uid)!,act,offer,accept,action:{type:'drawWorldMap' as const,paperUid:paper.uid,inkUid:ink.uid}}
}
export type WorldMapCommissionPhase='offer'|'accepted'|'drawn'|'delivered'|'pending'
export function worldMapCommissionsNativeFixture(phase:WorldMapCommissionPhase){
 const d=worldMapCommissionsFixture(),initialTime=d.s.time,initialMoney=d.p.money!,initialBank=d.market.money
 let contract:ReturnType<typeof d.accept>|undefined
 if(phase!=='offer')contract=d.accept()
 if(['drawn','delivered','pending'].includes(phase)){d.act({type:'surveyWorld'});d.act(d.action,phase==='pending'?2:undefined)}
 if(phase==='delivered')d.act({type:'worldMapSurveyDeliver',target:d.trader.id,contract:contract!.id,paperUid:d.paper.uid,expectedReward:contract!.reward})
 return{...d,contract,proof:{phase,initialTime,actualElapsedTU:d.s.time-initialTime,initialMoney,initialBank,contractId:contract?.id,reward:contract?.reward,paperUid:d.paper.uid,inkUid:d.ink.uid,initialGateMerchantAndLaterNoonExplicit:true}}
}
