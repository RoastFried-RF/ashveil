export interface DefinitionDifference {path:string;kind:'added'|'removed'|'changed';before?:unknown;after?:unknown}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const escape=(s:string)=>s.replace(/~/g,'~0').replace(/\//g,'~1')
export function definitionDifferences(before:unknown,after:unknown):DefinitionDifference[]{
 const rows:DefinitionDifference[]=[]
 const visit=(a:unknown,b:unknown,path:string,hasA=true,hasB=true)=>{
  if(!hasA&&!hasB)return
  if(!hasA){rows.push({path,kind:'added',after:structuredClone(b)});return}
  if(!hasB){rows.push({path,kind:'removed',before:structuredClone(a)});return}
  if(Object.is(a,b))return
  if(object(a)&&object(b)){for(const key of [...new Set([...Object.keys(a),...Object.keys(b)])].sort())visit(a[key],b[key],path+'/'+escape(key),Object.hasOwn(a,key),Object.hasOwn(b,key));return}
  if(Array.isArray(a)&&Array.isArray(b)){for(let i=0;i<Math.max(a.length,b.length);i++)visit(a[i],b[i],path+'/'+i,i<a.length,i<b.length);return}
  rows.push({path,kind:'changed',before:structuredClone(a),after:structuredClone(b)})
 }
 visit(before,after,'',before!==undefined,after!==undefined);return rows
}
