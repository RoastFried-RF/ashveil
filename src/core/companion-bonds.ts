import { capacity } from './body'
import { companionBondDef, ensureCompanionBond } from './companion-bond-state'
import { isCompanion } from './companion-state'
import { endCompanionContract } from './companions'
import { clamp, log, player, rng, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb } from './geom'
import type { CompanionBond, Creature } from './types'
/** 새 주민에게만 지정한다. 구형 각인의 이미 살아온 사람에게 특성을 덧씌우지 않는다. */
export function initializeResidentPersonality(w:World,c:Creature){
  if(c.traits.length)return
  c.traits.push(rng(w,`body.personality.${c.id}`).pick(companionBondDef(w).personalities))
}
export function recordCompanionBond(w:World,c:Creature,kind:CompanionBond['events'][number]['kind'],delta:number,text:string){
  if(!isCompanion(w,c))return
  const b=ensureCompanionBond(w,c),d=companionBondDef(w),before=b.score;b.score=clamp(before+delta,d.min,d.max)
  b.events.push({turn:turnOf(w),kind,delta:b.score-before,text});if(b.events.length>30)b.events.shift()
  if(kind!=='betrayal'&&b.score<=d.leaveAt){endCompanionContract(w,c,'left');c.history.push({turn:turnOf(w),kind:'companion',text:'관계가 나빠져 더 동행하지 않기로 했다.'});if(canSee(w,player(w),c.pos))log(w,'warn',`${c.name}이(가) 더 함께 갈 수 없다며 고용을 끝냈다.`)}
}
export function companionBondTick(w:World,c:Creature){
  if(!c.alive||!isCompanion(w,c)||c.companion!.status!=='employed')return
  const b=ensureCompanionBond(w,c),now=turnOf(w),d=companionBondDef(w),p=player(w)
  if(b.lastTick>=now)return
  b.lastTick=now
  if(!p.alive||p.asleep||c.asleep||p.unconscious||c.unconscious||capacity(w,p,'consciousness')<.5||capacity(w,c,'consciousness')<.5||cheb(c.pos,p.pos)>d.range||!canSee(w,c,p.pos)||!canSee(w,p,c.pos))return
  b.together++
  if(b.together<d.periodTurns)return
  b.together-=d.periodTurns
  const day=Math.floor(now/TURNS_PER_DAY);if(b.day!==day){b.day=day;b.positiveToday=0}
  const shared=c.traits.some((id)=>p.traits.includes(id)),clash=d.conflicts.filter((pair)=>c.traits.includes(pair.a)&&p.traits.includes(pair.b)||c.traits.includes(pair.b)&&p.traits.includes(pair.a)).reduce((n,pair)=>n+pair.delta,0)
  const raw=d.together+(shared?d.sharedTrait:0)+clash,delta=raw>0?Math.min(raw,Math.max(0,d.positivePerDay-b.positiveToday)):raw
  if(delta>0)b.positiveToday+=delta
  if(delta)recordCompanionBond(w,c,clash<0?'conflict':'together',delta,clash<0?'함께 지내며 성향이 부딪쳤다.':'함께 길을 걸으며 조금 익숙해졌다.')
}
/** 상대가 실제 대답한 당시 태도만 보존한다. 비공개 관계 변화를 실시간 표시하지 않는다. */
export function hearCompanionBond(w:World,c:Creature){
  const p=player(w)
  if(!isCompanion(w,c)||!p.alive||!c.alive||p.asleep||c.asleep||p.unconscious||c.unconscious||capacity(w,p,'hearing')<.2||capacity(w,c,'hearing')<.2||capacity(w,p,'consciousness')<.5||capacity(w,c,'consciousness')<.5||cheb(c.pos,p.pos)>1||!hasLos(w,c.pos,p.pos))return
  const b=ensureCompanionBond(w,c);b.heard={turn:turnOf(w),attitude:b.score>=20?'trust':b.score>=0?'neutral':b.score>-20?'uneasy':'leaving'}
}
/** 유효한 고용주의 공격 시도는 계약을 끝낸다. 이후 공통 목격/반격 규칙을 쓴다. */
export function companionBetrayal(w:World,actor:Creature,target:Creature){
  if(actor.id!==w.s.playerId||!isCompanion(w,target))return
  recordCompanionBond(w,target,'betrayal',companionBondDef(w).betrayal,'고용주에게 공격당했다.')
  endCompanionContract(w,target,'betrayed')
  log(w,'danger',`${target.name}과(와)의 고용계약이 공격으로 끝났다.`)
  ;(target.attackedBy??=[]).push(actor.id)
  target.history.push({turn:turnOf(w),kind:'companion',text:'고용주의 공격으로 계약을 끝냈다.'})
}
