// 현장에서 부탁받은 상인이 자기 실제 상점의 재료만 개인 작업용으로 옮긴다. 대금은 완성 원본 구매 때 낸다.
import {cartographyDef} from './cartography'
import {log,type World} from './ctx'
import {marketFor} from './economy'
import {hasLos} from './fov'
import {cheb} from './geom'
import {addToBag} from './items'
import {mapDrawingQuote} from './map-writing'
import {npcMapRecordNeeded,npcMapTradeAccess} from './npc-cartography'
import {rememberMeeting} from './first-impressions'
import type {Creature} from './types'
function plan(w:World,buyer:Creature,trader:Creature){
 const d=cartographyDef(w),market=marketFor(w,trader),out={error:npcMapTradeAccess(w,buyer,trader),needsPaper:false,needsInk:false,bag:structuredClone(trader.bag),items:structuredClone(market?.items??[]),nextId:w.s.nextId}
 if(out.error)return out
 const fail=(error:string)=>{out.error=error;return out}
 if(!d.independent?.shopSupplies||!d.writing)return fail('상점에서 지도 재료를 준비하는 방식이 없다')
 if(!market||market.mobile||trader.traderSite!==w.s.overworld?.currentRegion||!trader.home||cheb(trader.pos,trader.home)>1||!hasLos(w,trader.pos,trader.home))return fail('자기 정착지 상점 곁에서만 지도 재료를 준비할 수 있다')
 if(trader.activity||trader.mapDrawingJob)return fail('진행 중인 일을 마친 뒤 부탁할 수 있다')
 if(!npcMapRecordNeeded(w,trader))return fail('새로 옮겨 그릴 자기 정찰 기록이 없다')
 let paper=out.bag.find(i=>i.def===d.writing!.paper&&i.count===1&&!i.note),ink=out.bag.find(i=>i.def===d.writing!.ink&&i.count>0)
 out.needsPaper=!paper;out.needsInk=!ink
 if(paper&&ink)return fail('이미 자기 종이와 잉크가 있다. 한가해지면 직접 작성한다')
 const shadow:World={db:w.db,s:{...w.s,nextId:out.nextId}},actor={...trader,bag:out.bag}
 for(const def of[...(!paper?[d.writing.paper]:[]),...(!ink?[d.writing.ink]:[])]){
  const source=out.items.find(i=>i.def===def&&i.count>0&&(def!==d.writing!.paper||!i.note));if(!source)return fail('자기 상점의 빈 종이1장과 잉크1회분이 부족하다')
  const piece={...structuredClone(source),count:1,gx:undefined,gy:undefined,rot:undefined}
  if(source.count===1)out.items.splice(out.items.indexOf(source),1)
  else{source.count--;piece.uid=shadow.s.nextId++}
  if(addToBag(shadow,actor,piece))return fail('원래 재료를 넣을 자기 배낭 공간이 없다')
 }
 paper=actor.bag.find(i=>i.def===d.writing!.paper&&i.count===1&&!i.note);ink=actor.bag.find(i=>i.def===d.writing!.ink&&i.count>0)
 const quote=mapDrawingQuote(w,actor,paper!.uid,ink!.uid);if(quote.error)return fail(quote.error)
 out.bag=actor.bag;out.nextId=shadow.s.nextId;return out
}
export function merchantMapRequestQuote(w:World,buyer:Creature,trader:Creature){const p=plan(w,buyer,trader);return{error:p.error,needsPaper:p.needsPaper,needsInk:p.needsInk}}
export function requestMerchantMap(w:World,buyer:Creature,trader:Creature):string|null{
 const p=plan(w,buyer,trader);if(p.error)return p.error
 trader.bag=p.bag;marketFor(w,trader)!.items=p.items;w.s.nextId=p.nextId
 rememberMeeting(w,buyer,trader)
 log(w,'info',trader.name+'이(가) 자기 상점의 원래 종이·잉크를 작업용으로 챙겼다. 한가할 때 지도를 그리고 원본을 판매한다.');return null
}
