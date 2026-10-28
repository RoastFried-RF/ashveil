import {actualNpcName} from './npc-identity'
// 기존 AI가 쉬기로 한 차례에만 실제 곁의 동료와 이야기한다. 개인 관계는 플레이어에게 전파하지 않는다.
import {hostileAware} from './action-time'
import {capacity} from './body'
import {effectiveFaction} from './companion-state'
import {clamp,log,player,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {knownCreatureName} from './bestiary-state'
import {rememberLifeEvent} from './life-memories'
import {diagonalBlocked} from './path'
import {recordConversation} from './social-state'
import type {Action} from './actions'
import type {CompanionBondDef,Creature,NpcSocialDef,NpcTie} from './types'
export const npcSocialDef=(w:World)=>w.db.get<NpcSocialDef>('NpcSocial.Hearth')
function ready(w:World,c:Creature,d:NpcSocialDef){
 if(c===player(w)||!w.s.creatures.includes(c)||c.mapId&&c.mapId!==w.s.map.id||!c.alive||c.asleep||c.unconscious||c.activity||c.captivity||c.breakdown||c.body.machine||w.db.body(c.body.def).kind!=='humanoid'||!d.roles.includes(w.db.creature(c.def).ai))return false
 if(c.roadRaid||c.caravan||c.abduction||c.companionRecovery||c.recoveryCargo||c.ai.task||c.ai.route?.length||c.ai.target||['hunt','flee','surrender','investigate','patrol','return'].includes(c.ai.mode))return false
 if(c.npcSocialAfter!==undefined&&(!Number.isSafeInteger(c.npcSocialAfter)||c.npcSocialAfter<0))return false
 if((c.npcSocialAfter??0)>turnOf(w)||c.needs.kcal<d.minKcal||c.needs.waterDeficit>=d.maxWaterDeficit||c.needs.fatigue>=d.maxFatigue||c.needs.bodyTemp<d.minBodyTemp||c.needs.bodyTemp>d.maxBodyTemp)return false
 return capacity(w,c,'consciousness')>=.5&&capacity(w,c,'hearing')>=.2&&capacity(w,c,'sight')>=.2&&!hostileAware(w,c)
}
function tieValid(t:NpcTie|undefined,d:NpcSocialDef,now:number){return!t||typeof t.name==='string'&&!!t.name&&Number.isSafeInteger(t.score)&&t.score>=d.min&&t.score<=d.max&&t.score>=d.minSpeakScore&&Number.isSafeInteger(t.since)&&t.since>=0&&Number.isSafeInteger(t.lastAt)&&t.lastAt>=t.since&&t.lastAt<=now&&Array.isArray(t.events)&&t.events.every(e=>Number.isSafeInteger(e.at)&&e.at>=t.since&&e.at<=t.lastAt&&Number.isSafeInteger(e.delta)&&['talk','clash','care'].includes(e.kind)&&typeof e.mapId==='string')&&Number.isSafeInteger(t.gained)&&t.gained>=0&&Number.isSafeInteger(t.lost)&&t.lost>=0}
export function npcConversationQuote(w:World,a:Creature,b:Creature){
 const d=npcSocialDef(w),now=turnOf(w);let error:string|null=null
 if(!d.enabled||a===b||!ready(w,a,d)||!ready(w,b,d))error='지금 짧은 대화를 나눌 두 실제 주민이 아니다'
 else if(effectiveFaction(w,a)!==effectiveFaction(w,b)||a.attackedBy?.includes(b.id)||b.attackedBy?.includes(a.id))error='서로 경계하는 상대와는 한가하게 이야기하지 않는다'
 else if(cheb(a.pos,b.pos)>d.range||!hasLos(w,a.pos,b.pos)||!canSee(w,a,b.pos)||!canSee(w,b,a.pos)||lightLevel(w,a.pos)>=2||lightLevel(w,b.pos)>=2||diagonalBlocked(w,a.pos,b.pos.x-a.pos.x,b.pos.y-a.pos.y))error='서로 보고 들을 수 있는 바로 곁의 상대가 필요하다'
 else if(!tieValid(a.npcTies?.[b.id],d,now)||!tieValid(b.npcTies?.[a.id],d,now))error='기억한 관계와 대화 의사를 확인할 수 없다'
 return{error}
}
export function npcSocialAction(w:World,c:Creature):Action|null{
 const d=npcSocialDef(w);if(!d.enabled||!ready(w,c,d))return null
 const partner=w.s.creatures.filter(o=>o!==c&&cheb(c.pos,o.pos)<=d.range&&!npcConversationQuote(w,c,o).error).sort((a,b)=>cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.id-b.id)[0]
 return partner?{type:'npcSocialTalk',target:partner.id}:null
}
function rememberTie(w:World,owner:Creature,other:Creature,raw:number,kind:'talk'|'clash'|'care'){
 const d=npcSocialDef(w),now=turnOf(w),day=Math.floor(now/TURNS_PER_DAY),ties=owner.npcTies??={},t=ties[other.id]??={name:actualNpcName(other),score:0,since:now,lastAt:now,day,gained:0,lost:0,events:[]}
 t.name=actualNpcName(other)
 if(t.day!==day){t.day=day;t.gained=0;t.lost=0}
 const allowed=raw>0?Math.min(raw,Math.max(0,d.gainPerDay-t.gained)):-Math.min(-raw,Math.max(0,d.lossPerDay-t.lost)),before=t.score
 t.score=clamp(t.score+allowed,d.min,d.max);const delta=t.score-before;t.gained+=Math.max(0,delta);t.lost+=Math.max(0,-delta);t.lastAt=now
 t.events.push({at:now,kind,delta,mapId:w.s.map.id,region:w.s.overworld?.currentRegion});if(t.events.length>d.historyLimit)t.events.splice(0,t.events.length-d.historyLimit)
}
export function converseNpcs(w:World,a:Creature,b:Creature):string|null{
 const q=npcConversationQuote(w,a,b);if(q.error)return q.error
 const d=npcSocialDef(w),now=turnOf(w),personality=w.db.get<CompanionBondDef>(d.personalityRules),clashes=personality.conflicts.filter(p=>a.traits.includes(p.a)&&b.traits.includes(p.b)||a.traits.includes(p.b)&&b.traits.includes(p.a)).reduce((n,p)=>n+p.delta,0),delta=d.baseDelta+(a.traits.some(t=>b.traits.includes(t))?d.sharedTraitBonus:0)+clashes
 a.npcSocialAfter=now+d.intervalTurns;b.npcSocialAfter=now+d.intervalTurns
 rememberTie(w,a,b,delta,clashes<0?'clash':'talk');rememberTie(w,b,a,delta,clashes<0?'clash':'talk');recordConversation(w,a,b)
 for(const c of[a,b])rememberLifeEvent(w,c,clashes<0?'insult':'talk')
 // 기존 대기와 같은 실제 1턴이며, 먹거나 걷는 행동을 대체하지 않는다.
 a.rested=true
 const p=player(w)
 if(p.alive&&!p.asleep&&!p.unconscious&&capacity(w,p,'consciousness')>=.5&&capacity(w,p,'hearing')>=.2&&cheb(p.pos,a.pos)<=d.witnessRange&&cheb(p.pos,b.pos)<=d.witnessRange&&canSee(w,p,a.pos)&&canSee(w,p,b.pos)&&hasLos(w,p.pos,a.pos)&&hasLos(w,p.pos,b.pos))log(w,'info',`${knownCreatureName(w,a)}과(와) ${knownCreatureName(w,b)}이(가) ${clashes<0?'이야기하다 말투가 부딪쳤다.':'잠깐 이야기를 나눴다.'}`)
 return null
}

/** 완료한 원래 처치가 양쪽 개인 관계에 남긴다. 대화와 같은 하루 상한을 공유한다. */
export function rememberNpcCareBond(w:World,provider:Creature,patient:Creature,bonus:number){
 if(!Number.isSafeInteger(bonus)||bonus<0||bonus>10||provider===player(w)||patient===player(w)||!w.s.creatures.includes(provider)||!w.s.creatures.includes(patient)||!provider.npcTies?.[patient.id]||!patient.npcTies?.[provider.id])return
 rememberTie(w,provider,patient,bonus,'care');rememberTie(w,patient,provider,bonus,'care')
}
