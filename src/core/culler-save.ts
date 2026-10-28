/** Original finite equipment ledger, even when its corpse stock has been handed off. */
import type {Creature,GameState} from './types'
const integer=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0
export function validateCullerSave(s:GameState){
 const pending:unknown[]=[s],visited=new Set<object>()
 while(pending.length){const value=pending.pop();if(!value||typeof value!=='object'||visited.has(value))continue;visited.add(value);const o=value as Record<string,unknown>
  if(o.bellSignals!==undefined&&Array.isArray(o.events)&&o.level!==undefined&&!integer(o.bellSignals))throw Error('구역의 반복 정비 신호 기록이 올바르지 않다')
  if(o.cullerState!==undefined){const c=o as unknown as Creature,r=c.cullerState!
   if(!r||typeof r.rule!=='string'||!r.rule||r.rule.length>65536||!integer(r.attacks)||r.attacks>1000||!integer(r.coolUntil)||typeof r.returning!=='boolean'||!Array.isArray(r.components)||r.components.length>128)throw Error('구제기의 원래 행동/부품 기록이 올바르지 않다')
   if(r.tracked&&(!integer(r.tracked.id)||!integer(r.tracked.at)||!r.tracked.pos||!integer(r.tracked.pos.x)||!integer(r.tracked.pos.y)))throw Error('구제기의 실제 마지막 관찰 기록이 올바르지 않다')
   const ids=new Set<number>();for(const row of r.components){if(!row||!integer(row.uid)||row.uid<1||ids.has(row.uid)||typeof row.part!=='string'||!row.part||typeof row.def!=='string'||!row.def||!['count','uses'].includes(row.unit)||![row.initial,row.spent,row.lost].every(integer)||row.initial<1||row.initial>10000||row.spent+row.lost>row.initial)throw Error('구제기의 원래 실물 수량 기록이 올바르지 않다');ids.add(row.uid)
    if(c.alive){const item=c.body?.machine?.components?.find(i=>i.uid===row.uid),remaining=item?(row.unit==='uses'?item.uses??0:item.count):0;if(item&&item.def!==row.def||!integer(remaining)||row.spent+row.lost+remaining!==row.initial)throw Error('구제기의 남은 원래 부품 수량이 보존되지 않았다')}
   }
  }
  if(o.kind==='netted'&&(!integer(o.sourceUid)||Number(o.sourceUid)<1||!integer(o.sourceId)||typeof o.sourceDef!=='string'||!o.sourceDef||!integer(o.untilTurn)||!Number.isFinite(o.magnitude)||Number(o.magnitude)<=0))throw Error('원래 포획망의 출처 기록이 올바르지 않다')
  pending.push(...Object.values(o))
 }
}
