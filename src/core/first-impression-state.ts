// 첫 만남의 실제 인상과 이후 기억. 견적/조회는 새 만남을 만들어 넣지 않는다.
import {capacity,isMissing} from './body'
import {prostheticAt,prostheticFirstImpression} from './prosthetic-state'
import {traitAdd} from './traits'
import {canSee,hasLos} from './fov'
import {cheb} from './geom'
import {turnOf,type World} from './ctx'
import {townNameOpinion} from './public-name-news'
import type {Creature,EconomyDef,FirstImpression} from './types'
export const firstImpressionRules=(w:World)=>w.db.get<EconomyDef>('Economy.Hearth').firstImpressions
export function canMeet(w:World,a:Creature,b:Creature){
 return a!==b&&a.alive&&b.alive&&!a.asleep&&!b.asleep&&!a.unconscious&&!b.unconscious&&capacity(w,a,'consciousness')>=.5&&capacity(w,b,'consciousness')>=.5&&cheb(a.pos,b.pos)<=1&&hasLos(w,a.pos,b.pos)&&w.db.body(a.body.def).kind==='humanoid'&&w.db.body(b.body.def).kind==='humanoid'
}
export function firstImpression(w:World,subject:Creature,observer:Creature):FirstImpression|undefined{
 const old=observer.firstImpressions?.[subject.id]
 if(old)return old
 const d=firstImpressionRules(w)
 if(!d||subject.id===w.s.playerId&&observer.met||!canMeet(w,subject,observer))return
 const terms:FirstImpression['terms']=[],visible=canSee(w,observer,subject.pos),mod=traitAdd(w,subject,'firstImpression')
 if(mod)terms.push({kind:'modifier',value:mod})
 const opinion=townNameOpinion(w,observer,subject);if(opinion)terms.push({kind:'rumor',value:opinion})
 if(w.s.hygieneEnabled!==false&&d.villagerFactions.includes(observer.faction)&&subject.needs.hygiene<d.filthyBelow&&(visible||capacity(w,observer,'smell')>=.2))terms.push({kind:'hygiene',value:d.filthyPenalty})
 if(visible){
  const parts=w.db.body(subject.body.def).parts
  if(subject.body.scars?.some(s=>{const p=parts.find(p=>p.id===s.part);return p&&!p.internal&&p.groups.some(g=>d.faceGroups.includes(g))&&!isMissing(w,subject,s.part)&&!prostheticAt(w,subject,s.part)}))terms.push({kind:'scar',value:d.faceScarPenalty})
  const cosmetic=prostheticFirstImpression(w,subject);if(cosmetic)terms.push({kind:'prosthetic',value:cosmetic})
 }
 const score=terms.reduce((sum,t)=>sum+t.value,0)
 return{at:turnOf(w),score,terms,attitude:score>=d.warmAt?'warm':score<d.waryBelow?'wary':'neutral'}
}
export const firstImpressionScore=(w:World,subject:Creature,observer:Creature)=>firstImpression(w,subject,observer)?.score??0
export function firstImpressionReply(w:World,c:Creature,subject:Creature){
 const memory=c.firstImpressions?.[subject.id];if(!memory?.heard)return
 const reply=memory.attitude==='wary'?'처음 만났을 때 경계하는 기색을 보였다.':memory.attitude==='warm'?'처음 만났을 때 반갑게 맞아 주었다.':'처음 만났을 때 담담하게 인사를 주고받았다.'
 return reply+(memory.terms.some(t=>t.kind==='rumor')?' 이곳에 전해진 당신의 소식을 이미 들은 눈치다.':'')
}
