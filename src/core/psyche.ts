import type {RngStream} from './rng'
import {knownCreatureName} from './bestiary-state'
import { drugEffects } from './drug-state'
// 04 §4~6: 시간당 스트레스, 붕괴 18종, 고양. 종류·가중치·지속은 JSON Def.
import { sortForPacking, type Action } from './actions'
import { addWound, bloodLoss, bodyDef, hostileNear, regionState } from './body'
import { creatureAt, isPassable, log, player, rng, tileAt, turnOf, TURNS_PER_HOUR, TURNS_PER_DAY, type World } from './ctx'
import { canSee } from './fov'
import { cheb, DIRS } from './geom'
import { itemDef, itemSize, unequip } from './items'
import { findPath } from './path'
import { willForChecks } from './growth'
import { bleedingEnemyNear } from './temperament'
import { fireWarmth } from './thermal'
import { addThought, mood } from './thoughts'
import { traumaBreakdown, traumaTick } from './trauma'
import { emitNoise } from './perception'
import { addEffect, hasEffect, traitAdd, traitMul } from './traits'
import type { BreakDef, Creature } from './types'
export const psycheStream=(c:Creature):RngStream=>c.faction==='player'?'body':('body.npc.'+c.id)as RngStream

export function breakdownChances(stress: number, will: number, mult = 1, resistance = 1) {
  const resist = Math.max(0, Math.min(will >= 15 ? 0.7 : 1, resistance))
  return { minor: stress >= 50 ? (2 + (stress - 50) * 0.2) * resist * mult : 0, moderate: stress >= 70 ? (2 + (stress - 70) * 0.4) * resist * mult : 0, extreme: stress >= 90 ? (3 + (stress - 90) * 1.5) * resist * mult : 0 }
}

export function startBreakdown(w: World, c: Creature, def: BreakDef, stream=psycheStream(c)) {
  if(!c.alive||bodyDef(w,c).kind!=='humanoid')return
  const r = rng(w, stream), turn = turnOf(w)
  traumaBreakdown(w, c)
  c.breakdown = { def: def.id, kind: def.kind, until: turn + r.int(...def.turns), remaining: def.kind === 'drink' ? 3 : def.kind === 'drugs' ? r.int(1, 2) : def.kind === 'drop' ? r.int(1, 3) : r.int(2, 3), hp: c.hp }
  c.effects = c.effects.filter((e) => e.kind !== 'crying')
  if (def.kind === 'selfharm') {
    const arm = bodyDef(w, c).parts.find((p) => p.groups.includes('forearm') && !c.body.missing.includes(p.id))
    if (arm) {
      const severity = r.int(3, 6)
      addWound(w, c, { def: 'Wound.Cut', part: arm.id, severity, source: '정신붕괴' })
      c.hp -= severity
    }
  }
  if (def.kind === 'breakgear') {
    const gear = Object.values(c.equip).filter((it) => it && it.durability !== undefined)
    const it = r.pick(gear)
    if (it) it.durability = Math.max(0, (it.durability ?? 100) - 50)
  }
  if (def.kind === 'despair' && c.equip.back && r.chance(0.3)) {
    const cloak = c.equip.back
    if (unequip(w, c, 'back')) { delete c.equip.back; tileAt(w, c.pos).items.push({ ...cloak, gx: undefined, gy: undefined }) }
  }
  if (def.kind === 'voices') {
    const spots = w.s.map.tiles.map((_, i) => ({ x: i % w.s.map.w, y: Math.floor(i / w.s.map.w) })).filter((p) => isPassable(w, p) && cheb(p, c.pos) >= 12)
    c.breakdown.dest = r.pick(spots)
  }
  if (def.kind === 'cry') addEffect(c, 'crying', c.breakdown.until)
  if(c.id===w.s.playerId)log(w,'danger','더는 버틸 수 없다. 정신붕괴: '+def.label+'.')
  else if(canSee(w,player(w),c.pos))log(w,'warn',knownCreatureName(w,c)+'이(가) 흔들린다. '+def.label+'.')
  c.history.push({ turn, kind: 'breakdown', text: `정신붕괴: ${def.label}` })
  if (def.kind === 'selfharm' || def.kind === 'breakgear') endBreakdown(w, c)
}

/** 해소는 붕괴를 견딘 뒤 한 번만 적용한다(04 §4). */
export function endBreakdown(w: World, c: Creature) {
  const b = c.breakdown
  if (!b) return
  const def = w.db.get<BreakDef>(b.def)
  c.breakdown = undefined
  c.effects = c.effects.filter((e) => e.kind !== 'crying')
  c.needs.stress = Math.max(0, c.needs.stress - (def.tier === 'minor' ? 15 : def.tier === 'moderate' ? 30 : 50))
  addThought(w, c, 'Thought.Breakdown')
  if(c.id===w.s.playerId)log(w,'info',def.label+'에서 벗어났다. 쌓인 긴장이 조금 풀렸다.')
  else if(canSee(w,player(w),c.pos))log(w,'info',knownCreatureName(w,c)+'이(가) '+def.label+'에서 벗어났다.')
}

