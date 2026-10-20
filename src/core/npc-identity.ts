// 새 주민의 실제 이름과 플레이어에게 소개한 이름을 구별한다. 옛 사람을 다시 이름 짓지 않는다.
import {capacity} from './body'
import {inBounds,player,rng,turnOf,type World} from './ctx'
import {hostile} from './diplomacy'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import {diagonalBlocked} from './path'
import type {Creature,NpcIdentityDef} from './types'
export const npcIdentityDef=(w:World)=>w.db.get<NpcIdentityDef>('NpcIdentity.Hearth')
export function initializeNpcIdentity(w:World,c:Creature,site:string,role:string){
 const d=npcIdentityDef(w)
 if(!d.enabled||c.npcIdentity||c===player(w)||!c.alive||!w.s.creatures.includes(c)||c.name!==role||!role||c.body.machine||!d.bodies.includes(c.body.def)||w.s.overworld?.currentRegion!==site)return
 const used=new Set(w.s.creatures.filter(o=>o.npcIdentity?.site===site).map(o=>o.npcIdentity!.givenName)),free=d.names.filter(n=>!used.has(n)),givenName=rng(w,`world.npc-identity.${site}`).pick(free.length?free:d.names)
 c.npcIdentity={site,role,givenName,name:d.format.replace('{name}',givenName).replace('{role}',role),bornAt:turnOf(w)}
}
/** NPC 본인이 알고 있는 이름이다. 플레이어 표시에는 기존 인식 규칙을 쓴다. */
export const actualNpcName=(c:Creature)=>c.npcIdentity?.name??c.name
export function introduceNpcIdentity(w:World,actor:Creature,c:Creature){
 const identity=c.npcIdentity
 if(!identity||identity.introducedAt!==undefined||actor!==player(w)||actor===c||!w.s.creatures.includes(actor)||!w.s.creatures.includes(c)||[actor,c].some(p=>!p.alive||p.asleep||p.unconscious||p.captivity||p.activity||p.breakdown||p.mapId!==undefined&&p.mapId!==w.s.map.id||!inBounds(w,p.pos)||capacity(w,p,'consciousness')<.5||capacity(w,p,'hearing')<.2||capacity(w,p,'sight')<.2))return
 if(cheb(actor.pos,c.pos)>1||!hasLos(w,actor.pos,c.pos)||!canSee(w,actor,c.pos)||!canSee(w,c,actor.pos)||lightLevel(w,actor.pos)>=2||lightLevel(w,c.pos)>=2||diagonalBlocked(w,actor.pos,c.pos.x-actor.pos.x,c.pos.y-actor.pos.y)||hostile(w,actor,c)||actor.attackedBy?.includes(c.id)||c.attackedBy?.includes(actor.id))return
 c.name=identity.name;identity.introducedAt=turnOf(w)
}
