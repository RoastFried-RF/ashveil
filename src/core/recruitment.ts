import { bodyDef, capacity } from './body'
import { channelTurns } from './action-time'
import { knownCreatureName } from './bestiary-state'
import { companionBondDef } from './companion-bond-state'
import { allCompanions, companionDef, effectiveFaction, isCompanion } from './companion-state'
import { enlistRecruit } from './companions'
import { creatureById, log, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { hostile } from './diplomacy'
import { canSee, hasLos } from './fov'
import { cheb } from './geom'
import { moraleOf } from './morale'
import { diagonalBlocked } from './path'
import { releaseCaptivity } from './prisoners'
import { rescuedBy } from './rescue-state'
import type { Activity, Creature, RecruitmentDef } from './types'
export const recruitmentDef=(w:World,target?:Creature,actor?:Creature)=>w.db.get<RecruitmentDef>(target&&!target.captivity&&actor&&rescuedBy(w,actor,target)?'Recruitment.Rescue':'Recruitment.Hearth')
const dayOf=(w:World)=>Math.floor(turnOf(w)/TURNS_PER_DAY)
function access(w:World,actor:Creature,target:Creature):string|null{
 if(!actor.alive||!target.alive||actor.id===target.id||target.id===w.s.playerId||!w.s.creatures.includes(actor)||!w.s.creatures.includes(target)||actor.id!==w.s.playerId&&!isCompanion(w,actor))return '곁의 상대와 동행을 이야기할 수 없다'
 if(bodyDef(w,target).kind!=='humanoid'||isCompanion(w,target)||(target.captivity?target.captivity.faction!==effectiveFaction(w,actor):!rescuedBy(w,actor,target)))return '같은 편이 돌보는 포로나 실제로 구조한 사람이어야 한다'
 if(!target.captivity&&!target.rescue?.acknowledged)return '깨어 도움을 알아볼 수 있도록 먼저 돌보거나 짧게 이야기해야 한다'
 if(actor.captivity||actor.asleep||actor.unconscious||target.asleep||target.unconscious||capacity(w,actor,'consciousness')<.5||capacity(w,target,'consciousness')<.5||capacity(w,actor,'hearing')<.25||capacity(w,target,'hearing')<.25)return '깨어서 서로 말을 듣고 이해할 수 있어야 한다'
 if(cheb(actor.pos,target.pos)>1||!hasLos(w,actor.pos,target.pos)||!canSee(w,actor,target.pos)||diagonalBlocked(w,actor.pos,target.pos.x-actor.pos.x,target.pos.y-actor.pos.y))return '서로 들을 수 있는 바로 곁이어야 한다'
 if(w.s.creatures.some((c)=>c.id!==target.id&&c.id!==actor.id&&c.alive&&!c.asleep&&!c.unconscious&&!c.captivity&&c.ai.mode!=='surrender'&&hostile(w,actor,c)&&canSee(w,actor,c.pos)))return '다른 적의 위협이 있는 동안에는 이야기할 수 없다'
 if(moraleOf(w,target)<recruitmentDef(w,target,actor).minMorale)return '상대가 너무 불안해 동행을 결정할 수 없다'
 if(target.companion?.bond&&target.companion.bond.score<=companionBondDef(w).leaveAt)return '이 사람은 다시 동행하기를 원하지 않는다'
 return null
}
function careError(w:World,actor:Creature,target:Creature):string|null{
 const d=recruitmentDef(w,target,actor),care=(target.captivity??target.rescue)?.care?.[w.s.playerId]
 return !care||care.day!==dayOf(w)||care.kcal+1e-6<d.careKcal||care.water+1e-6<d.careWater?'오늘 실제 음식과 필요한 식수를 먼저 돌봐야 한다':null
}
function conversationTurns(w:World,actor:Creature,target:Creature){
 const ability=Math.min(capacity(w,actor,'consciousness'),capacity(w,target,'consciousness'),capacity(w,actor,'hearing'),capacity(w,target,'hearing'))
 return Math.ceil(recruitmentDef(w,target,actor).conversationTurns/Math.max(.25,ability))+Math.ceil(Math.max(0,target.nextAct-w.s.time)/100)
}
export function recruitmentQuote(w:World,actor:Creature,target:Creature){
 const d=recruitmentDef(w,target,actor),progress=target.recruitment?.employer===w.s.playerId&&(target.recruitment.profile??'Recruitment.Hearth')===d.id?target.recruitment:undefined,days=progress?.days??[],day=dayOf(w)
 let error=access(w,actor,target)??careError(w,actor,target)
 if(!error&&(actor.activity||target.activity))error='하던 일을 마친 뒤 이야기해야 한다'
 if(!error&&days.includes(day))error='오늘 대화는 마쳤다. 다른 날에 이어 간다'
 return{error,turns:conversationTurns(w,actor,target),days:[...days],target:d.days,day,profile:d.id,careKcal:d.careKcal,careWater:d.careWater}
}
export function inviteRecruitQuote(w:World,actor:Creature,target:Creature,inviting=false){
 let error=access(w,actor,target)??careError(w,actor,target)
 const d=recruitmentDef(w,target,actor),progress=target.recruitment,ownInvite=inviting&&actor.activity?.kind==='recruitInvite'&&actor.activity.prisonerId===target.id,ownWait=ownInvite&&pair(w,actor,actor.activity!)?.id===target.id
 if(!error&&(actor.activity&&!ownInvite||target.activity&&!ownWait))error='하던 일을 먼저 마쳐야 한다'
 if(!error&&(!progress||progress.employer!==w.s.playerId||(progress.profile??'Recruitment.Hearth')!==d.id||progress.days.length<d.days||progress.willing===undefined))error='서로 다른 날의 대화를 마치고 동행에 동의해야 한다'
 if(!error&&allCompanions(w).length>=companionDef(w).maxMembers)error='동행할 자리가 없다'
 if(!error&&capacity(w,{...target,captivity:undefined},'moving')<.2)error='직접 걸을 수 있도록 몸을 먼저 돌봐야 한다'
 const turns=target.captivity?channelTurns(w,actor,d.inviteTurns):Math.ceil(d.inviteTurns/Math.max(.25,Math.min(capacity(w,actor,'consciousness'),capacity(w,target,'consciousness'),capacity(w,actor,'hearing'),capacity(w,target,'hearing'))))
 if(!error&&target.captivity&&(capacity(w,actor,'manipulation')<.2||turns===null))error='상대의 밧줄을 풀 손을 쓸 수 있어야 한다'
 return{error,turns:turns??0,profile:d.id,probationDays:target.companion?.employer===w.s.playerId?0:d.probationDays,wage:companionDef(w).dailyWage}
}
export function requestRecruitment(w:World,actor:Creature,target:Creature):string|null{
 const q=recruitmentQuote(w,actor,target);if(q.error)return q.error
 const shared={recruiterId:actor.id,prisonerId:target.id,recruitAt:w.s.time,recruitDay:q.day,recruitmentProfile:q.profile,uid:target.captivity?.rope.uid,total:q.turns,remaining:q.turns}
 actor.activity={...shared,kind:'recruit',label:`${knownCreatureName(w,target)}과(와) 동행 이야기`,woundCount:actor.body.wounds.length}
 target.activity={...shared,kind:'recruitWait',label:'동행에 관해 이야기',woundCount:target.body.wounds.length}
 return null
}
function pair(w:World,c:Creature,act:Activity){
 const other=creatureById(w,act.kind==='recruitWait'?act.recruiterId:act.prisonerId),a=other?.activity,owner=act.kind==='recruitWait'?a:act,waiting=act.kind==='recruitWait'?act:a
 return other&&a&&owner&&['recruit','recruitInvite'].includes(owner.kind)&&waiting?.kind==='recruitWait'&&a.recruitAt===act.recruitAt&&a.recruiterId===act.recruiterId&&a.prisonerId===act.prisonerId&&a.uid===act.uid&&a.recruitmentProfile===act.recruitmentProfile?other:undefined
}
export function cancelRecruitment(w:World,c:Creature,reason?:string){
 const act=c.activity;if(!act||!['recruit','recruitWait','recruitInvite'].includes(act.kind))return
 const other=pair(w,c,act);if(other)other.activity=undefined;c.activity=undefined
 if(reason&&(c.id===w.s.playerId||other?.id===w.s.playerId))log(w,'warn',`동행 이야기 중단: ${reason}.`)
}
export function recruitmentStep(w:World,c:Creature):boolean{
 const act=c.activity!,other=pair(w,c,act)
 if(!other){c.activity=undefined;return true}
 const actor=act.kind==='recruitWait'?other:c,target=act.kind==='recruitWait'?c:other,error=access(w,actor,target),d=recruitmentDef(w,target,actor)
 if(error||(act.recruitmentProfile??'Recruitment.Hearth')!==d.id||target.captivity?.rope.uid!==act.uid||actor.body.wounds.length>(actor.activity?.woundCount??actor.body.wounds.length)||target.body.wounds.length>(target.activity?.woundCount??target.body.wounds.length)){cancelRecruitment(w,c,error??'돌보던 사람이나 밧줄이 달라졌다');return true}
 if(act.kind==='recruitWait'){act.remaining=Math.max(1,act.remaining);return false}
 if(act.remaining>0)return false
 const old=target.recruitment,days=old?.employer===w.s.playerId&&(old.profile??'Recruitment.Hearth')===d.id?[...old.days]:[]
 if(!days.includes(act.recruitDay!))days.push(act.recruitDay!)
 days.sort((a,b)=>a-b)
 target.recruitment={employer:w.s.playerId,days:days.slice(-d.days),willing:days.length>=d.days?turnOf(w):undefined,hurtAt:old?.hurtAt,profile:d.id};target.met=true
 target.history.push({turn:turnOf(w),kind:'recruit',text:`동행 이야기 ${Math.min(days.length,d.days)}/${d.days}일을 마쳤다.`})
 if(actor.id===w.s.playerId)log(w,'good',`${knownCreatureName(w,target)}과(와) 동행 이야기를 마쳤다 (${Math.min(days.length,d.days)}/${d.days}일).${days.length>=d.days?' 시험 동행에 동의했다. 곁에서 함께 가자고 제안할 수 있다.':' 다른 날에 이어서 이야기할 수 있다.'}`)
 actor.activity=undefined;target.activity=undefined;target.nextAct=Math.max(target.nextAct,w.s.time+100)
 return true
}
export function inviteRecruit(w:World,actor:Creature,target:Creature):string|null{
 const q=inviteRecruitQuote(w,actor,target);if(q.error)return q.error
 const shared={prisonerId:target.id,recruiterId:actor.id,recruitAt:w.s.time,recruitmentProfile:q.profile,uid:target.captivity?.rope.uid,remaining:q.turns,total:q.turns}
 actor.activity={...shared,kind:'recruitInvite',label:target.captivity?'밧줄을 풀고 동행 제안':'동행 제안',woundCount:actor.body.wounds.length}
 target.activity={...shared,kind:'recruitWait',label:'동행 제안 듣기',woundCount:target.body.wounds.length}
 return null
}
export function recruitmentInviteStep(w:World,actor:Creature):boolean{
 const act=actor.activity!,target=creatureById(w,act.prisonerId),q=target&&inviteRecruitQuote(w,actor,target,true)
 const paired=pair(w,actor,act),legacy=!act.recruitmentProfile&&!!target?.captivity&&target.captivity.rope.uid===act.uid&&!target.activity
 if(!target||!q||q.error||actor.body.wounds.length>(act.woundCount??actor.body.wounds.length)||target&&target.body.wounds.length>(target.activity?.woundCount??target.body.wounds.length)||!paired&&!legacy||(act.recruitmentProfile??'Recruitment.Hearth')!==q?.profile||target?.captivity?.rope.uid!==act.uid){cancelRecruitment(w,actor,q?.error??'돌보던 사람이나 밧줄이 달라졌다');return true}
 if(act.remaining>0)return false
 if(target.captivity)releaseCaptivity(w,target);else cancelRecruitment(w,actor)
 enlistRecruit(w,target,q.probationDays)
 if(actor.id===w.s.playerId)log(w,'good',target.companion!.status==='unpaid'?`${target.name}이(가) 동행에 다시 동의했다. 이전 기간이 끝나 하루 급료${q.wage}표를 기다린다.`:q.probationDays>0?`${target.name}이(가) 시험 동행을 시작했다. ${q.probationDays}일 뒤부터 하루 급료${q.wage}표를 직접 건네야 한다.`:`${target.name}과(와) 이전에 약속한 남은 기간 동안 다시 동행한다.`)
 actor.activity=undefined;return true
}
