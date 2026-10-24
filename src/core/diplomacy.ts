import {reputationOrigin} from './rumor-subject'
import {publishWitnessedName} from './public-name-news'
import { kinshipDefs, kinshipTrust, witnessKinship } from './kinship-state'
import { effectiveFaction, isCompanion } from './companion-state'
// 세력 관계·목격 평판. 표시/적대 조회는 상태나 난수를 바꾸지 않는다.
import { clamp, log, player, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { capacity } from './body'
import { towerGardenAlert } from './tower-consequences'
import { cheb, type Pos } from './geom'
import type { Creature, DiplomacyDef, FactionDef, FactionRelationsDef, FactionIncidentKind, SocietyState } from './types'

const factionCache = new WeakMap<World['db'], Map<string, FactionDef>>()
export function factionDef(w: World, key: string): FactionDef | undefined {
  let all = factionCache.get(w.db)
  if (!all) { all = new Map(w.db.all<FactionDef>('Faction').map((d) => [d.key, d])); factionCache.set(w.db, all) }
  return all.get(key)
}
export const diplomacyDef = (w: World) => w.db.get<DiplomacyDef>('Diplomacy.Hearth')
export const factionAvailable=(w:World,f:FactionDef)=>!f.unlock||!!w.s.overworld?.society?.unlocks?.includes(f.unlock)
export function reputation(w: World, faction: string): number {
  const base = factionDef(w, faction)?.playerStart ?? 0
  const recorded=w.s.overworld?.society?.reputation[faction]
  if(recorded!==undefined)return recorded
  const pl=player(w),background=diplomacyDef(w).background[pl.background??'']?.[faction]??base
  const bonus=pl.traits.reduce((n,id)=>n+(w.db.trait(id).initialReputation?.[faction]??0),0)
  return bonus===0?background:clamp(background+bonus,-100,100)
}
export function reputationBand(w: World, faction: string) {
  const value = reputation(w, faction), bands = diplomacyDef(w).bands
  return bands.filter((b) => b.min <= value).at(-1) ?? bands[0]
}
export function ensureSociety(w: World): SocietyState | undefined {
  const m = w.s.overworld
  if (!m) return undefined
  return m.society ??= { reputation: Object.fromEntries(w.db.all<FactionDef>('Faction').filter((f) => !f.territorial&&factionAvailable(w,f)).map((f) => [f.key, reputation(w, f.key)])), events: [], nextEvent: 1 }
}
export function hostile(w: World, a: Creature, b: Creature): boolean {
  const af=effectiveFaction(w,a),bf=effectiveFaction(w,b)
  if (a.id === b.id || af===bf) return false
  if (a.attackedBy?.includes(b.id) || b.attackedBy?.includes(a.id)) return true
  // Healthy, unprovoked prey flees humans. It is not a combat interruption merely
  // because its nonpolitical animal grouping differs from the observer's faction.
  const unthreateningPrey=(animal:Creature,other:Creature)=>w.db.creature(animal.def).wildlife?.kind==='timidHerbivore'&&w.db.body(other.body.def).kind==='humanoid'&&animal.ai.mode!=='hunt'
  if(unthreateningPrey(a,b)||unthreateningPrey(b,a))return false
  const gardenAlert=towerGardenAlert(w)
  if(a.body.machine&&Math.max(a.body.machine.alert??0,gardenAlert)<2||b.body.machine&&Math.max(b.body.machine.alert??0,gardenAlert)<2)return false
  if(a.mercy?.faction===bf&&turnOf(w)<a.mercy.until||b.mercy?.faction===af&&turnOf(w)<b.mercy.until)return false
  if (a.ai.mode === 'calm' || b.ai.mode === 'calm') return false
  if (w.s.overworld) {
    const fa = factionDef(w, af), fb = factionDef(w, bf)
    const kin=af==='player'?b:bf==='player'?a:undefined,rule=kin&&kinshipDefs(w).find(d=>d.underground.includes(kin.def))
    if(kin&&rule&&kinshipTrust(w,kin,reputation(w,rule.faction)))return false
    if (fa?.territorial || fb?.territorial) return true
    if (af === 'player' && fb) return reputationBand(w, fb.key).attack
    if (bf === 'player' && fa) return reputationBand(w, fa.key).attack
    // 어느 쪽이든 적대하면 서로를 교전 대상으로 본다.
    if (fa && fb) return Math.min(factionRelation(w,fa.key,fb.key),factionRelation(w,fb.key,fa.key)) <= -50
  }
  if (af === 'player' || bf === 'player') return true
  if (af === 'vermin' || bf === 'vermin') return false
  if ((af === 'withered' && bf === 'shades') || (af === 'shades' && bf === 'withered')) return false
  return true
}
export const factionRelationsDef=(w:World)=>w.db.get<FactionRelationsDef>('FactionRelations.Hearth')
const relationDay=(w:World)=>Math.floor(turnOf(w)/TURNS_PER_DAY)
/** 날짜 차이로 복귀량을 읽는다. 조회는 상태·난수를 바꾸지 않는다. */
export function factionRelation(w:World,from:string,to:string):number{
  const row=w.s.overworld?.society?.relations?.[from]?.[to]
  if(!row)return factionDef(w,from)?.relations[to]??0
  const gap=row.baseline-row.value,steps=Math.max(0,relationDay(w)-row.day)*factionRelationsDef(w).returnPerDay
  return row.value+Math.sign(gap)*Math.min(Math.abs(gap),steps)
}
export function recordFactionIncident(w:World,from:string,to:string,kind:FactionIncidentKind,key:string,witnesses:number[]=[],site?:string):boolean{
  const a=factionDef(w,from),b=factionDef(w,to)
  if(!w.s.overworld||!a||!b||a.territorial||b.territorial||from===to||!key)return false
  const society=ensureSociety(w)!
  if(society.relationEvents?.some((e)=>e.key===key&&e.from===from&&e.to===to&&e.kind===kind))return false
  const effect=factionRelationsDef(w).events[kind],previous=society.relations?.[from]?.[to],value=clamp(factionRelation(w,from,to)+effect.delta,-100,100),baseline=clamp((previous?.baseline??a.relations[to]??0)+effect.baseline,-100,100)
  const rows=society.relations??={};(rows[from]??={})[to]={value,baseline,day:relationDay(w)}
  ;(society.relationEvents??=[]).push({key,from,to,kind,turn:turnOf(w),witnesses:[...witnesses],site})
  return true
}
/** 대화로 들은 정책은 그 시점 값만 보존한다. 이후 비공개 사건으로 화면 수치를 갱신하지 않는다. */
export function hearFactionRelations(w:World,speaker:Creature){
  const listener=player(w)
  if(!listener.alive||!speaker.alive||listener.asleep||speaker.asleep||listener.unconscious||speaker.unconscious||capacity(w,listener,'consciousness')<.5||capacity(w,speaker,'consciousness')<.5||capacity(w,listener,'hearing')<.2||cheb(listener.pos,speaker.pos)>1||!hasLos(w,listener.pos,speaker.pos)||hostile(w,listener,speaker))return
  const faction=factionDef(w,speaker.faction)
  if(!faction||faction.territorial)return
  const society=ensureSociety(w);if(!society)return
  const values=Object.fromEntries(w.db.all<FactionDef>('Faction').filter((f)=>!f.territorial&&f.key!==faction.key&&factionAvailable(w,f)).map((f)=>[f.key,factionRelation(w,faction.key,f.key)]))
  ;(society.relationKnowledge??={})[faction.key]={day:relationDay(w),values}
}
function witnessSettlementRaid(w:World,actor:Creature,victim:Creature,murder:boolean){
  const m=w.s.overworld,site=m?.sites.find((s)=>s.id===m.currentRegion),attacker=factionDef(w,actor.faction),defender=factionDef(w,victim.faction)
  if(site?.kind!=='settlement'||site.faction!==victim.faction||!attacker||!defender||attacker.territorial||defender.territorial||actor.faction===victim.faction)return
  const origin=victim.residentSite??victim.traderSite??victim.clinicSite
  if(origin!==site.id&&(origin!==undefined||!victim.home||victim.mapId!==w.s.map.id))return
  if(!murder&&!victim.attackedBy?.includes(actor.id))(victim.attackedBy??=[]).push(actor.id)
  const witnesses=w.s.creatures.filter((c)=>c.id!==actor.id&&c.alive&&!c.asleep&&!c.unconscious&&c.faction===victim.faction&&canSee(w,c,actor.pos)).map((c)=>c.id)
  if(!witnesses.length)return
  const prefix=`${site.id}:${victim.faction}:${actor.faction}`
  recordFactionIncident(w,victim.faction,actor.faction,'raid',`raid:${prefix}:${relationDay(w)}`,witnesses,site.id)
  if(murder)recordFactionIncident(w,victim.faction,actor.faction,'grudge',`grudge:${prefix}:${victim.id}`,witnesses,site.id)
}
export function diplomacyTick(w: World) {
  const society = w.s.overworld?.society
  if (!society) return
  const day=relationDay(w)
  for(const[from,targets]of Object.entries(society.relations??{}))for(const[to,row]of Object.entries(targets))if(row.day<day){row.value=factionRelation(w,from,to);row.day=day}
  for (const e of society.events) if (!e.applied && e.arrives <= turnOf(w)) {
    society.reputation[e.faction] = clamp((society.reputation[e.faction] ?? reputation(w, e.faction)) + e.delta, -100, 100)
    e.applied = true
    log(w, e.delta < 0 ? 'warn' : 'good', `${factionDef(w, e.faction)?.label ?? e.faction}에 소식이 닿았다. 평판 ${e.delta > 0 ? '+' : ''}${e.delta}: ${e.reason}`)
  }
}
/** 실제로 작업자와 설비 양쪽을 본 사람만 소유권 침해를 안다. 조회에서는 호출하지 않는다. */
export function witnessPropertyCrime(w:World,actor:Creature,pos:Pos,key:string,target:number,crime:{faction:string;delta:number;reason:string;provoke?:boolean}){
  const m=w.s.overworld
  if(!m||!w.s.creatures.includes(actor)||actor.id!==w.s.playerId&&!isCompanion(w,actor)||!actor.alive||actor.asleep||actor.unconscious||!factionDef(w,crime.faction))return false
  const witnesses=w.s.creatures.filter(c=>c.id!==actor.id&&c.alive&&!c.asleep&&!c.unconscious&&capacity(w,c,'consciousness')>=.5&&effectiveFaction(w,c)===crime.faction&&canSee(w,c,actor.pos)&&canSee(w,c,pos))
  if(!witnesses.length)return false
  if(crime.provoke)for(const c of witnesses)if(!c.attackedBy?.includes(actor.id))(c.attackedBy??=[]).push(actor.id)
  const society=ensureSociety(w)!,previous=society.events.find(e=>e.propertyKey===key)
  if(previous){for(const c of witnesses)if(!previous.witnesses.includes(c.id))previous.witnesses.push(c.id);return true}
  const d=diplomacyDef(w),homes=m.sites.filter(s=>s.faction===crime.faction),distance=homes.reduce((n,s)=>Math.min(n,Math.abs(s.cell.x-m.position.x)+Math.abs(s.cell.y-m.position.y)),Infinity),local=homes.some(s=>s.id===m.currentRegion),days=local?0:clamp(Number.isFinite(distance)?Math.ceil(distance*d.witnessDaysPerCell):d.witnessMaxDays,d.witnessMinDays,d.witnessMaxDays),now=turnOf(w)
  society.events.push({...reputationOrigin(w,actor),propertyKey:key,id:society.nextEvent++,target,faction:crime.faction,delta:crime.delta,reason:crime.reason,turn:now,arrives:now+days*TURNS_PER_DAY,witnesses:witnesses.map(c=>c.id),applied:false})
  publishWitnessedName(w,society.events.at(-1)!)
  diplomacyTick(w);return true
}
/** 공격 시도도 목격되는 사건이다. 피해자는 살아 있으면 자기 방어를 한다. */
export function witnessAttack(w: World, actor: Creature, victim: Creature, murder = false) {
  witnessKinship(w,actor,victim,murder)
  if(!murder&&actor.id!==victim.id&&w.db.creature(victim.def).wildlife&&!victim.attackedBy?.includes(actor.id))(victim.attackedBy??=[]).push(actor.id)
  const m = w.s.overworld, faction = factionDef(w, victim.faction)
  if(!m)return
  if(actor.id!==w.s.playerId&&!isCompanion(w,actor)){witnessSettlementRaid(w,actor,victim,murder);return}
  if (!faction || faction.territorial) return
  const d = diplomacyDef(w), now = turnOf(w), society = ensureSociety(w)!
  if (!murder && !victim.attackedBy?.includes(actor.id)) (victim.attackedBy ??= []).push(actor.id)
  const witnesses = w.s.creatures.filter((c) => c.id !== actor.id && c.alive && !c.unconscious && !c.asleep && c.faction === victim.faction && (c.id !== victim.id || !murder) && canSee(w, c, actor.pos))
  if (!witnesses.length) return
  // 같은 대상에 대한 반복 공격은 한 사건. 살해는 별도의 중한 사건이다.
  const reason = `${victim.name} ${murder ? '살해' : '공격'}`
  if (society.events.some((e) => e.target === victim.id && e.reason === reason)) return
  const home = m.sites.filter((s) => s.faction === victim.faction)
  const distance = home.reduce((n, s) => Math.min(n, Math.abs(s.cell.x - m.position.x) + Math.abs(s.cell.y - m.position.y)), Infinity)
  const local = home.some((s) => s.id === m.currentRegion)
  const delay = local ? 0 : clamp(Number.isFinite(distance) ? Math.ceil(distance * d.witnessDaysPerCell) : d.witnessMaxDays, d.witnessMinDays, d.witnessMaxDays) * TURNS_PER_DAY
  society.events.push({ ...reputationOrigin(w,actor),target: victim.id, id: society.nextEvent++, faction: victim.faction, delta: murder ? d.murderLoss : d.attackLoss, reason, turn: now, arrives: now + delay, witnesses: witnesses.map((c) => c.id), applied: false })
  publishWitnessedName(w,society.events.at(-1)!)
  for (const c of witnesses) if (c.id !== victim.id && !c.attackedBy?.includes(actor.id)) (c.attackedBy ??= []).push(actor.id)
  diplomacyTick(w)
}
