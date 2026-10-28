// 02 §13·04 §8. 뇌진탕 기록은 같은 충격을 한 번만 세고, 이미 배운 숙달은 보존한다.
import { log, rng, type World } from './ctx'
import { masteryStage } from './skills'
import type { Creature, RecoveryDef } from './types'

export function recordConcussion(w: World, c: Creature, woundId: number) {
  const events = c.body.concussionEvents ??= []
  if (events.includes(woundId)) return
  events.push(woundId)
  const d = w.db.get<RecoveryDef>('Recovery.Wounds')
  if (events.length % d.concussionEvery === 0) {
    c.body.concussionCap = Math.min(c.body.concussionCap ?? 1.2, d.concussionCap)
    if (d.forgetfulChance > 0 && !c.traits.includes(d.forgetfulTrait) && rng(w, 'body').chance(d.forgetfulChance)) {
      c.masteryFloor = { medicine: masteryStage(w, c, 'medicine'), survival: masteryStage(w, c, 'survival') }
      c.traits.push(d.forgetfulTrait)
      if (c.faction === 'player') log(w, 'danger', '자꾸 방금 하려던 일을 잊는다. 새로운 치료와 생존 지식을 익히기 어려워졌다.')
    }
  }
  if (c.faction === 'player') log(w, 'warn', `뇌진탕이 쌓였다 (${events.length}회).${c.body.concussionCap ? ` 의식 상한${Math.round(c.body.concussionCap * 100)}%.` : ''}`)
}
