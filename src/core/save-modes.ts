import type { DefDatabase } from './defs'
import { hasLos } from './fov'
import { cheb, type Pos } from './geom'
import { diagonalBlocked } from './path'
import { campfireDef, fireTurnsLeft } from './campfire'
import { inBounds, player, tileAt, turnOf, type World } from './ctx'
import type { SaveModeDef } from './types'

export const IMPRINT_MODE = 'SaveMode.Imprint'
export function saveModeDef(db: DefDatabase, id = IMPRINT_MODE): SaveModeDef {
  const mode = db.tryGet<SaveModeDef>(id)
  if (!mode || mode.defType !== 'SaveMode') throw Error('사용할 수 없는 저장 방식: ' + id)
  return mode
}
export function currentSaveMode(w: World): SaveModeDef { return saveModeDef(w.db, w.s.saveMode) }

/** 저장은 턴/난수/몸을 바꾸지 않는다. 위치 조건도 실제 현재 물체와 계약만 읽는다. */
export function checkpointQuote(w: World): { mode: SaveModeDef; error: string | null; anchor?: { kind: 'campfire' | 'inn'; pos: Pos } } {
  const mode = currentSaveMode(w), p = player(w)
  if (mode.manual === 'none') return { mode, error: '각인 방식은 수동 저장 지점을 사용하지 않는다' }
  if (!p.alive || w.s.over) return { mode, error: '끝난 원정에는 새 저장 지점을 남길 수 없다' }
  if (mode.manual === 'free') return { mode, error: null }
  const near = (pos: Pos) => cheb(p.pos, pos) <= mode.anchorDistance && hasLos(w, p.pos, pos) && (cheb(p.pos, pos) > 1 || !diagonalBlocked(w, p.pos, pos.x - p.pos.x, pos.y - p.pos.y))
  const fire = w.s.map.lights.find(l => l.kind === 'campfire' && !l.off && inBounds(w,l.pos) && tileAt(w,l.pos).t===campfireDef(w).terrain && near(l.pos) && (l.sourceUid === undefined || fireTurnsLeft(w, l.pos) > 0))
  if (fire) return { mode, error: null, anchor: { kind: 'campfire', pos: { ...fire.pos } } }
  const bed = w.s.map.innBeds?.find(b => b.lease?.tenant === p.id && b.lease.until > turnOf(w) && tileAt(w, b.pos).t === b.terrain && near(b.pos))
  if (bed) return { mode, error: null, anchor: { kind: 'inn', pos: { ...bed.pos } } }
  return { mode, error: '불이 켜진 야영지 모닥불이나 빌린 여관 침대 바로 곁에서 표석을 남겨야 한다' }
}
