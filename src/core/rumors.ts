// 소문 (06 §7.0 · 10 §3 #5 · 14 §10): 프로토타입의 원천은 서가·석관의 쪽지(목격자, hop 0).
// 쪽지는 작성 시점이 있다 — 그 뒤의 변화(정리·재점거)는 모른다. 공급원 숫자는 대략값(±30%)으로만.

import { log, rng, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { DIR_LABELS, dirIndex } from './geom'
import { itemDef } from './items'
import { generateDungeon } from './mapgen'
import type { Creature, ItemInst, MapState, Rumor } from './types'

/** 층 수 (지하 3층까지) */
const MAX_DEPTH = 3
/** 아래층 방 위치 단서로 고를 만한 방 */
const ROOM_HINT_TYPES = ['shrine', 'storage', 'library', 'boss', 'guard']

function roomRumor(w: World, depth: number, r: ReturnType<typeof rng>): Rumor | undefined {
  const target = depth + 1
  if (target > MAX_DEPTH) return undefined
  // 층 배치는 시드만으로 정해지므로 아직 안 간 층도 같은 결과를 얻는다
  const gen = generateDungeon(w, target).map
  const rooms = gen.rooms.map((R, i) => ({ R, i })).filter(({ R }) => ROOM_HINT_TYPES.includes(R.type))
  if (!rooms.length) return undefined
  const { R, i } = rooms[r.int(0, rooms.length - 1)]
  const up = gen.links.find((l) => l.to === `crypt${depth}`)?.pos ?? { x: 0, y: 0 }
  const cx = R.x + Math.floor(R.w / 2), cy = R.y + Math.floor(R.h / 2)
  const dir = DIR_LABELS[dirIndex(cx - up.x, cy - up.y)]
  const steps = Math.max(Math.abs(cx - up.x), Math.abs(cy - up.y))
  return {
    id: `room:${gen.id}:${i}`, kind: 'room', mapId: gen.id, roomIdx: i, roomName: R.name, mapW: gen.w, mapH: gen.h, rect: { x: R.x, y: R.y, w: R.w, h: R.h },
    text: `"그들을 아래로 옮겼다. ${gen.name}의 ${R.name}은(는) 계단에서 ${dir}쪽으로 ${steps}걸음쯤." — 아래층 ${R.name}의 위치`,
    source: '', hop: 0, writtenAt: 0, foundAt: 0,
  }
}

function bossRumor(): Rumor {
  return {
    id: 'boss:amalgam', kind: 'boss',
    text: '"병동 아래의 그것은 머리 셋과 심장 셋이 모두 멈춰야 쓰러진다. 등 뒤가 없다." — 융합체의 약점',
    source: '', hop: 0, writtenAt: 0, foundAt: 0,
  }
}

function supplyRumor(w: World, r: ReturnType<typeof rng>): Rumor | undefined {
  const src = (w.s.sources ?? []).find((s) => s.id === 'conduit')
  if (!src) return undefined
  // 대략값 ±30% (06 §7.0)
  const n = Math.max(1, Math.round(src.count * (70 + r.int(0, 60)) / 100))
  return {
    id: 'supply:conduit', kind: 'supply',
    text: `"${src.label} 아래에 그늘 사람이 ${n}명은 산다. 줄어들면 어디선가 또 올라온다." — 공급원 단서(대략값)`,
    source: '', hop: 0, writtenAt: 0, foundAt: 0,
  }
}

/** 용기를 열 때 쪽지 내용을 정한다. 서가 쪽지 하나는 반드시 아래층 방 위치 단서 (14 §5.1) */
export function writeNote(w: World, it: ItemInst, map: MapState, containerId: string) {
  if (it.note) return
  const r = rng(w, 'story')
  const shelf = containerId === 'Terrain.Shelf'
  let rumor: Rumor | undefined
  if (shelf && map.kind === 'dungeon' && !map.noteGiven) {
    rumor = roomRumor(w, map.depth, r)
    if (rumor) map.noteGiven = true
  }
  if (!rumor) {
    const roll = r.int(0, 99)
    rumor = roll < 50 ? roomRumor(w, Math.max(1, map.depth), r) : roll < 75 ? bossRumor() : supplyRumor(w, r)
    rumor ??= bossRumor()
  }
  // 작성 시점: 1~20일 전
  rumor.writtenAt = Math.max(0, turnOf(w) - r.int(1, 20) * TURNS_PER_DAY)
  rumor.source = shelf ? '서가 쪽지' : '석관 쪽지'
  it.note = rumor
}

/** 쪽지 읽기 (1턴): 소문 게시판에 오른다 */
export function readNote(w: World, c: Creature, it: ItemInst): boolean {
  const rumor = it.note
  if (!rumor) return false
  const list = (w.s.knowledge.rumors ??= [])
  const known = list.some((x) => x.id === rumor.id)
  if (!known) list.push({ ...rumor, foundAt: turnOf(w) })
  log(w, 'good', `${itemDef(w, it).label}을(를) 읽었다. ${rumor.text}${known ? ' (이미 아는 내용이다)' : ''}`)
  void c
  return !known
}

/** 이 층에서 소문으로만 아는(아직 못 찾은) 방 */
export function rumoredRooms(w: World, mapId: string): Rumor[] {
  return (w.s.knowledge.rumors ?? []).filter((x) => x.kind === 'room' && x.mapId === mapId)
}
