import type{DefDatabase}from'./defs'
import type{BestiaryRecord,CreatureDef,GameState}from'./types'
import{stateActors}from'./missing-statuses'
const headers=new Set(['contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentRecipeContracts','contentChanges','log','knowledge','over'])
const maps=(s:GameState)=>[...new Set([s.map,...Object.values(s.maps),...Object.values(s.overworld?.scenes??{}).flatMap(x=>[x.map,...Object.values(x.maps)])])]
const sources=(s:GameState)=>[...new Set([...(s.sources??[]),...Object.values(s.overworld?.scenes??{}).flatMap(x=>x.sources??[])])]
function mutate(s:GameState,aliases:ReadonlyMap<string,string>,errors:string[]=[]){
 const counts={actors:0,population:0,residents:0,fear:0,carry:0,knowledge:0,specimens:0},actors=stateActors(s)
 const moveKeys=<T>(records:Record<string,T>,kind:'carry'|'knowledge')=>{for(const[from,value]of Object.entries(records)){const to=aliases.get(from);if(!to)continue;if(Object.hasOwn(records,to)){errors.push(from+' → '+to+': '+(kind==='knowledge'?'생물 지식':'수확 나머지')+' 기록이 겹쳐 별도 병합이 필요하다');continue}delete records[from];records[to]=value;counts[kind]++}}
 const records=new Set<Record<string,BestiaryRecord>>([s.knowledge.bestiary,...actors.flatMap(c=>c.bestiary?[c.bestiary]:[])])
 for(const c of actors){
  const to=aliases.get(c.def);if(to){c.def=to;counts.actors++}
  for(const t of c.traumas??[]){const target=t.target&&aliases.get(t.target);if(target){t.target=target;counts.fear++}}
  if(c.fearlessAgainst)c.fearlessAgainst=c.fearlessAgainst.map(id=>{const to=aliases.get(id);if(to)counts.fear++;return to??id})
  if(c.meatYieldCarry)moveKeys(c.meatYieldCarry,'carry')
 }
 for(const source of sources(s)){const species=aliases.get(source.species),needed=source.needsAlive&&aliases.get(source.needsAlive);if(species){source.species=species;counts.population++}if(needed){source.needsAlive=needed;counts.population++}}
 for(const map of maps(s))for(const room of map.rooms)if(room.residents)room.residents=room.residents.map(id=>{const to=aliases.get(id);if(to)counts.residents++;return to??id})
 for(const rows of records){moveKeys(rows,'knowledge');for(const row of Object.values(rows)){const to=row.specimen&&aliases.get(row.specimen.def);if(to){row.specimen!.def=to;counts.specimens++}}}
 return counts
}
/** 현재 몸과 실제 인물 번호를 유지하며, 현재 종별 지식/배치 참조만 함께 옮긴다. */
export function creatureRenamePlan(s:GameState,db:DefDatabase){
 const aliases=new Map<string,string>(),renamed:{from:string;to:string}[]=[],errors:string[]=[]
 for(const[from,to]of Object.entries(db.definitionRenames)){if(s.contentDefinitions?.[from]!=='Creature')continue;if(db.tryGet(to)?.defType!=='Creature'){errors.push(from+' → '+to+': 개체 ID 이행 목적지의 종류가 다르다');continue}aliases.set(from,to);renamed.push({from,to})}
 const empty={actors:0,population:0,residents:0,fear:0,carry:0,knowledge:0,specimens:0}
 if(!aliases.size)return{aliases,renamed,errors,counts:empty,preview:undefined as GameState|undefined}
 if(!s.loadHash||s.loadHash===db.loadHash)errors.push('개체 ID 이행은 기록된 서로 다른 구성의 승인이 필요하다')
 for(const c of stateActors(s)){const to=aliases.get(c.def);if(!to)continue;const target=db.get<CreatureDef>(to);if(target.body!==c.body.def){errors.push('개체 '+c.id+': 원래 몸과 목적지 개체의 몸 종류가 달라 별도 해부학 이행이 필요하다');continue}const parts=db.body(target.body).parts.map(p=>p.id),recorded=Object.keys(c.body.maxHp);if(parts.length!==recorded.length||parts.some(id=>!Object.hasOwn(c.body.maxHp,id)))errors.push('개체 '+c.id+': 원래 몸 부위 기록과 현재 해부학이 달라 별도 이행이 필요하다')}
 const preview=structuredClone(s),counts=mutate(preview,aliases,errors),history=new WeakMap<object,Set<string>>()
 for(const c of stateActors(preview)){
  history.set(c,new Set(['history','lastAttacker','killedBy']));if(c.npcPsyche)history.set(c.npcPsyche,new Set(['history']))
  for(const w of c.body.wounds)history.set(w,new Set(['source']))
  for(const scar of c.body.scars??[])history.set(scar,new Set(['source']))
  for(const d of c.diseases??[])history.set(d,new Set(['source']))
  for(const row of Object.values(c.bestiary??{}))history.set(row,new Set(['literature']))
  if(c.fearlessAgainst&&new Set(c.fearlessAgainst).size!==c.fearlessAgainst.length)errors.push('개체 '+c.id+': 같은 공포 극복 대상이 겹쳐 별도 이행이 필요하다')
  const fears=(c.traumas??[]).map(t=>JSON.stringify([t.def,t.target??null]));if(new Set(fears).size!==fears.length)errors.push('개체 '+c.id+': 같은 대상의 공포가 겹쳐 별도 이행이 필요하다')
 }
 const seen=new WeakSet<object>(),visit=(v:unknown,path:string)=>{if(typeof v==='string'){if(aliases.has(v))errors.push(path+': 지원하지 않는 개체 ID 참조를 별도로 이행해야 한다');return}if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);for(const[k,x]of Object.entries(v)){if(!path&&headers.has(k)||history.get(v)?.has(k))continue;const next=path+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1');if(aliases.has(k))errors.push(next+': 지원하지 않는 개체 ID 키를 별도로 이행해야 한다');visit(x,next)}}
 visit(preview,'');return{aliases,renamed,errors,counts,preview}
}
export function applyCreatureRenames(s:GameState,db:DefDatabase):string|null{const plan=creatureRenamePlan(s,db);if(plan.errors.length)return plan.errors.join('\n');if(plan.aliases.size)mutate(s,plan.aliases);return null}
