// Opt-in mutual aid. Every treatment and evacuation uses the original body, supplies and turns.
import type {Action} from './actions'
import {channelTurns,hostileAware} from './action-time'
import {capacity,effectiveBleed,isMissing,totalBleed} from './body'
import {companionDef,isCompanion} from './companion-state'
import {companionAccess} from './companions'
import {creatureAt,creatureById,inBounds,log,player,terrainAt,tileAt,turnOf,type World} from './ctx'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb,DIRS,eq,type Pos} from './geom'
import {itemDef,supplyItems} from './items'
import {diagonalBlocked,findPath} from './path'
import {knownFireDanger} from './fire-avoidance'
import {masteryStage} from './skills'
import {releasePatient,startTreatment,treatmentAccess} from './treatment'
import {emitNoise} from './perception'
import {stopActivity} from './game'
import {pauseCompanionCarePlan} from './companion-care-plan-state'
import {approachBaseStore,baseStoreError,transferBase} from './base-camp'
import type {Activity,CompanionAidMode,Creature,ItemInst,Wound} from './types'
export const companionAidRule=(w:World)=>companionDef(w).aid
const member=(w:World,c:Creature)=>c.id===w.s.playerId||isCompanion(w,c)
export function setCompanionAid(w:World,c:Creature,mode:CompanionAidMode):string|null{
 if(!['off','firstAid','rescue'].includes(mode))return '알 수 없는 상호 구조 지침이다'
 const error=companionAccess(w,c);if(error)return error
 if(!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w))return '급료 기간이 남은 동료에게 지시해야 한다'
 if(!companionAidRule(w))return '현재 구성에는 상호 구조 규칙이 없다'
 c.companion!.aid={mode,suppliesFromBase:c.companion!.aid?.suppliesFromBase,anchor:{pos:{...player(w).pos},map:w.s.map.id,region:w.s.overworld?.currentRegion}}
 c.ai.path=undefined
 log(w,'info',`${c.name}: ${mode==='off'?'자동 응급 처치와 구조를 멈춘다':mode==='firstAid'?'안전할 때 자기 물품으로 동료의 출혈·상처·골절을 돌본다':'안전할 때 응급 처치하고 쓰러진 동료를 지금 정한 집결지로 옮긴다'}.`)
 return null
}
function providerError(w:World,c:Creature,ignoreActivity=false):string|null{
 const d=companionAidRule(w)
 if(!d||!w.s.creatures.includes(c)||!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w)||!c.companion!.aid||!['firstAid','rescue'].includes(c.companion!.aid.mode))return '상호 구조를 맡긴 현지 유급 동료가 필요하다'
 if(!c.alive||c.asleep||c.unconscious||c.captivity||c.breakdown||c.body.machine||w.db.body(c.body.def).kind!=='humanoid'||c.activity&&!ignoreActivity||c.leading||c.companionRecovery||c.recoveryCargo||c.mapId!==undefined&&c.mapId!==w.s.map.id||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2||capacity(w,c,'moving')<.2)return '다른 긴급 임무 없이 깨어서 손과 발을 쓸 수 있어야 한다'
 if(hostileAware(w,c)||capacity(w,c,'sight')<.2)return '위협을 벗어나 환자를 볼 수 있어야 한다'
 const n=c.needs,needs=companionDef(w)
 if(n.kcal<needs.eatBelow||n.waterDeficit>=needs.drinkAbove||n.fatigue>=needs.sleepAt||n.bodyTemp<d.minBodyTemp||n.bodyTemp>d.maxBodyTemp)return '먼저 시술자의 식사·식수·휴식·체온을 돌봐야 한다'
 return null
}
const interruptibleForAid=(p:Creature)=>!!p.activity&&(['rest','sleep'].includes(p.activity.kind)||p.unconscious&&['craft','gather','read','search'].includes(p.activity.kind))
function patientError(w:World,c:Creature,p:Creature,during=false):string|null{
 if(!member(w,p)||!w.s.creatures.includes(p)||!p.alive||p.captivity||p.body.machine||w.db.body(p.body.def).kind!=='humanoid'||p.mapId!==undefined&&p.mapId!==w.s.map.id)return '같은 현장의 살아 있는 동행자만 돌볼 수 있다'
 if(p!==c&&(p.activity&&!interruptibleForAid(p)&&!(during&&p.activity.kind==='careWait'&&p.activity.healerId===c.id)||p.breakdown||hostileAware(w,p)||totalBleed(w,c)>0))return '환자와 시술자가 안전하고 다른 일을 하지 않아야 한다'
 if(!canSee(w,c,p.pos)||lightLevel(w,c.pos)>=2||lightLevel(w,p.pos)>=2||cheb(c.pos,p.pos)>companionAidRule(w)!.range)return '관찰할 수 있는 범위와 처치할 빛이 필요하다'
 return null
}
function needed(w:World,p:Creature,wd:Wound):string[]{
 if(wd.internal||wd.healed>=wd.severity||isMissing(w,p,wd.part))return []
 const out:string[]=[],d=companionAidRule(w)!
 if(wd.arterial&&(wd.artery??0)>0&&effectiveBleed(w,p,wd)>=d.minBleed)out.push('tourniquet')
 if(effectiveBleed(w,p,wd)>=d.minBleed&&(!wd.bandage||wd.bandage.dirty))out.push('bandage')
 if(wd.contam>=d.washContam&&(wd.washedAt===undefined||turnOf(w)-wd.washedAt>=d.washAfterTurns))out.push('disinfect')
 if(wd.fracture&&(!wd.splint||wd.splint.half))out.push('splint')
 return out
}
/** Read-only planning; the real treatment engine chooses time, hand and bound materials. */
export function companionAidQuote(w:World,c:Creature,p:Creature){
 const out={error:null as string|null,activity:undefined as Activity|undefined}
 out.error=providerError(w,c)??patientError(w,c,p);if(out.error)return out
 if(cheb(c.pos,p.pos)>1||treatmentAccess(w,c,p)){out.error='실제 환자 곁으로 가야 한다';return out}
 if(masteryStage(w,c,'medicine')<companionAidRule(w)!.minMedicine){out.error='응급 처치를 맡길 의료 숙달이 부족하다';return out}
 const wounds=p.body.wounds.slice().sort((a,b)=>effectiveBleed(w,p,b)-effectiveBleed(w,p,a)||a.id-b.id)
 const supplies=supplyItems(c).filter(i=>i.count>0&&!i.half&&!i.missingItem&&!i.dirty&&(i.uses??1)>0&&(i.durability??100)>0&&itemDef(w,i).medical&&!itemDef(w,i).medical!.dirty).sort((a,b)=>(itemDef(w,b).medical?.tool??0)-(itemDef(w,a).medical?.tool??0)||a.uid-b.uid)
 for(const kind of ['tourniquet','bandage','disinfect','splint'])for(const wd of wounds)if(needed(w,p,wd).includes(kind))for(const item of supplies.filter(i=>itemDef(w,i).medical!.kind===kind)){
  const actor:Creature={...c,activity:undefined},shadow:World={db:w.db,s:{...w.s,log:[...w.s.log]}}
  const result=startTreatment(shadow,actor,item.uid,wd.id,undefined,undefined,p)
  if(result.ok&&actor.activity){out.activity=actor.activity;return out}
 }
 out.error='처치할 상처와 사용할 수 있는 실제 의료 물품이 필요하다';return out
}
export function startCompanionAid(w:World,c:Creature,p:Creature):string|null{
 const q=companionAidQuote(w,c,p);if(q.error)return q.error
 pauseCompanionCarePlan(w,c,'허락한 자동 응급 처치를 먼저 시작했다')
 if(p!==c&&interruptibleForAid(p))stopActivity(w,p)
 c.activity=q.activity!;c.activity.companionAid=true;c.activity.woundCount=c.body.wounds.length
 if(p!==c){const turns=c.activity.total!+Math.ceil(Math.max(0,c.nextAct-w.s.time)/100);p.activity={kind:'careWait',healerId:c.id,remaining:turns,total:turns,label:`${c.name}의 상호 응급 처치`}}
 c.ai.path=undefined
 if(canSee(w,player(w),c.pos))log(w,'info',`${c.name}이(가) ${p===c?'자기':p.name+'의'} 상처에 ${c.activity.label}을(를) 시작했다.`)
 return null
}
function safeCell(w:World,c:Creature,pos:Pos){return inBounds(w,pos)&&terrainAt(w,pos).passable&&!terrainAt(w,pos).water&&!knownFireDanger(w,c).has(pos.y*w.s.map.w+pos.x)}
function evacuation(w:World,c:Creature,p:Creature):Pos[]|null{
 const a=c.companion?.aid?.anchor
 if(c.companion?.aid?.mode!=='rescue'||!a||a.map!==w.s.map.id||a.region!==w.s.overworld?.currentRegion||!p.unconscious||p.asleep||p===c||totalBleed(w,p)>companionAidRule(w)!.dragBleedMax||cheb(p.pos,a.pos)>companionAidRule(w)!.rallyRadius)return null
 if(eq(p.pos,a.pos))return null
 const probe:World={db:w.db,s:{...w.s,creatures:w.s.creatures.filter(o=>o.id!==c.id)}},goals=[a.pos,...DIRS.map(v=>({x:a.pos.x+v.x,y:a.pos.y+v.y}))].filter(pos=>safeCell(w,c,pos)&&(!creatureAt(w,pos)||creatureAt(w,pos)!.id===c.id))
 if(goals.some(g=>eq(g,p.pos)))return null
 const avoidCells=knownFireDanger(w,c)
 for(const goal of goals){const path=findPath(probe,p.pos,goal,{selfId:p.id,avoidCreatures:true,avoidCells,avoidWater:true,preferStraight:true,maxNodes:1800});if(path?.length&&path.every(pos=>safeCell(w,c,pos)))return path}
 return null
}
export function companionDragQuote(w:World,c:Creature,p:Creature,to:Pos,during=false){
 let error=providerError(w,c,during)??patientError(w,c,p,during)
 const path=!error&&evacuation(w,c,p)
 if(!error&&(!path||!eq(path[0],c.pos)||!safeCell(w,c,to)||creatureAt(w,to)||cheb(c.pos,to)!==1||!hasLos(w,c.pos,to)||diagonalBlocked(w,c.pos,to.x-c.pos.x,to.y-c.pos.y)||treatmentAccess(w,c,p)||!canSee(w,c,to)))error='안전 집결지로 향하는 환자 바로 앞의 빈 칸에서 옮겨야 한다'
 const turns=channelTurns(w,c,companionAidRule(w)?.dragTurns??1,{dexterous:false})
 if(!error&&(turns===null||c.needs.energy<companionAidRule(w)!.dragEnergy))error='환자를 옮길 손과 기력이 필요하다'
 return{error,turns:turns??0}
}
export function startCompanionDrag(w:World,c:Creature,p:Creature,to:Pos):string|null{
 const q=companionDragQuote(w,c,p,to);if(q.error)return q.error
 pauseCompanionCarePlan(w,c,'허락한 쓰러진 동료 구조를 먼저 시작했다')
 if(interruptibleForAid(p))stopActivity(w,p)
 c.activity={kind:'rescueDrag',patientId:p.id,target:{...to},aidOrigin:{actor:{...c.pos},patient:{...p.pos}},remaining:q.turns,total:q.turns,woundCount:c.body.wounds.length,label:'쓰러진 동료를 한 칸 옮기기'}
 p.activity={kind:'careWait',healerId:c.id,remaining:q.turns+Math.ceil(Math.max(0,c.nextAct-w.s.time)/100),total:q.turns,label:`${c.name}의 구조를 기다린다`};c.ai.path=undefined
 return null
}
export function companionDragStep(w:World,c:Creature):boolean{
 const act=c.activity!,p=creatureById(w,act.patientId),origin=act.aidOrigin,to=act.target
 const error=!p||!origin||!to||!eq(c.pos,origin.actor)||!eq(p.pos,origin.patient)?'원래 구조자와 환자의 위치가 달라졌다':companionDragQuote(w,c,p,to,true).error
 if(error){releasePatient(w,c,act);c.activity=undefined;return true}
 if(act.remaining>0)return false
 p!.pos={...c.pos};c.pos={...to!};c.facing=p!.facing
 if(p!.companion&&p!.companion.order!=='follow'&&!w.s.map.baseCamp?.tasks[p!.id])p!.companion.anchor={...p!.pos}
 c.needs.energy=Math.max(0,c.needs.energy-companionAidRule(w)!.dragEnergy);p!.ai.path=undefined;c.ai.path=undefined;emitNoise(w,c.pos,4,c.id)
 releasePatient(w,c,act,true);c.activity=undefined
 if(canSee(w,player(w),c.pos)||p!.id===w.s.playerId)log(w,'info',`${c.name}이(가) ${p!.name}을(를) 집결지 쪽으로 한 칸 옮겼다.`)
 return true
}
function candidates(w:World,c:Creature){return w.s.creatures.filter(p=>!patientError(w,c,p)&&p.body.wounds.some(wd=>needed(w,p,wd).length)||p!==c&&!patientError(w,c,p)&&!!evacuation(w,c,p)).sort((a,b)=>Number(b.unconscious)-Number(a.unconscious)||totalBleed(w,b)-totalBleed(w,a)||cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.id-b.id)}
export function urgentCompanionAid(w:World,c:Creature){
 if(!c.activity||c.activity.baseOrder===undefined&&c.workJob?.baseOrder===undefined||providerError(w,c,true))return false
 return candidates(w,{...c,activity:undefined}).some(p=>p!==c&&(p.unconscious||p.body.wounds.some(wd=>wd.arterial&&effectiveBleed(w,p,wd)>0)))
}
export function companionAidDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 if(providerError(w,c))return null
 const errand=companionAidSupplyDecision(w,c);if(errand)return errand
 for(const p of candidates(w,c)){
  if(!companionAidQuote(w,c,p).error)return{action:{type:'autoCompanionAid',target:p.id}}
  const path=evacuation(w,c,p)
  if(path){if(!eq(c.pos,path[0]))return{goal:path[0]};const to=path[1]??DIRS.map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y})).find(pos=>safeCell(w,c,pos)&&!creatureAt(w,pos)&&!diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y));if(to&&!companionDragQuote(w,c,p,to).error)return{action:{type:'companionDrag',target:p.id,to}}}
  if(!companionAidSupplyQuote(w,c,p).error)return{action:{type:'companionAidSupplyPlan',target:p.id}}
  if(cheb(c.pos,p.pos)>1&&masteryStage(w,c,'medicine')>=companionAidRule(w)!.minMedicine&&supplyItems(c).some(i=>!i.dirty&&!i.missingItem&&!i.half&&i.count>0&&(i.uses??1)>0&&itemDef(w,i).medical&&!itemDef(w,i).medical!.dirty)){
   const goal=DIRS.map(v=>({x:p.pos.x+v.x,y:p.pos.y+v.y})).filter(pos=>safeCell(w,c,pos)&&!creatureAt(w,pos)&&hasLos(w,pos,p.pos)&&!diagonalBlocked(w,pos,p.pos.x-pos.x,p.pos.y-pos.y)).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x).find(pos=>findPath(w,c.pos,pos,{selfId:c.id,avoidCreatures:true,maxNodes:1800})?.length)
   if(goal)return{goal}
  }
 }
 return null
}


