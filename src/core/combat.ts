// 공격 판정 파이프라인 (체력 층 + 상처 층):
// 1 명중 → 2 방어 반응(막기/받아넘기기) → 3 부위 결정 → 4 방어구 층 → 5 HP 피해·상처 → 6 2차 효과

import {
  addWound, bloodLoss, bodyDef, capacity, isMissing, painTotal, part, partMap, partRegion, regionPenalties, totalBleed,
} from './body'
import { clamp, creatureAt, log, player, rng, turnOf, type World } from './ctx'
import { lightAt } from './fov'
import { cheb, dirDelta, dirIndex, type Pos } from './geom'
import { allItems, apparelItems, currentAttack, itemDef, makeItem } from './items'
import { addThought } from './needs'
import { emitNoise } from './perception'
import { gainXp } from './progression'
import { addEffect, effectMag, hasEffect, traitAdd, traitMul, traitOverride } from './traits'
import type { AbilityAttackMods, ArmorCategory, AttackDef, BodyPartDef, Creature, DamageType, FxEvent } from './types'

const SIZE_EVASION: Record<string, number> = { tiny: 8, small: 4, medium: 0, large: -8 }
const SIZE_RANK: Record<string, number> = { tiny: 0, small: 1, medium: 2, large: 3 }

/** 회피치 = (민첩 − 10) × 2 + 장비·능력 보정 + 크기 − 다리 상태, × 이동 능력 */
export function evasion(w: World, c: Creature): number {
  if (c.unconscious || c.asleep || c.ai.mode === 'surrender' || hasEffect(c, 'knockedDown', turnOf(w))) return -100
  const cdef = w.db.creature(c.def)
  let e = (c.stats.agi - 10) * 2 + (cdef.evasion ?? 0) + traitAdd(w, c, 'evasion') + (SIZE_EVASION[cdef.sizeClass] ?? 0)
  e -= regionPenalties(w, c).evasion
  e *= capacity(w, c, 'moving')
  if (c.needs.stamina < 10) e -= 10
  if (c.equip.chest && c.equip.chest.def === 'Item.ScrapMail') e -= 4
  return e
}

/** 공격치 = 무기 정확도 + (민첩 − 10) × 1.5 + (지각 − 10) + 보정 */
export function attackScore(w: World, a: Creature, atk: AttackDef): number {
  return (atk.accuracy ?? 10) + (a.stats.agi - 10) * 1.5 + (a.stats.per - 10)
    + traitAdd(w, a, 'hitBonus') + traitAdd(w, a, 'hitBonus_' + atk.skill) - regionPenalties(w, a).hit
}

export function facingRelation(defender: Creature, attackerPos: Pos): 'front' | 'side' | 'back' {
  const toAtt = dirIndex(attackerPos.x - defender.pos.x, attackerPos.y - defender.pos.y)
  const d = dirDelta(defender.facing, toAtt)
  return d <= 1 ? 'front' : d === 2 ? 'side' : 'back'
}

export interface HitPreview { chance: number; lines: string[]; attack: AttackDef }

