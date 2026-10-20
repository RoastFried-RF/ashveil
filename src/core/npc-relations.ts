// 원래 대화 상대가 기억한 과거 관계만 전한다. 다른 사람의 현재 위치/생사/소지품을 조회하지 않는다.
import {capacity} from './body'
import {knownCreatureName} from './bestiary-state'
import {inBounds,player,turnOf,type World} from './ctx'
import {hostile} from './diplomacy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {diagonalBlocked} from './path'
import type {Creature,NpcRelationshipReport,NpcSocialDef,NpcSocialReportDef} from './types'
export const npcSocialReportDef=(w:World)=>w.db.get<NpcSocialReportDef>('NpcSocialReport.Hearth')
export function hearNpcRelationships(w:World,actor:Creature,source:Creature){
 if(actor!==player(w)||source===actor||!w.s.creatures.includes(source)||!w.s.creatures.includes(actor)||[actor,source].some(c=>!c.alive||c.asleep||c.unconscious||c.captivity||c.breakdown||c.activity||c.mapId!==undefined&&c.mapId!==w.s.map.id||capacity(w,c,'consciousness')<.5||capacity(w,c,'hearing')<.2||capacity(w,c,'sight')<.2))return
 if(cheb(actor.pos,source.pos)>1||!inBounds(w,actor.pos)||!inBounds(w,source.pos)||!hasLos(w,actor.pos,source.pos)||!canSee(w,actor,source.pos)||!canSee(w,source,actor.pos)||lightLevel(w,actor.pos)>=2||lightLevel(w,source.pos)>=2||diagonalBlocked(w,actor.pos,source.pos.x-actor.pos.x,source.pos.y-actor.pos.y)||hostile(w,actor,source)||actor.attackedBy?.includes(source.id)||source.attackedBy?.includes(actor.id))return
 const d=npcSocialReportDef(w),rules=w.db.get<NpcSocialDef>(d.sourceRules),now=turnOf(w)
 const people=Object.entries(source.npcTies??{}).flatMap(([id,t])=>{
  if(!t||typeof t!=='object')return[]
  const person=Number(id),last=Array.isArray(t.events)?t.events.at(-1):undefined
  if(!Number.isSafeInteger(person)||person<=0||person===actor.id||person===source.id||typeof t.name!=='string'||!t.name||!Number.isSafeInteger(t.score)||t.score<rules.min||t.score>rules.max||!Number.isSafeInteger(t.lastAt)||t.lastAt<0||t.lastAt>now||!last||last.at!==t.lastAt||!['talk','clash','care'].includes(last.kind))return[]
  return[{person,name:t.name,observedAt:t.lastAt,attitude:t.score>=d.positiveAt?'friendly' as const:t.score<=d.negativeAt?'strained' as const:'familiar' as const,lastKind:last.kind}]
 }).sort((a,b)=>b.observedAt-a.observedAt||a.person-b.person).slice(0,d.maxPeople)
 if(!people.length)return
 const report:NpcRelationshipReport={at:now,source:source.id,fromName:knownCreatureName(w,source),people}
 ;(w.s.knowledge.npcRelations??={})[source.id]=report
}
/** UI는 플레이어가 마지막 대화에서 들은 사본만 본다. */
export function heardNpcRelationships(w:World,id:number):NpcRelationshipReport|undefined{
 const report=w.s.knowledge.npcRelations?.[id];return report?{...report,people:report.people.map(p=>({...p}))}:undefined
}
