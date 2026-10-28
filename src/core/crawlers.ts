import {nearbyWater} from './water'
import {carcassCount,takeCarcassPortion} from './carcass'
import {swallowAnimalFood,drinkAnimalWater} from './wildlife'
/** Roof-borne predators with original glands, real perception, and paid actions. */
import {capacity,isMissing,partEff,partDamage} from './body'
import {creatureAt,creatureById,inBounds,log,terrainAt,tileAt,turnOf,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {cheb,DIRS,dirIndex,type Pos} from './geom'
import {makeItem} from './items'
import {diagonalBlocked,findPath} from './path'
import {resolveAttack,fx} from './combat'
import {applyLocalToxin} from './neurotoxin'
import {crawlerRules,crawlerSignature} from './crawler-state'
import {hostile} from './diplomacy'
import {hasEffect} from './traits'
import {emitNoise} from './perception'
import type {Action,ActResult} from './actions'
import type {Creature} from './types'
const fail=(msg:string):ActResult=>({ok:false,tu:0,msg})
export function initializeCrawler(w:World,c:Creature){
 const d=w.db.creature(c.def).crawler;if(!d)return
 c.crawlerState={rule:crawlerSignature(d),mode:tileAt(w,c.pos).roof?'ceiling':'floor',nextClimbAt:0,observedBy:{},glands:d.glands.map(part=>{const item=makeItem(w,d.venomItem);item.uses=d.dosesPerGland;return{part,uid:item.uid,initialDoses:d.dosesPerGland,spentDoses:0,lostDoses:0,harvestedDoses:0,item}})}
}
export function crawlerTick(w:World,c:Creature){
 const d=crawlerRules(w,c),s=c.crawlerState;if(!d||!s)return
 for(const g of s.glands)if(g.item&&(isMissing(w,c,g.part)||partDamage(c,g.part)>=c.body.maxHp[g.part])){g.lostDoses+=g.item.uses??0;g.item.uses=0}
 for(const[id,until]of Object.entries(s.observedBy))if(until<=turnOf(w))delete s.observedBy[id]
 if(s.mode==='ceiling'&&(!tileAt(w,c.pos).roof||capacity(w,c,'moving')<.25||!c.alive)){
  if(c.alive){const from={...c.pos},to=[c.pos,...DIRS.map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y}))].find(p=>inBounds(w,p)&&terrainAt(w,p).passable&&!creatureAt(w,p)&&!diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y));if(to){c.pos={...to};if(from.x!==to.x||from.y!==to.y)fx(w,{k:'move',id:c.id,from,to:{...to},turn:turnOf(w)})}}
  s.mode='floor'
 }
}
export function crawlerBiteToxin(w:World,c:Creature,target:Creature,attackId:string|undefined,partId:string,woundId:number){
 const d=crawlerRules(w,c),entry=target.body.wounds.find(x=>x.id===woundId&&x.part===partId&&x.sourceId===c.id);if(!d||attackId!==d.venomAttack||!entry||w.db.wound(entry.def).bleedPerSeverity<=0)return
 const g=c.crawlerState!.glands.find(g=>g.item&&(g.item.uses??0)>0&&!isMissing(w,c,g.part)&&partEff(w,c,g.part)>0);if(!g?.item)return
 const rule=w.db.item(g.item.def).neurotoxin;if(!rule)return
 g.item.uses!--;g.spentDoses++;c.crawlerState!.lastBite={at:turnOf(w),target:target.id,woundId,sourceUid:g.uid}
 applyLocalToxin(w,c,target,partId,woundId,{sourceUid:g.uid,sourceDef:g.item.def,turns:[...rule.turns]})
}
export function ceilingInspectionError(w:World,c:Creature){return !c.alive||c.asleep||c.unconscious||capacity(w,c,'sight')<.2?'깨어서 천장을 살필 수 있어야 한다':!tileAt(w,c.pos).roof?'위를 덮은 실제 천장이 없다':null}
export function inspectCeiling(w:World,c:Creature):ActResult{
 const error=ceilingInspectionError(w,c);if(error)return fail(error)
 let found=0
 for(const target of w.s.creatures){const d=crawlerRules(w,target);if(!d||!target.alive||target.crawlerState!.mode!=='ceiling'||cheb(c.pos,target.pos)>d.ceiling.inspectRadius||!canSee(w,c,target.pos)||!hasLos(w,c.pos,target.pos))continue
  target.crawlerState!.observedBy[c.id]=turnOf(w)+d.ceiling.awarenessTurns;found++
 }
 if(c.id===w.s.playerId)log(w,found?'warn':'info',found?'천장에 매달린 지네를 살폈다. 당분간 위쪽 기습을 경계한다.':'곁의 천장을 살폈다. 움직이는 것은 찾지 못했다.')
 return{ok:true,tu:100}
}
export function crawlerClimb(w:World,c:Creature):ActResult{
 const d=crawlerRules(w,c),s=c.crawlerState
 if(!d||!s||!c.alive||c.asleep||c.unconscious||s.mode!=='floor'||s.nextClimbAt>turnOf(w)||!tileAt(w,c.pos).roof||terrainAt(w,c.pos).water||capacity(w,c,'moving')<.5)return fail('실제 천장과 붙들 다리가 필요하다')
 s.mode='ceiling';emitNoise(w,c.pos,2,c.id);return{ok:true,tu:100}
}
export function crawlerDrop(w:World,c:Creature,targetId:number):ActResult{
 const d=crawlerRules(w,c),s=c.crawlerState,target=creatureById(w,targetId)
 if(!d||!s||s.mode!=='ceiling'||!c.alive||c.asleep||c.unconscious||!target?.alive||target.id===c.id||cheb(c.pos,target.pos)>d.ceiling.dropRadius||!canSee(w,c,target.pos)||!hasLos(w,c.pos,target.pos))return fail('바로 아래에서 실제로 감지한 대상이 필요하다')
 let landing={...c.pos}
 if(creatureAt(w,landing)){const q=DIRS.map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y})).find(p=>inBounds(w,p)&&terrainAt(w,p).passable&&!terrainAt(w,p).water&&!creatureAt(w,p)&&cheb(p,target.pos)<=1&&!diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y));if(!q)return fail('내려설 자리가 없다');landing=q}
 const from={...c.pos},aware=(s.observedBy[target.id]??0)>turnOf(w);s.mode='floor';s.nextClimbAt=turnOf(w)+d.ceiling.reclimbTurns;c.pos=landing;c.facing=dirIndex(target.pos.x-c.pos.x,target.pos.y-c.pos.y);s.lastDrop={at:turnOf(w),target:target.id,aware}
 if(from.x!==landing.x||from.y!==landing.y)fx(w,{k:'move',id:c.id,from,to:{...landing},turn:turnOf(w)})
 fx(w,{k:'status',id:c.id,text:'천장 낙하',color:'#b9ad8b',turn:turnOf(w)});emitNoise(w,c.pos,6,c.id)
 if(c.id===w.s.playerId||target.id===w.s.playerId)log(w,'danger',aware?'경계하던 지네가 천장에서 내려왔다.':'천장에서 지네가 떨어져 위쪽으로 덮쳤다!')
 resolveAttack(w,c,target,{mode:d.venomAttack,mods:{hitBonus:aware?0:d.ceiling.ambushHit,fromAbove:true,partWeights:{head:2,torso:1}},abilityLabel:'천장 독 물기'})
 return{ok:true,tu:100}
}
export function crawlerHarvest(w:World,c:Creature,mult:number){
 const d=crawlerRules(w,c);if(!d||c.alive)return
 const tile=tileAt(w,c.pos)
 for(const g of c.crawlerState!.glands){if(!g.item)continue
  const alive=!isMissing(w,c,g.part)&&partDamage(c,g.part)<c.body.maxHp[g.part],remaining=g.item.uses??0
  if(alive&&remaining>0&&mult===1){tile.items.push(g.item);g.harvestedDoses+=remaining;delete g.item}
  else{g.lostDoses+=remaining;delete g.item}
 }
}
export function limitCrawlerCarcass(w:World,c:Creature){
 const d=crawlerRules(w,c);if(!d||!c.carcassStock)return;c.crawlerState!.mode='floor'
 const plates=d.segments.filter(g=>!isMissing(w,c,g.body)&&partDamage(c,g.body)<c.body.maxHp[g.body]).length,legs=d.segments.flatMap(g=>g.legs).filter(p=>!isMissing(w,c,p)&&partDamage(c,p)<c.body.maxHp[p]).length,meat=Math.floor(d.harvest.meatCount*plates/d.segments.length)
 for(const[id,count]of[[d.harvest.plateItem,plates],[d.harvest.legItem,legs],[d.harvest.meatItem,meat]]as const){const stock=c.carcassStock[id];if(stock)stock.remaining=Math.min(stock.remaining,count)}
 c.crawlerState!.harvestLost={plates:d.segments.length-plates,legs:d.segments.length*2-legs,meat:d.harvest.meatCount-meat}
}
export function decideCrawler(w:World,c:Creature,nav:{toward(p:Pos):Action|null}):Action{
 const d=crawlerRules(w,c),s=c.crawlerState;if(!d||!s||!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.3)return{type:'wait'}
 crawlerTick(w,c)
 const smoke=w.s.map.lights.filter(l=>!l.off&&l.radius>0&&(l.fuelUntil??Infinity)>turnOf(w)&&d.smokeKinds.includes(l.kind??'')&&cheb(c.pos,l.pos)<=d.smokeRadius&&hasLos(w,c.pos,l.pos))
 if(smoke.length){if(s.mode==='ceiling'){s.mode='floor';s.nextClimbAt=turnOf(w)+d.ceiling.reclimbTurns}const exits=DIRS.map((v,dir)=>({dir,pos:{x:c.pos.x+v.x,y:c.pos.y+v.y}})).filter(q=>inBounds(w,q.pos)&&terrainAt(w,q.pos).passable&&!terrainAt(w,q.pos).water&&!creatureAt(w,q.pos)&&!diagonalBlocked(w,c.pos,q.pos.x-c.pos.x,q.pos.y-c.pos.y)).sort((a,b)=>smoke.reduce((n,l)=>n+cheb(b.pos,l.pos)-cheb(a.pos,l.pos),0)||a.dir-b.dir);return exits.length?{type:'move',dir:exits[0].dir}:{type:'wait'}}
 const targets=w.s.creatures.filter(t=>t.id!==c.id&&t.alive&&t.crawlerState?.mode!=='ceiling'&&(hostile(w,c,t)||c.needs.kcal<d.huntBelowKcal&&d.prey.includes(t.def))&&canSee(w,c,t.pos)).sort((a,b)=>cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.id-b.id),target=targets[0]
 const thirsty=c.needs.waterDeficit>=d.drinkAboveMl,water=thirsty?nearbyWater(w,c):null
 const bank=thirsty&&!water?w.s.map.tiles.flatMap((t,i)=>{const p={x:i%w.s.map.w,y:Math.floor(i/w.s.map.w)};return w.db.terrain(t.t).water&&canSee(w,c,p)?DIRS.map(v=>({x:p.x+v.x,y:p.y+v.y})).filter(q=>inBounds(w,q)&&terrainAt(w,q).passable&&!terrainAt(w,q).water&&hasLos(w,q,p)&&!diagonalBlocked(w,q,p.x-q.x,p.y-q.y)):[]}).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b))[0]:undefined
 const food=c.needs.kcal<d.eatBelowKcal?w.s.creatures.filter(t=>!t.alive&&d.prey.includes(t.def)&&canSee(w,c,t.pos)&&d.foodIds.some(id=>carcassCount(t,id)>0)).sort((a,b)=>cheb(c.pos,a.pos)-cheb(c.pos,b.pos))[0]:undefined
 const floor=c.needs.kcal<d.eatBelowKcal?w.s.map.tiles.flatMap((t,i)=>t.items.filter(it=>d.foodIds.includes(it.def)&&it.count>0&&!it.foodFrozen).map(it=>({it,pos:{x:i%w.s.map.w,y:Math.floor(i/w.s.map.w)}}))).filter(q=>canSee(w,c,q.pos)).sort((a,b)=>cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.it.uid-b.it.uid)[0]:undefined
 if(s.mode==='ceiling'){
  if(target&&cheb(c.pos,target.pos)<=d.ceiling.dropRadius)return{type:'crawlerDrop',target:target.id}
  if((food||floor||water||bank)&&(!target||cheb(c.pos,target.pos)>2))return{type:'crawlerDescend'}
  const goal=target&&(c.needs.kcal<d.huntBelowKcal||c.body.wounds.some(x=>x.sourceId===target.id))?target.pos:c.ai.mode==='investigate'?c.ai.dest:undefined
  if(goal){const blocked=new Set(w.s.map.tiles.flatMap((t,i)=>!t.roof||!w.db.terrain(t.t).passable?[i]:[])),path=findPath(w,c.pos,goal,{avoidCreatures:false,selfId:c.id,maxNodes:1200,avoidCells:blocked});if(path?.[0])return{type:'crawlerCeilingMove',dir:dirIndex(path[0].x-c.pos.x,path[0].y-c.pos.y)};return{type:'crawlerDescend'}}
  return{type:'wait'}
 }
 if(thirsty&&(!target||cheb(c.pos,target.pos)>2)){if(water)return{type:'crawlerDrink'};if(bank)return nav.toward(bank)??{type:'wait'}}
 if((food||floor)&&(!target||cheb(c.pos,target.pos)>2)){
  if(food)return cheb(c.pos,food.pos)<=1?{type:'crawlerFeed',target:food.id}:nav.toward(food.pos)??{type:'wait'}
  if(floor)return cheb(c.pos,floor.pos)<=1?{type:'crawlerEat',uid:floor.it.uid}:nav.toward(floor.pos)??{type:'wait'}
 }
 if(target){c.ai.target=target.id;c.ai.mode='hunt';if(cheb(c.pos,target.pos)<=1){if(!hasEffect(target,'grabbed',turnOf(w))&&d.segments.filter(g=>g.legs.some(p=>partEff(w,c,p)>.2)).length>=4&&(c.cooldowns[d.coilAbility]??-1)<=turnOf(w))return{type:'ability',id:d.coilAbility,target:target.id};return{type:'attack',target:target.id,mode:d.venomAttack}}return nav.toward(target.pos)??{type:'wait'}}
 if(c.ai.mode==='investigate'&&c.ai.dest&&cheb(c.pos,c.ai.dest)>0)return nav.toward(c.ai.dest)??{type:'wait'}
 if(tileAt(w,c.pos).roof&&s.nextClimbAt<=turnOf(w)&&capacity(w,c,'moving')>=.5)return{type:'crawlerClimb'}
 return{type:'wait'}
}

