import {finishCookingWater} from './meal-water'
import type {RngStream} from './rng'
// 배낭에서 꺼낸 원래 한 개를 같은 유한 모닥불에서 익히고 회수한다.
import {campfireAt} from './campfire'
import {cookingAccess,cookingQuote,cookingRules,cookingSignature,cookingTemperature} from './cooking-state'
import {cookingQualityBase} from './crafting'
import {ageFood} from './food-safety'
import {ambientTemp} from './environment'
import {mapWorlds} from './journey'
import {addToBag,findSpot,itemDef,removeOne} from './items'
import {clamp,log,rng,turnOf,type World} from './ctx'
import {masteryStage,practice} from './skills'
import type {Creature,ItemInst} from './types'
import type {Pos} from './geom'
export function stageCooking(w:World,c:Creature,uid:number,pos:Pos){
 const q=cookingQuote(w,c,uid,pos);if(q.error)return q.error
 const item=removeOne(w,c,uid)!
 beginCooking(w,c,item,pos,q.fireUid!)
 return null
}
export function beginCooking(w:World,c:Creature,item:ItemInst,pos:Pos,fireUid:number){
 const source=item.def,recipe=itemDef(w,item).cooking!
 ageFood(w,item,ambientTemp(w),Math.max(0,turnOf(w)-(item.foodAgedAt??turnOf(w))),c.needs.wetness>=50);item.foodAgedAt=turnOf(w)
 const progress=Math.min(recipe.turns-1,Math.max(0,item.cookProgress??0));delete item.cookProgress
 const mastery=masteryStage(w,c,'survival')
 ;(w.s.map.cooking??=[]).push({item,fireUid,pos:{...pos},crafter:c.id,source,result:recipe.result,signature:cookingSignature(w,source),progress,total:recipe.turns,lastAt:turnOf(w),hotReadyTurns:0,mastery,qualityBase:cookingQualityBase(w,c)})
 if(c.id===w.s.playerId)log(w,'info',itemDef(w,item).label+' 한 개를 모닥불에 올렸다. 익은 뒤에도 불 위에 두면 탈 수 있다.')
 return null
}
export function takeCooking(w:World,c:Creature,uid:number){
 const batch=w.s.map.cooking?.find(b=>b.item.uid===uid);if(!batch)return '모닥불에 그 음식이 없다'
 const error=cookingAccess(w,c,batch.pos);if(error)return error
 const base=w.s.map.baseCamp
 if(c.id!==batch.crafter&&!(base&&base.owner===batch.crafter&&c.companion?.employer===base.owner))return '자신이 올린 음식만 회수할 수 있다'
 if(!findSpot(w,c,itemDef(w,batch.item)))return '음식을 받을 배낭 칸이 필요하다'
 if(batch.progress<batch.total)batch.item.cookProgress=batch.progress
 ageFood(w,batch.item,cookingTemperature(w,batch,ambientTemp(w)),Math.max(0,turnOf(w)-(batch.item.foodAgedAt??turnOf(w))));batch.item.foodAgedAt=turnOf(w)
 if(addToBag(w,c,batch.item))return '음식을 받을 배낭 칸이 필요하다'
 w.s.map.cooking=w.s.map.cooking!.filter(b=>b!==batch)
 if(c.id===w.s.playerId)log(w,'info',itemDef(w,batch.item).label+' 한 개를 불에서 내렸다.')
 return null
}
/** 관측한 연속 한 턴의 원래 연료만 센다. UI 조회와 저장 복원은 정산하지 않는다. */
export function cookingTick(w:World){
 const maps=[w.s.map,...Object.values(w.s.maps),...Object.values(w.s.overworld?.scenes??{}).flatMap(s=>[s.map,...Object.values(s.maps)])]
 if(!maps.some(m=>m.cooking?.length))return
 const now=turnOf(w)
 for(const local of mapWorlds(w))for(const b of local.s.map.cooking??[]){
  if(b.lastAt>=now)continue
  const f=campfireAt(local,b.pos),consecutive=now===b.lastAt+1
  b.lastAt=now
  ageFood(local,b.item,consecutive?cookingTemperature(local,b,ambientTemp(local)):ambientTemp(local),Math.max(0,now-(b.item.foodAgedAt??now)));b.item.foodAgedAt=now
  if(!consecutive||cookingSignature(local,b.source)!==b.signature||!f||f.uid!==b.fireUid||f.light.off||(f.light.fuelUntil??0)<now)continue
  if(b.progress<b.total){
   b.progress++
   if(b.progress===b.total){
    ageFood(local,b.item,cookingTemperature(local,b,ambientTemp(local)),Math.max(0,now-(b.item.foodAgedAt??now)));b.item.foodAgedAt=now;b.item.def=b.result
    if(b.item.foodFrozen){b.item.foodThawed=true;delete b.item.foodFrozen}
    finishCookingWater(local,b.item)
    b.item.foodQ=clamp(b.qualityBase+rng(w,('cooking.'+b.item.uid)as RngStream).int(0,30)-15,0,100);b.readyAt=now
    const c=local.s.creatures.find(c=>c.id===b.crafter)
    if(c?.alive)practice(local,c,'survival','cook:'+b.item.uid)
    if(local.s.map===w.s.map&&b.crafter===w.s.playerId)log(w,'good',itemDef(local,b.item).label+' 한 개가 익었다. 불 위에서 회수할 수 있다.')
   }
  }else if(!b.item.foodBurnt){
   const d=cookingRules(local)!;b.hotReadyTurns++
   if(b.hotReadyTurns>=d.neglectTurns){
    b.hotReadyTurns-=d.neglectTurns
    const chance=Math.max(0,d.burnChance-b.mastery*d.masteryReduction)
    if(chance>0&&rng(w,('cooking.'+b.item.uid)as RngStream).chance(chance)){b.item.foodBurnt=true;if(local.s.map===w.s.map&&b.crafter===w.s.playerId)log(w,'warn','불 위에 남긴 '+itemDef(local,b.item).label+'이(가) 탔다.')}
   }
  }
 }
}
