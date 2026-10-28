// 실제 같은 주민의 개인 재료/돈 또는 자기 상점 현물을 쓰는 단일 재배 배지 준비.
import {player,turnOf,log,type World} from './ctx'
import {residentCultivationAvailable,residentCultivationDef,residentCultivationWaterBudget} from './resident-cultivation'
import {residentCultivationShop,residentShopApproach} from './resident-produce'
import {craftError} from './crafting'
import {itemDef,removeOne,addToBag} from './items'
import {canSee,hasLos} from './fov'
import {diagonalBlocked} from './path'
import {cheb,type Pos} from './geom'
import {marketFor,tradeAccess,tradeQuote,exchange} from './economy'
import type {Creature,ItemInst,RecipeDef} from './types'
import type {Action} from './actions'
function preparation(w:World,c:Creature){
 const def=residentCultivationDef(w),rule=def.preparation
 if(!rule||!rule.factions.includes(c.faction)||!residentCultivationAvailable(w,c)||c.residentPlot||c.bag.some(i=>i.count>0&&itemDef(w,i).place&&w.db.terrain(itemDef(w,i).place!).cultivation)||residentCultivationWaterBudget(w,c)<def.reserveWaterMl+def.doseMl)return
 const recipe=w.db.get<RecipeDef>(rule.recipe),missing=recipe.inputs.map(input=>({item:input.item,count:input.count-c.bag.filter(i=>i.def===input.item).reduce((n,i)=>n+i.count,0)})).find(i=>i.count>0)
 return{rule,recipe,missing}
}
function supplyGoal(w:World,c:Creature){
 const p=preparation(w,c);if(!p?.missing||(c.residentCultivationSupplyAfter??0)>turnOf(w))return
 const goal=residentCultivationShop(w,c);if(!goal)return
 if(!goal.own&&(!Number.isSafeInteger(c.money)||c.money!<=p.rule.reserveMoney))return
 return{...goal,...p}
}
export function residentCropSupplyDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 const p=preparation(w,c);if(!p)return null
 if(!p.missing)return craftError(w,c,p.recipe)?null:{action:{type:'craft',id:p.recipe.id}}
 const goal=supplyGoal(w,c);if(!goal)return null
 if(cheb(c.pos,goal.pos)<=1&&hasLos(w,c.pos,goal.pos))return{action:{type:'residentCropSupply',target:goal.target}}
 const pos=residentShopApproach(w,c,goal);return pos?{goal:pos}:null
}
export function residentCropSupplyQuote(w:World,c:Creature,trader:Creature){
 const goal=supplyGoal(w,c),out={error:null as string|null,checked:false,goal,item:undefined as ItemInst|undefined,count:1,price:0,balance:0}
 if(!goal||goal.target!==trader.id||!w.s.creatures.includes(trader)){out.error='실제 자기 재배 배지를 준비할 주민과 원래 상인이 필요하다';return out}
 const access=goal.own?(!c.home||cheb(c.pos,c.home)>1||!hasLos(w,c.pos,c.home)?'자기 상점 곁으로 돌아가야 한다':null):tradeAccess(w,c,trader)
 if(access||!canSee(w,c,trader.pos)||!canSee(w,trader,c.pos)||diagonalBlocked(w,c.pos,trader.pos.x-c.pos.x,trader.pos.y-c.pos.y)){out.checked=cheb(c.pos,goal.pos)<=1&&canSee(w,c,goal.pos)&&hasLos(w,c.pos,goal.pos);out.error=access??'실제로 서로 보이는 상점 곁이어야 한다';return out}
 const market=marketFor(w,trader);if(!market||market.mobile){out.error='같은 정착지의 원래 상점이어야 한다';return out}
 out.checked=true;out.item=market.items.find(i=>i.def===goal.missing!.item&&Number.isSafeInteger(i.count)&&i.count>=1&&Number.isSafeInteger(i.uid)&&i.uid>0)
 if(!out.item){out.error='상점에 필요한 실제 재배 재료가 없다';return out}
 if(!goal.own){const q=tradeQuote(w,c,trader,[{uid:out.item.uid,count:1}],[]);if(q.error){out.error=q.error;return out}out.price=q.buy;out.balance=q.balance;if(!Number.isSafeInteger(q.buy)||q.buy<=0||q.buy>goal.rule.maxUnitPrice||c.money!-q.buy<goal.rule.reserveMoney){out.error='먹고살 돈을 남겨 실제 재배 재료 한 개를 살 수 있어야 한다';return out}}
 else{
  const shadow:World={db:w.db,s:{...w.s}},giver={...c,bag:structuredClone(market.items)},receiver={...c,bag:structuredClone(c.bag)},piece=removeOne(shadow,giver,out.item.uid)
  if(!piece||addToBag(shadow,receiver,piece))out.error='자기 실제 배낭에 재배 재료 한 개를 넣을 자리가 없다'
 }
 return out
}
export function obtainResidentCropSupply(w:World,c:Creature,trader:Creature):string|null{
 const q=residentCropSupplyQuote(w,c,trader),delay=()=>{const r=residentCultivationDef(w).preparation;if(r)c.residentCultivationSupplyAfter=turnOf(w)+r.retryTurns}
 if(q.error){if(q.checked)delay();return q.error}
 if(!q.goal!.own){const error=exchange(w,c,trader,[{uid:q.item!.uid,count:1}],[],q.balance);if(error){delay();return error}}
 else{
  const market=marketFor(w,trader)!,shadow:World={db:w.db,s:{...w.s}},giver={...c,bag:structuredClone(market.items)},receiver={...c,bag:structuredClone(c.bag)},piece=removeOne(shadow,giver,q.item!.uid)
  if(!piece||addToBag(shadow,receiver,piece)){delay();return '실제 배낭에 재배 재료를 옮길 수 없다'}
  market.items=giver.bag;c.bag=receiver.bag;w.s.nextId=shadow.s.nextId
 }
 delete c.residentCultivationSupplyAfter
 if(canSee(w,player(w),c.pos)&&canSee(w,player(w),trader.pos))log(w,'info',q.goal!.own?'주민이 자기 상점에서 실제 재배 재료 한 개를 가져왔다.':'주민이 자기 돈으로 실제 재배 재료 한 개를 샀다.')
 return null
}
