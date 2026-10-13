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
export function stateHash(s: GameState): string {
  const str = serialize(s)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
