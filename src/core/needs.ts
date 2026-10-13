// 생존(열량·수분·비타민·피로·체온·젖음·기력)과 기분(사고 스택·스트레스)

import { capacity, painTotal, totalBleed } from './body'
import { clamp, log, rng, turnOf, TURNS_PER_DAY, tileAt, terrainAt, type World } from './ctx'
import { ambientTemp, daylight, isRaining } from './environment'
import { apparelItems } from './items'
import { addEffect, hasEffect, traitAdd, traitMul, traitOverride } from './traits'
import type { Creature, Thought } from './types'

export const KCAL_PER_DAY = 2500
export const WATER_PER_DAY = 2500
export const VITAMIN_PER_DAY = 2

export function newNeeds() {
  return { kcal: 1800, water: 1800, vitamin: 60, fatigue: 20, bodyTemp: 37, wetness: 0, stamina: 100, stress: 10 }
}

/** 의복 단열 (젖음 반영) */
export function insulation(w: World, c: Creature): number {
  const cdef = w.db.creature(c.def)
  let ins = cdef.insulation ?? 0
  const items = apparelItems(w, c)
  const wetFactor = 1 - (0.7 * c.needs.wetness) / 100
  let hasMidTorso = false
  for (const { def } of items) {
    const ap = def.apparel!
    if (ap.layer <= 1 && ap.groups.includes('torso')) hasMidTorso = true
  }
  for (const { def } of items) {
    const ap = def.apparel!
    ins += ap.insulation * (ap.waterproof ? 1 : wetFactor)
    // 금속 갑옷을 내피 없이 입으면 냉기가 스민다
    if (ap.insulation < 0 && !hasMidTorso) ins -= 2
  }
  return Math.round(ins * 10) / 10
}

export function hasWaterproof(w: World, c: Creature): boolean {
  return apparelItems(w, c).some(({ def }) => def.apparel?.waterproof)
}

export function comfortMin(w: World, c: Creature, sleeping = false): number {
  return 16 - 2.5 * insulation(w, c) - traitAdd(w, c, 'coldComfort') + (sleeping ? 3 : 0)
}

export function needsTick(w: World, c: Creature, sleeping: boolean) {
  const turn = turnOf(w)
  const n = c.needs
  const cdef = w.db.creature(c.def)
  const amb = ambientTemp(w, c.pos)
  const cmin = comfortMin(w, c, sleeping)
  const cold = Math.max(0, cmin - amb)

  // 대사
  let act = c.exerted ? 1.8 : 1
  if (sleeping) act *= 0.85
  n.kcal -= (KCAL_PER_DAY / TURNS_PER_DAY) * act * (1 + cold * 0.02)
  let waterMult = c.exerted ? 1.5 : 1
  if (hasEffect(c, 'dysentery', turn)) waterMult *= 3
  n.water -= (WATER_PER_DAY / TURNS_PER_DAY) * waterMult
  n.vitamin = Math.max(0, n.vitamin - VITAMIN_PER_DAY / TURNS_PER_DAY)

  // 피로
  if (sleeping) n.fatigue = Math.max(0, n.fatigue - 100 / 9600)
  else if (!hasEffect(c, 'stimulant', turn)) n.fatigue = Math.min(100, n.fatigue + 100 / 19200 * (c.exerted ? 1.5 : 1))
  if (hasEffect(c, 'sedative', turn)) n.fatigue = Math.min(100, n.fatigue + 0.02)

  // 기력
  if (!c.exerted) {
    let regen = 2.5 * capacity(w, c, 'breathing')
    if (n.fatigue > 80) regen *= 0.5
    if (n.kcal < 0) regen *= 0.5
    n.stamina = Math.min(100, n.stamina + regen)
  }

  // 젖음
  const t = tileAt(w, c.pos)
  const terr = terrainAt(w, c.pos)
  if (terr.water === 'shallow') n.wetness = Math.max(n.wetness, 60)
  if (isRaining(w) && !t.roof) {
    n.wetness = Math.min(100, n.wetness + 1.5 * (hasWaterproof(w, c) ? 0.12 : 1))
  } else {
    n.wetness = Math.max(0, n.wetness - (t.roof ? 0.12 : 0.08))
  }

  // 체온 (모피 있는 짐승은 단열이 높음)
  const fever = c.body.wounds.some((wd) => wd.infection && wd.infection.progress > 40)
  const target = fever ? 38.5 : 37
  if (cold > 0) n.bodyTemp -= cold * 0.00008
  else n.bodyTemp += (target - n.bodyTemp) * 0.003
  if (c.exerted) n.bodyTemp += 0.0004
  n.bodyTemp = clamp(n.bodyTemp, 20, 41)

  if (c.faction !== 'player') return
  warnings(w, c, cdef.label)

  // 알코올 의존
  if (traitOverride(w, c, 'alcoholNeed') && !hasEffect(c, 'drankRecently', turn)) addEffect(c, 'withdrawal', turn + 1)
}

const warned = new WeakMap<Creature, Record<string, number>>()

function warnOnce(w: World, c: Creature, key: string, text: string, kind: 'warn' | 'danger' = 'warn') {
  let m = warned.get(c)
  if (!m) { m = {}; warned.set(c, m) }
  const turn = turnOf(w)
  if (m[key] !== undefined && turn - m[key] < 2400) return
  m[key] = turn
  log(w, kind, text)
}

