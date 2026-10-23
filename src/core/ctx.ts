import type { DefDatabase } from './defs'
import type { Pos } from './geom'
import { Rng, seedState, type RngStream } from './rng'
import type { Creature, GameState, LogEntry, Tile, TerrainDef } from './types'

export const TU_PER_TURN = 100
export const TURNS_PER_HOUR = 1200
/** 1일차 18:00 — 해 질 녘에 도착 */
export const START_TURN = 18 * TURNS_PER_HOUR
export const TURNS_PER_DAY = TURNS_PER_HOUR * 24
export const SECONDS_PER_TURN = 3

export interface World {
  db: DefDatabase
  s: GameState
  /** 과거 재배 조회의 실행 순서 경계. 연속 경과 시간은 s.time을 그대로 쓴다. 저장하지 않는다. */
  climateHistoryCutoff?:number
}

export function rng(w: World, stream: RngStream): Rng {
  const st = w.s.rng[stream] ?? ((stream.startsWith('mod.')||stream.startsWith('world.')||stream.startsWith('body.')||stream.startsWith('items.')||stream.startsWith('cooking.')||stream.startsWith('fire.')) ? w.s.rng[stream] = seedState(w.s.seed, stream) : undefined)
  if (!st) throw new Error(`RNG 스트림 없음: ${stream}`)
  return new Rng(st)
}

export function turnOf(w: World): number {
  return Math.floor(w.s.time / TU_PER_TURN)
}

const JOSA: Record<string, [string, string]> = { '이(가)': ['이', '가'], '을(를)': ['을', '를'], '은(는)': ['은', '는'], '과(와)': ['과', '와'] }

/** '이(가)' 같은 병기 조사를 앞 글자 받침에 맞춰 고른다 */
export function fixJosa(text: string): string {
  return text.replace(/([가-힣])(이\(가\)|을\(를\)|은\(는\)|과\(와\))/g, (_m, ch: string, j: string) => {
    const hasFinal = (ch.charCodeAt(0) - 0xac00) % 28 !== 0
    return ch + JOSA[j][hasFinal ? 0 : 1]
  })
}

export function log(w: World, kind: LogEntry['kind'], text: string, detail?: string[]) {
  w.s.log.push({ turn: turnOf(w), kind, text: fixJosa(text), detail })
  if (w.s.log.length > 400) w.s.log.splice(0, w.s.log.length - 400)
}

export function player(w: World): Creature {
  return w.s.creatures.find((c) => c.id === w.s.playerId)!
}

export function creatureById(w: World, id: number | undefined): Creature | undefined {
  if (id === undefined) return undefined
  return w.s.creatures.find((c) => c.id === id)
}

export function inBounds(w: World, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < w.s.map.w && p.y < w.s.map.h
}

export function idx(w: World, p: Pos): number {
  return p.y * w.s.map.w + p.x
}

export function tileAt(w: World, p: Pos): Tile {
  return w.s.map.tiles[p.y * w.s.map.w + p.x]
}

export function terrainAt(w: World, p: Pos): TerrainDef {
  return w.db.terrain(tileAt(w, p).t)
}

export function creatureAt(w: World, p: Pos, includeDead = false): Creature | undefined {
  return w.s.creatures.find((c) => (includeDead || c.alive) && c.pos.x === p.x && c.pos.y === p.y)
}

export function isPassable(w: World, p: Pos): boolean {
  return inBounds(w, p) && terrainAt(w, p).passable
}

export function isOpaque(w: World, p: Pos): boolean {
  if (!inBounds(w, p) || terrainAt(w, p).opaque) return true
  const sp = tileAt(w, p).spores
  return !!sp && sp.until > turnOf(w) && sp.conc >= 5
}

export function nextId(w: World): number {
  return w.s.nextId++
}

/** 시각 → (일, 시, 분) */
export function clock(turn: number) {
  const day = Math.floor(turn / TURNS_PER_DAY) + 1
  const inDay = turn % TURNS_PER_DAY
  const hour = Math.floor(inDay / TURNS_PER_HOUR)
  const minute = Math.floor(((inDay % TURNS_PER_HOUR) * SECONDS_PER_TURN) / 60)
  return { day, hour, minute, hourF: inDay / TURNS_PER_HOUR }
}

export function fmtClock(turn: number): string {
  const c = clock(turn)
  return `${c.day}일차 ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 표 선형 보간 (초월함수 대신) */
export function lerpTable(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]
    const [x0, y0] = table[i - 1]
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return table[table.length - 1][1]
}
