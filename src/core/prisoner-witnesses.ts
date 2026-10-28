// NPC의 실제 목격은 개인 기억에만 남고, 곁의 실제 대화에서 과거 사본만 전한다.
import {bodyDef,capacity} from './body'
import {effectiveFaction} from './companion-state'
import {log,player,turnOf,type World} from './ctx'
import {hostile} from './diplomacy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {knownCreatureName} from './bestiary-state'
import type {Creature,PrisonerSighting} from './types'
const copy=(r:PrisonerSighting):PrisonerSighting=>({...r,pos:{...r.pos},...(r.lastCapture?{lastCapture:{...r.lastCapture}}:{}),...(r.heard?{heard:{...r.heard}}:{})})
function awake(w:World,c:Creature){return c.alive&&!c.asleep&&!c.unconscious&&capacity(w,c,'consciousness')>=.5&&capacity(w,c,'sight')>=.2&&w.s.creatures.includes(c)&&(c.mapId===undefined||c.mapId===w.s.map.id)}
export function observeNpcPrisoners(w:World,observer:Creature){
 if(observer===player(w)||!awake(w,observer)||bodyDef(w,observer).kind!=='humanoid'||!w.s.creatures.some(c=>c!==observer&&(c.captivity||observer.prisonerSightings?.[c.id])))return
 const now=turnOf(w),region=w.s.overworld?.currentRegion,regionLabel=w.s.overworld?.sites.find(s=>s.id===region)?.label
 for(const c of w.s.creatures){
  const old=observer.prisonerSightings?.[c.id],cap=c.captivity
  if(c===observer||!cap&&!old||c.mapId!==undefined&&c.mapId!==w.s.map.id||!hasLos(w,observer.pos,c.pos)||!canSee(w,observer,c.pos)||lightLevel(w,c.pos)>=2)continue
  const state:PrisonerSighting['state']=!c.alive?'dead':cap?cap.faction===effectiveFaction(w,observer)||cap.captor===observer.id?'held':'bound':'free'
  const lastCapture=cap?{ropeUid:cap.rope.uid,seenAt:old?.lastCapture?.ropeUid===cap.rope.uid&&['bound','held'].includes(old.state)?old.lastCapture.seenAt:now}:old?.lastCapture
  const faction=c.residentSite||c.faction===observer.faction?c.faction:undefined
  ;(observer.prisonerSightings??={})[c.id]={id:c.id,name:w.db.creature(c.def).label,...(faction?{faction}:{}),firstSeen:old?.firstSeen??now,at:now,...(region?{region,regionLabel}:{}),mapId:w.s.map.id,mapName:w.s.map.name,pos:{...c.pos},state,...(lastCapture?{lastCapture:{...lastCapture}}:{})}
 }
}
function sharePrisonerSightings(w:World,c:Creature,speaker:Creature,interrogation=false):number{
 if(c!==player(w)||speaker===c||!awake(w,c)||!awake(w,speaker)||!interrogation&&hostile(w,c,speaker)||c.captivity||!interrogation&&speaker.captivity||cheb(c.pos,speaker.pos)>1||!hasLos(w,c.pos,speaker.pos)||!canSee(w,c,speaker.pos)||!canSee(w,speaker,c.pos)||capacity(w,c,'hearing')<.2||capacity(w,speaker,'hearing')<.2)return 0
 const now=turnOf(w);let count=0
 for(const original of Object.values(speaker.prisonerSightings??{})){
  if(original.heard||original.at>now)continue
  const old=w.s.knowledge.prisonerSightings?.[original.id];if(old&&old.at>=original.at)continue
  const entry=copy(original);if(entry.state==='held')entry.state='bound'
  entry.name=old?.name??entry.name;if(!entry.faction&&old?.faction)entry.faction=old.faction
  entry.firstSeen=old?.firstSeen??entry.firstSeen;entry.heard={at:now,fromId:speaker.id,fromName:knownCreatureName(w,speaker),...(interrogation?{kind:'interrogation' as const}:{})}
  ;(w.s.knowledge.prisonerSightings??={})[entry.id]=entry;count++
 }
 if(count)log(w,'info',`${knownCreatureName(w,speaker)}에게 ${interrogation?'실제 심문을 마치고 ':''}포로에 대한 마지막 목격 ${count}건을 전해 들었다. 그 뒤의 실제 상태는 직접 확인해야 한다.`)
 return count
}
export function hearPrisonerSightings(w:World,c:Creature,speaker:Creature):number{return sharePrisonerSightings(w,c,speaker)}
export function hasNewCaptiveSightings(w:World,c:Creature,speaker:Creature):boolean{
 return c===player(w)&&w.s.creatures.includes(c)&&w.s.creatures.includes(speaker)&&[c,speaker].every(p=>p.mapId===undefined||p.mapId===w.s.map.id)&&speaker.captivity?.faction===effectiveFaction(w,c)&&Object.values(speaker.prisonerSightings??{}).some(r=>!r.heard&&r.at<=turnOf(w)&&(!w.s.knowledge.prisonerSightings?.[r.id]||w.s.knowledge.prisonerSightings[r.id]!.at<r.at))
}
export function hearCaptiveSightings(w:World,c:Creature,speaker:Creature):number{
 const act=c.activity;if(!hasNewCaptiveSightings(w,c,speaker)||act?.kind!=='prisoner'||act.prisonerOperation!=='interrogate'||act.prisonerId!==speaker.id||act.remaining>0)return 0
 return sharePrisonerSightings(w,c,speaker,true)
}
