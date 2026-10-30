// A resident merchant gathers local ash, withdraws owned goods and supplies actual crafted bowls.
import {ashDepositCount}from'./ash-deposits'
import {residentCookingAvailable,residentCookingDecision}from'./resident-cooking'
import {residentWorkshopActor,residentWorkshopOrder,residentWorkshopProduct,residentWorkshopRecipe,residentWorkshopRules,workshopReserveKcal,residentWorkshopClothing}from'./resident-workshop-state'
import {residentProvisionDef}from'./resident-provisions'
import {readyFood}from'./open-food-state'
import {handState,washHandsError}from'./hand-hygiene'
import {freshnessBand}from'./food-state'
import {foodServings}from'./food-vessels'
import {foodKcal}from'./cooking-state'
import {residentShopApproach}from'./resident-produce'
import {canSee,hasLos}from'./fov'
import {cheb,type Pos}from'./geom'
import {diagonalBlocked}from'./path'
import {player,tileAt,terrainAt,turnOf,log,creatureAt,type World}from'./ctx'
import {marketFor}from'./economy'
import {addToBag,removeOne}from'./items'
import type{Action}from'./actions'
import type{AshDepositDef,Creature,RecipeDef}from'./types'

type Operation='plan'|'supply'|'offer'|'defer'|'cancel'|'provision'
type Decision={action?:Action;goal?:Pos}
const active=(w:World,c:Creature)=>residentWorkshopActor(w,c)&&residentCookingAvailable(w,c)
const atShop=(w:World,c:Creature)=>!!c.home&&cheb(c.pos,c.home)<=1&&hasLos(w,c.pos,c.home)&&!diagonalBlocked(w,c.pos,c.home.x-c.pos.x,c.home.y-c.pos.y)
function market(w:World,c:Creature){if(!atShop(w,c))return;const m=marketFor(w,c);return m&&!m.mobile&&m.site===c.residentSite?m:undefined}
function stockedMeals(w:World,items:import('./types').ItemInst[],recipe:string){const id=w.db.get<RecipeDef>(recipe).output.item;return items.reduce((n,i)=>n+(i.def===id&&freshnessBand(w,i)==='fresh'&&foodServings(w,i)>0?i.count:0),0)}
function missingIngredient(w:World,c:Creature){
 const rule=residentWorkshopRules(w)!,r=w.db.get<RecipeDef>(rule.recipe),ash=w.db.get<AshDepositDef>(rule.gather),gather=w.db.terrain(ash.terrain).gather!
 return r.inputs.find(row=>row.item!==gather.item&&row.item!==r.boiledMeal!.vessel&&c.bag.filter(i=>i.def===row.item&&!i.contents?.length).reduce((n,i)=>n+i.count,0)<row.count)?.item
}
function shopDecision(w:World,c:Creature,operation:Operation):Decision|null{
 if(atShop(w,c))return{action:{type:'residentWorkshop',operation}}
 const goal=residentShopApproach(w,c,{pos:c.home!});return goal?{goal}:null
}
export function residentWorkshopDecision(w:World,c:Creature):Decision|null{
 if(!active(w,c))return null
 const rule=residentWorkshopRules(w)!
 if(c.residentWorkshopOrder&&!residentWorkshopOrder(w,c))return{action:{type:'residentWorkshop',operation:'cancel'}}
 if((c.residentWorkshopAfter??0)>turnOf(w))return null
 const product=residentWorkshopProduct(w,c)
 const stock=market(w,c)
 if(!product&&!residentWorkshopOrder(w,c)&&stock&&stockedMeals(w,stock.items,rule.recipe)>=rule.targetStock)return null
 if(c.needs.kcal<500){
  const food=c.bag.find(i=>i.def===residentProvisionDef(w)!.food&&readyFood(w,c,i)&&!['spoiled','rotten'].includes(freshnessBand(w,i)))
  return food?{action:handState(w,c)==='dirty'&&!washHandsError(w,c)?{type:'washHands'}:{type:'consume',uid:food.uid}}:shopDecision(w,c,'provision')
 }
 if(c.needs.fatigue>=60){
  const bed=w.s.map.residentBeds?.find(b=>b.owner===c.id&&!b.packedUid);if(!bed)return null
  if(cheb(c.pos,bed.pos)===0)return{action:{type:'sleep'}}
  if(canSee(w,c,bed.pos)&&(tileAt(w,bed.pos).t!==bed.terrain||creatureAt(w,bed.pos)))return null
  return{goal:bed.pos}
 }
 if(workshopReserveKcal(w,c)-(product?foodKcal(w,product):0)<rule.reserveKcal)return shopDecision(w,c,'provision')
 if(product)return shopDecision(w,c,'offer')
 if(!residentWorkshopOrder(w,c)){
  if(product||c.needs.kcal<500||c.needs.fatigue>=60||workshopReserveKcal(w,c)<rule.reserveKcal)return null
  return shopDecision(w,c,'plan')
 }
 if(!residentWorkshopRecipe(w,c))return null
 const source=w.db.get<AshDepositDef>(rule.gather),g=w.db.terrain(source.terrain).gather!,r=w.db.get<RecipeDef>(rule.recipe),need=r.inputs.find(i=>i.item===g.item)!
 if(c.bag.filter(i=>i.def===g.item).reduce((n,i)=>n+i.count,0)<need.count){
  // The resident knows the common local catchment's address, not unseen current contents.
  const places=source.placements.filter(p=>p.site===c.residentSite&&p.map===w.s.map.id).map(p=>({x:p.pos[0],y:p.pos[1]})).sort((a,b)=>cheb(c.home!,a)-cheb(c.home!,b)||a.y-b.y||a.x-b.x)
  for(const pos of places){
   if(canSee(w,c,pos)&&hasLos(w,c.pos,pos)){
    if(terrainAt(w,pos).gather?.ashDeposit!==source.id||ashDepositCount(w,pos)<1)continue
    const clothes=residentWorkshopClothing(w,c,pos,'work');if(clothes)return{action:clothes}
    if(cheb(c.pos,pos)<=1&&!diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return{action:{type:'gather',pos}}
   }
   const goal=residentShopApproach(w,c,{pos});if(goal)return{goal}
  }
  return{action:{type:'residentWorkshop',operation:'defer'}}
 }
 if(missingIngredient(w,c))return shopDecision(w,c,'supply')
 const decision=residentCookingDecision(w,c,true)
 if(decision?.action?.type==='craft'){const clothes=residentWorkshopClothing(w,c,c.pos,'work');if(clothes)return{action:clothes}}
 return decision
}
export function performResidentWorkshop(w:World,c:Creature,operation:Operation):string|null{
 if(!active(w,c))return '지금 자기 작업장의 실제 일을 할 수 없다'
 const rule=residentWorkshopRules(w)!,order=residentWorkshopOrder(w,c)
 if(operation==='cancel'){if(!c.residentWorkshopOrder||order)return '취소할 바뀐 작업 지시가 없다';delete c.residentWorkshopOrder;c.residentWorkshopAfter=turnOf(w)+rule.retryTurns;return null}
 if(operation==='defer'){if(!order)return '진행 중인 자기 작업 지시가 없다';c.residentWorkshopAfter=turnOf(w)+rule.retryTurns;c.residentReturning=true;return null}
 const stock=market(w,c);if(!stock)return '자기 상점의 실제 보이는 곁으로 돌아가야 한다'
 if((c.residentWorkshopAfter??0)>turnOf(w))return '다음 작업 확인 시각을 기다려야 한다'
 if(operation==='plan'){
  if(order||!residentWorkshopActor(w,c)||residentWorkshopProduct(w,c)||c.needs.kcal<500||c.needs.fatigue>=60||workshopReserveKcal(w,c)<rule.reserveKcal)return '남길 식량과 새 작업 준비를 확인해야 한다'
  const r=w.db.get<RecipeDef>(rule.recipe)
  if(stockedMeals(w,stock.items,r.id)>=rule.targetStock)return '상점에 이미 이번 목표만큼 완성품이 있다'
  c.residentWorkshopOrder={site:c.residentSite!,recipe:r.id,rule:JSON.stringify(rule),at:turnOf(w)};return null
 }
 if(operation==='supply'||operation==='provision'){
  if(operation==='supply'&&(!order||!residentWorkshopRecipe(w,c)))return '원래 작업 지시와 남길 식량이 필요하다'
  const product=residentWorkshopProduct(w,c)
  if(operation==='provision'&&c.needs.kcal>=500&&workshopReserveKcal(w,c)-(product?foodKcal(w,product):0)>=rule.reserveKcal)return '이미 개인 식량과 작업 준비가 충분하다'
  const id=operation==='provision'?residentProvisionDef(w)!.food:missingIngredient(w,c),it=stock.items.find(i=>i.def===id&&i.count>0&&!i.contents?.length&&(operation!=='provision'||freshnessBand(w,i)==='fresh'))
  if(!it){c.residentWorkshopAfter=turnOf(w)+rule.retryTurns;return '자기 상점에 필요한 실제 원재료가 없다'}
  const shadow:World={db:w.db,s:{...w.s}},giver={...c,bag:structuredClone(stock.items)},receiver={...c,bag:structuredClone(c.bag)},piece=removeOne(shadow,giver,it.uid)
  if(!piece||addToBag(shadow,receiver,piece)){c.residentWorkshopAfter=turnOf(w)+rule.retryTurns;return '원재료 한 개를 넣을 실제 배낭 자리가 없다'}
  stock.items=giver.bag;c.bag=receiver.bag;w.s.nextId=shadow.s.nextId;return null
 }
 const it=residentWorkshopProduct(w,c)
 if(!it||workshopReserveKcal(w,c)-foodKcal(w,it)<rule.reserveKcal)return '남길 식량과 자신이 실제 만든 같은 완성품이 필요하다'
 c.bag=c.bag.filter(i=>i!==it);delete it.gx;delete it.gy;delete it.rot;stock.items.push(it)
 c.residentWorkshopAfter=turnOf(w)+rule.retryTurns;c.residentReturning=true
 if(canSee(w,player(w),c.pos))log(w,'info','순례회 상인이 직접 만든 같은 재떡 그릇을 자기 상점에 옮겼다.')
 return null
}
