// 액티브·토글 능력 사용 (15 §5~§7). 공격형은 07 §2 파이프라인을 그대로 쓰고 지정한 항만 바꾼다.

import type { ActResult } from './actions'
import { energyMax } from './body'
import { canReach, fx, knockDown, pushBack, resolveAttack } from './combat'
import { creatureAt, creatureById, inBounds, log, rng, turnOf, type World } from './ctx'
import { hasLos } from './fov'
import { cheb, DIRS, dirIndex } from './geom'
import { itemDef, removeOne, wield } from './items'
import { addEffect, hasEffect, traitAdd } from './traits'
import type { AbilityDef, Creature } from './types'

export const WEAPON_LABEL: Record<string, string> = { blade: '도검', axe: '도끼', blunt: '둔기', spear: '창', archery: '활' }
const MODE_LABEL: Record<string, string> = { slash: '베기', stab: '찌르기', blunt: '타격' }

/** 기력 비용: 탈영 경비병 창 액티브 −2, 겁쟁이 공격형 +2 (15 §9) */
export function abilityCost(w: World, c: Creature, d: AbilityDef): number {
  let e = d.energy ?? 0
  if (d.weapon) e += traitAdd(w, c, `energy_${d.weapon}`)
  if (d.attack) e += traitAdd(w, c, 'attackAbilityEnergy')
  return Math.max(0, e)
}

/** 재사용 대기: 냉혈은 급소 찌르기·머리 강타 −1 (15 §9.2) */
function cooldownOf(w: World, c: Creature, d: AbilityDef): number {
  let cd = d.cooldown ?? 0
  if (d.id === 'Ab.Blade.Vital' || d.id === 'Ab.Blunt.HeadBash') cd += traitAdd(w, c, 'executeCooldown')
  return Math.max(0, cd)
}

export function abilityReady(w: World, c: Creature, id: string): string | null {
  const d = w.db.ability(id)
  if (!c.abilities.includes(id) && !(w.db.creature(c.def).abilities ?? []).includes(id)) return '배우지 않은 능력'
  if (d.kind === 'passive') return '패시브 능력이다'
  const turn = turnOf(w)
  if ((c.cooldowns[id] ?? 0) > turn) return `재사용 대기 ${c.cooldowns[id] - turn}턴`
  if (d.kind === 'toggle') return c.freeActTurn === turn ? '자유 행동은 턴당 한 번' : null
  const cost = abilityCost(w, c, d)
  if (c.needs.energy <= 0 && cost >= 0 && d.attack) return '기력이 바닥났다'
  if (cost > c.needs.energy) return '기력이 부족하다'
  if (d.weapon) {
    const wl = wield(w, c)
    if (!wl || wl.atk.family !== d.weapon) {
      if (c.equip.main && w.db.item(c.equip.main.def).attacks?.[0]?.family === d.weapon) return '무기 든 팔을 쓸 수 없다'
      return `${WEAPON_LABEL[d.weapon] ?? d.weapon}를 들어야 한다`
    }
    if (d.attackMode && wl.item && !itemDef(w, wl.item).attacks?.some((a) => a.id === d.attackMode)) return `${MODE_LABEL[d.attackMode]} 공격이 있는 무기여야 한다`
  }
  if (d.id === 'Ab.Archery.Aimed' && hasEffect(c, 'withdrawal', turn)) return '손이 떨려 겨눌 수 없다'
  return null
}

function payCost(w: World, c: Creature, d: AbilityDef) {
  c.needs.energy -= abilityCost(w, c, d)
  // t 에 쓰면 t+1 … t+N 동안 못 쓰고 t+N+1 에 다시 쓴다 (15 §5)
  c.cooldowns[d.id] = turnOf(w) + cooldownOf(w, c, d) + 1
  c.exerted = (d.energy ?? 0) > 0
}

function hostileTo(a: Creature, b: Creature): boolean {
  if (a.faction === b.faction) return false
  return a.faction === 'player' || b.faction === 'player' || !(a.faction === 'vermin' || b.faction === 'vermin')
}

