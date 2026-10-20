import {residentHygieneFixture} from './resident-hygiene-fixture'
import {isWaterVessel} from '../src/core/water-vessels'
import {drinkVolume} from '../src/core/wash-water'
import {creatureAt,inBounds,terrainAt,tileAt} from '../src/core/ctx'
import {marketFor} from '../src/core/economy'
import {playerAct} from '../src/core/game'
import {cheb,DIRS,dirIndex} from '../src/core/geom'
import {findPath} from '../src/core/path'
import {updatePlayerVision} from '../src/core/fov'
export function residentVesselsFixture(kind:'guard'|'owner'='guard'){
 const d=residentHygieneFixture(),c=kind==='owner'?d.s.creatures.find(c=>c.traderSite)!:d.s.creatures.find(c=>c.def==='Creature.SettlementGuard')!,trader=d.s.creatures.find(c=>c.traderSite)!,market=marketFor(d.w,trader)!
 d.c.needs.hygiene=70;d.c.nextAct=1e12;c.nextAct=d.s.time;c.needs.hygiene=0;c.money=100
 const original=c.bag.filter(i=>isWaterVessel(d.w,i))
 if(original.length<2)throw Error('original resident water vessels')
 for(const bottle of original){bottle.uses=0;delete bottle.water;delete bottle.waterFrozen}
 const retained=original[0],lost=original.slice(1)
 c.bag=c.bag.filter(i=>!lost.includes(i));for(const i of lost){delete i.gx;delete i.gy;delete i.rot}tileAt(d.w,{x:17,y:17}).items.push(...lost)
 const bottles=()=>c.bag.filter(i=>isWaterVessel(d.w,i)),water=()=>c.bag.reduce((n,i)=>n+(!d.w.db.item(i.def).drink?.alcohol?drinkVolume(d.w,i):0),0)
 return{...d,c,trader,market,retained,lost,bottles,water}
}

export function residentVesselsNativeFixture(phase:'initial'|'bought'|'body'|'clean'|'owner'|'pending'='initial'){
 const d=residentVesselsFixture(phase==='owner'?'owner':'guard'),initialCash=d.c.money!,initialMarketCash=d.market.money,initialStock=d.market.items.filter(i=>isWaterVessel(d.w,i)).reduce((n,i)=>n+i.count,0),originalStockUid=d.market.items.find(i=>isWaterVessel(d.w,i))!.uid
 d.p.pos={x:d.c.home!.x+1,y:d.c.home!.y}
 const ready=()=>phase==='initial'?true:phase==='bought'?d.bottles().length===2:phase==='body'||phase==='pending'?d.c.activity?.kind==='wash':d.c.needs.hygiene>=60
 let guard=0;while(!ready()&&guard++<700)d.wait();if(!ready())throw Error('actual vessel acquisition phase '+phase)
 for(let i=0;cheb(d.p.pos,d.c.pos)>1&&i<40;i++){
  const paths=DIRS.map(v=>({x:d.c.pos.x+v.x,y:d.c.pos.y+v.y})).filter(p=>inBounds(d.w,p)&&terrainAt(d.w,p).passable&&(!creatureAt(d.w,p)||creatureAt(d.w,p)?.id===d.p.id)).map(p=>findPath(d.w,d.p.pos,p,{avoidCreatures:true,selfId:d.p.id})).filter((p):p is NonNullable<typeof p>=>!!p?.length).sort((a,b)=>a.length-b.length)
  const next=paths[0]?.[0];if(!next)throw Error('actual observer walk to buyer')
  const error=playerAct(d.w,{type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)});if(error)throw Error(error)
 }
 if(cheb(d.p.pos,d.c.pos)>1)throw Error('observer not beside actual vessel buyer')
 let pendingTurns=0
 if(phase==='pending'){pendingTurns=d.c.activity!.remaining+1;const error=playerAct(d.w,{type:'rest',turns:pendingTurns},1);if(error||!d.s.simulationPending)throw Error('actual pending same purchased vessel wash')}
 updatePlayerVision(d.w,d.p);return {...d,initialCash,initialMarketCash,initialStock,originalStockUid,pendingTurns}
}