export function psycheTick(w: World, c: Creature) {
  if(c.faction!=='player'||bodyDef(w,c).kind!=='humanoid')return
  const turn = turnOf(w), n = c.needs
  const traumaAcute = traumaTick(w, c)
  const b = c.breakdown
  if (b && (turn >= b.until || (b.kind === 'lie' && c.hp < b.hp))) endBreakdown(w, c)
  if (c.breakdown?.kind === 'mutter' && turn % 10 === 0) emitNoise(w, c.pos, 2, c.id)
  if (c.breakdown?.kind === 'cry' && turn % 10 === 0) emitNoise(w, c.pos, 4, c.id)
  if (traitAdd(w, c, 'sneakMutter') > 0 && c.sneaking && !c.asleep && !c.unconscious && turn % 10 === 0 && rng(w, 'body').chance(traitAdd(w, c, 'sneakMutter'))) emitNoise(w, c.pos, 2, c.id)
  if (!hostileNear(w, c) && (tileAt(w, c.pos).roof || fireWarmth(w, c) >= 8)) c.lastSafe = { map: w.s.map.id, pos: { ...c.pos } }
  const m0 = mood(w, c)
  if (m0 < 85) c.goodMoodSince = undefined
  else {
    c.goodMoodSince ??= turn
    if (turn - c.goodMoodSince >= 12 * TURNS_PER_HOUR && turn % (6 * TURNS_PER_HOUR) === 0 && c.lastElationRoll !== turn) {
      c.lastElationRoll = turn
      if (rng(w, 'body').chance(0.05)) {
        if (rng(w, 'body').chance(0.5)) addEffect(c, 'elation', turn + TURNS_PER_DAY)
        else n.stress = Math.max(0, n.stress - 20)
        log(w, 'good', '마음이 맑게 고양된다. 오늘은 무엇이든 해낼 수 있을 것 같다.')
      }
    }
  }
  if (turn % TURNS_PER_HOUR === 0) {
    const m = mood(w, c)
    if (m < 40) n.stress += (40 - m) * 0.1 * Math.max(0, 1 - (willForChecks(w, c) - 10) * 0.04) * traitMul(w, c, 'stressMult')
    else if (m > 55) n.stress -= (m - 55) * 0.06 * (c.activity?.kind === 'sleep' ? 2 : 1)
    if (hasEffect(c, 'sedative', turn) || drugEffects(w, c).sedated) n.stress -= 5
    if (traitAdd(w, c, 'bloodStressRecovery') && bleedingEnemyNear(w, c)) n.stress -= traitAdd(w, c, 'bloodStressRecovery')
    n.stress = Math.max(0, Math.min(100, n.stress))
  }
  const prev = c.psycheWatch ?? { lowHp: false, blood: false, afraid: false }
  const severe = (['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg'] as const).some((r) => regionState(w, c, r) >= 3)
  const now = { lowHp: false, blood: bloodLoss(c) >= 0.3, afraid: false, severe }
  const acute = (now.severe && !prev.severe) || (now.blood && !prev.blood)
  c.psycheWatch = now
  if (c.breakdown || (turn % TURNS_PER_HOUR !== 0 && !acute && !traumaAcute)) return
  const def=chooseBreakdown(w,c,Math.max(acute?2:1,traumaAcute))
  if(def)startBreakdown(w,c,def)
}

export function chooseBreakdown(w:World,c:Creature,acuteMult=1,stream=psycheStream(c)):BreakDef|undefined{
  if(!c.alive||bodyDef(w,c).kind!=='humanoid')return undefined
  const chance = breakdownChances(c.needs.stress, willForChecks(w, c), acuteMult, traitMul(w, c, 'breakdownMult'))
  const r = rng(w, stream), roll = r.range(0, 100)
  const tier = roll < chance.extreme ? 'extreme' : roll < chance.extreme + chance.moderate ? 'moderate' : roll < chance.extreme + chance.moderate + chance.minor ? 'minor' : undefined
  if (!tier) return undefined
  const danger = hostileNear(w, c)
  const defs = w.db.all<BreakDef>('Break').filter((d) => d.tier === tier && (!danger || !['wander', 'organize'].includes(d.kind)) && (!d.requires || c.bag.some((i) => d.requires === 'food' ? !!itemDef(w, i).food : d.requires === 'drug' ? ['painkiller', 'stimulant'].includes(itemDef(w, i).drug?.effect ?? '') : !!itemDef(w, i).drink?.alcohol)))
  const def = r.weighted(defs, (d) => d.weight * (danger && ['flee', 'berserk'].includes(d.kind) ? 2 : 1) * (d.kind === 'despair' && ['ashrain', 'ashstorm'].includes(w.s.weather) ? 2 : 1) * (d.kind === 'voices' && c.background === 'Bg.Excommunicate' ? 2 : 1) * (d.kind === 'drop' && c.bag.reduce((n, i) => n + itemSize(w, i)[0] * itemSize(w, i)[1], 0) >= 54 ? 3 : 1) * c.traits.reduce((n, t) => n * (d.traitWeights?.[t] ?? 1), 1))
  return def
}

