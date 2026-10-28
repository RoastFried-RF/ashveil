// 지원하는 범위 문법은 정확한 세 자리 버전, 비교식, ^, ~, * 및 ||이다.
export const HOOK_API_VERSION='1.4.0'
type Version=[number,number,number]
function version(text:string):Version|undefined{
 if(!/^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/.test(text))return
 return text.split('.').map(Number)as Version
}
function compare(a:Version,b:Version){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}
/** 명시적으로 지원하는 범위 문법인지 확인한다. 대상 버전이 없는 선택 의존성도 검증한다. */
export function validVersionRange(range:unknown):range is string{
 if(typeof range!=='string'||range.length>128||!range.trim())return false
 return range.trim().split(/\s*\|\|\s*/).every(clause=>!!clause&&clause.split(/\s+/).every(token=>{if(token==='*')return true;const match=/^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(token);return!!match&&!!version(match[2])}))
}
export function versionInRange(range:unknown,current:string):boolean{
 const actual=version(current);if(!actual||typeof range!=='string'||range.length>128||!range.trim())return false
 const clauses=range.trim().split(/\s*\|\|\s*/);if(clauses.some(c=>!c))return false
 let accepted=false
 for(const clause of clauses){
  let matches=true
  for(const token of clause.split(/\s+/)){
   if(token==='*')continue
   const m=/^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(token),v=m&&version(m[2]);if(!m||!v)return false
   const op=m[1]??'=',c=compare(actual,v)
   if(op==='^'||op==='~'){
    const upper:Version=op==='~'?[v[0],v[1]+1,0]:v[0]>0?[v[0]+1,0,0]:v[1]>0?[0,v[1]+1,0]:[0,0,v[2]+1]
    matches=matches&&c>=0&&compare(actual,upper)<0
   }else matches=matches&&(op==='='?c===0:op==='>='?c>=0:op==='<='?c<=0:op==='>'?c>0:c<0)
  }
  accepted=accepted||matches
 }
 return accepted
}

export const supportsHookApi=(range:unknown,current=HOOK_API_VERSION)=>versionInRange(range,current)
