import type {DefDatabase} from './defs'
import type {GameState} from './types'
import {log,type World} from './ctx'
import {stateActors} from './missing-statuses'

const headers=new Set(['contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentChanges','log','knowledge','over'])
const scenes=(s:GameState)=>[s,...Object.values(s.overworld?.scenes??{})]
const actorLists=(s:GameState)=>scenes(s).flatMap(scene=>[scene.creatures,...Object.values(scene.offCreatures)])
const maps=(s:GameState)=>[...new Set(scenes(s).flatMap(scene=>[scene.map,...Object.values(scene.maps)]))]
const sources=(s:GameState)=>[...new Set(scenes(s).flatMap(scene=>scene.sources??[]))]
const scalarRefs=new Set(['target','owner','provider','patient','actor','person','leader','tenant','passenger','captor','employer'])
const arrayRefs=new Set(['members','party','crew','attackers','actors','targets'])
function purge(s:GameState,defs:ReadonlySet<string>){
 const ids=new Set<number>();let actors=0,residents=0,targets=0
 for(const list of actorLists(s))for(let i=list.length-1;i>=0;i--)if(defs.has(list[i].def)){ids.add(list[i].id);list.splice(i,1);actors++}
 for(const map of maps(s))for(const room of map.rooms)if(room.residents){const next=room.residents.filter(id=>!defs.has(id));residents+=room.residents.length-next.length;room.residents=next}
 for(const c of stateActors(s))if(c.ai.target!==undefined&&ids.has(c.ai.target)){delete c.ai.target;delete c.ai.lastSeen;delete c.ai.path;delete c.ai.dest;c.ai.mode='idle';targets++}
 if(s.autoIgnored)s.autoIgnored=s.autoIgnored.filter(id=>!ids.has(id))
 if(s.autoThreat!==undefined&&ids.has(s.autoThreat))delete s.autoThreat
 return{ids,actors,residents,targets}
}
/** 사라진 층 개체는 사망/전리품/경험치/공급원 차감 없이 명시 승인으로만 제거한다. */
export function missingCreaturePlan(s:GameState,db:DefDatabase){
 const removed=Object.entries(s.contentDefinitions??{}).filter(([id,type])=>type==='Creature'&&!db.has(id)).map(([id,type])=>({id,type})),defs=new Set(removed.map(row=>row.id)),errors:string[]=[]
 const empty={actors:0,residents:0,targets:0}
 if(!defs.size)return{removed,counts:empty,errors,preview:undefined as GameState|undefined}
 if(!s.loadHash||s.loadHash===db.loadHash)errors.push('개체 제거에는 기록된 서로 다른 구성의 승인이 필요하다')
 const all=stateActors(s),affected=all.filter(c=>defs.has(c.def)),affectedIds=new Set(affected.map(c=>c.id))
 if(affectedIds.has(s.playerId))errors.push('플레이어의 개체 정의는 제거할 수 없다')
 for(const c of affected)if(c.companion||c.captivity||c.abduction||c.leading||c.caravan||c.roadRaid||c.parasites?.length)errors.push('개체 '+c.id+': 동료/구금/운송/기생 관계를 먼저 복원해야 한다')
 const preview=structuredClone(s),counts=purge(preview,defs),history=new WeakSet<object>(),pastFields=new WeakMap<object,Set<string>>(),sourceRows=new WeakSet<object>(sources(preview))
 if(preview.scriptState?.errors)history.add(preview.scriptState.errors)
 for(const c of stateActors(preview)){
  pastFields.set(c,new Set(['lastAttacker','killedBy']))
  for(const rows of [c.history,c.npcCareHistory,c.npcPsyche?.history,c.npcTies,c.firstImpressions,c.prisonerSightings,c.bestiary])if(rows)history.add(rows)
  for(const wound of c.body.wounds)pastFields.set(wound,new Set(['source']))
  for(const scar of c.body.scars??[])pastFields.set(scar,new Set(['source']))
  for(const disease of c.diseases??[])pastFields.set(disease,new Set(['source']))
 }
 const seen=new WeakSet<object>(),visit=(value:unknown,path:string,opaque=false)=>{
  if(typeof value==='string'){if(defs.has(value))errors.push(path+': 사라진 개체 정의의 현재 참조를 먼저 복원해야 한다');return}
  if(typeof value==='number'){if(opaque&&affectedIds.has(value))errors.push(path+': 스크립트의 제거 대상 개체 참조를 먼저 복원해야 한다');return}
  if(!value||typeof value!=='object'||seen.has(value)||history.has(value))return;seen.add(value)
  for(const[key,entry]of Object.entries(value)){
   if(!path&&headers.has(key)||pastFields.get(value)?.has(key))continue
   if(sourceRows.has(value)&&['species','needsAlive','members'].includes(key))continue
   const next=path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1')
   if(defs.has(key))errors.push(next+': 사라진 개체 정의의 현재 키를 먼저 복원해야 한다')
   if(opaque&&/^[0-9]+$/.test(key)&&affectedIds.has(Number(key)))errors.push(next+': 스크립트의 제거 대상 개체 키를 먼저 복원해야 한다')
   if(typeof entry==='number'&&scalarRefs.has(key)&&affectedIds.has(entry)||Array.isArray(entry)&&arrayRefs.has(key)&&entry.some(id=>affectedIds.has(id)))errors.push(next+': 제거 대상 개체의 진행 중 관계를 먼저 복원해야 한다')
   visit(entry,next,opaque||!path&&key==='scriptState')
  }
 }
 visit(preview,'')
 return{removed,counts:{actors:counts.actors,residents:counts.residents,targets:counts.targets},errors,preview}
}
export function applyMissingCreatures(w:World):string|null{
 const plan=missingCreaturePlan(w.s,w.db);if(plan.errors.length)return plan.errors.join('\n');if(!plan.removed.length)return null
 const counts=purge(w.s,new Set(plan.removed.map(row=>row.id)))
 if(counts.actors||counts.residents||counts.targets)log(w,'info','콘텐츠 변경으로 사라진 생물을 층에서 제거했다',['개체 '+counts.actors+' · 방 배치 참조 '+counts.residents+' · AI 대상 '+counts.targets,'사망·전리품·경험치 없이 처리하며 공급원 인원과 과거 기록은 보존한다.'])
 return null
}