export function previewHit(w: World, a: Creature, d: Creature, ranged = false, mods?: AbilityAttackMods): HitPreview | null {
  const atk = currentAttack(w, a)
  if (!atk) return null
  const lines: string[] = []
  const as = attackScore(w, a, atk)
  const ev = Math.max(-30, evasion(w, d))
  let chance = 50 + (as - ev) * 2
  lines.push(`기본 50 + (공격치 ${as.toFixed(0)} − 회피치 ${ev.toFixed(0)}) × 2 = ${chance.toFixed(0)}`)
  const add = (label: string, v: number) => { if (v !== 0) { chance += v; lines.push(`${label} ${v > 0 ? '+' : ''}${v.toFixed(0)}`) } }
  const rel = facingRelation(d, a.pos)
  if (!d.unconscious && !d.asleep) add(rel === 'back' ? '후면' : rel === 'side' ? '측면' : '정면', rel === 'back' ? 20 : rel === 'side' ? 10 : 0)
  const light = lightAt(w, d.pos)
  if (light < 0.2) add('어둠', -10)
  else if (light < 0.4) add('어스름', -5)
  // 통증·손 상태는 부위 상태(공격치)와 겹치므로 작게, 상한을 둔다
  const pain = clamp(Math.floor(painTotal(w, a) / 20), 0, 6)
  add('통증', -pain * 2)
  const manip = capacity(w, a, 'manipulation')
  if (manip < 0.95 && atk.skill !== 'bite') add('손 상태', -Math.min(12, Math.round((1 - manip) * 20)))
  if (a.needs.fatigue > 80) add('피로', -10)
  if (a.needs.bodyTemp < 35) add('추위 떨림', -10)
  if (hasEffect(a, 'alcohol', turnOf(w))) add('취기', -5)
  if (hasEffect(a, 'spores', turnOf(w))) add('포자 기침', -10)
  if (ranged) {
    const dist = cheb(a.pos, d.pos)
    const pen = Math.max(0, dist - 3) * 3
    add('거리', -(traitAdd(w, a, 'rangePenaltyHalf') > 0 ? pen / 2 : pen))
    add('원거리 특성', traitAdd(w, a, 'rangedHit'))
    add('시력', -Math.round((1 - capacity(w, a, 'sight')) * 30))
    if (a.needs.wetness > 60) add('젖은 시위', -10)
  } else if (cheb(a.pos, d.pos) === 2) add('거리 유지', traitAdd(w, a, 'reachHit'))
  if (mods?.hitBonus) add('능력', mods.hitBonus)
  const bh = traitAdd(w, a, 'bloodHit')
  if (bh && totalBleed(w, d, true) > 2) add('피 냄새', bh)
  if (d.unconscious || d.asleep || hasEffect(d, 'knockedDown', turnOf(w))) {
    chance = 95
    lines.push(d.asleep ? '잠든 상대 → 95' : '쓰러진 상대 → 95')
  }
  chance = clamp(chance, 5, 95)
  lines.push(`최종 ${chance.toFixed(0)}% (5~95 제한)`)
  return { chance, lines, attack: atk }
}

/** 3 부위 결정: 노출 면적 가중 + 신장 차이 + 능력의 부위 가중 */
export function pickPart(w: World, a: Creature, d: Creature, mods?: AbilityAttackMods): BodyPartDef {
  const r = rng(w, 'combat')
  const bdef = bodyDef(w, d)
  const map = partMap(bdef)
  const abs = new Map<string, number>()
  for (const p of bdef.parts) {
    const parentAbs = p.parent ? abs.get(p.parent) ?? 0 : 1
    abs.set(p.id, parentAbs * p.coverage)
  }
  const sizeDiff = SIZE_RANK[w.db.creature(a.def).sizeClass] - SIZE_RANK[w.db.creature(d.def).sizeClass]
  const candidates = bdef.parts.filter((p) => !p.internal && !isMissing(w, d, p.id))
  const pick = r.weighted(candidates, (p) => {
    let own = abs.get(p.id)!
    for (const ch of bdef.parts) if (ch.parent === p.id && !ch.internal && !isMissing(w, d, ch.id)) own -= abs.get(ch.id)!
    let mult = 1
    if (!d.unconscious && !d.asleep) {
      if (sizeDiff <= -2) mult = p.height === 'high' ? 0.02 : p.height === 'low' ? 3 : 0.4
      else if (sizeDiff === -1) mult = p.height === 'high' ? 0.25 : p.height === 'low' ? 2.2 : 1
      if (sizeDiff >= 1) mult = p.height === 'low' ? 0.5 : p.height === 'high' ? 1.4 : 1
    }
    const pw = mods?.partWeights
    if (pw) {
      mult *= pw[partRegion(w, d, p.id)] ?? 1
      if (p.id === 'Neck' && pw.neck) mult *= pw.neck
    }
    return Math.max(0, own) * mult
  })
  return pick ?? map.get(bdef.parts[0].id)!
}

function armorCategory(t: DamageType): ArmorCategory {
  return t === 'blunt' ? 'blunt' : t === 'burn' ? 'heat' : 'sharp'
}

const WOUND_FOR: Record<DamageType, string> = {
  cut: 'Wound.Cut', stab: 'Wound.Stab', blunt: 'Wound.Bruise', bite: 'Wound.Bite', burn: 'Wound.Burn',
}

export interface AttackResult { hit: boolean; damage: number; killed: boolean }
export interface AttackOpts { ranged?: boolean; mods?: AbilityAttackMods; abilityLabel?: string; counter?: boolean }

export function fx(w: World, ev: FxEvent) {
  w.s.fx.push(ev)
  if (w.s.fx.length > 80) w.s.fx.splice(0, w.s.fx.length - 80)
}

