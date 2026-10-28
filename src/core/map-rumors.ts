// 실제로 읽거나 전해 들은 당시 지도만 대화로 전한다. 원본 종이/원격 층의 진실은 전달하지 않는다.
import {capacity} from './body'
import {validMapDocument} from './cartography'
import {hostile} from './diplomacy'
import {hasLos} from './fov'
import {cheb} from './geom'
import {log,type World} from './ctx'
import {learnRumor,rumorList} from './rumor-state'
import type {Creature} from './types'
export function hearMapRumors(w:World,listener:Creature,speaker:Creature):number{
 if(!w.s.creatures.includes(listener)||!w.s.creatures.includes(speaker)||!listener.alive||!speaker.alive||listener.asleep||speaker.asleep||listener.unconscious||speaker.unconscious||capacity(w,listener,'consciousness')<.5||capacity(w,speaker,'consciousness')<.5||capacity(w,listener,'hearing')<.2||capacity(w,speaker,'hearing')<.2||cheb(listener.pos,speaker.pos)>1||!hasLos(w,listener.pos,speaker.pos)||hostile(w,listener,speaker))return 0
 let count=0
 for(const r of rumorList(w,speaker).filter(r=>r.mapDocument&&validMapDocument(r.mapDocument))){
  if(!learnRumor(w,listener,{...r,source:r.source+' → '+speaker.name+'의 이야기',hop:r.hop+1}))continue
  count++;if(listener.id===w.s.playerId)log(w,'info',speaker.name+'에게 지도의 이야기를 들었다. '+r.text)
 }
 return count
}
