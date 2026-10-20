// NPC는 실제로 볼 수 있는 살아 있는 화재의 피해 범위만 피한다. 조회는 기억/시간/난수를 만들지 않는다.
import type {Action} from './actions'
import {activeBeddingFire,beddingFireQuote} from './bedding-fire'
import {campfireDef} from './campfire'
import {creatureAt,inBounds,tileAt,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {cheb,DIRS,type Pos} from './geom'
import {machineReady,machineRules} from './machine-state'
import {diagonalBlocked} from './path'
import {activeTerrainFire,terrainFireQuote} from './terrain-fire'
import type {Creature} from './types'
type Danger={pos:Pos;radius:number;kind:'terrain'|'bedding'}
function visibleFires(w:World,c:Creature):Danger[]{
 if(!c.alive||c.asleep||c.unconscious||w.db.creature(c.def).parasite)return[]
 const fires:Danger[]=[]
 for(const l of w.s.map.lights){
  if(l.off||l.terrainFireId===undefined&&l.beddingFireId===undefined||!inBounds(w,l.pos))continue
  let radius:number|undefined,kind:Danger['kind']='terrain'
  if(l.terrainFireId!==undefined&&activeTerrainFire(w,l.pos)?.id===l.terrainFireId)radius=campfireDef(w).wildfire?.damageRadius
  else if(l.beddingFireId!==undefined&&activeBeddingFire(w,l.pos)?.id===l.beddingFireId){radius=0;kind='bedding'}
  if(radius!==undefined&&canSee(w,c,l.pos)&&hasLos(w,c.pos,l.pos))fires.push({pos:l.pos,radius,kind})
 }
 return fires
}
const exposed=(w:World,p:Pos,f:Danger)=>cheb(p,f.pos)<=f.radius&&hasLos(w,f.pos,p)
export function knownFireDanger(w:World,c:Creature):ReadonlySet<number>{
 const blocked=new Set<number>()
 for(const f of visibleFires(w,c))for(let y=f.pos.y-f.radius;y<=f.pos.y+f.radius;y++)for(let x=f.pos.x-f.radius;x<=f.pos.x+f.radius;x++){const p={x,y};if(inBounds(w,p)&&exposed(w,p,f))blocked.add(y*w.s.map.w+x)}
 return blocked
}
export function fireEscapeAction(w:World,c:Creature):Action|null{
 return escapeFrom(w,c,visibleFires(w,c))
}
export function npcFireResponse(w:World,c:Creature):Action|null{
 const fires=visibleFires(w,c)
 if(w.db.body(c.body.def).kind==='humanoid'){
  const near=fires.filter(f=>cheb(c.pos,f.pos)<=1).sort((a,b)=>Number(exposed(w,c.pos,b))-Number(exposed(w,c.pos,a))||cheb(c.pos,a.pos)-cheb(c.pos,b.pos)||a.pos.y-b.pos.y||a.pos.x-b.pos.x)
  for(const f of near){const quote=f.kind==='terrain'?terrainFireQuote(w,c,f.pos):beddingFireQuote(w,c,f.pos);if(!quote.error)return{type:f.kind==='terrain'?'putOutTerrainFire':'putOutBeddingFire',pos:{...f.pos}}}
 }
 return escapeFrom(w,c,fires)
}
function escapeFrom(w:World,c:Creature,fires:Danger[]):Action|null{
 if(c.captivity&&!c.captivity.anklesFree)return null
  if(machineRules(w,c)&&!machineReady(w,c))return null
 if(!fires.some(f=>exposed(w,c.pos,f)))return null
 const score=(p:Pos)=>({count:fires.filter(f=>exposed(w,p,f)).length,clearance:Math.min(...fires.map(f=>cheb(p,f.pos)-f.radius))}),current=score(c.pos)
 let best:{dir:number;count:number;clearance:number}|undefined
 for(let dir=0;dir<DIRS.length;dir++){
  const d=DIRS[dir],p={x:c.pos.x+d.x,y:c.pos.y+d.y}
  if(!inBounds(w,p)||creatureAt(w,p)||diagonalBlocked(w,c.pos,d.x,d.y))continue
  const t=w.db.terrain(tileAt(w,p).t)
  if(!t.passable&&!(t.door==='closed'&&!t.sealed)||machineRules(w,c)&&t.water)continue
  const s=score(p)
  if(s.count>current.count||s.count===current.count&&s.clearance<=current.clearance)continue
  if(!best||s.count<best.count||s.count===best.count&&s.clearance>best.clearance)best={dir,...s}
 }
 return best?{type:'move',dir:best.dir}:{type:'wait'}
}
