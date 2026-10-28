// 직접 식별한 포박 인물의 마지막 모습만 기억한다. 원격 현재 상태와 포박자의 비공개 정보는 읽지 않는다.
import {knownCreatureName} from './bestiary-state'
import {capacity} from './body'
import {effectiveFaction,isCompanion} from './companion-state'
import {turnOf,type World} from './ctx'
import {canSee,hasLos,lightLevel} from './fov'
import type {Creature,PrisonerSighting} from './types'
export function rememberVisiblePrisoners(w:World,p:Creature,visible:readonly number[]){
 if(p.id!==w.s.playerId||!w.s.creatures.includes(p)||!p.alive||p.mapId!==undefined&&p.mapId!==w.s.map.id||p.asleep||p.unconscious||capacity(w,p,'consciousness')<.5||capacity(w,p,'sight')<.2)return
 if(!w.s.creatures.some(c=>c.id!==p.id&&(c.captivity||w.s.knowledge.prisonerSightings?.[c.id])))return
 const cells=new Set(visible),now=turnOf(w),region=w.s.overworld?.currentRegion,regionLabel=w.s.overworld?.sites.find(s=>s.id===region)?.label
 for(const c of w.s.creatures){
  if(c.id===p.id||c.mapId!==undefined&&c.mapId!==w.s.map.id||!cells.has(c.pos.y*w.s.map.w+c.pos.x)||!hasLos(w,p.pos,c.pos)||!canSee(w,p,c.pos)||lightLevel(w,c.pos)>=2)continue
  const old=w.s.knowledge.prisonerSightings?.[c.id],cap=c.captivity;if(!cap&&!old)continue
  const own=cap&&(cap.captor===p.id||cap.faction===effectiveFaction(w,p)),state:PrisonerSighting['state']=!c.alive?'dead':cap?own?'held':'bound':'free'
  const lastCapture=cap?{ropeUid:cap.rope.uid,seenAt:old?.lastCapture?.ropeUid===cap.rope.uid&&['bound','held'].includes(old.state)?old.lastCapture.seenAt:now}:old?.lastCapture
  const knownFaction=c.met||c.residentSite||isCompanion(w,c)?c.faction:undefined
  const entry:PrisonerSighting={id:c.id,name:knownCreatureName(w,c),...(knownFaction?{faction:knownFaction}:{}),firstSeen:old?.firstSeen??now,at:now,...(region?{region,regionLabel}:{}),mapId:w.s.map.id,mapName:w.s.map.name,pos:{...c.pos},state,...(lastCapture?{lastCapture:{...lastCapture}}:{})}
  ;(w.s.knowledge.prisonerSightings??={})[c.id]=entry
 }
}
/** 조회 사본을 돌려줘 화면/경로 소비자가 마지막 목격 자체를 고치지 않게 한다. */
export function prisonerSightings(w:World):PrisonerSighting[]{
 return Object.values(w.s.knowledge.prisonerSightings??{}).map(r=>({...r,...(r.heard?{heard:{...r.heard}}:{}),pos:{...r.pos},...(r.lastCapture?{lastCapture:{...r.lastCapture}}:{})})).sort((a,b)=>b.at-a.at||a.id-b.id)
}
