import type{DefDatabase}from'./defs'
import type{BodyDef,CreatureDef,GameState}from'./types'
import{stateActors}from'./missing-statuses'
const headers=new Set(['contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentChanges','log','knowledge','over'])
function mutate(s:GameState,aliases:ReadonlyMap<string,string>){let bodies=0;for(const c of stateActors(s)){const to=aliases.get(c.body.def);if(to){c.body.def=to;bodies++}}return bodies}
/** 같은 부위 집합과 현재 개체 계약을 유지하는 몸 ID만 옮긴다. 몸을 다시 만들지 않는다. */
export function bodyRenamePlan(s:GameState,db:DefDatabase){
 const aliases=new Map<string,string>(),renamed:{from:string;to:string}[]=[],errors:string[]=[]
 for(const[from,to]of Object.entries(db.definitionRenames)){if(s.contentDefinitions?.[from]!=='Body')continue;if(db.tryGet(to)?.defType!=='Body'){errors.push(from+' → '+to+': 몸 ID 이행 목적지의 종류가 다르다');continue}aliases.set(from,to);renamed.push({from,to})}
 if(!aliases.size)return{aliases,renamed,errors,bodies:0,preview:undefined as GameState|undefined}
 if(!s.loadHash||s.loadHash===db.loadHash)errors.push('몸 ID 이행은 기록된 서로 다른 구성의 승인이 필요하다')
 for(const c of stateActors(s)){
  const to=aliases.get(c.body.def);if(!to)continue;const target=db.get<BodyDef>(to),parts=target.parts.map(p=>p.id),recorded=Object.keys(c.body.maxHp)
  if(parts.length!==recorded.length||parts.some(id=>!Object.hasOwn(c.body.maxHp,id)))errors.push('개체 '+c.id+': 원래 몸 부위 구성과 현재 정의가 달라 별도 해부학 이행이 필요하다')
  if(!!c.body.machine!==(target.kind==='mechanical'))errors.push('개체 '+c.id+': 원래 기계 상태와 현재 몸 종류가 달라 별도 변환이 필요하다')
  const creature=db.tryGet<CreatureDef>(db.definitionRenames[c.def]??c.def);if(creature?.defType!=='Creature'||creature.body!==to)errors.push('개체 '+c.id+': 현재 개체 정의가 ID 이행할 몸을 사용하지 않는다')
 }
 const preview=structuredClone(s),bodies=mutate(preview,aliases),history=new WeakMap<object,Set<string>>()
 for(const c of stateActors(preview)){history.set(c,new Set(['history','lastAttacker','killedBy']));if(c.npcPsyche)history.set(c.npcPsyche,new Set(['history']));for(const w of c.body.wounds)history.set(w,new Set(['source']));for(const scar of c.body.scars??[])history.set(scar,new Set(['source']));for(const d of c.diseases??[])history.set(d,new Set(['source']))}
 const seen=new WeakSet<object>(),visit=(v:unknown,path:string)=>{if(typeof v==='string'){if(aliases.has(v))errors.push(path+': 지원하지 않는 몸 ID 참조의 별도 이행이 필요하다');return}if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);for(const[k,x]of Object.entries(v)){if(!path&&headers.has(k)||history.get(v)?.has(k))continue;const next=path+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1');if(aliases.has(k))errors.push(next+': 지원하지 않는 몸 ID 키의 별도 이행이 필요하다');visit(x,next)}}
 visit(preview,'');return{aliases,renamed,errors,bodies,preview}
}
export function applyBodyRenames(s:GameState,db:DefDatabase):string|null{const plan=bodyRenamePlan(s,db);if(plan.errors.length)return plan.errors.join('\n');if(plan.aliases.size)mutate(s,plan.aliases);return null}
