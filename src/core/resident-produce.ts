// 실제 자기 밭 수확물만 남길 식량을 빼고 상점으로 옮긴다. 먼 상점 재고/잔액은 읽지 않는다.
import {player,turnOf,log,inBounds,terrainAt,creatureAt,type World} from './ctx'
import {residentCultivationAvailable,residentCultivationDef} from './resident-cultivation'
import {hostile} from './diplomacy'
import {canSee,hasLos} from './fov'
import {cheb,DIRS,type Pos} from './geom'
import {diagonalBlocked,findPath} from './path'
import {marketFor,tradeAccess,tradeQuote,exchange} from './economy'
import {foodKcal} from './cooking-state'
import {foodServings} from './food-vessels'
import {readyFood} from './open-food-state'
import {freshnessBand} from './food-state'
import {itemDef} from './items'
import type {Action} from './actions'
import type {Creature,ItemInst,TerrainDef} from './types'

function produceLine(w:World,c:Creature){
 const rule=residentCultivationDef(w).surplus;if(!rule)return
 const total=c.bag.reduce((n,i)=>n+(readyFood(w,c,i)&&!['spoiled','rotten'].includes(freshnessBand(w,i))?foodKcal(w,i)*foodServings(w,i)*i.count:0),0)
 const surplus=total-rule.reserveKcal
 for(const it of [...c.bag].sort((a,b)=>(a.cropHarvest?.at??0)-(b.cropHarvest?.at??0)||a.uid-b.uid)){
  const q=it.cropHarvest
  if(!q||q.owner!==c.id||q.def!==it.def||!Number.isSafeInteger(q.seedUid)||q.seedUid<=0||!Number.isSafeInteger(q.at)||q.at<0||q.at>turnOf(w)||!q.region||!q.map||w.db.tryGet<TerrainDef>(q.terrain)?.gather?.item!==it.def||freshnessBand(w,it)!=='fresh')continue
  const material=!itemDef(w,it).food&&rule.materials?.find(m=>m.item===it.def)
  const held=c.bag.filter(i=>i.def===it.def).reduce((n,i)=>n+i.count,0),kcal=readyFood(w,c,it)?foodKcal(w,it)*foodServings(w,it):0
  const count=material?Math.min(rule.maxUnits,it.count,held-material.reserveUnits):kcal>0?Math.min(rule.maxUnits,it.count,Math.floor(surplus/kcal)):0
  if(Number.isSafeInteger(count)&&count>0)return{item:it,count}
 }
}
function shopGoal(w:World,c:Creature){
 if(!c.bag.some(i=>i.cropHarvest?.owner===c.id)||!residentCultivationDef(w).surplus||!residentCultivationAvailable(w,c)||(c.residentProduceAfter??0)>turnOf(w)||!produceLine(w,c))return
 return residentCultivationShop(w,c)
}
export function residentCultivationShop(w:World,c:Creature){
 const trader=w.s.creatures.filter(t=>t.alive&&t.home&&!t.caravan&&t.traderSite===c.residentSite&&!hostile(w,c,t)).sort((a,b)=>(a.id===c.id?0:1)-(b.id===c.id?0:1)||cheb(c.pos,a.home!)-cheb(c.pos,b.home!)||a.id-b.id)[0]
 if(!trader)return
 return{target:trader.id,own:trader.id===c.id,pos:{...(trader.id===c.id?c.home!:canSee(w,c,trader.pos)?trader.pos:trader.home!)}}
}
export function residentProduceDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 const goal=shopGoal(w,c);if(!goal)return null
 if(cheb(c.pos,goal.pos)<=1&&hasLos(w,c.pos,goal.pos))return{action:{type:'residentProduce',target:goal.target}}
 const pos=residentShopApproach(w,c,goal);return pos?{goal:pos}:null
}
export function residentShopApproach(w:World,c:Creature,goal:{pos:Pos}){
 const access=DIRS.map(v=>({x:goal.pos.x+v.x,y:goal.pos.y+v.y})).filter(q=>inBounds(w,q)&&terrainAt(w,q).passable&&(!creatureAt(w,q)||creatureAt(w,q)!.id===c.id)&&hasLos(w,q,goal.pos)&&!diagonalBlocked(w,q,goal.pos.x-q.x,goal.pos.y-q.y)).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)
 for(const q of access)if(findPath(w,c.pos,q,{avoidCreatures:true,selfId:c.id,maxNodes:1200}))return q
 return undefined
}
export function residentProduceQuote(w:World,c:Creature,trader:Creature){
 const goal=shopGoal(w,c),out={error:null as string|null,checked:false,goal,item:undefined as ItemInst|undefined,count:0,price:0,balance:0}
 if(!goal||goal.target!==trader.id||!w.s.creatures.includes(trader)){out.error='지금 상점에 옮길 자기 밭의 여유 수확물이 없다';return out}
 const access=goal.own?(!c.home||cheb(c.pos,c.home)>1||!hasLos(w,c.pos,c.home)?'자기 상점 곁으로 돌아가야 한다':null):tradeAccess(w,c,trader)
 if(access||!canSee(w,c,trader.pos)||!canSee(w,trader,c.pos)||diagonalBlocked(w,c.pos,trader.pos.x-c.pos.x,trader.pos.y-c.pos.y)){out.checked=cheb(c.pos,goal.pos)<=1&&canSee(w,c,goal.pos)&&hasLos(w,c.pos,goal.pos);out.error=access??'실제로 서로 보이는 상점 곁이어야 한다';return out}
 const market=marketFor(w,trader);if(!market||market.mobile){out.error='같은 정착지의 실제 상점이어야 한다';return out}
 out.checked=true
 const line=produceLine(w,c);if(!line){out.error='남길 개인 식량과 같은 실제 수확물을 확인해야 한다';return out}
 out.item=line.item;out.count=line.count
 if(!goal.own){const quote=tradeQuote(w,c,trader,[],[{uid:line.item.uid,count:line.count}]);if(quote.error){out.error=quote.error;return out}out.price=quote.sell;out.balance=quote.balance;if(quote.sell<=0||market.money<quote.sell)out.error='상점에 실제 수확물 대금을 지급할 돈이 없다'}
 return out
}
export function offerResidentProduce(w:World,c:Creature,trader:Creature):string|null{
 const q=residentProduceQuote(w,c,trader),delay=()=>{c.residentProduceAfter=turnOf(w)+residentCultivationDef(w).surplus!.retryTurns}
 if(q.error){if(q.checked)delay();return q.error}
 const market=marketFor(w,trader)!
 if(!q.goal!.own){const error=exchange(w,c,trader,[],[{uid:q.item!.uid,count:q.count}],q.balance);if(error){delay();return error}}
 else{
  const bag=structuredClone(c.bag),items=structuredClone(market.items),source=bag.find(i=>i.uid===q.item!.uid)!,piece={...source,count:q.count};let next=w.s.nextId
  if(source.count===q.count)bag.splice(bag.indexOf(source),1);else{source.count-=q.count;piece.uid=next++}
  delete piece.gx;delete piece.gy;delete piece.rot;items.push(piece)
  c.bag=bag;market.items=items;w.s.nextId=next
 }
 delay();c.residentReturning=true
 if(canSee(w,player(w),c.pos)&&canSee(w,player(w),trader.pos))log(w,'info',q.goal!.own?'주민이 자기 밭의 여유 수확물을 자기 상점에 옮겼다.':'주민이 자기 밭의 여유 수확물을 상점에 팔았다.')
 return null
}
