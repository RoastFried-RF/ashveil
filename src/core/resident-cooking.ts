// 주민의 실제 개인 곡물·물·같은 그릇과 직접 설치한 유한 장작불만 쓴다.
import {activeEscort} from './escort-contracts'
import {hostileAware} from './action-time'
import {capacity,totalBleed} from './body'
import {campfireAt,campfireDef,fireTurnsLeft,fireWorkQuote} from './campfire'
import {cookingAccess,cookingStatus} from './cooking-state'
import {bindInputs} from './crafting'
import {creatureAt,inBounds,player,terrainAt,tileAt,turnOf,log,type World} from './ctx'
import {exchange,marketFor,tradeAccess,tradeQuote} from './economy'
import {canSee,hasLos} from './fov'
import {cheb,DIRS,dirIndex,type Pos} from './geom'
import {addToBag,removeOne} from './items'
import {diagonalBlocked} from './path'
import {residentFoodKcal,residentProvisionDef} from './resident-provisions'
import {residentCultivationShop,residentShopApproach} from './resident-produce'
import {unheatedMealQuote} from './unheated-meal'
import {isWaterVessel} from './water-vessels'
import {suitableDrink} from './water-state'
import {drinkVolume} from './wash-water'
import type {Action} from './actions'
import type {Creature,ItemInst,RecipeDef} from './types'

