import{translate,type Language}from'./message'

type Context={seats?:number;waterMl?:number;tool?:string;materials?:{def:{id:string;label:string};displayLabel:string;count:number}[]}
/** Only the actual operation/boat quote supplies parameters; foreign source labels stay literal. */
export function translateFieldWorkIssue(error:string|null|undefined,context:Context|undefined,language:Language):string{
 if(!error)return''
 if(language!=='en')return error
 const seats=context?.seats,ml=context?.waterMl,tool=context?.tool
 if(seats!==undefined&&error==='배의 실제 정원'+seats+'명을 넘었다')return translate('배의 실제 정원{0}명을 넘었다',language,seats)
 if(ml!==undefined&&error==='한 병에 재가 섞이지 않은 물 '+ml+'ml가 필요하다')return translate('한 병에 재가 섞이지 않은 물 {0}ml가 필요하다',language,ml)
 if(tool&&error==='쓸 수 있는 '+tool+' 도구가 필요하다')return translate('쓸 수 있는 {0} 도구가 필요하다',language,tool)
 for(const row of context?.materials??[]){
  const prefix=row.def.label+' '
  if(!error.startsWith(prefix))continue
  const match=/^([1-9]\d*)개가 부족하다$/.exec(error.slice(prefix.length)),count=match&&Number(match[1]),total=context!.materials!.filter(other=>other.def.id===row.def.id).reduce((n,other)=>n+other.count,0)
  if(count&&Number.isSafeInteger(count)&&count<=total)return translate('{0} {1}개가 부족하다',language,row.displayLabel,count)
 }
 return translate(error,language)
}
