// 숙달 (15 §9.3, CANON D23): 사용 기반 숙련은 폐지. 의료·생존만 성공 횟수로 0~5단계.
// 카운트 규칙: 같은 상처·같은 대상에는 1회만, 게임 1시간당 최대 3회.

import { log, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import type { Creature } from './types'

export type MasteryKind = 'medicine' | 'survival'
export const MASTERY_LABEL: Record<MasteryKind, string> = { medicine: '의료', survival: '생존' }
export const MASTERY_STEPS = [5, 15, 30, 50, 80]
export const MASTERY_PER_HOUR = 3

/** 성공 횟수 (c.skills 에 보관) */
export function masteryCount(c: Creature, k: MasteryKind): number {
  return c.skills[k] ?? 0
}

/** 숙달 단계 0~5 */
export function masteryStage(c: Creature, k: MasteryKind): number {
  const n = masteryCount(c, k)
  return MASTERY_STEPS.filter((s) => n >= s).length
}

/** 다음 단계 문턱 (최고 단계면 null) */
export function masteryNext(c: Creature, k: MasteryKind): number | null {
  return MASTERY_STEPS[masteryStage(c, k)] ?? null
}

/** 시작 단계를 성공 횟수로 바꾼다 (배경: 의료 숙달 1단계로 시작 → 5회) */
export function setMasteryStage(c: Creature, k: MasteryKind, stage: number) {
  c.skills[k] = stage > 0 ? MASTERY_STEPS[stage - 1] : 0
}

/** 성공 1회 기록. key 는 상처 id·대상 id 등 '같은 것'을 가리는 열쇠 */
export function practice(w: World, c: Creature, k: MasteryKind, key: string) {
  if (c.faction !== 'player') return
  const log0 = (c.masteryLog ??= { keys: [], hour: -1, inHour: {} })
  const full = `${k}:${key}`
  if (log0.keys.includes(full)) return
  const hour = Math.floor(turnOf(w) / TURNS_PER_HOUR)
  if (log0.hour !== hour) { log0.hour = hour; log0.inHour = {} }
  if ((log0.inHour[k] ?? 0) >= MASTERY_PER_HOUR) return
  log0.inHour[k] = (log0.inHour[k] ?? 0) + 1
  log0.keys.push(full)
  if (log0.keys.length > 300) log0.keys.shift()
  const before = masteryStage(c, k)
  c.skills[k] = masteryCount(c, k) + 1
  const after = masteryStage(c, k)
  if (after > before) log(w, 'good', `${MASTERY_LABEL[k]} 숙달이 ${after}단계가 되었다.`)
}
