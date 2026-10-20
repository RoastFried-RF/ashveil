// 03 §7.4. 옷과 몸을 즉시 고치지 않는다. 실제 착탈 행동을 공유하는 통제 상실 요청이다.
import type { Action } from './actions'
import { channelTurns } from './action-time'
import { capacity } from './body'
import { rng, turnOf, type World } from './ctx'
import { itemDef } from './items'
import type { ColdConfusionDef, Creature } from './types'
export const coldConfusionDef=(w:World)=>w.db.get<ColdConfusionDef>('ColdConfusion.Human')
function outerCoat(w:World,c:Creature){
  return coldConfusionDef(w).slots.map((slot)=>({slot,it:c.equip[slot]})).filter((row)=>row.it&&itemDef(w,row.it).apparel).sort((a,b)=>(itemDef(w,b.it!).apparel!.layer??0)-(itemDef(w,a.it!).apparel!.layer??0))[0]
}
function eligible(w:World,c:Creature){
  const d=coldConfusionDef(w)
  return c.alive&&!c.unconscious&&c.needs.bodyTemp<d.temperature&&capacity(w,c,'consciousness')<d.consciousness&&capacity(w,c,'manipulation')>=.1
}
/** 몸을 갱신한 뒤10분 경계에서만 한 번 판정한다. 다른 인물의 순서와 난수를 공유하지 않는다. */
export function coldConfusionTick(w:World,c:Creature){
  const d=coldConfusionDef(w),turn=turnOf(w)
  if(d.chance<=0||turn%d.intervalTurns!==0||c.coldConfusion?.checked===turn||c.coldConfusion?.pending||!eligible(w,c))return
  const coat=outerCoat(w,c)
  if(!coat||c.activity?.kind==='unequip'&&c.activity.uid===coat.it?.uid||channelTurns(w,c,itemDef(w,coat.it!).equipTurns?.[1]??1)===null)return
  const state=c.coldConfusion??={checked:turn};state.checked=turn
  if(rng(w,`body.coldConfusion.${c.id}`).chance(d.chance))state.pending={slot:coat.slot,uid:coat.it!.uid,at:turn}
}
/** 스케줄러가 정상 차례에서 요청을 소비한다. 재가온/다른 옷·기한 지난 요청은 취소한다. */
export function coldConfusionAction(w:World,c:Creature):Action|null{
  const state=c.coldConfusion,pending=state?.pending
  if(!pending)return null
  state!.pending=undefined
  const it=c.equip[pending.slot],d=coldConfusionDef(w)
  if(!eligible(w,c)||turnOf(w)>=pending.at+d.intervalTurns||it?.uid!==pending.uid||channelTurns(w,c,itemDef(w,it).equipTurns?.[1]??1)===null)return null
  return{type:'unequip',slot:pending.slot,dropAfter:true,expectedUid:pending.uid}
}