export function useAbility(w: World, c: Creature, id: string, targetId?: number): ActResult {
  const err = abilityReady(w, c, id)
  if (err) return { ok: false, tu: 0, msg: err }
  const d = w.db.ability(id)
  const turn = turnOf(w)
  const isPl = c.faction === 'player'

  if (d.kind === 'toggle') {
    // 토글 = 자유 행동(0턴, 턴당 1회, 01 §3.4)
    c.freeActTurn = turn
    c.sneaking = !c.sneaking
    if (isPl) log(w, 'info', c.sneaking ? '몸을 낮추고 숨을 죽인다. (잠행: 이동 2턴, 소음 ×0.3)' : '몸을 일으킨다.')
    fx(w, { k: 'status', id: c.id, text: c.sneaking ? '잠행' : '잠행 해제', color: '#9fb3c8', turn })
    return { ok: true, tu: 0 }
  }
  if (d.stance) {
    payCost(w, c, d)
    // 겁쟁이: 자세 지속 +1턴
    const turns = d.stance.turns + traitAdd(w, c, 'stanceTurns')
    addEffect(c, d.stance.effect, turn + turns + 1, d.stance.magnitude)
    if (isPl) log(w, 'info', `${d.label}.`)
    fx(w, { k: 'status', id: c.id, text: d.label, color: '#e0c070', turn })
    return { ok: true, tu: 100 }
  }
  if (d.self) {
    payCost(w, c, d)
    // 숨 고르기: 최대 기력의 50% (저체온 1단계부터 35%, 추위 체질은 감소 없음)
    let pct = d.self.energyPct ?? 0
    if (c.needs.bodyTemp < 35 && traitAdd(w, c, 'coldBreath') <= 0) pct = Math.min(pct, 0.35)
    if (pct) c.needs.energy = Math.min(energyMax(w, c), c.needs.energy + Math.floor(energyMax(w, c) * pct))
    if (d.self.painRelief) addEffect(c, 'breath', turn + (d.self.turns ?? 3) + 1, d.self.painRelief)
    c.needs.kcal -= traitAdd(w, c, 'breathKcal')
    if (isPl) log(w, 'info', `${d.label}. 숨이 고르게 돌아온다.`)
    fx(w, { k: 'status', id: c.id, text: d.label, color: '#8fc0a0', turn })
    return { ok: true, tu: 100 }
  }
  if (!d.attack) return { ok: false, tu: 0, msg: '쓸 수 없다' }
  const mods = d.attack
  // 휘둘러 베기: 인접 8칸의 모든 개체 (아군·중립 포함), 북쪽부터 시계 방향
  if (mods.aoe === 'adjacent') {
    const targets = DIRS.map((dd) => creatureAt(w, { x: c.pos.x + dd.x, y: c.pos.y + dd.y })).filter((o): o is Creature => !!o && o.alive && o.id !== c.id)
    if (!targets.some((o) => hostileTo(c, o))) return { ok: false, tu: 0, msg: '주변에 적이 없다' }
    payCost(w, c, d)
    if (isPl) log(w, 'combat', `${d.label}!`)
    for (const t of targets) resolveAttack(w, c, t, { mods, abilityLabel: d.label, paid: true })
    return { ok: true, tu: 100 }
  }
  const t = creatureById(w, targetId)
  if (!t || !t.alive) return { ok: false, tu: 0, msg: '대상을 골라야 한다' }
  const wl = wield(w, c, d.attackMode)
  const ranged = !!(wl?.item && itemDef(w, wl.item).ranged)
  if (ranged) {
    const rd = itemDef(w, wl!.item!).ranged!
    if (cheb(c.pos, t.pos) > rd.range || !hasLos(w, c.pos, t.pos)) return { ok: false, tu: 0, msg: '쏠 수 없는 위치다' }
    if (!c.bag.find((i) => i.def === rd.ammo)) return { ok: false, tu: 0, msg: '화살이 없다' }
  } else if (!canReach(w, c, t)) return { ok: false, tu: 0, msg: '닿지 않는다' }
  // 2턴 채널 (조준 사격): 첫 턴에 기력을 내고 겨눈다. 채널 중 피격되면 취소, 기력 절반 환급
  if (d.channel && d.channel > 1) {
    payCost(w, c, d)
    c.activity = { kind: 'aim', remaining: d.channel - 1, target: { ...t.pos }, uid: t.id, label: d.label, abilityId: d.id, woundCount: c.body.wounds.length }
    c.facing = dirIndex(t.pos.x - c.pos.x, t.pos.y - c.pos.y)
    fx(w, { k: 'status', id: c.id, text: '조준', color: '#e0d080', turn })
    if (isPl) log(w, 'combat', `${d.label}: 활을 겨눈다… (${d.channel}턴)`)
    else if (w.s.visible.includes(c.pos.y * w.s.map.w + c.pos.x)) log(w, 'warn', `${c.name}이(가) 당신을 겨누고 있다.`)
    return { ok: true, tu: 100 }
  }
  payCost(w, c, d)
  if (isPl) log(w, 'combat', `${d.label}!`)
  return { ok: true, tu: 100, ...abilityStrike(w, c, t, d, ranged) }
}

