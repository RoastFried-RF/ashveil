import { clinicalDiseaseFixture } from './clinical-diseases-fixture'
import { invalidateLights, player, serialize, deserialize, tileAt, updatePlayerVision, type World } from '../src/core'

export type VisionScene = 'day' | 'dark' | 'fog' | 'blind'
export function visionFixture(kind: VisionScene = 'day') {
  const d = clinicalDiseaseFixture('vision-native-305-' + kind, false), { w, s, p } = d
  p.background = undefined; p.equip = {}; p.bag = []
  s.storyteller.budget = -1e9; s.map.kind = 'dungeon'; s.map.ambient = kind === 'dark' ? 0 : 1
  s.map.name = '시야 검토 · ' + kind; s.map.links = []; s.map.exits = []; s.map.props = []
  s.map.tiles = s.map.tiles.map(() => ({ t: 'Terrain.Earth', v: 0, roof: true, blood: 0, items: [] }))
  s.map.lights = kind === 'dark' ? [{ pos: { x: 9, y: 20 }, radius: 1, kind: 'brazier' }] : []
  for (let y = 16; y <= 24; y++) tileAt(w, { x: 25, y }).t = 'Terrain.KtWall'
  const torch = d.add('Item.Torch'); p.bag = []; p.equip.main = torch; torch.lit = false
  if (kind === 'fog') s.map.fog = { sightMult: .5, color: 0x777780, opacity: .15 }
  if (kind === 'blind') p.body.missing = ['LeftEye', 'RightEye']
  invalidateLights(w); updatePlayerVision(w, p); s.fx = []
  const result: World = { db: w.db, s: deserialize(serialize(s)) }
  return { w: result, torch: player(result).equip.main!.uid, proof: { kind, player: { ...p.pos }, ambient: s.map.ambient, wall: { x: 25, y: [16, 24] }, lights: s.map.lights, fog: s.map.fog, missing: p.body.missing, torch: { uid: torch.uid, lit: torch.lit, fuel: torch.fuel }, limits: 'Finite initial flat-ground visibility scenes with declared noon clock, ambient light, remote brazier, wall, initially equipped unlit torch and (blind only) missing eyes. Loaded through real Title Continue. No postload world/time/RNG mutation; not ordinary injury/acquisition evidence.' } }
}
