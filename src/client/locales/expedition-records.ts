import endings from './en-expedition-endings.json'
import {translate,type Language} from './message'

type EndingRule={id:string;label:string;summary:string;epitaph:string}
type EndingField='label'|'summary'|'epitaph'
const reviewed:Readonly<Record<string,Record<EndingField,{source:string;text:string}>>>=endings

/** Current known rule only: both parent Def ID and field's original text must match. */
export function translateEndingRule(parentId:string,rule:EndingRule,field:EndingField,language:Language):string{
 const source=rule[field]
 if(language!=='en'||parentId!=='Retirement.Hearth'||!Object.hasOwn(reviewed,rule.id))return source
 const entry=reviewed[rule.id][field]
 return source===entry.source?entry.text:source
}

/** Actual current quote requirements; saved note titles remain literal values. */
export function translateEndingIssue(error:string|null|undefined,requirements:string[],language:Language):string{
 if(!error)return''
 if(requirements.length&&error==='아직 남은 일: '+requirements.join(' · '))return translate('아직 남은 일: {0}',language,requirements.join(' · '))
 return translate(error,language)
}
