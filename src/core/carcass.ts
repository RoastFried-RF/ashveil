/** Finite original dissection stock, shared with real scavenging and actual hourly decay. */
import {bestiaryEntry} from './bestiary-state'
import {terrainAt,tileAt,turnOf,type World} from './ctx'
import {isRaining} from './environment'
import {ageFoodState} from './food-safety'
import {makeItem} from './items'
import type {Creature,ItemInst} from './types'

export function initializeCarcass(w:World,c:Creature,drop?:{item:string;count:number}){
 const entry=bestiaryEntry(w,c.def);if(entry?.kind!=='animal'||c.carcassStock)return
 c.carcassStock={}
 for(const row of entry.yields){const existing=c.carcassStock[row.item],count=Math.max(0,Math.floor(row.count));if(!count)continue;if(existing){existing.remaining+=count;existing.original+=count}else c.carcassStock[row.item]={remaining:count,original:count,at:turnOf(w),...(w.db.item(row.item).food?{freshness:100}:{})}}
 if(drop&&drop.count>0){const previous=c.carcassStock[drop.item];if(!previous)c.carcassStock[drop.item]={remaining:drop.count,original:drop.count,at:turnOf(w),...(w.db.item(drop.item).food?{freshness:100}:{})};else if(previous.original<drop.count){previous.remaining+=drop.count-previous.original;previous.original=drop.count}}
}
export function ageCarcass(w:World,c:Creature,temperature:number,now:number){
 const wet=c.needs.wetness>=50||!!terrainAt(w,c.pos).water||w.s.map.kind==='surface'&&!tileAt(w,c.pos).roof&&isRaining(w)
 for(const[id,stock]of Object.entries(c.carcassStock??{})){
  const def=w.db.tryGet<import('./types').ItemDef>(id);if(!def?.food||stock.remaining<=0)continue
  ageFoodState(w,stock,def,temperature,Math.max(0,now-stock.at),wet);stock.at=now
 }
}
export function carcassCount(c:Creature,item:string){return c.alive||c.dissected?0:c.carcassStock?.[item]?.remaining??0}
/** One portion is removed once. It receives a new real UID at separation from the body. */
export function takeCarcassPortion(w:World,c:Creature,item:string):ItemInst|undefined{
 return takeCarcassStock(w,c,item,1)
}
export function takeCarcassStock(w:World,c:Creature,item:string,count:number):ItemInst|undefined{
 const amount=Math.min(carcassCount(c,item),Math.max(0,Math.floor(count)));if(amount<1)return
 const stock=c.carcassStock![item],it=makeItem(w,item,amount);stock.remaining-=amount
 for(const key of['freshness','foodFrozen','foodThawed','foodWet','foodLeftover','foodSealed']as const)if(stock[key]!==undefined)Object.assign(it,{[key]:stock[key]})
 if(stock.freshness!==undefined)it.foodAgedAt=stock.at;return it
}
