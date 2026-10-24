/** Low flight is an actual movement stance on the existing single-occupant tile grid. */
import type {Action,ActResult} from './actions'
import {addWound,capacity} from './body'
import {fx,killCreature} from './combat'
import {creatureAt,inBounds,terrainAt,tileAt,turnOf,type World} from './ctx'
import {canSee} from './fov'
import {cheb,DIRS,type Pos} from './geom'
import {emitNoise} from './perception'
import type {Creature} from './types'
import {hasEffect} from './traits'
import {worsenFractures} from './fracture-strain'
import {strainProjectiles} from './medical'

const fail=(msg:string):ActResult=>({ok:false,tu:0,msg})
export const flightRule=(w:World,c:Creature)=>w.db.creature(c.def).flight
export const flightHeight=(w:World,c:Creature)=>c.flight&&c.alive?flightRule(w,c)?.height??0:0
export function flightReady(w:World,c:Creature){const rule=flightRule(w,c);return !!rule&&c.alive&&!c.asleep&&!c.unconscious&&!hasEffect(c,'grabbed',turnOf(w))&&!hasEffect(c,'knockedDown',turnOf(w))&&capacity(w,c,'consciousness')>=.3&&capacity(w,c,'flight')>=rule.minCapacity}
function roofBlocked(w:World,p:Pos){const d=terrainAt(w,p);return tileAt(w,p).roof||!!d.wall||d.door==='closed'}
export function flightMoveError(w:World,c:Creature,to:Pos){
 if(!c.flight||!flightReady(w,c))return '비행할 날개와 의식이 없다'
 if(!inBounds(w,to)||cheb(c.pos,to)!==1||w.s.map.kind!=='surface'||roofBlocked(w,to))return '지붕이나 벽을 뚫고 날 수 없다'
 const dx=to.x-c.pos.x,dy=to.y-c.pos.y
 if(dx&&dy&&roofBlocked(w,{x:c.pos.x+dx,y:c.pos.y})&&roofBlocked(w,{x:c.pos.x,y:c.pos.y+dy}))return '닫힌 건물 모서리를 뚫고 날 수 없다'
 if(creatureAt(w,to))return '같은 칸에 다른 몸이 있다'
 if(c.needs.energy<(flightRule(w,c)?.moveEnergy??0))return '날갯짓할 기력이 없다'
 return null
}
export function landingError(w:World,c:Creature,p=c.pos){
 if(!c.flight)return '지금 날고 있지 않다'
 if(!inBounds(w,p))return '착지할 땅이 없다'
 const d=terrainAt(w,p),other=creatureAt(w,p)
 return d.passable&&!d.water&&!roofBlocked(w,p)&&(!other||other.id===c.id)?null:'몸을 내려놓을 빈 마른 땅이 없다'
}
export function takeFlight(w:World,c:Creature):ActResult{
 const rule=flightRule(w,c)
 if(!rule||c.flight||!flightReady(w,c)||c.activity||w.s.map.kind!=='surface'||roofBlocked(w,c.pos))return fail('여기서 날아오를 수 없다')
 if(c.needs.energy<rule.takeoffEnergy+rule.moveEnergy)return fail('이륙할 기력이 없다')
 c.needs.energy-=rule.takeoffEnergy;c.exerted=true;c.flight={startedAt:turnOf(w),landAt:turnOf(w)+rule.maxTurns,origin:{...c.pos}}
 strainWings(w,c)
 emitNoise(w,c.pos,rule.noise,c.id);return{ok:true,tu:100}
}
export function fly(w:World,c:Creature,dir:number):ActResult{
 const d=DIRS[dir];if(!d)return fail('방향 오류')
 const to={x:c.pos.x+d.x,y:c.pos.y+d.y},error=flightMoveError(w,c,to);if(error)return fail(error)
 const from={...c.pos};c.needs.energy-=flightRule(w,c)!.moveEnergy;c.exerted=true;c.pos=to;c.facing=dir;c.movedTurn=turnOf(w)
 strainWings(w,c)
 fx(w,{k:'move',id:c.id,from,to,turn:turnOf(w)});emitNoise(w,to,flightRule(w,c)!.noise,c.id);return{ok:true,tu:100}
}
function strainWings(w:World,c:Creature){strainProjectiles(w,c);for(const region of new Set(w.db.body(c.body.def).parts.filter(p=>(p.capacities?.flight??0)>0).map(p=>p.region)))worsenFractures(w,c,region)}
export function land(w:World,c:Creature):ActResult{if(!c.alive||c.asleep||c.unconscious)return fail('의식이 없어 스스로 착지할 수 없다');const error=landingError(w,c);if(error)return fail(error);delete c.flight;return{ok:true,tu:100}}
/** Actual injury/expiry forces descent; no saved-position teleport to a convenient safe tile. */
export function flightTick(w:World,c:Creature){
 if(!c.flight)return
 if(!c.alive){delete c.flight;return}
 if(flightReady(w,c)&&c.needs.energy>0&&turnOf(w)<c.flight.landAt)return
 const rule=flightRule(w,c),safe=!landingError(w,c),controlled=flightReady(w,c)&&safe
 delete c.flight
 if(controlled||!rule)return
 const body=w.db.body(c.body.def),target=body.parts.find(p=>p.region==='torso'&&!p.internal&&!c.body.missing.includes(p.id))
 if(target){const hit=addWound(w,c,{def:'Wound.Bruise',part:target.id,severity:rule.fallDamage,source:'비행 중 지지 상실로 추락'});c.hp-=hit.damage;fx(w,{k:'dmg',id:c.id,v:hit.damage,turn:turnOf(w)})}
 if(c.hp<=0)killCreature(w,c,'비행 중 추락')
}
/** Candidate paths use only immediately seen neighbours and actual flight barriers. */
export function flightStep(w:World,c:Creature,goal:Pos,away=false):Action|null{
 const choices=DIRS.map((d,dir)=>({dir,pos:{x:c.pos.x+d.x,y:c.pos.y+d.y}})).filter(row=>!flightMoveError(w,c,row.pos)&&canSee(w,c,row.pos))
 choices.sort((a,b)=>(away?-1:1)*(cheb(a.pos,goal)-cheb(b.pos,goal))||a.dir-b.dir)
 const chosen=choices[0];return chosen?{type:'fly',dir:chosen.dir}:null
}
export function seekLanding(w:World,c:Creature):Action{
 if(!landingError(w,c))return{type:'land'}
 const choices:Pos[]=[]
 for(let y=Math.max(0,c.pos.y-6);y<=Math.min(w.s.map.h-1,c.pos.y+6);y++)for(let x=Math.max(0,c.pos.x-6);x<=Math.min(w.s.map.w-1,c.pos.x+6);x++){const p={x,y};if(canSee(w,c,p)&&!landingError(w,c,p))choices.push(p)}
 choices.sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)
 for(const p of choices){const step=flightStep(w,c,p);if(step)return step}
 return{type:'wait'}
}
