import {rememberNpcCareBond} from './npc-social'
import {knownCreatureName} from './bestiary-state'
import {capacity} from './body'
import {log,player,turnOf,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {cheb} from './geom'
import type {Activity,Creature,NpcCareDef,NpcCareRecord} from './types'
/** 기존 처치가 실제 원래 물품을 쓴 뒤에만 이 기록을 남긴다. */
export function recordNpcCare(w:World,provider:Creature,patient:Creature,act:Activity,quality:number){
 const care=act.npcCare;if(!care||care.provider!==provider.id||care.patient!==patient.id||care.woundId!==act.woundId||care.materialUid!==act.uid)return
 const d=w.db.get<NpcCareDef>('NpcCare.Hearth'),record:NpcCareRecord={at:turnOf(w),by:provider.id,patient:patient.id,woundId:care.woundId,materialUid:care.materialUid,quality}
 if([provider,patient].some(c=>c.npcCareHistory?.some(r=>r.by===record.by&&r.patient===record.patient&&r.woundId===record.woundId&&r.materialUid===record.materialUid&&r.at>=care.startedAt)))return
 for(const c of[provider,patient]){const history=c.npcCareHistory??=[];if(!history.some(r=>r.by===record.by&&r.patient===record.patient&&r.woundId===record.woundId&&r.at===record.at))history.push({...record});if(history.length>d.historyLimit)history.splice(0,history.length-d.historyLimit)}
 rememberNpcCareBond(w,provider,patient,d.bondBonus??0)
 const p=player(w)
 if(p.alive&&!p.asleep&&!p.unconscious&&capacity(w,p,'consciousness')>=.5&&capacity(w,p,'hearing')>=.2&&[provider,patient].every(c=>cheb(p.pos,c.pos)<=d.witnessRange&&canSee(w,p,c.pos)&&hasLos(w,p.pos,c.pos)))log(w,'info',`${knownCreatureName(w,provider)}이(가) 자기 의료 물품으로 ${knownCreatureName(w,patient)}의 상처를 감쌌다.`)
}
