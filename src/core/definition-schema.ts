import sourceSchema from '../../docs/schema/defs.schema.json'
import {pointerKey} from './definition-provenance'

type Schema=boolean|Record<string,unknown>
export interface DefinitionSchemaIssue {path:string;keyword:string;message:string}
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const same=(a:unknown,b:unknown):boolean=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]))||object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]))
const keywords=new Set(['$schema','$id','$defs','$ref','title','description','default','examples','type','const','enum','anyOf','allOf','oneOf','not','if','then','else','required','properties','additionalProperties','items','prefixItems','minItems','maxItems'])
/** 현재 배포 스키마에서 쓰는2020-12 키워드를 결정론적으로 검사한다. 지원하지 않는 키는 실패한다. */
export function validateDefinitionSchema(value:unknown,schema:Schema,root:Record<string,unknown>=sourceSchema):DefinitionSchemaIssue[]{
  const visit=(v:unknown,s:Schema,path:string,depth:number):DefinitionSchemaIssue[]=>{
    const error=(keyword:string,message:string)=>[{path,keyword,message}]
    if(depth>512)return error('$ref','스키마 검사 중첩 한도 초과')
    if(s===true)return[]
    if(s===false)return error('false','허용하지 않는 값')
    for(const key of Object.keys(s))if(!keywords.has(key))return error('schema','지원하지 않는 스키마 키: '+key)
    if(typeof s.$ref==='string'){
      if(!s.$ref.startsWith('#/'))return error('$ref','로컬 스키마 참조만 지원한다')
      let target:unknown=root
      for(const key of s.$ref.slice(2).split('/').map(k=>k.replace(/~1/g,'/').replace(/~0/g,'~')))target=object(target)&&Object.hasOwn(target,key)?target[key]:undefined
      if(typeof target!=='boolean'&&!object(target))return error('$ref','스키마 참조 없음: '+s.$ref)
      const result=visit(v,target as Schema,path,depth+1)
      if(result.length)return result
    }
    if(s.type){
      const types=Array.isArray(s.type)?s.type:[s.type]
      const fits=(type:unknown)=>type==='null'?v===null:type==='array'?Array.isArray(v):type==='object'?object(v):type==='integer'?typeof v==='number'&&Number.isInteger(v):type==='number'?typeof v==='number'&&Number.isFinite(v):typeof v===type
      if(!types.some(fits))return error('type','필요한 형식: '+types.join('|'))
    }
    if(Object.hasOwn(s,'const')&&!same(v,s.const))return error('const','필요한 고정 값: '+JSON.stringify(s.const))
    if(Array.isArray(s.enum)&&!s.enum.some(x=>same(v,x)))return error('enum','허용한 값 목록과 다르다')
    for(const key of ['anyOf','oneOf'] as const)if(Array.isArray(s[key])){
      const results=(s[key] as Schema[]).map(candidate=>visit(v,candidate,path,depth+1)),valid=results.filter(r=>!r.length).length
      if(key==='anyOf'?!valid:valid!==1)return error(key,key==='anyOf'?'허용한 형식 중 어느 것과도 맞지 않는다':'정확히 한 형식과 일치해야 한다')
    }
    const issues:DefinitionSchemaIssue[]=[]
    const add=(rows:DefinitionSchemaIssue[])=>{issues.push(...rows.slice(0,100-issues.length))}
    if(Array.isArray(s.allOf))for(const candidate of s.allOf as Schema[])add(visit(v,candidate,path,depth+1))
    if(s.not!==undefined&&!visit(v,s.not as Schema,path,depth+1).length)add(error('not','제외한 형식과 일치한다'))
    if(s.if!==undefined){const branch=visit(v,s.if as Schema,path,depth+1).length?s.else:s.then;if(branch!==undefined)add(visit(v,branch as Schema,path,depth+1))}
    if(object(v)){
      if(Array.isArray(s.required))for(const key of s.required as string[])if(!Object.hasOwn(v,key))add([{path:path+'/'+pointerKey(key),keyword:'required',message:'필수 필드 없음'}])
      const properties=object(s.properties)?s.properties:{}
      for(const[key,entry]of Object.entries(v)){
        if(Object.hasOwn(properties,key))add(visit(entry,properties[key] as Schema,path+'/'+pointerKey(key),depth+1))
        else if(s.additionalProperties===false)add([{path:path+'/'+pointerKey(key),keyword:'additionalProperties',message:'허용하지 않는 필드'}])
        else if(object(s.additionalProperties))add(visit(entry,s.additionalProperties,path+'/'+pointerKey(key),depth+1))
      }
    }
    if(Array.isArray(v)){
      if(typeof s.minItems==='number'&&v.length<s.minItems)add(error('minItems','배열 항목 부족'))
      if(typeof s.maxItems==='number'&&v.length>s.maxItems)add(error('maxItems','배열 항목 초과'))
      const prefix=Array.isArray(s.prefixItems)?s.prefixItems as Schema[]:[]
      for(let i=0;i<v.length;i++){const child=i<prefix.length?prefix[i]:s.items;if(child!==undefined)add(visit(v[i],child as Schema,path+'/'+i,depth+1))}
    }
    return issues
  }
  return visit(value,schema,'',0)
}

const root=sourceSchema as Record<string,unknown>,definitions=root.$defs as Record<string,Record<string,unknown>>
const schemas=new Map<string,{raw:Schema;resolved:Schema}>()
for(const[name,schema]of Object.entries(definitions)){
  if(!name.endsWith('Def')||!Array.isArray(schema.allOf))continue
  const condition=schema.allOf[0] as {then?:Record<string,unknown>;else?:Record<string,unknown>},full=condition?.else,properties=full?.properties as Record<string,Record<string,unknown>>|undefined,type=properties?.defType?.const
  if(typeof type==='string'&&full)schemas.set(type,{raw:{type:'object',properties:condition.then?.properties??properties,required:['id','defType']},resolved:{...schema,...full,allOf:[]}})
}
export function definitionSchemaIssues(value:Record<string,unknown>,mode:'raw'|'resolved'){
  const schema=schemas.get(String(value.defType))?.[mode]
  return schema?validateDefinitionSchema(value,schema,root):[]
}
export const hasDefinitionSchema=(type:unknown)=>typeof type==='string'&&schemas.has(type)
