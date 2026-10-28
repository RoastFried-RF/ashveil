import {definitionDifferences} from './definition-differences'
export {definitionDifferences,type DefinitionDifference} from './definition-differences'
// 실제 로더가 계산한 값만 읽는다. 월드/플레이어/코어 난수나 선택 모드 구성은 바꾸지 않는다.
import {definitionPatchAudit} from './definition-audit'
import {loadMods,type ModPackage,type DefinitionSnapshot,type DefinitionSource,type LoadReport} from './defs'
export interface DefinitionRow {id:string;defType:string;label:string;abstract:boolean;available:boolean;parent?:string;source?:DefinitionSource;lastMod?:string}
export interface DefinitionReference {id:string;path:string;abstract:boolean}
const lookup=(values:Record<string,Record<string,unknown>>,id:string)=>Object.hasOwn(values,id)?values[id]:undefined
const escape=(s:string)=>s.replace(/~/g,'~0').replace(/\//g,'~1')
function clean(value:Record<string,unknown>|undefined){if(!value)return;const out=structuredClone(value);delete out._mod;return out}
export class DefinitionInspector {
 private rows:DefinitionRow[]
 private reverse=new Map<string,DefinitionReference[]>()
 readonly audit:ReturnType<typeof definitionPatchAudit>
 readonly report:LoadReport
 readonly coreReport:LoadReport
 constructor(private snapshot:DefinitionSnapshot,private baseline:DefinitionSnapshot,available:Set<string>,report:LoadReport,coreReport:LoadReport,readonly loadHash:string){
  this.audit=definitionPatchAudit(snapshot)
  this.report=structuredClone(report);this.coreReport=structuredClone(coreReport)
  this.rows=Object.keys(snapshot.raw).sort().map(id=>{const d=lookup(snapshot.resolved,id)??snapshot.raw[id],parent=snapshot.raw[id].parent;return{id,defType:typeof d.defType==='string'?d.defType:'',label:typeof d.label==='string'?d.label:id,abstract:d.abstract===true,available:available.has(id),...(typeof parent==='string'?{parent}:{}),source:snapshot.sources[id],lastMod:typeof d._mod==='string'?d._mod:undefined}})
  const ids=new Set(this.rows.map(r=>r.id))
  for(const row of this.rows){const value=clean(lookup(snapshot.resolved,row.id));if(!value)continue;const ancestors=new Set<object>();const scan=(v:unknown,path:string,depth=0)=>{if(depth>64)return;if(typeof v==='string'){if(path!=='/id'&&ids.has(v)){const refs=this.reverse.get(v)??[];refs.push({id:row.id,path,abstract:row.abstract});this.reverse.set(v,refs)}return}if(!v||typeof v!=='object'||ancestors.has(v))return;ancestors.add(v);for(const[key,entry]of Object.entries(v))scan(entry,path+'/'+escape(key),depth+1);ancestors.delete(v)};scan(value,'')}
 }
 get types(){return[...new Set(this.rows.map(r=>r.defType))].sort()}
 query(options:{text?:string;defType?:string;includeAbstract?:boolean}={}){const text=(options.text??'').trim().toLowerCase();return this.rows.filter(r=>(options.includeAbstract||!r.abstract)&&(!options.defType||r.defType===options.defType)&&(!text||r.id.toLowerCase().includes(text)||r.label.toLowerCase().includes(text))).map(r=>structuredClone(r))}
 detail(id:string){
  if(!Object.hasOwn(this.snapshot.raw,id))return
  const ancestors:string[]=[],seen=new Set<string>();let current:string|undefined=id
  while(current&&Object.hasOwn(this.snapshot.raw,current)&&!seen.has(current)){seen.add(current);ancestors.push(current);const parent:unknown=this.snapshot.raw[current].parent;current=typeof parent==='string'?parent:undefined}
  const raw=clean(this.snapshot.raw[id])!,resolved=clean(lookup(this.snapshot.resolved,id)),core=clean(lookup(this.baseline.resolved,id)),row=structuredClone(this.rows.find(r=>r.id===id)!)
  return{row,raw,resolved,core,lineage:ancestors.reverse(),children:this.rows.filter(r=>r.parent===id).map(r=>structuredClone(r)),patches:structuredClone(this.snapshot.patches.filter(p=>seen.has(p.operation.target))),references:structuredClone(this.reverse.get(id)??[]),differences:definitionDifferences(core,resolved),fields:structuredClone(this.snapshot.fields?.[id]??[])}
 }
}
export function inspectDefinitions(packages:ModPackage[],enabled:string[]){
 let current:DefinitionSnapshot|undefined,core:DefinitionSnapshot|undefined
 const selected=loadMods(packages,enabled,{audit:true,provenance:true,capture:s=>{current=s}}),baseline=loadMods(packages,[],{capture:s=>{core=s}})
 if(!current||!core)throw Error('정의 조회 원본을 구성할 수 없다')
 return new DefinitionInspector(current,core,new Set(Object.keys(current.resolved).filter(id=>selected.db.has(id))),selected.report,baseline.report,selected.db.loadHash)
}
