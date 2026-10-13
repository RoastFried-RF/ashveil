// 공격 판정 파이프라인:
// 1 명중 → 2 방어 반응(막기/받아넘기기) → 3 부위 결정 → 4 방어구 층 → 5 상처 생성 → 6 2차 효과

import { addWound, bloodLoss, bodyDef, capacity, isMissing, painTotal, part, partMap, totalBleed } from './body'
import { clamp, creatureAt, log, player, rng, turnOf, type World } from './ctx'
import { lightAt } from './fov'
import { cheb, dirDelta, dirIndex, type Pos } from './geom'
import { apparelItems, currentAttack, encumbranceMult, itemDef, mainWeapon, makeItem, offHand } from './items'
import { addThought } from './needs'
import { emitNoise } from './perception'
import { gainXp, skillLevel } from './skills'
import { addEffect, hasEffect, traitAdd, traitMul, traitOverride } from './traits'
import type { ArmorCategory, AttackDef, BodyPartDef, Creature, DamageType } from './types'

const SIZE_EVASION: Record<string, number> = { tiny: 8, small: 4, medium: 0, large: -8 }
const SIZE_RANK: Record<string, number> = { tiny: 0, small: 1, medium: 2, large: 3 }

export function evasion(w: World, c: Creature): number {
  if (c.unconscious || c.ai.mode === 'surrender') return -100
  const cdef = w.db.creature(c.def)
  let e = skillLevel(c, 'dodge') * 0.5 + (c.stats.agi - 10) * 1.5 + (SIZE_EVASION[cdef.sizeClass] ?? 0)
  e *= capacity(w, c, 'moving') // 다리를 다치면 피하지 못한다
  e -= (encumbranceMult(w, c) - 1) * 40
  if (c.needs.stamina < 10) e -= 10
  return e
}

export function facingRelation(defender: Creature, attackerPos: Pos): 'front' | 'side' | 'back' {
  const toAtt = dirIndex(attackerPos.x - defender.pos.x, attackerPos.y - defender.pos.y)
  const d = dirDelta(defender.facing, toAtt)
  return d <= 1 ? 'front' : d === 2 ? 'side' : 'back'
}

export interface HitPreview {
  chance: number
  lines: string[]
  attack: AttackDef
}

export function previewHit(w: World, a: Creature, d: Creature, ranged = false): HitPreview | null {
  const atk = currentAttack(w, a)
  if (!atk) return null
  const lines: string[] = []
  const skill = skillLevel(a, atk.skill)
  const attackScore = skill + (a.stats.agi - 10) * 0.5
  const ev = evasion(w, d)
  let chance = 50 + (attackScore - ev) * 2
  lines.push(`기본 50 + (공격 ${attackScore.toFixed(0)} − 회피 ${ev.toFixed(0)}) × 2 = ${chance.toFixed(0)}`)
  const add = (label: string, v: number) => { if (v !== 0) { chance += v; lines.push(`${label} ${v > 0 ? '+' : ''}${v.toFixed(0)}`) } }
  const rel = facingRelation(d, a.pos)
  if (!d.unconscious) add(rel === 'back' ? '후면' : rel === 'side' ? '측면' : '정면', rel === 'back' ? 20 : rel === 'side' ? 10 : 0)
  const light = lightAt(w, d.pos)
  if (light < 0.2) add('어둠', -15)
  else if (light < 0.4) add('어스름', -7)
  const pain = clamp(Math.floor(painTotal(w, a) / 20), 0, 6)
  add('통증', -pain * 5)
  const manip = capacity(w, a, 'manipulation')
  if (manip < 0.95 && atk.skill !== 'bite') add('손 상태', -Math.round((1 - manip) * 40))
  if (a.needs.fatigue > 80) add('피로', -10)
  if (a.needs.bodyTemp < 35) add('추위 떨림', -10)
  if (hasEffect(a, 'alcohol', turnOf(w))) add('취기', -5)
  if (ranged) {
    const dist = cheb(a.pos, d.pos)
    add('거리', -Math.max(0, dist - 3) * 3)
    add('원거리 특성', traitAdd(w, a, 'rangedHit'))
    add('시력', -Math.round((1 - capacity(w, a, 'sight')) * 30))
    if (a.needs.wetness > 60) add('젖은 시위', -10)
  }
  const bh = traitAdd(w, a, 'bloodHit')
  if (bh && totalBleed(w, d, true) > 2) add('피 냄새', bh)
  if (d.unconscious) chance = 95
  chance = clamp(chance, 5, 95)
  lines.push(`최종 ${chance.toFixed(0)}% (5~95 제한)`)
  return { chance, lines, attack: atk }
}


