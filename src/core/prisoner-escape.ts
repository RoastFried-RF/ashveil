import { channelTurns } from './action-time'
import { bodyDef, capacity } from './body'
import { knownCreatureName } from './bestiary-state'
import { isCompanion } from './companion-state'
import { log, player, rng, turnOf, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb } from './geom'
import { qualityInfo } from './items'
import { captivityGuard } from './prisoner-care'
import { prisonerCareDef } from './prisoner-state'
import { releaseCaptivity } from './prisoners'
import { escortControlError } from './prisoner-escort'
import type { Creature } from './types'

/** 감시도 실제 몸·거리·시선·작업 상태를 쓴다. 잠든 경비는 감시자가 아니다. */
export function prisonerGuarded(w:World,c:Creature):boolean{
 if(!c.captivity)return false
 if(c.captivity.escort&&!escortControlError(w,c))return true
 return w.s.creatures.some((o)=>o.id!==c.id&&!o.captivity&&bodyDef(w,o).kind==='humanoid'&&(o.id===c.captivity!.captor||isCompanion(w,o)||['guard','raider'].includes(w.db.creature(o.def).ai))&&captivityGuard(w,c,o)&&!o.asleep&&!o.unconscious&&capacity(w,o,'consciousness')>=.5&&(!o.activity||o.activity.kind==='rest'||['prisoner','recruit','recruitInvite'].includes(o.activity.kind)&&o.activity.prisonerId===c.id)&&cheb(o.pos,c.pos)<=prisonerCareDef(w).guardRadius&&hasLos(w,o.pos,c.pos)&&canSee(w,o,c.pos))
}
export function struggleQuote(w:World,c:Creature){
 let error:string|null=null
 if(!c.alive||!w.s.creatures.includes(c)||!c.captivity||bodyDef(w,c).kind!=='humanoid'||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.5)error='깨어 있는 포박 상태여야 한다'
 if(!error&&prisonerGuarded(w,c))error='깨어 있는 감시자의 눈앞이다'
 // 결박 때문에 0인 능력치 대신 실제 팔·손과 몸 상태를 평가한다. 원본 몸은 수정하지 않는다.
 const free={...c,captivity:undefined},turns=channelTurns(w,free,prisonerCareDef(w).struggleTurns)
 if(!error&&turns===null)error='몸 상태로는 밧줄을 풀려 애쓸 수 없다'
 return{error,turns:turns??0,ropeUid:c.captivity?.rope.uid}
}
export function startStruggle(w:World,c:Creature):string|null{
 const q=struggleQuote(w,c);if(q.error)return q.error
 if(c.activity)return '이미 다른 활동 중이다'
 c.activity={kind:'struggle',uid:q.ropeUid,remaining:q.turns,total:q.turns,label:'밧줄을 풀려 애씀',woundCount:c.body.wounds.length}
 return null
}
export function struggleStep(w:World,c:Creature):boolean{
 const act=c.activity!,q=struggleQuote(w,c)
 if(q.error||act.uid!==q.ropeUid){c.activity=undefined;return true}
 if(act.remaining>0)return false
 const rope=c.captivity!.rope,d=prisonerCareDef(w),free={...c,captivity:undefined}
 rope.durability=Math.max(0,(rope.durability??100)-d.ropeWear/qualityInfo(rope).dur)
 const broken=rope.durability<=0,escaped=broken||rng(w,`body.escape.${c.id}`).chance(Math.min(1,d.escapeChance*capacity(w,free,'manipulation')/qualityInfo(rope).dur))
 c.history.push({turn:turnOf(w),kind:'prisoner',text:escaped?broken?'오래 애써 밧줄을 끊었다.':'감시가 끊긴 사이 밧줄에서 빠져나왔다.':'밧줄을 풀려 애썼지만 풀리지 않았다.'})
 if(escaped){releaseCaptivity(w,c);c.ai.mode='flee';c.ai.path=undefined;c.ai.target=undefined;if(canSee(w,player(w),c.pos))log(w,'warn',`${knownCreatureName(w,c)}이(가) ${broken?'밧줄을 끊고':'밧줄을 풀고'} 달아난다.`)}
 c.activity=undefined;return true
}
