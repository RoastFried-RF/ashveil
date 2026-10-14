// 각인(Imprint) 세이브: 단일 슬롯 직렬화. 저장소(localStorage/파일)는 클라이언트가 결정.

import { SAVE_VERSION } from './game'
import type { GameState } from './types'

export function serialize(s: GameState): string {
  return JSON.stringify(s)
}

export function deserialize(json: string): GameState {
  const s = JSON.parse(json) as GameState
  if (s.version !== SAVE_VERSION) throw new Error(`세이브 버전 불일치: ${s.version} (현재 ${SAVE_VERSION})`)
  return s
}

/** 결정론 검증용 상태 해시 (FNV-1a) */
/** 키 순서와 무관한 직렬화: 런타임에 키가 붙은 순서는 불러오기 전후로 달라질 수 있다 */
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : canonical(x))).join(',') + ']'
  const o = v as Record<string, unknown>
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}'
}

export function stateHash(s: GameState): string {
  const str = canonical(s)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
