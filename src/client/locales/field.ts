import{translate,type Language}from'./message'
import{translateDef}from'./content'
type LabelDef={id:string;label?:string}
type Context={waterMl?:number;tools?:LabelDef[];seasons?:LabelDef[]}
/** Match the actual quote's parameters; foreign labels remain literal through the Def/source guard. */
export function translateFieldIssue(error:string|null|undefined,context:Context|undefined,language:Language):string{
 if(!error)return''
 if(language!=='en')return error
 const ml=context?.waterMl
 if(ml!==undefined&&error==='불을 끌 실제 물 '+ml+'ml가 필요하다')return translate('불을 끌 실제 물 {0}ml가 필요하다',language,ml)
 const tools=context?.tools
 if(tools?.length&&error==='날이 남은 도구를 손에 장착해야 한다: '+tools.map(d=>d.label??d.id).join('·'))return translate('날이 남은 도구를 손에 장착해야 한다: {0}',language,tools.map(d=>d.label===undefined?d.id:translateDef(d,'label',language)).join(' · '))
 const seasons=context?.seasons
 if(seasons?.length&&error===seasons.map(d=>d.label??d.id).join('·')+'에만 실제 열매가 열린다')return translate('{0}에만 실제 열매가 열린다',language,seasons.map(d=>d.label===undefined?d.id:translateDef(d,'label',language)).join(' · '))
 return translate(error,language)
}
