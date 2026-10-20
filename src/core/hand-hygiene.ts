import { handCapacity } from './body'
import { channelTurns } from './action-time'
import { log, turnOf, type World } from './ctx'
import { spendWashWater, washWaterSupply } from './wash-water'
import type { Creature, HandHygieneDef, Wound } from './types'
export const handHygieneDef = (w: World) => w.db.get<HandHygieneDef>('HandHygiene.Human')
export function handState(w: World, c: Creature): 'washed' | 'normal' | 'dirty' {
  if (c.hands?.kind === 'dirty') return 'dirty'
  return c.hands?.kind === 'washed' && c.hands.at + handHygieneDef(w).cleanTurns > turnOf(w) ? 'washed' : 'normal'
}
export function handQuality(w: World, c: Creature): number {
  const state = handState(w, c), d = handHygieneDef(w)
  return state === 'washed' ? d.washedBonus : state === 'dirty' ? d.dirtyPenalty : 0
}
export function dirtyHands(w: World, c: Creature) { c.hands = { kind: 'dirty', at: turnOf(w) } }
export function washHandsError(w: World, c: Creature): string | null {
  if (!c.alive || c.unconscious || c.asleep) return '깨어 있어야 손을 씻을 수 있다'
  if (Math.max(handCapacity(w, c, 'Left'), handCapacity(w, c, 'Right')) <= 0) return '손을 쓸 수 없다'
  if (channelTurns(w, c, handHygieneDef(w).washTurns) === null) return '몸 상태 때문에 손을 씻을 수 없다'
  if (!washWaterSupply(w, c, handHygieneDef(w).waterMl).available) return `손을 씻을 물${handHygieneDef(w).waterMl}ml 또는 물가가 필요하다`
  return null
}
export function finishHandWash(w: World, c: Creature): boolean {
  const error = washHandsError(w, c)
  if (error || !spendWashWater(w, c, handHygieneDef(w).waterMl)) {
    if (c.id === w.s.playerId) log(w, 'warn', `손 씻기 중단: ${error ?? '물이 부족하다'}.`)
    return false
  }
  c.hands = { kind: 'washed', at: turnOf(w) }
  if (c.id === w.s.playerId) log(w, 'good', '손을 씻었다. 피와 흙이 씻겨 내려간다.')
  return true
}
/** 효과를 계산한 뒤 접촉을 기록한다. 다음 상처를 만지기 전에는 다시 씻어야 한다. */
export function woundHandContact(w: World, c: Creature, wound: Wound) {
  if (wound.internal || !w.db.wound(wound.def).handContact) return
  if (handState(w, c) === 'dirty') wound.contam = Math.min(100, wound.contam + handHygieneDef(w).dirtyContam)
  dirtyHands(w, c)
}
