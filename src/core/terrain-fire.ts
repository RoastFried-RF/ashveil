// 실제 살아 있는 모닥불/타는 지형의 불씨만 옮긴다. 과거의 지나간 구간은 추정하지 않는다.
import {addWound,bodyDef,capacity,isMissing} from './body'
import {knownCreatureName} from './bestiary-state'
import {killCreature} from './combat'
import {campfireDef,fireTurnsLeft} from './campfire'
import {weatherWetPerTurn} from './climate-state'
import {inBounds,log,rng,tileAt,turnOf,type World} from './ctx'
import {canSee,hasLos,invalidateLights} from './fov'
import {cheb,eq,type Pos} from './geom'
import {diagonalBlocked} from './path'
import {spendWashWater,washWaterSupply} from './wash-water'
import type {Creature} from './types'
const rules=(w:World)=>campfireDef(w).wildfire
export function activeTerrainFire(w:World,pos:Pos){const t=tileAt(w,pos),f=t.terrainFire,b=w.db.terrain(t.t).combustion;return f&&b?.family===f.family&&t.placed?.item.uid===f.placedUid?f:undefined}
function remove(w:World,pos:Pos){const t=tileAt(w,pos),id=t.terrainFire?.id;delete t.terrainFire;w.s.map.lights=w.s.map.lights.filter(l=>l.terrainFireId===undefined||l.terrainFireId!==id);invalidateLights(w)}
const stream=(w:World,pos:Pos)=>`fire.terrain.${w.s.overworld?.currentRegion??'local'}.${w.s.map.id}.${pos.y*w.s.map.w+pos.x}`as const
function spark(w:World,pos:Pos,sourceUid:number){
 const d=rules(w)!,t=tileAt(w,pos),b=w.db.terrain(t.t).combustion,now=turnOf(w)
 if(!b||t.terrainFire||(t.gatherAt??0)>now||(t.fireWetUntil??0)>now||!t.roof&&weatherWetPerTurn(w)>0)return
 if(!rng(w,stream(w,pos)).chance(d.sparkChance))return
 const old=t.combustionRemaining,retained=old?.family===b.family&&old.placedUid===t.placed?.item.uid?old:undefined,remaining=retained?.remaining??b.burnTurns,total=retained?.total??b.burnTurns
 if(remaining<=0)return
 const id=w.s.nextId++;t.terrainFire={id,sourceUid,family:b.family,startedAt:now,lastAt:now,remaining,total,...(t.placed?{placedUid:t.placed.item.uid}:{})};w.s.map.lights.push({pos:{...pos},radius:d.light,kind:'wildfire',terrainFireId:id});invalidateLights(w)
 const p=w.s.creatures.find(c=>c.id===w.s.playerId);if(p&&canSee(w,p,pos))log(w,'warn',w.db.terrain(t.t).label+'에 불이 붙었다!')
}
export function terrainFireQuote(w:World,c:Creature,pos:Pos){
 const d=rules(w);let error:string|null=null
 if(!d||!inBounds(w,pos)||!activeTerrainFire(w,pos))error='실제로 타는 나무나 지형이 아니다'
 else if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 물을 끼얹을 손이 필요하다'
 else if(cheb(c.pos,pos)>1||!canSee(w,c,pos)||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))error='타는 지형 바로 곁으로 가야 한다'
 else if(!washWaterSupply(w,c,d.waterMl).available)error='불을 끌 실제 물 '+d.waterMl+'ml가 필요하다'
 return{error,waterMl:d?.waterMl??0}
}
export function extinguishTerrainFire(w:World,c:Creature,pos:Pos):string|null{
 const q=terrainFireQuote(w,c,pos);if(q.error)return q.error
 const observer=w.s.creatures.find(o=>o.id===w.s.playerId),witness=observer&&canSee(w,observer,c.pos)&&canSee(w,observer,pos)
 if(!spendWashWater(w,c,q.waterMl))return '불을 끌 물이 부족하다'
 const t=tileAt(w,pos);remove(w,pos);t.fireWetUntil=turnOf(w)+rules(w)!.waterProtectionTurns
 if(c.id===w.s.playerId)log(w,'info','실제 물 '+q.waterMl+'ml로 지형의 불을 껐다. 타던 재료는 이미 줄었으며 젖은 동안 불씨가 붙지 않는다.')
 else if(witness)log(w,'info',knownCreatureName(w,c)+'이(가) 물 '+q.waterMl+'ml로 지형의 불을 껐다.')
 return null
}
export function nearbyTerrainFires(w:World,c:Creature){return w.s.map.lights.filter(l=>l.terrainFireId!==undefined&&cheb(c.pos,l.pos)<=3&&inBounds(w,l.pos)&&activeTerrainFire(w,l.pos)&&canSee(w,c,l.pos)).map(l=>({pos:{...l.pos},label:w.db.terrain(tileAt(w,l.pos).t).label,quote:terrainFireQuote(w,c,l.pos)}))}
export function terrainFireTick(w:World){
 const d=rules(w);if(!d||!w.s.map.lights.some(l=>l.terrainFireId!==undefined||l.kind==='campfire'&&l.sourceUid!==undefined&&!l.off))return
 const now=turnOf(w),original=[...w.s.map.lights]
 for(const light of original){
  if(light.terrainFireId===undefined)continue
  const t=tileAt(w,light.pos),f=activeTerrainFire(w,light.pos)
  if(!f||f.id!==light.terrainFireId){remove(w,light.pos);w.s.map.lights=w.s.map.lights.filter(l=>l!==light);continue}
  if(now<=f.lastAt)continue
  if(now!==f.lastAt+1){f.lastAt=now;continue}
  f.lastAt=now;f.remaining--;t.combustionRemaining={family:f.family,remaining:f.remaining,total:f.total,...(f.placedUid!==undefined?{placedUid:f.placedUid}:{})}
  if(!t.roof&&weatherWetPerTurn(w)>0&&now%d.checkTurns===0&&rng(w,stream(w,light.pos)).chance(d.rainExtinguishChance)){remove(w,light.pos);t.fireWetUntil=now+d.waterProtectionTurns;continue}
  if((now-f.startedAt)%d.damageEvery===0)for(const c of w.s.creatures){
   if(!c.alive||cheb(c.pos,light.pos)>d.damageRadius||!hasLos(w,light.pos,c.pos))continue
   const ps=bodyDef(w,c).parts.filter(p=>!p.internal&&!isMissing(w,c,p.id)),part=ps.find(p=>p.region==='torso')??ps[0];if(!part)continue
   const hit=addWound(w,c,{def:'Wound.Burn',part:part.id,severity:d.damage,source:'나무와 지형의 화재',sourceId:f.id});c.hp=Math.max(0,c.hp-hit.damage);if(c.hp<=0)killCreature(w,c,'화재')
  }
  if(f.remaining<=0){
   const b=w.db.terrain(t.t).combustion!
   // 소진된 나무 용기의 이미 존재하던 실물은 같은 UID/상태로 그 자리에 남는다.
   // 합치기/전리품 재추첨/내용물 복제 없이 격자 좌표만 제거한다.
   if(t.cont){for(const item of t.cont.items){delete item.gx;delete item.gy;delete item.rot;t.items.push(item)}delete t.cont}
   if(w.s.loot?.kind==='cont'&&eq(w.s.loot.pos,light.pos))w.s.loot={pos:{...light.pos},kind:'floor'}
   t.t=t.placed?.base??b.burnedAs;delete t.placed;delete t.locked;delete t.gatherAt;delete t.cultivation;delete t.regrowAt;delete t.needleGatherAt;delete t.combustionRemaining;remove(w,light.pos)
  }
 }
 if(now%d.checkTurns!==0)return
 for(const light of original){
  const active=light.terrainFireId!==undefined&&inBounds(w,light.pos)?activeTerrainFire(w,light.pos):undefined,burning=!!active&&active.id===light.terrainFireId&&active.startedAt<now,live=light.kind==='campfire'&&light.sourceUid!==undefined&&fireTurnsLeft(w,light.pos)>0
  if(!burning&&!live||(light.terrainSparkAt??-Infinity)>=now)continue
  light.terrainSparkAt=now
  for(let y=-d.spreadRadius;y<=d.spreadRadius;y++)for(let x=-d.spreadRadius;x<=d.spreadRadius;x++){
   if(!x&&!y)continue
   const pos={x:light.pos.x+x,y:light.pos.y+y};if(inBounds(w,pos)&&hasLos(w,light.pos,pos)&&(Math.abs(x)>1||Math.abs(y)>1||!diagonalBlocked(w,light.pos,x,y)))spark(w,pos,light.sourceUid??light.terrainFireId!)
  }
 }
}
