// 실제로 오간 말과 그 뒤의 실제 지역 이탈만 기록한다.
import {bodyDef,capacity} from './body'
import {isCompanion} from './companion-state'
import {log,turnOf,type World} from './ctx'
import {factionDef,reputation} from './diplomacy'
import {rememberLifeEvent} from './life-memories'
import type {Creature,EconomyDef} from './types'
export function socialReply(w:World,c:Creature,speaker:Creature):'dismissed'|undefined{
 const policy=w.db.get<EconomyDef>('Economy.Hearth').socialReplies
 if(!policy||c.id!==w.s.playerId||!w.s.creatures.includes(c)||!w.s.creatures.includes(speaker)||!c.alive||!speaker.alive||c.asleep||speaker.asleep||c.unconscious||speaker.unconscious||bodyDef(w,c).kind!=='humanoid'||bodyDef(w,speaker).kind!=='humanoid'||isCompanion(w,speaker))return
 const now=turnOf(w),heard=capacity(w,c,'hearing')>=.2,site=w.s.overworld?.sites.find(s=>s.id===w.s.overworld!.currentRegion&&s.kind==='settlement'),local=site&&speaker.residentSite===site.id&&speaker.faction===site.faction
 if(local&&factionDef(w,speaker.faction)?.guard===speaker.def&&reputation(w,speaker.faction)<=policy.expelAt){
  if(heard){
   if(!c.expulsion||c.expulsion.site!==site.id||c.expulsion.leftAt!==undefined)c.expulsion={site:site.id,faction:speaker.faction,by:speaker.id,at:now}
   log(w,'warn',speaker.name+'이(가) 이 마을에서 떠나라고 명령한다.')
  }else log(w,'flavor',speaker.name+'이(가) 출구 쪽을 가리키며 무언가 말한다.')
  return'dismissed'
 }
 const episode=speaker.breakdown
 if(episode?.kind==='irritable'&&episode.until>now){
  if(heard){
   if(!episode.insultedActors?.includes(c.id)){(episode.insultedActors??=[]).push(c.id);rememberLifeEvent(w,c,'insult')}
   log(w,'warn',speaker.name+'이(가) "귀찮게 굴지 마. 네 꼴도 보기 싫다!"라고 쏘아붙인다.')
  }else log(w,'flavor',speaker.name+'이(가) 짜증스럽게 손을 내젓는다.')
  return'dismissed'
 }
 if(local&&heard&&reputation(w,speaker.faction)>=policy.welcomeAt&&!speaker.welcomedActors?.includes(c.id)){
  (speaker.welcomedActors??=[]).push(c.id);rememberLifeEvent(w,c,'welcome')
  log(w,'good',speaker.name+'이(가) "잘 왔네. 우리 마을에서 쉬었다 가게."라며 반갑게 맞는다.')
 }
}
export function recordOrderedDeparture(w:World,c:Creature,from:string|undefined){
 const order=c.expulsion
 if(!c.alive||!from||!order||order.site!==from||order.leftAt!==undefined)return
 order.leftAt=turnOf(w);rememberLifeEvent(w,c,'expelled')
 log(w,'warn','경비의 퇴거 명령을 받은 마을을 떠났다.')
}
