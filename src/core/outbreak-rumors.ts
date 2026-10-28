// 현지의 공개 봉쇄와 사람이 이미 알고 있는 소식만 실제 대화로 전한다.
import {capacity} from './body'
import {log,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {learnRumor,rumorList} from './rumor-state'
import type {Creature,Rumor,WorldSimulationDef} from './types'
function localReport(w:World,speaker:Creature):Rumor|undefined{
 const m=w.s.overworld,site=m?.sites.find(s=>s.id===m.currentRegion),stock=site&&m?.simulation?.settlements[site.id]
 if(!site||!stock?.quarantined||w.s.map.quarantine!==true||![speaker.residentSite,speaker.traderSite,speaker.clinicSite].includes(site.id)||!w.s.creatures.includes(speaker))return
 const disease=w.db.get<WorldSimulationDef>('WorldSimulation.Hearth').disease.def,day=Math.floor(turnOf(w)/TURNS_PER_DAY),observed=stock.changes.filter(c=>c.kind==='quarantine'&&c.day<=day).map(c=>c.day),writtenDay=observed.length?Math.max(...observed):day
 return{id:'outbreak:'+site.id+':'+writtenDay,kind:'outbreak',regionId:site.id,outbreak:{disease,day:writtenDay},text:site.label+'에서 '+w.db.get(disease).label+' 때문에 출입을 막고 있다.',source:speaker.name+'의 현지 목격',hop:0,writtenAt:writtenDay*TURNS_PER_DAY,foundAt:turnOf(w)}
}
export function hearOutbreakRumors(w:World,listener:Creature,speaker:Creature):number{
 if(capacity(w,listener,'hearing')<.2||capacity(w,speaker,'hearing')<.2)return 0
 const report=localReport(w,speaker);if(report)learnRumor(w,speaker,report)
 let count=0
 for(const rumor of rumorList(w,speaker).filter(r=>r.kind==='outbreak')){
  if(!learnRumor(w,listener,{...rumor,source:rumor.source+' → '+speaker.name+'의 이야기',hop:rumor.hop+1}))continue
  count++;if(listener.id===w.s.playerId)log(w,'info',speaker.name+'에게 소식을 들었다. '+rumor.text)
 }
 return count
}
