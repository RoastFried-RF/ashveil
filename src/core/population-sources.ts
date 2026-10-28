// 명시적으로 배치한 원래 인원의 ID를 센다. 구형 각인의 없는 명단은 추정하지 않는다.
import {isCompanion} from './companion-state'
import {turnOf,TURNS_PER_DAY} from './ctx'
import type {World} from './ctx'
import type {Creature,PopSource,WorldSite} from './types'

export function sourceContains(w:World,source:PopSource,c:Creature){
  if(!sourceDefinitionsAvailable(w,source))return false
  return source.members!==undefined?source.members.includes(c.id):c.faction===(source.faction??w.db.creature(source.species).faction)
}

/** 제거한 모드의 공급원 장부는 보존하되 없는 종을 배치/사망으로 정산하지 않는다. */
export function sourceDefinitionsAvailable(w:World,source:PopSource){return w.db.tryGet(source.species)?.defType==='Creature'&&(!source.needsAlive||w.db.tryGet(source.needsAlive)?.defType==='Creature')}

/** 처음 실체화한 현지 인원만 등록한다. 재방문/구형 각인의 현재 인원으로 과거 명단을 만들지 않는다. */
export function registerResidentSource(w:World,site:WorldSite,people:readonly Creature[]){
  if(w.s.overworld?.currentRegion!==site.id||site.kind!=='settlement'||!site.faction)return
  const id='residents:'+site.id
  if(w.s.sources?.some(source=>source.id===id))return
  const members=[...new Map(people.filter(c=>w.s.creatures.includes(c)&&c.alive&&c.id!==w.s.playerId&&!isCompanion(w,c)&&c.faction===site.faction&&(c.mapId===undefined||c.mapId===w.s.map.id)).map(c=>[c.id,c])).values()]
  if(!members.length)return
  const source:PopSource={id,label:site.label+'의 현지 배치 인원',species:members[0].def,faction:site.faction,kind:'residents',members:members.map(c=>c.id),count:members.length,cap:members.length,regenDays:Number.MAX_SAFE_INTEGER,floors:[w.s.map.id],lastRegenDay:Math.floor(turnOf(w)/TURNS_PER_DAY),deployed:true}
  ;(w.s.sources??=[]).push(source)
}
export function sourceLivingCount(w:World,source:PopSource,people:readonly Creature[]){
  if(!sourceDefinitionsAvailable(w,source))return source.count
  if(source.members===undefined)return people.filter(c=>c.alive&&!isCompanion(w,c)&&sourceContains(w,source,c)).length
  return new Set(people.filter(c=>c.alive&&!isCompanion(w,c)&&sourceContains(w,source,c)).map(c=>c.id)).size
}
