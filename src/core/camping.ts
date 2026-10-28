// 설치한 침구는 지도에 남으며, 휴대 침구를 접어도 품질·젖음·UID를 보존한다.
import {mapWorlds} from './journey'
import { clamp, creatureAt, log, terrainAt, tileAt, turnOf,type World } from './ctx'
import { isRaining } from './environment'
import { hasLos, invalidateLights } from './fov'
import { cheb,eq, type Pos } from './geom'
import { addToBag, qualityInfo } from './items'
import type { BeddingLice,Creature,Tile } from './types'

export const beddingWetness=(tile:Tile)=>tile.placed?(tile.placed.item.wetness?.torso??0):(tile.beddingWetness??0)
export const beddingMapKey=(w:World)=>w.s.map.worldCell?`${w.s.map.worldCell.x}.${w.s.map.worldCell.y}.${w.s.map.id}`:w.s.map.id
/** 마지막 실제 휴식 턴은 활동이 끝나도 다음 턴 경계까지 누운 접촉이다. */
export const lyingOnBedding=(w:World,c:Creature)=>!!(c.asleep||c.unconscious||c.activity?.kind==='sleep'||c.activity?.kind==='rest'||c.beddingLying&&c.beddingLying.map===beddingMapKey(w)&&eq(c.beddingLying.pos,c.pos)&&c.beddingLying.until>=turnOf(w))
export const beddingLiceState=(tile:Tile)=>tile.placed?tile.placed.item.beddingLice:tile.beddingLice
export function setBeddingLice(tile:Tile,state?:BeddingLice){
 if(tile.placed){if(state)tile.placed.item.beddingLice=state;else delete tile.placed.item.beddingLice}
 else if(state)tile.beddingLice=state
 else delete tile.beddingLice
}
export const beddingScorch=(tile:Tile)=>tile.placed?(tile.placed.item.beddingScorch??0):(tile.beddingScorch??0)
export function setBeddingScorch(tile:Tile,value:number){
 const next=clamp(value,0,100)
 if(tile.placed){if(next>0)tile.placed.item.beddingScorch=next;else delete tile.placed.item.beddingScorch}
 else if(next>0)tile.beddingScorch=next
 else delete tile.beddingScorch
}
export function setBeddingWetness(tile:Tile,value:number){
 const next=clamp(value,0,100)
 if(tile.placed){tile.placed.item.wetness??={};tile.placed.item.wetness.torso=next}
 else if(next>0)tile.beddingWetness=next
 else delete tile.beddingWetness
}

export function beddingAt(w: World, pos: Pos) {
  const tile = tileAt(w, pos), def = terrainAt(w, pos), b = def.bedding
  if (!b) return { label: '맨땅', quality: 0.5, insulation: 0, wetness: 0, portable: false }
  const wetness = beddingWetness(tile)
  const intact=1-beddingScorch(tile)/100
  return { label: def.label, quality: b.quality*intact, insulation: b.insulation * qualityInfo(tile.placed?.item).ins * (1 - wetness * 0.7 / 100)*intact, wetness, portable: !!b.portable }
}

/** 실제 생성된 각 지도의 침구도 비에 젖고 마른다. 10분마다, 불은 LOS·거리2 이내. */
export function campingTick(w: World) {
  const maps=[w.s.map,...Object.values(w.s.maps),...Object.values(w.s.overworld?.scenes??{}).flatMap(s=>[s.map,...Object.values(s.maps)])]
  if(!maps.some(m=>m.tiles.some(t=>!!w.db.terrain(t.t).bedding)))return
  const seen=new Set<typeof w.s.map>()
  for(const local of mapWorlds(w)){
    if(seen.has(local.s.map))continue
    seen.add(local.s.map)
    const rain=isRaining(local)
    for(let i=0;i<local.s.map.tiles.length;i++){
      const tile=local.s.map.tiles[i]
      if(!local.db.terrain(tile.t).bedding)continue
      const pos={x:i%local.s.map.w,y:Math.floor(i/local.s.map.w)}
      const nearFire=local.s.map.lights.some(l=>!l.off&&l.kind!=='torch'&&cheb(l.pos,pos)<=2&&hasLos(local,pos,l.pos))
      setBeddingWetness(tile,beddingWetness(tile)+(rain&&!tile.roof?100:-(nearFire?10:2)))
    }
  }
}

export function nearbyBedding(w: World, c: Creature) {
  const out: Pos[] = []
  for (let y = c.pos.y - 1; y <= c.pos.y + 1; y++) for (let x = c.pos.x - 1; x <= c.pos.x + 1; x++) {
    if (x < 0 || y < 0 || x >= w.s.map.w || y >= w.s.map.h) continue
    const p = { x, y }
    if (terrainAt(w, p).bedding && hasLos(w, c.pos, p)) out.push(p)
  }
  return out
}

export function packBedding(w: World, c: Creature, p: Pos): string | null {
  if (p.x < 0 || p.y < 0 || p.x >= w.s.map.w || p.y >= w.s.map.h || cheb(p, c.pos) > 1 || !hasLos(w, c.pos, p)) return '침구 곁으로 가야 한다'
  const tile = tileAt(w, p), def = terrainAt(w, p), owner = creatureAt(w, p)
  if(tile.beddingFire)return '타는 침구의 불을 먼저 꺼야 한다'
  if (!def.bedding?.portable || !tile.placed) return '접어 가져갈 수 있는 침구가 아니다'
  if (owner && owner.id !== c.id) return '누군가 침구를 쓰고 있다'
  const { base, item } = tile.placed
  const left = addToBag(w, c, item)
  if (left) tileAt(w, c.pos).items.push({ ...item, count: left, gx: undefined, gy: undefined, rot: undefined })
  tile.t = base; tile.placed = undefined
  invalidateLights(w)
  log(w, 'info', `${def.label}을(를) 접었다.${left ? ' 배낭에 자리가 없어 발밑에 놓았다.' : ''}`)
  return null
}
