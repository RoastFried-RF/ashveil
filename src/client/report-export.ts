import type {DeathReport} from '../core/types'

export interface ReportExport {report:DeathReport;seed:string;modeLabel?:string}
export function formatExpeditionReport({report:r,seed,modeLabel}:ReportExport){
 return[
  `ASHVEIL · ${r.title}`,r.epitaph,'',
  `이름: ${r.name}`,`배경: ${r.background}`,`특성: ${r.traits.join(', ')}`,
  `원인·결말: ${r.cause}`,`시드: ${seed}`,...(modeLabel?[`저장 방식: ${modeLabel}`]:[]),'',
  '마지막 기록',...r.chain.map(line=>'· '+line),'',
  '그때의 몸',...r.vitals.map(line=>'· '+line),'',
  '원정 기록',...r.stats.map(line=>'· '+line),'',
 ].join('\n')
}
export function downloadExpeditionReport(value:ReportExport){
 const url=URL.createObjectURL(new Blob([formatExpeditionReport(value)],{type:'text/plain;charset=utf-8'}))
 const link=document.createElement('a'),seed=value.seed.replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,48)||'원정'
 link.href=url;link.download=`ashveil-원정보고서-${seed}.txt`;document.body.append(link);link.click();link.remove()
 setTimeout(()=>URL.revokeObjectURL(url),1000)
}
