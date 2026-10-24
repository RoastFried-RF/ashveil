/** Data-driven foragers: actual perception, mouths, plants, water and finite food UIDs. */
import type {Action,ActResult} from './actions'
import {decideBird} from './birds'
import {capacity} from './body'
import {exposeDisease} from './conditions'
import {diseaseStream} from './disease-state'
import {calendar} from './climate-state'
import {canReach} from './combat'
import {foodKcal} from './cooking-state'
import {cropHarvestContaminants} from './crop-contamination'
import {cultivationHarvestError} from './cultivation'
import {creatureAt,inBounds,rng,terrainAt,tileAt,turnOf,type World} from './ctx'
import {foodPoison} from './food-safety'
import {canSee,hasLos} from './fov'
import {gatherFireError,gatherSeasonError,gatherSignature} from './gather-state'
import {gatherStockCount,takeGatherStock} from './gather-stock'
import {cheb,DIRS,dirIndex,type Pos} from './geom'
import {itemDef,makeItem,meleeWield} from './items'
import {hydrate,nourish} from './nutrition'
import {diagonalBlocked} from './path'
import {smells} from './perception'
import {towerSoilFertility} from './tower-consequences'
import {drinkContaminants,nearbyWater} from './water'
import {salineWaterLoss,waterSafetyDef} from './water-state'
import {isRaining} from './environment'
import type {ArmorCategory,Creature,ItemInst,WildlifeRules} from './types'