/** 능력 공격 한 번 (채널 끝의 조준 사격 포함) */
export function abilityStrike(w: World, c: Creature, t: Creature, d: AbilityDef, ranged: boolean): Partial<ActResult> {
  const mods = d.attack!
  const r = rng(w, 'combat')
  const isPl = c.faction === 'player' || t.faction === 'player'
  if (ranged) {
    const rd = itemDef(w, c.equip.main!).ranged!
    const ammo = c.bag.find((i) => i.def === rd.ammo)
    if (!ammo) return { ok: false, msg: '화살이 없다' }
    removeOne(w, c, ammo.uid)
  }
  const res = resolveAttack(w, c, t, { mods, abilityLabel: d.label, ranged, mode: d.attackMode, paid: true })
  if (ranged) recoverArrow(w, c, t, res.hit)
  // 꿰뚫기: 바라보는 방향 일직선 2칸의 모든 개체 (가까운 칸부터)
  if (mods.aoe === 'line2') {
    const dir = DIRS[dirIndex(t.pos.x - c.pos.x, t.pos.y - c.pos.y)]
    const behind = { x: c.pos.x + dir.x * 2, y: c.pos.y + dir.y * 2 }
    const t2 = inBounds(w, behind) && cheb(t.pos, c.pos) === 1 ? creatureAt(w, behind) : undefined
    if (t2 && t2.id !== c.id && t2.alive) resolveAttack(w, c, t2, { mods, abilityLabel: d.label, paid: true })
  }
  if (res.hit && t.alive) {
    if (mods.knockback) pushBack(w, c, t, mods.knockback)
    if (mods.knockdownChance) {
      const q = w.db.body(t.body.def).kind === 'quadruped' ? 0.5 : 1
      if (r.chance(mods.knockdownChance * q)) knockDown(w, t, isPl, t.faction === 'player' ? '당신' : t.name)
    }
  }
  return {}
}

/** 화살 회수: 명중 60% · 빗나감 85%, 화살 회수 능력 +30%p (상한 95) (07 §7.1 · 15 §6.5) */
export function recoverArrow(w: World, c: Creature, t: Creature, hit: boolean) {
  const rd = itemDef(w, c.equip.main!).ranged
  if (!rd) return
  const p = Math.min(95, (hit ? 60 : 85) + traitAdd(w, c, 'arrowRecover'))
  if (rng(w, 'combat').int(0, 99) < p) {
    const tile = w.s.map.tiles[t.pos.y * w.s.map.w + t.pos.x]
    const ex = tile.items.find((i) => i.def === rd.ammo)
    if (ex) ex.count++
    else tile.items.push({ uid: w.s.nextId++, def: rd.ammo, count: 1 })
  }
}

/** 창벽 자세: 인접 칸에 들어오는 적대 개체에게 먼저 반응 공격 (15 §6.4 · 01 §3.2 phase 1) */
export function spearWallReact(w: World, mover: Creature) {
  const turn = turnOf(w)
  for (const o of w.s.creatures) {
    if (!o.alive || o.id === mover.id || !hostileTo(o, mover) || cheb(o.pos, mover.pos) > 1) continue
    const e = o.effects.find((x) => x.kind === 'spearWall' && x.untilTurn > turn)
    if (!e || o.unconscious || !canReach(w, o, mover)) continue
    const seen = (e.magnitude ?? 0)
    if (seen === mover.id) continue
    e.magnitude = mover.id
    if (o.faction === 'player' || mover.faction === 'player') log(w, 'combat', `${o.faction === 'player' ? '당신' : o.name}의 창벽! 다가오는 ${mover.faction === 'player' ? '당신' : mover.name}을(를) 먼저 찌른다.`)
    resolveAttack(w, o, mover, { abilityLabel: '창벽 찌르기', counter: true })
    if (!mover.alive) return
  }
}
