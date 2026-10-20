import {hasNewCaptiveSightings,hearCaptiveSightings} from './prisoner-witnesses'
import {rememberAbductionBind} from './npc-abduction'
import {recordContractRescue} from './rescue-contracts'
import {reputationOrigin} from './rumor-subject'
import {publishWitnessedName} from './public-name-news'
import { rememberKinRelease, undergroundKin } from './kinship-state'
import { channelTurns } from './action-time'
import { bodyDef, capacity } from './body'
import { knownCreatureName } from './bestiary-state'
import { isCompanion, effectiveFaction } from './companion-state'
import { recordCompanionBond } from './companion-bonds'
import { stopActivity } from './game'
import { killCreature } from './combat'
import { clamp, log, player, rng, tileAt, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { diplomacyDef, diplomacyTick, ensureSociety, hostile, recordFactionIncident, witnessAttack } from './diplomacy'
import { canSee, hasLos } from './fov'
import { cheb } from './geom'
import { removeOne } from './items'
import { diagonalBlocked } from './path'
import { moraleOf } from './morale'
import { prisonerDef } from './prisoner-state'
import { endEscort, escortOrderError, escortTick, finishEscortOrder, prisonerEscortDef } from './prisoner-escort'
import { rescuedBy, rescueCaptor, rescueDef } from './rescue-state'
import { awardDefeat } from './progression'
import { addThought } from './thoughts'
import { traitAdd, traitOverride } from './traits'
import {sourceDefinitionsAvailable} from './population-sources'
import type { Creature, PrisonerOperation } from './types'
function sourceKnownBy(w:World,target:Creature){return(w.s.sources??[]).find((s)=>sourceDefinitionsAvailable(w,s)&&s.floors.includes(w.s.map.id)&&w.db.creature(s.species).faction===target.faction)}
export function prisonerAccess(w:World,actor:Creature,target:Creature):string|null{
 if(!actor.alive||!target.alive||actor.id===target.id||target.id===w.s.playerId||!w.s.creatures.includes(actor)||!w.s.creatures.includes(target))return '곁의 살아 있는 항복자여야 한다'
 if(bodyDef(w,target).kind!=='humanoid')return '이 사람은 항복 처리 대상이 아니다'
 if(actor.asleep||actor.unconscious||actor.captivity||capacity(w,actor,'consciousness')<.5||capacity(w,actor,'manipulation')<.2)return '깨어서 손을 쓸 수 있어야 한다'
 if(cheb(actor.pos,target.pos)>1||!hasLos(w,actor.pos,target.pos)||!canSee(w,actor,target.pos)||diagonalBlocked(w,actor.pos,target.pos.x-actor.pos.x,target.pos.y-actor.pos.y))return '서로 보이는 바로 곁이어야 한다'
 if(!target.captivity&&target.ai.mode!=='surrender'&&!target.unconscious)return '항복했거나 의식을 잃은 사람이어야 한다'
 return null
}
export function prisonerQuote(w:World,actor:Creature,target:Creature,operation:PrisonerOperation,ropeUid?:number){
 const d=prisonerDef(w),usable=(i:import('./types').ItemInst)=>i.def===d.rope&&i.count>0&&(i.durability??100)>0,rope=ropeUid===undefined?actor.bag.find(usable):actor.bag.find((i)=>i.uid===ropeUid&&usable(i))
 let error=prisonerAccess(w,actor,target)
 if(!['bind','release','interrogate','execute','escort','hold'].includes(operation))error='알 수 없는 항복 처리'
 if(!error&&(operation==='escort'||operation==='hold'))error=escortOrderError(w,actor,target,operation)
 if(!error&&operation==='bind'&&(target.captivity||!target.unconscious&&(target.asleep||target.activity)))error='항복했거나 의식을 잃어 저항할 수 없는 사람이어야 한다'
 if(!error&&isCompanion(w,target)&&operation!=='release'&&!hostile(w,actor,target))error='동료에게 할 수 있는 처분이 아니다'
 if(!error&&operation!=='bind'&&!target.captivity&&target.ai.mode!=='surrender')error='아직 포박되거나 항복한 사람이 아니다'
 if(!error&&operation==='bind'&&!rope)error='배낭에 밧줄1개가 필요하다'
 if(!error&&operation==='interrogate'&&(!target.captivity||target.asleep||target.unconscious||capacity(w,target,'consciousness')<.5||capacity(w,target,'hearing')<.2||capacity(w,actor,'hearing')<.2))error='포박된 상대와 말을 주고받을 수 있어야 한다'
 if(!error&&operation==='interrogate'&&!hasNewCaptiveSightings(w,actor,target)&&(target.prisonerHeardBy?.includes(actor.id)||!target.prisonerRumor&&!sourceKnownBy(w,target)))error=target.prisonerHeardBy?.includes(actor.id)?'이미 이 사람의 소문을 들었다':'상대가 전할 만한 이곳의 소문이 없다'
 const base=operation==='escort'?prisonerEscortDef(w).escortTurns:operation==='hold'?prisonerEscortDef(w).holdTurns:operation==='bind'?d.bindTurns:operation==='release'?d.releaseTurns:operation==='interrogate'?d.interrogateTurns:d.executeTurns,turns=channelTurns(w,actor,base)
 if(!error&&turns===null)error='몸 상태로는 이 일을 할 수 없다'
 return{operation,turns:turns??0,ropeUid:rope?.uid,error}
}
export function startPrisonerAction(w:World,actor:Creature,target:Creature,operation:PrisonerOperation,ropeUid?:number):string|null{
 const q=prisonerQuote(w,actor,target,operation,ropeUid);if(q.error)return q.error
 actor.activity={kind:'prisoner',prisonerOperation:operation,prisonerId:target.id,uid:operation==='bind'?q.ropeUid:operation==='escort'||operation==='hold'?target.captivity?.rope.uid:undefined,remaining:q.turns,total:q.turns,woundCount:actor.body.wounds.length,label:`${knownCreatureName(w,target)} ${operation==='escort'?'호송 준비':operation==='hold'?'발목 포박':operation==='bind'?'포박':operation==='release'?'풀어 주기':operation==='interrogate'?'심문':'처형'}`}
 return null
}
function reputationEvent(w:World,actor:Creature,target:Creature,kind:'release'|'execution',key:string,delta:number){
 if(undergroundKin(w,target))return
 const witnesses=w.s.creatures.filter((c)=>c.id!==actor.id&&(kind==='release'||c.id!==target.id)&&c.alive&&!c.asleep&&!c.unconscious&&c.faction===target.faction&&canSee(w,c,target.pos)).map((c)=>c.id)
 if(!witnesses.length)return
 if(actor.id===w.s.playerId||isCompanion(w,actor)){
  const society=ensureSociety(w),m=w.s.overworld;if(!society||!m)return
  const reason=`${knownCreatureName(w,target)} ${kind==='release'?'석방':'처형'}`
  if(society.events.some((e)=>e.target===target.id&&e.reason===reason))return
  const d=diplomacyDef(w),home=m.sites.filter((s)=>s.faction===target.faction),distance=home.reduce((n,s)=>Math.min(n,Math.abs(s.cell.x-m.position.x)+Math.abs(s.cell.y-m.position.y)),Infinity),local=home.some((s)=>s.id===m.currentRegion),days=local?0:clamp(Number.isFinite(distance)?Math.ceil(distance*d.witnessDaysPerCell):d.witnessMaxDays,d.witnessMinDays,d.witnessMaxDays)
  society.events.push({...reputationOrigin(w,actor),id:society.nextEvent++,target:target.id,faction:target.faction,delta,reason,turn:turnOf(w),arrives:turnOf(w)+days*TURNS_PER_DAY,witnesses,applied:false});publishWitnessedName(w,society.events.at(-1)!);diplomacyTick(w)
 }else recordFactionIncident(w,target.faction,actor.faction,kind,key,witnesses,w.s.overworld?.currentRegion)
}
export function releaseCaptivity(w:World,target:Creature){
 if(target.activity&&['struggle','recruit','recruitWait'].includes(target.activity.kind))stopActivity(w,target)
 endEscort(w,target)
 if(target.leading){const led=w.s.creatures.find((c)=>c.id===target.leading!.target);if(led)endEscort(w,led);target.leading=undefined}
 const rope=target.captivity?.rope
 if(rope){delete rope.gx;delete rope.gy;delete rope.rot;tileAt(w,target.pos).items.push(rope)}
 target.captivity=undefined
}
function release(w:World,actor:Creature,target:Creature,ransomed=false){
 const cap=target.captivity,saved=ransomed||!!rescueCaptor(w,actor,target),surrendered=cap?.surrendered!==false
 releaseCaptivity(w,target)
 const d=prisonerDef(w),rewarded=target.mercy?.rewardedBy??[],owner=isCompanion(w,actor)?player(w):actor,first=!rewarded.includes(owner.id)
 target.mercy={by:owner.id,faction:effectiveFaction(w,owner),until:turnOf(w)+(saved?rescueDef(w).mercyTurns:d.mercyTurns),rewardedBy:first&&(saved||surrendered)?[...rewarded,owner.id]:rewarded}
 if(saved){target.rescue={by:owner.id,captor:cap!.captor,faction:cap!.faction,at:turnOf(w),until:target.mercy.until,rewardedBy:target.rescue?.rewardedBy??[],care:cap!.care,reportDue:first};target.history.push({turn:turnOf(w),kind:'rescue',text:`${actor.name}에게 해방되었다.`})}
 if(first&&!saved&&surrendered)rememberKinRelease(w,owner,target)
 target.ai.mode=isCompanion(w,target)?'guard':'flee';target.ai.path=undefined;target.ai.target=undefined
 target.attackedBy=target.attackedBy?.filter((id)=>id!==owner.id);owner.attackedBy=owner.attackedBy?.filter((id)=>id!==target.id)
 if(first&&!saved&&surrendered){reputationEvent(w,owner,target,'release',`release:${target.id}:${owner.id}`,d.releaseReputation);awardDefeat(w,owner,target,1,'놓아줌');addThought(w,owner,'Thought.AcceptedSurrender',traitAdd(w,owner,'surrenderMood')||undefined)}
 if(cap)recordContractRescue(w,actor,target,cap.rope.uid,saved)
 if(saved)acknowledgeRescue(w,actor,target)
 target.history.push({turn:turnOf(w),kind:'prisoner',text:`${actor.name}에게 풀려났다.`})
 if(actor.id===w.s.playerId)log(w,'good',`${knownCreatureName(w,target)}을(를) ${saved?'구출했다. 몸과 기존 동료 계약은 그대로다.':surrendered?'풀어 주었다. 같은 사람의 석방 보상은 한 번뿐이다.':'풀어 주었다. 의식을 잃은 사람의 해방은 항복 격퇴로 세지 않는다.'}`)
}
export function releaseRansomedPrisoner(w:World,actor:Creature,holder:Creature,target:Creature,ropeUid:number):string|null{
 const act=actor.activity,r=act?.ransom
 if(actor!==player(w)||!w.s.creatures.includes(holder)||!w.s.creatures.includes(target)||act?.kind!=='ransom'||act.remaining>0||r?.payer!==actor.id||r.holder!==holder.id||r.person!==target.id||r.ropeUid!==ropeUid||target.captivity?.captor!==holder.id||target.captivity.rope.uid!==ropeUid||holder.activity?.kind!=='ransomWait'||holder.activity.ransom?.payer!==actor.id)return'실제 합의한 같은 포로의 석방을 확인해야 한다'
 release(w,actor,target,true);return null
}
export function releaseExchangedPrisoners(w:World,actor:Creature,holder:Creature,received:Creature,given:Creature,receivedUid:number,givenUid:number):string|null{
 const act=actor.activity,r=act?.ransom,e=r?.exchange
 if(actor!==player(w)||new Set([actor,holder,received,given]).size!==4||![holder,received,given].every(c=>w.s.creatures.includes(c)&&c.alive)||act?.kind!=='ransom'||act.remaining>0||r?.payer!==actor.id||r.holder!==holder.id||r.person!==received.id||r.ropeUid!==receivedUid||e?.person!==given.id||e.ropeUid!==givenUid||received.captivity?.captor!==holder.id||received.captivity.rope.uid!==receivedUid||given.captivity?.captor!==actor.id||given.captivity.rope.uid!==givenUid||holder.activity?.kind!=='ransomWait'||holder.activity.ransom?.payer!==actor.id||holder.activity.ransom.exchange?.person!==given.id)return'실제 합의한 두 원래 포로와 밧줄을 확인해야 한다'
 release(w,actor,received,true);release(w,holder,given,true);return null
}
export function acknowledgeRescue(w:World,actor:Creature,target:Creature){
 const r=target.rescue
 if(!r||!rescuedBy(w,actor,target)||r.acknowledged||!target.alive||actor.asleep||actor.unconscious||target.asleep||target.unconscious||capacity(w,target,'consciousness')<.5||cheb(actor.pos,target.pos)>1||!hasLos(w,actor.pos,target.pos)||!canSee(w,target,actor.pos))return
 r.acknowledged=true
 if(actor.id===w.s.playerId)target.met=true
 if(r.by===w.s.playerId&&isCompanion(w,target)&&!r.rewardedBy.includes(r.by)){recordCompanionBond(w,target,'rescue',rescueDef(w).bond,'붙잡힌 곳에서 실제로 구해 주었다.');r.rewardedBy.push(r.by)}
 if(r.reportDue){const owner=w.s.creatures.find((c)=>c.id===r.by)??actor;reputationEvent(w,owner,target,'release',`rescue:${target.id}:${r.by}`,prisonerDef(w).releaseReputation);r.reportDue=false}
}
function interrogate(w:World,actor:Creature,target:Creature){
 hearCaptiveSightings(w,actor,target)
 if(target.prisonerHeardBy?.includes(actor.id))return
 let rumor=target.prisonerRumor
 if(!rumor){
  const src=sourceKnownBy(w,target);if(!src)return
  const d=prisonerDef(w),r=rng(w,`body.prisoner.${target.id}`),factor=r.int(Math.round(d.rumorLow*100),Math.round(d.rumorHigh*100))/100,n=Math.max(0,Math.round(src.count*factor*(moraleOf(w,target)<25&&r.chance(d.exaggerationChance)?d.exaggerationMult:1)))
  rumor={id:`prisoner:${target.id}:${src.id}`,kind:'supply',regionId:w.s.overworld?.currentRegion,text:`“${src.label}에 ${n}명쯤 남아 있다.” — 포로가 전한 인원(대략값)`,source:`${knownCreatureName(w,target)}의 말`,hop:1,writtenAt:turnOf(w),foundAt:turnOf(w)}
  target.prisonerRumor=rumor
 }
 ;(target.prisonerHeardBy??=[]).push(actor.id)
 const known=actor.id===w.s.playerId?(w.s.knowledge.rumors??=[]):(actor.knownRumors??=[])
 if(!known.some((r)=>r.id===rumor!.id&&r.regionId===rumor!.regionId))known.push({...rumor,foundAt:turnOf(w)})
 if(actor.id===w.s.playerId)log(w,'info',rumor.text)
}
/** 실제 작업 매 틱에 거리/각성/예약 물품을 다시 확인하고 완료 때만 밧줄을 옮긴다. */
export function prisonerStep(w:World,actor:Creature):boolean{
 const act=actor.activity!,target=w.s.creatures.find((c)=>c.id===act.prisonerId),operation=act.prisonerOperation!
 const error=target?((operation==='escort'||operation==='hold')&&target.captivity?.rope.uid!==act.uid?'호송하려던 밧줄이 달라졌다':prisonerQuote(w,actor,target,operation,act.uid).error):'대상이 이곳에 없다'
 if(error){if(actor.id===w.s.playerId)log(w,'warn',`항복 처리 중단: ${error}.`);actor.activity=undefined;return true}
 if(act.remaining>0)return false
 if(operation==='bind'){
  const hostileBefore=hostile(w,actor,target!),surrendered=target!.ai.mode==='surrender',rope=removeOne(w,actor,act.uid!)!;stopActivity(w,target!);target!.captivity={captor:actor.id,faction:effectiveFaction(w,actor),at:turnOf(w),rope,surrendered};rememberAbductionBind(w,actor,target!,act.uid!,rope.uid);target!.ai.mode='surrender';target!.ai.path=undefined;escortTick(w,target!)
  if(!hostileBefore)witnessAttack(w,actor,target!)
  if(actor.id===w.s.playerId)log(w,'info',`${knownCreatureName(w,target!)}을(를) 밧줄로 포박했다.`)
 }else if(operation==='escort'||operation==='hold')finishEscortOrder(w,actor,target!,operation)
 else if(operation==='release')release(w,actor,target!)
 else if(operation==='interrogate')interrogate(w,actor,target!)
 else{
  const d=prisonerDef(w);target!.lastAttacker=actor.name;reputationEvent(w,actor,target!,'execution',`execution:${target!.id}`,d.executeReputation)
  killCreature(w,target!,'처형',{execution:true,killerId:actor.id});addThought(w,actor,'Thought.Execution',traitOverride(w,actor,'killMood'));actor.history.push({turn:turnOf(w),kind:'execute',text:`항복한 ${knownCreatureName(w,target!)}을(를) 처형`})
 }
 actor.activity=undefined;return true
}
export function visiblePrisoners(w:World){const p=player(w);return w.s.creatures.filter((c)=>c.id!==p.id&&c.alive&&(c.captivity||c.ai.mode==='surrender'||c.unconscious&&!isCompanion(w,c)||!isCompanion(w,c)&&rescuedBy(w,p,c))&&cheb(p.pos,c.pos)<=(c.captivity?.escort&&c.captivity.captor===p.id?prisonerEscortDef(w).leashRadius:1)&&canSee(w,p,c.pos)&&hasLos(w,p.pos,c.pos))}
export function breakMercy(w:World,actor:Creature,target:Creature){if(target.mercy?.faction===effectiveFaction(w,actor))target.mercy.until=turnOf(w);const owner=actor.id===w.s.playerId||isCompanion(w,actor)?w.s.playerId:actor.id;if(target.rescue?.by===owner)target.rescue.until=turnOf(w);if(target.recruitment?.employer===owner){target.recruitment.days=[];target.recruitment.willing=undefined;target.recruitment.hurtAt=turnOf(w)}}
