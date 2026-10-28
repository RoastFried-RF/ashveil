import {turnOf,type World} from './ctx'
import {ambientTemp} from './environment'
import {ageFood} from './food-safety'
import {foodFreshness,freshnessBand,FRESHNESS_LABEL} from './food-state'
import {canStack,itemDef,maxStack} from './items'
import type {Creature,ItemInst} from './types'

/** 원본을 바꾸지 않고 같은 현재 기후/시각까지 두 음식을 정산한다. */
export function foodMergeQuote(w:World,c:Creature,uid:number,into:number,n?:number){
 const from=c.bag.find(i=>i.uid===uid),to=c.bag.find(i=>i.uid===into)
 const fail=(error:string)=>({error,needsConsent:false,signature:'',count:0,description:'',from:undefined as ItemInst|undefined,to:undefined as ItemInst|undefined})
 if(!from||!to||from===to)return fail('합칠 두 물품이 배낭에 없다')
 const def=itemDef(w,from)
 if(from.missingItem||to.missingItem||from.def!==to.def||!def.food?.freshHours||maxStack(def)<=1)return fail('같은 종류의 쌓을 수 있는 음식만 합친다')
 if(n!==undefined&&(!Number.isSafeInteger(n)||n<1||n>from.count))return fail('옮길 음식 수량이 올바르지 않다')
 const count=Math.min(n??from.count,from.count,maxStack(itemDef(w,to))-to.count)
 if(count<1)return fail('더 쌓을 수 없다')
 const now=turnOf(w),temperature=ambientTemp(w),wet=c.needs.wetness>=50
 const a=structuredClone(from),b=structuredClone(to)
 for(const it of[a,b]){ageFood(w,it,temperature,Math.max(0,now-(it.foodAgedAt??now)),wet);it.foodAgedAt=now}
 const low=Math.min(foodFreshness(a),foodFreshness(b)),leftBand=freshnessBand(w,a),rightBand=freshnessBand(w,b)
 if(!canStack({...a,freshness:low},{...b,freshness:low}))return fail('음식의 품질·오염·보존 상태가 달라 쌓이지 않는다')
 b.freshness=low
 const description=`${FRESHNESS_LABEL[leftBand]} ${count}개 + ${FRESHNESS_LABEL[rightBand]} ${to.count}개 → ${FRESHNESS_LABEL[freshnessBand(w,b)]} ${count+to.count}개 (신선도 ${Math.floor(low)}%)`
 const signature=JSON.stringify({owner:c.id,map:w.s.map.id,now,temperature,wet,hash:w.db.loadHash,from,to,count})
 return{error:null,needsConsent:leftBand!==rightBand,signature,count,description,from:a,to:b}
}

/** 확인은 같은 두 UID/전체 상태·수량·현재 시각/기후/정의에만 유효하다. */
export function mergeFood(w:World,c:Creature,uid:number,into:number,n?:number,approval?:string):string|null{
 const quote=foodMergeQuote(w,c,uid,into,n)
 if(quote.error)return quote.error
 if(approval!==undefined&&approval!==quote.signature)return '음식이나 현재 상태가 바뀌었다. 다시 확인해야 한다'
 if(quote.needsConsent&&approval!==quote.signature)return '신선도 단계가 다른 음식이다. 낮아질 상태를 먼저 확인해야 한다'
 const from=c.bag.find(i=>i.uid===uid)!,to=c.bag.find(i=>i.uid===into)!
 Object.assign(from,quote.from,{count:from.count-quote.count})
 Object.assign(to,quote.to,{count:to.count+quote.count})
 if(from.count===0)c.bag=c.bag.filter(i=>i!==from)
 return null
}
