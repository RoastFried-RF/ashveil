import { loadDb } from '../tools/loadContent'
import { newGame } from '../src/core/game'
import type { World } from '../src/core/ctx'

export const { db } = loadDb()

export function makeWorld(seed = 'test', background?: string, overworld=false): World {
  const s = newGame(db, { seed, background, overworld })
  return { db, s }
}
