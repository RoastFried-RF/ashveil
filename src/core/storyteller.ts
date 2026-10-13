// 스토리텔러(라이트): 위협 예산이 쌓이면 복선을 깔고 잠시 뒤 사건을 일으킨다.

import { clock, idx, log, player, rng, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import { createCreature, findSpawnNear } from './creatures'
import { isNight } from './environment'
import { cheb } from './geom'
import type { EventDef } from './types'

export const BUDGET_PER_HOUR = 9
/** 첫 사건까지 유예 (newGame 에서 lastEventTurn 으로 반영) */
export const GRACE_TURNS = 1800
export const MIN_GAP_TURNS = 2400

export function storytellerTick(w: World, spawnable: () => { x: number; y: number }[]) {
  const st = w.s.storyteller
  const turn = turnOf(w)
  st.budget += (BUDGET_PER_HOUR / TURNS_PER_HOUR) * (isNight(w) ? 1.5 : 1)

  if (st.pending && turn >= st.pending.atTurn) {
    fire(w, w.db.event(st.pending.event), spawnable())
    st.pending = undefined
    return
  }
  if (st.pending || turn - st.lastEventTurn < MIN_GAP_TURNS) return
  if (turn % 50 !== 0) return
  const r = rng(w, 'story')
  const day = clock(turn).day
  const affordable = w.db.all<EventDef>('Event').filter((e) => {
    if (e.cost > st.budget) return false
    if (e.minDay && day < e.minDay) return false
    const last = [...st.history].reverse().find((h) => h.event === e.id)
    if (last && e.cooldownTurns && turn - last.turn < e.cooldownTurns) return false
    return true
  })
  if (!affordable.length) return
  // 예산이 넉넉할수록 큰 사건 확률이 커진다
  if (!r.chance(0.08 + Math.min(0.3, st.budget / 400))) return
  const ev = r.weighted(affordable, (e) => e.weight * (isNight(w) ? e.nightWeight ?? 1 : 1) * (1 + e.cost / 60))
  if (!ev) return
  st.budget -= ev.cost
  st.pending = { event: ev.id, atTurn: turn + r.int(80, 240) }
  if (ev.hint) log(w, 'flavor', ev.hint)
}

function fire(w: World, ev: EventDef, spawnable: { x: number; y: number }[]) {
  const r = rng(w, 'story')
  const st = w.s.storyteller
  const turn = turnOf(w)
  const pl = player(w)
  const visible = new Set(w.s.visible)
  const cands = spawnable.filter((p) => cheb(p, pl.pos) >= 16 && !visible.has(idx(w, p)))
  if (!cands.length) return
  const base = r.pick(cands)
  let spawned = 0
  for (const s of ev.spawn ?? []) {
    const n = r.int(s.count[0], s.count[1])
    for (const p of findSpawnNear(w, base, n)) {
      const c = createCreature(w, s.creature, p)
      c.ai.mode = 'wander'
      c.ai.dest = { ...pl.pos } // 대략 플레이어 쪽으로 배회
      c.nextAct = w.s.time + r.int(0, 100)
      w.s.creatures.push(c)
      spawned++
    }
  }
  st.lastEventTurn = turn
  st.history.push({ turn, event: ev.id })
  if (spawned === 0) return
}
