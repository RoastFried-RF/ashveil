import type{DefDatabase}from'./defs'
import type{Creature,GameState}from'./types'
import{log,type World}from'./ctx'

const kinds=new Set(['Wound','Disease','Thought','Trait','Break','Trauma'])
const headers=new Set(['contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentRecipeContracts','contentChanges','log','knowledge','over'])
const pointer=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1')
/** 저장된 실제 몸/배낭/정신 구조를 갖춘 개체만 대상으로 한다. */
export function stateActors(s:GameState){
 const found:Creature[]=[],seen=new WeakSet<object>()
 const visit=(v:unknown,root=false)=>{if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);const c=v as Creature
  if(Number.isSafeInteger(c.id)&&typeof c.def==='string'&&typeof c.alive==='boolean'&&Array.isArray(c.body?.wounds)&&Array.isArray(c.bag)&&c.equip&&Array.isArray(c.traits)&&Array.isArray(c.thoughts)&&c.needs){found.push(c);return}
  for(const[k,x]of Object.entries(v)){if(root&&(headers.has(k)||k==='scriptState'))continue;visit(x)}
 };visit(s,true);return found
}
function purge(s:GameState,ids:Set<string>){
 const counts={wounds:0,diseases:0,thoughts:0,traits:0,risks:0,carriers:0,breakdowns:0,traumas:0,pendingBreakdowns:0,crying:0}
 const matches=(id:string,kind:string)=>ids.has(id)&&s.contentDefinitions?.[id]===kind
 for(const c of stateActors(s)){
  if(c.breakdown&&matches(c.breakdown.def,'Break')){if(c.breakdown.kind==='cry'){const effects=c.effects.filter(x=>x.kind!=='crying');counts.crying+=c.effects.length-effects.length;c.effects=effects}delete c.breakdown;counts.breakdowns++}
  if(c.traumas){const next=c.traumas.filter(x=>!matches(x.def,'Trauma'));counts.traumas+=c.traumas.length-next.length;c.traumas=next}
  if(c.npcPsyche?.pending&&matches(c.npcPsyche.pending,'Break')){delete c.npcPsyche.pending;counts.pendingBreakdowns++}
  const wounds=c.body.wounds.filter(x=>!matches(x.def,'Wound'));counts.wounds+=c.body.wounds.length-wounds.length;c.body.wounds=wounds
  const thoughts=c.thoughts.filter(x=>!matches(x.def,'Thought'));counts.thoughts+=c.thoughts.length-thoughts.length;c.thoughts=thoughts
  const traits=c.traits.filter(x=>!matches(x,'Trait'));counts.traits+=c.traits.length-traits.length;c.traits=traits
  if(c.diseases){const next=c.diseases.filter(x=>!matches(x.def,'Disease'));counts.diseases+=c.diseases.length-next.length;c.diseases=next}
  if(c.biteRisks){const next=c.biteRisks.filter(x=>!matches(x.def,'Disease'));counts.risks+=c.biteRisks.length-next.length;c.biteRisks=next}
  for(const wound of wounds)if(wound.diseaseRisk){const next=wound.diseaseRisk.filter(x=>!matches(x.def,'Disease'));counts.risks+=wound.diseaseRisk.length-next.length;wound.diseaseRisk=next}
  if(c.biteCarrier&&matches(c.biteCarrier,'Disease')){delete c.biteCarrier;counts.carriers++}
 }
 return counts
}
/** 승인 전 사본으로 모든 참조를 검사하고 과거 진료/면역 기록은 보존한다. */
export function missingStatusPlan(s:GameState,db:DefDatabase){
 const removed=Object.entries(s.contentDefinitions??{}).filter(([id,kind])=>kinds.has(kind)&&!db.has(id)).map(([id,type])=>({id,type})),ids=new Set(removed.map(x=>x.id)),errors:string[]=[]
 const empty={wounds:0,diseases:0,thoughts:0,traits:0,risks:0,carriers:0,breakdowns:0,traumas:0,pendingBreakdowns:0,crying:0}
 if(!ids.size)return{removed,counts:empty,errors,preview:undefined as GameState|undefined}
 if(!s.loadHash||s.loadHash===db.loadHash)errors.push('없어진 상태를 제거하려면 기록된 서로 다른 콘텐츠 구성의 승인이 필요하다')
 const all=stateActors(s),woundIds=new Set(all.flatMap(c=>c.body.wounds.filter(x=>ids.has(x.def)).flatMap(x=>[x.id,...x.mergedIds??[]])))
 for(const c of all){
  if(c.activity?.woundId!==undefined&&woundIds.has(c.activity.woundId)||c.activity?.npcCare&&woundIds.has(c.activity.npcCare.woundId)||c.body.pressing!==undefined&&woundIds.has(c.body.pressing)||c.body.brainRecovery?.some(x=>woundIds.has(x.wound))||Object.values(c.frostbite??{}).some(x=>x.wound!==undefined&&woundIds.has(x.wound))||c.biteRisks?.some(x=>!ids.has(x.def)&&woundIds.has(x.wound)))errors.push('개체 '+c.id+': 없어진 상처를 참조하는 진행 중 치료/몸 상태를 먼저 복원해야 한다')
 }
 const candidate=structuredClone(s),counts=purge(candidate,ids),historical=new WeakMap<object,Set<string>>()
 for(const c of stateActors(candidate)){
  historical.set(c,new Set(['immuneDiseases','diseaseExposure','npcCareHistory','history']))
  if(c.npcPsyche)historical.set(c.npcPsyche,new Set(['history']))
  if(c.body.scars)historical.set(c.body.scars,new Set(Object.keys(c.body.scars)))
  for(const d of c.diseases??[])historical.set(d,new Set(['source']))
 }
 const seen=new WeakSet<object>(),visit=(v:unknown,path:string)=>{
  if(typeof v==='string'){if(ids.has(v))errors.push(path+': 없어진 상태의 지원하지 않는 참조를 복원해야 한다');return}
  if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v)
  for(const[k,x]of Object.entries(v)){if(!path&&headers.has(k)||historical.get(v)?.has(k))continue;const next=path+'/'+pointer(k);if(ids.has(k))errors.push(next+': 없어진 상태를 키로 쓰는 참조를 복원해야 한다');visit(x,next)}
 };visit(candidate,'')
 return{removed,counts,errors,preview:candidate}
}
/** 승인된 후보만 변경한다. 전 검사가 성공하기 전에는 원본을 건드리지 않는다. */
export function applyMissingStatuses(w:World):string|null{
 const plan=missingStatusPlan(w.s,w.db);if(plan.errors.length)return plan.errors.join('\n');if(!plan.removed.length)return null
 const counts=purge(w.s,new Set(plan.removed.map(x=>x.id)))
 if(Object.values(counts).some(Boolean))log(w,'info','콘텐츠 변경으로 없어진 상처·상태 기록을 제거했다',[
  '정신붕괴 '+counts.breakdowns+' · 공포 '+counts.traumas+' · 붕괴 대기 '+counts.pendingBreakdowns+' · 동반 울음 '+counts.crying,
  '상처 '+counts.wounds+' · 질병 '+counts.diseases+' · 생각 '+counts.thoughts+' · 특성 '+counts.traits+' · 감염 위험 '+counts.risks+' · 보균 표시 '+counts.carriers,
  '현재 상처 피해와 상태 효과는 사라진다. 혈액·영구 손상·과거 기록은 보존한다.',
  '붕괴·공포 제거는 자연 회복/극복 보상을 주지 않는다.',
 ])
 return null
}
