import {capacity} from './body'
import {allItems,findItem,itemDef} from './items'
import {channelTurns} from './action-time'
import type {World} from './ctx'
import {foodServings} from './food-vessels'
import type {Creature,ItemDef,ItemInst} from './types'
export const openingSignature=(w:World,d:ItemDef)=>JSON.stringify({openFood:d.openFood,result:d.openFood?w.db.item(d.openFood.result).food:undefined})
export function openFoodQuote(w:World,c:Creature,uid:number,toolUid?:number){
 const it=findItem(c,uid),d=it&&itemDef(w,it),rule=d?.openFood
 const tool=rule&&allItems(c).filter(i=>rule.tools.includes(i.def)&&(i.durability??100)>0&&(toolUid===undefined||i.uid===toolUid)).sort((a,b)=>a.uid-b.uid)[0]
 let error:string|null=null
 if(!it||!rule||it.count!==1||!c.bag.includes(it))error='배낭의 원래 밀봉 음식을 확인해야 한다'
 else if(!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 용기를 다룰 손을 쓸 수 있어야 한다'
 else if(!tool)error='사용할 수 있는 실제 칼이나 손도끼가 필요하다'
 const turns=rule?channelTurns(w,c,rule.turns):null
 if(!error&&turns===null)error='몸 상태로 용기를 열 수 없다'
 return{error,it,d,rule,tool,turns:turns??0}
}


/** 자동 식사도 실제로 열 수 있는 음식과 남아 있는 회분만 고른다. */
export function readyFood(w:World,c:Creature,it:ItemInst){
 const d=itemDef(w,it)
 return !!d.food&&foodServings(w,it)>0&&(!d.openFood||!openFoodQuote(w,c,it.uid).error)
}
