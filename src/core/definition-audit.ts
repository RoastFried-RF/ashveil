import type { DefinitionPatchAudit, DefinitionSnapshot } from './defs'
import { definitionDifferences } from './definition-differences'
import { definitionFieldValue } from './definition-provenance'

export interface DefinitionPatchWarning {kind:'different-replace'|'numeric-index'|'shadowed-in-child';message:string;patch:number;previous?:number;definitionId?:string}
const withoutMod=(value:Record<string,unknown>|undefined)=>{if(!value)return;const result=structuredClone(value);delete result._mod;return result}
export function definitionPatchAudit(snapshot:DefinitionSnapshot){
  const patches=(snapshot.audit??[]).map(p=>({modId:p.modId,file:p.file,entry:p.entry,operation:structuredClone(p.operation),status:p.status,reason:p.reason,changes:definitionDifferences(withoutMod(p.before),withoutMod(p.after))}))
  const warnings:DefinitionPatchWarning[]=[],lastReplace=new Map<string,number>()
  const same=(a:unknown,b:unknown)=>definitionDifferences(a,b).length===0
  const inherits=(id:string,parent:string)=>{const seen=new Set<string>();let current=id;while(Object.hasOwn(snapshot.raw,current)&&!seen.has(current)){seen.add(current);const next=snapshot.raw[current].parent;if(typeof next!=='string')return false;if(next===parent)return true;current=next}return false}
  const sameSource=(a:DefinitionPatchAudit,b:{modId:string;file?:string;entry:number})=>a.modId===b.modId&&a.file===b.file&&a.entry===b.entry
  for(const [i,p]of(snapshot.audit??[]).entries()){
    if(p.status!=='applied')continue
    const op=p.operation
    if(/\/(?:0|[1-9][0-9]*)(?:\/|$)/.test(op.path))warnings.push({kind:'numeric-index',patch:i,message:`${op.target}${op.path}: 숫자 인덱스형 경로는 앞선 배열 삽입·삭제의 영향을 받을 수 있다`})
    if(op.op!=='replace')continue
    const key=JSON.stringify([op.target,op.path]),previous=lastReplace.get(key)
    if(previous!==undefined&&!same(patches[previous].operation.value,op.value))warnings.push({kind:'different-replace',patch:i,previous,message:`${op.target}${op.path}: 같은 경로를 서로 다른 값으로 replace했다. 실제 로드 순서의 마지막 값이 적용된다`})
    lastReplace.set(key,i)
    if(!patches[i].changes.length||op.value!==null&&typeof op.value==='object'||/\/(?:\[|[0-9]+(?:\/|$)|-$)/.test(op.path))continue
    for(const id of Object.keys(snapshot.resolved)){
      if(id===op.target||!inherits(id,op.target))continue
      const field=snapshot.fields?.[id]?.find(f=>f.path===op.path)
      if(field&&field.source.kind==='patch'&&sameSource(p,field.source))continue
      // 원래 패치가 지정한 경로가 최종 자식에서는 다른 출처/삭제로 가려진 경우만 보고한다.
      if(field||definitionFieldValue(snapshot.resolved[id],op.path)===undefined)warnings.push({kind:'shadowed-in-child',patch:i,definitionId:id,message:`${op.target}${op.path}: ${id}의 최종 값은 이 부모 패치에서 오지 않는다`})
    }
  }
  return{patches,warnings,counts:{applied:patches.filter(p=>p.status==='applied').length,skipped:patches.filter(p=>p.status==='skipped').length,failed:patches.filter(p=>p.status==='failed').length}}
}