export function wake(w: World, c: Creature, why: string) {
  if (!c.asleep) return
  c.asleep = false
  c.ai.alertTurn = turnOf(w)
  fx(w, { k: 'status', id: c.id, text: '!', color: '#ffd060', turn: turnOf(w) })
  if (c.faction !== 'player' && w.s.visible.includes(c.pos.y * w.s.map.w + c.pos.x)) log(w, 'warn', `${c.name}이(가) 깨어났다. (${why})`)
}

export function resolveAttack(w: World, a: Creature, d: Creature, opts: AttackOpts = {}): AttackResult {
  const r = rng(w, 'combat')
  const turn = turnOf(w)
  const mods = opts.mods
  const pv = previewHit(w, a, d, opts.ranged, mods)
  const res: AttackResult = { hit: false, damage: 0, killed: false }
  if (!pv) return res
  const atk = pv.attack
  const detail: string[] = [...pv.lines]
  const isPlayer = a.faction === 'player' || d.faction === 'player'
  const aName = a.faction === 'player' ? '당신' : a.name
  const dName = d.faction === 'player' ? '당신' : d.name
  const label = opts.abilityLabel ?? atk.label
  const sneakAttack = !!d.asleep

  a.exerted = true
  // 기본 공격은 기력을 거의 쓰지 않는다 (능력은 별도 비용)
  a.needs.stamina = Math.max(0, a.needs.stamina - (opts.abilityLabel ? 0 : atk.stamina * 0.15))
  a.facing = dirIndex(d.pos.x - a.pos.x, d.pos.y - a.pos.y)
  fx(w, { k: 'attack', id: a.id, target: d.id, turn })
  emitNoise(w, a.pos, (atk.noise ?? 4) + 1, a.id)
  d.ai.alertTurn = turn
  noteFight(w, a, d)

  // 1 명중
  const roll = r.float() * 100
  detail.push(`주사위 ${roll.toFixed(1)} vs ${pv.chance.toFixed(0)}`)
  if (roll >= pv.chance) {
    fx(w, { k: 'miss', id: d.id, turn })
    wake(w, d, '빗나간 공격')
    if (isPlayer) log(w, 'combat', `${aName}의 ${label} — ${dName}에게 빗나갔다.`, detail)
    return res
  }

  // 2 방어 반응
  const rel = facingRelation(d, a.pos)
  if (!d.unconscious && !d.asleep && rel !== 'back' && d.ai.mode !== 'surrender' && !opts.ranged && !hasEffect(d, 'knockedDown', turn)) {
    const sh = d.equip.off
    const shDef = sh ? itemDef(w, sh).shield : undefined
    if (shDef && rel === 'front' && d.needs.stamina >= shDef.stamina) {
      const bc = shDef.block - regionPenalties(w, d).block
      d.needs.stamina -= shDef.stamina
      d.exerted = true
      if (r.float() * 100 < bc) {
        detail.push(`방패 막기 ${bc.toFixed(0)}% 성공`)
        emitNoise(w, d.pos, 6, d.id)
        fx(w, { k: 'block', id: d.id, turn })
        if (isPlayer) log(w, 'combat', `${dName}이(가) 방패로 ${aName}의 ${label}을(를) 막았다.`, detail)
        return res
      }
      detail.push(`방패 막기 ${bc.toFixed(0)}% 실패`)
    } else {
      const mw = d.equip.main
      const mdef = mw ? itemDef(w, mw) : undefined
      if (mdef?.attack && !mdef.ranged && d.needs.stamina >= 8) {
        const pc = 8 + (d.stats.agi - 10) * 1.5 - (rel === 'side' ? 5 : 0) + effectMag(d, 'parryStance', turn)
        if (r.float() * 100 < pc) {
          d.needs.stamina -= 8
          d.exerted = true
          detail.push(`받아넘기기 ${pc.toFixed(0)}% 성공`)
          fx(w, { k: 'parry', id: d.id, turn })
          if (isPlayer) log(w, 'combat', `${dName}이(가) ${aName}의 ${label}을(를) 받아넘겼다.`, detail)
          if (hasEffect(d, 'parryStance', turn) && !opts.counter && canReach(w, d, a)) {
            if (isPlayer) log(w, 'combat', `${dName}의 반격!`)
            resolveAttack(w, d, a, { counter: true, abilityLabel: '반격' })
          }
          return res
        }
      }
    }
  }

  // 3 부위
  const pd = pickPart(w, a, d, mods)
  detail.push(`부위: ${pd.label}`)

  // 피해량
  let dmg = atk.damage * r.range(0.85, 1.15)
  if (atk.skill !== 'archery' && atk.skill !== 'bite') dmg *= 1 + (a.stats.str - 10) * 0.04
  if (atk.skill === 'bite') dmg *= 0.6 + 0.4 * capacity(w, a, 'manipulation')
  dmg *= regionPenalties(w, a).damageMult * (mods?.damageMult ?? 1)
  if (totalBleed(w, d, true) > 1) dmg *= 1 + traitAdd(w, a, 'dmgVsBleeding')
  if (sneakAttack) { dmg *= 1.5; detail.push('기습 ×1.5') }
  let dtype: DamageType = atk.damageType
  detail.push(`피해 ${dmg.toFixed(1)} (${dtype})`)

  // 4 방어구 층 (바깥부터)
  const pen = atk.armorPen + (mods?.armorPenBonus ?? 0)
  const covering = apparelItems(w, d)
    .filter(({ def }) => def.apparel!.groups.some((g) => pd.groups.includes(g)))
    .sort((x, y) => y.def.apparel!.layer - x.def.apparel!.layer)
  const deflectDiv = traitAdd(w, a, 'deflectHalf') > 0 ? 4 : 2
  for (const { it, def } of covering) {
    const cat = armorCategory(dtype)
    const armorVal = (def.apparel!.armor[cat] ?? 0) * (it.durability !== undefined ? 0.5 + 0.5 * it.durability / def.apparel!.durability : 1)
    const eff = armorVal - pen
    if (mods?.armorDamage) it.durability = Math.max(0, (it.durability ?? 0) - mods.armorDamage)
    if (eff <= 0) continue
    const ar = r.float()
    if (ar < eff / deflectDiv) {
      detail.push(`${def.label}: 튕겨냄 (유효 ${eff.toFixed(2)}, roll ${ar.toFixed(2)})`)
      it.durability = Math.max(0, (it.durability ?? 0) - 1)
      fx(w, { k: 'deflect', id: d.id, turn })
      wake(w, d, '공격받음')
      if (isPlayer) log(w, 'combat', `${aName}의 ${label}이(가) ${dName}의 ${def.label}에 튕겨났다.`, detail)
      return res
    }
    if (ar < eff) {
      dmg *= 0.5
      if (dtype !== 'blunt') dtype = 'blunt'
      detail.push(`${def.label}: 절반 흡수 → 타격으로 (유효 ${eff.toFixed(2)}, roll ${ar.toFixed(2)})`)
      it.durability = Math.max(0, (it.durability ?? 0) - 2)
    } else {
      detail.push(`${def.label}: 관통 (유효 ${eff.toFixed(2)}, roll ${ar.toFixed(2)})`)
      it.durability = Math.max(0, (it.durability ?? 0) - 1)
    }
  }
  dmg = Math.max(0.5, dmg)

  // 5 상처: 내부 장기 관통
  let target = pd
  let internal = false
  const inner = bodyDef(w, d).parts.filter((p) => p.parent === pd.id && p.internal && !isMissing(w, d, p.id))
  const penetrate = (dtype === 'stab' || dtype === 'bite' ? 0.45 : dtype === 'cut' ? 0.2 : 0.12) * Math.max(0, (dmg - 4) / 10)
  if (inner.length && r.chance(clamp(penetrate, 0, 0.7))) {
    const ip = r.weighted(inner, (p) => p.coverage)!
    const deeper = bodyDef(w, d).parts.filter((p) => p.parent === ip.id && p.internal)
    target = deeper.length && r.chance(0.5) ? deeper[0] : ip
    internal = true
    detail.push(`관통 → ${target.label}`)
  }
  const woundId = internal && dtype !== 'blunt' ? 'Wound.InternalBleed' : WOUND_FOR[dtype]
  const arterial = !internal && !!target.artery && (dtype === 'cut' || dtype === 'stab' || dtype === 'bite')
    && r.chance(clamp((dmg - 4) / 30 + (mods?.arterialBonus ?? 0), 0, 0.45))
  let fracture = false
  if (target.bone) {
    const fm = (atk.fractureMult ?? 1) * traitMul(w, d, 'fractureMult') * (mods?.fractureMult ?? 1) * traitMul(w, a, 'fractureDealt')
    // 부위 체력 대비 피해 비율이 30%를 넘어야 골절 위험이 생긴다 (작은 타격으로 뼈가 쉽게 부러지지 않게)
    const ratio = dmg / d.body.maxHp[target.id]
    const fc = dtype === 'blunt' ? (ratio - 0.3) * 1.1 * fm : (ratio - 0.3) * 0.3 * fm
    fracture = r.chance(clamp(fc, 0, 0.75))
  }
  const { wound, destroyed } = addWound(w, d, {
    def: woundId, part: target.id, severity: dmg, source: `${a.name}의 ${label}`,
    arterial, internal, fracture, bleedMult: (atk.bleedMult ?? 1) * (mods?.bleedMult ?? 1),
    canSever: (dtype === 'cut' || dtype === 'bite') && dmg >= d.body.maxHp[target.id] * 0.6,
  })
  // HP 피해 (체력 층)
  const hpDmg = Math.round(dmg * 10) / 10
  d.hp = Math.round((d.hp - hpDmg) * 10) / 10
  res.hit = true
  res.damage = dmg
  fx(w, { k: 'dmg', id: d.id, v: Math.max(1, Math.round(hpDmg)), crit: sneakAttack || arterial, turn })
  const woundLabel = w.db.wound(woundId).label
  const severed = !!destroyed && d.body.missing.includes(destroyed)
  let text = `${aName}의 ${label} → ${dName}의 ${target.label}에 ${woundLabel} (${hpDmg.toFixed(1)})`
  if (sneakAttack) text = '기습! ' + text
  if (arterial) { text += ' — 동맥이 끊겼다! 피가 뿜어져 나온다'; fx(w, { k: 'status', id: d.id, text: '동맥!', color: '#ff4040', turn }) }
  if (fracture) { text += ' — 뼈가 부러졌다'; fx(w, { k: 'status', id: d.id, text: '골절!', color: '#f0d0a0', turn }) }
  if (destroyed) text += severed ? ` — ${part(w, d, destroyed).label}이(가) 떨어져 나갔다` : ` — ${part(w, d, destroyed).label}이(가) 못 쓰게 됐다`
  if (severed) fx(w, { k: 'status', id: d.id, text: '절단!', color: '#ff6060', turn })
  if (internal && d.faction !== 'player') text = `${aName}의 ${label} → ${dName}의 ${pd.label} 깊숙이 박혔다 (${hpDmg.toFixed(1)})`
  detail.push(`상처 출혈 ${wound.bleed} ml/턴 · HP −${hpDmg.toFixed(1)}`)
  if (isPlayer) log(w, d.faction === 'player' ? 'danger' : 'combat', text, detail)
  if (d.faction === 'player') d.history.push({ turn, kind: 'wound', text: `${a.name}에게 ${target.label} ${woundLabel}${arterial ? '(동맥)' : ''}${fracture ? '(골절)' : ''}` })
  if (severed && d.faction === 'player') addThought(w, d, 'Thought.Maimed')

  // 6 2차 효과
  if (dtype === 'blunt' && target.groups.includes('head') && r.chance((atk.stunChance ?? 0.05) + dmg / 60 + (mods?.stunBonus ?? 0))) {
    addEffect(d, 'stunned', turn + r.int(2, 4))
    fx(w, { k: 'status', id: d.id, text: '기절!', color: '#f0e070', turn })
    if (isPlayer) log(w, 'combat', `${dName}이(가) 머리를 맞고 휘청인다 (기절).`)
  }
  if ((target.groups.includes('hands') || target.groups.includes('arms')) && dmg > 6 && r.chance(dmg / 50)) {
    const mw = d.equip.main
    if (mw && d.faction !== 'player') {
      delete d.equip.main
      w.s.map.tiles[d.pos.y * w.s.map.w + d.pos.x].items.push(mw)
      fx(w, { k: 'status', id: d.id, text: '무기 놓침', color: '#d0d0d0', turn })
      if (isPlayer) log(w, 'combat', `${dName}이(가) 무기를 떨어뜨렸다.`)
    }
  }
  const odef = w.db.creature(d.def).onHit
  if (odef && r.chance(odef.chance)) {
    for (const o of w.s.creatures) {
      if (!o.alive || cheb(o.pos, d.pos) > odef.radius || o.id === d.id) continue
      addEffect(o, odef.effect, turn + odef.turns)
      fx(w, { k: 'status', id: o.id, text: '포자!', color: '#a0c060', turn })
    }
    if (isPlayer) log(w, 'warn', `${d.name}에게서 포자 구름이 터졌다. 기침이 나고 기력이 돌지 않는다.`)
  }
  if (dmg >= 6) emitNoise(w, d.pos, 7, d.id)
  wake(w, d, '공격받음')
  moraleHit(w, d, dmg, arterial || fracture || !!destroyed)
  return res
}

