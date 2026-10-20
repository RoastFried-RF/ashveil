// 직접 목격했거나 실제로 전달된 현지 소식만, 실제 대화로 전한다.
import {capacity} from './body'
import {cheb} from './geom'
import {hasLos} from './fov'
import {factionDef,hostile} from './diplomacy'
import {log,turnOf,type World} from './ctx'
import {learnRumor,rumorList} from './rumor-state'
import type {Creature,ReputationEvent,Rumor} from './types'
function report(w:World,speaker:Creature,e:ReputationEvent):Rumor|undefined{
 const m=w.s.overworld,subject=e.subject,faction=factionDef(w,e.faction),region=m?.currentRegion
 if(!subject||!faction||!Number.isFinite(e.delta)||!e.delta||speaker.faction!==e.faction)return
 const direct=e.witnesses.includes(speaker.id),local=region&&e.regionId===region&&[speaker.residentSite,speaker.traderSite,speaker.clinicSite].includes(region)
 if(!direct&&!(local&&e.applied))return
 return{id:'reputation:'+subject.seed+':'+e.id,kind:'reputation',regionId:e.regionId,reputation:{subject:{...subject},event:e.id,delta:e.delta},text:subject.name+'의 이름이 '+faction.label+'에서 '+(e.delta>0?'좋게':'나쁘게')+' 전해진다. '+e.reason+'.',source:speaker.name+(direct?'의 직접 목격':'이 들은 현지 소식'),hop:direct?0:1,writtenAt:e.turn,foundAt:turnOf(w)}
}
export function hearNameRumors(w:World,listener:Creature,speaker:Creature):number{
 if(!w.s.creatures.includes(listener)||!w.s.creatures.includes(speaker)||!listener.alive||!speaker.alive||listener.asleep||speaker.asleep||listener.unconscious||speaker.unconscious||capacity(w,listener,'consciousness')<.5||capacity(w,speaker,'consciousness')<.5||capacity(w,listener,'hearing')<.2||cheb(listener.pos,speaker.pos)>1||!hasLos(w,listener.pos,speaker.pos)||hostile(w,listener,speaker))return 0
 for(const event of w.s.overworld?.society?.events??[]){const news=report(w,speaker,event);if(news)learnRumor(w,speaker,news)}
 let count=0
 for(const news of rumorList(w,speaker).filter(r=>r.kind==='reputation')){
  if(!learnRumor(w,listener,{...news,source:news.source+' → '+speaker.name+'의 이야기',hop:news.hop+1}))continue
  count++;if(listener.id===w.s.playerId)log(w,'info',speaker.name+'에게 소식을 들었다. '+news.text)
 }
 return count
}
