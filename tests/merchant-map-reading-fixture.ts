import {merchantMapFixture} from './npc-map-shop-supplies-fixture'
import {player,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
export function merchantMapReadingFixture(){
 const d=merchantMapFixture(),{s,p,npc,market}=d
 // 실제 원래 시장 종이 묶음의 한 장을 유효 초기의 옛 지도 원본으로 준비한다. 과거 작성/납품 입력은 주장하지 않는다.
 s.time=(Math.floor(s.time/100/TURNS_PER_DAY)+1)*TURNS_PER_DAY*100+12*TURNS_PER_HOUR*100;s.weather='clear';s.weatherUntil=1e12;p.needs.nutritionDay=Math.floor(s.time/100/TURNS_PER_DAY);p.needs.hygiene=70;p.literacy=2;p.literate=true
 for(const c of s.creatures){c.nextAct=c.id===p.id||c.id===npc.id?s.time:1e12;delete c.activity}
 npc.pos={...npc.home!};npc.ai.route=undefined;npc.bag=[];npc.literacy=2;npc.literate=true;delete npc.knownRumors;s.knowledge.rumors=[]
 const stock=market.items.find(i=>i.def==='Item.Note'&&!i.note)!,paper={...structuredClone(stock),uid:stock.count===1?stock.uid:s.nextId++,count:1}
 if(stock.count===1)market.items.splice(market.items.indexOf(stock),1);else stock.count--
 const observed=Object.values(s.overworld!.worldObservations!)[0]!,at=turnOf(d.w)-600
 paper.note={id:'market-world-map:'+s.seed+':'+paper.uid,kind:'map',source:'옛 행상의 원본 지도',text:'한 행상이 남긴 당시 월드 지형 기록이다.',writtenAt:at,foundAt:at,hop:0,worldMapDocument:{title:'행상의 오래된 월드 지도',author:'옛 행상',cartographer:{id:9999,name:'옛 행상',seed:s.seed},worldSeed:s.seed,w:s.overworld!.w,h:s.overworld!.h,writtenAt:at,reliability:40,error:2,cells:[{x:0,y:0,seenAt:at,cell:structuredClone(observed.cell)}]}}
 market.items.push(paper);invalidateLights(d.w);updatePlayerVision(d.w,p)
 const w={db:d.w.db,s:deserialize(serialize(s))},actor=player(w),trader=w.s.creatures.find(c=>c.id===npc.id)!,store=w.s.overworld!.markets![npc.traderSite!],original=store.items.find(i=>i.uid===paper.uid)!,act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 return{w,s:w.s,p:actor,npc:trader,market:store,paper:original,act}
}
export type MerchantMapReadingPhase='unread'|'read'|'pending'
export function merchantMapReadingNativeFixture(phase:MerchantMapReadingPhase){
 const d=merchantMapReadingFixture(),initialTime=d.s.time
 if(phase==='read')d.act({type:'wait'})
 if(phase==='pending')d.act({type:'rest',turns:20},4)
 return{...d,proof:{phase,initialTime,actualElapsedTU:d.s.time-initialTime,paperUid:d.paper.uid,originalInitialShopNoteExplicit:true}}
}