function noteFight(w: World, a: Creature, d: Creature) {
  const other = a.faction === 'player' ? d : d.faction === 'player' ? a : undefined
  if (!other) return
  const b = (w.s.knowledge.bestiary[other.def] ??= { seen: 0, fought: 0, killed: 0 })
  b.fought++
}

export function moraleHit(w: World, c: Creature, dmg: number, severe: boolean) {
  if (c.faction === 'player') return
  c.ai.morale -= dmg * 1.2 + (severe ? 15 : 0)
  c.ai.morale -= bloodLoss(c) * 30
}

/** 사망 처리: 시체, 소지품 투하(루팅 더미), 주변 사기, 경험치 */
export function killCreature(w: World, c: Creature, cause: string) {
  if (!c.alive) return
  const turn = turnOf(w)
  c.alive = false
  c.unconscious = false
  c.asleep = false
  c.deathCause = cause
  c.deathTurn = turn
  c.killedBy = c.lastAttacker
  const t = w.s.map.tiles[c.pos.y * w.s.map.w + c.pos.x]
  if (c.faction !== 'player') {
    for (const it of allItems(c)) t.items.push({ ...it, gx: undefined, gy: undefined })
    c.bag = []
    c.equip = {}
  }
  t.blood = Math.min(400, t.blood + 60)
  if (c.faction === 'beasts' || c.faction === 'vermin') t.items.push(makeItem(w, 'Item.RawMeat', c.def === 'Creature.BurrowRat' ? 1 : 3))
  fx(w, { k: 'death', id: c.id, turn })
  const pl = player(w)
  if (c.id !== pl.id) {
    if (pl.alive) {
      const b = (w.s.knowledge.bestiary[c.def] ??= { seen: 0, fought: 0, killed: 0 })
      if (c.lastAttacker?.startsWith(pl.name)) {
        b.killed++
        if (c.faction === 'reavers') addThought(w, pl, 'Thought.KilledHuman', traitOverride(w, pl, 'killMood'))
        else addThought(w, pl, 'Thought.KilledBeast')
        gainXp(w, pl, w.db.creature(c.def).xp ?? 10, c.name)
      } else addThought(w, pl, 'Thought.SawDeath')
    }
    log(w, 'combat', `${c.name}이(가) 쓰러졌다. (${cause})`)
  }
  for (const o of w.s.creatures) {
    if (!o.alive || o.faction !== c.faction || o.id === c.id) continue
    if (cheb(o.pos, c.pos) <= 10) o.ai.morale -= 25
  }
}

/** 인접(또는 리치 2) 공격 가능 여부 */
export function canReach(w: World, a: Creature, d: Creature): boolean {
  const atk = currentAttack(w, a)
  const reach = atk?.reach ?? 1
  const dist = cheb(a.pos, d.pos)
  if (dist <= 1) {
    const dx = d.pos.x - a.pos.x, dy = d.pos.y - a.pos.y
    if (dx !== 0 && dy !== 0) {
      const t1 = w.db.terrain(w.s.map.tiles[a.pos.y * w.s.map.w + a.pos.x + dx].t)
      const t2 = w.db.terrain(w.s.map.tiles[(a.pos.y + dy) * w.s.map.w + a.pos.x].t)
      if (!t1.passable && !t2.passable) return false
    }
    return true
  }
  if (dist === 2 && reach >= 2) {
    const mid = { x: a.pos.x + Math.sign(d.pos.x - a.pos.x), y: a.pos.y + Math.sign(d.pos.y - a.pos.y) }
    return w.db.terrain(w.s.map.tiles[mid.y * w.s.map.w + mid.x].t).passable && !creatureAt(w, mid)
  }
  return false
}
