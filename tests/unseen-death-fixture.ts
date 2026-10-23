import { visionFixture } from './vision-fixture'
import { addWound, deserialize, invalidateLights, player, serialize, tileAt, updatePlayerVision, type World } from '../src/core'
import { createCreature } from '../src/core/creatures'

/** 실제 관찰 뒤 한 걸음으로 벽 뒤에 숨는 유한 초기 장면이다. */
export function unseenDeathFixture(occlusion = true, contributed = false) {
  const { w } = visionFixture('day'), p = player(w)
  p.pos = { x: 20, y: 18 }; p.facing = 4
  const target = createCreature(w, 'Creature.Reaver', { x: 23, y: 18 }), wall = []
  target.traits = []; target.age = undefined; target.equip = {}; target.bag = []; target.effects = []; target.nextAct = 1e12
  w.s.creatures.push(target)
  if (occlusion) for (let y = 19; y <= 26; y++) { const pos = { x: 21, y }; wall.push(pos); tileAt(w, pos).t = 'Terrain.KtWall' }
  const { wound } = addWound(w, target, { def: 'Wound.Cut', part: 'RightUpperArm', severity: 10, source: 'declared initial bleeding observation', sourceId: contributed ? p.id : undefined, bleedMult: 0 })
  wound.bleed = 60; target.body.blood = target.body.bloodMax / 2 + 70
  invalidateLights(w); updatePlayerVision(w, p); w.s.fx = []
  const proof = { player: { ...p.pos }, wall, target: structuredClone(target), contributed, limits: 'Finite declared initial living actor, actual bleeding wound60ml/turn and70ml above fatal threshold, scheduled-inactive AI. Actual move/wait after Title Continue. No natural injury/acquisition claim or postload world/body/time/RNG mutation.' }
  const result: World = { db: w.db, s: deserialize(serialize(w.s)) }
  return { w: result, targetId: target.id, proof }
}