export function crawlerCoilError(w:World,c:Creature){const raw=w.db.creature(c.def).crawler;if(!raw)return null;const d=crawlerRules(w,c);return !d||c.crawlerState?.mode!=='floor'||d.segments.filter(g=>g.legs.some(p=>partEff(w,c,p)>.2)).length<4?'지상에서 네 체절 이상의 실제 다리로 붙들어야 한다':null}

export function crawlerDescend(w:World,c:Creature):ActResult{
 const d=crawlerRules(w,c),s=c.crawlerState;if(!d||!s||s.mode!=='ceiling'||!c.alive||c.asleep||c.unconscious)return fail('내려올 실제 천장 몸이 없다')
 const choices=[c.pos,...DIRS.map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y}))],to=choices.find(p=>inBounds(w,p)&&terrainAt(w,p).passable&&!terrainAt(w,p).water&&!creatureAt(w,p)&&!diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y));if(!to)return fail('내려설 지상이 없다')
 const from={...c.pos};s.mode='floor';s.nextClimbAt=turnOf(w)+d.ceiling.reclimbTurns;c.pos={...to};if(from.x!==to.x||from.y!==to.y)fx(w,{k:'move',id:c.id,from,to:{...to},turn:turnOf(w)});return{ok:true,tu:100}
}
export function crawlerFeed(w:World,c:Creature,targetId:number):ActResult{
 const d=crawlerRules(w,c),corpse=creatureById(w,targetId)
 if(!d||c.crawlerState?.mode!=='floor'||!c.alive||c.asleep||c.unconscious||capacity(w,c,'eating')<.1||!corpse||corpse.alive||!d.prey.includes(corpse.def)||cheb(c.pos,corpse.pos)>1||!canSee(w,c,corpse.pos)||!hasLos(w,c.pos,corpse.pos)||diagonalBlocked(w,c.pos,corpse.pos.x-c.pos.x,corpse.pos.y-c.pos.y))return fail('입이 닿는 실제 먹잇감 사체가 필요하다')
 const id=d.foodIds.find(id=>carcassCount(corpse,id)>0&&!corpse.carcassStock?.[id]?.foodFrozen);if(!id)return fail('원래 사체의 먹을 살이 남지 않았다')
 const portion=takeCarcassPortion(w,corpse,id)!;swallowAnimalFood(w,c,portion,1);return{ok:true,tu:100}
}
export function crawlerEat(w:World,c:Creature,uid:number):ActResult{
 const d=crawlerRules(w,c);if(!d||!c.alive||c.asleep||c.unconscious||c.crawlerState?.mode!=='floor'||capacity(w,c,'eating')<.1)return fail('지상에서 먹을 실제 입이 필요하다')
 const nearby=[c.pos,...DIRS.map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y}))].filter(p=>inBounds(w,p)&&canSee(w,c,p)&&hasLos(w,c.pos,p)&&!diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y)),source=nearby.map(pos=>({pos,item:tileAt(w,pos).items.find(i=>i.uid===uid)})).find(q=>q.item),item=source?.item
 if(!item||!d.foodIds.includes(item.def)||item.count<1||item.foodFrozen||!w.db.item(item.def).food)return fail('곁에 남은 실제 먹이가 필요하다')
 swallowAnimalFood(w,c,item,1);item.count--;if(!item.count)tileAt(w,source!.pos).items=tileAt(w,source!.pos).items.filter(i=>i.uid!==uid);return{ok:true,tu:100}
}

