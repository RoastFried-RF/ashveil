// 실제 처음 교전한 때의 보이는 전력만 보존한다. 조회나 마지막 사망HP로 과거를 추정하지 않는다.
import {bodyDef} from './body'
import {hostile} from './diplomacy'
import {canSee} from './fov'
import {player,turnOf,type World} from './ctx'
import {combatThreat} from './morale'
import type {Creature} from './types'
export function recordCombatEngagement(w:World,a:Creature,d:Creature){
 const p=player(w),foe=a.id===p.id?d:d.id===p.id?a:undefined
 if(!foe||!p.alive||!foe.alive||foe.xpAwarded||!w.s.creatures.includes(foe)||!w.s.creatures.includes(p)||bodyDef(w,p).kind!=='humanoid'||!canSee(w,p,foe.pos)||!hostile(w,p,foe)||foe.playerEngagement?.actor===p.id)return
 const ownThreat=combatThreat(w,p),threat=combatThreat(w,foe)
 if(ownThreat<=0||threat<=0)return
 foe.playerEngagement={actor:p.id,at:turnOf(w),threat,ownThreat}
}
