import {rumorSubject} from './rumor-subject'
// 친족의 기억은 실제 목격자에게만 붙는다. 조회는 RNG나 사회 원장을 바꾸지 않는다.
import { capacity } from './body'
import { isCompanion } from './companion-state'
import { player, type World } from './ctx'
import { canSee } from './fov'
import type { Creature, KinshipDef, KinshipMemory } from './types'

const cache=new WeakMap<World['db'],KinshipDef[]>()
export function kinshipDefs(w:World){let rows=cache.get(w.db);if(!rows){rows=w.db.all<KinshipDef>('Kinship');cache.set(w.db,rows)}return rows}
export function undergroundKin(w:World,c:Creature){return kinshipDefs(w).find(d=>d.underground.includes(c.def))}
export function kinGroup(w:World,c:Creature){return `${w.s.overworld?.currentRegion??'local'}:${w.s.map.id}:${c.room!==undefined?`room${c.room}`:c.home?`home${c.home.x},${c.home.y}`:`person${c.id}`}`}
export function kinAwake(w:World,c:Creature){return c.alive&&!c.asleep&&!c.unconscious&&capacity(w,c,'consciousness')>=.5}
function memory(w:World,c:Creature,d:KinshipDef):KinshipMemory{
  if(c.kinship?.rule!==d.id)c.kinship={rule:d.id,group:kinGroup(w,c),contact:false,kills:[]}
  return c.kinship!
}
/** 공격자와 피해자 양쪽이 보여야 살해를 전한다. 시체만 보고 범인을 추측하지 않는다. */
export function witnessKinship(w:World,actor:Creature,victim:Creature,murder=false){
  if(!w.s.overworld||actor.id!==w.s.playerId&&!isCompanion(w,actor))return
  const d=undergroundKin(w,victim);if(!d)return
  const group=kinGroup(w,victim),key=`kill:${d.id}:${victim.id}`
  if(murder){
    const deaths=w.s.map.kinshipDeaths??=[];if(!deaths.some(x=>x.key===key))deaths.push({key,group,target:victim.id})
    const events=w.s.overworld.society?.events,index=events?.findIndex(e=>!e.applied&&e.kinKey===`peace:${d.id}:${group}`)
    if(events&&index!==undefined&&index>=0)events.splice(index,1)
  }
  for(const c of w.s.creatures){
    if(!d.underground.includes(c.def)||!kinAwake(w,c)||!canSee(w,c,actor.pos)||!canSee(w,c,victim.pos))continue
    const m=memory(w,c,d);m.contact=true;m.subject=rumorSubject(w,actor);m.regionId=w.s.overworld?.currentRegion
    if(murder&&!m.kills.some(k=>k.key===key))m.kills.push({key,target:victim.id,chief:d.chiefs.includes(victim.def),subject:rumorSubject(w,actor),regionId:w.s.overworld?.currentRegion})
  }
}
/** 평화 석방의 당사자가 깨어 있고 풀어 준 사람을 실제로 보았을 때만 귀환한다. */
export function rememberKinRelease(w:World,actor:Creature,target:Creature){
  const d=undergroundKin(w,target)
  if(!w.s.overworld||!d||actor.id!==w.s.playerId&&!isCompanion(w,actor)||!kinAwake(w,target)||!canSee(w,target,actor.pos))return false
  const m=memory(w,target,d);m.contact=true;m.subject=rumorSubject(w,actor);m.regionId=w.s.overworld?.currentRegion;m.returning=true;return true
}
export function noticeKinFlee(w:World,c:Creature,fromPlayer=false){
  const d=undergroundKin(w,c),p=player(w)
  if(!w.s.overworld||!d||c.ai.mode!=='flee'||!kinAwake(w,c)||!p.alive||!canSee(w,c,p.pos))return
  if(fromPlayer||c.attackedBy?.includes(p.id)||c.ai.target===p.id||c.body.wounds.some(x=>x.sourceId===p.id)){const m=memory(w,c,d);m.contact=true;m.subject=rumorSubject(w,p);m.regionId=w.s.overworld?.currentRegion}
}
export function kinshipTrust(w:World,c:Creature,value:number){const d=undergroundKin(w,c);return !!d&&value>=d.trust}
export function kinshipEntry(w:World,site:string){
  if(kinshipDefs(w).some(d=>d.sites.includes(site))){w.s.map.kinshipVisit=(w.s.map.kinshipVisit??0)+1;delete w.s.map.kinshipLightReported}
}
export function returningKin(c:Creature){return !!c.kinship?.returning&&c.alive&&!c.captivity}
