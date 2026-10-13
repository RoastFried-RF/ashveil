// 액티브·토글 능력 사용

import type { ActResult } from './actions'
import { canReach, resolveAttack } from './combat'
import { creatureAt, creatureById, inBounds, log, rng, terrainAt, turnOf, type World } from './ctx'
import { hasLos } from './fov'
import { cheb, DIRS, dirIndex, type Pos } from './geom'
import { currentAttack, itemDef } from './items'
import { energyMax } from './body'
import { addEffect } from './traits'
import type { AbilityDef, Creature } from './types'

function hostileTo(a: Creature, b: Creature): boolean {
  if (a.faction === b.faction) return false
  return a.faction === 'player' || b.faction === 'player' || !(a.faction === 'vermin' || b.faction === 'vermin')
}

export function abilityReady(w: World, c: Creature, id: string): string | null {
  const d = w.db.ability(id)
  if (!c.abilities.includes(id)) return '배우지 않은 능력'
  if (d.kind === 'passive') return '패시브 능력이다'
  const turn = turnOf(w)
  if ((c.cooldowns[id] ?? 0) > turn) return `재사용 대기 ${c.cooldowns[id] - turn}턴`
  if ((d.energy ?? 0) > c.needs.stamina) return '기력이 부족하다'
  if (d.weapon) {
    const atk = currentAttack(w, c)
    if (!atk || atk.skill !== d.weapon) return `${weaponLabel(d.weapon)}를 들어야 한다`
  }
  return null
}

function weaponLabel(skill: string): string {
  return ({ blade: '도검', axe: '도끼', blunt: '둔기', spear: '창', archery: '활' } as Record<string, string>)[skill] ?? skill
}

function payCost(w: World, c: Creature, d: AbilityDef) {
  c.needs.stamina -= d.energy ?? 0
  // t 에 쓰면 t+1 … t+N 동안 못 쓰고 t+N+1 에 다시 쓴다 (15 §5)
  c.cooldowns[d.id] = turnOf(w) + (d.cooldown ?? 0) + 1
  c.exerted = (d.energy ?? 0) > 0
}

