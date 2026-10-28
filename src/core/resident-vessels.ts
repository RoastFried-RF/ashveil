// 부족한 용기는 실제 상점에서 얻는다. 이동 계획은 원격 재고를 읽지 않는다.
import type {World} from './ctx'
import {hostile} from './diplomacy'
import {exchange,marketFor,tradeAccess,tradePrice} from './economy'
import {canSee,hasLos} from './fov'
import {cheb} from './geom'
import {addToBag} from './items'
import {delayResidentHygiene,residentHygieneGoal,residentHygieneSupply} from './resident-hygiene'
import {isWaterVessel,waterCapacity} from './water-vessels'
import type {Creature,ItemInst,ResidentWaterDef} from './types'
const limit=(w:World)=>w.db.tryGet<ResidentWaterDef>('ResidentWater.Hearth')?.hygiene?.vesselMaxPrice
export function residentVesselGoal(w:World,c:Creature){
 const maxPrice=limit(w),need=residentHygieneGoal(w,c)
 if(maxPrice===undefined||!need)return null
 const supply=residentHygieneSupply(w,c,need.waterMl)
 if(supply.available||supply.capacityMl>=need.waterMl)return null
 const owner=c.traderSite===c.residentSite
 if(!owner&&(c.money??0)<=0)return null
 const trader=w.s.creatures.filter(o=>o.alive&&o.home&&!o.caravan&&o.traderSite===c.residentSite&&!hostile(w,c,o)&&(o.id!==c.id||owner)).sort((a,b)=>cheb(c.pos,a.home!)-cheb(c.pos,b.home!)||a.id-b.id)[0]
 if(!trader)return null
 return {target:trader.id,own:trader.id===c.id,pos:{...(trader.id===c.id?trader.home!:canSee(w,c,trader.pos)?trader.pos:trader.home!)},maxPrice,missingMl:need.waterMl-supply.capacityMl}
}
export function residentVesselQuote(w:World,c:Creature,trader:Creature){
 const goal=residentVesselGoal(w,c),out={error:null as string|null,goal,item:undefined as ItemInst|undefined,price:0}
 if(!goal||goal.target!==trader.id){out.error='지금 이 주민에게 추가 물 용기가 필요한 상황이 아니다';return out}
 const market=marketFor(w,trader)
 const access=goal.own?(!c.home||cheb(c.pos,c.home)>1||!hasLos(w,c.pos,c.home)?'자기 상점 곁으로 돌아가야 한다':null):tradeAccess(w,c,trader)
 if(access||!market||market.mobile){out.error=access??'이 정착지의 실제 상점이 아니다';return out}
 let reason='상점에 쓸 수 있는 물 용기가 없다'
 const candidates=market.items.filter(i=>i.count>0&&isWaterVessel(w,i)&&(i.durability??100)>0).map(item=>({item,value:tradePrice(w,c,trader,item,true),ml:waterCapacity(w,item)})).sort((a,b)=>a.value/Math.min(a.ml,goal.missingMl)-b.value/Math.min(b.ml,goal.missingMl)||a.value-b.value||a.item.uid-b.item.uid)
 for(const candidate of candidates){
  if(candidate.value>goal.maxPrice){reason='물 용기 가격이 지불 한도를 넘었다';continue}
  const price=goal.own?0:candidate.value
  if(price>(c.money??0)){reason='물 용기를 살 돈이 부족하다';continue}
  const shadow:World={db:w.db,s:{...w.s,nextId:w.s.nextId}},copy={...c,bag:structuredClone(c.bag)},probe={...structuredClone(candidate.item),count:1,gx:undefined,gy:undefined,rot:undefined}
  if(addToBag(shadow,copy,probe)){reason='물 용기가 실제 배낭에 들어가지 않는다';continue}
  out.item=candidate.item;out.price=price;return out
 }
 out.error=reason;return out
}
export function acquireResidentVessel(w:World,c:Creature,trader:Creature):string|null{
 const q=residentVesselQuote(w,c,trader)
 const fail=(error:string)=>{if(q.goal)delayResidentHygiene(w,c);return error}
 if(q.error)return fail(q.error)
 if(!q.goal!.own){const error=exchange(w,c,trader,[{uid:q.item!.uid,count:1}],[],q.price);if(error)return fail(error)}
 else{
  const market=marketFor(w,trader)!,items=structuredClone(market.items),bag=structuredClone(c.bag),copy={...c,bag},shadow:World={db:w.db,s:{...w.s,nextId:w.s.nextId}},source=items.find(i=>i.uid===q.item!.uid)!,piece={...source,count:1,gx:undefined,gy:undefined,rot:undefined}
  if(source.count===1)items.splice(items.indexOf(source),1)
  else{source.count--;piece.uid=shadow.s.nextId++}
  delete piece.waterSettlesAt
  if(addToBag(shadow,copy,piece))return fail('물 용기가 실제 배낭에 들어가지 않는다')
  c.bag=bag;market.items=items;w.s.nextId=shadow.s.nextId
 }
 delete c.residentHygieneAfter;c.residentReturning=true
 return null
}
