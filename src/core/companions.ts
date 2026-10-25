import {companionAidDecision} from './companion-aid'
import {pauseCompanionCarePlan} from './companion-care-plan-state'
import {companionCareScheduleDecision,companionCareScheduleTick} from './companion-care-schedule'
import {companionRecoveryDecision} from './companion-recovery'
import {readyFood} from './open-food-state'
import {rememberMeeting} from './first-impressions'
import {firstImpressionScore} from './first-impression-state'
import { suitableDrink } from './water-state'
import { baseRestDecision, releaseBaseBeds } from './base-rest'
import { baseWaterSafe } from './base-water'
import { baseWorkerSupply } from './base-logistics'
import { clearBaseTask } from './base-camp-state'
import { baseWorkDecision } from './base-camp'
import { companionBondDef, ensureCompanionBond } from './companion-bond-state'
import { prisonerDef } from './prisoner-state'
import { escortControlError, prisonerEscortDef, travellingParty } from './prisoner-escort'
import { hearCompanionBond, recordCompanionBond } from './companion-bonds'
import type { Action } from './actions'
import { capacity, totalBleed } from './body'
import { allCompanions, companionDef, followingParty, isCompanion } from './companion-state'
import { creatureAt, inBounds, log, player, terrainAt, turnOf, TURNS_PER_DAY, TU_PER_TURN, type World } from './ctx'
import { hostile, reputation } from './diplomacy'
import { canSee, hasLos } from './fov'
import { cheb, DIRS, eq, type Pos } from './geom'
import { worldGenDef } from './overworld'
import { addToBag, gridAdd, itemDef } from './items'
import { diagonalBlocked } from './path'
import type { CompanionOrder, Creature, MapState } from './types'
export function companionAccess(w:World,c:Creature,allowActivity?:'drawMap'|'drawWorldMap'|'search'|'clinical'):string|null{
  const p=player(w)
  if(!p.alive||!c.alive||p.id===c.id||!w.s.creatures.includes(c))return '곁에 있는 살아 있는 사람이어야 한다'
  if(p.captivity||c.captivity)return '먼저 결박을 풀어야 한다'
  if(p.asleep||c.asleep||p.unconscious||c.unconscious||p.activity||c.activity&&c.activity.kind!==allowActivity&&!(allowActivity==='clinical'&&c.activity.companionClinical))return '깨어 있고 다른 일을 하지 않아야 한다'
  if(capacity(w,p,'consciousness')<.5||capacity(w,c,'consciousness')<.5||capacity(w,p,'hearing')<.2||capacity(w,c,'hearing')<.2)return '대화를 주고받기 어렵다'
  if(cheb(p.pos,c.pos)>1||!hasLos(w,p.pos,c.pos)||diagonalBlocked(w,p.pos,c.pos.x-p.pos.x,c.pos.y-p.pos.y)||!canSee(w,p,c.pos))return '서로 보이는 바로 곁에서 이야기해야 한다'
  if(hostile(w,p,c))return '적대하는 사람과 계약할 수 없다'
  return null
}
export function hireQuote(w:World,c:Creature){
  const d=companionDef(w),p=player(w),site=w.s.overworld?.sites.find((s)=>s.id===w.s.overworld?.currentRegion)
  let error=c.caravan||c.roadRaid?'원래 교역 임무를 마치고 돌아와야 한다':companionAccess(w,c)
  if(!error&&(isCompanion(w,c)||w.db.creature(c.def).ai!=='guard'||!c.residentSite||c.residentSite!==site?.id||site.kind!=='settlement'||c.faction!==site.faction||c.traderSite||c.clinicSite))error='이곳에서 고용할 경비가 아니다'
  if(!error&&c.companion?.bond&&c.companion.bond.score<=companionBondDef(w).leaveAt)error='이 사람은 다시 동행하기를 원하지 않는다'
  if(!error&&!c.companion?.bond&&companionBondDef(w).initial+firstImpressionScore(w,p,c)<=companionBondDef(w).leaveAt)error='이 사람은 동행을 시작하고 싶어 하지 않는다'
  if(!error&&reputation(w,c.faction)<d.minReputation)error='이 세력의 신뢰가 부족하다'
  if(!error&&allCompanions(w).length>=d.maxMembers)error='더 많은 동료를 고용할 수 없다'
  if(!error&&w.s.creatures.some((o)=>o.alive&&hostile(w,c,o)&&canSee(w,c,o.pos)))error='위협이 있는 동안 새 계약을 맺을 수 없다'
  if(!error&&(!Number.isSafeInteger(p.money??0)||(p.money??0)<d.hireFee))error='고용료가 부족하다'
  if(!error&&(!Number.isSafeInteger(c.money??0)||(c.money??0)+d.hireFee>Number.MAX_SAFE_INTEGER))error='고용료를 받을 수 없다'
  return{fee:d.hireFee,wage:d.dailyWage,error}
}
export function hireCompanion(w:World,c:Creature):string|null{
  const q=hireQuote(w,c);if(q.error)return q.error
  const p=player(w),now=turnOf(w);p.money=(p.money??0)-q.fee;c.money=(c.money??0)+q.fee
  rememberMeeting(w,p,c)
  c.companion={bond:c.companion?.bond,employer:p.id,originSite:c.residentSite!,originMap:w.s.map.id,originHome:c.home&&{...c.home},status:'employed',order:'follow',hiredAt:now,paidUntil:now+TURNS_PER_DAY,lastLeader:{...p.pos},anchor:{...c.pos}}
  ensureCompanionBond(w,c,firstImpressionScore(w,p,c));hearCompanionBond(w,c)
  c.home=undefined;c.ai.path=undefined;c.ai.target=undefined;c.ai.mode='guard'
  c.history.push({turn:now,kind:'companion',text:'하루 선불 고용으로 동행을 시작했다.'})
  log(w,'good',`${c.name}을(를) 고용했다. 첫 하루 포함 ${q.fee}표를 건넸다.`);return null
}
/** 실제 동의 뒤 같은 인물을 동행자로 기록한다. 지급되지 않은 돈/장비를 생성하지 않는다. */
export function enlistRecruit(w:World,c:Creature,probationDays:number){
 const p=player(w),now=turnOf(w),old=c.companion,returning=old?.employer===p.id,paidUntil=returning?old.paidUntil:now+probationDays*TURNS_PER_DAY
 c.companion={aid:old?.aid,bond:old?.bond,employer:p.id,originSite:old?.originSite??c.residentSite,originMap:old?.originMap??w.s.map.id,originHome:old?.originHome??(c.home&&{...c.home}),status:paidUntil>now?'employed':'unpaid',order:paidUntil>now?'follow':'hold',hiredAt:returning?old.hiredAt:now,trialUntil:returning?old.trialUntil:paidUntil,paidUntil,lastLeader:{...p.pos},anchor:{...c.pos}}
 ensureCompanionBond(w,c,firstImpressionScore(w,p,c));hearCompanionBond(w,c)
 c.home=undefined;c.ai.path=undefined;c.ai.target=undefined;c.ai.mode='guard';c.met=true
 c.attackedBy=c.attackedBy?.filter((id)=>id!==p.id);p.attackedBy=p.attackedBy?.filter((id)=>id!==c.id)
 c.history.push({turn:now,kind:'companion',text:returning?'다시 동행하기로 동의했다. 이전 약속 기한과 급료를 이어 간다.':'돌봄과 실제 대화 뒤 시험 동행에 동의했다.'})
}
export function commandCompanion(w:World,c:Creature,order:CompanionOrder):string|null{
  if(!['follow','hold','defend'].includes(order))return '알 수 없는 동료 지시'
  const error=companionAccess(w,c);if(error)return error
  if(!isCompanion(w,c))return '고용한 동료가 아니다'
  if(c.companion!.status!=='employed'&&order!=='hold')return '급료를 먼저 건네야 한다'
  clearBaseTask(w,c)
  c.companionRecovery=undefined
  if(c.companion!.carePlan?.status==='waiting')pauseCompanionCarePlan(w,c,'동행·대기·방어 지시를 새로 받았다')
  c.companion!.order=order;c.companion!.anchor={...c.pos};c.companion!.lastLeader={...player(w).pos};c.ai.path=undefined;c.ai.target=undefined
  log(w,'info',`${c.name}: ${order==='follow'?'곁에서 동행한다':order==='hold'?'이 자리에서 대기한다':'이 주변을 지킨다'}.`);return null
}
export function payCompanion(w:World,c:Creature):string|null{
  const error=companionAccess(w,c);if(error)return error
  if(!isCompanion(w,c))return '고용한 동료가 아니다'
  const p=player(w),fee=companionDef(w).dailyWage
  if(!Number.isSafeInteger(p.money??0)||(p.money??0)<fee)return '급료가 부족하다'
  if(!Number.isSafeInteger(c.money??0)||(c.money??0)+fee>Number.MAX_SAFE_INTEGER)return '급료를 받을 수 없다'
  if(c.companion!.paidUntil>turnOf(w)+TURNS_PER_DAY)return '이미 이틀 넘게 선불을 받았다'
  p.money=(p.money??0)-fee;c.money=(c.money??0)+fee;c.companion!.paidUntil=Math.max(turnOf(w),c.companion!.paidUntil)+TURNS_PER_DAY;c.companion!.status='employed'
  recordCompanionBond(w,c,'wage',companionBondDef(w).wage,'약속한 급료를 직접 받았다.');hearCompanionBond(w,c)
  log(w,'info',`${c.name}에게 하루 급료 ${fee}표를 건넸다. 지시는 다시 정할 수 있다.`);return null
}
export function giveCompanion(w:World,c:Creature,uid:number):string|null{
  const error=companionAccess(w,c);if(error)return error
  if(!isCompanion(w,c))return '고용한 동료가 아니다'
  const p=player(w),item=p.bag.find((i)=>i.uid===uid)
  if(!item)return '건넬 물품이 배낭에 없다'
  const probe:World={db:w.db,s:{...w.s,nextId:w.s.nextId}},grid={items:structuredClone(c.bag),w:10,h:6}
  if(gridAdd(probe,grid,structuredClone(item)))return '동료 배낭에 자리가 없다'
  p.bag=p.bag.filter((i)=>i.uid!==uid);delete item.gx;delete item.gy;delete item.rot;addToBag(w,c,item)
  log(w,'info',`${c.name}에게 ${itemDef(w,item).label}을(를) 건넸다.`);return null
}
export function dismissCompanion(w:World,c:Creature):string|null{
  const error=companionAccess(w,c);if(error)return error
  if(!isCompanion(w,c))return '고용한 동료가 아니다'
  endCompanionContract(w,c,'dismissed');log(w,'info',`${c.name}과(와) 이곳에서 헤어졌다. 이미 건넨 돈은 돌려받지 않는다.`);return null
}
export function endCompanionContract(w:World,c:Creature,status:'dismissed'|'employerDead'|'betrayed'|'left'){
  pauseCompanionCarePlan(w,c,'동행 계약이 끝났다')
  releaseBaseBeds(w,c.id)
  clearBaseTask(w,c)
  c.companionRecovery=undefined
  const old=c.companion!;old.status=status;old.order='hold';c.ai.path=undefined;c.ai.target=undefined;c.ai.mode='guard'
  c.home=w.s.creatures.includes(c)&&c.mapId===old.originMap&&(!w.s.overworld||old.originSite!==undefined)&&old.originSite===w.s.overworld?.currentRegion&&old.originMap===w.s.map.id&&old.originHome&&inBounds(w,old.originHome)?{...old.originHome}:{...c.pos}
  if(status!=='betrayed'&&c.recruitment?.employer===w.s.playerId&&c.recruitment.willing!==undefined)c.mercy={by:w.s.playerId,faction:player(w).faction,until:turnOf(w)+prisonerDef(w).mercyTurns,rewardedBy:c.mercy?.rewardedBy??[]}
}
export function companionTick(w:World,c:Creature){
  companionCareScheduleTick(w,c)
  if(c.companion?.carePlan?.status==='running'&&(!c.alive||c.activity?.companionCarePlan!==c.companion.carePlan.uid))pauseCompanionCarePlan(w,c,'시술자 또는 원래 처치 활동이 달라졌다')
  if(!c.alive||!isCompanion(w,c))return
  if(!player(w).alive){endCompanionContract(w,c,'employerDead');return}
  if(c.companion!.status==='employed'&&turnOf(w)>=c.companion!.paidUntil){c.companion!.status='unpaid';c.companion!.order='hold';c.companion!.anchor={...c.pos};c.ai.path=undefined;c.history.push({turn:turnOf(w),kind:'companion',text:'선불 기간이 끝나 급료를 기다린다.'});recordCompanionBond(w,c,'arrears',companionBondDef(w).arrears,'선불 기간이 끝났는데 급료를 받지 못했다.');if(isCompanion(w,c)&&w.s.creatures.includes(c)&&canSee(w,player(w),c.pos))log(w,'warn',`${c.name}의 선불 기간이 끝났다. 곁에서 급료를 건네야 동행한다.`)}
}
export function employerDied(w:World){for(const c of allCompanions(w))endCompanionContract(w,c,'employerDead')}
export function companionDecision(w:World,c:Creature,threats:Creature[]):{action?:Action;goal?:Pos}|null{
  if(!isCompanion(w,c))return null
  companionTick(w,c)
  const d=companionDef(w),contract=c.companion!,p=player(w),seen=canSee(w,c,p.pos)
  if(seen)contract.lastLeader={...p.pos}
  const anchor=contract.order==='follow'?contract.lastLeader:contract.anchor
  if(threats.some((t)=>cheb(t.pos,c.pos)<=1||contract.status==='employed'&&contract.order!=='hold'&&cheb(t.pos,anchor)<=d.defendRadius))return null
  if(c.needs.kcal<d.eatBelow){const food=c.bag.find((i)=>readyFood(w,c,i)&&!itemDef(w,i).food!.raw);if(food)return{action:{type:'consume',uid:food.uid}}}
  if(c.needs.waterDeficit>=d.drinkAbove){const drink=c.bag.find((i)=>itemDef(w,i).drink&&!itemDef(w,i).drink!.alcohol&&!i.waterFrozen&&(i.uses??1)>0&&suitableDrink(w,i)&&(w.s.map.baseCamp?.tasks[c.id]?.kind!=='water'||baseWaterSafe(w,i)));if(drink)return{action:{type:'consume',uid:drink.uid}}}
  const supply=baseWorkerSupply(w,c);if(supply)return supply
  const rest=baseRestDecision(w,c,threats);if(rest)return rest
  if(c.needs.fatigue>=d.sleepAt&&c.needs.bodyTemp>=35&&(c.drowsyUntil??0)<=turnOf(w))return{action:{type:'sleep'}}
  const scheduledCare=companionCareScheduleDecision(w,c);if(scheduledCare)return scheduledCare
  const aid=companionAidDecision(w,c);if(aid)return aid
  const recovery=companionRecoveryDecision(w,c);if(recovery)return recovery
  const work=baseWorkDecision(w,c,threats);if(work)return work
  const base=w.s.map.baseCamp
  if(base?.tasks[c.id]&&contract.order==='defend'&&eq(anchor,base.store)&&cheb(c.pos,anchor)<=1&&hasLos(w,c.pos,anchor)&&!diagonalBlocked(w,c.pos,anchor.x-c.pos.x,anchor.y-c.pos.y))return{action:{type:'wait'}}
  if(contract.status!=='employed'||contract.order!=='follow')return !eq(c.pos,anchor)?{goal:anchor}:{action:{type:'wait'}}
  if(cheb(c.pos,anchor)<=d.followDistance)return{action:{type:'wait'}}
  const goal=DIRS.map((dir)=>({x:anchor.x+dir.x,y:anchor.y+dir.y})).filter((pos)=>inBounds(w,pos)&&terrainAt(w,pos).passable&&!creatureAt(w,pos)).sort((a,b)=>cheb(a,c.pos)-cheb(b,c.pos))[0]
  return goal?{goal}:{action:{type:'wait'}}
}
export function partyMemberTravelError(w:World,c:Creature):string|null{
  if(c.captivity){const error=escortControlError(w,c);if(error)return error}
  else if(!c.alive||!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.order!=='follow')return '동행 계약/지시를 다시 확인해야 한다'
  if(c.asleep||c.unconscious||c.activity||capacity(w,c,'consciousness')<.5||capacity(w,c,'moving')<.2)return '깨어서 직접 걸을 수 있어야 한다'
  if(totalBleed(w,c)>worldGenDef(w).travelBleedMax)return '동료의 출혈을 먼저 멎게 해야 한다'
  return null
}
export function partyTransitionError(w:World,toId?:string,arrivalExtra:Creature[]=[]):string|null{
  const p=player(w),d=companionDef(w),all=allCompanions(w).filter((c)=>!c.captivity&&c.companion!.status==='employed'&&c.companion!.order==='follow')
  for(const c of all){const error=partyMemberTravelError(w,c);if(error)return `${c.name}: ${error}`;if(!w.s.creatures.includes(c)||cheb(c.pos,p.pos)>d.joinRadius||!hasLos(w,c.pos,p.pos))return `${c.name}이(가) 출입구 곁으로 올 때까지 기다리거나 곁에서 대기를 지시해야 한다`}
  const party=travellingParty(w)
  for(const c of [p,...all])if(c.leading&&!party.some((o)=>o.id===c.leading!.target&&o.captivity?.escort))return `${c.name}의 호송 상대가 곁에 없다`
  for(const c of party.filter((o)=>o.captivity)){const error=partyMemberTravelError(w,c);if(error)return `${c.name}: ${error}`;if(cheb(c.pos,p.pos)>d.joinRadius||!hasLos(w,c.pos,p.pos))return `${c.name}이(가) 출입구 곁에 와야 한다`}
  const map=toId&&w.s.maps[toId]
  if(party.length&&map){const anchor=map.links.find((l)=>l.to===w.s.map.id)?.pos??{x:1,y:1};if(!partyArrivalPositions(w,map,w.s.offCreatures[map.id]??[],anchor,[...party,...arrivalExtra]))return '계단 건너편에 동료와 포로들이 설 자리가 없다'}
  return null
}
export function regionPartyTransitionError(w:World,kind:'road'|'site'):string|null{
  const error=partyTransitionError(w);if(error)return error
  const m=w.s.overworld,party=travellingParty(w);if(!m||!party.length)return null
  const key=kind==='road'?`@${m.position.x},${m.position.y}`:m.sites.find((s)=>eq(s.cell,m.position))?.id,scene=key&&m.scenes[key]
  if(!scene)return null
  const anchor=kind==='road'?{x:8,y:6}:scene.map.exits[0]??{x:32,y:46}
  return partyArrivalPositions(w,scene.map,scene.creatures,anchor,party)?null:'도착 길목에 동료와 포로들이 설 자리가 없다'
}
export function placePartyLeader(w:World,party:Creature[],anchor:Pos){
  if(!party.length){player(w).pos={...anchor};return}
  const positions=arrivalPositions(w,w.s.map,w.s.creatures.filter((c)=>c.id!==w.s.playerId),anchor,party.length+1)
  if(!positions)throw new Error('동료 출입 공간 사전 검사가 누락됐다')
  player(w).pos=positions[0]
}
/** 도착 지점의 실제 빈 칸만 고른다. 플레이어/기존 인물과 겹치지 않는다. */
function arrivalCandidates(w:World,map:MapState,creatures:Creature[],anchor:Pos):Pos[]{
  const probe:World={db:w.db,s:{...w.s,map,creatures}},chosen:Pos[]=[],radius=companionDef(w).arrivalRadius
  for(let r=0;r<=radius;r++)for(let y=anchor.y-r;y<=anchor.y+r;y++)for(let x=anchor.x-r;x<=anchor.x+r;x++){const pos={x,y};if(cheb(pos,anchor)!==r||!inBounds(probe,pos)||!terrainAt(probe,pos).passable||creatureAt(probe,pos)||!hasLos(probe,anchor,pos))continue;chosen.push(pos)}
  return chosen
}
export function arrivalPositions(w:World,map:MapState,creatures:Creature[],anchor:Pos,count:number):Pos[]|null{
 const positions=arrivalCandidates(w,map,creatures,anchor);return positions.length>=count?positions.slice(0,count):null
}
/** 실제 빈 바닥을 탐색하며 포로와 호송자 사이의 밧줄 거리도 지킨다. */
export function partyArrivalPositions(w:World,map:MapState,creatures:Creature[],anchor:Pos,party:Creature[]):Pos[]|null{
 const candidates=arrivalCandidates(w,map,creatures,anchor)
 if(candidates.length<party.length+1)return null
 if(!party.some((c)=>c.captivity))return candidates.slice(0,party.length+1)
 const probe:World={db:w.db,s:{...w.s,map,creatures}},positions:Pos[]=[candidates[0]],used=new Set([0]),members=[player(w),...party];let budget=20000
 const search=(index:number):boolean=>{
  if(index===members.length)return true
  const c=members[index],captor=c.captivity?members.findIndex((o)=>o.id===c.captivity!.captor):-1
  if(c.captivity&&(captor<0||captor>=index))return false
  for(let i=1;i<candidates.length;i++){
   if(--budget<0)return false
   const pos=candidates[i];if(used.has(i)||captor>=0&&(cheb(pos,positions[captor])>prisonerEscortDef(w).leashRadius||!hasLos(probe,pos,positions[captor])))continue
   positions[index]=pos;used.add(i);if(search(index+1))return true;used.delete(i)
  }
  return false
 }
 return search(1)?positions:null
}
export function placeParty(w:World,party:Creature[],anchor?:Pos){
  if(!party.length){if(anchor)player(w).pos={...anchor};return}
  const positions=partyArrivalPositions(w,w.s.map,w.s.creatures.filter((c)=>c.id!==w.s.playerId),anchor??player(w).pos,party)
  if(!positions)throw new Error('동료 도착 공간이 없다')
  player(w).pos=positions[0]
  for(const[c,i]of party.map((c,i)=>[c,i]as const)){c.pos=positions[i+1];c.mapId=w.s.map.id;c.home=undefined;c.room=undefined;c.ai.path=undefined;c.nextAct=w.s.time+TU_PER_TURN;if(c.companion)c.companion.lastLeader={...player(w).pos};w.s.creatures.push(c)}
  for(const c of party)if(c.captivity?.escort)c.captivity.lastCaptor={...w.s.creatures.find((a)=>a.id===c.captivity!.captor)!.pos}
}
export { followingParty }
