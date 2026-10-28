// 골든 벡터의 드라이버. action은 실제 입력, map은 층 정지 검증을 위한 테스트 조작이다.
import type { Action } from '../src/core/actions'
import type { World } from '../src/core/ctx'
import {player} from '../src/core/ctx'
import { changeMap, newGame, playerAct } from '../src/core/game'
import type { DefDatabase } from '../src/core/defs'
import { stateHash } from '../src/core/save'

export type ReplayOp = { map: string } | { action: Action }
export interface GoldenVector {
  name: string
  seed: string
  background: string
  overworld?: boolean
  /** 고정 입력 장면의 유한 초기 특성. 새 캐릭터 생성 검증과 구분한다. */
  initialTraits?: string[]
  ops: ReplayOp[]
  expectedHash: string
  expectedInitialHash?: string
  expectedErrors: (string | null)[]
}
export function replayOp(w: World, op: ReplayOp): string | null {
  if ('map' in op) { changeMap(w, op.map); return null }
  return playerAct(w, op.action)
}
export function replayWorld(db:DefDatabase,v:GoldenVector){
  const w = { db, s: newGame(db, { seed: v.seed, background: v.background, overworld: v.overworld }) }
  if(v.initialTraits){
    const p=player(w),traits=v.initialTraits.map(id=>db.trait(id))
    if(traits.length<2||traits.length>3||new Set(v.initialTraits).size!==traits.length||traits.some(t=>t.conflicts?.some(id=>v.initialTraits!.includes(id))))throw Error('유효한 유한 초기 특성이 필요하다: '+v.name)
    p.traits=[...v.initialTraits]
    const entry=w.s.log.find(e=>e.text.startsWith('당신은 ')&&e.text.includes('특성:'))
    if(!entry)throw Error('원래 캐릭터 생성 기록이 없다: '+v.name)
    entry.text=`당신은 ${p.name}, ${db.background(p.background!).label}. 특성: ${traits.map(t=>t.label).join(', ')}.`
  }
  return w
}
export function replay(db: DefDatabase, v: GoldenVector) {
  const w = replayWorld(db,v)
  const initialHash = stateHash(w.s)
  const errors = v.ops.map((op) => replayOp(w, op))
  return { w, errors, initialHash, hash: stateHash(w.s) }
}
