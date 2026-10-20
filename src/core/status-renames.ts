import type{DefDatabase}from'./defs'
import type{GameState,BreakDef,TraumaDef}from'./types'
import{stateActors}from'./missing-statuses'
const kinds=new Set(['Wound','Disease','Thought','Trait','Break','Trauma'])
const headers=new Set(['contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentChanges','log','knowledge','over'])
function mutate(s:GameState,aliases:ReadonlyMap<string,string>,errors:string[]=[]){
 let records=0;const rename=(id:string,kind:string)=>{const to=aliases.get(id);if(to){if(s.contentDefinitions?.[id]!==kind){errors.push(id+': 상태 기록의 실제 종류가 '+kind+'와 다르다');return id}records++;return to}return id}
 for(const c of stateActors(s)){
  if(c.breakdown)c.breakdown.def=rename(c.breakdown.def,'Break')
  if(c.npcPsyche?.pending)c.npcPsyche.pending=rename(c.npcPsyche.pending,'Break')
  for(const x of c.traumas??[])x.def=rename(x.def,'Trauma')
  for(const x of c.body.wounds){x.def=rename(x.def,'Wound');for(const risk of x.diseaseRisk??[])risk.def=rename(risk.def,'Disease')}
  for(const x of c.diseases??[])x.def=rename(x.def,'Disease')
  for(const x of c.biteRisks??[])x.def=rename(x.def,'Disease')
  for(const x of c.thoughts)x.def=rename(x.def,'Thought')
  c.traits=c.traits.map(x=>rename(x,'Trait'))
  if(c.biteCarrier)c.biteCarrier=rename(c.biteCarrier,'Disease')
  if(c.immuneDiseases)c.immuneDiseases=c.immuneDiseases.map(x=>rename(x,'Disease'))
  if(c.diseaseExposure?.cold)c.diseaseExposure.cold=c.diseaseExposure.cold.map(x=>rename(x,'Disease'))
  if(c.diseaseExposure?.lying)c.diseaseExposure.lying=Object.fromEntries(Object.entries(c.diseaseExposure.lying).map(([id,turns])=>[rename(id,'Disease'),turns]))
 }
 return records
}
/** 같은 종류의 실제 상태와 현재 면역/노출 식별만 옮긴다. 과거 로그/원인은 고치지 않는다. */
export function statusRenamePlan(s:GameState,db:DefDatabase){
 const aliases=new Map<string,string>(),renamed:{from:string;to:string;type:string}[]=[],errors:string[]=[]
 for(const[from,to]of Object.entries(db.definitionRenames)){const type=s.contentDefinitions?.[from];if(!type||!kinds.has(type))continue;if(db.tryGet(to)?.defType!==type){errors.push(from+' → '+to+': 상태 ID 이행 목적지의 종류가 원래 기록과 다르다');continue}aliases.set(from,to);renamed.push({from,to,type})}
 if(!aliases.size)return{aliases,renamed,errors,records:0,preview:undefined as GameState|undefined}
 if(!s.loadHash||s.loadHash===db.loadHash)errors.push('상태 ID 이행은 기록된 서로 다른 콘텐츠 구성의 승인이 필요하다')
 for(const c of stateActors(s)){
  const target=c.breakdown&&aliases.get(c.breakdown.def);if(target&&db.get<BreakDef>(target).kind!==c.breakdown!.kind)errors.push('개체 '+c.id+': 진행 중 붕괴의 행동 종류가 ID 이행 목적지와 다르다')
  for(const t of c.traumas??[]){const to=aliases.get(t.def);if(to&&(db.get<TraumaDef>(to).kind==='species')!==!!t.target)errors.push('개체 '+c.id+': 공포 대상의 종류가 ID 이행 목적지와 다르다')}
 }
 const candidate=structuredClone(s),records=mutate(candidate,aliases,errors),history=new WeakMap<object,Set<string>>()
 for(const c of stateActors(candidate)){
  history.set(c,new Set(['npcCareHistory','history']));if(c.npcPsyche)history.set(c.npcPsyche,new Set(['history']));if(c.body.scars)history.set(c.body.scars,new Set(Object.keys(c.body.scars)))
  for(const x of c.diseases??[])history.set(x,new Set(['source']))
  const traumas=(c.traumas??[]).map(t=>JSON.stringify([t.def,t.target??null]));if(new Set(traumas).size!==traumas.length)errors.push('개체 '+c.id+': 공포 ID 이행 후 같은 대상의 공포가 중복된다')
  for(const list of [c.traits,c.thoughts.map(x=>x.def),(c.diseases??[]).map(x=>x.def),c.immuneDiseases??[],c.diseaseExposure?.cold??[]])if(new Set(list).size!==list.length)errors.push('개체 '+c.id+': 상태 ID 이행 후 중복된 특성/생각/질병/면역 기록을 별도로 합쳐야 한다')
 }
 // 사전 키 충돌로 노출 시간을 잃지 않도록 원래 키들까지 따로 검사한다.
 for(const c of stateActors(s)){const keys=Object.keys(c.diseaseExposure?.lying??{}).map(x=>aliases.get(x)??x);if(new Set(keys).size!==keys.length)errors.push('개체 '+c.id+': 상태 ID 이행 후 노출 시계 키가 충돌한다')}
 const seen=new WeakSet<object>(),visit=(v:unknown,path:string)=>{
  if(typeof v==='string'){if(aliases.has(v))errors.push(path+': 지원하지 않는 원래 상태 ID 참조의 이행이 필요하다');return}
  if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v)
  for(const[k,x]of Object.entries(v)){if(!path&&headers.has(k)||history.get(v)?.has(k))continue;const next=path+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1');if(aliases.has(k))errors.push(next+': 지원하지 않는 원래 상태 ID 키의 이행이 필요하다');visit(x,next)}
 };visit(candidate,'')
 return{aliases,renamed,errors,records,preview:candidate}
}
export function applyStatusRenames(s:GameState,db:DefDatabase):string|null{const plan=statusRenamePlan(s,db);if(plan.errors.length)return plan.errors.join('\n');if(plan.aliases.size)mutate(s,plan.aliases);return null}
