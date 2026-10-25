/** Validate original stock and saved local effects, including items in cached maps/containers. */
import type {GameState,ToxinCoating} from './types'
const integer=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0
function coating(t:ToxinCoating){if(!t||!integer(t.sourceUid)||t.sourceUid<1||typeof t.sourceDef!=='string'||!t.sourceDef||!Array.isArray(t.turns)||t.turns.length!==2||t.turns.some(n=>!integer(n)||n<1||n>10000)||t.turns[0]>t.turns[1])throw Error('원래 독샘/국소 마비 기간의 기록이 올바르지 않다')}
export function validateCrawlerSave(s:GameState){
 const stack:unknown[]=[s],seen=new Set<object>()
 while(stack.length){const value=stack.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value)
  const obj=value as Record<string,unknown>
  if(typeof obj.uid==='number'&&typeof obj.def==='string'&&typeof obj.count==='number')for(const k of['toxin','loadedAmmoToxin'])if(obj[k]!==undefined)coating(obj[k] as ToxinCoating)
  if(obj.kind==='reload'&&typeof obj.remaining==='number'&&obj.ammoToxin!==undefined)coating(obj.ammoToxin as ToxinCoating)
  if(obj.crawlerState!==undefined){const c=obj.crawlerState as NonNullable<import('./types').Creature['crawlerState']>
   if(!c||typeof c.rule!=='string'||!c.rule||c.rule.length>32768||!['floor','ceiling'].includes(c.mode)||!integer(c.nextClimbAt)||!c.observedBy||typeof c.observedBy!=='object'||Object.entries(c.observedBy).some(([id,t])=>!/^\d+$/.test(id)||!integer(t))||!Array.isArray(c.glands)||c.glands.length!==2)throw Error('지네의 원래 천장/독샘 기록이 올바르지 않다')
   const ids=new Set<number>();for(const g of c.glands){if(!g||typeof g.part!=='string'||!g.part||!integer(g.uid)||g.uid<1||ids.has(g.uid)||![g.initialDoses,g.spentDoses,g.lostDoses,g.harvestedDoses].every(integer)||g.initialDoses<1||g.initialDoses>64||g.spentDoses+g.lostDoses+g.harvestedDoses+(g.item?.uses??0)!==g.initialDoses||g.item&&(g.item.uid!==g.uid||g.item.count!==1||!integer(g.item.uses)))throw Error('지네의 원래 독샘 수량 보존이 올바르지 않다');ids.add(g.uid)}
  }
  if(obj.paralysis!==undefined){const list=obj.paralysis as NonNullable<import('./types').Creature['paralysis']>;if(!Array.isArray(list)||list.length>256)throw Error('국소 마비 목록이 올바르지 않다');for(const p of list){if(!p||!integer(p.sourceUid)||p.sourceUid<1||typeof p.sourceDef!=='string'||!integer(p.woundId)||!Array.isArray(p.parts)||!p.parts.length||p.parts.length>128||p.parts.some(id=>typeof id!=='string'||!id)||!['head','torso','larm','rarm','lleg','rleg'].includes(p.region)||!integer(p.appliedAt)||!integer(p.until)||p.until<=p.appliedAt)throw Error('원래 상처와 국소 마비 기록이 올바르지 않다')}}
  stack.push(...Object.values(obj))
 }
}
