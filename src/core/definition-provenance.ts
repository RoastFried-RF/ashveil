import type { DefinitionSource, PatchOp } from './defs'

export interface DefinitionFieldSource extends DefinitionSource {
  kind:'definition'|'patch'
  definitionId:string
  sourcePath:string
  operation?:PatchOp
}
/** 값 없이 실제 배열·객체 연산과 함께 이동하는 출처 트리. */
export interface DefinitionOriginTree {
  source:DefinitionFieldSource
  children?:Record<string,DefinitionOriginTree>
}
export interface DefinitionFieldOrigin {path:string;source:DefinitionFieldSource}
export const pointerKey=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1')
export function definitionFieldValue(value:unknown,path:string):unknown {
  if(path==='')return value
  for(const key of path.slice(1).split('/').map(s=>s.replace(/~1/g,'/').replace(/~0/g,'~'))){
    if(value===null||typeof value!=='object'||!Object.hasOwn(value,key))return undefined
    value=(value as Record<string,unknown>)[key]
  }
  return value
}
export function originTree(value:unknown,source:DefinitionFieldSource):DefinitionOriginTree {
  const children=value!==null&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,originTree(entry,{...source,sourcePath:source.sourcePath+'/'+pointerKey(key)})])):undefined
  return{source:structuredClone(source),...(children?{children}:{})}
}
export function originFields(value:unknown,tree:DefinitionOriginTree,path=''):DefinitionFieldOrigin[]{
  if(value!==null&&typeof value==='object'&&Object.keys(value).length)return Object.entries(value).flatMap(([key,entry])=>{
    if(!path&&key==='_mod')return[]
    const child=tree.children?.[key]
    if(!child)throw Error('정의 출처 누락: '+path+'/'+pointerKey(key))
    return originFields(entry,child,path+'/'+pointerKey(key))
  })
  return[{path,source:structuredClone(tree.source)}]
}