export function crawlerDrink(w:World,c:Creature):ActResult{const d=crawlerRules(w,c);if(!d||c.crawlerState?.mode!=='floor'||!c.alive||c.asleep||c.unconscious||capacity(w,c,'eating')<.1)return fail('지상에서 물을 마실 실제 입이 필요하다');return drinkAnimalWater(w,c,d.drinkMl)}
export function crawlerCeilingMove(w:World,c:Creature,dir:number):ActResult{
 const d=crawlerRules(w,c),v=DIRS[dir];if(!d||!v||c.crawlerState?.mode!=='ceiling'||!c.alive||c.asleep||c.unconscious||capacity(w,c,'moving')<.25)return fail('천장을 붙들 실제 다리가 필요하다')
 const to={x:c.pos.x+v.x,y:c.pos.y+v.y};if(!inBounds(w,to)||!tileAt(w,to).roof||!terrainAt(w,to).passable||diagonalBlocked(w,c.pos,v.x,v.y)||w.s.creatures.some(t=>t.id!==c.id&&t.alive&&t.crawlerState?.mode==='ceiling'&&t.pos.x===to.x&&t.pos.y===to.y))return fail('열린 천장 경로가 없다')
 const from={...c.pos};c.pos=to;c.facing=dir;fx(w,{k:'move',id:c.id,from,to:{...to},turn:turnOf(w)});emitNoise(w,c.pos,2,c.id);return{ok:true,tu:Math.ceil(w.db.creature(c.def).moveTU/Math.max(.1,capacity(w,c,'moving')))}
}
