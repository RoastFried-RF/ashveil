import {completeInteraction,witnessInteraction} from './interactions'
import {knownCreatureName} from './bestiary-state'
// 실제 유한 모닥불의 불씨와 같은 침구의 화재. 과거의 환경 구간을 소급하지 않는다.
import { addWound, bodyDef, capacity, isMissing } from './body'
import { beddingScorch, beddingWetness, setBeddingScorch, setBeddingWetness } from './camping'
import { fireTurnsLeft } from './campfire'
import { inBounds, log, rng, tileAt, turnOf, type World } from './ctx'
import { canSee, hasLos, invalidateLights } from './fov'
import { cheb, DIRS, type Pos } from './geom'
import { mapWorlds } from './journey'
import { primaryMaterial } from './materials'
import { diagonalBlocked } from './path'
import { spendWashWater, washWaterSupply } from './wash-water'
import type { BeddingContactDef, Creature, MaterialDef } from './types'

export const beddingFireRules = (w:World) => w.db.get<BeddingContactDef>('BeddingContact.Hearth').fire
export function activeBeddingFire(w:World,pos:Pos){
 const tile=tileAt(w,pos),fire=tile.beddingFire
 return fire&&tile.t===fire.terrain&&tile.placed?.item.uid===fire.beddingUid&&w.db.terrain(tile.t).bedding?fire:undefined
}
export function beddingFireMaterial(w:World,pos:Pos){
 const tile=tileAt(w,pos),id=beddingFireRules(w)?.materials[tile.t]
 return (tile.placed&&primaryMaterial(w,tile.placed.item))||(id?w.db.get<MaterialDef>(id):undefined)
}
export function visibleBeddingFires(w:World,c:Creature){
 return w.s.map.lights.filter(l=>l.beddingFireId!==undefined&&!l.off&&activeBeddingFire(w,l.pos)?.id===l.beddingFireId&&cheb(c.pos,l.pos)<=3&&canSee(w,c,l.pos)&&hasLos(w,c.pos,l.pos)).map(l=>l.beddingFireId!)
}
function removeFlame(w:World,pos:Pos){
 const tile=tileAt(w,pos),id=tile.beddingFire?.id
 delete tile.beddingFire
 w.s.map.lights=w.s.map.lights.filter(l=>l.beddingFireId===undefined||l.beddingFireId!==id)
 invalidateLights(w)
}
export function beddingFireQuote(w:World,c:Creature,pos:Pos){
 const d=beddingFireRules(w),waterMl=d?.waterMl??0
 let error:string|null=null
 if(!d||!inBounds(w,pos)||!activeBeddingFire(w,pos))error='실제 타는 침구가 아니다'
 else if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 물을 끼얹을 손을 쓸 수 있어야 한다'
 else if(cheb(c.pos,pos)>1||!canSee(w,c,pos)||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))error='타는 침구 바로 곁으로 가야 한다'
 else if(!washWaterSupply(w,c,waterMl).available)error=`불을 끌 실제 물 ${waterMl}ml 또는 물가가 필요하다`
 return{error,waterMl}
}
export function putOutBeddingFire(w:World,c:Creature,pos:Pos):string|null{
 const q=beddingFireQuote(w,c,pos);if(q.error)return q.error
 const observer=w.s.creatures.find(o=>o.id===w.s.playerId),witness=observer&&canSee(w,observer,c.pos)&&canSee(w,observer,pos)
 if(!spendWashWater(w,c,q.waterMl))return '물을 쓸 수 없다'
 setBeddingWetness(tileAt(w,pos),100);removeFlame(w,pos)
 completeInteraction(w,c,'beddingExtinguished',c.name+'의 실제 침구 소화',pos)
 if(c.id===w.s.playerId)log(w,'info',`물 ${q.waterMl}ml로 침구의 불을 껐다. 그을음은 남았다.`)
 else if(witness)log(w,'info',knownCreatureName(w,c)+`이(가) 물 ${q.waterMl}ml로 침구의 불을 껐다.`)
 return null
}
function spark(w:World,pos:Pos,sourceUid:number){
 const d=beddingFireRules(w)!,tile=tileAt(w,pos)
 if(tile.beddingFire||!w.db.terrain(tile.t).bedding||beddingWetness(tile)>=d.dryBelow)return
 const material=beddingFireMaterial(w,pos),chance=d.sparkChance*(material?.flammability??0)/d.flammabilityDivisor
 if(chance<=0||!rng(w,`fire.${w.s.map.id}.${pos.y*w.s.map.w+pos.x}`).chance(chance))return
 const now=turnOf(w),id=w.s.nextId++
 tile.beddingFire={id,sourceUid,terrain:tile.t,...(tile.placed?{beddingUid:tile.placed.item.uid}:{}),startedAt:now,lastAt:now}
 w.s.map.lights.push({pos:{...pos},radius:d.light,kind:'beddingFire',beddingFireId:id})
 invalidateLights(w)
 witnessInteraction(w,'beddingIgnites',pos,'실제로 마른 침구에 불이 붙는 모습')
 const player=w.s.creatures.find(c=>c.id===w.s.playerId)
 if(player&&canSee(w,player,pos))log(w,'warn',`${w.db.terrain(tile.t).label}에 불이 붙었다!`)
}
export function beddingFireTick(w:World){
 const d=beddingFireRules(w);if(!d)return
 const maps=[w.s.map,...Object.values(w.s.maps),...Object.values(w.s.overworld?.scenes??{}).flatMap(s=>[s.map,...Object.values(s.maps)])]
 if(!maps.some(m=>m.lights.some(l=>l.beddingFireId!==undefined||l.kind==='campfire'&&l.sourceUid!==undefined&&!l.off)))return
 const now=turnOf(w),seen=new Set<typeof w.s.map>()
 for(const local of mapWorlds(w)){
  const m=local.s.map;if(seen.has(m))continue;seen.add(m);local.s.nextId=w.s.nextId
  for(const light of [...m.lights]){
   if(light.beddingFireId===undefined)continue
   const tile=tileAt(local,light.pos),fire=tile.beddingFire
   if(!fire||fire.id!==light.beddingFireId){m.lights=m.lights.filter(l=>l!==light);invalidateLights(local);continue}
   if(tile.t!==fire.terrain||tile.placed?.item.uid!==fire.beddingUid||!local.db.terrain(tile.t).bedding){removeFlame(local,light.pos);continue}
   if(beddingWetness(tile)>=d.dryBelow){removeFlame(local,light.pos);continue}
   if(now<=fire.lastAt)continue
   if(now===fire.lastAt+1){
    const material=beddingFireMaterial(local,light.pos),rate=(material?.flammability??0)/d.flammabilityDivisor*(d.burnMultipliers[material?.id??'']??1)
    if(rate<=0){removeFlame(local,light.pos);continue}
    setBeddingScorch(tile,beddingScorch(tile)+100*rate/d.burnTurns)
    if((now-fire.startedAt)%d.damageEvery===0)for(const c of local.s.creatures){
     if(!c.alive||cheb(c.pos,light.pos)!==0)continue
     const parts=bodyDef(local,c).parts.filter(p=>!isMissing(local,c,p.id)),part=parts.find(p=>p.region==='torso')??parts[0]
     if(part)addWound(local,c,{def:'Wound.Burn',part:part.id,severity:d.damage,source:'침구 화재',sourceId:fire.id})
    }
   }
   fire.lastAt=now
   if(beddingScorch(tile)>=100-1e-9){
    const bed=m.residentBeds?.find(b=>!b.packedUid&&b.pos.x===light.pos.x&&b.pos.y===light.pos.y&&b.terrain===tile.t)
    tile.t=tile.placed?.base??bed?.base??d.defaultFloor;delete tile.placed;delete tile.beddingWetness;delete tile.beddingScorch;delete tile.beddingLice
    if(bed)m.residentBeds=m.residentBeds!.filter(b=>b!==bed)
    removeFlame(local,light.pos)
   }
  }
  if(now%d.checkTurns===0)for(const light of [...m.lights]){
   if(light.kind!=='campfire'||light.sourceUid===undefined||fireTurnsLeft(local,light.pos)<=0)continue
   if((light.beddingSparkAt??-Infinity)>=now)continue
   light.beddingSparkAt=now
   for(const dir of DIRS){const pos={x:light.pos.x+dir.x,y:light.pos.y+dir.y};if(inBounds(local,pos)&&hasLos(local,light.pos,pos)&&!diagonalBlocked(local,light.pos,dir.x,dir.y))spark(local,pos,light.sourceUid)}
  }
  w.s.nextId=local.s.nextId
 }
}