/** 3 부위 결정: 노출 면적 가중 + 신장 차이 보정 */
export function pickPart(w: World, a: Creature, d: Creature): BodyPartDef {
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
    if (!d.unconscious) {
      if (sizeDiff <= -2) mult = p.height === 'high' ? 0.02 : p.height === 'low' ? 3 : 0.4
      else if (sizeDiff === -1) mult = p.height === 'high' ? 0.25 : p.height === 'low' ? 2.2 : 1
      if (sizeDiff >= 1) mult = p.height === 'low' ? 0.5 : p.height === 'high' ? 1.4 : 1
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

export function resolveAttack(w: World, a: Creature, d: Creature, opts: { ranged?: boolean } = {}): AttackResult {
  const r = rng(w, 'combat')
  const turn = turnOf(w)
  const pv = previewHit(w, a, d, opts.ranged)
  const res: AttackResult = { hit: false, damage: 0, killed: false }
  if (!pv) return res
  const atk = pv.attack
  const detail: string[] = [...pv.lines]
  const isPlayer = a.faction === 'player' || d.faction === 'player'
  const aName = a.faction === 'player' ? '당신' : a.name
  const dName = d.faction === 'player' ? '당신' : d.name

  a.exerted = true
  a.needs.stamina = Math.max(0, a.needs.stamina - atk.stamina)
  a.facing = dirIndex(d.pos.x - a.pos.x, d.pos.y - a.pos.y)
  emitNoise(w, a.pos, (atk.noise ?? 4) + 1, a.id)
  d.ai.alertTurn = turn
  noteFight(w, a, d)

  // 1 명중
  const roll = r.float() * 100
  detail.push(`주사위 ${roll.toFixed(1)} vs ${pv.chance.toFixed(0)}`)
  if (roll >= pv.chance) {
    gainXp(w, a, atk.skill, 2)
    gainXp(w, d, 'dodge', 3)
    if (isPlayer) log(w, 'combat', `${aName}의 ${atk.label} — ${dName}에게 빗나갔다.`, detail)
    return res
  }

  // 2 방어 반응
  const rel = facingRelation(d, a.pos)
  if (!d.unconscious && rel !== 'back' && d.ai.mode !== 'surrender' && !opts.ranged) {
    const sh = offHand(w, d)
    const shDef = sh ? itemDef(w, sh).shield : undefined
    if (shDef && rel === 'front' && d.needs.stamina >= shDef.stamina) {
      const bc = shDef.block + skillLevel(d, 'shield') * 0.6
      d.needs.stamina -= shDef.stamina
      d.exerted = true
      if (r.float() * 100 < bc) {
        detail.push(`방패 막기 ${bc.toFixed(0)}% 성공`)
        gainXp(w, d, 'shield', 4)
        emitNoise(w, d.pos, 6, d.id)
        if (isPlayer) log(w, 'combat', `${dName}이(가) 방패로 ${aName}의 ${atk.label}을(를) 막았다.`, detail)
        return res
      }
      detail.push(`방패 막기 ${bc.toFixed(0)}% 실패`)
    } else {
      const mw = mainWeapon(w, d)
      const mdef = mw ? itemDef(w, mw).attack : undefined
      if (mdef && !itemDef(w, mw!).ranged && d.needs.stamina >= 8) {
        const pc = 5 + skillLevel(d, mdef.skill) * 0.35 - (rel === 'side' ? 5 : 0)
        if (r.float() * 100 < pc) {
          d.needs.stamina -= 8
          d.exerted = true
          detail.push(`받아넘기기 ${pc.toFixed(0)}% 성공`)
          gainXp(w, d, mdef.skill, 3)
          if (isPlayer) log(w, 'combat', `${dName}이(가) ${aName}의 ${atk.label}을(를) 받아넘겼다.`, detail)
          return res
        }
      }
    }
  }

  // 3 부위
  const pd = pickPart(w, a, d)
  detail.push(`부위: ${pd.label}`)

  // 피해량
  let dmg = atk.damage * r.range(0.8, 1.2)
  if (atk.skill !== 'archery' && atk.skill !== 'bite') dmg *= 1 + (a.stats.str - 10) * 0.04
  if (atk.skill === 'bite') dmg *= 0.6 + 0.4 * capacity(w, a, 'manipulation')
  let dtype: DamageType = atk.damageType
  detail.push(`피해 ${dmg.toFixed(1)} (${dtype})`)

  // 4 방어구 층 (바깥부터)
  const covering = apparelItems(w, d)
    .filter(({ def }) => def.apparel!.groups.some((g) => pd.groups.includes(g)))
    .sort((x, y) => y.def.apparel!.layer - x.def.apparel!.layer)
  for (const { it, def } of covering) {
    const cat = armorCategory(dtype)
    const armorVal = (def.apparel!.armor[cat] ?? 0) * (it.durability !== undefined ? 0.5 + 0.5 * it.durability / def.apparel!.durability : 1)
    const eff = armorVal - atk.armorPen
    if (eff <= 0) continue
    const ar = r.float()
    if (ar < eff / 2) {
      detail.push(`${def.label}: 튕겨냄 (유효 ${eff.toFixed(2)}, roll ${ar.toFixed(2)})`)
      it.durability = Math.max(0, (it.durability ?? 0) - 1)
      if (isPlayer) log(w, 'combat', `${aName}의 ${atk.label}이(가) ${dName}의 ${def.label}에 튕겨났다.`, detail)
      gainXp(w, a, atk.skill, 2)
      return res
    }
    if (ar < eff) {
      dmg *= 0.5
      if (dtype !== 'blunt') dtype = 'blunt'
      detail.push(`${def.label}: 절반 흡수 → 타격으로 변환 (유효 ${eff.toFixed(2)}, roll ${ar.toFixed(2)})`)
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
    // 두개골 → 뇌
    const deeper = bodyDef(w, d).parts.filter((p) => p.parent === ip.id && p.internal)
    target = deeper.length && r.chance(0.5) ? deeper[0] : ip
    internal = true
    detail.push(`관통 → ${target.label}`)
  }
  const woundId = internal && dtype !== 'blunt' ? 'Wound.InternalBleed' : WOUND_FOR[dtype]
  const arterial = !internal && !!target.artery && (dtype === 'cut' || dtype === 'stab' || dtype === 'bite') && r.chance(clamp((dmg - 4) / 30, 0, 0.3))
  let fracture = false
  if (target.bone) {
    const fm = (atk.fractureMult ?? 1) * traitMul(w, d, 'fractureMult')
    const fc = dtype === 'blunt' ? (dmg / d.body.maxHp[target.id]) * 1.1 * fm : (dmg / d.body.maxHp[target.id]) * 0.25 * fm
    fracture = r.chance(clamp(fc, 0, 0.75))
  }
  const { wound, destroyed } = addWound(w, d, {
    def: woundId, part: target.id, severity: dmg, source: `${a.name}의 ${atk.label}`,
    arterial, internal, fracture, bleedMult: atk.bleedMult,
    canSever: (dtype === 'cut' || dtype === 'bite') && dmg >= d.body.maxHp[target.id] * 0.35,
  })
  res.hit = true
  res.damage = dmg
  gainXp(w, a, atk.skill, 4)
  const woundLabel = w.db.wound(woundId).label
  let text = `${aName}의 ${atk.label} → ${dName}의 ${target.label}에 ${woundLabel} (${dmg.toFixed(1)})`
  if (arterial) text += ' — 동맥이 끊겼다! 피가 뿜어져 나온다'
  if (fracture) text += ' — 뼈가 부러졌다'
  const severed = !!destroyed && d.body.missing.includes(destroyed)
  if (destroyed) text += severed ? ` — ${part(w, d, destroyed).label}이(가) 떨어져 나갔다` : ` — ${part(w, d, destroyed).label}이(가) 못 쓰게 됐다`
  if (internal && d.faction !== 'player') text = `${aName}의 ${atk.label} → ${dName}의 ${pd.label} 깊숙이 박혔다 (${dmg.toFixed(1)})`
  detail.push(`상처 출혈 ${wound.bleed} ml/턴`)
  if (isPlayer) log(w, d.faction === 'player' ? 'danger' : 'combat', text, detail)
  if (d.faction === 'player') d.history.push({ turn, kind: 'wound', text: `${a.name}에게 ${target.label} ${woundLabel}${arterial ? '(동맥)' : ''}${fracture ? '(골절)' : ''}` })
  if (severed && d.faction === 'player') addThought(w, d, 'Thought.Maimed')

  // 6 2차 효과
  if (dtype === 'blunt' && target.groups.includes('head') && r.chance((atk.stunChance ?? 0.05) + dmg / 60)) {
    addEffect(d, 'stunned', turn + r.int(2, 5))
    if (isPlayer) log(w, 'combat', `${dName}이(가) 머리를 맞고 휘청인다 (기절).`)
  }
  if ((target.groups.includes('hands') || target.groups.includes('arms')) && dmg > 6 && r.chance(dmg / 50)) {
    const mw = mainWeapon(w, d)
    if (mw && d.faction !== 'player') {
      d.equipment.main = undefined
      d.inventory = d.inventory.filter((i) => i.uid !== mw.uid)
      dropItem(w, d.pos, mw)
      if (isPlayer) log(w, 'combat', `${dName}이(가) 무기를 떨어뜨렸다.`)
    }
  }
  if (dmg >= 6) emitNoise(w, d.pos, 7, d.id) // 비명
  moraleHit(w, d, dmg, arterial || fracture || !!destroyed)
  return res
}

function dropItem(w: World, p: Pos, it: { uid: number; def: string; count: number }) {
  const t = w.s.map.tiles[p.y * w.s.map.w + p.x]
  t.items.push({ ...it })
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

/** 사망 처리: 시체, 소지품 투하, 주변 사기 */
export function killCreature(w: World, c: Creature, cause: string) {
  if (!c.alive) return
  const turn = turnOf(w)
  c.alive = false
  c.unconscious = false
  c.deathCause = cause
  c.deathTurn = turn
  c.killedBy = c.lastAttacker
  const t = w.s.map.tiles[c.pos.y * w.s.map.w + c.pos.x]
  for (const it of c.inventory) t.items.push(it)
  c.inventory = []
  c.equipment = { apparel: [] }
  t.blood = Math.min(400, t.blood + 60)
  if (c.faction === 'beasts' || c.faction === 'vermin') {
    const meat = c.def === 'Creature.BurrowRat' ? 1 : 3
    t.items.push(makeItem(w, 'Item.RawMeat', meat))
  }
  const pl = player(w)
  if (c.id !== pl.id) {
    if (pl.alive) {
      const b = (w.s.knowledge.bestiary[c.def] ??= { seen: 0, fought: 0, killed: 0 })
      if (c.lastAttacker?.startsWith(pl.name)) {
        b.killed++
        if (c.faction === 'reavers') addThought(w, pl, 'Thought.KilledHuman', traitOverrideKill(w, pl))
        else addThought(w, pl, 'Thought.KilledBeast')
      } else addThought(w, pl, 'Thought.SawDeath')
    }
    log(w, 'combat', `${c.name}이(가) 쓰러졌다. (${cause})`)
  }
  // 동료 사기 하락
  for (const o of w.s.creatures) {
    if (!o.alive || o.faction !== c.faction || o.id === c.id) continue
    if (cheb(o.pos, c.pos) <= 10) o.ai.morale -= 25
  }
}

function traitOverrideKill(w: World, c: Creature): number | undefined {
  return traitOverride(w, c, 'killMood')
}

/** 인접(또는 리치 2) 공격 가능 여부 */
export function canReach(w: World, a: Creature, d: Creature): boolean {
  const atk = currentAttack(w, a)
  const reach = atk?.reach ?? 1
  const dist = cheb(a.pos, d.pos)
  if (dist <= 1) {
    // 대각선 모서리 끼기 금지
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

