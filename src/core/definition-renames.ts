import type{ModPackage}from'./defs'
import type{AnyDef}from'./types'
/** 실제 활성 패키지의 rename만 해석한다. 긴 사슬도 재귀 없이 검사한다. */
export function resolveDefinitionRenames(packages:readonly ModPackage[],definitions:readonly AnyDef[],errors:string[]):Record<string,string>{
 const raw=new Map<string,string>(),known=new Set(definitions.map(d=>d.id)),resolved=new Map<string,string>(),failed=new Set<string>()
 for(const p of packages){
  if(p.renames!==undefined&&(!p.renames||typeof p.renames!=='object'||Array.isArray(p.renames))){errors.push(p.manifest.id+': rename은 ID 문자열 사전이어야 한다');continue}
  for(const[from,to]of Object.entries(p.renames??{})){
   if(!from.trim()||typeof to!=='string'||!to.trim()||['__proto__','prototype','constructor'].includes(from)||['__proto__','prototype','constructor'].includes(to)){errors.push(p.manifest.id+': rename의 ID 형식이 올바르지 않다');continue}
   if(raw.has(from)&&raw.get(from)!==to){errors.push(from+': 서로 다른 rename 목적지가 충돌한다');continue}
   raw.set(from,to)
  }
 }
 for(const root of [...raw.keys()].sort()){
  if(resolved.has(root)||failed.has(root))continue
  const path:string[]=[],positions=new Map<string,number>();let current=root,target:string|undefined
  while(raw.has(current)&&!resolved.has(current)&&!failed.has(current)){
   if(known.has(current)){errors.push(current+': 현재 존재하는 정의 ID를 rename 원본으로 쓸 수 없다');failed.add(current);break}
   if(positions.has(current)){errors.push('rename 순환: '+[...path.slice(positions.get(current)),current].join(' → '));failed.add(current);break}
   positions.set(current,path.length);path.push(current);current=raw.get(current)!
  }
  if(resolved.has(current))target=resolved.get(current)
  else if(!failed.has(current)&&!raw.has(current)){if(known.has(current))target=current;else{errors.push(current+': rename 목적지 정의가 없다');failed.add(current)}}
  for(const id of path){if(target)resolved.set(id,target);else failed.add(id)}
 }
 return Object.fromEntries([...resolved].sort(([a],[b])=>a<b?-1:a>b?1:0))
}