const fail=(msg:string):ActResult=>({ok:false,tu:0,msg})
export function wildlifeRules(w:World,c:Creature){return w.db.creature(c.def).wildlife}
export function animalMouthReady(w:World,c:Creature){const kind=w.db.body(c.body.def).kind;return !!wildlifeRules(w,c)&&kind!=='humanoid'&&kind!=='mechanical'&&c.alive&&!c.flight&&!c.asleep&&!c.unconscious&&capacity(w,c,'consciousness')>=.3&&capacity(w,c,'eating')>=.1}
export function animalFoodAllowed(w:World,c:Creature,item:ItemInst){const d=itemDef(w,item);return !!wildlifeRules(w,c)?.foodIds.includes(item.def)&&!!d.food&&!d.openFood&&!d.food.servings&&!d.food.needsTool&&!item.missingItem&&!item.half&&!item.foodFrozen&&item.count>0}
function swallow(w:World,c:Creature,item:ItemInst,count:number){
 const d=itemDef(w,item).food!
 for(let i=0;i<count;i++){
  nourish(w,c,foodKcal(w,item),d.protein,d.vitamin,{uid:item.uid,def:item.def});hydrate(w,c,d.water??0,(d.thirst??0)+(item.foodSaltGrams??0)*waterSafetyDef(w).saltFlushMlPerGram!)
  if(item.foodWater)drinkContaminants(w,c,{...item.foodWater.quality,ash:0},item.foodWater.ml)
  if(item.contaminantAsh)c.needs.ash=Math.min(100,Math.round(((c.needs.ash??0)+item.contaminantAsh)*10000)/10000)
  foodPoison(w,c,item)
  if(d.raw&&d.rawDisease&&d.rawDisease.chance>0)exposeDisease(w,c,d.rawDisease.def,d.rawDisease.chance,{kind:'실제 동물 날먹이 섭취',turn:turnOf(w),itemUid:item.uid,foodDef:item.def},diseaseStream('food.'+c.id))
 }
 c.ai.hunger=Math.max(0,c.ai.hunger-.35*count)
}
export function animalEat(w:World,c:Creature,uid:number):ActResult{
 if(!animalMouthReady(w,c))return fail('입과 의식을 쓸 수 없다')
 const floor=tileAt(w,c.pos).items,item=floor.find(i=>i.uid===uid)??c.bag.find(i=>i.uid===uid)
 if(!item||!animalFoodAllowed(w,c,item))return fail('원래 먹이가 없거나 이 동물이 먹을 수 없다')
 swallow(w,c,item,1);item.count--
 if(item.count===0){c.bag=c.bag.filter(i=>i!==item);tileAt(w,c.pos).items=floor.filter(i=>i!==item)}
 return{ok:true,tu:100}
}
export function animalDrink(w:World,c:Creature):ActResult{
 if(!animalMouthReady(w,c))return fail('입과 의식을 쓸 수 없다')
 const source=nearbyWater(w,c);if(!source)return fail('곁에 마실 수 있는 물이 없다')
 const facing=dirIndex(source.pos.x-c.pos.x,source.pos.y-c.pos.y);if(facing>=0)c.facing=facing
 const ml=wildlifeRules(w,c)!.drinkMl??300;hydrate(w,c,ml,salineWaterLoss(w,source.quality,ml));drinkContaminants(w,c,source.quality,ml);return{ok:true,tu:100}
}
export function animalBrowseError(w:World,c:Creature,p:Pos){
 if(wildlifeRules(w,c)?.browse===false)return '이 동물은 밭을 통째로 뜯어 먹지 않는다'
 if(!animalMouthReady(w,c)||!inBounds(w,p)||cheb(c.pos,p)>1||!hasLos(w,c.pos,p)||diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y))return '먹을 식물이 닿는 곁에 없다'
 const d=terrainAt(w,p),g=d.gather
 if(!g||gatherStockCount(w,p)<1||!wildlifeRules(w,c)!.foodIds.includes(g.item)||!w.db.item(g.item).food)return '먹을 수 있는 식물이 아니다'
 return gatherFireError(w,p)??gatherSeasonError(w,d)??cultivationHarvestError(w,p)??((tileAt(w,p).gatherAt??0)>turnOf(w)?'아직 다시 자라지 않았다':g.soilDependent&&towerSoilFertility(w)<=0?'식물이 자라지 못한다':null)
}
export function startAnimalBrowse(w:World,c:Creature,p:Pos):ActResult{
 const error=animalBrowseError(w,c,p);if(error)return fail(error)
 const g=terrainAt(w,p).gather!;c.activity={kind:'gather',animalForage:true,target:{...p},gatherRule:gatherSignature(w,p),label:'식물 뜯기',remaining:g.turns,total:g.turns,woundCount:c.body.wounds.length};return{ok:true,tu:0}
}
/** Called only at the existing gather completion, before hand/tool inventory delivery. */
export function finishAnimalBrowse(w:World,c:Creature,p:Pos,fertility:number){
 if(animalBrowseError(w,c,p))return
 const g=terrainAt(w,p).gather!,count=Math.min(gatherStockCount(w,p),wildlifeRules(w,c)?.browseCount??g.count),food=makeItem(w,g.item,count),q=cropHarvestContaminants(w,p,g.count)
 food.contaminantAsh=q.ash;food.foodWater=q.water
 swallow(w,c,food,count)
 takeGatherStock(w,p,count,Math.ceil(g.regrowTurns/fertility))
}
export function wildlifeThreats(w:World,c:Creature,rule=wildlifeRules(w,c)){
 if(!rule)return[]
 return w.s.creatures.filter(other=>{
  if(other.id===c.id||!other.alive||cheb(c.pos,other.pos)>rule.threatRadius)return false
  const d=w.db.creature(other.def),kind=w.db.body(other.body.def).kind,threat=kind==='humanoid'||kind==='mechanical'||d.ai==='packHunter'&&!d.wildlife
  return threat&&(canSee(w,c,other.pos)||smells(w,c,other))
 }).sort((a,b)=>cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.id-b.id)
}
export function interruptAnimalBrowse(w:World,c:Creature){return !animalMouthReady(w,c)||!!wildlifeThreats(w,c).length||!!c.activity?.target&&!!animalBrowseError(w,c,c.activity.target)}
export function wallow(w:World,c:Creature):ActResult{
 const rule=wildlifeRules(w,c);if(!rule?.mud||!c.alive||c.asleep||c.unconscious||capacity(w,c,'moving')<.1||!rule.mud.terrains.includes(tileAt(w,c.pos).t))return fail('몸을 뒹굴 진흙이 없다')
 ;(c.wildlifeState??={}).mudRainRemaining=rule.mud.washTurns;return{ok:true,tu:100}
}
export function wildlifeTick(w:World,c:Creature){
 const state=c.wildlifeState,rule=wildlifeRules(w,c)
 if(state?.mudRainRemaining&&rule?.mud&&w.s.map.kind==='surface'&&!tileAt(w,c.pos).roof&&isRaining(w))state.mudRainRemaining=Math.max(0,state.mudRainRemaining-1)
}
export function wildlifeMudArmor(w:World,c:Creature):Partial<Record<ArmorCategory,number>>|undefined{
 const rule=wildlifeRules(w,c)?.mud,left=c.wildlifeState?.mudRainRemaining??0;if(!rule||left<=0)return
 const fraction=Math.min(1,left/rule.washTurns);return{sharp:rule.sharp*fraction,blunt:rule.blunt*fraction}
}
export type WildlifeNavigation={toward(p:Pos):Action|null;away(threats:{pos:Pos}[]):Action|null;ability(target:Creature,threats:Creature[]):Action|null}
function nearbyTargets(w:World,c:Creature,radius:number){
 const list:Pos[]=[]
 for(let y=Math.max(0,c.pos.y-radius);y<=Math.min(w.s.map.h-1,c.pos.y+radius);y++)for(let x=Math.max(0,c.pos.x-radius);x<=Math.min(w.s.map.w-1,c.pos.x+radius);x++){const p={x,y};if(canSee(w,c,p))list.push(p)}
 return list.sort((a,b)=>cheb(a,c.pos)-cheb(b,c.pos)||a.y-b.y||a.x-b.x)
}
export function decideWildlife(w:World,c:Creature,rule:WildlifeRules,nav:WildlifeNavigation):Action{
 if(rule.kind==='scavengerBird')return decideBird(w,c,rule,nav)
 if(!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.3)return{type:'wait'}
 const threats=wildlifeThreats(w,c,rule),target=threats[0],turn=turnOf(w),random=rng(w,`ai.wildlife.${c.id}`)
 if(target){
  const state=c.wildlifeState??={},fresh=state.threatId!==target.id||turn-(state.lastThreatAt??-1e9)>(rule.rut?.memoryTurns??20)
  if(fresh){state.threatId=target.id;state.rutAggressive=!!rule.rut&&calendar(w).season.id===rule.rut.season&&random.chance(rule.rut.chance)}
  state.lastThreatAt=turn;c.ai.target=target.id;c.ai.lastSeen={...target.pos};c.ai.path=undefined
  if(rule.kind==='timidHerbivore'&&!state.rutAggressive){c.ai.mode='flee';const away=nav.away(threats);if(away?.type==='move'){const d=DIRS[away.dir],to={x:c.pos.x+d.x,y:c.pos.y+d.y};if(threats.every(t=>cheb(to,t.pos)>=cheb(c.pos,t.pos)))return away}if(canReach(w,c,target)&&meleeWield(w,c)){c.ai.mode='hunt';return{type:'attack',target:target.id}}return{type:'wait'}}
  c.ai.mode='hunt'
  const injury=c.body.wounds.reduce((sum,wd)=>sum+Math.max(0,wd.severity-wd.healed),0)
  if(rule.kind==='stubbornForager'&&injury>0)c.ai.morale=Math.max(c.ai.morale,w.db.creature(c.def).morale+Math.min(30,injury*2))
  return nav.ability(target,threats)??(canReach(w,c,target)&&meleeWield(w,c)?{type:'attack',target:target.id}:nav.toward(target.pos))??{type:'wait'}
 }
 c.ai.target=undefined;c.ai.mode='wander'
 if(animalMouthReady(w,c)&&c.needs.waterDeficit>=rule.drinkAbove){
  if(nearbyWater(w,c))return{type:'animalDrink'}
  const water=nearbyTargets(w,c,rule.forageRadius).find(p=>!!terrainAt(w,p).water);if(water){const step=nav.toward(water);if(step)return step}
 }
 if(animalMouthReady(w,c)&&c.needs.kcal<rule.eatBelow){
  const own=[...tileAt(w,c.pos).items,...c.bag].find(i=>animalFoodAllowed(w,c,i));if(own)return{type:'animalEat',uid:own.uid}
  const local=[c.pos,...DIRS.map(d=>({x:c.pos.x+d.x,y:c.pos.y+d.y}))].find(p=>!animalBrowseError(w,c,p))
  if(local){if(cheb(c.pos,local)>0&&terrainAt(w,local).passable){const step=nav.toward(local);if(step)return step}return{type:'animalBrowse',pos:local}}
  for(const p of nearbyTargets(w,c,rule.forageRadius)){
   const t=tileAt(w,p),g=terrainAt(w,p).gather,plant=g&&rule.foodIds.includes(g.item)&&!gatherSeasonError(w,terrainAt(w,p))&&!cultivationHarvestError(w,p)&&!gatherFireError(w,p)&&(t.gatherAt??0)<=turn
   if(t.items.some(i=>animalFoodAllowed(w,c,i))||plant){const step=nav.toward(p);if(step)return step}
  }
 }
 if(rule.mud){
  if(rule.mud.terrains.includes(tileAt(w,c.pos).t)&&(c.wildlifeState?.mudRainRemaining??0)<rule.mud.washTurns*.5)return{type:'wallow'}
  if((c.wildlifeState?.mudRainRemaining??0)<rule.mud.washTurns*.5){const mud=nearbyTargets(w,c,Math.min(3,rule.forageRadius)).find(p=>rule.mud!.terrains.includes(tileAt(w,p).t));if(mud){const step=nav.toward(mud);if(step)return step}}
 }
 if(c.needs.fatigue>=rule.sleepAt&&c.needs.bodyTemp>=35)return{type:'sleep'}
 if(c.home&&cheb(c.pos,c.home)>rule.homeRadius)return nav.toward(c.home)??{type:'wait'}
 if(random.chance(rule.wanderChance)){
  const origin=c.home??c.pos,p={x:Math.max(1,Math.min(w.s.map.w-2,origin.x+random.int(-rule.homeRadius,rule.homeRadius))),y:Math.max(1,Math.min(w.s.map.h-2,origin.y+random.int(-rule.homeRadius,rule.homeRadius)))}
  if(!creatureAt(w,p)){const step=nav.toward(p);if(step)return step}
 }
 return{type:'wait'}
}
