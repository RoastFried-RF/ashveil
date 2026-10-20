// 골든 벡터의 드라이버. action은 실제 입력, map은 층 정지 검증을 위한 테스트 조작이다.
import type { Action } from '../src/core/actions'
import type { World } from '../src/core/ctx'
import { changeMap, newGame, playerAct } from '../src/core/game'
import type { DefDatabase } from '../src/core/defs'
import { stateHash } from '../src/core/save'

export type ReplayOp = { map: string } | { action: Action }
export interface GoldenVector {
  name: string
  seed: string
  background: string
  overworld?: boolean
  ops: ReplayOp[]
  expectedHash: string
  expectedInitialHash?: string
  expectedErrors: (string | null)[]
}
export function replayOp(w: World, op: ReplayOp): string | null {
  if ('map' in op) { changeMap(w, op.map); return null }
  return playerAct(w, op.action)
}
export function replay(db: DefDatabase, v: GoldenVector) {
  const w = { db, s: newGame(db, { seed: v.seed, background: v.background, overworld: v.overworld }) }
  const initialHash = stateHash(w.s)
  const errors = v.ops.map((op) => replayOp(w, op))
  return { w, errors, initialHash, hash: stateHash(w.s) }
}
