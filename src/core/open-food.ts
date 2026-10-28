import {log,turnOf,type World} from './ctx'
import {openFoodQuote,openingSignature} from './open-food-state'
import type {Creature} from './types'
export function startOpenFood(w:World,c:Creature,uid:number,eatTarget?:number):string|null{
 if(c.activity)return '하던 일을 먼저 마쳐야 한다'
 const q=openFoodQuote(w,c,uid);if(q.error)return q.error
 c.activity={kind:'openFood',remaining:q.turns,total:q.turns,label:'밀봉 음식 따기',uid,foodOpening:{toolUid:q.tool!.uid,def:q.it!.def,signature:openingSignature(w,q.d!),eatTarget}}
 return null
}
export function openFoodStep(w:World,c:Creature):{done:boolean;uid?:number;eatTarget?:number}{
 const act=c.activity,work=act?.foodOpening
 if(!act||!work)return{done:true}
 const q=openFoodQuote(w,c,act.uid!,work.toolUid)
 if(q.error||q.it!.def!==work.def||openingSignature(w,q.d!)!==work.signature){
  c.activity=undefined;if(c.id===w.s.playerId)log(w,'warn','개봉 중단: '+(q.error??'원래 밀봉 음식이나 개봉 규칙이 바뀌었다')+'. 진행은 남지 않는다.');return{done:true}
 }
 if(act.remaining>0)return{done:false}
 const it=q.it!,result=w.db.item(q.rule!.result)
 it.def=result.id;it.freshness=Math.min(100,it.freshness??100);it.foodAgedAt=turnOf(w);it.uses=result.food?.servings;it.foodVesselDef=result.food?.emptyVessel
 delete it.foodSealed;delete it.foodLeftover
 c.activity=undefined
 if(c.id===w.s.playerId)log(w,'info','원래 도구로 '+q.d!.label+'을(를) 땄다.')
 return{done:true,uid:it.uid,eatTarget:work.eatTarget}
}
