import {stateActors} from './missing-statuses'
import type{DefDatabase}from'./defs'
import type{GameState}from'./types'
import{stateItemEntries,validRecordedItemShape,validMissingItemRecord,restoreMissingItem,missingItemReferences}from'./missing-items'
const historical=new Set(['scriptState','contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentRecipeContracts','contentChanges','log','knowledge','over'])
function mutate(s:GameState,aliases:ReadonlyMap<string,string>){
 for(const c of stateActors(s))for(const x of c.foodExposureTraining??[]){x.rule.food=aliases.get(x.rule.food)??x.rule.food;if(x.rule.knowledgeBook)x.rule.knowledgeBook=aliases.get(x.rule.knowledgeBook)??x.rule.knowledgeBook}
 for(const{item}of stateItemEntries(s)){const target=aliases.get(item.missingItem?.def??item.def);if(!target)continue;if(item.missingItem)restoreMissingItem(item,target);else item.def=target}
 const seen=new WeakSet<object>(),walk=(value:unknown,root=false)=>{if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const[key,entry]of Object.entries(value)){if(root&&historical.has(key)||['missingItem','note','cropHarvest'].includes(key))continue;if(key==='def'&&typeof entry==='string'&&aliases.has(entry))(value as Record<string,unknown>)[key]=aliases.get(entry)!;else walk(entry)}}
 walk(s,true)
}
/** 실제 기록된 Item의 ID만 이행한다. 숫자/위치/시간/난수와 과거 보고서는 고치지 않는다. */
export function itemRenamePlan(s:GameState,db:DefDatabase){
 const aliases=new Map<string,string>(),errors:string[]=[],moves:number[]=[],renamed:{from:string;to:string}[]=[]
 if(!Object.keys(db.definitionRenames).length)return{aliases,errors,moves,renamed}
 const entries=stateItemEntries(s)
 for(const[from,to]of Object.entries(db.definitionRenames)){
  if(db.has(from))continue
  const stored=entries.filter(e=>e.item.missingItem?.def===from),oldType=s.contentDefinitions?.[from]??(stored.length?'Item':undefined)
  if(oldType===undefined)continue
  if(['Wound','Disease','Thought','Trait','Break','Trauma','PlaceEvent','Creature','Body','Recipe'].includes(oldType))continue
  if(oldType!=='Item'||db.tryGet(to)?.defType!=='Item'){errors.push(from+' → '+to+': 물품 외 종류의 ID 이행이 필요하다');continue}
  aliases.set(from,to);renamed.push({from,to})
 }
 for(const entry of entries){const item=entry.item,from=item.missingItem?.def??item.def,to=aliases.get(from);if(!to)continue
  if(!Number.isSafeInteger(item.uid)||item.uid<=0||!Number.isSafeInteger(item.count)||item.count<=0){errors.push(entry.path+': 물품 UID/개수 기록이 올바르지 않다');continue}
  if(item.missingItem&&!validMissingItemRecord(item)){errors.push(entry.path+': 원래 물품 보관 기록이 올바르지 않다');continue}
  const shape=item.missingItem??(s.contentItemShapes&&Object.hasOwn(s.contentItemShapes,from)?s.contentItemShapes[from]:undefined),target=db.item(to)
  if(!validRecordedItemShape(shape)){errors.push(entry.path+': ID 이행할 물품의 원래 칸 크기 기록이 없다');continue}
  if(shape.size[0]!==target.size[0]||shape.size[1]!==target.size[1]){errors.push(entry.path+': ID 이행 목적지의 칸 크기가 원래 기록과 다르다');continue}
  if(item.contents&&JSON.stringify(shape.storage)!==JSON.stringify(target.storage??target.pocket??target.quiver?.size)){errors.push(entry.path+': ID 이행 목적지의 내부 격자 크기가 원래 기록과 다르다');continue}
  if(/\/body\/prosthetics\//.test(entry.path)||entry.path.endsWith('/vessel/hull')){errors.push(entry.path+': 설치된 의수족/선체의 별도 ID 이행이 필요하다');continue}
  moves.push(item.uid)
 }
 // 임의의 플러그인 지속 데이터는 의미를 추정해서 고치지 않는다.
 const seen=new WeakSet<object>(),script=(value:unknown,path:string)=>{if(typeof value==='string'){if(aliases.has(value))errors.push(path+': 스크립트 상태의 별도 ID 이행이 필요하다');return}if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const[key,entry]of Object.entries(value)){if(aliases.has(key))errors.push(path+'/'+key+': 스크립트 상태의 별도 ID 이행이 필요하다');script(entry,path+'/'+key)}}
 if(aliases.size)script(s.scriptState,'/scriptState')
 if(aliases.size&&!errors.length){const preview=structuredClone(s);mutate(preview,aliases);errors.push(...missingItemReferences(preview,new Set(aliases.keys())).map(path=>path+': 지원하지 않는 원래 ID 참조의 이행이 필요하다'))}
 return{aliases,errors,moves,renamed}
}
/** 미리보기와 같은 검사를 전부 통과한 후보 사본에서만 원자적으로 이행한다. */
export function applyItemRenames(s:GameState,db:DefDatabase):string|null{const plan=itemRenamePlan(s,db);if(plan.errors.length)return plan.errors.join('\n');if(plan.aliases.size)mutate(s,plan.aliases);return null}