export function setCompanionAidDepot(w:World,c:Creature,allow:boolean):string|null{
 if(typeof allow!=='boolean')return '의료 물품 보급 허락을 확인해야 한다'
 const access=companionAccess(w,c);if(access)return access
 if(!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w)||!c.companion!.aid||c.companion!.aid.mode==='off')return '상호 응급 처치를 맡긴 유급 동료에게 지시해야 한다'
 if(allow&&(baseStoreError(w,c,false)||w.s.map.baseCamp?.storeUid===undefined||!companionAidRule(w)?.supplyMemoryTurns))return '본인의 실제 거점 창고가 있는 현장에서 허락해야 한다'
 c.companion!.aid.suppliesFromBase=allow;delete c.companion!.aid.supply;c.ai.path=undefined
 log(w,'info',`${c.name}: ${allow?'상처를 확인한 뒤 거점 창고의 깨끗한 의료 물품을 한 개씩 가져와 처치한다':'거점 창고의 자동 의료 보급을 멈춘다'}.`)
 return null
}
const usableMedical=(w:World,i:ItemInst)=>i.count>0&&!i.half&&!i.missingItem&&!i.dirty&&(i.uses??1)>0&&(i.durability??100)>0&&!!itemDef(w,i).medical&&!itemDef(w,i).medical!.dirty
export function companionAidSupplyQuote(w:World,c:Creature,p:Creature){
 const out={error:null as string|null,plan:undefined as NonNullable<NonNullable<Creature['companion']>['aid']>['supply']}
 out.error=providerError(w,c)??patientError(w,c,p);if(out.error)return out
 const base=w.s.map.baseCamp,rule=companionAidRule(w)!
 if(!c.companion!.aid?.suppliesFromBase||!rule.supplyMemoryTurns||baseStoreError(w,c,false)||base?.storeUid===undefined||cheb(c.pos,base.store)>rule.rallyRadius||cheb(p.pos,base.store)>rule.rallyRadius||!canSee(w,c,base.store)||!tileAt(w,base.store).cont?.opened){out.error='허락한 같은 현장의 열린 거점 창고를 확인해야 한다';return out}
 if(masteryStage(w,c,'medicine')<rule.minMedicine){out.error='응급 처치를 맡길 의료 숙달이 부족하다';return out}
 const own=supplyItems(c).filter(i=>usableMedical(w,i)),stock=tileAt(w,base.store).cont!.items.filter(i=>usableMedical(w,i)).sort((a,b)=>(itemDef(w,b).medical?.tool??0)-(itemDef(w,a).medical?.tool??0)||a.uid-b.uid)
 for(const kind of['tourniquet','bandage','disinfect','splint'])for(const wound of p.body.wounds.slice().sort((a,b)=>effectiveBleed(w,p,b)-effectiveBleed(w,p,a)||a.id-b.id)){
  if(!needed(w,p,wound).includes(kind)||own.some(i=>itemDef(w,i).medical!.kind===kind))continue
  const item=stock.find(i=>itemDef(w,i).medical!.kind===kind);if(!item)continue
  const actor:Creature={...c,pos:{...p.pos},activity:undefined,bag:[...c.bag,structuredClone({...item,count:1})]},shadow:World={db:w.db,s:{...w.s,log:[...w.s.log]}}
  if(!startTreatment(shadow,actor,item.uid,wound.id,undefined,undefined,p).ok)continue
  if(!baseStoreError(w,c)&&transferBase(w,c,'take',item.uid,1,true))continue
  out.plan={patient:p.id,woundId:wound.id,kind,pos:{...p.pos},map:w.s.map.id,region:w.s.overworld?.currentRegion,seenAt:turnOf(w),storeUid:base.storeUid,materialUid:item.uid,item:item.def,phase:'take'};return out
 }
 out.error='확인한 상처에 필요한 실제 창고 의료 물품이 없다';return out
}
export function planCompanionAidSupply(w:World,c:Creature,p:Creature):string|null{
 const q=companionAidSupplyQuote(w,c,p);if(q.error)return q.error
 c.companion!.aid!.supply=q.plan;c.ai.path=undefined;return null
}
export function takeCompanionAidSupply(w:World,c:Creature,uid:number):string|null{
 const task=c.companion?.aid?.supply,base=w.s.map.baseCamp,error=providerError(w,c)
 if(error)return error
 if(!c.companion!.aid!.suppliesFromBase||!task||task.phase!=='take'||task.map!==w.s.map.id||task.region!==w.s.overworld?.currentRegion||task.storeUid!==base?.storeUid||task.materialUid!==uid||turnOf(w)-task.seenAt>(companionAidRule(w)?.supplyMemoryTurns??0))return '원래 확인한 현장과 의료 보급 지시가 달라졌다'
 const item=base&&tileAt(w,base.store).cont?.items.find(i=>i.uid===uid)
 if(!item||item.def!==task.item||!usableMedical(w,item)||itemDef(w,item).medical!.kind!==task.kind)return '예약한 원래 깨끗한 의료 물품이 없어지거나 바뀌었다'
 const failure=transferBase(w,c,'take',uid,1);if(failure)return failure
 task.phase='returning';c.ai.path=undefined
 if(canSee(w,player(w),c.pos))log(w,'info',`${c.name}이(가) 실제 거점 창고에서 ${itemDef(w,item).label} 한 개를 꺼냈다.`)
 return null
}
function rememberedPatientGoal(w:World,c:Creature,pos:Pos){
 return DIRS.map(v=>({x:pos.x+v.x,y:pos.y+v.y})).filter(p=>safeCell(w,c,p)&&(!creatureAt(w,p)||creatureAt(w,p)!.id===c.id)&&hasLos(w,p,pos)&&!diagonalBlocked(w,p,pos.x-p.x,pos.y-p.y)).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x).find(p=>eq(c.pos,p)||findPath(w,c.pos,p,{selfId:c.id,avoidCreatures:true,maxNodes:1800})?.length)
}
function companionAidSupplyDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 const aid=c.companion?.aid,task=aid?.supply;if(!task)return null
 const base=w.s.map.baseCamp,rule=companionAidRule(w)!,forget=()=>{delete aid!.supply;c.ai.path=undefined;return null}
 if(!aid!.suppliesFromBase||!rule.supplyMemoryTurns||task.map!==w.s.map.id||task.region!==w.s.overworld?.currentRegion||baseStoreError(w,c,false)||base?.storeUid!==task.storeUid||turnOf(w)<task.seenAt||turnOf(w)-task.seenAt>rule.supplyMemoryTurns)return forget()
 const p=creatureById(w,task.patient),seen=!!p&&canSee(w,c,p.pos)
 if(seen){
  if(patientError(w,c,p!)||!p!.body.wounds.some(wd=>wd.id===task.woundId&&needed(w,p!,wd).includes(task.kind)))return forget()
  task.pos={...p!.pos};task.seenAt=turnOf(w)
 }
 if(task.phase==='take'){
  const item=tileAt(w,base!.store).cont?.items.find(i=>i.uid===task.materialUid)
  if(!item||item.def!==task.item||!usableMedical(w,item))return forget()
  if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)}
  if(transferBase(w,c,'take',task.materialUid,1,true))return forget()
  return{action:{type:'companionAidSupplyTake',uid:task.materialUid}}
 }
 if(seen&&!companionAidQuote(w,c,p!).error){forget();return{action:{type:'autoCompanionAid',target:p!.id}}}
 if(cheb(c.pos,task.pos)<=1)return forget()
 const goal=rememberedPatientGoal(w,c,task.pos);return goal?{goal}:forget()
}
