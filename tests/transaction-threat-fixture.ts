import {lifeMemoriesFixture} from './life-memories-fixture'
import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {marketFor,tradePrice} from '../src/core/economy'
import {createCreature} from '../src/core/creatures'
import {playerAct} from '../src/core/game'
import {tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function goodTradeFixture(){
 const d=lifeMemoriesFixture(),market=marketFor(d.w,d.keeper)!
 d.p.pos={x:d.keeper.pos.x+1,y:d.keeper.pos.y};d.p.money=1000;d.p.stats.per=20;d.p.stats.wil=20
 updatePlayerVision(d.w,d.p)
 const item=market.items.filter(i=>i.count>0&&tradePrice(d.w,d.p,d.keeper,i,true,true)>=10&&tradePrice(d.w,d.p,d.keeper,i,true,true)<=500).sort((a,b)=>tradePrice(d.w,d.p,d.keeper,b,true,true)-tradePrice(d.w,d.p,d.keeper,a,true,true)||a.uid-b.uid)[0]!
 if(!item)throw Error('original finite merchant stock for actual gain')
 return {...d,market,item}
}
export function surroundedFixture(count=3){
 const d=conditionThoughtsFixture(),positions=[{x:d.p.pos.x+1,y:d.p.pos.y},{x:d.p.pos.x,y:d.p.pos.y-1},{x:d.p.pos.x-1,y:d.p.pos.y}],enemies=positions.slice(0,count).map(pos=>{const c=createCreature(d.w,'Creature.Reaver',pos);c.traits=[];c.nextAct=d.s.time+100;c.ai.mode='guard';d.s.creatures.push(c);return c})
 const fire={x:d.p.pos.x,y:d.p.pos.y+2};tileAt(d.w,fire).t='Terrain.Campfire';d.s.map.lights=[{pos:fire,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,enemies}
}
export type TransactionThreatPhase='trade'|'quote'|'ordinary'|'surrounded'|'two'|'pending'
export function transactionThreatNativeFixture(phase:TransactionThreatPhase){
 const act=(w:Parameters<typeof playerAct>[0],action:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(w,action,budget);if(e)throw Error(e)}
 if(phase==='surrounded'||phase==='two'){
  const d=surroundedFixture(phase==='two'?2:3),initialTime=d.s.time;act(d.w,{type:'wait'});updatePlayerVision(d.w,d.p)
  return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,enemies:d.enemies.map(c=>c.id),pending:false,purchase:undefined,bargainTurns:undefined}}
 }
 const d=goodTradeFixture(),initialTime=d.s.time,original={uid:d.item.uid,def:d.item.def,count:d.item.count},cash={player:d.p.money,market:d.market.money}
 let bargainTurns=0
 if(phase!=='ordinary'){
  for(let i=0;i<3&&!d.market.haggle?.successes;i++){act(d.w,{type:'bargain',target:d.keeper.id});bargainTurns++}
  if(!d.market.haggle?.successes)throw Error('actual public bargaining yielded no gain')
 }
 const quoted=tradePrice(d.w,d.p,d.keeper,d.item,true),undiscounted=tradePrice(d.w,d.p,d.keeper,d.item,true,true),expectedUid=d.item.count===1?d.item.uid:d.s.nextId
 if(phase!=='quote')act(d.w,{type:'trade',target:d.keeper.id,buy:[{uid:d.item.uid,count:1}],sell:[],expectedBalance:quoted})
 if(phase==='pending')act(d.w,{type:'rest',turns:20},2)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,enemies:undefined,bargainTurns,purchase:{original,cash,quoted,undiscounted,gain:undiscounted-quoted,expectedUid,purchased:phase!=='quote',marketUid:original.uid},pending:phase==='pending'}}
}