export function useAbility(w: World, c: Creature, id: string, targetId?: number): ActResult {
  const err = abilityReady(w, c, id)
  if (err) return { ok: false, tu: 0, msg: err }
  const d = w.db.ability(id)
  const turn = turnOf(w)
  const isPl = c.faction === 'player'

  if (d.kind === 'toggle') {
    c.sneaking = !c.sneaking
    if (isPl) log(w, 'info', c.sneaking ? '몸을 낮추고 숨을 죽인다. (잠행)' : '몸을 일으킨다.')
    w.s.fx.push({ k: 'status', id: c.id, text: c.sneaking ? '잠행' : '잠행 해제', color: '#9fb3c8', turn })
    return { ok: true, tu: 0 }
  }
  if (d.stance) {
    payCost(w, c, d)
    addEffect(c, d.stance.effect, turn + d.stance.turns + 1, d.stance.magnitude)
    if (isPl) log(w, 'info', `${d.label}.`)
    w.s.fx.push({ k: 'status', id: c.id, text: d.label, color: '#e0c070', turn })
    return { ok: true, tu: 100 }
  }
  if (d.self) {
    payCost(w, c, d)
    // 숨 고르기: 현재 최대 기력(몸통 보정 포함)의 비율만큼 (15 §6.6)
    if (d.self.energyPct) c.needs.stamina = Math.min(energyMax(w, c), c.needs.stamina + energyMax(w, c) * d.self.energyPct)
    if (d.self.painRelief) addEffect(c, 'breath', turn + (d.self.turns ?? 3) + 1, d.self.painRelief)
    if (isPl) log(w, 'info', `${d.label}. 숨이 고르게 돌아온다.`)
    w.s.fx.push({ k: 'status', id: c.id, text: d.label, color: '#8fc0a0', turn })
    return { ok: true, tu: 100 }
  }
  if (d.attack) {
    const mods = d.attack
    // 휘둘러 베기: 주변 전부
    if (mods.aoe === 'adjacent') {
      const targets = w.s.creatures.filter((o) => o.alive && o.id !== c.id && hostileTo(c, o) && cheb(o.pos, c.pos) <= 1)
      if (!targets.length) return { ok: false, tu: 0, msg: '주변에 적이 없다' }
      payCost(w, c, d)
      if (isPl) log(w, 'combat', `${d.label}!`)
      for (const t of targets) resolveAttack(w, c, t, { mods, abilityLabel: d.label })
      return { ok: true, tu: mods.tu ?? 100 }
    }
    const t = creatureById(w, targetId)
    if (!t || !t.alive) return { ok: false, tu: 0, msg: '대상을 골라야 한다' }
    const ranged = !!(c.equip.main && itemDef(w, c.equip.main).ranged)
    if (ranged) {
      const rd = itemDef(w, c.equip.main!).ranged!
      if (cheb(c.pos, t.pos) > rd.range || !hasLos(w, c.pos, t.pos)) return { ok: false, tu: 0, msg: '쏠 수 없는 위치다' }
      const ammo = c.bag.find((i) => i.def === rd.ammo)
      if (!ammo) return { ok: false, tu: 0, msg: '화살이 없다' }
      ammo.count--
      if (ammo.count <= 0) c.bag = c.bag.filter((i) => i !== ammo)
    } else if (!canReach(w, c, t)) return { ok: false, tu: 0, msg: '닿지 않는다' }
    payCost(w, c, d)
    if (isPl) log(w, 'combat', `${d.label}!`)
    const res = resolveAttack(w, c, t, { mods, abilityLabel: d.label, ranged })
    // 꿰뚫기: 뒤에 있는 적까지
    if (mods.aoe === 'line2') {
      const dir = DIRS[dirIndex(t.pos.x - c.pos.x, t.pos.y - c.pos.y)]
      const behind = { x: t.pos.x + dir.x, y: t.pos.y + dir.y }
      const t2 = inBounds(w, behind) ? creatureAt(w, behind) : undefined
      if (t2 && t2.id !== c.id && hostileTo(c, t2)) resolveAttack(w, c, t2, { mods, abilityLabel: d.label })
    }
    if (res.hit && t.alive) {
      if (mods.knockback) knockback(w, c, t, mods.knockback)
      if (mods.knockdownChance && chance(w, mods.knockdownChance)) {
        addEffect(t, 'knockedDown', turn + 2)
        w.s.fx.push({ k: 'status', id: t.id, text: '넘어짐!', color: '#e0a050', turn })
        if (isPl || t.faction === 'player') log(w, 'combat', `${t.faction === 'player' ? '당신' : t.name}이(가) 넘어졌다.`)
      }
    }
    return { ok: true, tu: mods.tu ?? 100 }
  }
  return { ok: false, tu: 0, msg: '쓸 수 없다' }
}

function chance(w: World, p: number): boolean {
  return rng(w, 'combat').chance(p)
}

function knockback(w: World, a: Creature, t: Creature, n: number) {
  const dir = DIRS[dirIndex(t.pos.x - a.pos.x, t.pos.y - a.pos.y)]
  for (let i = 0; i < n; i++) {
    const to: Pos = { x: t.pos.x + dir.x, y: t.pos.y + dir.y }
    if (!inBounds(w, to) || !terrainAt(w, to).passable || creatureAt(w, to)) {
      // 벽에 부딪힘
      t.hp -= 3
      w.s.fx.push({ k: 'status', id: t.id, text: '쾅!', color: '#e08050', turn: turnOf(w) })
      return
    }
    const from = { ...t.pos }
    t.pos = to
    w.s.fx.push({ k: 'move', id: t.id, from, to, turn: turnOf(w) })
  }
}
