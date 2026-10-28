import {findPath} from '../src/core/path'
import {residentCultivationNativeFixture} from './resident-cultivation-fixture'
import {serialize,deserialize} from '../src/core/save'
import {player,inBounds,terrainAt,creatureAt,type World} from '../src/core/ctx'
import {playerAct} from '../src/core/game'
import {marketFor,tradeAccess,tradeQuote} from '../src/core/economy'
import {cheb,DIRS,dirIndex} from '../src/core/geom'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {Action} from '../src/core/actions'
export type ProducePhase='harvested'|'atShop'|'sold'|'pending'
const templates=new Map<ProducePhase,{db:World['db'];state:string;proof:ReturnType<typeof residentCultivationNativeFixture>['proof']}>()
function prepare(phase:ProducePhase){
 const cached=templates.get(phase);if(cached)return cached
 const d=residentCultivationNativeFixture('harvested'),trader=d.s.creatures.find(c=>c.traderSite===d.c.residentSite)!,market=marketFor(d.w,trader)!
 if(phase==='atShop'||phase==='sold')for(let i=0;i<100;i++){
  if(phase==='atShop'&&cheb(d.c.pos,trader.pos)<=1&&!tradeAccess(d.w,d.c,trader))break
  if(phase==='sold'&&market.items.some(i=>i.cropHarvest?.owner===d.c.id))break
  d.act({type:'wait'});if(i===99)throw Error('actual original resident produce stage did not finish')
 }
 if(phase==='pending')d.act({type:'rest',turns:200},1)
 const data={db:d.w.db,state:serialize(d.s),proof:d.proof};templates.set(phase,data);return data
}
export function residentProduceFixture(phase:ProducePhase='harvested'){
 const data=prepare(phase),w:World={db:data.db,s:deserialize(data.state)},s=w.s,p=player(w),c=s.creatures.find(c=>c.id===data.proof.originalResident)!,trader=s.creatures.find(t=>t.traderSite===c.residentSite)!,market=marketFor(w,trader)!
 invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,c,trader,market,act:(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},proof:{...data.proof,producePhase:phase,originalHarvestUid:111,initialRendererFx:s.fx.splice(0)}}
}

export type ProduceNativePhase='initial'|'supplied'|'bought'|'pending'|'pendingBuy'
export function residentProduceNativeFixture(phase:ProduceNativePhase='initial'){
 const d=residentCultivationNativeFixture('watered'),trader=d.s.creatures.find(c=>c.traderSite===d.c.residentSite)!
 let observerMarketWalk=0
 while(cheb(d.p.pos,trader.pos)>1&&observerMarketWalk<100){
  const access=DIRS.map(v=>({x:trader.pos.x+v.x,y:trader.pos.y+v.y})).filter(q=>inBounds(d.w,q)&&terrainAt(d.w,q).passable&&!creatureAt(d.w,q)).map(q=>findPath(d.w,d.p.pos,q,{avoidCreatures:true,selfId:d.p.id})).filter((p):p is NonNullable<typeof p>=>!!p?.length).sort((a,b)=>a.length-b.length)[0]?.[0]
  if(!access)throw Error('actual observer path to original merchant unavailable')
  d.act({type:'move',dir:dirIndex(access.x-d.p.pos.x,access.y-d.p.pos.y)});observerMarketWalk++
 }
 if(cheb(d.p.pos,trader.pos)>1)throw Error('actual observer did not reach original merchant')
 // 별도의 유효한 초기 잔여 성장3턴/구매용 개인 돈100이다. 과거 성장을 실행하거나 돈을 벌었다고 주장하지 않는다.
 const plot=d.crop()!;plot.state.growth=plot.total-3;plot.state.lastAt=Math.floor(d.s.time/100);d.p.money=100
 const beforeBank=marketFor(d.w,trader)!.money,initialTime=d.s.time
 if(phase==='supplied'||phase==='bought'||phase==='pendingBuy')d.act({type:'rest',turns:200})
 if(phase==='pending')d.act({type:'rest',turns:200},1)
 if(phase==='bought'||phase==='pendingBuy'){
  const market=marketFor(d.w,trader)!,root=market.items.find(i=>i.cropHarvest?.owner===d.c.id);if(!root)throw Error('original resident did not actually supply merchant')
  const quote=tradeQuote(d.w,d.p,trader,[{uid:root.uid,count:1}],[]);if(quote.error)throw Error(quote.error)
  d.act({type:'trade',target:trader.id,buy:[{uid:root.uid,count:1}],sell:[],expectedBalance:quote.balance},phase==='pendingBuy'?1:undefined)
 }
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=player(w),c=s.creatures.find(a=>a.id===d.c.id)!,seller=s.creatures.find(a=>a.id===trader.id)!,market=marketFor(w,seller)!
 invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,c,trader:seller,market,act:(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},proof:{...d.proof,producePhase:phase,actualObserverMarketWalkTurns:observerMarketWalk,declaredLastThreeGrowthTurns:true,declaredInitialPlayerPurchaseCash:100,noClaimOfEarlier28797GrowthTurnsOrEarningCash:true,initialBank:beforeBank,initialTime,initialRendererFx:s.fx.splice(0)}}
}
