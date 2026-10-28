import {reputationOrigin} from './rumor-subject'
// 소식은 관로를 실제로 떠난 증인의 기억에서 출발한다.
import { ensureSociety } from './diplomacy'
import { log, player, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { canSee } from './fov'
import { cheb } from './geom'
import { lightSource } from './items'
import { kinAwake, kinshipDefs } from './kinship-state'
import type { Creature, RumorSubject,KinshipDef } from './types'

function send(w:World,d:KinshipDef,key:string,target:number,delta:number,reason:string,witness:number,delay:number,subject?:RumorSubject,regionId?:string){
  const society=ensureSociety(w);if(!society||society.events.some(e=>e.kinKey===key))return false
  society.events.push({subject,regionId,kinKey:key,id:society.nextEvent++,target,faction:d.faction,delta,reason,turn:turnOf(w),arrives:turnOf(w)+delay,witnesses:[witness],applied:false})
  return true
}
/** 계단에 닿고 플레이어 시야 밖으로 실제 이탈하는 AI 분기에서만 호출한다. */
export function dispatchKinship(w:World,c:Creature){
  const m=c.kinship,d=m&&kinshipDefs(w).find(d=>d.id===m.rule)
  if(!m||!d||!kinAwake(w,c)||m.dispatched!==undefined||c.ai.mode!=='flee'&&!m.returning||w.s.map.kind!=='dungeon'||!w.s.map.links.some(l=>cheb(l.pos,c.pos)===0)||canSee(w,player(w),c.pos))return false
  const delay=d.delayDays*TURNS_PER_DAY
  for(const kill of m.kills)send(w,d,kill.key,kill.target,kill.chief?d.chiefLoss:d.killLoss,kill.chief?'관로 우두머리의 살해를 살아남은 친족이 전했다':'관로 친족의 살해를 살아남은 목격자가 전했다',c.id,delay,kill.subject,kill.regionId)
  if(m.contact&&!m.kills.length&&!w.s.map.kinshipDeaths?.some(x=>x.group===m.group))send(w,d,`peace:${d.id}:${m.group}`,c.id,d.peaceReward,'죽이지 않고 놓아 준 관로 무리의 소식',c.id,delay,m.subject,m.regionId)
  m.dispatched=turnOf(w);m.returning=undefined
  return true
}
/** 표면 지파는 플레이어가 내는 빛만 피한다. 마을의 화덕을 침입자로 오인하지 않는다. */
export function kinLightThreat(w:World,c:Creature){
  const p=player(w),d=kinshipDefs(w).find(d=>d.faction===c.faction&&d.sites.includes(w.s.overworld?.currentRegion??''))
  return d&&w.s.map.kind==='surface'&&kinAwake(w,c)&&p.alive&&lightSource(w,p)&&cheb(c.pos,p.pos)<=d.avoidRadius&&canSee(w,c,p.pos)?p:undefined
}
export function kinshipTick(w:World){
  const site=w.s.overworld?.currentRegion,p=player(w)
  if(!site||w.s.map.kind!=='surface'||w.s.map.kinshipLightReported||!p.alive||!lightSource(w,p))return
  const d=kinshipDefs(w).find(d=>d.sites.includes(site));if(!d)return
  const witnesses=w.s.creatures.filter(c=>c.id!==p.id&&c.faction===d.faction&&kinAwake(w,c)&&canSee(w,c,p.pos))
  if(!witnesses.length)return
  const society=ensureSociety(w);if(!society)return
  w.s.map.kinshipLightReported=true
  const key=`light:${d.id}:${site}:${w.s.map.kinshipVisit??1}`
  if(society.events.some(e=>e.kinKey===key))return
  const now=turnOf(w)
  society.events.push({...reputationOrigin(w,p),kinKey:key,id:society.nextEvent++,target:p.id,faction:d.faction,delta:d.torchLoss,reason:'숲 주민이 들고 온 불빛을 목격했다',turn:now,arrives:now,witnesses:witnesses.map(c=>c.id),applied:false})
  if(witnesses.some(c=>canSee(w,p,c.pos)))log(w,'warn','숲 주민이 불빛을 피해 물러난다. “빛은 사냥꾼을 부른다.”')
}
