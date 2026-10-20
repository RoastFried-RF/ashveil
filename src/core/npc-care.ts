// 같은 현장에서 실제로 아는 이웃에게 자기 물품과 같은 의료 규칙을 쓴다.
import {hostileAware} from './action-time'
import {capacity,effectiveBleed,totalBleed} from './body'
import {effectiveFaction} from './companion-state'
import {inBounds,player,turnOf,type World} from './ctx'
import {activeEscort} from './escort-contracts'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {itemDef} from './items'
import {diagonalBlocked} from './path'
import {masteryStage} from './skills'
import {startTreatment} from './treatment'
import type {Action} from './actions'
import type {Activity,Creature,NpcCareDef,NpcSocialDef} from './types'
export const npcCareDef=(w:World)=>w.db.get<NpcCareDef>('NpcCare.Hearth')
function ready(w:World,c:Creature){
 const d=npcCareDef(w),roles=w.db.get<NpcSocialDef>(d.sourceRules).roles
 return c!==player(w)&&c.faction!=='player'&&w.s.creatures.includes(c)&&(!c.mapId||c.mapId===w.s.map.id)&&inBounds(w,c.pos)&&c.alive&&!c.asleep&&!c.unconscious&&!c.captivity&&!c.companion&&!c.rescue&&!c.activity&&!c.breakdown&&!c.body.machine&&w.db.body(c.body.def).kind==='humanoid'&&roles.includes(w.db.creature(c.def).ai)&&!c.roadRaid&&!c.caravan&&!c.abduction&&!c.companionRecovery&&!c.recoveryCargo&&!c.ai.task&&!c.ai.route?.length&&!c.ai.target&&!activeEscort(w,c)&&!['hunt','flee','surrender','investigate','patrol','return'].includes(c.ai.mode)&&capacity(w,c,'consciousness')>=.5&&capacity(w,c,'sight')>=.2&&capacity(w,c,'hearing')>=.2&&!hostileAware(w,c)
}
export function npcCareQuote(w:World,provider:Creature,patient:Creature){
 const d=npcCareDef(w),out={error:null as string|null,activity:undefined as Activity|undefined,turns:0},now=turnOf(w)
 if(!d.enabled||provider===patient||!ready(w,provider)||!ready(w,patient)||effectiveFaction(w,provider)!==effectiveFaction(w,patient)||provider.attackedBy?.includes(patient.id)||patient.attackedBy?.includes(provider.id)){out.error='서로 아는 같은 현장의 비적대 두 주민이 필요하다';return out}
 if(provider.needs.kcal<d.minKcal||provider.needs.waterDeficit>=d.maxWaterDeficit||provider.needs.fatigue>=d.maxFatigue||provider.needs.bodyTemp<d.minBodyTemp||provider.needs.bodyTemp>d.maxBodyTemp||capacity(w,provider,'manipulation')<.2||totalBleed(w,provider)>0||masteryStage(w,provider,'medicine')<d.minMedicine){out.error='자기 몸과 의료 물품을 쓸 여유가 있어야 한다';return out}
 const ties=[provider.npcTies?.[patient.id],patient.npcTies?.[provider.id]]
 if(ties.some(t=>!t||!Number.isSafeInteger(t.score)||t.score<d.minBond||!Number.isSafeInteger(t.since)||t.since<0||!Number.isSafeInteger(t.lastAt)||t.lastAt<t.since||t.lastAt>now||!Array.isArray(t.events)||!t.events.some(e=>e&&e.kind==='talk'&&Number.isSafeInteger(e.at)&&e.at>=t.since&&e.at<=t.lastAt))){out.error='실제 대화로 서로 알게 된 이웃이어야 한다';return out}
 if(cheb(provider.pos,patient.pos)>1||!hasLos(w,provider.pos,patient.pos)||!canSee(w,provider,patient.pos)||!canSee(w,patient,provider.pos)||lightLevel(w,provider.pos)>=2||lightLevel(w,patient.pos)>=2||diagonalBlocked(w,provider.pos,patient.pos.x-provider.pos.x,patient.pos.y-provider.pos.y)){out.error='서로 보고 들을 수 있는 곁에서 상처를 확인해야 한다';return out}
 const wounds=patient.body.wounds.filter(wd=>!wd.internal&&wd.severity>wd.healed&&effectiveBleed(w,patient,wd)>=d.minBleed).sort((a,b)=>effectiveBleed(w,patient,b)-effectiveBleed(w,patient,a)||a.id-b.id),supplies=provider.bag.filter(i=>i.count>0&&(i.uses??1)>0&&(i.durability??100)>0&&itemDef(w,i).medical?.kind==='bandage'&&!itemDef(w,i).medical!.dirty).sort((a,b)=>a.uid-b.uid)
 for(const wound of wounds)for(const item of supplies){const actor:Creature={...provider,activity:undefined},result=startTreatment(w,actor,item.uid,wound.id,undefined,undefined,patient);if(result.ok&&actor.activity){out.activity=actor.activity;out.activity.npcCare={provider:provider.id,patient:patient.id,woundId:wound.id,materialUid:item.uid,startedAt:now};out.turns=actor.activity.total!;return out}}
 out.error='자기 실제 깨끗한 붕대와 처치할 외부 출혈 상처가 필요하다';return out
}
export function npcCareAction(w:World,c:Creature):Action|null{
 if(!npcCareDef(w).enabled||!ready(w,c))return null
 const patient=w.s.creatures.filter(o=>o!==c&&cheb(c.pos,o.pos)<=1).sort((a,b)=>totalBleed(w,b)-totalBleed(w,a)||a.id-b.id).find(o=>!npcCareQuote(w,c,o).error)
 return patient?{type:'npcCare',target:patient.id}:null
}
export function startNpcCare(w:World,provider:Creature,patient:Creature):string|null{
 const q=npcCareQuote(w,provider,patient);if(q.error)return q.error
 provider.activity=q.activity!;provider.activity.woundCount=provider.body.wounds.length
 const turns=q.turns+Math.ceil(Math.max(0,provider.nextAct-w.s.time)/100)
 patient.activity={kind:'careWait',healerId:provider.id,remaining:turns,total:turns,label:'이웃의 출혈 처치'}
 return null
}
