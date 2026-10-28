import {rememberMeeting} from './first-impressions'
// 유한한 실제 침대의 대여. 견적은 읽기 전용이고 지불과 계약은 한 번에 반영한다.
import { creatureAt, inBounds, log, terrainAt, tileAt, turnOf, type World } from './ctx'
import { marketFor, tradeAccess } from './economy'
import { reputationBand } from './diplomacy'
import { invalidateLights } from './fov'
import { cheb } from './geom'
import type { Creature, InnDef, MapState } from './types'

export const innDef = (w: World, keeper: Creature) => {
  const id = w.db.creature(keeper.def).inn
  return id ? w.db.get<InnDef>(id) : undefined
}
export function initializeInn(w: World) {
  if (w.s.map.innInitialized) return
  const keeper = w.s.creatures.find((c) => c.traderSite && innDef(w, c))
  if (!keeper) return
  const d = innDef(w, keeper)!, home = keeper.home ?? keeper.pos
  const beds: NonNullable<MapState['innBeds']> = []
  for (let r = 2; r <= 5 && beds.length < d.beds; r++) {
    for (let y = home.y - r; y <= home.y + r && beds.length < d.beds; y++) for (let x = home.x - r; x <= home.x + r && beds.length < d.beds; x++) {
      const p = { x, y }
      if (cheb(home, p) !== r || !inBounds(w, p) || creatureAt(w, p)) continue
      const tile = tileAt(w, p), t = terrainAt(w, p)
      // 구형 지역의 건축·소지품·물·계단·작업장은 덮어쓰지 않는다.
      if (!t.passable || t.water || t.stairs || t.container || t.station || t.bedding || tile.placed || tile.items.length || w.s.map.exits.some((e) => e.x === x && e.y === y)) continue
      tile.t = d.terrain; tile.roof = true
      beds.push({ id: `${keeper.traderSite}:bed:${beds.length + 1}`, keeper: keeper.id, terrain: d.terrain, pos: p })
    }
  }
  w.s.map.innBeds = beds; w.s.map.innInitialized = true
  invalidateLights(w)
}
export function innBedAt(w: World, pos: Creature['pos']) {
  return w.s.map.innBeds?.find((b) => b.pos.x === pos.x && b.pos.y === pos.y && tileAt(w, pos).t === b.terrain)
}
export function innSleepError(w: World, c: Creature): string | null {
  const bed = innBedAt(w, c.pos)
  if (!bed) return null
  return bed.lease?.tenant === c.id && bed.lease.until > turnOf(w) ? null : '이 침대는 주인에게 먼저 빌려야 한다'
}
export function innQuote(w: World, c: Creature, keeper: Creature, bedId: string, periods=1) {
  const d = innDef(w, keeper), bed = w.s.map.innBeds?.find((b) => b.id === bedId && b.keeper === keeper.id)
  const valid=Number.isSafeInteger(periods)&&periods>=1&&periods<=3650
  const fee = d&&valid ? Math.max(1, Math.ceil(d.fee * (c.id === w.s.playerId ? reputationBand(w, keeper.faction).price : 1)))*periods : 0
  const turns=d&&valid?d.leaseTurns*periods:0
  const until = d ? Math.max(turnOf(w), bed?.lease?.tenant === c.id ? bed.lease.until : 0) + turns : 0
  let error = tradeAccess(w, c, keeper)
  if(!error&&!valid)error='빌릴 기간은1회에서3650회 사이의 정수여야 한다'
  if (!error && (!d || !bed || tileAt(w, bed.pos).t !== bed.terrain)) error = '빌릴 수 있는 침대가 아니다'
  if (!error && bed) {
    const occupant = creatureAt(w, bed.pos)
    if (bed.lease && bed.lease.until > turnOf(w) && bed.lease.tenant !== c.id) error = '이미 다른 손님이 빌린 침대다'
    else if (occupant && occupant.id !== c.id) error = '아직 다른 사람이 침대를 쓰고 있다'
    else if (w.s.map.innBeds?.some((b) => b.id !== bed.id && b.lease?.tenant === c.id && b.lease.until > turnOf(w))) error = '이미 빌린 침대를 먼저 써야 한다'
  }
  if (!error && (c.money ?? 0) < fee) error = '숙박료가 부족하다'
  if (!error && (!Number.isSafeInteger(until) || !Number.isSafeInteger((marketFor(w, keeper)?.money ?? 0) + fee))) error = '대여 기간이나 금액이 너무 크다'
  return { error, fee, until, turns, bed }
}
export function rentInnBed(w: World, c: Creature, keeper: Creature, bedId: string, expectedFee?: number, periods=1): string | null {
  const q = innQuote(w, c, keeper, bedId,periods)
  if (q.error) return q.error
  if (expectedFee !== undefined && expectedFee !== q.fee) return '숙박료가 바뀌었다. 다시 확인해야 한다'
  c.money = (c.money ?? 0) - q.fee
  marketFor(w, keeper)!.money += q.fee
  q.bed!.lease = { tenant: c.id, until: q.until }
  rememberMeeting(w,c,keeper)
  if (c.id === w.s.playerId) log(w, 'info', `침대를 빌리고 ${q.fee}전을 냈다. 침대(${q.bed!.pos.x}, ${q.bed!.pos.y})에 가서 잠들 수 있다.`)
  return null
}