export const residentCookingRules=(w:World)=>residentProvisionDef(w)?.cooking
function available(w:World,c:Creature){
 const d=residentCookingRules(w)
 return !!d&&c.id!==w.s.playerId&&w.s.map.kind==='surface'&&w.s.creatures.includes(c)&&(!c.mapId||c.mapId===w.s.map.id)&&!!c.residentSite&&c.residentSite===w.s.overworld?.currentRegion&&!!c.home&&inBounds(w,c.home)&&inBounds(w,c.pos)&&!c.body.machine&&w.db.body(c.body.def).kind==='humanoid'&&d.roles.includes(w.db.creature(c.def).ai)&&c.alive&&!c.activity&&!c.workJob&&!c.asleep&&!c.unconscious&&!c.captivity&&!c.companion&&!c.rescue&&!c.breakdown&&!c.roadRaid&&!c.caravan&&!c.abduction&&!activeEscort(w,c)&&!c.ai.task&&!c.ai.route?.length&&!c.ai.target&&!['hunt','flee','surrender','patrol','return'].includes(c.ai.mode)&&capacity(w,c,'consciousness')>=.5&&capacity(w,c,'manipulation')>=.2&&capacity(w,c,'moving')>=.2&&capacity(w,c,'sight')>=.2&&totalBleed(w,c)<=0&&c.needs.fatigue<80&&c.needs.waterDeficit<500&&c.needs.bodyTemp>=35&&c.needs.bodyTemp<=39&&!hostileAware(w,c)
}
function recipe(w:World,c:Creature){
 const d=residentCookingRules(w)
 if(!d||c.needs.kcal>=d.prepareBelowKcal||residentFoodKcal(w,c)>0)return
 return d.recipes.map(id=>w.db.get<RecipeDef>(id)).find(r=>!!bindInputs(c,r.inputs.filter(i=>i.item!==r.boiledMeal!.vessel))&&(!r.minAttr||Object.entries(r.minAttr).every(([k,v])=>c.stats[k as keyof Creature['stats']]>=v)))
}
function ownedFire(w:World,c:Creature){
 const d=residentCookingRules(w)!
 // 현재 보이는 불만 확인한다. 보이지 않는 다른 사람의 소유권/연료를 훑지 않는다.
 return w.s.map.lights.filter(l=>cheb(l.pos,c.home!)<=d.homeRadius&&canSee(w,c,l.pos)&&hasLos(w,c.pos,l.pos)).sort((a,b)=>cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.pos.y-b.pos.y||a.pos.x-b.pos.x).map(l=>campfireAt(w,l.pos)).find(f=>f?.tile.placed?.owner===c.id)
}
function missingSupply(w:World,c:Creature,r:RecipeDef){
 const fire=campfireDef(w)
 if(!c.bag.some(i=>i.def===r.boiledMeal!.vessel&&i.count===1))return r.boiledMeal!.vessel
 if(!rememberedFire(w,c)&&!ownedFire(w,c)&&!c.bag.some(i=>i.def===fire.kit&&i.count>0))return fire.kit
 if(!c.bag.some(i=>i.def===fire.fuel&&i.count>0)&&(!ownedFire(w,c)||fireTurnsLeft(w,ownedFire(w,c)!.light.pos)<r.workTurns+1))return fire.fuel
}
function supplyGoal(w:World,c:Creature){
 const rule=residentCookingRules(w),r=recipe(w,c)
 if(!rule||!available(w,c)||!r||(c.residentCookingSupplyAfter??0)>turnOf(w))return
 const missing=missingSupply(w,c,r);if(!missing)return
 const goal=residentCultivationShop(w,c)
 if(!goal||!goal.own&&(!Number.isSafeInteger(c.money)||c.money!<=rule.reserveMoney))return
 return{...goal,missing,rule}
}
type Decision={action?:Action;goal?:Pos}
function approach(w:World,c:Creature,pos:Pos,action:Action):Decision{
 if(cheb(c.pos,pos)<=1&&!diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y)&&canSee(w,c,pos)&&hasLos(w,c.pos,pos))return{action}
 return{goal:pos}
}
export function residentCookingDecision(w:World,c:Creature):Decision|null{
 if(!available(w,c))return null
 // 자기가 올린 음식 위치는 기억한다. 현재 진행은 실제 보이는 곁에서만 확인한다.
 const batch=w.s.map.cooking?.find(b=>b.crafter===c.id)
 if(batch){
  if(cookingAccess(w,c,batch.pos))return{goal:batch.pos}
  const status=cookingStatus(w,batch)
  if(status.ready||!status.hot||status.reason)return{action:{type:'takeCooking',uid:batch.item.uid}}
  return{action:{type:'wait'}}
 }
 const r=recipe(w,c);if(!r)return null
 const rule=residentCookingRules(w)!,spec=r.boiledMeal!,fire=ownedFire(w,c)
 const missing=missingSupply(w,c,r)
 if(missing){
  const goal=supplyGoal(w,c);if(!goal)return null
  if(cheb(c.pos,goal.pos)<=1&&hasLos(w,c.pos,goal.pos))return{action:{type:'residentCookingSupply',target:goal.target}}
  const pos=residentShopApproach(w,c,goal);return pos?{goal:pos}:null
 }
 const remembered=rememberedFire(w,c)
 if(remembered&&!fire)return approach(w,c,remembered.pos,{type:'residentCookingCheck'})
 const bottle=c.bag.find(i=>isWaterVessel(w,i)&&i.count===1&&!i.waterFrozen&&suitableDrink(w,i)&&drinkVolume(w,i)>=spec.waterMl+rule.reserveWaterMl)
 if(!bottle){
  const empty=c.bag.filter(i=>isWaterVessel(w,i)&&i.count===1&&!i.waterFrozen).sort((a,b)=>drinkVolume(w,a)-drinkVolume(w,b)||a.uid-b.uid)[0],well=w.s.map.residentWell
  if(!empty||!well||well.site!==c.residentSite)return null
  // 이미 가득 찼지만 마실 수 없는 물을 자동 버리거나 무한 재급수하지 않는다.
  if(drinkVolume(w,empty)>=spec.waterMl+rule.reserveWaterMl)return null
  return approach(w,c,well.pos,{type:'fillBottle',uid:empty.uid,pos:well.pos})
 }
 // 상점/우물로 향한 이동을 집 반경 경계에서 귀가로 되돌리지 않는다.
 if(cheb(c.pos,c.home!)>rule.homeRadius)return{goal:c.home!}
 if(!fire){
  const kit=c.bag.find(i=>i.def===campfireDef(w).kit&&i.count>0)!
  for(const v of DIRS){const p={x:c.pos.x+v.x,y:c.pos.y+v.y};if(!inBounds(w,p)||cheb(c.home!,p)>rule.homeRadius||!canSee(w,c,p)||!hasLos(w,c.pos,p)||diagonalBlocked(w,c.pos,v.x,v.y))continue
   const t=terrainAt(w,p),tile=tileAt(w,p)
   if(!t.passable||t.water||t.stairs||t.container||t.station||t.bedding||t.gather||t.residentDepot||t.residentWell||tile.placed||tile.items.length||creatureAt(w,p)||w.s.map.exits.some(e=>e.x===p.x&&e.y===p.y))continue
   return{action:{type:'place',uid:kit.uid,dir:dirIndex(v.x,v.y)}}
  }
  return null
 }
 if(cookingAccess(w,c,fire.light.pos))return{goal:fire.light.pos}
 if(fireTurnsLeft(w,fire.light.pos)<r.workTurns+1){
  const wood=c.bag.find(i=>i.def===campfireDef(w).fuel&&i.count>0)
  return wood&&!fireWorkQuote(w,c,fire.light.pos,wood.uid).error?{action:{type:'fireWork',pos:fire.light.pos,uid:wood.uid}}:null
 }
 return unheatedMealQuote(w,c,r.id).error?null:{action:{type:'prepareUnheatedMeal',id:r.id}}
}
export function residentCookingSupplyQuote(w:World,c:Creature,trader:Creature){
 const goal=supplyGoal(w,c),out={error:null as string|null,checked:false,goal,item:undefined as ItemInst|undefined,price:0,balance:0}
 if(!goal||goal.target!==trader.id||!w.s.creatures.includes(trader)){out.error='실제 개인 재료로 조리할 주민과 원래 상인이 필요하다';return out}
 const access=goal.own?(!c.home||cheb(c.pos,c.home)>1||!hasLos(w,c.pos,c.home)?'자기 상점 곁으로 돌아가야 한다':null):tradeAccess(w,c,trader)
 if(access||!canSee(w,c,trader.pos)||!canSee(w,trader,c.pos)||diagonalBlocked(w,c.pos,trader.pos.x-c.pos.x,trader.pos.y-c.pos.y)){out.checked=cheb(c.pos,goal.pos)<=1&&canSee(w,c,goal.pos)&&hasLos(w,c.pos,goal.pos);out.error=access??'실제로 서로 보이는 상점 곁이어야 한다';return out}
 const market=marketFor(w,trader);if(!market||market.mobile){out.error='같은 정착지의 실제 상점이어야 한다';return out}
 out.checked=true;out.item=market.items.find(i=>i.def===goal.missing&&Number.isSafeInteger(i.count)&&i.count>=1&&(i.durability??100)>0)
 if(!out.item){out.error='상점에 필요한 실제 조리 물품이 없다';return out}
 if(!goal.own){const q=tradeQuote(w,c,trader,[{uid:out.item.uid,count:1}],[]);if(q.error){out.error=q.error;return out}out.price=q.buy;out.balance=q.balance;if(!Number.isSafeInteger(q.buy)||q.buy<=0||q.buy>goal.rule.maxUnitPrice||c.money!-q.buy<goal.rule.reserveMoney)out.error='생활비를 남기고 실제 조리 물품 한 개를 살 수 있어야 한다'}
 else{const shadow:World={db:w.db,s:{...w.s}},giver={...c,bag:structuredClone(market.items)},receiver={...c,bag:structuredClone(c.bag)},piece=removeOne(shadow,giver,out.item.uid);if(!piece||addToBag(shadow,receiver,piece))out.error='자기 배낭에 조리 물품 한 개를 넣을 자리가 없다'}
 return out
}
function rememberedFire(w:World,c:Creature){const q=c.residentCookingFire;return q&&q.region===c.residentSite&&q.map===w.s.map.id&&q.pos&&Number.isSafeInteger(q.pos.x)&&Number.isSafeInteger(q.pos.y)&&inBounds(w,q.pos)&&Number.isSafeInteger(q.uid)&&q.uid>0&&cheb(q.pos,c.home!)<=residentCookingRules(w)!.homeRadius?q:undefined}
export function checkResidentCookingFire(w:World,c:Creature):string|null{
 if(!available(w,c))return '지금 개인 모닥불을 확인할 수 없다'
 const q=rememberedFire(w,c);if(!q||cookingAccess(w,c,q.pos))return '기억한 모닥불의 실제 보이는 곁이어야 한다'
 const f=campfireAt(w,q.pos);if(f&&f.uid===q.uid&&f.tile.placed?.owner===c.id)return '같은 개인 모닥불이 남아 있다'
 delete c.residentCookingFire;return null
}
export function obtainResidentCookingSupply(w:World,c:Creature,trader:Creature):string|null{
 const q=residentCookingSupplyQuote(w,c,trader),delay=()=>{const rule=residentCookingRules(w);if(rule)c.residentCookingSupplyAfter=turnOf(w)+rule.retryTurns}
 if(q.error){if(q.checked)delay();return q.error}
 if(!q.goal!.own){const error=exchange(w,c,trader,[{uid:q.item!.uid,count:1}],[],q.balance);if(error){delay();return error}}
 else{const market=marketFor(w,trader)!,shadow:World={db:w.db,s:{...w.s}},giver={...c,bag:structuredClone(market.items)},receiver={...c,bag:structuredClone(c.bag)},piece=removeOne(shadow,giver,q.item!.uid);if(!piece||addToBag(shadow,receiver,piece)){delay();return '실제 배낭으로 조리 물품을 옮길 수 없다'}market.items=giver.bag;c.bag=receiver.bag;w.s.nextId=shadow.s.nextId}
 delete c.residentCookingSupplyAfter
 if(canSee(w,player(w),c.pos)&&canSee(w,player(w),trader.pos))log(w,'info',q.goal!.own?'주민이 자기 상점의 실제 조리 물품 한 개를 가져왔다.':'주민이 자기 돈으로 실제 조리 물품 한 개를 샀다.')
 return null
}
