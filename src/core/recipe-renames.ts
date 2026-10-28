import type {DefDatabase} from './defs'
import {stateActors} from './missing-statuses'
import {recipeContract} from './recipe-contract'
import type {GameState,RecipeDef} from './types'
const headers=new Set(['contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentRecipeContracts','contentChanges','log','knowledge','over'])
const maps=(s:GameState)=>[...new Set([s.map,...Object.values(s.maps),...Object.values(s.overworld?.scenes??{}).flatMap(scene=>[scene.map,...Object.values(scene.maps)])])]
function mutate(s:GameState,aliases:ReadonlyMap<string,string>,db:DefDatabase,errors:string[]){
 const counts={known:0,jobs:0,batches:0,orders:0,queued:0},history=new WeakMap<object,Set<string>>()
 const active=(id:string,path:string)=>{const to=aliases.get(id);if(!to)return id
  const old=s.contentRecipeContracts?.[id],current=recipeContract(db.get<RecipeDef>(to))
  if(!old)errors.push(path+': 착수한 제작법의 원래 규칙 기록이 없다')
  else if(old!==current)errors.push(path+': 착수한 제작법의 재료·출력·노동·가공 규칙이 달라 별도 이행이 필요하다')
  return to
 }
 for(const c of stateActors(s)){
  history.set(c,new Set(['history','npcCareHistory']))
  if(c.recipes){const next=c.recipes.map(id=>{const to=aliases.get(id);if(to)counts.known++;return to??id});if(new Set(next).size!==next.length)errors.push('개체 '+c.id+': 배운 제작법의 목적지가 겹쳐 별도 병합이 필요하다');c.recipes=next}
  if(c.workJob?.recipe&&aliases.has(c.workJob.recipe)){c.workJob.recipe=active(c.workJob.recipe,'개체 '+c.id+'/workJob');counts.jobs++}
 }
 for(const map of maps(s)){
  for(const batch of map.batches??[])if(aliases.has(batch.recipe)){batch.recipe=active(batch.recipe,'지도 '+map.id+'/batches/'+batch.id);counts.batches++}
  for(const task of Object.values(map.baseCamp?.tasks??{}))if(task.recipe&&aliases.has(task.recipe)){task.recipe=aliases.get(task.recipe)!;counts.orders++}
  for(const queue of Object.values(map.baseCamp?.queues??{}))for(const task of queue)if(task.recipe&&aliases.has(task.recipe)){task.recipe=aliases.get(task.recipe)!;counts.queued++}
 }
 // Plugin persistent state and unknown live references need an explicit owner-specific migration.
 const seen=new WeakSet<object>(),visit=(value:unknown,path:string)=>{
  if(typeof value==='string'){if(aliases.has(value))errors.push(path+': 지원하지 않는 제작법 ID 참조의 별도 이행이 필요하다');return}
  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value)
  for(const[key,entry]of Object.entries(value)){if(!path&&headers.has(key)||history.get(value)?.has(key))continue;const next=path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1');if(aliases.has(key))errors.push(next+': 제작법 ID 키의 별도 이행이 필요하다');visit(entry,next)}
 };visit(s,'');return counts
}
/** Read-only plan; only known typed recipe references move, never quantities or work progress. */
export function recipeRenamePlan(s:GameState,db:DefDatabase){
 const aliases=new Map<string,string>(),renamed:{from:string;to:string}[]=[],errors:string[]=[]
 for(const[from,to]of Object.entries(db.definitionRenames)){
  if(s.contentDefinitions?.[from]!=='Recipe')continue
  if(db.tryGet(to)?.defType!=='Recipe'){errors.push(from+' → '+to+': 제작법 ID 목적지의 종류가 다르다');continue}
  aliases.set(from,to);renamed.push({from,to})
 }
 if(!aliases.size)return{aliases,renamed,errors,counts:{known:0,jobs:0,batches:0,orders:0,queued:0},preview:undefined as GameState|undefined}
 if(!s.loadHash||s.loadHash===db.loadHash)errors.push('제작법 ID 이행은 기록된 서로 다른 구성의 승인이 필요하다')
 const preview=structuredClone(s),counts=mutate(preview,aliases,db,errors)
 return{aliases,renamed,errors,counts,preview}
}
/** The caller owns the candidate. A rejected plan leaves even that candidate untouched. */
export function applyRecipeRenames(s:GameState,db:DefDatabase):string|null{
 const plan=recipeRenamePlan(s,db);if(plan.errors.length)return plan.errors.join('\n')
 if(plan.aliases.size)mutate(s,plan.aliases,db,[])
 return null
}
