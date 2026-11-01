import type {DeathReport} from '../core/types'
import {DISCOVERY_KIND_LABEL} from '../core/discovery-archive'
import {translate,type Language,type MessageValue} from './locales/message'

export interface ReportExport {report:DeathReport;seed:string;modeLabel?:string;language?:Language}
export function formatExpeditionReport({report:r,seed,modeLabel,language='ko'}:ReportExport){
 const text=(source:string,...values:MessageValue[])=>translate(source,language,...values)
 return[
  `ASHVEIL · ${r.title}`,r.epitaph,'',
  text('이름: {0}',r.name),text('배경: {0}',r.background),text('특성: {0}',r.traits.join(', ')),
  text('원인·결말: {0}',r.cause),text('시드: {0}',seed),...(modeLabel?[text('저장 방식: {0}',modeLabel)]:[]),'',
  text('마지막 기록'),...r.chain.map(line=>'· '+line),'',
  text('그때의 몸'),...r.vitals.map(line=>'· '+line),'',
  text('원정 기록'),...r.stats.map(line=>'· '+line),'',
  ...(r.discoveries?[text('이 생애의 발견·학습 기록 (당시 지식/주장, 읽기 전용)'),...r.discoveries.records.flatMap(row=>[`[${text(DISCOVERY_KIND_LABEL[row.kind])}] ${row.title}`,...row.details.map(line=>'  · '+line)]),...(r.discoveries.omitted?[text('기술 한도를 넘어 요약에서 생략한 발견 {0}개',r.discoveries.omitted)]:[]),text('새 인물의 지식·능력·물품으로 옮기지 않는다.'),'']:[]),
 ].join('\n')
}
export function downloadExpeditionReport(value:ReportExport){
 const url=URL.createObjectURL(new Blob([formatExpeditionReport(value)],{type:'text/plain;charset=utf-8'}))
 const link=document.createElement('a'),seed=value.seed.replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,48)||'원정'
 link.href=url;link.download=`ashveil-${value.language==='en'?'expedition-report':'원정보고서'}-${seed}.txt`;document.body.append(link);link.click();link.remove()
 setTimeout(()=>URL.revokeObjectURL(url),1000)
}
