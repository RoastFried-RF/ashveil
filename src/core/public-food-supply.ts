// 실제 완료일의 배급 부족/충족 전환만 공개한다. 저장된 옛 장부를 검색해 소급 공고하지 않는다.
import {turnOf,TURNS_PER_DAY,type World} from './ctx'
import {publishPublicRumor,type RumorConnectionBatch} from './rumor-network'
import type {Rumor,WorldSettlement,WorldSimulationDef} from './types'

export function announceFoodSupply(w:World,settlement:WorldSettlement,at:number,batch?:RumorConnectionBatch):boolean{
 const def=w.db.get<WorldSimulationDef>('WorldSimulation.Hearth'),site=w.s.overworld?.sites.find(s=>s.id===settlement.site&&s.kind==='settlement'),ledger=settlement.lastSupply,line=ledger?.commodities.Food,notice=settlement.supplyNotice
 if(!def.rumors?.publicFoodSupply||!site||!ledger||!line||!Number.isSafeInteger(at)||at<=0||at%TURNS_PER_DAY!==0||at>turnOf(w)||ledger.day!==at/TURNS_PER_DAY-1||!Number.isSafeInteger(ledger.population)||ledger.population<=0||settlement.population.S+settlement.population.I+settlement.population.R<=0)return false
 if([line.requested,line.supplied,line.unmet,line.residentUsed].some(n=>!Number.isFinite(n)||n<0)||line.requested+line.residentUsed<=0)return false
 const unmet=line.unmet>0
 if(notice&&(notice.day>=ledger.day||notice.unmet===unmet)||!unmet&&notice?.unmet!==true)return false
 const what=unmet?`${ledger.day+1}일차 공동 식량 배급이 모자랐다는 공고`:`${ledger.day+1}일차 공동 식량 배급 요청을 모두 충당했다는 공고`
 const rumor:Rumor={id:`food-supply:${site.id}:${ledger.day}:${unmet?'shortage':'supplied'}`,kind:'supply',regionId:site.id,text:site.label+'에서 '+what,source:site.label+'의 배급 공고',hop:0,writtenAt:at,foundAt:at,claims:{what,place:{cell:{...site.cell},label:site.label},when:`${at/TURNS_PER_DAY+1}일차 공고`}}
 if(!publishPublicRumor(w,site.id,rumor,at,batch))return false
 settlement.supplyNotice={day:ledger.day,unmet}
 return true
}
