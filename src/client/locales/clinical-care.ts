import type {World} from '../../core/ctx'
import type {ClinicRequest} from '../../core/clinic'
import type {DrugDef,SurgeryDef,ProcedureDef,DiseaseDef} from '../../core/types'
import {translate,type Language} from './message'
import {translateDef} from './content'

const number='[+-]?\\d+(?:\\.\\d+)?'
const lineFormats=[
 '규격 1회분 · 지속 {0}분','이번 1회분의 통증 감소 {0} · 현재 내성 {1}',
 '해당 상처의 감염 진행 {0}% 감소','전신 감염 진행 {0}% 감소','피부 자극: 통증 +{0}',
 '의식 감점 {0}','호흡 감소 {0}','이번 투여의 의존 위험 {0}%','이질 위험 {0}%',
 ...['지각','의료 숙달','도구','청결 습관','손 위생','조명','장갑','봉합 손재주','실내','재비','진흙','적대 인식','통증'].map(s=>s+' {0}'),
 '× 조작 {0} × 자가 {1} = Q {2}'
]
const issueFormats=['진찰에는 의료 숙달{0}단계가 필요하다','이 약에는 의료 숙달{0}단계가 필요하다','의료 숙달{0}단계가 필요하다','처치 순서는 1~{0}개를 골라야 한다']
function numericFormat(source:string,formats:string[],language:Language):string|undefined{
 for(const format of formats){
  const escaped=format.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\d+\}/g,'('+number+')')
  const match=new RegExp('^'+escaped+'$').exec(source)
  if(match)return translate(format,language,...match.slice(1))
 }
}

/** Call only with fresh Core quote lines, never saved findings, reasons or log text. */
export function translateClinicalLine(w:World,source:string,language:Language):string{
 if(language!=='en')return source
 const formatted=numericFormat(source,lineFormats,language)
 if(formatted!==undefined)return formatted
 for(const d of w.db.all<DiseaseDef>('Disease'))if(source===d.label+' 치료 · 원래 상처와 다른 질병은 남는다')return translate('{0} 치료 · 원래 상처와 다른 질병은 남는다',language,translateDef(d,'label',language))
 return translate(source,language)
}

/** Fresh quote/access errors only. Supply names require actual rule + Def + exact text. */
export function translateClinicalIssue(w:World,source:string|null|undefined,language:Language):string{
 if(!source)return ''
 if(language!=='en')return source
 const step=/^(\d+)번째 처치: (.+)$/.exec(source)
 if(step)return translate('{0}번째 처치: {1}',language,step[1]!,translateClinicalIssue(w,step[2]!,language))
 const formatted=numericFormat(source,issueFormats,language)
 if(formatted!==undefined)return formatted
 for(const rule of w.db.all<SurgeryDef>('Surgery')){
  const item=w.db.item(rule.supply)
  if(source===item.label+' '+rule.count+'개가 필요하다'){
   const label=item.relic?(item.unknownLabel?translateDef(item,'unknownLabel',language):translate('미확인 유물',language)):translateDef(item,'label',language)
   return translate('{0} {1}개가 필요하다',language,label,rule.count)
  }
 }
 return translate(source,language)
}

/** Original saved/current work label must match its typed request and original binding.
 * Changed definitions or unrecognised history remain verbatim; no current wound is inferred. */
export function translateClinicalLabel(w:World,source:string|undefined,request:Pick<ClinicRequest,'kind'>,language:Language,itemId?:string):string{
 if(!source||language!=='en')return source??''
 if(request.kind==='diagnose')return source==='진찰'?translate(source,language):source
 const rule=[...w.db.all<SurgeryDef>('Surgery'),...w.db.all<ProcedureDef>('Procedure')].find(d=>d.kind===request.kind)
 if(rule&&source===rule.label)return translateDef(rule,'label',language)
 const item=itemId?w.db.tryGet<import('../../core/types').ItemDef>(itemId):undefined
 if(!item)return source
 if(request.kind==='dose'){
  const drug=item.drug?.def?w.db.tryGet<DrugDef>(item.drug.def):undefined
  if(drug&&source===drug.label+' '+(drug.external?'바르기':'투약'))return translate(drug.external?'{0} 바르기':'{0} 투약',language,translateDef(drug,'label',language))
 }
 const actions={tourniquet:'지혈대 감기',splint:'부목 대기',disinfect:'상처 씻기',bandage:'붕대 감기'}
 if(Object.hasOwn(actions,request.kind)&&item.medical?.kind===request.kind){
  const action=actions[request.kind as keyof typeof actions]
  if(source===item.label+' — '+action){
   const label=item.relic?(item.unknownLabel?translateDef(item,'unknownLabel',language):translate('미확인 유물',language)):translateDef(item,'label',language)
   return translate('{0} — {1}',language,label,translate(action,language))
  }
 }
 return source
}