/** 통제 상실 행동은 짧게 진행하고, 수동 증상에서는 입력을 돌려준다 */
export function breakdownAction(w: World, c: Creature): Action | null {
  if(!c.alive||bodyDef(w,c).kind!=='humanoid')return null
  const b = c.breakdown
  if (!b) return null
  if (turnOf(w) >= b.until) { endBreakdown(w, c); return null }
  if (b.kind === 'catatonia') return { type: 'wait' }
  if (b.kind === 'drop') {
    const protectedDefs = new Set(c.hotbar.filter((h) => h?.kind === 'item').map((h) => h!.kind === 'item' ? h!.def : ''))
    const pool = sortForPacking(w, c.bag.filter((i) => !protectedDefs.has(i.def)))
    pool.sort((a, z) => itemSize(w, z)[0] * itemSize(w, z)[1] - itemSize(w, a)[0] * itemSize(w, a)[1])
    if (!pool.length || b.remaining-- <= 0) { endBreakdown(w, c); return null }
    return { type: 'drop', uid: pool[0].uid }
  }
  if (b.kind === 'drugs') {
    const it = c.bag.find((i) => ['painkiller', 'stimulant'].includes(itemDef(w, i).drug?.effect ?? ''))
    if (!it || b.remaining-- <= 0) { endBreakdown(w, c); return null }
    return { type: 'consume', uid: it.uid }
  }
  if (b.kind === 'organize') {
    if (hostileNear(w, c)) { endBreakdown(w, c); return null }
    return (b.until - turnOf(w)) % 20 === 0 ? { type: 'sortBag' } : { type: 'wait' }
  }
  if (['wander', 'despair', 'voices', 'berserk'].includes(b.kind)) {
    if (b.kind === 'wander' && hostileNear(w, c)) { endBreakdown(w, c); return null }
    if (b.kind === 'berserk') {
      const targets = w.s.creatures.filter((o) => o.id !== c.id && o.alive && canSee(w, c, o.pos)).sort((a, z) => cheb(c.pos, a.pos) - cheb(c.pos, z.pos) || a.id - z.id)
      if (targets[0]) {
        if (cheb(c.pos, targets[0].pos) <= 1) return { type: 'attack', target: targets[0].id }
        return toward(w, c, targets[0].pos)
      }
    }
    if (b.kind === 'voices' && b.dest) return toward(w, c, b.dest)
    const steps = DIRS.map((d, dir) => ({ dir, pos: { x: c.pos.x + d.x, y: c.pos.y + d.y } })).filter((s) => isPassable(w, s.pos) && !creatureAt(w, s.pos))
    const step = rng(w, psycheStream(c)).pick(steps)
    return step ? { type: 'move', dir: step.dir } : { type: 'wait' }
  }
  if (b.kind === 'binge' || b.kind === 'drink') {
    const it = c.bag.find((i) => b.kind === 'binge' ? !!itemDef(w, i).food : !!itemDef(w, i).drink?.alcohol)
    if (!it || b.remaining <= 0) { endBreakdown(w, c); return null }
    b.remaining--
    return { type: 'consume', uid: it.uid }
  }
  if (b.kind === 'flee') {
    const enemies = w.s.creatures.filter((o) => o.alive && o.faction !== c.faction && o.faction !== 'vermin' && canSee(w, c, o.pos))
    if (!enemies.length) {
      const safe = c.lastSafe?.map === w.s.map.id ? c.lastSafe.pos : w.s.map.waypoints?.homeFire
      if (!safe || cheb(c.pos, safe) <= 1) { endBreakdown(w, c); return null }
      return toward(w, c, safe)
    }
    const steps = DIRS.map((d, dir) => ({ dir, pos: { x: c.pos.x + d.x, y: c.pos.y + d.y } })).filter((s) => isPassable(w, s.pos) && !creatureAt(w, s.pos))
    steps.sort((a, b) => Math.min(...enemies.map((e) => cheb(b.pos, e.pos))) - Math.min(...enemies.map((e) => cheb(a.pos, e.pos))))
    return steps.length ? { type: 'move', dir: steps[0].dir } : { type: 'wait' }
  }
  return null
}

function toward(w: World, c: Creature, pos: { x: number; y: number }): Action {
  const p = findPath(w, c.pos, pos, { avoidCreatures: true, selfId: c.id, maxNodes: 3000 })?.[0]
  if (!p) return { type: 'wait' }
  const dir = DIRS.findIndex((d) => d.x === p.x - c.pos.x && d.y === p.y - c.pos.y)
  return dir >= 0 ? { type: 'move', dir } : { type: 'wait' }
}
