// 자연 기상·중단·약물 만료가 같은 잠기운/시야 상태를 남긴다.
import { log, turnOf, type World } from './ctx'
import type { Creature } from './types'
import {finishSleepMemories} from './sleep-memories'
export function wakeAfterSleep(w: World, c: Creature) {
  finishSleepMemories(w,c)
  c.asleep = false
  c.lastWokeAt = turnOf(w)
  c.drowsyUntil = Math.max(c.drowsyUntil ?? 0, turnOf(w) + (c.deepSleep ? 20 : 10))
  if (c.deepSleep && c.id === w.s.playerId) log(w, 'warn', '깊은 잠에서 끌려 나왔다. 머리가 멍하다.')
  c.deepSleep = undefined
}
