import {landscapeThoughts} from './landscape-thoughts'
import {corpseOdorThoughts} from './corpse-thoughts'
import {heardSoundThoughts} from './sound-thoughts'
import {conditionThoughts} from './condition-thoughts'
import {npcThoughtEvent} from './npc-psyche'
import {isolationThoughts} from './social-state'
import {hallucinating} from './hallucination-state'
import { alcoholStage, drugThoughts, pharmacologyDef, withdrawalStage } from './drug-state'
// 사고 인스턴스별 감쇠·중첩·그룹. 옛 count/untilTurn 저장도 읽는다.
import { hungerBand, thirstBand } from './nutrition-state'
import { bodyDef, totalBleed } from './body'
import { turnOf, type World } from './ctx'
import { daylight } from './environment'
import { temperamentThoughts } from './temperament'
import { fearActive, traumaLabel } from './fear-state'
import { hasEffect, traitMul, traitOverride } from './traits'
import type { Creature, Thought, ThoughtDef, TraumaDef } from './types'

export interface ActiveThought { def: string; mood: number; label: string; count: number; remaining?: number }
function events(t: Thought, d: ThoughtDef) {
  return t.events ?? Array.from({ length: Math.min(t.count, d.stack ?? 1) }, () => ({ at: t.untilTurn - d.durationTurns, untilTurn: t.untilTurn, mood: undefined as number | undefined }))
}
function value(d: ThoughtDef, e: ReturnType<typeof events>[number], turn: number) {
  let mult = 1
  if (d.decay === 'linear') mult = Math.min(1, (e.untilTurn - turn) / Math.max(1, e.untilTurn - e.at))
  if (d.decay === 'step') {
    let after = -1
    for (const step of d.steps ?? []) if (step.afterTurns <= turn - e.at && step.afterTurns > after) { after = step.afterTurns; mult = step.mult }
  }
  return Math.trunc((e.mood ?? d.mood) * mult)
}
export function activeThoughts(w: World, c: Creature): ActiveThought[] {
  if(bodyDef(w,c).kind!=='humanoid')return[]
  const turn = turnOf(w), state: string[] = conditionThoughts(w,c)
  const hunger = hungerBand(w, c).thought, thirst = thirstBand(w, c).thought
  if (hunger) state.push(hunger)
  if (thirst) state.push(thirst)
  if (totalBleed(w, c, true) > 3) state.push('Thought.Bleeding')
  const nightOwl = traitOverride(w, c, 'lightThreshold') !== undefined
  if (nightOwl && daylight(w) < 0.15) state.push('Thought.Night')
  if (nightOwl && daylight(w) > 0.5) state.push('Thought.Daylight')
  if(hallucinating(w,c))state.push('Thought.Hallucination')
  if (hasEffect(c, 'foodPoisoning', turn)) state.push('Thought.FoodPoisoning')
  if (hasEffect(c, 'lice', turn)) state.push('Thought.Lice')
  const withdrawal = withdrawalStage(w, c), alcohol = alcoholStage(w,c)
  if (withdrawal || hasEffect(c, 'withdrawal', turn)) state.push('Thought.Withdrawal')
  if (alcohol) state.push('Thought.Drunk')
  state.push(...drugThoughts(w,c))
  const out: ActiveThought[] = [...new Set(state)].map((id) => {
    const d=w.db.thought(id)
    let mood=d.conditionMoodKey?traitOverride(w,c,d.conditionMoodKey)??d.mood:d.mood,label=d.label
    if(id==='Thought.Drunk'){
      const base=pharmacologyDef(w).alcoholMoods?.[alcohol-1]??d.mood
      mood=traitOverride(w,c,'alcoholMood')??base*traitMul(w,c,'alcoholMoodMult')
      label+=' '+alcohol+'단계'
    }else if(id==='Thought.Withdrawal'&&withdrawal){
      const rules=pharmacologyDef(w)
      mood=rules.withdrawalMoods?.[withdrawal-1]??rules.withdrawalMood
      label+=' '+withdrawal+'단계'
    }
    return {def:id,mood,label,count:1}
  })
  out.push(...isolationThoughts(w,c),...heardSoundThoughts(w,c),...corpseOdorThoughts(w,c),...landscapeThoughts(w,c))
  // 한 Def를 여러 행으로 저장한 구형 수면 기록도 통합한다.
  const grouped = new Map<string, ReturnType<typeof events>>()
  for (const t of c.thoughts) {
    // 구형 각인의 원본 기억은 보존하고, 실제 현재 약물 상태와 중복 표시하지 않는다.
    if((t.def==='Thought.Drunk'||t.def==='Thought.Withdrawal')&&state.includes(t.def))continue
    const d = w.db.thought(t.def)
    grouped.set(t.def, [...(grouped.get(t.def) ?? []), ...events(t, d).filter((e) => e.untilTurn > turn)])
  }
  for (const [id, list] of grouped) {
    if (!list.length) continue
    const d = w.db.thought(id), chosen = list.sort((a, b) => b.at - a.at).slice(0, d.stack ?? 1)
    let mult = 1, sum = 0
    for (const e of chosen) { sum += value(d, e, turn) * mult; mult *= d.stackMult ?? 1 }
    out.push({ def: id, mood: Math.trunc(sum), label: chosen.length > 1 ? `${d.label} ×${chosen.length}` : d.label, count: chosen.length, remaining: Math.max(...chosen.map((e) => e.untilTurn - turn)) })
  }
  const groups = new Map<string, ActiveThought>()
  const filtered = out.filter((t) => {
    const group = w.db.thought(t.def).replaceGroup
    if (!group) return true
    const prev = groups.get(group)
    if (!prev || Math.abs(t.mood) > Math.abs(prev.mood)) groups.set(group, t)
    return false
  })
  filtered.push(...groups.values())
  for (const t of c.traumas ?? []) {
    const d = w.db.get<TraumaDef>(t.def)
    if (d.mood && fearActive(w, c, t)) filtered.push({ def: t.def, mood: d.mood, label: traumaLabel(w, t), count: 1 })
  }
  filtered.push(...temperamentThoughts(w, c))
  return filtered
}
export function mood(w: World, c: Creature): number {
  return Math.max(0, Math.min(100, 50 + activeThoughts(w, c).reduce((s, t) => s + t.mood, 0)))
}
export function addThought(w: World, c: Creature, id: string, moodOverride?: number) {
  if(bodyDef(w,c).kind!=='humanoid')return
  if (moodOverride === 0) return
  const d = w.db.thought(id), turn = turnOf(w)
  if (d.durationTurns <= 0) return
  const old = c.thoughts.filter((t) => t.def === id).flatMap((t) => events(t, d)).filter((e) => e.untilTurn > turn)
  let mood = moodOverride
  if (['Thought.KilledHuman', 'Thought.FirstHumanKill', 'Thought.KilledFevered'].includes(id)) mood = (mood ?? d.mood) * traitMul(w, c, 'killMoodMult')
  if (id === 'Thought.KilledBeast') mood = traitOverride(w, c, 'beastMood') ?? mood
  if (id === 'Thought.AteRaw') mood = traitOverride(w, c, 'rawMood') ?? mood
  if (['Thought.AteRaw', 'Thought.AteGood', 'Thought.FineMeal'].includes(id)) mood = (mood ?? d.mood) * traitMul(w, c, 'tasteMoodMult')
  if (id === 'Thought.Drunk') mood = traitOverride(w, c, 'alcoholMood') ?? (mood ?? d.mood) * traitMul(w, c, 'alcoholMoodMult')
  if (id === 'Thought.Fled') mood = traitOverride(w, c, 'fledMood') ?? mood
  if (mood === 0) return
  if (id === 'Thought.NearDeath') mood = (mood ?? d.mood) * traitMul(w, c, 'nearDeathMoodMult')
  if(c.faction!=='player'){npcThoughtEvent(w,c,id,mood??d.mood);return}
  old.push({ at: turn, untilTurn: turn + d.durationTurns, mood })
  // 최대 수를 넘으면 현재 실효값이 약한 기억부터 버리고, 동률이면 오래된 것을 버린다.
  const keep = old.sort((a, b) => Math.abs(value(d, b, turn)) - Math.abs(value(d, a, turn)) || b.at - a.at).slice(0, d.stack ?? 1).sort((a, b) => b.at - a.at)
  c.thoughts = c.thoughts.filter((t) => t.def !== id && t.untilTurn > turn)
  c.thoughts.push({ def: id, untilTurn: Math.max(...keep.map((e) => e.untilTurn)), count: keep.length, events: keep })
}