function warnings(w: World, c: Creature, _label: string) {
  const n = c.needs
  if (n.kcal < 500 && n.kcal > 0) warnOnce(w, c, 'hungry', '배가 고프다.')
  if (n.kcal <= 0) warnOnce(w, c, 'starving', '굶주림에 기력이 빠진다.', 'danger')
  if (n.water < 600 && n.water > 0) warnOnce(w, c, 'thirsty', '목이 마르다.')
  if (n.water <= 0) warnOnce(w, c, 'dehydrated', '입술이 갈라진다. 탈수가 시작됐다.', 'danger')
  if (n.bodyTemp < 35.5 && n.bodyTemp >= 34) warnOnce(w, c, 'cold', '몸이 떨린다. 체온이 떨어지고 있다.')
  if (n.bodyTemp < 34) warnOnce(w, c, 'hypo', '손가락에 감각이 없다. 저체온이 심해진다.', 'danger')
  if (n.fatigue > 85) warnOnce(w, c, 'tired', '눈꺼풀이 무겁다. 잠이 필요하다.')
  if (n.vitamin <= 0) warnOnce(w, c, 'scurvy', '잇몸에서 피가 난다. 신선한 것을 먹은 지 너무 오래됐다.', 'danger')
  if (n.wetness > 70) warnOnce(w, c, 'wet', '옷이 흠뻑 젖었다. 젖은 옷은 체온을 빼앗는다.')
}

/** 현재 상태에서 파생되는 사고 + 기억된 사고 */
export function activeThoughts(w: World, c: Creature): { def: string; mood: number; label: string; count: number }[] {
  const turn = turnOf(w)
  const n = c.needs
  const state: string[] = []
  if (n.kcal > 2200) state.push('Thought.Fed')
  else if (n.kcal <= 0) state.push('Thought.Starving')
  else if (n.kcal < 500) state.push('Thought.Hungry')
  if (n.water < 600) state.push('Thought.Thirsty')
  if (n.bodyTemp < 34) state.push('Thought.Freezing')
  else if (n.bodyTemp < 36) state.push('Thought.Cold')
  if (n.wetness > 60) state.push('Thought.Wet')
  const pain = painTotal(w, c)
  if (pain >= 50) state.push('Thought.SeverePain')
  else if (pain >= 15) state.push('Thought.Pain')
  if (totalBleed(w, c, true) > 3) state.push('Thought.Bleeding')
  if (n.fatigue > 85) state.push('Thought.Exhausted')
  const nightOwl = traitOverride(w, c, 'lightThreshold') !== undefined
  if (daylight(w) < 0.15 && !nightOwl) state.push('Thought.Dark')
  if (nightOwl && daylight(w) > 0.5) state.push('Thought.Daylight')
  if (hasEffect(c, 'withdrawal', turn)) state.push('Thought.Withdrawal')
  const out = state.map((id) => {
    const d = w.db.thought(id)
    return { def: id, mood: d.mood, label: d.label, count: 1 }
  })
  for (const t of c.thoughts) {
    if (t.untilTurn <= turn) continue
    const d = w.db.thought(t.def)
    out.push({ def: t.def, mood: d.mood * t.count, label: t.count > 1 ? `${d.label} ×${t.count}` : d.label, count: t.count })
  }
  return out
}

export function mood(w: World, c: Creature): number {
  return 50 + activeThoughts(w, c).reduce((s, t) => s + t.mood, 0)
}

export function addThought(w: World, c: Creature, id: string, moodOverride?: number) {
  if (c.faction !== 'player') return
  const d = w.db.thought(id)
  if (moodOverride === 0) return
  const turn = turnOf(w)
  const ex: Thought | undefined = c.thoughts.find((t) => t.def === id && t.untilTurn > turn)
  if (ex) {
    ex.count = Math.min(d.stack ?? 1, ex.count + 1)
    ex.untilTurn = turn + d.durationTurns
  } else c.thoughts.push({ def: id, untilTurn: turn + d.durationTurns, count: 1 })
  c.thoughts = c.thoughts.filter((t) => t.untilTurn > turn)
}

/** 스트레스·정신붕괴 (플레이어, 10턴마다) */
export function psycheTick(w: World, c: Creature) {
  const turn = turnOf(w)
  if (turn % 10 !== 0) return
  const m = mood(w, c)
  const n = c.needs
  if (m < 30) n.stress += (30 - m) * 0.015 * traitMul(w, c, 'stressMult')
  else if (m > 50) n.stress -= 0.2
  if (hasEffect(c, 'sedative', turn)) n.stress -= 0.5
  n.stress = clamp(n.stress, 0, 100)
  if (n.stress >= 100 && turn % 100 === 0 && !hasEffect(c, 'panic', turn)) {
    const r = rng(w, 'body')
    if (r.chance(0.35)) {
      addEffect(c, 'panic', turn + r.int(3, 6))
      log(w, 'danger', '숨이 가빠지고 손이 떨린다. 공황이 왔다. 몸이 말을 듣지 않는다.')
      c.history.push({ turn, kind: 'breakdown', text: '정신붕괴: 공황' })
      n.stress = 40
      addThought(w, c, 'Thought.Breakdown')
    }
  }
}
