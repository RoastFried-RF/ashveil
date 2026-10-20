import {learnInteraction} from './interactions'
import { learnBestiary } from './bestiary-state'
import { knowledgeDef, learnPillsFromBook } from './knowledge-state'
// 숙달 (15 §9.3, CANON D23): 사용 기반 숙련은 폐지. 의료·생존만 성공 횟수로 0~5단계.
// 카운트 규칙: 같은 상처·같은 대상에는 1회만, 게임 1시간당 최대 3회.

import { log, rng, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import { hasEffect, traitMul } from './traits'
import type { Creature } from './types'

export type MasteryKind = 'medicine' | 'survival'
export const MASTERY_LABEL: Record<MasteryKind, string> = { medicine: '의료', survival: '생존' }
export const MASTERY_STEPS = [5, 15, 30, 50, 80]
export const MASTERY_PER_HOUR = 3
export function masterySteps(w: World, c: Creature): number[] { return MASTERY_STEPS.map((n) => Math.max(1, Math.floor(n * (c.age?.masteryMult ?? 1) * traitMul(w, c, 'masteryThresholdMult')))) }

/** 성공 횟수 (c.skills 에 보관) */
export function masteryCount(c: Creature, k: MasteryKind): number {
  return c.skills[k] ?? 0
}

/** 숙달 단계 0~5 */
export function masteryStage(w: World, c: Creature, k: MasteryKind): number {
  const n = masteryCount(c, k)
  return Math.max(c.masteryFloor?.[k] ?? 0, masterySteps(w, c).filter((s) => n >= s).length)
}

/** 다음 단계 문턱 (최고 단계면 null) */
export function masteryNext(w: World, c: Creature, k: MasteryKind): number | null {
  return masterySteps(w, c)[masteryStage(w, c, k)] ?? null
}

/** 시작 단계를 성공 횟수로 바꾼다 (배경: 의료 숙달 1단계로 시작 → 5회) */
export function setMasteryStage(w: World, c: Creature, k: MasteryKind, stage: number) {
  if (c.masteryFloor) delete c.masteryFloor[k]
  c.skills[k] = stage > 0 ? masterySteps(w, c)[stage - 1] : 0
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
  const n = Math.min(hasEffect(c, 'elation', turnOf(w)) ? 2 : 1, MASTERY_PER_HOUR - (log0.inHour[k] ?? 0))
  log0.inHour[k] = (log0.inHour[k] ?? 0) + n
  log0.keys.push(full)
  if (log0.keys.length > 300) log0.keys.shift()
  const before = masteryStage(w, c, k)
  c.skills[k] = masteryCount(c, k) + n
  const after = masteryStage(w, c, k)
  if (after > before) log(w, 'good', `${MASTERY_LABEL[k]} 숙달이 ${after}단계가 되었다.`)
}

/** 책으로 얻는 몫만 15회까지. 실제 처치로 쌓은 횟수를 깎지 않는다 (D31) */
export function studyBook(w: World, c: Creature, id: string, reading = false, intact = 1): number {
  if ((c.booksRead ??= []).includes(id)) return 0
  const b = w.db.item(id).book
  if (!b) return 0
  const completed = c.literacyBooks ??= [...c.booksRead]
  c.booksRead.push(id)
  const misread = reading && c.literacy === 1 && rng(w, 'body').chance(knowledgeDef(w).misreadChance)
  if (misread) {
    ;(c.misreadBooks ??= []).push(id)
    log(w, 'info', `${w.db.item(id).label}을(를) 다 읽었다. 글의 뜻을 나름대로 짚어 두었다.`)
  }
  if(!misread&&intact>=1&&b.note)log(w,'good',`${w.db.item(id).label}: ${b.note}`)
  if(reading&&!misread&&intact>=1)for(const interaction of b.interactions??[])learnInteraction(w,c,interaction,'book',w.db.item(id).label+' 온전한 완독')
  if (!misread && intact>=1) for (const entry of b.bestiary??[]) learnBestiary(w,entry,id,c)
  if (intact >= 1 && b.identify?.length) learnPillsFromBook(w,c,b.identify,misread)
  if (intact >= 1) {
    if (!completed.includes(id)) completed.push(id)
    if (!misread && b.literacyTo && (c.literacy ?? 0) < b.literacyTo) { c.literacy = b.literacyTo; c.literate = true; log(w,'good',`문해가${c.literacy}단계가 되었다.`) }
  }
  const earned = (c.bookMastery ??= {})
  const n = misread ? 0 : Math.max(0, Math.min(Math.floor(b.amount * intact), masterySteps(w, c)[1] - (earned[b.mastery] ?? 0)))
  earned[b.mastery] = (earned[b.mastery] ?? 0) + n
  c.skills[b.mastery] = masteryCount(c, b.mastery) + n
  if (!misread && b.amount > 0) log(w, 'good', `${w.db.item(id).label} 완독: ${MASTERY_LABEL[b.mastery]} 숙달 +${n}회${n < b.amount ? ` (책 상한 ${masterySteps(w, c)[1]}회)` : ''}.`)
  if (!misread && intact >= 1) for (const recipe of b.unlocks ?? []) {
    if (!(c.recipes ??= []).includes(recipe)) { c.recipes.push(recipe); log(w, 'good', `제작법을 익혔다: ${w.db.get(recipe).label}.`) }
  }
  if (c.literacy === 1 && (c.literacyBooks?.length ?? 0) >= knowledgeDef(w).literacyBooks) { c.literacy = 2; log(w, 'good', '글을 막힘 없이 읽게 되었다.') }
  return n
}
