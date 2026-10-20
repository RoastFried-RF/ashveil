import {canMeet,firstImpression} from './first-impression-state'
import {canSee} from './fov'
import {capacity} from './body'
import {log,type World} from './ctx'
import type {Creature} from './types'
/** 실제로 성립한 대화/계약/거래에서만 한 번 기억한다. 실패한 견적을 기록하지 않는다. */
export function rememberMeeting(w:World,subject:Creature,observer:Creature){
 const old=observer.firstImpressions?.[subject.id];if(old)return old
 if(!canMeet(w,subject,observer))return
 const memory=firstImpression(w,subject,observer);if(!memory)return
 memory.heard=canSee(w,subject,observer.pos)||capacity(w,subject,'hearing')>=.2
 ;(observer.firstImpressions??={})[subject.id]=memory
 if(subject.id===w.s.playerId){observer.met=true;if(memory.heard&&memory.score!==0)log(w,'flavor',observer.name+(memory.attitude==='wary'?'이(가) 조심스레 거리를 두며 인사를 받는다.':memory.attitude==='warm'?'이(가) 반갑게 인사를 받는다.':'이(가) 담담하게 인사를 받는다.'))}
 return memory
}
