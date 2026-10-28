import {learnInteraction} from './interactions'
// 실제 읽기/대화가 전달한 소식만 각자의 지식에 넣는다. 내용의 진위를 현재 원격 상태로 덮어쓰지 않는다.
import {turnOf,type World} from './ctx'
import {rememberLifeEvent} from './life-memories'
import type {Creature,Rumor} from './types'
export function rumorList(w:World,c:Creature):Rumor[]{return c.id===w.s.playerId?(w.s.knowledge.rumors??[]):(c.knownRumors??[])}
export function learnRumor(w:World,c:Creature,rumor:Rumor):boolean{
 const list=rumorList(w,c)
 if(list.some(x=>x.id===rumor.id&&(!w.s.overworld||(x.regionId??'Region.GreyCloister')===(rumor.regionId??'Region.GreyCloister'))))return false
 const destination=c.id===w.s.playerId?(w.s.knowledge.rumors??=[]):(c.knownRumors??=[])
 destination.push({...structuredClone(rumor),foundAt:turnOf(w)})
 if(rumor.kind==='reputation'&&rumor.reputation){const r=rumor.reputation,s=r.subject;if(s&&s.id===c.id&&s.name===c.name&&s.seed===w.s.seed&&Number.isSafeInteger(r.event)&&r.event>0&&Number.isFinite(r.delta)&&r.delta!==0)rememberLifeEvent(w,c,'ownRumor',{opinion:r.delta})}
 if(rumor.kind==='interaction')for(const id of rumor.interactions??[])learnInteraction(w,c,id,'rumor',rumor.source)
 if(rumor.kind==='outbreak'&&rumor.outbreak)rememberLifeEvent(w,c,'plagueNews',{disease:rumor.outbreak.disease})
 return true
}
