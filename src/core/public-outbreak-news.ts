// 실제 정착지의 새 봉쇄/해제 공고만 전파한다. 과거 changes/원격 개인 감염을 조사하지 않는다.
import {turnOf,TURNS_PER_DAY,type World} from './ctx'
import {publishPublicRumor} from './rumor-network'
import type {WorldSettlement,WorldSimulationDef,Rumor} from './types'
export function announceOutbreakChange(w:World,settlement:WorldSettlement,quarantined:boolean,at:number,decisionDay=Math.floor(at/TURNS_PER_DAY)):boolean{
 const def=w.db.get<WorldSimulationDef>('WorldSimulation.Hearth'),site=w.s.overworld?.sites.find(s=>s.id===settlement.site&&s.kind==='settlement')
 if(!def.rumors?.publicOutbreaks||!site||settlement.population.total<=0||!Number.isFinite(at)||at<0||at>turnOf(w))return false
 const disease=w.db.get(def.disease.def),day=Math.floor(at/TURNS_PER_DAY),what=quarantined?`${disease.label} 때문에 출입을 막는다는 공고`:'봉쇄를 풀고 출입을 다시 연다는 공고'
 const episode=settlement.changes.filter(c=>c.kind==='quarantine'&&c.day===decisionDay).length,suffix=episode>1?`:episode:${episode}`:''
 const rumor:Rumor={id:quarantined?`outbreak:${site.id}:${decisionDay}${suffix}`:`outbreak-reopen:${site.id}:${at}`,kind:quarantined?'outbreak':'supply',regionId:site.id,...(quarantined?{outbreak:{disease:disease.id,day:decisionDay}}:{}),text:site.label+'에서 '+what,source:site.label+'의 공개 공고',hop:0,writtenAt:at,foundAt:at,claims:{what,place:{cell:{...site.cell},label:site.label},when:`${day+1}일차 공고`}}
 return publishPublicRumor(w,site.id,rumor,at)
}
